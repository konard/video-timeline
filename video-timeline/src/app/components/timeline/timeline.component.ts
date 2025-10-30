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

  // Dragging state
  private draggedItem: MediaItem | null = null;
  private draggedItemOriginalTrackId: string | null = null;
  private isDraggingPlayhead = false;
  private resizingItem: { item: MediaItem; edge: 'left' | 'right' } | null = null;

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
  onRulerClick(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
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

  // Collision detection helpers
  private itemsOverlap(item1: MediaItem, item2: MediaItem): boolean {
    const item1End = item1.startTime + item1.duration;
    const item2End = item2.startTime + item2.duration;
    return !(item1End <= item2.startTime || item2End <= item1.startTime);
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
    const x = event.clientX - rect.left;
    const requestedStartTime = Math.max(0, x / this.pixelsPerMillisecond());

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
    const x = event.clientX - rect.left;
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
                  return { ...i, startTime: newStartTime, duration: newDuration };
                } else {
                  // Constrain the new end time within bounds
                  const newEndTime = Math.max(
                    bounds.minTime,
                    Math.min(timeAtCursor, bounds.maxTime)
                  );
                  const newDuration = newEndTime - i.startTime;
                  return { ...i, duration: newDuration };
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
    this.isDraggingPlayhead = false;
    this.resizingItem = null;
  }

  onDocumentMouseMove(event: MouseEvent): void {
    if (this.isDraggingPlayhead) {
      // Find the ruler element within the timeline content wrapper
      const ruler = event.currentTarget as HTMLElement;
      const contentWrapper = ruler.querySelector('.flex-1.flex.flex-col') as HTMLElement;

      if (contentWrapper) {
        const rect = contentWrapper.getBoundingClientRect();
        const scrollLeft = contentWrapper.scrollLeft;
        const x = event.clientX - rect.left + scrollLeft;
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
    const ms = milliseconds % 1000;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  }

  getTimeMarkers(): { position: number; label: string }[] {
    const markers: { position: number; label: string }[] = [];
    const stepMs = 1000; // 1 second intervals

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

    // Find the position for the new item (after the last item or at start)
    let startTime = 0;
    if (track.items.length > 0) {
      // Sort items by start time and place after the last one
      const sortedItems = [...track.items].sort((a, b) => a.startTime - b.startTime);
      const lastItem = sortedItems[sortedItems.length - 1];
      startTime = lastItem.startTime + lastItem.duration;
    }

    const newItem: MediaItem = {
      id: `item-${Date.now()}`,
      type,
      startTime,
      duration: type === MediaType.IMAGE ? 5000 : 3000,
      trackId,
      name: `${type} placeholder`,
      isPlaceholder: true
    };

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
}
