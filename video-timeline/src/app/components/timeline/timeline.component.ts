import { Component, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaType, MediaItem, Track, TimelineState } from '../../models/timeline.models';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.css'
})
export class TimelineComponent {
  // Zoom levels: pixels per second
  private readonly MIN_ZOOM = 10;
  private readonly MAX_ZOOM = 200;
  private readonly ZOOM_STEP = 20;
  private readonly TRACK_HEADER_WIDTH = 150; // Width of track header in pixels
  private readonly SNAP_PROXIMITY_MS = 500; // Snap to item if playhead is within 500ms
  private readonly MIN_ITEM_DURATION = 100; // Minimum item duration in milliseconds

  // Timeline state
  readonly state = signal<TimelineState>({
    tracks: [
      { id: '1', name: 'Track 1', order: 0, items: [] },
      { id: '2', name: 'Track 2', order: 1, items: [] }
    ],
    playheadPosition: 0,
    zoomLevel: 50, // pixels per second
    totalDuration: 60000 // 60 seconds in milliseconds
  });

  // Computed values
  readonly pixelsPerMillisecond = computed(() => {
    return this.state().zoomLevel / 1000;
  });

  readonly timelineWidth = computed(() => {
    return this.state().totalDuration * this.pixelsPerMillisecond();
  });

  readonly playheadPosition = computed(() => {
    return this.state().playheadPosition * this.pixelsPerMillisecond();
  });

  readonly playheadVisualPosition = computed(() => {
    return this.playheadPosition() + this.TRACK_HEADER_WIDTH;
  });

  // Dragging state
  private draggedItem: MediaItem | null = null;
  private draggedItemOriginalTrackId: string | null = null;
  private dragOffsetTime: number = 0; // Offset in milliseconds from item start to cursor position
  private isDraggingPlayhead = false;
  private isDraggingFromRuler = false;
  private resizingItem: { item: MediaItem; edge: 'left' | 'right' } | null = null;

  // Video preview state
  readonly isPlaying = signal<boolean>(false);

  constructor() {
    // Add some demo items
    this.addDemoItems();
  }

  private addDemoItems(): void {
    const currentState = this.state();
    const updatedTracks = [...currentState.tracks];

    // Add demo video item
    updatedTracks[0].items.push({
      id: 'demo-video-1',
      type: MediaType.VIDEO,
      startTime: 0,
      duration: 5000,
      maxDuration: 10000, // 10 seconds max
      trackId: '1',
      name: 'Video placeholder',
      isPlaceholder: true
    });

    // Add demo audio item
    updatedTracks[1].items.push({
      id: 'demo-audio-1',
      type: MediaType.AUDIO,
      startTime: 2000,
      duration: 8000,
      maxDuration: 15000, // 15 seconds max
      trackId: '2',
      name: 'Audio placeholder',
      isPlaceholder: true
    });

    this.state.update(s => ({ ...s, tracks: updatedTracks }));
  }

  // Track management
  addTrack(): void {
    const currentState = this.state();
    const newTrack: Track = {
      id: `track-${Date.now()}`,
      name: `Track ${currentState.tracks.length + 1}`,
      order: currentState.tracks.length,
      items: []
    };

    this.state.update(s => ({
      ...s,
      tracks: [...s.tracks, newTrack]
    }));
  }

  removeTrack(trackId: string): void {
    const currentState = this.state();
    if (currentState.tracks.length <= 1) {
      return; // Keep at least one track
    }

    this.state.update(s => ({
      ...s,
      tracks: s.tracks.filter(t => t.id !== trackId)
    }));
  }

  // Zoom controls
  zoomIn(): void {
    this.state.update(s => ({
      ...s,
      zoomLevel: Math.min(s.zoomLevel + this.ZOOM_STEP, this.MAX_ZOOM)
    }));
  }

  zoomOut(): void {
    this.state.update(s => ({
      ...s,
      zoomLevel: Math.max(s.zoomLevel - this.ZOOM_STEP, this.MIN_ZOOM)
    }));
  }

  // Playhead controls
  onRulerMouseDown(event: MouseEvent): void {
    event.preventDefault();
    this.isDraggingFromRuler = true;

    // Immediately update position on mouse down
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    // Get the scrollable container to account for scroll offset
    const scrollContainer = target.closest('.overflow-x-auto') as HTMLElement;
    const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
    const x = event.clientX - rect.left + scrollLeft;
    const newPosition = x / this.pixelsPerMillisecond();

    this.state.update(s => ({
      ...s,
      playheadPosition: Math.max(0, Math.min(newPosition, s.totalDuration))
    }));
  }

