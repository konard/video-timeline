import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TimelineComponent } from './timeline.component';
import { MediaType } from '../../models/timeline.models';

describe('TimelineComponent', () => {
  let component: TimelineComponent;
  let fixture: ComponentFixture<TimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineComponent],
      providers: [provideZonelessChangeDetection()]
    }).compileComponents();

    fixture = TestBed.createComponent(TimelineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with default state', () => {
    const state = component.state();
    expect(state.tracks.length).toBeGreaterThanOrEqual(2);
    expect(state.playheadPosition).toBe(0);
    expect(state.zoomLevel).toBe(50);
    expect(state.totalDuration).toBe(60000);
  });

  it('should add a new track', () => {
    const initialTrackCount = component.state().tracks.length;
    component.addTrack();
    expect(component.state().tracks.length).toBe(initialTrackCount + 1);
  });

  it('should remove a track', () => {
    component.addTrack();
    component.addTrack();
    const initialTrackCount = component.state().tracks.length;
    const trackToRemove = component.state().tracks[0].id;

    component.removeTrack(trackToRemove);
    expect(component.state().tracks.length).toBe(initialTrackCount - 1);
    expect(component.state().tracks.find(t => t.id === trackToRemove)).toBeUndefined();
  });

  it('should not remove last track', () => {
    // Remove all tracks except one
    while (component.state().tracks.length > 1) {
      component.removeTrack(component.state().tracks[0].id);
    }

    const singleTrack = component.state().tracks[0];
    component.removeTrack(singleTrack.id);
    expect(component.state().tracks.length).toBe(1);
  });

  it('should zoom in', () => {
    const initialZoom = component.state().zoomLevel;
    component.zoomIn();
    expect(component.state().zoomLevel).toBeGreaterThan(initialZoom);
  });

  it('should zoom out', () => {
    const initialZoom = component.state().zoomLevel;
    component.zoomOut();
    expect(component.state().zoomLevel).toBeLessThan(initialZoom);
  });

  it('should add media item to track', () => {
    const track = component.state().tracks[0];
    const initialItemCount = track.items.length;

    component.addMediaItem(MediaType.VIDEO, track.id);

    const updatedTrack = component.state().tracks.find(t => t.id === track.id);
    expect(updatedTrack?.items.length).toBe(initialItemCount + 1);
  });

  it('should remove media item from track', () => {
    const track = component.state().tracks[0];
    component.addMediaItem(MediaType.VIDEO, track.id);

    const itemToRemove = component.state().tracks
      .find(t => t.id === track.id)?.items[0].id;

    if (itemToRemove) {
      const initialItemCount = component.state().tracks
        .find(t => t.id === track.id)?.items.length || 0;

      component.removeMediaItem(itemToRemove, track.id);

      const updatedTrack = component.state().tracks.find(t => t.id === track.id);
      expect(updatedTrack?.items.length).toBe(initialItemCount - 1);
    }
  });

  it('should format time correctly', () => {
    expect(component.formatTime(0)).toBe('0:00.00');
    expect(component.formatTime(1000)).toBe('0:01.00');
    expect(component.formatTime(60000)).toBe('1:00.00');
    expect(component.formatTime(65500)).toBe('1:05.50');
  });

  it('should calculate pixels per millisecond', () => {
    const pixelsPerMs = component.pixelsPerMillisecond();
    expect(pixelsPerMs).toBe(0.05); // 50 zoom level / 1000
  });

  it('should calculate timeline width', () => {
    const width = component.timelineWidth();
    expect(width).toBe(3000); // 60000ms * 0.05 pixels/ms
  });

  it('should get correct media type class', () => {
    expect(component.getMediaTypeClass(MediaType.VIDEO)).toBe('media-video');
    expect(component.getMediaTypeClass(MediaType.AUDIO)).toBe('media-audio');
    expect(component.getMediaTypeClass(MediaType.IMAGE)).toBe('media-image');
  });

  describe('Collision Detection', () => {
    it('should not allow overlapping items when adding media', () => {
      const track = component.state().tracks[0];

      // Add first item
      component.addMediaItem(MediaType.VIDEO, track.id);
      const firstItem = component.state().tracks.find(t => t.id === track.id)?.items[0];

      // Add second item - should be placed after first item
      component.addMediaItem(MediaType.AUDIO, track.id);
      const items = component.state().tracks.find(t => t.id === track.id)?.items || [];

      expect(items.length).toBe(2);
      if (firstItem && items[1]) {
        // Second item should start after first item ends
        expect(items[1].startTime).toBeGreaterThanOrEqual(firstItem.startTime + firstItem.duration);
      }
    });

    it('should place new items after the last item in track', () => {
      const track = component.state().tracks[0];

      // Clear any existing items
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? { ...t, items: [] } : t)
      }));

      // Add three items
      component.addMediaItem(MediaType.VIDEO, track.id);
      component.addMediaItem(MediaType.AUDIO, track.id);
      component.addMediaItem(MediaType.IMAGE, track.id);

      const items = component.state().tracks.find(t => t.id === track.id)?.items || [];
      expect(items.length).toBe(3);

      // Each item should start after the previous one ends
      for (let i = 1; i < items.length; i++) {
        const prevItem = items[i - 1];
        const currItem = items[i];
        expect(currItem.startTime).toBe(prevItem.startTime + prevItem.duration);
      }
    });

    it('should prevent items from overlapping during drag', () => {
      const track = component.state().tracks[0];

      // Clear existing items and add two items with a gap
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item1',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 5000,
              trackId: track.id,
              name: 'Item 1',
              isPlaceholder: true
            },
            {
              id: 'item2',
              type: MediaType.AUDIO,
              startTime: 10000,
              duration: 5000,
              trackId: track.id,
              name: 'Item 2',
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      // Simulate dragging item2 into the space of item1
      const mockEvent = {
        currentTarget: document.createElement('div'),
        clientX: 250, // This would be around 5000ms at default zoom
        target: document.createElement('div')
      } as unknown as MouseEvent;

      Object.defineProperty(mockEvent.currentTarget, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, right: 1000, bottom: 100 })
      });

      const item2 = component.state().tracks.find(t => t.id === track.id)?.items[1];
      if (item2) {
        // Start dragging item2
        component['draggedItem'] = item2;
        component['draggedItemOriginalTrackId'] = track.id;

        // Move to a position that would overlap with item1
        component.onTrackMouseMove(mockEvent, track);

        const items = component.state().tracks.find(t => t.id === track.id)?.items || [];
        const draggedItem = items.find(i => i.id === 'item2');
        const otherItem = items.find(i => i.id === 'item1');

        if (draggedItem && otherItem) {
          // Items should not overlap
          const item1End = otherItem.startTime + otherItem.duration;
          const item2End = draggedItem.startTime + draggedItem.duration;

          const overlaps = !(item1End <= draggedItem.startTime || item2End <= otherItem.startTime);
          expect(overlaps).toBe(false);
        }
      }
    });

    it('should maintain item visibility during drag within same track', () => {
      const track = component.state().tracks[0];

      // Add an item
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [{
            id: 'test-item',
            type: MediaType.VIDEO,
            startTime: 5000,
            duration: 3000,
            trackId: track.id,
            name: 'Test Item',
            isPlaceholder: true
          }]
        } : t)
      }));

      const item = component.state().tracks.find(t => t.id === track.id)?.items[0];
      expect(item).toBeDefined();

      // Simulate drag
      const mockEvent = {
        currentTarget: document.createElement('div'),
        clientX: 300,
        target: document.createElement('div')
      } as unknown as MouseEvent;

      Object.defineProperty(mockEvent.currentTarget, 'getBoundingClientRect', {
        value: () => ({ left: 0, top: 0, right: 1000, bottom: 100 })
      });

      if (item) {
        component['draggedItem'] = item;
        component['draggedItemOriginalTrackId'] = track.id;

        // Move within same track
        component.onTrackMouseMove(mockEvent, track);

        // Item should still exist
        const items = component.state().tracks.find(t => t.id === track.id)?.items || [];
        expect(items.length).toBe(1);
        expect(items[0].id).toBe('test-item');
      }
    });
  });

  describe('Playhead-based Media Placement', () => {
    beforeEach(() => {
      // Clear all items from tracks before each test
      const currentState = component.state();
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => ({ ...t, items: [] })),
        playheadPosition: 0
      }));
    });

    it('should place new media at playhead position when track is empty', () => {
      const track = component.state().tracks[0];
      const playheadPosition = 5000; // 5 seconds

      // Set playhead position
      component.state.update(s => ({ ...s, playheadPosition }));

      // Add media item
      component.addMediaItem(MediaType.VIDEO, track.id);

      const items = component.state().tracks.find(t => t.id === track.id)?.items || [];
      expect(items.length).toBe(1);
      expect(items[0].startTime).toBe(playheadPosition);
    });

    it('should place new media at playhead position when no overlap', () => {
      const track = component.state().tracks[0];

      // Add an existing item at 0-5000ms
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [{
            id: 'item1',
            type: MediaType.VIDEO,
            startTime: 0,
            duration: 5000,
            trackId: track.id,
            name: 'Item 1',
            isPlaceholder: true
          }]
        } : t)
      }));

      // Set playhead at 10000ms (no overlap)
      const playheadPosition = 10000;
      component.state.update(s => ({ ...s, playheadPosition }));

      // Add new item
      component.addMediaItem(MediaType.AUDIO, track.id);

      const items = component.state().tracks.find(t => t.id === track.id)?.items || [];
      expect(items.length).toBe(2);
      expect(items[1].startTime).toBe(playheadPosition);
    });

    it('should place new media after last item when playhead overlaps existing item', () => {
      const track = component.state().tracks[0];

      // Add existing item at 0-5000ms
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [{
            id: 'item1',
            type: MediaType.VIDEO,
            startTime: 0,
            duration: 5000,
            trackId: track.id,
            name: 'Item 1',
            isPlaceholder: true
          }]
        } : t)
      }));

      // Set playhead at 2500ms (overlaps with item1)
      const playheadPosition = 2500;
      component.state.update(s => ({ ...s, playheadPosition }));

      // Add new item
      component.addMediaItem(MediaType.AUDIO, track.id);

      const items = component.state().tracks.find(t => t.id === track.id)?.items || [];
      expect(items.length).toBe(2);
      // Should be placed after item1 (at 5000ms)
      expect(items[1].startTime).toBe(5000);
    });

    it('should snap to end of closest item when playhead is within SNAP_PROXIMITY_MS', () => {
      const track = component.state().tracks[0];

      // Add existing item at 0-5000ms
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [{
            id: 'item1',
            type: MediaType.VIDEO,
            startTime: 0,
            duration: 5000,
            trackId: track.id,
            name: 'Item 1',
            isPlaceholder: true
          }]
        } : t)
      }));

      // Set playhead at 5300ms (300ms from end of item1, within 500ms snap proximity)
      const playheadPosition = 5300;
      component.state.update(s => ({ ...s, playheadPosition }));

      // Add new item
      component.addMediaItem(MediaType.AUDIO, track.id);

      const items = component.state().tracks.find(t => t.id === track.id)?.items || [];
      expect(items.length).toBe(2);
      // Should snap to end of item1 (at 5000ms)
      expect(items[1].startTime).toBe(5000);
    });

    it('should snap to start of closest item when playhead is within SNAP_PROXIMITY_MS before it', () => {
      const track = component.state().tracks[0];

      // Add existing item at 5000-10000ms
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [{
            id: 'item1',
            type: MediaType.VIDEO,
            startTime: 5000,
            duration: 5000,
            trackId: track.id,
            name: 'Item 1',
            isPlaceholder: true
          }]
        } : t)
      }));

      // Set playhead at 4700ms (300ms before start of item1, within 500ms snap proximity)
      const playheadPosition = 4700;
      component.state.update(s => ({ ...s, playheadPosition }));

      // Add new item
      component.addMediaItem(MediaType.AUDIO, track.id);

      const items = component.state().tracks.find(t => t.id === track.id)?.items || [];
      expect(items.length).toBe(2);
      // Should snap to start of item1, which means placing at 0 (before item1)
      expect(items[1].startTime).toBe(0);
    });

    it('should not snap when playhead is beyond SNAP_PROXIMITY_MS', () => {
      const track = component.state().tracks[0];

      // Add existing item at 0-5000ms
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [{
            id: 'item1',
            type: MediaType.VIDEO,
            startTime: 0,
            duration: 5000,
            trackId: track.id,
            name: 'Item 1',
            isPlaceholder: true
          }]
        } : t)
      }));

      // Set playhead at 5600ms (600ms from end of item1, beyond 500ms snap proximity)
      const playheadPosition = 5600;
      component.state.update(s => ({ ...s, playheadPosition }));

      // Add new item
      component.addMediaItem(MediaType.AUDIO, track.id);

      const items = component.state().tracks.find(t => t.id === track.id)?.items || [];
      expect(items.length).toBe(2);
      // Should be placed at playhead position (5600ms), not snapped to item1
      expect(items[1].startTime).toBe(playheadPosition);
    });

    it('should handle multiple items and snap to closest one', () => {
      const track = component.state().tracks[0];

      // Add two existing items
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item1',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 3000,
              trackId: track.id,
              name: 'Item 1',
              isPlaceholder: true
            },
            {
              id: 'item2',
              type: MediaType.AUDIO,
              startTime: 10000,
              duration: 5000,
              trackId: track.id,
              name: 'Item 2',
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      // Set playhead at 10200ms (200ms from start of item2, within snap proximity)
      const playheadPosition = 10200;
      component.state.update(s => ({ ...s, playheadPosition }));

      // Add new item
      component.addMediaItem(MediaType.IMAGE, track.id);

      const items = component.state().tracks.find(t => t.id === track.id)?.items || [];
      expect(items.length).toBe(3);
      // Should snap to start of item2, placing new item at 3000ms (after item1)
      expect(items[2].startTime).toBe(3000);
    });
  });

  describe('Gap Fitting (Issue #33)', () => {
    it('should adjust duration when dragging into gap smaller than item duration', () => {
      // Setup: Create a track with two items and a small gap between them
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 5000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-b',
              type: MediaType.VIDEO,
              startTime: 6000,
              duration: 5000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      // Simulate dragging an item with 3000ms duration into 1000ms gap
      const draggedItem = {
        id: 'item-c',
        type: MediaType.VIDEO,
        startTime: 0,
        duration: 3000,
        trackId: '2',
        isPlaceholder: true
      };

      // Access the private method using bracket notation for testing
      const result = (component as any).getValidDragPosition(
        draggedItem,
        5500, // Drop in the middle of the gap (5000-6000)
        track.items
      );

      // Should fit in the gap with adjusted duration
      expect(result.startTime).toBe(5000); // Start of gap
      expect(result.duration).toBe(1000); // Gap size
    });

    it('should preserve duration when item fits in gap', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 3000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-b',
              type: MediaType.VIDEO,
              startTime: 8000,
              duration: 3000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      const draggedItem = {
        id: 'item-c',
        type: MediaType.VIDEO,
        startTime: 0,
        duration: 3000,
        trackId: '2',
        isPlaceholder: true
      };

      // Gap is 5000ms (3000-8000), item is 3000ms - should fit
      const result = (component as any).getValidDragPosition(
        draggedItem,
        4500,
        track.items
      );

      expect(result.duration).toBe(3000); // Original duration preserved
      expect(result.startTime).toBe(4500); // Requested position
    });

    it('should respect minimum duration when gap is very small', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 5000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-b',
              type: MediaType.VIDEO,
              startTime: 5050,
              duration: 5000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      const draggedItem = {
        id: 'item-c',
        type: MediaType.VIDEO,
        startTime: 0,
        duration: 3000,
        trackId: '2',
        isPlaceholder: true
      };

      // Gap is only 50ms, but minimum duration is 100ms
      const result = (component as any).getValidDragPosition(
        draggedItem,
        5025,
        track.items
      );

      expect(result.startTime).toBe(5000);
      expect(result.duration).toBe(100); // Minimum duration
    });

    it('should use original duration when dropping in empty track', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: []
        } : t)
      }));

      const draggedItem = {
        id: 'item-c',
        type: MediaType.VIDEO,
        startTime: 0,
        duration: 3000,
        trackId: '2',
        isPlaceholder: true
      };

      const result = (component as any).getValidDragPosition(
        draggedItem,
        5000,
        []
      );

      expect(result.startTime).toBe(5000);
      expect(result.duration).toBe(3000); // Original duration
    });

    it('should use original duration when dropping after last item', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 5000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      const draggedItem = {
        id: 'item-c',
        type: MediaType.VIDEO,
        startTime: 0,
        duration: 3000,
        trackId: '2',
        isPlaceholder: true
      };

      const result = (component as any).getValidDragPosition(
        draggedItem,
        8000,
        track.items
      );

      expect(result.startTime).toBe(8000);
      expect(result.duration).toBe(3000); // Original duration (infinite gap)
    });
  });

  describe('Placeholder Jumping Bug (Issue #36)', () => {
    it('should not jump to end when dragging left and overlapping previous item', () => {
      // Setup: Three items on a track
      // Item A: 0-1000ms
      // Item B: 2000-3000ms (we'll drag this)
      // Item C: 4000-5000ms
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-b',
              type: MediaType.VIDEO,
              startTime: 2000,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-c',
              type: MediaType.VIDEO,
              startTime: 4000,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      const draggedItem = track.items.find(i => i.id === 'item-b')!;

      // Drag Item B left to 900ms (overlaps Item A)
      const result = (component as any).getValidDragPosition(
        draggedItem,
        900,
        track.items
      );

      // Should stay in closest gap (between A and B), not jump to end
      expect(result.startTime).toBe(1000); // Gap between A and B starts at 1000ms
      expect(result.startTime).not.toBe(5000); // Should NOT jump to end after C
    });

    it('should not jump to end when dragging right and overlapping next item', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-b',
              type: MediaType.VIDEO,
              startTime: 2000,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-c',
              type: MediaType.VIDEO,
              startTime: 4000,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      const draggedItem = track.items.find(i => i.id === 'item-b')!;

      // Drag Item B right to 4500ms (overlaps Item C)
      const result = (component as any).getValidDragPosition(
        draggedItem,
        4500,
        track.items
      );

      // Should stay in closest gap (between B and C)
      expect(result.startTime).toBe(3000); // Gap between B and C starts at 3000ms
      expect(result.startTime).not.toBe(5000); // Should NOT jump to end after C
    });

    it('should place in closest gap when dragging far left before all items', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 1000,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-b',
              type: MediaType.VIDEO,
              startTime: 3000,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      const draggedItem = track.items.find(i => i.id === 'item-b')!;

      // Drag Item B far left to negative position
      const result = (component as any).getValidDragPosition(
        draggedItem,
        -100,
        track.items
      );

      // Should place in gap before Item A (closest gap)
      expect(result.startTime).toBe(0); // Gap before A starts at 0
    });

    it('should handle dragging into middle gap smoothly', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-b',
              type: MediaType.VIDEO,
              startTime: 2000,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-c',
              type: MediaType.VIDEO,
              startTime: 4000,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      const draggedItem = track.items.find(i => i.id === 'item-b')!;

      // Drag Item B into gap between A and B (valid position)
      const result = (component as any).getValidDragPosition(
        draggedItem,
        1500,
        track.items
      );

      // Should stay at requested position
      expect(result.startTime).toBe(1500);
      expect(result.duration).toBe(1000); // Original duration preserved
    });

    it('should allow dragging to end of track when intended', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-b',
              type: MediaType.VIDEO,
              startTime: 2000,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      const draggedItem = track.items.find(i => i.id === 'item-b')!;

      // Drag Item B far right (after all items)
      const result = (component as any).getValidDragPosition(
        draggedItem,
        6000,
        track.items
      );

      // Should allow placement after last item
      expect(result.startTime).toBe(6000);
      expect(result.duration).toBe(1000); // Original duration in infinite gap
    });
  });

  describe('Placeholder Overlapping Bug (Issue #38)', () => {
    it('should not allow overlaps when dragging into infinite gap', () => {
      // Setup: Three items with gaps between them
      // Item A: 0-2000ms
      // Item B: 3000-5000ms
      // Item C: 6000-8000ms
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 2000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-b',
              type: MediaType.VIDEO,
              startTime: 3000,
              duration: 2000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-c',
              type: MediaType.VIDEO,
              startTime: 6000,
              duration: 2000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      const draggedItem = track.items.find(i => i.id === 'item-c')!;

      // Drag Item C to 4500ms (which will trigger closest gap logic)
      // The closest gap will be the infinite gap after item C (starts at 8000ms)
      // Bug was: Math.max(0, 4500) = 4500, which overlaps with B (3000-5000)
      // Fix: Math.max(gap.gapStart, 4500) = Math.max(8000, 4500) = 8000
      const result = (component as any).getValidDragPosition(
        draggedItem,
        4500,
        track.items
      );

      // Should place at gap start (8000ms) to avoid overlap
      expect(result.startTime).toBeGreaterThanOrEqual(5000); // After B ends
      expect(result.startTime + result.duration).toBeGreaterThan(result.startTime); // Valid duration

      // Verify no overlap with item B
      const itemBEnd = 3000 + 2000; // 5000
      expect(result.startTime).toBeGreaterThanOrEqual(itemBEnd);
    });

    it('should prevent overlap when dragging backwards through items', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 2000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-b',
              type: MediaType.VIDEO,
              startTime: 3000,
              duration: 2000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-c',
              type: MediaType.VIDEO,
              startTime: 6000,
              duration: 2000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      const draggedItem = track.items.find(i => i.id === 'item-c')!;

      // Drag through various positions and ensure no overlaps
      const testPositions = [5500, 5000, 4500, 4000, 3500];

      for (const pos of testPositions) {
        const result = (component as any).getValidDragPosition(
          draggedItem,
          pos,
          track.items
        );

        // Check no overlap with A (0-2000)
        const itemAEnd = 0 + 2000;
        const itemBStart = 3000;
        const itemBEnd = 3000 + 2000;

        const resultEnd = result.startTime + result.duration;

        // Result should not overlap with A or B
        const overlapsA = !(resultEnd <= 0 || result.startTime >= itemAEnd);
        const overlapsB = !(resultEnd <= itemBStart || result.startTime >= itemBEnd);

        expect(overlapsA).toBe(false);
        expect(overlapsB).toBe(false);
      }
    });

    it('should place item in closest valid gap when requested position overlaps', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-b',
              type: MediaType.VIDEO,
              startTime: 2000,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-c',
              type: MediaType.VIDEO,
              startTime: 4000,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      const draggedItem = track.items.find(i => i.id === 'item-b')!;

      // Try to drag B to position 500 (overlaps A at 0-1000)
      const result = (component as any).getValidDragPosition(
        draggedItem,
        500,
        track.items
      );

      // Should be placed in valid gap (between A and C)
      expect(result.startTime).toBeGreaterThanOrEqual(1000); // After A
      expect(result.startTime + result.duration).toBeLessThanOrEqual(4000); // Before C
    });

    it('should handle infinite gap correctly when dragging past last item', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-b',
              type: MediaType.VIDEO,
              startTime: 2000,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      const draggedItem = track.items.find(i => i.id === 'item-b')!;

      // Drag B to position far to the right (in infinite gap)
      const result = (component as any).getValidDragPosition(
        draggedItem,
        5000,
        track.items
      );

      // Should place at requested position in infinite gap
      expect(result.startTime).toBe(5000);
      expect(result.duration).toBe(1000);

      // Verify no overlap with A
      expect(result.startTime).toBeGreaterThanOrEqual(1000);
    });

    it('should respect gap boundaries in all scenarios to prevent overlaps', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [
            {
              id: 'item-a',
              type: MediaType.VIDEO,
              startTime: 0,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-b',
              type: MediaType.VIDEO,
              startTime: 3000,
              duration: 2000,
              trackId: track.id,
              isPlaceholder: true
            },
            {
              id: 'item-c',
              type: MediaType.VIDEO,
              startTime: 7000,
              duration: 1000,
              trackId: track.id,
              isPlaceholder: true
            }
          ]
        } : t)
      }));

      const draggedItem = track.items.find(i => i.id === 'item-c')!;

      // Test multiple positions to ensure consistent behavior
      const testCases = [
        { pos: 6500, desc: 'Within C original position' },
        { pos: 6000, desc: 'At C start' },
        { pos: 5500, desc: 'Between B and C' },
        { pos: 4500, desc: 'Overlaps B' },
        { pos: 3500, desc: 'In middle of B' },
        { pos: 1500, desc: 'Between A and B' },
        { pos: 500, desc: 'Overlaps A' }
      ];

      for (const testCase of testCases) {
        const result = (component as any).getValidDragPosition(
          draggedItem,
          testCase.pos,
          track.items
        );

        // Verify no overlap with A (0-1000) or B (3000-5000)
        const resultEnd = result.startTime + result.duration;

        const overlapsA = !(resultEnd <= 0 || result.startTime >= 1000);
        const overlapsB = !(resultEnd <= 3000 || result.startTime >= 5000);

        expect(overlapsA).toBe(false);
        expect(overlapsB).toBe(false);
      }
    });
  });

  describe('Total Duration Management (Issue #48)', () => {
    it('should display total duration in format "current / total"', () => {
      component.state.update(s => ({ ...s, playheadPosition: 10000, totalDuration: 60000 }));
      fixture.detectChanges();

      const timeDisplay = fixture.nativeElement.querySelector('[title*="изменить общую продолжительность"]');
      expect(timeDisplay).toBeTruthy();
      // Should show something like "0:10.00 / 1:00.00"
      expect(timeDisplay.textContent).toContain('/');
    });

    it('should open duration editor when clicking on time display', () => {
      expect(component.showDurationEditor()).toBe(false);
      component.openDurationEditor();
      expect(component.showDurationEditor()).toBe(true);
    });

    it('should close duration editor on cancel', () => {
      component.openDurationEditor();
      expect(component.showDurationEditor()).toBe(true);
      component.closeDurationEditor();
      expect(component.showDurationEditor()).toBe(false);
    });

    it('should update total duration when saved', () => {
      const initialDuration = component.state().totalDuration;
      component.openDurationEditor();

      // Simulate input change to 120 seconds
      const mockEvent = {
        target: { value: '120' }
      } as unknown as Event;
      component.onDurationInputChange(mockEvent);
      component.saveDuration();

      expect(component.state().totalDuration).toBe(120000); // 120 seconds in ms
      expect(component.showDurationEditor()).toBe(false);
    });

    it('should ensure playhead does not exceed total duration when reducing it', () => {
      component.state.update(s => ({ ...s, playheadPosition: 50000, totalDuration: 60000 }));

      component.openDurationEditor();
      const mockEvent = {
        target: { value: '30' } // Set to 30 seconds
      } as unknown as Event;
      component.onDurationInputChange(mockEvent);
      component.saveDuration();

      expect(component.state().totalDuration).toBe(30000);
      expect(component.state().playheadPosition).toBeLessThanOrEqual(30000);
    });

    it('should enforce minimum duration of 1 second', () => {
      component.openDurationEditor();

      const mockEvent = {
        target: { value: '0.5' } // Try to set to 0.5 seconds
      } as unknown as Event;
      component.onDurationInputChange(mockEvent);
      component.saveDuration();

      expect(component.state().totalDuration).toBeGreaterThanOrEqual(1000);
    });

    it('should prevent items from exceeding totalDuration when dragging', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        totalDuration: 10000, // 10 seconds
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [{
            id: 'item-a',
            type: MediaType.VIDEO,
            startTime: 0,
            duration: 3000,
            trackId: track.id,
            isPlaceholder: true
          }]
        } : t)
      }));

      const draggedItem = track.items[0];

      // Try to drag to position that would exceed totalDuration
      const result = (component as any).getValidDragPosition(
        draggedItem,
        8000, // Start at 8000ms with 3000ms duration would exceed 10000ms
        []
      );

      // Duration should be adjusted to fit within totalDuration
      expect(result.startTime + result.duration).toBeLessThanOrEqual(10000);
    });

    it('should prevent items from exceeding totalDuration when resizing', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        totalDuration: 10000, // 10 seconds
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [{
            id: 'item-a',
            type: MediaType.VIDEO,
            startTime: 5000,
            duration: 3000,
            trackId: track.id,
            isPlaceholder: true
          }]
        } : t)
      }));

      const item = track.items[0];

      // Get resize bounds for right edge
      const bounds = (component as any).getResizeBounds(item, track.items, 'right');

      // Max time should not exceed totalDuration
      expect(bounds.maxTime).toBeLessThanOrEqual(10000);
    });

    it('should adjust new item duration if it would exceed totalDuration', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        totalDuration: 6000, // 6 seconds
        playheadPosition: 5000, // 5 seconds
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: []
        } : t)
      }));

      // Add a video item (default 3000ms) at playhead (5000ms)
      // Would exceed totalDuration (6000ms)
      component.addMediaItem(MediaType.VIDEO, track.id);

      const items = component.state().tracks.find(t => t.id === track.id)?.items || [];
      const newItem = items[items.length - 1];

      // Item should be adjusted to fit within totalDuration
      expect(newItem.startTime + newItem.duration).toBeLessThanOrEqual(6000);
    });

    it('should respect totalDuration when dragging into infinite gap', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        totalDuration: 15000, // 15 seconds
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: [{
            id: 'item-a',
            type: MediaType.VIDEO,
            startTime: 0,
            duration: 5000,
            trackId: track.id,
            isPlaceholder: true
          }]
        } : t)
      }));

      const draggedItem = {
        id: 'item-b',
        type: MediaType.VIDEO,
        startTime: 0,
        duration: 8000,
        trackId: '2',
        isPlaceholder: true
      };

      // Drag to position 10000ms with 8000ms duration (would be 18000ms total)
      const result = (component as any).getValidDragPosition(
        draggedItem,
        10000,
        track.items
      );

      // Should be constrained to totalDuration
      expect(result.startTime + result.duration).toBeLessThanOrEqual(15000);
    });

    it('should adjust maxDuration of new items based on available space to totalDuration', () => {
      const track = component.state().tracks[0];
      component.state.update(s => ({
        ...s,
        totalDuration: 8000, // 8 seconds
        playheadPosition: 3000,
        tracks: s.tracks.map(t => t.id === track.id ? {
          ...t,
          items: []
        } : t)
      }));

      // Add a video item - maxDuration is normally 10000ms
      component.addMediaItem(MediaType.VIDEO, track.id);

      const items = component.state().tracks.find(t => t.id === track.id)?.items || [];
      const newItem = items[items.length - 1];

      // maxDuration should be limited by available space (8000 - 3000 = 5000)
      expect(newItem.maxDuration).toBeLessThanOrEqual(5000);
    });
  });
});
