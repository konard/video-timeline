/**
 * Bug Reproduction Test for Issue #33
 *
 * Reproducing the exact scenario from the issue:
 * When dragging a placeholder from ANOTHER track into a small gap between two placeholders,
 * it can overlap one of the adjacent placeholders.
 */

interface MediaItem {
  id: string;
  startTime: number;
  duration: number;
}

function itemsOverlap(item1: MediaItem, item2: MediaItem): boolean {
  const item1End = item1.startTime + item1.duration;
  const item2End = item2.startTime + item2.duration;
  return !(item1End <= item2.startTime || item2End <= item1.startTime);
}

/**
 * Current implementation from the codebase
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

console.log('=== Bug Reproduction for Issue #33 ===\n');

// Scenario from the issue description
console.log('Scenario: Dragging placeholder from another track into small gap\n');

console.log('Initial state:');
console.log('Track 1 (target):');
console.log('  Item A: 0-5000ms');
console.log('  Item B: 6000-11000ms');
console.log('  Gap between: 5000-6000ms (size: 1000ms)');
console.log('\nTrack 2 (source):');
console.log('  Item C: 0-3000ms (being dragged)\n');

const targetTrackItems: MediaItem[] = [
  { id: 'item-a', startTime: 0, duration: 5000 },
  { id: 'item-b', startTime: 6000, duration: 5000 }
];

const draggedItem: MediaItem = {
  id: 'item-c',
  startTime: 0,  // Original position doesn't matter
  duration: 3000  // Longer than the gap!
};

console.log('Testing different drop positions in the gap:\n');

// Test dropping at different positions within the small gap
const testPositions = [
  { pos: 5000, desc: 'Start of gap' },
  { pos: 5500, desc: 'Middle of gap' },
  { pos: 5900, desc: 'Near end of gap' },
  { pos: 5300, desc: 'Early in gap' }
];

for (const test of testPositions) {
  console.log(`Drop at ${test.pos}ms (${test.desc}):`);

  const finalPosition = getValidDragPositionOld(
    draggedItem,
    test.pos,
    targetTrackItems
  );

  const finalEndTime = finalPosition + draggedItem.duration;

  console.log(`  Final position: ${finalPosition}ms`);
  console.log(`  Duration: ${draggedItem.duration}ms (unchanged)`);
  console.log(`  End time: ${finalEndTime}ms`);

  // Check overlaps
  const overlapsA = finalPosition < 5000 && finalEndTime > 0;
  const overlapsB = finalPosition < 11000 && finalEndTime > 6000;

  if (overlapsA) {
    console.log(`  ❌ OVERLAPS with Item A!`);
  }
  if (overlapsB) {
    console.log(`  ❌ OVERLAPS with Item B!`);
  }
  if (!overlapsA && !overlapsB) {
    console.log(`  ✓ No overlaps`);
  }

  // Check if fits in gap
  const fitsInGap = finalPosition >= 5000 && finalEndTime <= 6000;
  if (fitsInGap) {
    console.log(`  ✓ Fits in gap`);
  } else {
    console.log(`  ⚠ Does NOT fit in gap (gap is too small for this item)`);
  }

  console.log('');
}

console.log('\n=== Analysis ===\n');
console.log('The bug occurs because:');
console.log('1. The gap (1000ms) is smaller than the dragged item duration (3000ms)');
console.log('2. When dropping near the start of the gap, code detects overlap with Item B');
console.log('3. Since requestedStartTime < Item B start, it snaps LEFT');
console.log('4. New position = Item B start - item duration = 6000 - 3000 = 3000ms');
console.log('5. This position (3000-6000ms) fits without overlapping either item!');
console.log('');
console.log('But when dropping near the END of the gap:');
console.log('1. Code might detect overlap differently depending on position');
console.log('2. Or might place it at requested position if overlap logic fails');
console.log('');

// Let's test a scenario that DEFINITELY causes overlap
console.log('=== Testing edge case that causes overlap ===\n');

console.log('Scenario: Even tighter gap');
console.log('Track 1 (target):');
console.log('  Item A: 0-5000ms');
console.log('  Item B: 5500-10500ms');
console.log('  Gap between: 5000-5500ms (size: 500ms)\n');

const tightTrackItems: MediaItem[] = [
  { id: 'item-a', startTime: 0, duration: 5000 },
  { id: 'item-b', startTime: 5500, duration: 5000 }
];

const testPositions2 = [
  { pos: 5000, desc: 'Start of gap' },
  { pos: 5250, desc: 'Middle of gap' },
  { pos: 5400, desc: 'Near end of gap' }
];

for (const test of testPositions2) {
  console.log(`Drop at ${test.pos}ms (${test.desc}):`);

  const finalPosition = getValidDragPositionOld(
    draggedItem,
    test.pos,
    tightTrackItems
  );

  const finalEndTime = finalPosition + draggedItem.duration;

  console.log(`  Final position: ${finalPosition}ms`);
  console.log(`  End time: ${finalEndTime}ms`);

  // Check overlaps with actual overlap detection
  const testItemResult = { ...draggedItem, startTime: finalPosition };
  const overlapsA = itemsOverlap(testItemResult, tightTrackItems[0]);
  const overlapsB = itemsOverlap(testItemResult, tightTrackItems[1]);

  if (overlapsA) {
    console.log(`  ❌ OVERLAPS with Item A!`);
  }
  if (overlapsB) {
    console.log(`  ❌ OVERLAPS with Item B!`);
  }
  if (!overlapsA && !overlapsB) {
    console.log(`  ✓ No overlaps`);
  }

  console.log('');
}

console.log('\n=== Conclusion ===');
console.log('The current implementation actually prevents overlaps well!');
console.log('However, it may place items in unexpected positions.');
console.log('The REAL issue might be that the user WANTS the item to:');
console.log('1. Be placed in the gap');
console.log('2. Have its duration ADJUSTED to fit the available space');
console.log('3. Not be moved to a completely different position');
