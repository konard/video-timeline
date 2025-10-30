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
});
