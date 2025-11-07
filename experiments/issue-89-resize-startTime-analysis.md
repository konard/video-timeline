# Issue #89: При изменении размера медиа от начала - изменять startTime

## Issue Translation
"When resizing media from the beginning - change startTime. At the same time, take into account the limitation when resizing from the right - this is the limitation of the full length (take into account startTime)."

## Current Implementation Analysis

### Data Model (timeline.models.ts)
```typescript
export interface MediaItem {
  id: string;
  type: MediaType;
  startTime: number;     // Timeline position in milliseconds
  duration: number;      // Clip duration in milliseconds
  maxDuration?: number;  // Maximum available duration (for placeholders)
  trackId: string;
  name?: string;
  isPlaceholder?: boolean;
}
```

### Left Edge Resize (timeline.component.ts:316-346)

**Current behavior:**
```typescript
if (this.resizingItem!.edge === 'left') {
  // Calculate new start time with bounds and snapping
  let newStartTime = Math.max(
    bounds.minTime,
    Math.min(timeAtCursor, bounds.maxTime)
  );

  // Apply snapping logic...

  // Calculate new duration
  const newDuration = i.duration + (i.startTime - newStartTime);

  // Apply maxDuration constraint
  const limitedDuration = i.maxDuration
    ? Math.min(newDuration, i.maxDuration)
    : newDuration;

  // Adjust startTime if duration was limited
  const adjustedStartTime = i.startTime + i.duration - limitedDuration;

  return { ...i, startTime: adjustedStartTime, duration: limitedDuration };
}
```

**Analysis:**
- ✅ DOES change startTime
- ✅ Correctly calculates new duration based on startTime change
- ✅ Applies maxDuration constraint
- ⚠️ Adjusts startTime back when maxDuration is exceeded

**Behavior Example:**
- Initial state: startTime=1000ms, duration=2000ms, maxDuration=3000ms
- User drags left edge from 1000ms to 500ms
- Expected newDuration: 2000 + (1000 - 500) = 2500ms
- Limited duration: min(2500, 3000) = 2500ms ✅ (within limit)
- Final: startTime=500ms, duration=2500ms ✅

**Edge case:**
- Initial state: startTime=1000ms, duration=2500ms, maxDuration=3000ms
- User drags left edge from 1000ms to 0ms
- Expected newDuration: 2500 + (1000 - 0) = 3500ms
- Limited duration: min(3500, 3000) = 3000ms (hit the limit)
- Adjusted startTime: 1000 + 2500 - 3000 = 500ms
- Final: startTime=500ms, duration=3000ms

**Question:** Is this adjustment correct? Should we prevent dragging beyond maxDuration, or allow it but adjust startTime?

### Right Edge Resize (timeline.component.ts:347-374)

**Current behavior:**
```typescript
else { // right edge
  // Calculate new end time with bounds and snapping
  let newEndTime = Math.max(
    bounds.minTime,
    Math.min(timeAtCursor, bounds.maxTime)
  );

  // Apply snapping logic...

  // Calculate new duration
  const newDuration = newEndTime - i.startTime;

  // Apply maxDuration constraint
  const limitedDuration = i.maxDuration
    ? Math.min(newDuration, i.maxDuration)
    : newDuration;

  return { ...i, duration: limitedDuration };
}
```

**Analysis:**
- ✅ Correctly calculates duration as `newEndTime - i.startTime`
- ✅ This DOES account for startTime in the calculation
- ✅ Applies maxDuration constraint
- ✅ Does NOT change startTime (correct for right edge)

### Resize Bounds (timeline-drag-drop.service.ts:340-370)

**Left edge bounds:**
```typescript
const minTime = leftItem ? leftItem.startTime + leftItem.duration : 0;
const maxTime = item.startTime + item.duration - 100; // Keep minimum 100ms duration
```

**Right edge bounds:**
```typescript
const minTime = item.startTime + 100; // Minimum 100ms duration
const maxTime = rightItem ? Math.min(rightItem.startTime, totalDuration) : totalDuration;
```