  onPlayheadMouseDown(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingPlayhead = true;
  }

  // Collision detection helpers
  private itemsOverlap(item1: MediaItem, item2: MediaItem): boolean {
    const item1End = item1.startTime + item1.duration;
    const item2End = item2.startTime + item2.duration;
    return !(item1End <= item2.startTime || item2End <= item1.startTime);
  }

  /**
   * Finds the closest item to the given time position in the track
   * Returns null if no items exist in the track
   */
  private findClosestItem(trackItems: MediaItem[], time: number): MediaItem | null {
    if (trackItems.length === 0) return null;

    let closestItem = trackItems[0];
    let minDistance = Math.abs(closestItem.startTime - time);

    for (const item of trackItems) {
      const itemEnd = item.startTime + item.duration;

      // Calculate distance to the start of the item
      const distanceToStart = Math.abs(item.startTime - time);

      // Calculate distance to the end of the item
      const distanceToEnd = Math.abs(itemEnd - time);

      // Use the minimum distance (to either start or end of item)
      const distance = Math.min(distanceToStart, distanceToEnd);

      if (distance < minDistance) {
        minDistance = distance;
        closestItem = item;
      }
    }

    return closestItem;
  }

  /**
   * Find all gaps in the track
   * Used for finding the closest gap when requested position overlaps an item
   */
  private findAllGaps(trackItems: MediaItem[]): { gapStart: number; gapEnd: number; leftItem: MediaItem | null; rightItem: MediaItem | null }[] {
    const gaps: { gapStart: number; gapEnd: number; leftItem: MediaItem | null; rightItem: MediaItem | null }[] = [];
    const sortedItems = [...trackItems].sort((a, b) => a.startTime - b.startTime);

    if (sortedItems.length === 0) {
      return [{ gapStart: 0, gapEnd: Infinity, leftItem: null, rightItem: null }];
    }

    // Gap before first item
    if (sortedItems[0].startTime > 0) {
      gaps.push({
        gapStart: 0,
        gapEnd: sortedItems[0].startTime,
        leftItem: null,
        rightItem: sortedItems[0]
      });
    }

    // Gaps between items
    for (let i = 0; i < sortedItems.length - 1; i++) {
      const leftItem = sortedItems[i];
      const rightItem = sortedItems[i + 1];
      const gapStart = leftItem.startTime + leftItem.duration;
      const gapEnd = rightItem.startTime;

      if (gapEnd > gapStart) {
        gaps.push({ gapStart, gapEnd, leftItem, rightItem });
      }
    }

    // Gap after last item
    const lastItem = sortedItems[sortedItems.length - 1];
    gaps.push({
      gapStart: lastItem.startTime + lastItem.duration,
      gapEnd: Infinity,
      leftItem: lastItem,
      rightItem: null
    });

    return gaps;
  }

  /**
   * Find the closest gap to the requested position
   * Used when the requested position overlaps an existing item
   */
  private findClosestGap(
    requestedStartTime: number,
    gaps: { gapStart: number; gapEnd: number; leftItem: MediaItem | null; rightItem: MediaItem | null }[]
  ): { gapStart: number; gapEnd: number; leftItem: MediaItem | null; rightItem: MediaItem | null } {
    let closestGap = gaps[0];
    let minDistance = Infinity;

    for (const gap of gaps) {
      let distance: number;

      if (requestedStartTime < gap.gapStart) {
        // Requested position is before this gap
        distance = gap.gapStart - requestedStartTime;
      } else if (gap.gapEnd === Infinity || requestedStartTime < gap.gapEnd) {
        // Requested position is within this gap
        distance = 0;
      } else {
        // Requested position is after this gap
        distance = requestedStartTime - gap.gapEnd;
      }

      if (distance < minDistance) {
        minDistance = distance;
        closestGap = gap;
      }
    }

    return closestGap;
  }

