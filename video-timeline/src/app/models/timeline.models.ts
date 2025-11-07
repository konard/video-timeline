export enum MediaType {
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image'
}

export interface MediaItem {
  id: string;
  type: MediaType;
  startTime: number; // milliseconds - position on timeline
  duration: number; // milliseconds - duration shown on timeline
  mediaStartTime?: number; // milliseconds - offset into source media (default: 0)
  maxDuration?: number; // milliseconds - maximum duration for audio/video placeholders
  trackId: string;
  name?: string;
  isPlaceholder?: boolean;
}

export interface Track {
  id: string;
  name: string;
  order: number;
  items: MediaItem[];
}

export interface TimelineState {
  tracks: Track[];
  playheadPosition: number; // milliseconds
  zoomLevel: number; // pixels per millisecond
  totalDuration: number; // milliseconds
  selectedItemId: string | null; // ID of selected media item
}
