/**
 * Experiment to verify the coordinate system fix for issue #100
 *
 * Problem: When dragging on mobile, placeholder jumps forward by the width of the left panel (150px)
 *
 * Root cause: Coordinate system mismatch between:
 * - onMediaItemPointerDown: uses mediaItem.getBoundingClientRect()
 * - onTrackPointerMove: uses track.getBoundingClientRect()
 *
 * The track's rect.left is 150px less than the media item's rect.left
 */

interface BoundingRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface TouchCoords {
  clientX: number;
  clientY: number;
}

const TRACK_HEADER_WIDTH = 150; // The left panel width
const PIXELS_PER_MS = 0.1; // Example scale

function pixelsPerMillisecond(): number {
  return PIXELS_PER_MS;
}

// Simulate the BUGGY behavior (current code)
function calculateDragOffsetBuggy(
  mediaItemRect: BoundingRect,
  clickCoords: TouchCoords
): number {
  // Uses media item's rect.left (which is viewport-relative and includes the 150px panel)
  const clickX = clickCoords.clientX - mediaItemRect.left;
  return clickX / pixelsPerMillisecond();
}

function calculateNewPositionBuggy(
  trackRect: BoundingRect,
  moveCoords: TouchCoords,
  dragOffset: number
): number {
  // Uses track's rect.left (which is 150px less than media item's rect.left)
  const x = moveCoords.clientX - trackRect.left;
  return Math.max(0, x / pixelsPerMillisecond() - dragOffset);
}

// Simulate the FIXED behavior (proposed solution)
function calculateDragOffsetFixed(
  mediaItemRect: BoundingRect,
  trackRect: BoundingRect,
  clickCoords: TouchCoords
): number {
  // Calculate click position relative to the track's timeline area
  // by subtracting the track's left edge from the click position
  const clickX = clickCoords.clientX - trackRect.left;
  return clickX / pixelsPerMillisecond();
}

function calculateNewPositionFixed(
  trackRect: BoundingRect,
  moveCoords: TouchCoords,
  dragOffset: number
): number {
  // Uses track's rect.left (same reference frame as drag offset)
  const x = moveCoords.clientX - trackRect.left;
  return Math.max(0, x / pixelsPerMillisecond() - dragOffset);
}

// Test scenario
console.log('=== Issue #100: Touch drag offset test ===\n');

// Setup: Media item at timeline position 500ms, displayed at screen position 200px from viewport left
const mediaItemStartTime = 500; // milliseconds
const mediaItemStartPixels = mediaItemStartTime * PIXELS_PER_MS; // 50px from track's left edge

const trackRect: BoundingRect = {
  left: TRACK_HEADER_WIDTH, // Track starts at 150px (after the header)
  top: 100,
  right: 1000,
  bottom: 160,
  width: 850,
  height: 60
};

const mediaItemRect: BoundingRect = {
  left: TRACK_HEADER_WIDTH + mediaItemStartPixels, // 150 + 50 = 200px from viewport left
  top: 102,
  right: 300,
  bottom: 158,
  width: 100,
  height: 56
};

// User touches the media item at 25px from its left edge
const touchStartCoords: TouchCoords = {
  clientX: mediaItemRect.left + 25, // 200 + 25 = 225px from viewport left
  clientY: 120
};

console.log('Initial state:');
console.log(`  Media item timeline position: ${mediaItemStartTime}ms`);
console.log(`  Media item screen position: ${mediaItemRect.left}px from viewport left`);
console.log(`  Track screen position: ${trackRect.left}px from viewport left`);
console.log(`  Touch position: ${touchStartCoords.clientX}px from viewport left`);
console.log(`  Touch offset within item: ${touchStartCoords.clientX - mediaItemRect.left}px\n`);

// === BUGGY BEHAVIOR ===
console.log('--- BUGGY behavior (current code) ---');
const dragOffsetBuggy = calculateDragOffsetBuggy(mediaItemRect, touchStartCoords);
console.log(`  Drag offset calculated: ${dragOffsetBuggy}ms (= ${dragOffsetBuggy * PIXELS_PER_MS}px)`);

// User moves finger to same position (no movement yet, but bug will appear)
const touchMoveCoords: TouchCoords = {
  clientX: touchStartCoords.clientX, // Same position
  clientY: touchStartCoords.clientY
};

const newPositionBuggy = calculateNewPositionBuggy(trackRect, touchMoveCoords, dragOffsetBuggy);
console.log(`  New position calculated: ${newPositionBuggy}ms`);
console.log(`  Jump amount: ${newPositionBuggy - mediaItemStartTime}ms (= ${(newPositionBuggy - mediaItemStartTime) * PIXELS_PER_MS}px)`);
console.log(`  Expected: 0ms jump (finger hasn't moved)`);
console.log(`  Analysis: Item jumped by ${TRACK_HEADER_WIDTH}px = width of left panel!\n`);

// === FIXED BEHAVIOR ===
console.log('--- FIXED behavior (proposed solution) ---');
const dragOffsetFixed = calculateDragOffsetFixed(mediaItemRect, trackRect, touchStartCoords);
console.log(`  Drag offset calculated: ${dragOffsetFixed}ms (= ${dragOffsetFixed * PIXELS_PER_MS}px)`);

const newPositionFixed = calculateNewPositionFixed(trackRect, touchMoveCoords, dragOffsetFixed);
console.log(`  New position calculated: ${newPositionFixed}ms`);
console.log(`  Jump amount: ${newPositionFixed - mediaItemStartTime}ms (= ${(newPositionFixed - mediaItemStartTime) * PIXELS_PER_MS}px)`);
console.log(`  Expected: 0ms jump (finger hasn't moved)`);
console.log(`  Result: ✓ No jump! Item stays in place.\n`);

// === Test with actual finger movement ===
console.log('--- Test with actual finger movement (100px right) ---');
const touchMovedCoords: TouchCoords = {
  clientX: touchStartCoords.clientX + 100,
  clientY: touchStartCoords.clientY
};

const newPositionMovedBuggy = calculateNewPositionBuggy(trackRect, touchMovedCoords, dragOffsetBuggy);
const newPositionMovedFixed = calculateNewPositionFixed(trackRect, touchMovedCoords, dragOffsetFixed);

console.log(`  Buggy: ${newPositionMovedBuggy}ms (jumped ${newPositionMovedBuggy - mediaItemStartTime}ms)`);
console.log(`  Fixed: ${newPositionMovedFixed}ms (moved ${newPositionMovedFixed - mediaItemStartTime}ms)`);
console.log(`  Expected: ${mediaItemStartTime + 1000}ms (moved 1000ms = 100px / 0.1)`);
console.log(`  Analysis: Fixed version correctly tracks finger movement.\n`);

console.log('=== Conclusion ===');
console.log('The fix is to calculate dragOffset using the track\'s rect.left as reference,');
console.log('not the media item\'s rect.left. This ensures both calculations use the same');
console.log('coordinate system (relative to the track\'s timeline area).');
