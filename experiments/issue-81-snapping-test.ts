/**
 * Test script for issue #81: Snapping functionality for media placeholders
 *
 * This test verifies that:
 * 1. Placeholders snap to other placeholders on different tracks when within snap distance
 * 2. Placeholders snap to the playhead position when within snap distance
 * 3. No snapping occurs when beyond snap distance
 */

import { TimelineDragDropService } from '../video-timeline/src/app/services/timeline-drag-drop.service';
import { MediaItem, MediaType } from '../video-timeline/src/app/models/timeline.models';

const service = new TimelineDragDropService();

console.log('Testing Issue #81: Snapping functionality\n');
console.log('===========================================\n');

// Test 1: Snap to playhead
console.log('Test 1: Snap to playhead position');
console.log('----------------------------------');

const playheadPosition = 5000; // 5 seconds
const draggedItem1: MediaItem = {
  id: 'item-1',
  type: MediaType.VIDEO,
  startTime: 0,
  duration: 3000,
  trackId: 'track-1',
  name: 'Video 1',
  isPlaceholder: true
};

const track1Items: MediaItem[] = [];
const allTracks1 = [
  { items: [] }, // Track 1 (empty)
  { items: [] }  // Track 2 (empty)
];

// Get snap targets including playhead
const snapTargets1 = service.findSnapTargets(draggedItem1.id, allTracks1, playheadPosition);
console.log('Snap targets:', snapTargets1);

// Test dragging to position near playhead (within snap distance)
const requestedTime1a = 5150; // 150ms away from playhead (within 200ms snap distance)
const result1a = service.getValidDragPosition(
  draggedItem1,
  requestedTime1a,
  track1Items,
  60000,
  snapTargets1
);
console.log(`\nRequested time: ${requestedTime1a}ms (150ms from playhead)`);
console.log(`Snapped to: ${result1a.startTime}ms`);
console.log(`Expected: ${playheadPosition}ms (should snap to playhead)`);
console.log(`✓ Snap to playhead: ${result1a.startTime === playheadPosition ? 'PASS' : 'FAIL'}`);

// Test dragging to position far from playhead (beyond snap distance)
const requestedTime1b = 5300; // 300ms away from playhead (beyond 200ms snap distance)
const result1b = service.getValidDragPosition(
  draggedItem1,
  requestedTime1b,
  track1Items,
  60000,
  snapTargets1
);
console.log(`\nRequested time: ${requestedTime1b}ms (300ms from playhead)`);
console.log(`Snapped to: ${result1b.startTime}ms`);
console.log(`Expected: ${requestedTime1b}ms (should NOT snap)`);
console.log(`✓ No snap beyond distance: ${result1b.startTime === requestedTime1b ? 'PASS' : 'FAIL'}`);

// Test 2: Snap to item on another track
console.log('\n\nTest 2: Snap to item on different track');
console.log('----------------------------------------');

const itemOnTrack2: MediaItem = {
  id: 'item-2',
  type: MediaType.AUDIO,
  startTime: 10000, // Starts at 10 seconds
  duration: 5000,   // Duration 5 seconds (ends at 15 seconds)
  trackId: 'track-2',
  name: 'Audio 1',
  isPlaceholder: true
};

const draggedItem2: MediaItem = {
  id: 'item-3',
  type: MediaType.VIDEO,
  startTime: 0,
  duration: 3000,
  trackId: 'track-1',
  name: 'Video 2',
  isPlaceholder: true
};

const track2Items: MediaItem[] = [];
const allTracks2 = [
  { items: [] },              // Track 1 (where we're dragging)
  { items: [itemOnTrack2] }   // Track 2 (has an item)
];

const snapTargets2 = service.findSnapTargets(draggedItem2.id, allTracks2, 0);
console.log('Snap targets:', snapTargets2);

// Test snapping to start of item on track 2
const requestedTime2a = 10100; // 100ms away from item start (within 200ms snap distance)
const result2a = service.getValidDragPosition(
  draggedItem2,
  requestedTime2a,
  track2Items,
  60000,
  snapTargets2
);
console.log(`\nRequested time: ${requestedTime2a}ms (100ms from item start at 10000ms)`);
console.log(`Snapped to: ${result2a.startTime}ms`);
console.log(`Expected: ${itemOnTrack2.startTime}ms (should snap to item start)`);
console.log(`✓ Snap to item start: ${result2a.startTime === itemOnTrack2.startTime ? 'PASS' : 'FAIL'}`);

