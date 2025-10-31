/**
 * Experiment to test issue #38: Placeholders overlapping during drag
 *
 * Issue description (from #38):
 * Currently when dragging placeholders, sometimes they can overlap each other.
 * This should be excluded. At the same time, "jumps" can only happen when
 * inserting placeholders, but not when positioning on the same track.
 *
 * Key requirements:
 * 1. Prevent overlapping during drag
 * 2. Jumps allowed only during insertion (addMediaItem)
 * 3. No jumps when dragging on same track
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

  // Gap before first item
  if (sortedItems[0].startTime > 0) {
    gaps.push({
      gapStart: 0,
      gapEnd: sortedItems[0].startTime,
      leftItem: null,
      rightItem: sortedItems[0]
    });
  }

  // Gaps between items
  for (let i = 0; i < sortedItems.length - 1; i++) {
    const leftItem = sortedItems[i];
    const rightItem = sortedItems[i + 1];
    const gapStart = leftItem.startTime + leftItem.duration;
    const gapEnd = rightItem.startTime;

    if (gapEnd > gapStart) {
      gaps.push({ gapStart, gapEnd, leftItem, rightItem });
    }
  }

  // Gap after last item
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

// Current implementation from PR #37
function getValidDragPositionCurrent(
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
    // PR #37 fix: Find closest gap instead of jumping to end
    const allGaps = findAllGaps(otherItems);
    gap = findClosestGap(requestedStartTime, allGaps);
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

console.log('=== Issue #38: Testing for Overlaps During Drag ===\n');

const itemA: MediaItem = { id: 'A', startTime: 0, duration: 1000 };
const itemB: MediaItem = { id: 'B', startTime: 2000, duration: 1000 };
const itemC: MediaItem = { id: 'C', startTime: 4000, duration: 1000 };

console.log('Initial setup:');
console.log('Item A: 0-1000ms');
console.log('Item B: 2000-3000ms (will drag this)');
console.log('Item C: 4000-5000ms\n');

function testDrag(
  item: MediaItem,
  requestedPos: number,
  trackItems: MediaItem[],
  description: string
) {
  console.log(`Test: ${description}`);
  console.log(`Requested position: ${requestedPos}ms`);

  const result = getValidDragPositionCurrent(item, requestedPos, trackItems);
  console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);

  // Check for overlaps with other items
  const otherItems = trackItems.filter(i => i.id !== item.id);
  const resultItem: MediaItem = { id: item.id, startTime: result.startTime, duration: result.duration };

  let hasOverlap = false;
  for (const other of otherItems) {
    if (itemsOverlap(resultItem, other)) {
      console.log(`❌ OVERLAP DETECTED with item ${other.id} (${other.startTime}-${other.startTime + other.duration}ms)`);
      hasOverlap = true;
    }
  }

  if (!hasOverlap) {
    console.log('✓ No overlaps');
  }
  console.log();

  return { result, hasOverlap };
}

// Test case 1: Dragging within a valid gap (should work fine)
testDrag(itemB, 1500, [itemA, itemB, itemC], 'Drag B to 1500ms (middle of gap A-B)');

// Test case 2: Dragging to overlap with item A
testDrag(itemB, 500, [itemA, itemB, itemC], 'Drag B to 500ms (overlaps A)');

// Test case 3: Dragging to overlap with item C
testDrag(itemB, 4500, [itemA, itemB, itemC], 'Drag B to 4500ms (overlaps C)');

// Test case 4: Dragging slowly within the same track - simulating continuous mouse movement
console.log('=== Simulating continuous drag from B position (2000ms) to left ===');
console.log('Testing if there are any intermediate positions where overlap can occur\n');

const trackItems = [itemA, itemB, itemC];
let foundOverlapDuringDrag = false;

// Simulate dragging from 2000 to 0 in small steps
for (let pos = 2000; pos >= 0; pos -= 100) {
  const result = getValidDragPositionCurrent(itemB, pos, trackItems);
  const resultItem: MediaItem = { id: itemB.id, startTime: result.startTime, duration: result.duration };

  const otherItems = trackItems.filter(i => i.id !== itemB.id);
  for (const other of otherItems) {
    if (itemsOverlap(resultItem, other)) {
      console.log(`❌ Overlap at requested pos ${pos}ms: item placed at ${result.startTime}ms overlaps ${other.id}`);
      foundOverlapDuringDrag = true;
    }
  }
}

if (!foundOverlapDuringDrag) {
  console.log('✓ No overlaps detected during continuous drag simulation\n');
} else {
  console.log();
}

console.log('=== Analysis ===');
console.log('The current implementation (from PR #37) appears to prevent overlaps by:');
console.log('1. Finding the gap where the requested position falls');
console.log('2. If position overlaps an item, finding the closest gap');
console.log('3. Adjusting duration if needed to fit the gap');
console.log('\nHowever, issue #38 suggests overlaps can still occur.');
console.log('This might be related to:');
console.log('- The HTML/CSS rendering during drag operations');
console.log('- The onTrackMouseMove logic that updates item positions');
console.log('- Timing issues where positions are calculated but not yet applied');
console.log('- Edge cases in the gap-finding logic\n');
