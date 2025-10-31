/**
 * Gap Fitting Test - Testing placeholder insertion with duration adjustment
 *
 * This experiment tests the scenario described in issue #33:
 * When dragging a placeholder between two existing placeholders where
 * the gap is smaller than the dragged item's duration, it should:
 * 1. Fit the item into the available gap
 * 2. Adjust the duration to match the gap size
 * 3. Not overlap adjacent items
 */

interface MediaItem {
  id: string;
  startTime: number;
  duration: number;
}

/**
 * Check if two items overlap
 */
function itemsOverlap(item1: MediaItem, item2: MediaItem): boolean {
  const item1End = item1.startTime + item1.duration;
  const item2End = item2.startTime + item2.duration;
  return !(item1End <= item2.startTime || item2End <= item1.startTime);
}

/**
 * Find the gap where the requested position falls
 * Returns the gap bounds or null if no suitable gap found
 */
function findGapForPosition(
  requestedStartTime: number,
  itemDuration: number,
  trackItems: MediaItem[]
): { gapStart: number; gapEnd: number; leftItem: MediaItem | null; rightItem: MediaItem | null } | null {
  const sortedItems = [...trackItems].sort((a, b) => a.startTime - b.startTime);

  // Check if position is before all items
  if (sortedItems.length === 0) {
    return { gapStart: 0, gapEnd: Infinity, leftItem: null, rightItem: null };
  }

  const requestedEndTime = requestedStartTime + itemDuration;

  // Check gap before first item
  if (requestedStartTime < sortedItems[0].startTime) {
    return {
      gapStart: 0,
      gapEnd: sortedItems[0].startTime,
      leftItem: null,
      rightItem: sortedItems[0]
    };
  }

  // Check gaps between items
  for (let i = 0; i < sortedItems.length - 1; i++) {
    const leftItem = sortedItems[i];
    const rightItem = sortedItems[i + 1];
    const gapStart = leftItem.startTime + leftItem.duration;
    const gapEnd = rightItem.startTime;

    // Check if requested position falls within this gap
    if (requestedStartTime >= gapStart && requestedStartTime < gapEnd) {
      return { gapStart, gapEnd, leftItem, rightItem };
    }
  }

  // Check gap after last item
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

/**
 * NEW IMPLEMENTATION: Get valid drag position with duration adjustment
 */
function getValidDragPositionWithFitting(
  item: MediaItem,
  requestedStartTime: number,
  trackItems: MediaItem[]
): { startTime: number; duration: number } {
  const MIN_DURATION = 100; // Minimum duration in ms
  const otherItems = trackItems.filter(i => i.id !== item.id);

  if (otherItems.length === 0) {
    // Empty track, place at requested position with original duration
    return {
      startTime: Math.max(0, requestedStartTime),
      duration: item.duration
    };
  }

  // Find which gap the requested position falls into
  const gap = findGapForPosition(requestedStartTime, item.duration, otherItems);

  if (!gap) {
    // Shouldn't happen, but fallback to end of track
    const sortedItems = [...otherItems].sort((a, b) => a.startTime - b.startTime);
    const lastItem = sortedItems[sortedItems.length - 1];
    return {
      startTime: lastItem.startTime + lastItem.duration,
      duration: item.duration
    };
  }

  const gapSize = gap.gapEnd === Infinity ? Infinity : gap.gapEnd - gap.gapStart;

  // If gap is infinite (after last item or empty track), use original duration
  if (gapSize === Infinity) {
    return {
      startTime: Math.max(0, requestedStartTime),
      duration: item.duration
    };
  }

  // If item fits completely in the gap, use original duration
  if (item.duration <= gapSize) {
    // But make sure it doesn't go past the gap end
    const maxStartTime = gap.gapEnd - item.duration;
    const finalStartTime = Math.max(gap.gapStart, Math.min(requestedStartTime, maxStartTime));
    return {
      startTime: finalStartTime,
      duration: item.duration
    };
  }

  // Item doesn't fit - adjust duration to fit the gap
  const adjustedDuration = Math.max(MIN_DURATION, gapSize);

  // Position at the start of the gap
  return {
    startTime: gap.gapStart,
    duration: adjustedDuration
  };
}

/**
 * OLD IMPLEMENTATION: Current behavior (for comparison)
 */
function getValidDragPositionOld(
  item: MediaItem,
  requestedStartTime: number,
  trackItems: MediaItem[]
): number {
  const otherItems = trackItems.filter(i => i.id !== item.id);
  const testItem = { ...item, startTime: requestedStartTime };

  // Check for overlaps with each item
  for (const other of otherItems) {
    if (itemsOverlap(testItem, other)) {
      // Snap to nearest non-overlapping position
      if (requestedStartTime < other.startTime) {
        // Moving left, snap to left of other item
        return Math.max(0, other.startTime - item.duration);
      } else {
        // Moving right, snap to right of other item
        return other.startTime + other.duration;
      }
    }
  }

  return Math.max(0, requestedStartTime);
}

// ============================================================================
// TEST CASES
// ============================================================================

console.log('=== Gap Fitting Test Suite ===\n');

// Test Case 1: Gap smaller than item duration (the main bug scenario)
console.log('Test 1: Gap smaller than item duration');
const trackItems1: MediaItem[] = [
  { id: 'item-a', startTime: 0, duration: 3000 },
  { id: 'item-b', startTime: 4000, duration: 3000 }
];
const draggedItem1: MediaItem = { id: 'item-c', startTime: 0, duration: 3000 };
const requestedPos1 = 3500; // Middle of the gap (gap is 1000ms: 3000-4000)

console.log('Track items:');
console.log('  Item A: 0-3000ms');
console.log('  Item B: 4000-7000ms');
console.log('Gap: 3000-4000ms (size: 1000ms)');
console.log('Dragged item C: duration 3000ms');
console.log('Requested position: 3500ms\n');

const oldResult1 = getValidDragPositionOld(draggedItem1, requestedPos1, trackItems1);
console.log('OLD behavior:');
console.log(`  Position: ${oldResult1}ms`);
console.log(`  Duration: ${draggedItem1.duration}ms (unchanged)`);
console.log(`  End time: ${oldResult1 + draggedItem1.duration}ms`);
const wouldOverlap = oldResult1 + draggedItem1.duration > 4000;
console.log(`  Overlaps with Item B? ${wouldOverlap ? 'YES ❌' : 'NO ✓'}\n`);

const newResult1 = getValidDragPositionWithFitting(draggedItem1, requestedPos1, trackItems1);
console.log('NEW behavior:');
console.log(`  Position: ${newResult1.startTime}ms`);
console.log(`  Duration: ${newResult1.duration}ms (adjusted to fit gap)`);
console.log(`  End time: ${newResult1.startTime + newResult1.duration}ms`);
const fitsInGap = newResult1.startTime === 3000 && newResult1.startTime + newResult1.duration === 4000;
console.log(`  Fits perfectly in gap? ${fitsInGap ? 'YES ✓' : 'NO ❌'}\n`);

// Test Case 2: Gap larger than item duration (should work normally)
console.log('Test 2: Gap larger than item duration');
const trackItems2: MediaItem[] = [
  { id: 'item-a', startTime: 0, duration: 3000 },
  { id: 'item-b', startTime: 8000, duration: 3000 }
];
const draggedItem2: MediaItem = { id: 'item-c', startTime: 0, duration: 3000 };
const requestedPos2 = 4500; // Gap is 5000ms: 3000-8000

console.log('Track items:');
console.log('  Item A: 0-3000ms');
console.log('  Item B: 8000-11000ms');
console.log('Gap: 3000-8000ms (size: 5000ms)');
console.log('Dragged item C: duration 3000ms');
console.log('Requested position: 4500ms\n');

const oldResult2 = getValidDragPositionOld(draggedItem2, requestedPos2, trackItems2);
console.log('OLD behavior:');
console.log(`  Position: ${oldResult2}ms`);
console.log(`  Duration: ${draggedItem2.duration}ms`);
console.log(`  End time: ${oldResult2 + draggedItem2.duration}ms`);
const fits2 = oldResult2 + draggedItem2.duration <= 8000;
console.log(`  Fits in gap? ${fits2 ? 'YES ✓' : 'NO ❌'}\n`);

const newResult2 = getValidDragPositionWithFitting(draggedItem2, requestedPos2, trackItems2);
console.log('NEW behavior:');
console.log(`  Position: ${newResult2.startTime}ms`);
console.log(`  Duration: ${newResult2.duration}ms`);
console.log(`  End time: ${newResult2.startTime + newResult2.duration}ms`);
const preservesDuration = newResult2.duration === draggedItem2.duration;
console.log(`  Preserves original duration? ${preservesDuration ? 'YES ✓' : 'NO ❌'}\n`);

// Test Case 3: Very small gap (should respect minimum duration)
console.log('Test 3: Very small gap (smaller than minimum duration)');
const trackItems3: MediaItem[] = [
  { id: 'item-a', startTime: 0, duration: 3000 },
  { id: 'item-b', startTime: 3050, duration: 3000 }
];
const draggedItem3: MediaItem = { id: 'item-c', startTime: 0, duration: 3000 };
const requestedPos3 = 3025; // Gap is only 50ms

console.log('Track items:');
console.log('  Item A: 0-3000ms');
console.log('  Item B: 3050-6050ms');
console.log('Gap: 3000-3050ms (size: 50ms, below minimum)');
console.log('Dragged item C: duration 3000ms');
console.log('Requested position: 3025ms\n');

const newResult3 = getValidDragPositionWithFitting(draggedItem3, requestedPos3, trackItems3);
console.log('NEW behavior:');
console.log(`  Position: ${newResult3.startTime}ms`);
console.log(`  Duration: ${newResult3.duration}ms`);
console.log(`  End time: ${newResult3.startTime + newResult3.duration}ms`);
const respectsMin = newResult3.duration >= 100;
console.log(`  Respects minimum duration (100ms)? ${respectsMin ? 'YES ✓' : 'NO ❌'}`);
console.log(`  Note: Item will overlap, but at minimum duration\n`);

// Test Case 4: Empty track
console.log('Test 4: Empty track');
const trackItems4: MediaItem[] = [];
const draggedItem4: MediaItem = { id: 'item-c', startTime: 0, duration: 3000 };
const requestedPos4 = 5000;

console.log('Track items: (empty)');
console.log('Dragged item C: duration 3000ms');
console.log('Requested position: 5000ms\n');

const newResult4 = getValidDragPositionWithFitting(draggedItem4, requestedPos4, trackItems4);
console.log('NEW behavior:');
console.log(`  Position: ${newResult4.startTime}ms`);
console.log(`  Duration: ${newResult4.duration}ms`);
console.log(`  Preserves original duration? ${newResult4.duration === 3000 ? 'YES ✓' : 'NO ❌'}\n`);

// Test Case 5: Dropping at the exact start of a gap
console.log('Test 5: Dropping at exact start of gap');
const trackItems5: MediaItem[] = [
  { id: 'item-a', startTime: 0, duration: 3000 },
  { id: 'item-b', startTime: 5000, duration: 3000 }
];
const draggedItem5: MediaItem = { id: 'item-c', startTime: 0, duration: 1500 };
const requestedPos5 = 3000; // Exact start of gap

console.log('Track items:');
console.log('  Item A: 0-3000ms');
console.log('  Item B: 5000-8000ms');
console.log('Gap: 3000-5000ms (size: 2000ms)');
console.log('Dragged item C: duration 1500ms');
console.log('Requested position: 3000ms (exact gap start)\n');

const newResult5 = getValidDragPositionWithFitting(draggedItem5, requestedPos5, trackItems5);
console.log('NEW behavior:');
console.log(`  Position: ${newResult5.startTime}ms`);
console.log(`  Duration: ${newResult5.duration}ms`);
console.log(`  End time: ${newResult5.startTime + newResult5.duration}ms`);
const correctPlacement = newResult5.startTime === 3000 && newResult5.duration === 1500;
console.log(`  Correct placement and duration? ${correctPlacement ? 'YES ✓' : 'NO ❌'}\n`);

console.log('=== Test Suite Complete ===');
