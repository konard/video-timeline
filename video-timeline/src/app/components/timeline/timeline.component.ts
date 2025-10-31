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

  private getValidDragPosition(item: MediaItem, requestedStartTime: number, trackItems: MediaItem[]): number {
    const otherItems = trackItems.filter(i => i.id !== item.id);
    const testItem = { ...item, startTime: requestedStartTime };

    // Check for overlaps with each item
    for (const other of otherItems) {
      if (this.itemsOverlap(testItem, other)) {
        // Snap to nearest non-overlapping position
        if (requestedStartTime < other.startTime) {
          // Moving left, snap to left of other item
          return Math.max(0, other.startTime - item.duration);
        } else {
          // Moving right, snap to right of other item
          return other.startTime + other.duration;
        }
      }
    }

    return Math.max(0, requestedStartTime);
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

          // Calculate valid position considering collisions
          const validStartTime = this.getValidDragPosition(
            this.draggedItem!,
            requestedStartTime,
            otherItems
          );

          // Check if item already exists in this track
          const itemExists = t.items.some(i => i.id === this.draggedItem!.id);

          if (itemExists) {
            // Update position in current track
            return {
              ...t,
              items: t.items.map(i =>
                i.id === this.draggedItem!.id
                  ? { ...i, startTime: validStartTime, trackId: track.id }
                  : i
              )
            };
          } else {
            // Add to new track
            return {
              ...t,
              items: [
                ...otherItems,
                { ...this.draggedItem!, startTime: validStartTime, trackId: track.id }
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
        // Find the actual ruler content element (the one with mousedown handler)
        const rulerContent = scrollContainer.querySelector('.cursor-pointer') as HTMLElement;

        if (rulerContent) {
          const rect = rulerContent.getBoundingClientRect();
          const scrollLeft = scrollContainer.scrollLeft;
          const x = event.clientX - rect.left + scrollLeft;
          const newPosition = x / this.pixelsPerMillisecond();

          this.state.update(s => ({
            ...s,
            playheadPosition: Math.max(0, Math.min(newPosition, s.totalDuration))
          }));
        }
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
    const ms = milliseconds % 1000;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
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
}
