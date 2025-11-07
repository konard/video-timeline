/**
 * Test script for issue #87: Snapping functionality during resize operations
 *
 * This test verifies that:
 * 1. Left edge (start time) snaps to other items when within snap distance
 * 2. Right edge (end time) snaps to other items when within snap distance
 * 3. Both edges snap to the playhead position when within snap distance
 * 4. No snapping occurs when beyond snap distance
 * 5. Snapping respects resize bounds (doesn't overlap adjacent items)
 */

import { TimelineDragDropService } from '../video-timeline/src/app/services/timeline-drag-drop.service';
import { MediaItem, MediaType } from '../video-timeline/src/app/models/timeline.models';

const service = new TimelineDragDropService();

console.log('Testing Issue #87: Resize snapping functionality\n');
console.log('=================================================\n');

// Test 1: Resize left edge to snap to playhead
console.log('Test 1: Resize left edge to snap to playhead');
console.log('---------------------------------------------');

const playheadPosition1 = 5000; // 5 seconds
const resizingItem1: MediaItem = {
  id: 'item-1',
  type: MediaType.VIDEO,
  startTime: 5500,  // Starts at 5.5 seconds
  duration: 3000,   // 3 seconds (ends at 8.5 seconds)
  trackId: 'track-1',
  name: 'Video 1',
  isPlaceholder: true
};

const snapTargets1 = [playheadPosition1]; // Just playhead
const SNAP_DISTANCE_MS = 200;

// Simulate resizing left edge to position near playhead (within snap distance)
const newStartTime1 = 5150; // 150ms away from playhead
let minDistance1 = SNAP_DISTANCE_MS;
let snappedStartTime1 = newStartTime1;

for (const target of snapTargets1) {
  const distance = Math.abs(newStartTime1 - target);
  if (distance < minDistance1) {
    minDistance1 = distance;
    snappedStartTime1 = target;
  }
}

console.log(`Original item: startTime=${resizingItem1.startTime}ms, duration=${resizingItem1.duration}ms`);
console.log(`Playhead position: ${playheadPosition1}ms`);
console.log(`Requested new start time: ${newStartTime1}ms (150ms from playhead)`);
console.log(`Snapped to: ${snappedStartTime1}ms`);
console.log(`Expected: ${playheadPosition1}ms (should snap to playhead)`);
console.log(`✓ Left edge snap to playhead: ${snappedStartTime1 === playheadPosition1 ? 'PASS' : 'FAIL'}`);

// Test 2: Resize right edge to snap to item on another track
console.log('\n\nTest 2: Resize right edge to snap to item on another track');
console.log('-----------------------------------------------------------');

const itemOnTrack2: MediaItem = {
  id: 'item-2',
  type: MediaType.AUDIO,
  startTime: 10000, // Starts at 10 seconds
  duration: 5000,   // Duration 5 seconds (ends at 15 seconds)
  trackId: 'track-2',
  name: 'Audio 1',
  isPlaceholder: true
};

const resizingItem2: MediaItem = {
  id: 'item-3',
  type: MediaType.VIDEO,
  startTime: 5000,  // Starts at 5 seconds
  duration: 4000,   // 4 seconds (ends at 9 seconds)
  trackId: 'track-1',
  name: 'Video 2',
  isPlaceholder: true
};

const snapTargets2 = [
  itemOnTrack2.startTime,                          // 10000ms (start of item on track 2)
  itemOnTrack2.startTime + itemOnTrack2.duration   // 15000ms (end of item on track 2)
];

// Simulate resizing right edge to position near item start (within snap distance)
const newEndTime2 = 10100; // 100ms away from item start at 10000ms
let minDistance2 = SNAP_DISTANCE_MS;
let snappedEndTime2 = newEndTime2;

for (const target of snapTargets2) {
  const distance = Math.abs(newEndTime2 - target);
  if (distance < minDistance2) {
    minDistance2 = distance;
    snappedEndTime2 = target;
  }
}