  /**
   * Finds the gap where the requested position falls and returns gap boundaries
   * Returns null if the position doesn't fall in a valid gap
   */
  private findGapForPosition(
    requestedStartTime: number,
    itemDuration: number,
    trackItems: MediaItem[]
  ): { gapStart: number; gapEnd: number; leftItem: MediaItem | null; rightItem: MediaItem | null } | null {
    const sortedItems = [...trackItems].sort((a, b) => a.startTime - b.startTime);

    // Empty track - infinite gap
    if (sortedItems.length === 0) {
      return { gapStart: 0, gapEnd: Infinity, leftItem: null, rightItem: null };
    }

    // Check gap before first item
    if (requestedStartTime < sortedItems[0].startTime) {
      return {
        gapStart: 0,
        gapEnd: sortedItems[0].startTime,
        leftItem: null,
        rightItem: sortedItems[0]
      };
    }

    // Check gaps between items
    for (let i = 0; i < sortedItems.length - 1; i++) {
      const leftItem = sortedItems[i];
      const rightItem = sortedItems[i + 1];
      const gapStart = leftItem.startTime + leftItem.duration;
      const gapEnd = rightItem.startTime;

      // Check if requested position falls within this gap
      if (requestedStartTime >= gapStart && requestedStartTime < gapEnd) {
        return { gapStart, gapEnd, leftItem, rightItem };
      }
    }

    // Check gap after last item
    const lastItem = sortedItems[sortedItems.length - 1];
    if (requestedStartTime >= lastItem.startTime + lastItem.duration) {
      return {
        gapStart: lastItem.startTime + lastItem.duration,
        gapEnd: Infinity,
        leftItem: lastItem,
        rightItem: null
      };
    }

    return null;
  }

  /**
   * Calculate valid drag position with automatic duration adjustment to fit gaps
   * Fixes issue #33: When dragging into a gap smaller than item duration,
   * adjust duration to fit instead of overlapping adjacent items
   * Fixes issue #36: When dragging overlaps an existing item, find the closest gap
   * instead of jumping to the end of the track
   * Fixes issue #38: Prevent overlaps by ensuring items always start at or after gap start
   */
  private getValidDragPosition(
    item: MediaItem,
    requestedStartTime: number,
    trackItems: MediaItem[]
  ): { startTime: number; duration: number } {
    const otherItems = trackItems.filter(i => i.id !== item.id);

    // Empty track - place at requested position with original duration
    if (otherItems.length === 0) {
      return {
        startTime: Math.max(0, requestedStartTime),
        duration: item.duration
      };
    }

    // Find which gap the requested position falls into
    let gap = this.findGapForPosition(requestedStartTime, item.duration, otherItems);

    if (!gap) {
      // Position overlaps an existing item
      // Fix for issue #36: Find the closest gap instead of jumping to end
      const allGaps = this.findAllGaps(otherItems);
      gap = this.findClosestGap(requestedStartTime, allGaps);
    }

    const gapSize = gap.gapEnd === Infinity ? Infinity : gap.gapEnd - gap.gapStart;

    // If gap is infinite (after last item), use original duration
    // Fix for issue #38: Ensure item starts at or after gap start to prevent overlap
    if (gapSize === Infinity) {
      return {
        startTime: Math.max(gap.gapStart, requestedStartTime),
        duration: item.duration
      };
    }

    // If item fits completely in the gap, use original duration
    if (item.duration <= gapSize) {
      // Make sure the item doesn't go past the gap end
      const maxStartTime = gap.gapEnd - item.duration;
      const finalStartTime = Math.max(gap.gapStart, Math.min(requestedStartTime, maxStartTime));
      return {
        startTime: finalStartTime,
        duration: item.duration
      };
    }

    // Item doesn't fit - adjust duration to fit the gap
    // Respect minimum duration constraint
    const adjustedDuration = Math.max(this.MIN_ITEM_DURATION, gapSize);

    return {
      startTime: gap.gapStart,
      duration: adjustedDuration
    };
  }

  private getResizeBounds(item: MediaItem, trackItems: MediaItem[], edge: 'left' | 'right'): { minTime: number; maxTime: number } {
    const otherItems = trackItems.filter(i => i.id !== item.id)
      .sort((a, b) => a.startTime - b.startTime);

    if (edge === 'left') {
      // Find item to the left
      const leftItem = otherItems
        .filter(i => i.startTime + i.duration <= item.startTime)
        .pop();

      const minTime = leftItem ? leftItem.startTime + leftItem.duration : 0;
      const maxTime = item.startTime + item.duration - 100; // Keep minimum duration

      return { minTime, maxTime };
    } else {
      // Find item to the right
      const rightItem = otherItems
        .find(i => i.startTime >= item.startTime + item.duration);

      const minTime = item.startTime + 100; // Minimum duration
      const maxTime = rightItem ? rightItem.startTime : Infinity;

      return { minTime, maxTime };
    }
  }

