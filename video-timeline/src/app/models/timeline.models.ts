export enum MediaType {
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image'
}

export interface MediaItem {
  id: string;
  type: MediaType;
  startTime: number; // milliseconds
  duration: number; // milliseconds
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
}
