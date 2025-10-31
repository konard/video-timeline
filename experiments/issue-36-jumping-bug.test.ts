/**
 * Experiment to reproduce issue #36: Placeholder jumping bug
 *
 * Bug description:
 * When dragging a placeholder between two others on the same track,
 * when it reaches the previous one, it jumps to the end of the track.
 *
 * Expected behavior:
 * The placeholder should smoothly move between positions without jumping
 * to the end of the track.
 */

interface MediaItem {
  id: string;
  startTime: number;
  duration: number;
}

const MIN_ITEM_DURATION = 100;

function findGapForPosition(
  requestedStartTime: number,
  itemDuration: number,
  trackItems: MediaItem[]
): { gapStart: number; gapEnd: number; leftItem: MediaItem | null; rightItem: MediaItem | null } | null {
  const sortedItems = [...trackItems].sort((a, b) => a.startTime - b.startTime);

  if (sortedItems.length === 0) {
    return { gapStart: 0, gapEnd: Infinity, leftItem: null, rightItem: null };
  }

  if (requestedStartTime < sortedItems[0].startTime) {
    return {
      gapStart: 0,
      gapEnd: sortedItems[0].startTime,
      leftItem: null,
      rightItem: sortedItems[0]
    };
  }

  for (let i = 0; i < sortedItems.length - 1; i++) {
    const leftItem = sortedItems[i];
    const rightItem = sortedItems[i + 1];
    const gapStart = leftItem.startTime + leftItem.duration;
    const gapEnd = rightItem.startTime;

    if (requestedStartTime >= gapStart && requestedStartTime < gapEnd) {
      return { gapStart, gapEnd, leftItem, rightItem };
    }
  }

  const lastItem = sortedItems[sortedItems.length - 1];
  if (requestedStartTime >= lastItem.startTime + lastItem.duration) {
    return {
      gapStart: lastItem.startTime + lastItem.duration,
      gapEnd: Infinity,
      leftItem: lastItem,
      rightItem: null
    };
  }

  return null;
}

function getValidDragPosition(
  item: MediaItem,
  requestedStartTime: number,
  trackItems: MediaItem[]
): { startTime: number; duration: number } {
  const otherItems = trackItems.filter(i => i.id !== item.id);

  if (otherItems.length === 0) {
    return {
      startTime: Math.max(0, requestedStartTime),
      duration: item.duration
    };
  }

  const gap = findGapForPosition(requestedStartTime, item.duration, otherItems);

  if (!gap) {
    // BUG: This is where the jumping happens!
    // When dragging and the requested position overlaps an existing item,
    // it jumps to the end of the track
    console.log('⚠️ BUG TRIGGERED: gap not found, jumping to end of track');
    const sortedItems = [...otherItems].sort((a, b) => a.startTime - b.startTime);
    const lastItem = sortedItems[sortedItems.length - 1];
    return {
      startTime: lastItem.startTime + lastItem.duration,
      duration: item.duration
    };
  }

  const gapSize = gap.gapEnd === Infinity ? Infinity : gap.gapEnd - gap.gapStart;

  if (gapSize === Infinity) {
    return {
      startTime: Math.max(0, requestedStartTime),
      duration: item.duration
    };
  }

  if (item.duration <= gapSize) {
    const maxStartTime = gap.gapEnd - item.duration;
    const finalStartTime = Math.max(gap.gapStart, Math.min(requestedStartTime, maxStartTime));
    return {
      startTime: finalStartTime,
      duration: item.duration
    };
  }

  const adjustedDuration = Math.max(MIN_ITEM_DURATION, gapSize);

  return {
    startTime: gap.gapStart,
    duration: adjustedDuration
  };
}

console.log('=== Issue #36: Placeholder Jumping Bug ===\n');

// Scenario: Three items on a track
// Item A: 0-1000ms
// Item B: 2000-3000ms (this is the one we're dragging)
// Item C: 4000-5000ms
console.log('Initial setup:');
console.log('Item A: 0-1000ms');
console.log('Item B: 2000-3000ms (dragging this)');
console.log('Item C: 4000-5000ms\n');

const itemA: MediaItem = { id: 'A', startTime: 0, duration: 1000 };
const itemB: MediaItem = { id: 'B', startTime: 2000, duration: 1000 };
const itemC: MediaItem = { id: 'C', startTime: 4000, duration: 1000 };

const trackItems = [itemA, itemB, itemC];

console.log('Test 1: Dragging Item B left towards Item A');
console.log('-----------------------------------------------');
// Simulate dragging Item B from 2000 to 1500 (middle of gap between A and B)
let requestedPos = 1500;
console.log(`Requested position: ${requestedPos}ms`);
let result = getValidDragPosition(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);
console.log(`✓ This should work fine (gap exists)\n`);

console.log('Test 2: Dragging Item B further left to 1000 (exactly at Item A end)');
console.log('-----------------------------------------------------------------------');
requestedPos = 1000;
console.log(`Requested position: ${requestedPos}ms`);
result = getValidDragPosition(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);
console.log(`✓ This should work fine (gap boundary)\n`);

console.log('Test 3: Dragging Item B further left to 900 (overlaps Item A)');
console.log('----------------------------------------------------------------');
requestedPos = 900;
console.log(`Requested position: ${requestedPos}ms`);
result = getValidDragPosition(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);
console.log(`❌ BUG: Item B should stay near Item A, but it jumps to ${result.startTime}ms (after Item C)!\n`);

console.log('Test 4: Dragging Item B right towards Item C');
console.log('----------------------------------------------');
requestedPos = 3500;
console.log(`Requested position: ${requestedPos}ms`);
result = getValidDragPosition(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);
console.log(`✓ This should work fine (gap exists)\n`);

console.log('Test 5: Dragging Item B to overlap Item C');
console.log('-------------------------------------------');
requestedPos = 4500;
console.log(`Requested position: ${requestedPos}ms`);
result = getValidDragPosition(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);
console.log(`❌ BUG: Item B should stay before Item C, but it jumps to ${result.startTime}ms (after Item C)!\n`);

console.log('=== Analysis ===');
console.log('The bug occurs because findGapForPosition() returns null when the');
console.log('requested position overlaps an existing item. The fallback logic');
console.log('then places the item at the end of the track, causing the "jump".');
console.log('\nThis is problematic when dragging within the same track, as the');
console.log('user expects smooth repositioning, not sudden jumps.\n');
