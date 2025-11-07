import { Injectable } from '@angular/core';
import { MediaItem } from '../models/timeline.models';

/**
 * Service responsible for handling drag-and-drop logic and timeline positioning
 * Extracted from timeline.component.ts for better code organization
 */
@Injectable({
  providedIn: 'root'
})
export class TimelineDragDropService {
  private readonly MIN_ITEM_DURATION = 100; // Minimum item duration in milliseconds

  constructor() { }

  /**
   * Check if two items overlap
   */
  itemsOverlap(item1: MediaItem, item2: MediaItem): boolean {
    const item1End = item1.startTime + item1.duration;
    const item2End = item2.startTime + item2.duration;
    return !(item1End <= item2.startTime || item2End <= item1.startTime);
  }

  /**
   * Finds the closest item to the given time position in the track
   * Returns null if no items exist in the track
   */
  findClosestItem(trackItems: MediaItem[], time: number): MediaItem | null {
    if (trackItems.length === 0) return null;

    let closestItem = trackItems[0];
    let minDistance = Math.abs(closestItem.startTime - time);

    for (const item of trackItems) {
      const itemEnd = item.startTime + item.duration;

      // Calculate distance to the start of the item
      const distanceToStart = Math.abs(item.startTime - time);

      // Calculate distance to the end of the item
      const distanceToEnd = Math.abs(itemEnd - time);

      // Use the minimum distance (to either start or end of item)
      const distance = Math.min(distanceToStart, distanceToEnd);

      if (distance < minDistance) {
        minDistance = distance;
        closestItem = item;
      }
    }

    return closestItem;
  }