// Test snapping to end of item on track 2
const itemEndTime = itemOnTrack2.startTime + itemOnTrack2.duration; // 15000ms
const requestedTime2b = 15150; // 150ms away from item end (within 200ms snap distance)
const result2b = service.getValidDragPosition(
  draggedItem2,
  requestedTime2b,
  track2Items,
  60000,
  snapTargets2
);
console.log(`\nRequested time: ${requestedTime2b}ms (150ms from item end at 15000ms)`);
console.log(`Snapped to: ${result2b.startTime}ms`);
console.log(`Expected: ${itemEndTime}ms (should snap to item end)`);
console.log(`✓ Snap to item end: ${result2b.startTime === itemEndTime ? 'PASS' : 'FAIL'}`);

// Test 3: Snap item's end to target
console.log('\n\nTest 3: Snap item end to target');
console.log('--------------------------------');

const draggedItem3: MediaItem = {
  id: 'item-4',
  type: MediaType.VIDEO,
  startTime: 0,
  duration: 2000, // 2 seconds duration
  trackId: 'track-1',
  name: 'Video 3',
  isPlaceholder: true
};

const targetPosition = 10000;
const allTracks3 = [
  { items: [] },
  { items: [{ ...itemOnTrack2, startTime: targetPosition }] }
];

const snapTargets3 = service.findSnapTargets(draggedItem3.id, allTracks3, 0);

// Drag so item's end is near target start
const requestedTime3 = 10000 - 2000 - 100; // Position item end 100ms before target (within snap distance)
const result3 = service.getValidDragPosition(
  draggedItem3,
  requestedTime3,
  [],
  60000,
  snapTargets3
);
const resultEndTime = result3.startTime + result3.duration;
console.log(`\nRequested time: ${requestedTime3}ms (item would end at ${requestedTime3 + 2000}ms)`);
console.log(`Target position: ${targetPosition}ms`);
console.log(`Snapped item starts at: ${result3.startTime}ms`);
console.log(`Snapped item ends at: ${resultEndTime}ms`);
console.log(`Expected item end: ${targetPosition}ms (should align end with target)`);
console.log(`✓ Snap item end to target: ${resultEndTime === targetPosition ? 'PASS' : 'FAIL'}`);

// Test 4: Multiple snap targets - choose closest
console.log('\n\nTest 4: Multiple snap targets - choose closest');
console.log('-----------------------------------------------');

const item4a: MediaItem = {
  id: 'item-5',
  type: MediaType.AUDIO,
  startTime: 8000,
  duration: 2000,
  trackId: 'track-2',
  name: 'Audio 2',
  isPlaceholder: true
};

const item4b: MediaItem = {
  id: 'item-6',
  type: MediaType.IMAGE,
  startTime: 12000,
  duration: 3000,
  trackId: 'track-3',
  name: 'Image 1',
  isPlaceholder: true
};

const draggedItem4: MediaItem = {
  id: 'item-7',
  type: MediaType.VIDEO,
  startTime: 0,
  duration: 2000,
  trackId: 'track-1',
  name: 'Video 4',
  isPlaceholder: true
};

const allTracks4 = [
  { items: [] },        // Track 1 (dragging here)
  { items: [item4a] },  // Track 2 (item ends at 10000)
  { items: [item4b] }   // Track 3 (item starts at 12000)
];

const snapTargets4 = service.findSnapTargets(draggedItem4.id, allTracks4, 0);
console.log('Snap targets:', snapTargets4);

// Drag to position between two snap targets, closer to first one
const requestedTime4 = 10100; // 100ms from item4a end (10000), 1900ms from item4b start (12000)
const result4 = service.getValidDragPosition(
  draggedItem4,
  requestedTime4,
  [],
  60000,
  snapTargets4
);
const expectedSnapTarget4 = 10000; // Should snap to closer target (item4a end)
console.log(`\nRequested time: ${requestedTime4}ms`);
console.log(`Snap target 1 (item4a end): ${item4a.startTime + item4a.duration}ms (distance: 100ms)`);
console.log(`Snap target 2 (item4b start): ${item4b.startTime}ms (distance: 1900ms)`);
console.log(`Snapped to: ${result4.startTime}ms`);
console.log(`Expected: ${expectedSnapTarget4}ms (should snap to closest target)`);
console.log(`✓ Snap to closest target: ${result4.startTime === expectedSnapTarget4 ? 'PASS' : 'FAIL'}`);

console.log('\n\n===========================================');
console.log('All tests completed!');
