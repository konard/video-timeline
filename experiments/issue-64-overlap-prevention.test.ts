/**
 * Experiment: Test overlap prevention for issue #64
 *
 * This script tests that media items don't overlap when added to the timeline.
 * It simulates the addMediaItem logic with the fix.
 */

enum MediaType {
  VIDEO = 'video',
  AUDIO = 'audio',
  IMAGE = 'image'
}

interface MediaItem {
  id: string;
  type: MediaType;
  startTime: number;
  duration: number;
  trackId: string;
  name?: string;
  isPlaceholder?: boolean;
}

interface Track {
  id: string;
  name: string;
  order: number;
  items: MediaItem[];
}

const SNAP_PROXIMITY_MS = 500;

function itemsOverlap(item1: MediaItem, item2: MediaItem): boolean {
  const item1End = item1.startTime + item1.duration;
  const item2End = item2.startTime + item2.duration;
  return !(item1End <= item2.startTime || item2End <= item1.startTime);
}

function findClosestItem(trackItems: MediaItem[], time: number): MediaItem | null {
  if (trackItems.length === 0) return null;

  let closestItem = trackItems[0];
  let minDistance = Math.abs(closestItem.startTime - time);

  for (const item of trackItems) {
    const itemEnd = item.startTime + item.duration;
    const distanceToStart = Math.abs(item.startTime - time);
    const distanceToEnd = Math.abs(itemEnd - time);
    const distance = Math.min(distanceToStart, distanceToEnd);

    if (distance < minDistance) {
      minDistance = distance;
      closestItem = item;
    }
  }

  return closestItem;
}

function addMediaItem(
  type: MediaType,
  track: Track,
  playheadTime: number,
  totalDuration: number
): MediaItem {
  const newItemDuration = type === MediaType.IMAGE ? 5000 : 3000;
  let startTime = 0;

  if (track.items.length > 0) {
    const closestItem = findClosestItem(track.items, playheadTime);

    if (closestItem) {
      const itemEnd = closestItem.startTime + closestItem.duration;
      const distanceToStart = Math.abs(closestItem.startTime - playheadTime);
      const distanceToEnd = Math.abs(itemEnd - playheadTime);

      if (distanceToEnd <= SNAP_PROXIMITY_MS) {
        startTime = itemEnd;
      } else if (distanceToStart <= SNAP_PROXIMITY_MS) {
        const itemBefore = [...track.items]
          .filter(item => item.startTime + item.duration <= closestItem.startTime)
          .sort((a, b) => a.startTime - b.startTime)
          .pop();

        if (itemBefore) {
          startTime = itemBefore.startTime + itemBefore.duration;
        } else if (closestItem.startTime === 0) {
          const sortedItems = [...track.items].sort((a, b) => a.startTime - b.startTime);
          const lastItem = sortedItems[sortedItems.length - 1];
          startTime = lastItem.startTime + lastItem.duration;
        } else {
          startTime = 0;
        }
      } else {
        const overlappingItem = track.items.find(item => {
          const itemStart = item.startTime;
          const itemEnd = item.startTime + item.duration;
          return playheadTime >= itemStart && playheadTime < itemEnd;
        });

        if (overlappingItem) {
          const sortedItems = [...track.items].sort((a, b) => a.startTime - b.startTime);
          const lastItem = sortedItems[sortedItems.length - 1];
          startTime = lastItem.startTime + lastItem.duration;
        } else {
          startTime = playheadTime;
        }
      }
    } else {
      startTime = playheadTime;
    }
  } else {
    startTime = playheadTime;
  }

  const maxAllowedDuration = totalDuration - startTime;
  const finalDuration = Math.min(newItemDuration, maxAllowedDuration);

  // Fix for issue #64: Verify that the new item doesn't overlap
  const testItem: MediaItem = {
    id: 'temp',
    type,
    startTime,
    duration: finalDuration,
    trackId: track.id,
    name: '',
    isPlaceholder: true
  };

  const hasOverlap = track.items.some(item => itemsOverlap(testItem, item));

  if (hasOverlap) {
    // Place after the last item
    const sortedItems = [...track.items].sort((a, b) => a.startTime - b.startTime);
    const lastItem = sortedItems[sortedItems.length - 1];
    startTime = lastItem.startTime + lastItem.duration;

    const newMaxAllowedDuration = totalDuration - startTime;
    const adjustedDuration = Math.min(newItemDuration, newMaxAllowedDuration);

    return {
      id: `item-${Date.now()}-${Math.random()}`,
      type,
      startTime,
      duration: adjustedDuration,
      trackId: track.id,
      name: `${type} placeholder`,
      isPlaceholder: true
    };
  } else {
    return {
      id: `item-${Date.now()}-${Math.random()}`,
      type,
      startTime,
      duration: finalDuration,
      trackId: track.id,
      name: `${type} placeholder`,
      isPlaceholder: true
    };
  }
}

