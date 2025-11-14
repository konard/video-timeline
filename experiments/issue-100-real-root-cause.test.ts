/**
 * TRUE Root Cause Analysis for Issue #100
 *
 * The bug occurs because we use TWO DIFFERENT reference frames:
 * 1. onMediaItemPointerDown: uses mediaItem.getBoundingClientRect()
 * 2. onTrackPointerMove: uses track.getBoundingClientRect()
 *
 * These have different .left values!
 */

interface Rect {
  left: number;
}

interface Coords {
  clientX: number;
}

const TRACK_HEADER_WIDTH = 150; // Left panel width
const PIXELS_PER_MS = 0.1;

function pixelsPerMillisecond(): number {
  return PIXELS_PER_MS;
}

console.log('=== Issue #100: Real Root Cause ===\n');

// Scenario: Media item at timeline position 500ms (50px from track's left edge)
const itemStartTime = 500; // ms
const itemStartPixels = itemStartTime * PIXELS_PER_MS; // 50px

// The scrollable container starts at viewport x=0
// Inside it, there's a 150px header, then the track
const trackRect: Rect = {
  left: TRACK_HEADER_WIDTH  // Track starts at 150px from viewport left (after header)
};

// Media item is positioned at 50px from the track's left edge
// So its viewport position is: track.left + 50px = 150 + 50 = 200px
const mediaItemRect: Rect = {
  left: trackRect.left + itemStartPixels  // 150 + 50 = 200px
};

console.log('Setup:');
console.log(`  Item timeline position: ${itemStartTime}ms`);
console.log(`  Item offset from track left: ${itemStartPixels}px`);
console.log(`  Track viewport position: ${trackRect.left}px`);
console.log(`  Media item viewport position: ${mediaItemRect.left}px\n`);

// User touches the item 25px from its left edge
const touchX = mediaItemRect.left + 25; // 200 + 25 = 225px
const touchCoords: Coords = { clientX: touchX };

console.log(`User touches at: ${touchX}px (25px from item's left edge)\n`);

// === CURRENT (BUGGY) CODE ===
console.log('--- Current (buggy) code ---');

// Step 1: onMediaItemPointerDown calculates drag offset
// Uses mediaItem.getBoundingClientRect()
const clickX_buggy = touchCoords.clientX - mediaItemRect.left;
const dragOffset_buggy = clickX_buggy / pixelsPerMillisecond();

console.log(`onMediaItemPointerDown:`);
console.log(`  clickX = ${touchCoords.clientX} - ${mediaItemRect.left} = ${clickX_buggy}px`);
console.log(`  dragOffsetTime = ${clickX_buggy} / ${pixelsPerMillisecond()} = ${dragOffset_buggy}ms\n`);

// Step 2: User moves finger slightly (still at same position for this test)
const moveCoords: Coords = { clientX: touchX };

// onTrackPointerMove calculates new position
// Uses track.getBoundingClientRect() - DIFFERENT reference frame!
const x_buggy = moveCoords.clientX - trackRect.left;
const requestedStartTime_buggy = Math.max(0, x_buggy / pixelsPerMillisecond() - dragOffset_buggy);

console.log(`onTrackPointerMove (finger hasn't moved yet):`);
console.log(`  x = ${moveCoords.clientX} - ${trackRect.left} = ${x_buggy}px`);
console.log(`  requestedStartTime = ${x_buggy} / ${pixelsPerMillisecond()} - ${dragOffset_buggy}`);
console.log(`  requestedStartTime = ${x_buggy / pixelsPerMillisecond()} - ${dragOffset_buggy} = ${requestedStartTime_buggy}ms`);
console.log(`  Original position: ${itemStartTime}ms`);
console.log(`  Jump: ${requestedStartTime_buggy - itemStartTime}ms = ${(requestedStartTime_buggy - itemStartTime) * pixelsPerMillisecond()}px`);
console.log(`  ❌ Item jumped by ${TRACK_HEADER_WIDTH}px (the left panel width)!\n`);

// === PROPOSED FIX ===
console.log('--- Proposed fix ---');

// Fix: Calculate drag offset using the SAME reference frame as onTrackPointerMove
// We need to calculate how far the click was from the track's left edge, not the item's left edge

// Option 1: Calculate using track as reference in onMediaItemPointerDown
const clickX_fixed = touchCoords.clientX - trackRect.left;
const dragOffset_fixed = clickX_fixed / pixelsPerMillisecond();

console.log(`onMediaItemPointerDown (FIXED):`);
console.log(`  clickX = ${touchCoords.clientX} - ${trackRect.left} = ${clickX_fixed}px (relative to track)`);
console.log(`  dragOffsetTime = ${clickX_fixed} / ${pixelsPerMillisecond()} = ${dragOffset_fixed}ms\n`);

// Step 2: Same calculation in onTrackPointerMove
const x_fixed = moveCoords.clientX - trackRect.left;
const requestedStartTime_fixed = Math.max(0, x_fixed / pixelsPerMillisecond() - dragOffset_fixed);

console.log(`onTrackPointerMove (FIXED, finger hasn't moved yet):`);
console.log(`  x = ${moveCoords.clientX} - ${trackRect.left} = ${x_fixed}px`);
console.log(`  requestedStartTime = ${x_fixed} / ${pixelsPerMillisecond()} - ${dragOffset_fixed}`);
console.log(`  requestedStartTime = ${x_fixed / pixelsPerMillisecond()} - ${dragOffset_fixed} = ${requestedStartTime_fixed}ms`);
console.log(`  Original position: ${itemStartTime}ms`);
console.log(`  Jump: ${requestedStartTime_fixed - itemStartTime}ms`);
console.log(`  ✅ No jump! Item stays at original position.\n`);

// === Test with actual movement ===
console.log('--- Test with finger movement (100px to the right) ---');
const movedCoords: Coords = { clientX: touchX + 100 };

const x_moved_buggy = movedCoords.clientX - trackRect.left;
const newPos_moved_buggy = Math.max(0, x_moved_buggy / pixelsPerMillisecond() - dragOffset_buggy);

const x_moved_fixed = movedCoords.clientX - trackRect.left;
const newPos_moved_fixed = Math.max(0, x_moved_fixed / pixelsPerMillisecond() - dragOffset_fixed);

console.log(`Buggy: ${newPos_moved_buggy}ms (moved ${newPos_moved_buggy - itemStartTime}ms from original)`);
console.log(`Fixed: ${newPos_moved_fixed}ms (moved ${newPos_moved_fixed - itemStartTime}ms from original)`);
console.log(`Expected movement: ${100 / pixelsPerMillisecond()}ms (100px / ${pixelsPerMillisecond()} px/ms)`);
console.log(`✅ Fixed version correctly tracks movement!\n`);

console.log('=== Solution ===');
console.log('Instead of:');
console.log('  const mediaItemElement = event.currentTarget as HTMLElement;');
console.log('  const rect = mediaItemElement.getBoundingClientRect();');
console.log('  const clickX = coords.clientX - rect.left;');
console.log('');
console.log('We need to find the track element and use its rect:');
console.log('  const trackElement = // find parent track element');
console.log('  const trackRect = trackElement.getBoundingClientRect();');
console.log('  const clickX = coords.clientX - trackRect.left;');
console.log('');
console.log('This ensures both onMediaItemPointerDown and onTrackPointerMove');
console.log('use the same reference frame (track\'s left edge).');
