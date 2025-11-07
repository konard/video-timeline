import { Component, signal, computed, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaType, MediaItem, Track, TimelineState } from '../../models/timeline.models';
import { MediaLibraryComponent, MediaLibraryItem } from '../media-library/media-library.component';
import { TimelineDragDropService } from '../../services/timeline-drag-drop.service';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, MediaLibraryComponent],
  templateUrl: './timeline.component.html',
  styleUrl: './timeline.component.css'
})
export class TimelineComponent {
  // Zoom levels: pixels per second
  private readonly MIN_ZOOM = 10;
  private readonly MAX_ZOOM = 200;
  private readonly ZOOM_STEP = 20;
  readonly TRACK_HEADER_WIDTH = 150; // Width of track header in pixels
  private readonly SNAP_PROXIMITY_MS = 500; // Snap to item if playhead is within 500ms
  private readonly MIN_ITEM_DURATION = 100; // Minimum item duration in milliseconds

  // View references
  @ViewChild('timelineRuler') timelineRuler?: ElementRef<HTMLElement>;

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
    const state = this.state();
    // Calculate the maximum end time across all tracks
    let maxEndTime = state.totalDuration;

    for (const track of state.tracks) {
      for (const item of track.items) {
        const itemEndTime = item.startTime + item.duration;
        if (itemEndTime > maxEndTime) {
          maxEndTime = itemEndTime;
        }
      }
    }

