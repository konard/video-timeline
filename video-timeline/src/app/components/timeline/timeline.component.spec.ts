import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TimelineComponent } from './timeline.component';
import { MediaType } from '../../models/timeline.models';

describe('TimelineComponent', () => {
  let component: TimelineComponent;
  let fixture: ComponentFixture<TimelineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TimelineComponent]
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
    expect(component.formatTime(0)).toBe('0:00.000');
    expect(component.formatTime(1000)).toBe('0:01.000');
    expect(component.formatTime(60000)).toBe('1:00.000');
    expect(component.formatTime(65500)).toBe('1:05.500');
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
});
