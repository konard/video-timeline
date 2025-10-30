/**
 * Experiment: Test collision detection logic for media items
 *
 * This script tests various scenarios for detecting overlaps between media items
 * on a timeline to prevent placeholders from overlapping.
 */

interface MediaItem {
  id: string;
  startTime: number;
  duration: number;
}

/**
 * Check if two media items overlap on the timeline
 */
function itemsOverlap(item1: MediaItem, item2: MediaItem): boolean {
  const item1End = item1.startTime + item1.duration;
  const item2End = item2.startTime + item2.duration;

  return !(item1End <= item2.startTime || item2End <= item1.startTime);
}

/**
 * Find the best position for a new item to avoid overlaps
 */
function findNonOverlappingPosition(
  newItem: MediaItem,
  existingItems: MediaItem[]
): number {
  if (existingItems.length === 0) {
    return newItem.startTime;
  }

  // Sort items by start time
  const sortedItems = [...existingItems].sort((a, b) => a.startTime - b.startTime);

  // Try the requested position first
  let testItem = { ...newItem };
  let hasOverlap = existingItems.some(item => itemsOverlap(testItem, item));

  if (!hasOverlap) {
    return newItem.startTime;
  }

  // Find the last item and place after it
  const lastItem = sortedItems[sortedItems.length - 1];
  return lastItem.startTime + lastItem.duration;
}

/**
 * Get valid bounds for resizing an item without overlapping neighbors
 */
function getResizeBounds(
  item: MediaItem,
  items: MediaItem[],
  edge: 'left' | 'right'
): { minTime: number; maxTime: number } {
  const otherItems = items.filter(i => i.id !== item.id)
    .sort((a, b) => a.startTime - b.startTime);

  if (edge === 'left') {
    // Find item to the left
    const leftItem = otherItems
      .filter(i => i.startTime + i.duration <= item.startTime)
      .pop();

    const minTime = leftItem ? leftItem.startTime + leftItem.duration : 0;
    const maxTime = item.startTime + item.duration - 100; // Keep minimum duration

    return { minTime, maxTime };
  } else {
    // Find item to the right
    const rightItem = otherItems
      .find(i => i.startTime >= item.startTime + item.duration);

    const minTime = item.startTime + 100; // Minimum duration
    const maxTime = rightItem ? rightItem.startTime : Infinity;

    return { minTime, maxTime };
  }
}

/**
 * Adjust drag position to prevent overlap
 */
function getValidDragPosition(
  item: MediaItem,
  newStartTime: number,
  items: MediaItem[]
): number {
  const otherItems = items.filter(i => i.id !== item.id);
  const testItem = { ...item, startTime: newStartTime };

  // Check for overlaps
  for (const other of otherItems) {
    if (itemsOverlap(testItem, other)) {
      // Snap to nearest non-overlapping position
      const itemEnd = item.startTime + item.duration;
      const otherEnd = other.startTime + other.duration;

      if (newStartTime < other.startTime) {
        // Moving left, snap to left of other item
        return Math.max(0, other.startTime - item.duration);
      } else {
        // Moving right, snap to right of other item
        return otherEnd;
      }
    }
  }

  return Math.max(0, newStartTime);
}

// Test scenarios
console.log('=== Collision Detection Tests ===\n');

// Test 1: No overlap
console.log('Test 1: Items do not overlap');
const item1: MediaItem = { id: '1', startTime: 0, duration: 5000 };
const item2: MediaItem = { id: '2', startTime: 6000, duration: 3000 };
console.log('Item 1:', item1);
console.log('Item 2:', item2);
console.log('Overlap:', itemsOverlap(item1, item2)); // Should be false
console.log('');

// Test 2: Complete overlap
console.log('Test 2: Items completely overlap');
const item3: MediaItem = { id: '3', startTime: 1000, duration: 5000 };
const item4: MediaItem = { id: '4', startTime: 2000, duration: 2000 };
console.log('Item 3:', item3);
console.log('Item 4:', item4);
console.log('Overlap:', itemsOverlap(item3, item4)); // Should be true
console.log('');

// Test 3: Partial overlap
console.log('Test 3: Items partially overlap');
const item5: MediaItem = { id: '5', startTime: 1000, duration: 3000 };
const item6: MediaItem = { id: '6', startTime: 3000, duration: 3000 };
console.log('Item 5:', item5);
console.log('Item 6:', item6);
console.log('Overlap:', itemsOverlap(item5, item6)); // Should be true
console.log('');

// Test 4: Find non-overlapping position
console.log('Test 4: Find non-overlapping position for new item');
const existingItems: MediaItem[] = [
  { id: 'a', startTime: 0, duration: 5000 },
  { id: 'b', startTime: 6000, duration: 3000 }
];
const newItem: MediaItem = { id: 'new', startTime: 4000, duration: 3000 };
console.log('Existing items:', existingItems);
console.log('New item (requested position):', newItem);
const bestPosition = findNonOverlappingPosition(newItem, existingItems);
console.log('Best position:', bestPosition, 'ms'); // Should be 9000 (after last item)
console.log('');

// Test 5: Resize bounds (left edge)
console.log('Test 5: Get resize bounds for left edge');
const items: MediaItem[] = [
  { id: '1', startTime: 0, duration: 3000 },
  { id: '2', startTime: 5000, duration: 4000 },
  { id: '3', startTime: 10000, duration: 3000 }
];
const itemToResize = items[1];
console.log('Items:', items);
console.log('Resizing item:', itemToResize);
const leftBounds = getResizeBounds(itemToResize, items, 'left');
console.log('Left edge bounds:', leftBounds); // minTime should be 3000
console.log('');

// Test 6: Resize bounds (right edge)
console.log('Test 6: Get resize bounds for right edge');
const rightBounds = getResizeBounds(itemToResize, items, 'right');
console.log('Right edge bounds:', rightBounds); // maxTime should be 10000
console.log('');

// Test 7: Valid drag position
console.log('Test 7: Get valid drag position');
const dragItems: MediaItem[] = [
  { id: '1', startTime: 0, duration: 3000 },
  { id: '2', startTime: 5000, duration: 4000 }
];
const dragItem = dragItems[0];
console.log('Items:', dragItems);
console.log('Dragging item:', dragItem);
const validPos1 = getValidDragPosition(dragItem, 4000, dragItems);
console.log('Requested position: 4000, Valid position:', validPos1); // Should snap to 5000
const validPos2 = getValidDragPosition(dragItem, 1000, dragItems);
console.log('Requested position: 1000, Valid position:', validPos2); // Should stay at 1000
console.log('');

console.log('=== All tests completed ===');
