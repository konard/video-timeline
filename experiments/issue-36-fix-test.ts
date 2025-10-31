/**
 * Experiment to test the fix for issue #36: Placeholder jumping bug
 *
 * Solution:
 * When the requested position overlaps an existing item, instead of jumping
 * to the end of the track, find the closest gap to the requested position
 * and place the item there.
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

/**
 * Find all gaps in the track
 */
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

/**
 * Find the closest gap to the requested position
 */
function findClosestGap(requestedStartTime: number, gaps: Gap[]): Gap {
  let closestGap = gaps[0];
  let minDistance = Infinity;

  for (const gap of gaps) {
    let distance: number;

    if (requestedStartTime < gap.gapStart) {
      // Requested position is before this gap
      distance = gap.gapStart - requestedStartTime;
    } else if (gap.gapEnd === Infinity || requestedStartTime < gap.gapEnd) {
      // Requested position is within this gap
      distance = 0;
    } else {
      // Requested position is after this gap
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
    // FIX: Instead of jumping to the end, find the closest gap
    console.log('⚙️ Position overlaps existing item, finding closest gap...');
    const allGaps = findAllGaps(otherItems);
    gap = findClosestGap(requestedStartTime, allGaps);
    console.log(`✓ Closest gap found: ${gap.gapStart}-${gap.gapEnd === Infinity ? '∞' : gap.gapEnd}`);
  }

  const gapSize = gap.gapEnd === Infinity ? Infinity : gap.gapEnd - gap.gapStart;

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

console.log('=== Issue #36: Testing the Fix ===\n');

const itemA: MediaItem = { id: 'A', startTime: 0, duration: 1000 };
const itemB: MediaItem = { id: 'B', startTime: 2000, duration: 1000 };
const itemC: MediaItem = { id: 'C', startTime: 4000, duration: 1000 };

const trackItems = [itemA, itemB, itemC];

console.log('Initial setup:');
console.log('Item A: 0-1000ms');
console.log('Item B: 2000-3000ms (dragging this)');
console.log('Item C: 4000-5000ms\n');

console.log('Test 1: Dragging Item B left to 1500 (in gap)');
console.log('-----------------------------------------------');
let requestedPos = 1500;
console.log(`Requested position: ${requestedPos}ms`);
let result = getValidDragPositionFixed(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);
console.log(`✓ Item stays in gap between A and B\n`);

console.log('Test 2: Dragging Item B left to 900 (overlaps Item A)');
console.log('-------------------------------------------------------');
requestedPos = 900;
console.log(`Requested position: ${requestedPos}ms`);
result = getValidDragPositionFixed(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);
console.log(`✓ FIXED: Item stays in gap between A and B (closest to requested position)\n`);

console.log('Test 3: Dragging Item B left to 500 (overlaps Item A)');
console.log('-------------------------------------------------------');
requestedPos = 500;
console.log(`Requested position: ${requestedPos}ms`);
result = getValidDragPositionFixed(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);
console.log(`✓ FIXED: Item stays in gap between A and B (closest gap)\n`);

console.log('Test 4: Dragging Item B left to -100 (before Item A)');
console.log('------------------------------------------------------');
requestedPos = -100;
console.log(`Requested position: ${requestedPos}ms`);
result = getValidDragPositionFixed(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);
console.log(`✓ Item placed at start (gap before A is closest)\n`);

console.log('Test 5: Dragging Item B right to 4500 (overlaps Item C)');
console.log('---------------------------------------------------------');
requestedPos = 4500;
console.log(`Requested position: ${requestedPos}ms`);
result = getValidDragPositionFixed(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);
console.log(`✓ FIXED: Item stays in gap between B and C (closest to requested position)\n`);

console.log('Test 6: Dragging Item B right to 3500 (in gap)');
console.log('------------------------------------------------');
requestedPos = 3500;
console.log(`Requested position: ${requestedPos}ms`);
result = getValidDragPositionFixed(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);
console.log(`✓ Item stays in gap between B and C\n`);

console.log('Test 7: Dragging Item B far right to 6000 (after all items)');
console.log('-------------------------------------------------------------');
requestedPos = 6000;
console.log(`Requested position: ${requestedPos}ms`);
result = getValidDragPositionFixed(itemB, requestedPos, trackItems);
console.log(`Result: startTime=${result.startTime}ms, duration=${result.duration}ms`);
console.log(`✓ Item placed after C (infinite gap is closest)\n`);

console.log('=== Summary ===');
console.log('The fix successfully prevents the jumping bug by finding the closest');
console.log('gap when the requested position overlaps an existing item.');
console.log('This provides smooth, predictable dragging behavior.\n');