// Test scenarios
console.log('=== Issue #64: Overlap Prevention Tests ===\n');

// Test 1: Adding item that would overlap due to snap
console.log('Test 1: Item snaps to end of first item, which would overlap with second item');
const track1: Track = {
  id: 'track-1',
  name: 'Track 1',
  order: 0,
  items: [
    { id: 'a', type: MediaType.VIDEO, startTime: 0, duration: 5000, trackId: 'track-1' },
    { id: 'b', type: MediaType.VIDEO, startTime: 6000, duration: 3000, trackId: 'track-1' }
  ]
};

console.log('Existing items:');
console.log('  Item A: 0-5000ms (VIDEO)');
console.log('  Item B: 6000-9000ms (VIDEO)');
console.log('Adding new VIDEO item (3000ms) with playhead at 5200ms');
console.log('Expected: Snap to 5000ms would create overlap (5000-8000ms overlaps with B)');
console.log('Should place after B at 9000ms instead\n');

const newItem1 = addMediaItem(MediaType.VIDEO, track1, 5200, 30000);
console.log(`Result: New item placed at ${newItem1.startTime}ms with duration ${newItem1.duration}ms`);
console.log(`Item range: ${newItem1.startTime}-${newItem1.startTime + newItem1.duration}ms`);

// Verify no overlaps
let hasOverlaps = false;
for (const existingItem of track1.items) {
  if (itemsOverlap(newItem1, existingItem)) {
    console.log(`❌ OVERLAP DETECTED with item ${existingItem.id}!`);
    hasOverlaps = true;
  }
}
if (!hasOverlaps) {
  console.log('✓ No overlaps detected');
}
console.log('');

// Test 2: Adding multiple items quickly
console.log('Test 2: Adding multiple items in succession');
const track2: Track = {
  id: 'track-2',
  name: 'Track 2',
  order: 0,
  items: []
};

console.log('Starting with empty track, adding 3 items at playhead position 1000ms\n');

const item1 = addMediaItem(MediaType.VIDEO, track2, 1000, 30000);
track2.items.push(item1);
console.log(`Item 1: ${item1.startTime}-${item1.startTime + item1.duration}ms`);

const item2 = addMediaItem(MediaType.AUDIO, track2, 1000, 30000);
track2.items.push(item2);
console.log(`Item 2: ${item2.startTime}-${item2.startTime + item2.duration}ms`);

const item3 = addMediaItem(MediaType.IMAGE, track2, 1000, 30000);
track2.items.push(item3);
console.log(`Item 3: ${item3.startTime}-${item3.startTime + item3.duration}ms`);

// Verify no overlaps between any items
console.log('\nChecking for overlaps:');
let hasAnyOverlap = false;
const allItems = track2.items;
for (let i = 0; i < allItems.length; i++) {
  for (let j = i + 1; j < allItems.length; j++) {
    if (itemsOverlap(allItems[i], allItems[j])) {
      console.log(`❌ OVERLAP between item ${i + 1} and item ${j + 1}!`);
      hasAnyOverlap = true;
    }
  }
}
if (!hasAnyOverlap) {
  console.log('✓ No overlaps between any items');
}
console.log('');

// Test 3: Edge case - playhead exactly at item boundary
console.log('Test 3: Playhead exactly at item boundary');
const track3: Track = {
  id: 'track-3',
  name: 'Track 3',
  order: 0,
  items: [
    { id: 'x', type: MediaType.VIDEO, startTime: 0, duration: 5000, trackId: 'track-3' }
  ]
};

console.log('Existing: Item X at 0-5000ms');
console.log('Adding new item with playhead exactly at 5000ms (item boundary)\n');

const newItem3 = addMediaItem(MediaType.VIDEO, track3, 5000, 30000);
console.log(`Result: ${newItem3.startTime}-${newItem3.startTime + newItem3.duration}ms`);

if (itemsOverlap(newItem3, track3.items[0])) {
  console.log('❌ OVERLAP with existing item!');
} else {
  console.log('✓ No overlap');
}
console.log('');

console.log('=== All tests completed ===');