  // Media item drag and drop
  onMediaItemMouseDown(event: MouseEvent, item: MediaItem, track: Track): void {
    const target = event.target as HTMLElement;

    // Check if clicking on resize handle
    if (target.classList.contains('resize-handle')) {
      this.resizingItem = {
        item,
        edge: target.classList.contains('resize-handle-left') ? 'left' : 'right'
      };
      event.preventDefault();
      return;
    }

    // Calculate the offset from the item's start position to where the user clicked
    const trackElement = target.closest('.track') as HTMLElement;
    if (trackElement) {
      const rect = trackElement.getBoundingClientRect();
      // Get the scrollable container to account for scroll offset
      const scrollContainer = trackElement.closest('.overflow-x-auto') as HTMLElement;
      const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
      const clickX = event.clientX - rect.left + scrollLeft;
      const clickTime = clickX / this.pixelsPerMillisecond();
      this.dragOffsetTime = clickTime - item.startTime;
    } else {
      this.dragOffsetTime = 0;
    }

    this.draggedItem = item;
    this.draggedItemOriginalTrackId = track.id;
    event.preventDefault();
  }

  onTrackMouseMove(event: MouseEvent, track: Track): void {
    if (this.resizingItem) {
      this.handleResize(event, track);
      return;
    }

    if (!this.draggedItem) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    // Get the scrollable container to account for scroll offset
    const scrollContainer = target.closest('.overflow-x-auto') as HTMLElement;
    const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
    const x = event.clientX - rect.left + scrollLeft;
    // Calculate the requested start time by subtracting the drag offset
    // This keeps the cursor at the same position within the item where dragging started
    const requestedStartTime = Math.max(0, x / this.pixelsPerMillisecond() - this.dragOffsetTime);

    this.state.update(s => {
      const updatedTracks = s.tracks.map(t => {
        if (t.id === track.id) {
          // Get all items except the dragged one for collision detection
          const otherItems = t.items.filter(i => i.id !== this.draggedItem!.id);

          // Calculate valid position and duration considering collisions and gap fitting
          const validPosition = this.getValidDragPosition(
            this.draggedItem!,
            requestedStartTime,
            otherItems
          );

          // Check if item already exists in this track
          const itemExists = t.items.some(i => i.id === this.draggedItem!.id);

          if (itemExists) {
            // Update position and duration in current track
            return {
              ...t,
              items: t.items.map(i =>
                i.id === this.draggedItem!.id
                  ? {
                      ...i,
                      startTime: validPosition.startTime,
                      duration: validPosition.duration,
                      trackId: track.id
                    }
                  : i
              )
            };
          } else {
            // Add to new track with adjusted position and duration
            return {
              ...t,
              items: [
                ...otherItems,
                {
                  ...this.draggedItem!,
                  startTime: validPosition.startTime,
                  duration: validPosition.duration,
                  trackId: track.id
                }
              ]
            };
          }
        } else if (t.id === this.draggedItemOriginalTrackId && t.id !== track.id) {
          // Remove from original track only if moving to different track
          return {
            ...t,
            items: t.items.filter(i => i.id !== this.draggedItem!.id)
          };
        }
        return t;
      });

      // Update the original track ID to current track for smooth dragging within same track
      this.draggedItemOriginalTrackId = track.id;

      return { ...s, tracks: updatedTracks };
    });
  }