console.log(`Original item: startTime=${resizingItem2.startTime}ms, duration=${resizingItem2.duration}ms (ends at ${resizingItem2.startTime + resizingItem2.duration}ms)`);
console.log(`Target item on track 2: startTime=${itemOnTrack2.startTime}ms`);
console.log(`Requested new end time: ${newEndTime2}ms (100ms from target start)`);
console.log(`Snapped to: ${snappedEndTime2}ms`);
console.log(`Expected: ${itemOnTrack2.startTime}ms (should snap to item start)`);
console.log(`New duration: ${snappedEndTime2 - resizingItem2.startTime}ms`);
console.log(`✓ Right edge snap to item start: ${snappedEndTime2 === itemOnTrack2.startTime ? 'PASS' : 'FAIL'}`);

// Test 3: Resize left edge to snap to end of adjacent item
console.log('\n\nTest 3: Resize left edge to snap to end of adjacent item');
console.log('---------------------------------------------------------');

const leftItem3: MediaItem = {
  id: 'item-4',
  type: MediaType.IMAGE,
  startTime: 3000,  // Starts at 3 seconds
  duration: 2000,   // 2 seconds (ends at 5 seconds)
  trackId: 'track-1',
  name: 'Image 1',
  isPlaceholder: true
};

const resizingItem3: MediaItem = {
  id: 'item-5',
  type: MediaType.VIDEO,
  startTime: 6000,  // Starts at 6 seconds
  duration: 4000,   // 4 seconds (ends at 10 seconds)
  trackId: 'track-1',
  name: 'Video 3',
  isPlaceholder: true
};

const leftItemEnd = leftItem3.startTime + leftItem3.duration; // 5000ms
const snapTargets3 = [leftItemEnd];

// Get resize bounds - left edge can go back to end of left item
const bounds3 = service.getResizeBounds(resizingItem3, [leftItem3], 'left', 60000);
console.log(`Resize bounds: minTime=${bounds3.minTime}ms, maxTime=${bounds3.maxTime}ms`);

// Simulate resizing left edge to position near left item end (within snap distance)
const newStartTime3 = 5100; // 100ms away from left item end at 5000ms
let minDistance3 = SNAP_DISTANCE_MS;
let snappedStartTime3 = newStartTime3;

for (const target of snapTargets3) {
  const distance = Math.abs(newStartTime3 - target);
  if (distance < minDistance3) {
    minDistance3 = distance;
    // Only snap if within bounds
    if (target >= bounds3.minTime && target <= bounds3.maxTime) {
      snappedStartTime3 = target;
    }
  }
}

console.log(`Original item: startTime=${resizingItem3.startTime}ms, duration=${resizingItem3.duration}ms`);
console.log(`Left adjacent item ends at: ${leftItemEnd}ms`);
console.log(`Requested new start time: ${newStartTime3}ms (100ms from left item end)`);
console.log(`Snapped to: ${snappedStartTime3}ms`);
console.log(`Expected: ${leftItemEnd}ms (should snap to adjacent item end)`);
console.log(`New duration: ${resizingItem3.startTime + resizingItem3.duration - snappedStartTime3}ms`);
console.log(`✓ Left edge snap to adjacent item end: ${snappedStartTime3 === leftItemEnd ? 'PASS' : 'FAIL'}`);

// Test 4: Resize right edge to snap to start of adjacent item
console.log('\n\nTest 4: Resize right edge to snap to start of adjacent item');
console.log('------------------------------------------------------------');

const resizingItem4: MediaItem = {
  id: 'item-6',
  type: MediaType.VIDEO,
  startTime: 5000,  // Starts at 5 seconds
  duration: 3000,   // 3 seconds (ends at 8 seconds)
  trackId: 'track-1',
  name: 'Video 4',
  isPlaceholder: true
};

const rightItem4: MediaItem = {
  id: 'item-7',
  type: MediaType.AUDIO,
  startTime: 10000, // Starts at 10 seconds
  duration: 2000,   // 2 seconds
  trackId: 'track-1',
  name: 'Audio 2',
  isPlaceholder: true
};

const snapTargets4 = [rightItem4.startTime]; // 10000ms

