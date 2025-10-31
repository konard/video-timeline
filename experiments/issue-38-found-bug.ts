/**
 * Reproducing the actual overlap bug in issue #38
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

// Current BUGGY implementation from PR #37
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

  // **BUG IS HERE**: Math.max(0, requestedStartTime) should be Math.max(gap.gapStart, requestedStartTime)
  if (gapSize === Infinity) {
    return {
      startTime: Math.max(0, requestedStartTime),  // <-- BUG!
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

console.log('=== Reproducing Issue #38: Placeholder Overlap Bug ===\n');

// Scenario: User drags placeholder C to the right, past item B
// Item A: 0-2000ms
// Item B: 3000-5000ms
// Item C: 6000-8000ms (we're dragging this)
const itemA: MediaItem = { id: 'A', startTime: 0, duration: 2000 };
const itemB: MediaItem = { id: 'B', startTime: 3000, duration: 2000 };
const itemC: MediaItem = { id: 'C', startTime: 6000, duration: 2000 };

console.log('Initial Setup:');
console.log('Item A: 0-2000ms');
console.log('Item B: 3000-5000ms');
console.log('Item C: 6000-8000ms (dragging this one)\n');

console.log('Gaps:');
console.log('Gap 1: 2000-3000ms (between A and B)');
console.log('Gap 2: 5000-6000ms (between B and C)');
console.log('Gap 3: 8000-∞ (after C)\n');

// User drags C slowly to the right
console.log('=== Dragging C to the right (from 6000 onwards) ===\n');

const trackItems = [itemA, itemB, itemC];

for (let requestedPos = 6000; requestedPos <= 10000; requestedPos += 500) {
  console.log(`Requested position: ${requestedPos}ms`);

  const result = getValidDragPositionBuggy(itemC, requestedPos, trackItems);
  console.log(`  Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);

  // Check for overlaps
  const resultItem: MediaItem = { id: 'C', startTime: result.startTime, duration: result.duration };
  const otherItems = trackItems.filter(i => i.id !== 'C');

  let hasOverlap = false;
  for (const other of otherItems) {
    if (itemsOverlap(resultItem, other)) {
      console.log(`  ❌ OVERLAP with ${other.id} (${other.startTime}-${other.startTime + other.duration}ms)`);
      hasOverlap = true;
    }
  }

  if (!hasOverlap) {
    console.log(`  ✓ No overlap`);
  }
}

console.log('\n=== Now test dragging C to the LEFT (backwards) ===\n');

for (let requestedPos = 6000; requestedPos >= 0; requestedPos -= 500) {
  console.log(`Requested position: ${requestedPos}ms`);

  const result = getValidDragPositionBuggy(itemC, requestedPos, trackItems);
  console.log(`  Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);

  // Check for overlaps
  const resultItem: MediaItem = { id: 'C', startTime: result.startTime, duration: result.duration };
  const otherItems = trackItems.filter(i => i.id !== 'C');

  let hasOverlap = false;
  for (const other of otherItems) {
    if (itemsOverlap(resultItem, other)) {
      console.log(`  ❌ OVERLAP with ${other.id} (${other.startTime}-${other.startTime + other.duration}ms)`);
      hasOverlap = true;
    }
  }

  if (!hasOverlap) {
    console.log(`  ✓ No overlap`);
  }
}

console.log('\n=== The CRITICAL Test Case ===\n');
console.log('Drag item B to position 4500ms (which overlaps with itself at 3000-5000)');
console.log('findGapForPosition will return NULL (overlaps existing position)');
console.log('findClosestGap will find the infinite gap (8000-∞)');
console.log('Then with gapSize=Infinity, it returns Math.max(0, 4500) = 4500');
console.log('But item B ends at 5000, so placing at 4500 with duration 2000 = 4500-6500');
console.log('This overlaps with item C at 6000-8000!\n');

const requestedPos = 4500;
console.log(`Requested position: ${requestedPos}ms`);

const result = getValidDragPositionBuggy(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);
console.log(`Result end time: ${result.startTime + result.duration}ms`);

const resultItem: MediaItem = { id: 'B', startTime: result.startTime, duration: result.duration };
const otherItemsB = trackItems.filter(i => i.id !== 'B');

let hasOverlap = false;
for (const other of otherItemsB) {
  if (itemsOverlap(resultItem, other)) {
    console.log(`❌ ❌ ❌ OVERLAP FOUND! Item B (${resultItem.startTime}-${resultItem.startTime + resultItem.duration}ms) overlaps ${other.id} (${other.startTime}-${other.startTime + other.duration}ms)`);
    hasOverlap = true;
  }
}

if (!hasOverlap) {
  console.log('✓ No overlap');
}

console.log('\n=== Summary ===');
console.log('The bug occurs when:');
console.log('1. User drags an item');
console.log('2. The requested position overlaps an existing item (causing findGapForPosition to return null)');
console.log('3. findClosestGap finds the infinite gap (after last item)');
console.log('4. The code returns Math.max(0, requestedStartTime) instead of Math.max(gap.gapStart, requestedStartTime)');
console.log('5. This can place the item at a position where it overlaps with items before the infinite gap\n');

console.log('FIX: Change line 373 from:');
console.log('  startTime: Math.max(0, requestedStartTime),');
console.log('To:');
console.log('  startTime: Math.max(gap.gapStart, requestedStartTime),');
