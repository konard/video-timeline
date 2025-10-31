/**
 * Verify the fix for issue #38: Placeholder overlap bug
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

// FIXED implementation
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

  // FIXED: Use gap.gapStart instead of 0
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

console.log('=== Verifying Fix for Issue #38 ===\n');

const itemA: MediaItem = { id: 'A', startTime: 0, duration: 2000 };
const itemB: MediaItem = { id: 'B', startTime: 3000, duration: 2000 };
const itemC: MediaItem = { id: 'C', startTime: 6000, duration: 2000 };

console.log('Initial Setup:');
console.log('Item A: 0-2000ms');
console.log('Item B: 3000-5000ms');
console.log('Item C: 6000-8000ms\n');

const trackItems = [itemA, itemB, itemC];

console.log('=== Test 1: The bug scenario - Dragging C to 4500ms ===');
const requestedPos1 = 4500;
console.log(`Requested position: ${requestedPos1}ms\n`);

const result1 = getValidDragPositionFixed(itemC, requestedPos1, trackItems);
console.log(`Result: startTime=${result1.startTime}ms, duration=${result1.duration}ms`);
console.log(`Result end time: ${result1.startTime + result1.duration}ms`);

const resultItem1: MediaItem = { id: 'C', startTime: result1.startTime, duration: result1.duration };
const otherItems1 = trackItems.filter(i => i.id !== 'C');

let hasOverlap1 = false;
for (const other of otherItems1) {
  if (itemsOverlap(resultItem1, other)) {
    console.log(`❌ OVERLAP with ${other.id} (${other.startTime}-${other.startTime + other.duration}ms)`);
    hasOverlap1 = true;
  }
}

if (!hasOverlap1) {
  console.log('✅ No overlap - BUG FIXED!\n');
}

console.log('=== Test 2: Comprehensive drag simulation ===\n');

let totalTests = 0;
let passedTests = 0;

// Test dragging C to various positions
const testPositions = [
  { pos: 4500, desc: 'Overlap with B (was buggy)' },
  { pos: 4000, desc: 'Edge of B' },
  { pos: 3500, desc: 'Middle of B' },
  { pos: 5500, desc: 'Between B and C' },
  { pos: 7000, desc: 'Within C original position' },
  { pos: 9000, desc: 'After all items' },
  { pos: 1000, desc: 'Between A and B' },
  { pos: 500, desc: 'Overlap with A' }
];

for (const test of testPositions) {
  totalTests++;
  const result = getValidDragPositionFixed(itemC, test.pos, trackItems);
  const resultItem: MediaItem = { id: 'C', startTime: result.startTime, duration: result.duration };
  const otherItems = trackItems.filter(i => i.id !== 'C');

  let hasOverlap = false;
  for (const other of otherItems) {
    if (itemsOverlap(resultItem, other)) {
      console.log(`Test ${totalTests}: ${test.desc} (pos=${test.pos}ms)`);
      console.log(`  ❌ FAIL: Overlap with ${other.id}`);
      hasOverlap = true;
    }
  }

  if (!hasOverlap) {
    passedTests++;
  }
}

console.log(`\n=== Results ===`);
console.log(`Passed: ${passedTests}/${totalTests} tests`);

if (passedTests === totalTests) {
  console.log('✅ All tests passed! The fix works correctly.\n');
} else {
  console.log('❌ Some tests failed. The fix needs more work.\n');
}

console.log('=== Continuous drag simulation ===');
console.log('Simulating dragging C from 6000ms backwards to 0ms in small steps\n');

let allOverlapFree = true;
for (let pos = 6000; pos >= 0; pos -= 100) {
  const result = getValidDragPositionFixed(itemC, pos, trackItems);
  const resultItem: MediaItem = { id: 'C', startTime: result.startTime, duration: result.duration };
  const otherItems = trackItems.filter(i => i.id !== 'C');

  for (const other of otherItems) {
    if (itemsOverlap(resultItem, other)) {
      console.log(`❌ Overlap at requested pos ${pos}ms: placed at ${result.startTime}ms, overlaps ${other.id}`);
      allOverlapFree = false;
    }
  }
}

if (allOverlapFree) {
  console.log('✅ No overlaps detected during continuous backward drag simulation\n');
}

console.log('Simulating dragging C from 6000ms forward to 12000ms in small steps\n');

allOverlapFree = true;
for (let pos = 6000; pos <= 12000; pos += 100) {
  const result = getValidDragPositionFixed(itemC, pos, trackItems);
  const resultItem: MediaItem = { id: 'C', startTime: result.startTime, duration: result.duration };
  const otherItems = trackItems.filter(i => i.id !== 'C');

  for (const other of otherItems) {
    if (itemsOverlap(resultItem, other)) {
      console.log(`❌ Overlap at requested pos ${pos}ms: placed at ${result.startTime}ms, overlaps ${other.id}`);
      allOverlapFree = false;
    }
  }
}

if (allOverlapFree) {
  console.log('✅ No overlaps detected during continuous forward drag simulation\n');
}

console.log('=== Summary ===');
console.log('The fix ensures that when an infinite gap is used, the item always');
console.log('starts at or after the gap start (Math.max(gap.gapStart, requestedStartTime))');
console.log('instead of just Math.max(0, requestedStartTime).');
console.log('This prevents overlaps with items before the infinite gap.\n');
