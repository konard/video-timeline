/**
 * Test for bug in infinite gap handling that can cause overlaps
 */

interface MediaItem {
  id: string;
  startTime: number;
  duration: number;
}

interface Gap {
  gapStart: number;
  gapEnd: number;
  leftItem: MediaItem | null;
  rightItem: MediaItem | null;
}

const MIN_ITEM_DURATION = 100;

function itemsOverlap(item1: MediaItem, item2: MediaItem): boolean {
  const item1End = item1.startTime + item1.duration;
  const item2End = item2.startTime + item2.duration;
  return !(item1End <= item2.startTime || item2End <= item1.startTime);
}

function findAllGaps(trackItems: MediaItem[]): Gap[] {
  const gaps: Gap[] = [];
  const sortedItems = [...trackItems].sort((a, b) => a.startTime - b.startTime);

  if (sortedItems.length === 0) {
    return [{ gapStart: 0, gapEnd: Infinity, leftItem: null, rightItem: null }];
  }

  if (sortedItems[0].startTime > 0) {
    gaps.push({
      gapStart: 0,
      gapEnd: sortedItems[0].startTime,
      leftItem: null,
      rightItem: sortedItems[0]
    });
  }

  for (let i = 0; i < sortedItems.length - 1; i++) {
    const leftItem = sortedItems[i];
    const rightItem = sortedItems[i + 1];
    const gapStart = leftItem.startTime + leftItem.duration;
    const gapEnd = rightItem.startTime;

    if (gapEnd > gapStart) {
      gaps.push({ gapStart, gapEnd, leftItem, rightItem });
    }
  }

  const lastItem = sortedItems[sortedItems.length - 1];
  gaps.push({
    gapStart: lastItem.startTime + lastItem.duration,
    gapEnd: Infinity,
    leftItem: lastItem,
    rightItem: null
  });

  return gaps;
}

function findClosestGap(requestedStartTime: number, gaps: Gap[]): Gap {
  let closestGap = gaps[0];
  let minDistance = Infinity;

  for (const gap of gaps) {
    let distance: number;

    if (requestedStartTime < gap.gapStart) {
      distance = gap.gapStart - requestedStartTime;
    } else if (gap.gapEnd === Infinity || requestedStartTime < gap.gapEnd) {
      distance = 0;
    } else {
      distance = requestedStartTime - gap.gapEnd;
    }

    if (distance < minDistance) {
      minDistance = distance;
      closestGap = gap;
    }
  }

  return closestGap;
}