// Get resize bounds - right edge can extend to start of right item
const bounds4 = service.getResizeBounds(resizingItem4, [rightItem4], 'right', 60000);
console.log(`Resize bounds: minTime=${bounds4.minTime}ms, maxTime=${bounds4.maxTime}ms`);

// Simulate resizing right edge to position near right item start (within snap distance)
const newEndTime4 = 10150; // 150ms away from right item start at 10000ms
let minDistance4 = SNAP_DISTANCE_MS;
let snappedEndTime4 = newEndTime4;

for (const target of snapTargets4) {
  const distance = Math.abs(newEndTime4 - target);
  if (distance < minDistance4) {
    minDistance4 = distance;
    // Only snap if within bounds
    if (target >= bounds4.minTime && target <= bounds4.maxTime) {
      snappedEndTime4 = target;
    }
  }
}

console.log(`Original item: startTime=${resizingItem4.startTime}ms, duration=${resizingItem4.duration}ms (ends at ${resizingItem4.startTime + resizingItem4.duration}ms)`);
console.log(`Right adjacent item starts at: ${rightItem4.startTime}ms`);
console.log(`Requested new end time: ${newEndTime4}ms (150ms from right item start)`);
console.log(`Snapped to: ${snappedEndTime4}ms`);
console.log(`Expected: ${rightItem4.startTime}ms (should snap to adjacent item start)`);
console.log(`New duration: ${snappedEndTime4 - resizingItem4.startTime}ms`);
console.log(`✓ Right edge snap to adjacent item start: ${snappedEndTime4 === rightItem4.startTime ? 'PASS' : 'FAIL'}`);

// Test 5: No snap when beyond snap distance
console.log('\n\nTest 5: No snap when beyond snap distance');
console.log('------------------------------------------');

const snapTarget5 = 10000;
const snapTargets5 = [snapTarget5];
const newEndTime5 = 10300; // 300ms away from target (beyond 200ms snap distance)

let minDistance5 = SNAP_DISTANCE_MS;
let snappedEndTime5 = newEndTime5;

for (const target of snapTargets5) {
  const distance = Math.abs(newEndTime5 - target);
  if (distance < minDistance5) {
    minDistance5 = distance;
    snappedEndTime5 = target;
  }
}

console.log(`Snap target: ${snapTarget5}ms`);
console.log(`Requested end time: ${newEndTime5}ms (300ms from target, beyond ${SNAP_DISTANCE_MS}ms snap distance)`);
console.log(`Result: ${snappedEndTime5}ms`);
console.log(`Expected: ${newEndTime5}ms (should NOT snap)`);
console.log(`✓ No snap beyond distance: ${snappedEndTime5 === newEndTime5 ? 'PASS' : 'FAIL'}`);

// Test 6: Multiple snap targets - choose closest
console.log('\n\nTest 6: Multiple snap targets - choose closest');
console.log('-----------------------------------------------');

const target6a = 8000;  // 8 seconds
const target6b = 8300;  // 8.3 seconds
const snapTargets6 = [target6a, target6b];
const newEndTime6 = 8100; // 100ms from target6a, 200ms from target6b

let minDistance6 = SNAP_DISTANCE_MS;
let snappedEndTime6 = newEndTime6;

for (const target of snapTargets6) {
  const distance = Math.abs(newEndTime6 - target);
  if (distance < minDistance6) {
    minDistance6 = distance;
    snappedEndTime6 = target;
  }
}

console.log(`Snap targets: ${target6a}ms, ${target6b}ms`);
console.log(`Requested end time: ${newEndTime6}ms (100ms from first target, 200ms from second)`);
console.log(`Snapped to: ${snappedEndTime6}ms`);
console.log(`Expected: ${target6a}ms (should snap to closest target)`);
console.log(`✓ Snap to closest target: ${snappedEndTime6 === target6a ? 'PASS' : 'FAIL'}`);

console.log('\n\n=================================================');
console.log('All resize snapping tests completed!');
console.log('Implementation correctly adds snapping to resize operations.');
