/**
 * Verify overlap detection
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

console.log('Testing overlap detection:\n');

const itemA: MediaItem = { id: 'a', startTime: 0, duration: 5000 };
const itemC1: MediaItem = { id: 'c', startTime: 3000, duration: 3000 };

console.log('Item A: 0-5000ms');
console.log('Item C: 3000-6000ms');
console.log(`Overlap? ${itemsOverlap(itemA, itemC1) ? 'YES ❌' : 'NO ✓'}`);
console.log('Expected: YES (they overlap from 3000-5000ms)\n');

const itemB: MediaItem = { id: 'b', startTime: 6000, duration: 5000 };
console.log('Item B: 6000-11000ms');
console.log('Item C: 3000-6000ms');
console.log(`Overlap? ${itemsOverlap(itemB, itemC1) ? 'YES ❌' : 'NO ✓'}`);
console.log('Expected: NO (C ends exactly where B starts)');
