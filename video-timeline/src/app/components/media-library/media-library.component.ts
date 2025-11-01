import { Component, signal, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaType } from '../../models/timeline.models';

export interface MediaLibraryItem {
  id: string;
  name: string;
  type: MediaType;
  duration: number; // milliseconds
  thumbnail?: string;
}

@Component({
  selector: 'app-media-library',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-library.component.html',
  styleUrl: './media-library.component.css'
})
export class MediaLibraryComponent {
  // Events
  readonly closeModal = output<void>();
  readonly selectMedia = output<MediaLibraryItem>();

  // State
  readonly selectedFilter = signal<MediaType | 'all'>('all');

  // Static media library data
  private readonly allMediaItems: MediaLibraryItem[] = [
    // Videos
    {
      id: 'video-1',
      name: 'Sample Video 1',
      type: MediaType.VIDEO,
      duration: 10000 // 10 seconds
    },
    {
      id: 'video-2',
      name: 'Sample Video 2',
      type: MediaType.VIDEO,
      duration: 15000 // 15 seconds
    },
    {
      id: 'video-3',
      name: 'Sample Video 3',
      type: MediaType.VIDEO,
      duration: 8000 // 8 seconds
    },
    // Audio
    {
      id: 'audio-1',
      name: 'Sample Audio 1',
      type: MediaType.AUDIO,
      duration: 20000 // 20 seconds
    },
    {
      id: 'audio-2',
      name: 'Sample Audio 2',
      type: MediaType.AUDIO,
      duration: 12000 // 12 seconds
    },
    {
      id: 'audio-3',
      name: 'Sample Audio 3',
      type: MediaType.AUDIO,
      duration: 18000 // 18 seconds
    },
    // Images
    {
      id: 'image-1',
      name: 'Sample Image 1',
      type: MediaType.IMAGE,
      duration: 5000 // 5 seconds default
    },
    {
      id: 'image-2',
      name: 'Sample Image 2',
      type: MediaType.IMAGE,
      duration: 5000 // 5 seconds default
    },
    {
      id: 'image-3',
      name: 'Sample Image 3',
      type: MediaType.IMAGE,
      duration: 5000 // 5 seconds default
    }
  ];

  // Computed filtered media items
  readonly filteredMediaItems = computed(() => {
    const filter = this.selectedFilter();
    if (filter === 'all') {
      return this.allMediaItems;
    }
    return this.allMediaItems.filter(item => item.type === filter);
  });

  // Expose MediaType enum to template
  readonly MediaType = MediaType;

  // Filter methods
  setFilter(filter: MediaType | 'all'): void {
    this.selectedFilter.set(filter);
  }

  // Action methods
  onSelectMedia(item: MediaLibraryItem): void {
    this.selectMedia.emit(item);
  }

  onClose(): void {
    this.closeModal.emit();
  }

  // Helper method to format duration
  formatTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  // Helper method to get icon class for media type
  getMediaIcon(type: MediaType): string {
    switch (type) {
      case MediaType.VIDEO:
        return 'bi-camera-video-fill';
      case MediaType.AUDIO:
        return 'bi-volume-up-fill';
      case MediaType.IMAGE:
        return 'bi-image-fill';
      default:
        return 'bi-file-earmark';
    }
  }
}
