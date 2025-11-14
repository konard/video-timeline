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
    totalDuration: 60000, // 60 seconds in milliseconds
    selectedItemId: null
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
  private mouseDownPosition: { x: number; y: number } | null = null; // Track mouse down position for click detection

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

  // Utility method to extract coordinates from mouse or touch events
  private getEventCoordinates(event: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
    if (event instanceof MouseEvent) {
      return { clientX: event.clientX, clientY: event.clientY };
    } else {
      const touch = event.touches[0] || event.changedTouches[0];
      return { clientX: touch.clientX, clientY: touch.clientY };
    }
  }

  // Playhead controls
  onRulerPointerDown(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.isDraggingFromRuler = true;

    // Immediately update position on pointer down
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const coords = this.getEventCoordinates(event);
    // Calculate position within the ruler element
    // getBoundingClientRect() already accounts for scroll, so we don't add scrollLeft
    const x = coords.clientX - rect.left;
    const newPosition = x / this.pixelsPerMillisecond();

    this.state.update(s => ({
      ...s,
      playheadPosition: Math.max(0, Math.min(newPosition, s.totalDuration))
    }));
  }

  onPlayheadPointerDown(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingPlayhead = true;
  }


  // Media item drag and drop
  onMediaItemPointerDown(event: MouseEvent | TouchEvent, item: MediaItem, track: Track): void {
    const target = event.target as HTMLElement;

    // Check if clicking/touching on resize handle
    if (target.classList.contains('resize-handle')) {
      this.resizingItem = {
        item,
        edge: target.classList.contains('resize-handle-left') ? 'left' : 'right'
      };
      event.preventDefault();
      return;
    }

    const coords = this.getEventCoordinates(event);
    // Track pointer down position for click vs drag detection
    this.mouseDownPosition = { x: coords.clientX, y: coords.clientY };

    // Calculate the offset from the item's start position to where the user clicked/touched
    // Fix for issue #100: Use the track element's bounding rect as reference, not the media item's.
    // This ensures we use the same coordinate system in both onMediaItemPointerDown and onTrackPointerMove.
    //
    // The issue was that:
    // - onMediaItemPointerDown used mediaItem.getBoundingClientRect() (which includes the item's position)
    // - onTrackPointerMove used track.getBoundingClientRect() (which is the track's left edge)
    //
    // On Android mobile, this caused a jump equal to the width of the left panel (150px) because
    // the track's left edge is 150px to the left of where the media item starts.
    //
    // By using the track's bounding rect in both places, we ensure consistent coordinate calculation.
    const mediaItemElement = event.currentTarget as HTMLElement;
    const trackElement = mediaItemElement.closest('.track') as HTMLElement;
    const trackRect = trackElement.getBoundingClientRect();
    // Calculate click position relative to the track's left edge (same reference as onTrackPointerMove)
    const clickX = coords.clientX - trackRect.left;
    // Convert pixel offset to time offset
    this.dragOffsetTime = clickX / this.pixelsPerMillisecond();

    this.draggedItem = item;
    this.draggedItemOriginalTrackId = track.id;
    event.preventDefault();
  }

  onTrackPointerDown(event: MouseEvent | TouchEvent): void {
    // Deselect when clicking/touching track background (not on media item)
    const target = event.target as HTMLElement;
    if (target.classList.contains('track')) {
      this.deselectMediaItem();
    }
  }

  onTrackPointerMove(event: MouseEvent | TouchEvent, track: Track): void {
    if (this.resizingItem) {
      this.handleResize(event, track);
      return;
    }

    if (!this.draggedItem) return;

    const coords = this.getEventCoordinates(event);
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    // Fix for issue #83: getBoundingClientRect() returns viewport-relative coordinates,
    // and coords.clientX is also viewport-relative, so we don't need to add scrollLeft
    const x = coords.clientX - rect.left;
    // Calculate the requested start time by subtracting the drag offset
    // This keeps the pointer at the same position within the item where dragging started
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

  private handleResize(event: MouseEvent | TouchEvent, track: Track): void {
    if (!this.resizingItem) return;

    const coords = this.getEventCoordinates(event);
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    // Fix for issue #83: getBoundingClientRect() returns viewport-relative coordinates,
    // and coords.clientX is also viewport-relative, so we don't need to add scrollLeft
    const x = coords.clientX - rect.left;
    const timeAtCursor = x / this.pixelsPerMillisecond();

    this.state.update(s => {
      // Fix for issue #87: Find snap targets for resize operations
      const snapTargets = this.dragDropService.findSnapTargets(
        this.resizingItem!.item.id,
        s.tracks,
        s.playheadPosition
      );

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
                  // Fix for issue #89: Handle mediaStartTime when resizing from left
                  // Apply snapping to left edge (start time)
                  let newStartTime = Math.max(
                    bounds.minTime,
                    Math.min(timeAtCursor, bounds.maxTime)
                  );

                  // Apply snapping if within snap distance
                  let minDistance = this.dragDropService.SNAP_DISTANCE_MS;
                  for (const target of snapTargets) {
                    const distance = Math.abs(newStartTime - target);
                    if (distance < minDistance) {
                      minDistance = distance;
                      // Only snap if within bounds
                      if (target >= bounds.minTime && target <= bounds.maxTime) {
                        newStartTime = target;
                      }
                    }
                  }

                  // Calculate how much the timeline position is changing
                  const deltaTime = newStartTime - i.startTime;
                  const newDuration = i.duration - deltaTime;

                  // Update media start time (trimming from source media)
                  const currentMediaStartTime = i.mediaStartTime || 0;
                  const newMediaStartTime = currentMediaStartTime + deltaTime;

                  // Check if we're trying to extend beyond the start of source media
                  if (newMediaStartTime < 0) {
                    // Can only extend left by currentMediaStartTime amount
                    const maxExtension = currentMediaStartTime;
                    const finalStartTime = i.startTime - maxExtension;
                    const finalDuration = i.duration + maxExtension;

                    // Ensure we don't exceed maxDuration
                    if (i.maxDuration && finalDuration > i.maxDuration) {
                      return {
                        ...i,
                        startTime: finalStartTime + (finalDuration - i.maxDuration),
                        duration: i.maxDuration,
                        mediaStartTime: 0
                      };
                    }

                    return {
                      ...i,
                      startTime: finalStartTime,
                      duration: finalDuration,
                      mediaStartTime: 0
                    };
                  }

                  // Ensure media end doesn't exceed maxDuration
                  if (i.maxDuration && newMediaStartTime + newDuration > i.maxDuration) {
                    const maxAllowedDuration = i.maxDuration - newMediaStartTime;
                    return {
                      ...i,
                      startTime: i.startTime + (i.duration - maxAllowedDuration),
                      duration: maxAllowedDuration,
                      mediaStartTime: newMediaStartTime
                    };
                  }

                  return {
                    ...i,
                    startTime: newStartTime,
                    duration: newDuration,
                    mediaStartTime: newMediaStartTime
                  };
                } else {
                  // Fix for issue #87: Apply snapping to right edge (end time)
                  let newEndTime = Math.max(
                    bounds.minTime,
                    Math.min(timeAtCursor, bounds.maxTime)
                  );

                  // Apply snapping if within snap distance
                  let minDistance = this.dragDropService.SNAP_DISTANCE_MS;
                  for (const target of snapTargets) {
                    const distance = Math.abs(newEndTime - target);
                    if (distance < minDistance) {
                      minDistance = distance;
                      // Only snap if within bounds
                      if (target >= bounds.minTime && target <= bounds.maxTime) {
                        newEndTime = target;
                      }
                    }
                  }

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

  onPointerUp(event: MouseEvent | TouchEvent): void {
    // Detect if this was a click/tap (not a drag) on a media item
    if (this.draggedItem && this.mouseDownPosition) {
      const coords = this.getEventCoordinates(event);
      const dx = coords.clientX - this.mouseDownPosition.x;
      const dy = coords.clientY - this.mouseDownPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If pointer moved less than 5 pixels, consider it a click/tap
      if (distance < 5) {
        this.selectMediaItem(this.draggedItem.id);
      }
    }

    this.draggedItem = null;
    this.draggedItemOriginalTrackId = null;
    this.dragOffsetTime = 0;
    this.isDraggingPlayhead = false;
    this.isDraggingFromRuler = false;
    this.resizingItem = null;
    this.mouseDownPosition = null;
  }

  onDocumentPointerMove(event: MouseEvent | TouchEvent): void {
    if (this.isDraggingPlayhead || this.isDraggingFromRuler) {
      // Fix for issue #50: Use ViewChild reference to ensure we use the exact same element as onRulerPointerDown
      if (!this.timelineRuler) {
        return;
      }

      const coords = this.getEventCoordinates(event);
      const rulerElement = this.timelineRuler.nativeElement;
      // Use the same calculation as onRulerPointerDown
      // getBoundingClientRect() already accounts for scroll, so we don't add scrollLeft
      const rect = rulerElement.getBoundingClientRect();
      const x = coords.clientX - rect.left;
      const newPosition = x / this.pixelsPerMillisecond();

      this.state.update(s => ({
        ...s,
        playheadPosition: Math.max(0, Math.min(newPosition, s.totalDuration))
      }));
    }

    // Fix for issue #96: Handle media item dragging and resizing at document level for touch events
    // This allows dragging between tracks on mobile devices
    if (event instanceof TouchEvent) {
      if (this.draggedItem) {
        // Find which track the touch is currently over
        const targetTrack = this.findTrackAtCoordinates(this.getEventCoordinates(event));
        if (targetTrack) {
          // Reuse existing drag logic
          this.onTrackPointerMove(event, targetTrack);
        }
      } else if (this.resizingItem) {
        // Find the track that contains the resizing item
        const targetTrack = this.findTrackContainingItem(this.resizingItem.item.id);
        if (targetTrack) {
          // Reuse existing resize logic
          this.handleResize(event, targetTrack);
        }
      }
    }
  }

  // Helper method to find which track is at the given Y coordinate
  private findTrackAtCoordinates(coords: { clientX: number; clientY: number }): Track | null {
    const trackElements = document.querySelectorAll('.track');
    for (const trackElement of Array.from(trackElements)) {
      const rect = trackElement.getBoundingClientRect();
      if (coords.clientY >= rect.top && coords.clientY <= rect.bottom) {
        const trackIndex = Array.from(trackElements).indexOf(trackElement);
        const tracks = this.state().tracks;
        if (trackIndex >= 0 && trackIndex < tracks.length) {
          return tracks[trackIndex];
        }
      }
    }
    return null;
  }

  // Helper method to find the track containing a specific item
  private findTrackContainingItem(itemId: string): Track | null {
    const currentState = this.state();
    for (const track of currentState.tracks) {
      if (track.items.some(item => item.id === itemId)) {
        return track;
      }
    }
    return null;
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

    // Fix for issue #85: Do not show the last time mark at totalDuration
    // to prevent container expansion from the text label
    for (let time = 0; time < this.state().totalDuration; time += stepMs) {
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
      ),
      // Deselect if removing selected item
      selectedItemId: s.selectedItemId === itemId ? null : s.selectedItemId
    }));
  }

  // Media selection
  selectMediaItem(itemId: string): void {
    this.state.update(s => ({
      ...s,
      selectedItemId: itemId
    }));
  }

  deselectMediaItem(): void {
    this.state.update(s => ({
      ...s,
      selectedItemId: null
    }));
  }

  isItemSelected(itemId: string): boolean {
    return this.state().selectedItemId === itemId;
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
