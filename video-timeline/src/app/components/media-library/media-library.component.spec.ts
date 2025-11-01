import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MediaLibraryComponent } from './media-library.component';
import { MediaType } from '../../models/timeline.models';

describe('MediaLibraryComponent', () => {
  let component: MediaLibraryComponent;
  let fixture: ComponentFixture<MediaLibraryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MediaLibraryComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MediaLibraryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show all media items by default', () => {
    expect(component.selectedFilter()).toBe('all');
    expect(component.filteredMediaItems().length).toBeGreaterThan(0);
  });

  it('should filter by video type', () => {
    component.setFilter(MediaType.VIDEO);
    expect(component.selectedFilter()).toBe(MediaType.VIDEO);
    const filteredItems = component.filteredMediaItems();
    expect(filteredItems.every(item => item.type === MediaType.VIDEO)).toBe(true);
  });

  it('should filter by audio type', () => {
    component.setFilter(MediaType.AUDIO);
    expect(component.selectedFilter()).toBe(MediaType.AUDIO);
    const filteredItems = component.filteredMediaItems();
    expect(filteredItems.every(item => item.type === MediaType.AUDIO)).toBe(true);
  });

  it('should filter by image type', () => {
    component.setFilter(MediaType.IMAGE);
    expect(component.selectedFilter()).toBe(MediaType.IMAGE);
    const filteredItems = component.filteredMediaItems();
    expect(filteredItems.every(item => item.type === MediaType.IMAGE)).toBe(true);
  });

  it('should emit selectMedia event when media is selected', () => {
    let selectedMedia: any = null;
    component.selectMedia.subscribe((media) => {
      selectedMedia = media;
    });

    const testMedia = component.filteredMediaItems()[0];
    component.onSelectMedia(testMedia);

    expect(selectedMedia).toEqual(testMedia);
  });

  it('should emit closeModal event when closed', () => {
    let closeCalled = false;
    component.closeModal.subscribe(() => {
      closeCalled = true;
    });

    component.onClose();

    expect(closeCalled).toBe(true);
  });

  it('should format time correctly', () => {
    expect(component.formatTime(10000)).toBe('0:10');
    expect(component.formatTime(65000)).toBe('1:05');
    expect(component.formatTime(125000)).toBe('2:05');
  });

  it('should return correct icon for media type', () => {
    expect(component.getMediaIcon(MediaType.VIDEO)).toBe('bi-camera-video-fill');
    expect(component.getMediaIcon(MediaType.AUDIO)).toBe('bi-volume-up-fill');
    expect(component.getMediaIcon(MediaType.IMAGE)).toBe('bi-image-fill');
  });
});