  /**
   * Find all gaps in the track
   * Used for finding the closest gap when requested position overlaps an item
   */
  findAllGaps(trackItems: MediaItem[]): { gapStart: number; gapEnd: number; leftItem: MediaItem | null; rightItem: MediaItem | null }[] {
    const gaps: { gapStart: number; gapEnd: number; leftItem: MediaItem | null; rightItem: MediaItem | null }[] = [];
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
   * Used when the requested position overlaps an existing item
   */
  findClosestGap(
    requestedStartTime: number,
    gaps: { gapStart: number; gapEnd: number; leftItem: MediaItem | null; rightItem: MediaItem | null }[]
  ): { gapStart: number; gapEnd: number; leftItem: MediaItem | null; rightItem: MediaItem | null } {
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

  /**
   * Finds the gap where the requested position falls and returns gap boundaries
   * Returns null if the position doesn't fall in a valid gap
   */
  findGapForPosition(
    requestedStartTime: number,
    itemDuration: number,
    trackItems: MediaItem[]
  ): { gapStart: number; gapEnd: number; leftItem: MediaItem | null; rightItem: MediaItem | null } | null {
    const sortedItems = [...trackItems].sort((a, b) => a.startTime - b.startTime);

    // Empty track - infinite gap
    if (sortedItems.length === 0) {
      return { gapStart: 0, gapEnd: Infinity, leftItem: null, rightItem: null };
    }

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
   * Calculate valid drag position with automatic duration adjustment to fit gaps
   * Fixes issue #33: When dragging into a gap smaller than item duration,
   * adjust duration to fit instead of overlapping adjacent items
   * Fixes issue #36: When dragging overlaps an existing item, find the closest gap
   * instead of jumping to the end of the track
   * Fixes issue #38: Prevent overlaps by ensuring items always start at or after gap start
   * Fixes issue #48: Enforce strict totalDuration limit when dragging items
   */
  getValidDragPosition(
    item: MediaItem,
    requestedStartTime: number,
    trackItems: MediaItem[],
    totalDuration: number
  ): { startTime: number; duration: number } {
    const otherItems = trackItems.filter(i => i.id !== item.id);

    // Empty track - place at requested position with original duration
    // but ensure we don't exceed totalDuration
    if (otherItems.length === 0) {
      const startTime = Math.max(0, requestedStartTime);
      const maxDuration = totalDuration - startTime;
      return {
        startTime,
        duration: Math.min(item.duration, maxDuration)
      };
    }

    // Find which gap the requested position falls into
    let gap = this.findGapForPosition(requestedStartTime, item.duration, otherItems);

    if (!gap) {
      // Position overlaps an existing item
      // Fix for issue #36: Find the closest gap instead of jumping to end
      const allGaps = this.findAllGaps(otherItems);
      gap = this.findClosestGap(requestedStartTime, allGaps);
    }

    const gapSize = gap.gapEnd === Infinity ? Infinity : gap.gapEnd - gap.gapStart;

    // If gap is infinite (after last item), use original duration
    // Fix for issue #38: Ensure item starts at or after gap start to prevent overlap
    // Fix for issue #48: Respect totalDuration limit even in infinite gap
    if (gapSize === Infinity) {
      const startTime = Math.max(gap.gapStart, requestedStartTime);
      const maxDuration = totalDuration - startTime;
      return {
        startTime,
        duration: Math.min(item.duration, maxDuration)
      };
    }

    // If item fits completely in the gap, use original duration
    // Fix for issue #48: Also check totalDuration limit
    if (item.duration <= gapSize) {
      // Make sure the item doesn't go past the gap end
      const maxStartTime = gap.gapEnd - item.duration;
      const finalStartTime = Math.max(gap.gapStart, Math.min(requestedStartTime, maxStartTime));
      // Ensure we don't exceed totalDuration
      const maxDuration = totalDuration - finalStartTime;
      return {
        startTime: finalStartTime,
        duration: Math.min(item.duration, maxDuration)
      };
    }

    // Item doesn't fit - adjust duration to fit the gap
    // Respect minimum duration constraint
    // Fix for issue #48: Also respect totalDuration limit
    const maxDuration = totalDuration - gap.gapStart;
    const adjustedDuration = Math.max(this.MIN_ITEM_DURATION, Math.min(gapSize, maxDuration));

    return {
      startTime: gap.gapStart,
      duration: adjustedDuration
    };
  }

  /**
   * Get resize bounds for an item
   */
  getResizeBounds(
    item: MediaItem,
    trackItems: MediaItem[],
    edge: 'left' | 'right',
    totalDuration: number
  ): { minTime: number; maxTime: number } {
    const otherItems = trackItems.filter(i => i.id !== item.id)
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
      // Fix for issue #48: Respect totalDuration limit when resizing right edge
      const maxTime = rightItem ? Math.min(rightItem.startTime, totalDuration) : totalDuration;

      return { minTime, maxTime };
    }
  }

  /**
   * Calculate the start time for a new item based on playhead position and track items
   * Handles snapping to existing items and avoiding overlaps
   */
  calculateNewItemStartTime(
    playheadTime: number,
    trackItems: MediaItem[],
    snapProximityMs: number
  ): number {
    let startTime = 0;

    if (trackItems.length > 0) {
      // Find the closest item to the playhead
      const closestItem = this.findClosestItem(trackItems, playheadTime);

      if (closestItem) {
        const itemEnd = closestItem.startTime + closestItem.duration;
        const distanceToStart = Math.abs(closestItem.startTime - playheadTime);
        const distanceToEnd = Math.abs(itemEnd - playheadTime);

        // Check if playhead is close enough to snap
        if (distanceToEnd <= snapProximityMs) {
          // Snap to the end of the closest item
          startTime = itemEnd;
        } else if (distanceToStart <= snapProximityMs) {
          // Snap to the start of the closest item (place before it)
          // But we need to check if there's space before it
          const itemBefore = [...trackItems]
            .filter(item => item.startTime + item.duration <= closestItem.startTime)
            .sort((a, b) => a.startTime - b.startTime)
            .pop();

          if (itemBefore) {
            startTime = itemBefore.startTime + itemBefore.duration;
          } else if (closestItem.startTime === 0) {
            // Can't place before an item at position 0, place after the last item instead
            const sortedItems = [...trackItems].sort((a, b) => a.startTime - b.startTime);
            const lastItem = sortedItems[sortedItems.length - 1];
            startTime = lastItem.startTime + lastItem.duration;
          } else {
            startTime = 0;
          }
        } else {
          // Playhead is not close to any item, check if it overlaps with any item
          const overlappingItem = trackItems.find(item => {
            const itemStart = item.startTime;
            const itemEnd = item.startTime + item.duration;
            return playheadTime >= itemStart && playheadTime < itemEnd;
          });

          if (overlappingItem) {
            // Playhead overlaps with an item, place after the last item
            const sortedItems = [...trackItems].sort((a, b) => a.startTime - b.startTime);
            const lastItem = sortedItems[sortedItems.length - 1];
            startTime = lastItem.startTime + lastItem.duration;
          } else {
            // No overlap, place at playhead position
            startTime = playheadTime;
          }
        }
      } else {
        // No items in track, place at playhead position
        startTime = playheadTime;
      }
    } else {
      // Empty track, place at playhead position
      startTime = playheadTime;
    }

    return startTime;
  }

  /**
   * Validate and adjust item position to prevent overlaps
   * Returns adjusted start time if overlap is detected
   */
  validateItemPosition(
    item: MediaItem,
    trackItems: MediaItem[]
  ): number {
    // Check if the calculated position would cause overlap
    const hasOverlap = trackItems.some(existingItem => this.itemsOverlap(item, existingItem));

    if (hasOverlap) {
      // Find a non-overlapping position: place after the last item
      const sortedItems = [...trackItems].sort((a, b) => a.startTime - b.startTime);
      const lastItem = sortedItems[sortedItems.length - 1];
      return lastItem.startTime + lastItem.duration;
    }

    return item.startTime;
  }
}