**Issue:** Right edge bounds do NOT consider maxDuration!

If an item has:
- startTime = 1000ms
- duration = 2000ms
- maxDuration = 3000ms
- rightItem.startTime = 10000ms

Current maxTime for right edge: min(10000, totalDuration) = 10000ms
Allowed newDuration: 10000 - 1000 = 9000ms

But this exceeds maxDuration (3000ms)! The maxDuration constraint is applied later in the resize handler, but the bounds calculation allows the user to drag much further than they should be able to.

## Problem Identified

The issue is in the `getResizeBounds()` function for the right edge. It should consider `maxDuration` when calculating the maximum bound:

**Current:**
```typescript
const maxTime = rightItem ? Math.min(rightItem.startTime, totalDuration) : totalDuration;
```

**Should be:**
```typescript
// Calculate maximum time considering maxDuration
const maxTimeBasedOnDuration = item.maxDuration
  ? item.startTime + item.maxDuration
  : Infinity;

const maxTime = Math.min(
  rightItem ? rightItem.startTime : totalDuration,
  totalDuration,
  maxTimeBasedOnDuration
);
```

This ensures that when resizing from the right, the user cannot drag beyond the maxDuration limit, taking into account the current startTime position.

## Solution

Modify `getResizeBounds()` in `timeline-drag-drop.service.ts` to account for `maxDuration` when calculating right edge bounds.

## Test Scenarios

### Scenario 1: Right resize without adjacent items
- Item: startTime=1000ms, duration=2000ms, maxDuration=3000ms
- No right adjacent item
- totalDuration=10000ms
- Expected maxTime: min(10000, 1000+3000) = 4000ms ✅
- User can resize up to 4000ms (duration becomes 3000ms)

### Scenario 2: Right resize with adjacent items
- Item: startTime=1000ms, duration=2000ms, maxDuration=5000ms
- Right adjacent item at startTime=5000ms
- Expected maxTime: min(5000, 1000+5000, 10000) = 5000ms ✅
- User can resize up to 5000ms (duration becomes 4000ms, within maxDuration)

### Scenario 3: Right resize when maxDuration is the limiting factor
- Item: startTime=1000ms, duration=2000ms, maxDuration=2500ms
- Right adjacent item at startTime=10000ms
- Expected maxTime: min(10000, 1000+2500, totalDuration) = 3500ms ✅
- User can resize up to 3500ms (duration becomes 2500ms, at maxDuration limit)

### Scenario 4: Left resize should still work correctly
- Item: startTime=1000ms, duration=2000ms, maxDuration=3000ms
- User drags left edge to 500ms
- Expected: startTime=500ms, duration=2500ms ✅
- Current implementation handles this correctly

## Additional Considerations

### Should maxDuration be enforced strictly in bounds?

**Option A (Proposed):** Include maxDuration in bounds calculation
- Prevents user from dragging beyond limit
- More intuitive UX - cursor stops at the limit
- Consistent with how adjacent item collisions work

**Option B (Current):** Apply maxDuration as a post-processing constraint
- Allows user to drag beyond limit, but duration is clamped
- Can feel "mushy" or confusing - cursor moves but nothing happens

**Recommendation:** Option A is better for UX consistency.

### What about left edge resize maxDuration?

The current left edge implementation adjusts startTime when maxDuration is exceeded:
```typescript
const adjustedStartTime = i.startTime + i.duration - limitedDuration;
```

This is actually correct! It maintains the END position of the clip while limiting how far back you can extend the start. This is standard video editing behavior.

## Conclusion

The issue #89 is asking for:
1. ✅ Left edge resize should change startTime - **Already implemented correctly**
2. ⚠️ Right edge resize bounds should account for maxDuration relative to startTime - **Needs fix**

The fix is straightforward: update `getResizeBounds()` to include maxDuration in the right edge bounds calculation.