    return maxEndTime * this.pixelsPerMillisecond();
  });

  readonly timelineLineHeight = computed(() => {
    const state = this.state();
    return state.tracks.length * 60 + 32;
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

  // Duration editor state
  readonly showDurationEditor = signal<boolean>(false);
  private editedDuration: number = 60; // Duration in seconds

  // Media library state
  readonly showMediaLibrary = signal<boolean>(false);
  private mediaLibraryTargetTrackId: string | null = null;

  constructor(private dragDropService: TimelineDragDropService) {
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
    // Calculate position within the ruler element
    // getBoundingClientRect() already accounts for scroll, so we don't add scrollLeft
    const x = event.clientX - rect.left;
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

          // Fix for issue #81: Find snap targets (playhead and items on all tracks)
          const snapTargets = this.dragDropService.findSnapTargets(
            this.draggedItem!.id,
            s.tracks,
            s.playheadPosition
          );

          // Calculate valid position and duration considering collisions, gap fitting, and snapping
          const validPosition = this.dragDropService.getValidDragPosition(
            this.draggedItem!,
            requestedStartTime,
            otherItems,
            s.totalDuration,
            snapTargets
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
          const bounds = this.dragDropService.getResizeBounds(
            this.resizingItem!.item,
            t.items,
            this.resizingItem!.edge,
            s.totalDuration
          );

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
      // Fix for issue #50: Use ViewChild reference to ensure we use the exact same element as onRulerMouseDown
      if (!this.timelineRuler) {
        return;
      }

      const rulerElement = this.timelineRuler.nativeElement;
      // Use the same calculation as onRulerMouseDown
      // getBoundingClientRect() already accounts for scroll, so we don't add scrollLeft
      const rect = rulerElement.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const newPosition = x / this.pixelsPerMillisecond();

      this.state.update(s => ({
        ...s,
        playheadPosition: Math.max(0, Math.min(newPosition, s.totalDuration))
      }));
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
    const totalDuration = currentState.totalDuration;
    const newItemDuration = type === MediaType.IMAGE ? 5000 : 3000;

    // Determine the start time for the new item using the service
    const startTime = this.dragDropService.calculateNewItemStartTime(
      playheadTime,
      track.items,
      this.SNAP_PROXIMITY_MS
    );

    // Fix for issue #48: Ensure new item doesn't exceed totalDuration
    const maxAllowedDuration = totalDuration - startTime;
    const finalDuration = Math.min(newItemDuration, maxAllowedDuration);

    // Fix for issue #64: Verify that the new item doesn't overlap with any existing items
    const testItem: MediaItem = {
      id: 'temp',
      type,
      startTime,
      duration: finalDuration,
      trackId,
      name: '',
      isPlaceholder: true
    };

    // Validate and adjust position if needed
    const validatedStartTime = this.dragDropService.validateItemPosition(testItem, track.items);

    // Recalculate duration limit if position was adjusted
    const adjustedMaxAllowedDuration = totalDuration - validatedStartTime;
    const adjustedDuration = Math.min(newItemDuration, adjustedMaxAllowedDuration);

    // Create the final non-overlapping item
    const newItem: MediaItem = {
      id: `item-${Date.now()}`,
      type,
      startTime: validatedStartTime,
      duration: adjustedDuration,
      trackId,
      name: `${type} placeholder`,
      isPlaceholder: true
    };

    // Set maxDuration for audio and video placeholders
    if (type === MediaType.VIDEO) {
      newItem.maxDuration = Math.min(10000, adjustedMaxAllowedDuration); // 10 seconds default for video
    } else if (type === MediaType.AUDIO) {
      newItem.maxDuration = Math.min(15000, adjustedMaxAllowedDuration); // 15 seconds default for audio
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

  // Duration editor methods
  openDurationEditor(): void {
    this.editedDuration = this.state().totalDuration / 1000;
    this.showDurationEditor.set(true);
  }

  closeDurationEditor(): void {
    this.showDurationEditor.set(false);
  }

  onDurationInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value) && value > 0) {
      this.editedDuration = value;
    }
  }

  saveDuration(): void {
    const newDurationMs = Math.max(1000, this.editedDuration * 1000); // At least 1 second
    this.state.update(s => ({
      ...s,
      totalDuration: newDurationMs,
      // Ensure playhead doesn't exceed new duration
      playheadPosition: Math.min(s.playheadPosition, newDurationMs)
    }));
    this.closeDurationEditor();
  }

  // Media library methods
  openMediaLibrary(trackId: string): void {
    this.mediaLibraryTargetTrackId = trackId;
    this.showMediaLibrary.set(true);
  }

  closeMediaLibrary(): void {
    this.showMediaLibrary.set(false);
    this.mediaLibraryTargetTrackId = null;
  }

  onMediaSelected(media: MediaLibraryItem): void {
    if (!this.mediaLibraryTargetTrackId) return;

    const currentState = this.state();
    const track = currentState.tracks.find(t => t.id === this.mediaLibraryTargetTrackId);

    if (!track) return;

    const playheadTime = currentState.playheadPosition;
    const totalDuration = currentState.totalDuration;

    // Determine the start time for the new item using the service
    const startTime = this.dragDropService.calculateNewItemStartTime(
      playheadTime,
      track.items,
      this.SNAP_PROXIMITY_MS
    );

    // Ensure item doesn't exceed totalDuration
    const maxAllowedDuration = totalDuration - startTime;
    const finalDuration = Math.min(media.duration, maxAllowedDuration);

    // Verify that the new item doesn't overlap with any existing items
    const testItem: MediaItem = {
      id: 'temp',
      type: media.type,
      startTime,
      duration: finalDuration,
      trackId: this.mediaLibraryTargetTrackId,
      name: '',
      isPlaceholder: false
    };

    // Validate and adjust position if needed
    const validatedStartTime = this.dragDropService.validateItemPosition(testItem, track.items);

    // Recalculate duration limit if position was adjusted
    const adjustedMaxAllowedDuration = totalDuration - validatedStartTime;
    const adjustedDuration = Math.min(media.duration, adjustedMaxAllowedDuration);

    // Create the final non-overlapping item
    const newItem: MediaItem = {
      id: `item-${Date.now()}`,
      type: media.type,
      startTime: validatedStartTime,
      duration: adjustedDuration,
      trackId: this.mediaLibraryTargetTrackId,
      name: media.name,
      isPlaceholder: false
    };

    // Set maxDuration for audio and video
    if (media.type === MediaType.VIDEO) {
      newItem.maxDuration = Math.min(media.duration, adjustedMaxAllowedDuration);
    } else if (media.type === MediaType.AUDIO) {
      newItem.maxDuration = Math.min(media.duration, adjustedMaxAllowedDuration);
    }

    this.state.update(s => ({
      ...s,
      tracks: s.tracks.map(t =>
        t.id === this.mediaLibraryTargetTrackId
          ? { ...t, items: [...t.items, newItem] }
          : t
      )
    }));

    // Close the media library after selection
    this.closeMediaLibrary();
  }
}