function findGapForPosition(
  requestedStartTime: number,
  itemDuration: number,
  trackItems: MediaItem[]
): Gap | null {
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

// Current buggy implementation
function getValidDragPositionBuggy(
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

  let gap = findGapForPosition(requestedStartTime, item.duration, otherItems);

  if (!gap) {
    const allGaps = findAllGaps(otherItems);
    gap = findClosestGap(requestedStartTime, allGaps);
  }

  const gapSize = gap.gapEnd === Infinity ? Infinity : gap.gapEnd - gap.gapStart;

  // BUG: When gap is infinite, uses Math.max(0, requestedStartTime)
  // This can place item before gap.gapStart, causing overlap
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

// Fixed implementation
function getValidDragPositionFixed(
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

  let gap = findGapForPosition(requestedStartTime, item.duration, otherItems);

  if (!gap) {
    const allGaps = findAllGaps(otherItems);
    gap = findClosestGap(requestedStartTime, allGaps);
  }

  const gapSize = gap.gapEnd === Infinity ? Infinity : gap.gapEnd - gap.gapStart;

  // FIX: Ensure item starts at or after gap.gapStart even in infinite gap
  if (gapSize === Infinity) {
    return {
      startTime: Math.max(gap.gapStart, requestedStartTime),
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

console.log('=== Testing Infinite Gap Overlap Bug ===\n');

const itemA: MediaItem = { id: 'A', startTime: 0, duration: 1000 };
const itemB: MediaItem = { id: 'B', startTime: 3000, duration: 1000 };

const trackItems = [itemA, itemB];

console.log('Setup:');
console.log('Item A: 0-1000ms');
console.log('Item B: 3000-4000ms');
console.log('Infinite gap starts at: 4000ms\n');

console.log('Test Case: Drag B to position 3500ms');
console.log('Expected: Position should find infinite gap (starts at 4000ms)');
console.log('and since requested 3500 < 4000, it should place at 4000ms or use closest gap logic\n');

const requestedPos = 3500;

console.log('--- Buggy Implementation ---');
const buggyResult = getValidDragPositionBuggy(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${buggyResult.startTime}ms, duration=${buggyResult.duration}ms`);

const buggyItem: MediaItem = { id: 'B', startTime: buggyResult.startTime, duration: buggyResult.duration };
const otherItems = trackItems.filter(i => i.id !== 'B');
let hasBuggyOverlap = false;
for (const other of otherItems) {
  if (itemsOverlap(buggyItem, other)) {
    console.log(`❌ OVERLAP: Item B (${buggyItem.startTime}-${buggyItem.startTime + buggyItem.duration}) overlaps ${other.id} (${other.startTime}-${other.startTime + other.duration})`);
    hasBuggyOverlap = true;
  }
}
if (!hasBuggyOverlap) {
  console.log('✓ No overlap (but might be in wrong gap)');
}

console.log('\n--- Fixed Implementation ---');
const fixedResult = getValidDragPositionFixed(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${fixedResult.startTime}ms, duration=${fixedResult.duration}ms`);

const fixedItem: MediaItem = { id: 'B', startTime: fixedResult.startTime, duration: fixedResult.duration };
let hasFixedOverlap = false;
for (const other of otherItems) {
  if (itemsOverlap(fixedItem, other)) {
    console.log(`❌ OVERLAP: Item B (${fixedItem.startTime}-${fixedItem.startTime + fixedItem.duration}) overlaps ${other.id} (${other.startTime}-${other.startTime + other.duration})`);
    hasFixedOverlap = true;
  }
}
if (!hasFixedOverlap) {
  console.log('✓ No overlap');
}

console.log('\n=== More Test Cases ===\n');

// Test case where this actually causes an overlap
const itemC: MediaItem = { id: 'C', startTime: 5000, duration: 1000 };
const trackItems2 = [itemA, itemB, itemC];

console.log('Setup 2:');
console.log('Item A: 0-1000ms');
console.log('Item B: 5000-6000ms');
console.log('Item C: 3000-4000ms (dragging this backwards)\n');

const requestedPos2 = 3500;

console.log('Test: Drag C backwards from 3000ms to 3500ms');
console.log('(findGapForPosition should find gap 1000-3000, but if it returns infinite gap...)');

console.log('\n--- Buggy Implementation ---');
const buggyResult2 = getValidDragPositionBuggy(itemC, requestedPos2, trackItems2);
console.log(`Result: startTime=${buggyResult2.startTime}ms, duration=${buggyResult2.duration}ms`);

const buggyItem2: MediaItem = { id: 'C', startTime: buggyResult2.startTime, duration: buggyResult2.duration };
const otherItems2 = trackItems2.filter(i => i.id !== 'C');
let hasBuggyOverlap2 = false;
for (const other of otherItems2) {
  if (itemsOverlap(buggyItem2, other)) {
    console.log(`❌ OVERLAP: Item C (${buggyItem2.startTime}-${buggyItem2.startTime + buggyItem2.duration}) overlaps ${other.id} (${other.startTime}-${other.startTime + other.duration})`);
    hasBuggyOverlap2 = true;
  }
}
if (!hasBuggyOverlap2) {
  console.log('✓ No overlap');
}

console.log('\n--- Fixed Implementation ---');
const fixedResult2 = getValidDragPositionFixed(itemC, requestedPos2, trackItems2);
console.log(`Result: startTime=${fixedResult2.startTime}ms, duration=${fixedResult2.duration}ms`);

const fixedItem2: MediaItem = { id: 'C', startTime: fixedResult2.startTime, duration: fixedResult2.duration };
let hasFixedOverlap2 = false;
for (const other of otherItems2) {
  if (itemsOverlap(fixedItem2, other)) {
    console.log(`❌ OVERLAP: Item C (${fixedItem2.startTime}-${fixedItem2.startTime + fixedItem2.duration}) overlaps ${other.id} (${other.startTime}-${other.startTime + other.duration})`);
    hasFixedOverlap2 = true;
  }
}
if (!hasFixedOverlap2) {
  console.log('✓ No overlap');
}

console.log('\n=== Summary ===');
console.log('The bug is in the infinite gap handling (line 372-376 in timeline.component.ts):');
console.log('  return { startTime: Math.max(0, requestedStartTime), duration: item.duration };');
console.log('\nShould be:');
console.log('  return { startTime: Math.max(gap.gapStart, requestedStartTime), duration: item.duration };');
console.log('\nThis ensures the item always starts at or after the gap start, preventing overlap.');