  private handleResize(event: MouseEvent, track: Track): void {
    if (!this.resizingItem) return;

    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    // Get the scrollable container to account for scroll offset
    const scrollContainer = target.closest('.overflow-x-auto') as HTMLElement;
    const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
    const x = event.clientX - rect.left + scrollLeft;
    const timeAtCursor = x / this.pixelsPerMillisecond();

    this.state.update(s => {
      const updatedTracks = s.tracks.map(t => {
        if (t.id === track.id) {
          // Get resize bounds considering adjacent items
          const bounds = this.getResizeBounds(this.resizingItem!.item, t.items, this.resizingItem!.edge);

          return {
            ...t,
            items: t.items.map(i => {
              if (i.id === this.resizingItem!.item.id) {
                if (this.resizingItem!.edge === 'left') {
                  // Constrain the new start time within bounds
                  const newStartTime = Math.max(
                    bounds.minTime,
                    Math.min(timeAtCursor, bounds.maxTime)
                  );
                  const newDuration = i.duration + (i.startTime - newStartTime);

                  // Limit duration by maxDuration if specified
                  const limitedDuration = i.maxDuration
                    ? Math.min(newDuration, i.maxDuration)
                    : newDuration;

                  // Adjust startTime if duration was limited
                  const adjustedStartTime = i.startTime + i.duration - limitedDuration;

                  return { ...i, startTime: adjustedStartTime, duration: limitedDuration };
                } else {
                  // Constrain the new end time within bounds
                  const newEndTime = Math.max(
                    bounds.minTime,
                    Math.min(timeAtCursor, bounds.maxTime)
                  );
                  const newDuration = newEndTime - i.startTime;

                  // Limit duration by maxDuration if specified
                  const limitedDuration = i.maxDuration
                    ? Math.min(newDuration, i.maxDuration)
                    : newDuration;

                  return { ...i, duration: limitedDuration };
                }
              }
              return i;
            })
          };
        }
        return t;
      });

      return { ...s, tracks: updatedTracks };
    });
  }

  onMouseUp(): void {
    this.draggedItem = null;
    this.draggedItemOriginalTrackId = null;
    this.dragOffsetTime = 0;
    this.isDraggingPlayhead = false;
    this.isDraggingFromRuler = false;
    this.resizingItem = null;
  }

  onDocumentMouseMove(event: MouseEvent): void {
    if (this.isDraggingPlayhead || this.isDraggingFromRuler) {
      // Find the ruler element to calculate position (same as onRulerMouseDown)
      const rootElement = event.currentTarget as HTMLElement;
      const scrollContainer = rootElement.querySelector('.flex-1.flex.flex-col.overflow-y-auto.overflow-x-auto') as HTMLElement;

      if (scrollContainer) {
        // Get the scroll container's bounding rect
        const rect = scrollContainer.getBoundingClientRect();
        const scrollLeft = scrollContainer.scrollLeft;
        // Subtract TRACK_HEADER_WIDTH to account for the track header offset
        // playheadVisualPosition includes TRACK_HEADER_WIDTH, so we need to subtract it
        // to convert from visual coordinates to timeline coordinates
        const x = event.clientX - rect.left + scrollLeft - this.TRACK_HEADER_WIDTH;
        const newPosition = x / this.pixelsPerMillisecond();

        this.state.update(s => ({
          ...s,
          playheadPosition: Math.max(0, Math.min(newPosition, s.totalDuration))
        }));
      }
    }
  }

  // Helper methods
  getItemStyle(item: MediaItem) {
    return {
      left: `${item.startTime * this.pixelsPerMillisecond()}px`,
      width: `${item.duration * this.pixelsPerMillisecond()}px`
    };
  }

  getMediaTypeClass(type: MediaType): string {
    return `media-${type}`;
  }

  formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const cs = Math.floor((milliseconds % 1000) / 10);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
  }

  /**
   * Calculate appropriate time interval for markers based on zoom level
   * to prevent marker labels from overlapping
   */
  private getMarkerInterval(): number {
    // Minimum spacing between markers in pixels to prevent overlap
    // Enough space for "0:00.000" text (about 50-60px)
    const MIN_MARKER_SPACING_PX = 60;

    // Calculate how much time represents MIN_MARKER_SPACING_PX at current zoom
    const pixelsPerMs = this.pixelsPerMillisecond();
    const minTimeSpacing = MIN_MARKER_SPACING_PX / pixelsPerMs;

    // Define possible intervals (in ms): 100ms, 250ms, 500ms, 1s, 2s, 5s, 10s, 30s, 60s
    const intervals = [100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000];

    // Find the smallest interval that's larger than or equal to minTimeSpacing
    for (const interval of intervals) {
      if (interval >= minTimeSpacing) {
        return interval;
      }
    }

    // If even 60s is too small, use larger intervals
    return Math.ceil(minTimeSpacing / 60000) * 60000;
  }

  getTimeMarkers(): { position: number; label: string }[] {
    const markers: { position: number; label: string }[] = [];
    const stepMs = this.getMarkerInterval(); // Dynamic interval based on zoom level

    for (let time = 0; time <= this.state().totalDuration; time += stepMs) {
      markers.push({
        position: time * this.pixelsPerMillisecond(),
        label: this.formatTime(time)
      });
    }

    return markers;
  }

  // Add placeholder media item
  addMediaItem(type: MediaType, trackId: string): void {
    const currentState = this.state();
    const track = currentState.tracks.find(t => t.id === trackId);

    if (!track) return;

    const playheadTime = currentState.playheadPosition;
    const newItemDuration = type === MediaType.IMAGE ? 5000 : 3000;

    // Determine the start time for the new item
    let startTime = 0;

    if (track.items.length > 0) {
      // Find the closest item to the playhead
      const closestItem = this.findClosestItem(track.items, playheadTime);

      if (closestItem) {
        const itemEnd = closestItem.startTime + closestItem.duration;
        const distanceToStart = Math.abs(closestItem.startTime - playheadTime);
        const distanceToEnd = Math.abs(itemEnd - playheadTime);

        // Check if playhead is close enough to snap
        if (distanceToEnd <= this.SNAP_PROXIMITY_MS) {
          // Snap to the end of the closest item
          startTime = itemEnd;
        } else if (distanceToStart <= this.SNAP_PROXIMITY_MS) {
          // Snap to the start of the closest item (place before it)
          // But we need to check if there's space before it
          const itemBefore = [...track.items]
            .filter(item => item.startTime + item.duration <= closestItem.startTime)
            .sort((a, b) => a.startTime - b.startTime)
            .pop();

          if (itemBefore) {
            startTime = itemBefore.startTime + itemBefore.duration;
          } else {
            startTime = 0;
          }
        } else {
          // Playhead is not close to any item, check if it overlaps with any item
          const overlappingItem = track.items.find(item => {
            const itemStart = item.startTime;
            const itemEnd = item.startTime + item.duration;
            return playheadTime >= itemStart && playheadTime < itemEnd;
          });

          if (overlappingItem) {
            // Playhead overlaps with an item, place after the last item
            const sortedItems = [...track.items].sort((a, b) => a.startTime - b.startTime);
            const lastItem = sortedItems[sortedItems.length - 1];
            startTime = lastItem.startTime + lastItem.duration;
          } else {
            // No overlap, place at playhead position
            startTime = playheadTime;
          }
        }
      } else {
        // No items in track, place at playhead position
        startTime = playheadTime;
      }
    } else {
      // Empty track, place at playhead position
      startTime = playheadTime;
    }

    const newItem: MediaItem = {
      id: `item-${Date.now()}`,
      type,
      startTime,
      duration: newItemDuration,
      trackId,
      name: `${type} placeholder`,
      isPlaceholder: true
    };

    // Set maxDuration for audio and video placeholders
    if (type === MediaType.VIDEO) {
      newItem.maxDuration = 10000; // 10 seconds default for video
    } else if (type === MediaType.AUDIO) {
      newItem.maxDuration = 15000; // 15 seconds default for audio
    }

    this.state.update(s => ({
      ...s,
      tracks: s.tracks.map(t =>
        t.id === trackId
          ? { ...t, items: [...t.items, newItem] }
          : t
      )
    }));
  }

  removeMediaItem(itemId: string, trackId: string): void {
    this.state.update(s => ({
      ...s,
      tracks: s.tracks.map(t =>
        t.id === trackId
          ? { ...t, items: t.items.filter(i => i.id !== itemId) }
          : t
      )
    }));
  }

  readonly MediaType = MediaType;

  // Video preview controls
  togglePlayback(): void {
    this.isPlaying.update(playing => !playing);
  }

  skipBackward(): void {
    this.state.update(s => ({
      ...s,
      playheadPosition: Math.max(0, s.playheadPosition - 5000)
    }));
  }

  skipForward(): void {
    this.state.update(s => ({
      ...s,
      playheadPosition: Math.min(s.totalDuration, s.playheadPosition + 5000)
    }));
  }

  // Extract track number from track name
  getTrackNumber(trackName: string): string {
    const match = trackName.match(/\d+/);
    return match ? match[0] : trackName;
  }
}
