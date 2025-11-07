# Issue #89: Understanding Media Trimming with startTime

## Problem Analysis

### Current Issue
According to andchir's comment:
> "If the clip is already stretched to full length and I reduce from the left side, then it shouldn't reduce from the right, because the clip is trimmed from the beginning."

### What This Means

In professional video editing software (like Premiere, Final Cut, DaVinci Resolve), when you have a media clip, there are TWO different concepts:

1. **Timeline Position (`startTime`)**: Where the clip appears on the timeline
2. **Media Trim (`mediaStartTime` or `in-point`)**: Where in the SOURCE media we start playing from

### Example Scenario

Imagine you have a 10-second video file:

**Initial State:**
- Source video: 0s to 10s (maxDuration = 10000ms)
- Timeline position (startTime): 2000ms
- Duration shown: 10000ms (full video)
- Media start (trim): 0ms (showing from beginning of source)
- Media end: 0 + 10000 = 10000ms (showing until end of source)

**After trimming 3 seconds from the left edge:**
- User drags left edge from 2000ms to 5000ms
- Timeline position (startTime): 5000ms ← changed
- Duration shown: 7000ms ← reduced
- Media start (trim): 3000ms ← **THIS IS MISSING IN CURRENT MODEL**
- Media end: 3000 + 7000 = 10000ms (still showing until end of source)

**The key insight:** When you trim from the left, you're saying "I want to start showing this video from 3 seconds in, not from the beginning."

### Current Implementation Problem

Looking at the current `MediaItem` interface:

```typescript
export interface MediaItem {
  id: string;
  type: MediaType;
  startTime: number;     // Timeline position ✅
  duration: number;      // Duration on timeline ✅
  maxDuration?: number;  // Maximum available duration ✅
  trackId: string;
  name?: string;
  isPlaceholder?: boolean;
  // ❌ MISSING: mediaStartTime - offset into source media
}
```

Without `mediaStartTime`, we can't distinguish between:
- A 5-second clip showing seconds 0-5 of a 10-second video
- A 5-second clip showing seconds 5-10 of a 10-second video

### Why the Current Fix Doesn't Work

The current implementation in timeline.component.ts (lines 336-346):

```typescript
const newDuration = i.duration + (i.startTime - newStartTime);

const limitedDuration = i.maxDuration
  ? Math.min(newDuration, i.maxDuration)
  : newDuration;

const adjustedStartTime = i.startTime + i.duration - limitedDuration;

return { ...i, startTime: adjustedStartTime, duration: limitedDuration };
```

**Problem:** When `limitedDuration` hits `maxDuration`, it adjusts `startTime` backwards:
```
adjustedStartTime = i.startTime + i.duration - limitedDuration
```

This means if you try to trim from the left when already at maxDuration, it prevents the change entirely!

**Example:**
- Initial: startTime=2000, duration=10000, maxDuration=10000
- User drags left from 2000 to 5000 (wants to trim 3 seconds from beginning)
- newDuration = 10000 + (2000 - 5000) = 7000ms
- limitedDuration = min(7000, 10000) = 7000ms
- adjustedStartTime = 2000 + 10000 - 7000 = 5000ms ✅
- Result: startTime=5000, duration=7000

This DOES work for the timeline position, but:
- ❌ We don't track that we should now start playing from 3 seconds into the source media
- ❌ When resizing from the right, we don't know the limit should be (mediaStartTime + duration) ≤ maxDuration

**The REAL problem scenario andchir described:**

- Initial: startTime=2000, duration=10000, maxDuration=10000, **mediaStartTime=0**
- User trims 3s from left: startTime=5000, duration=7000, **mediaStartTime=3000**
- Now user tries to extend right edge: should only be able to extend 3000ms (to reach maxDuration again)
- But current code doesn't know about mediaStartTime, so it thinks it can extend all the way to maxDuration=10000!

## Solution

### 1. Add `mediaStartTime` property to MediaItem

```typescript
export interface MediaItem {
  id: string;
  type: MediaType;
  startTime: number;        // Timeline position in ms
  duration: number;         // Duration on timeline in ms
  mediaStartTime?: number;  // Offset into source media in ms (default: 0)
  maxDuration?: number;     // Maximum available duration in ms
  trackId: string;
  name?: string;
  isPlaceholder?: boolean;
}
```

### 2. Update Left Edge Resize Logic

When dragging the left edge:

```typescript
if (this.resizingItem!.edge === 'left') {
  let newStartTime = Math.max(bounds.minTime, Math.min(timeAtCursor, bounds.maxTime));

  // Apply snapping...

  const deltaTime = newStartTime - i.startTime;
  const newDuration = i.duration - deltaTime;

  // Calculate new media start time (how much we're trimming)
  const currentMediaStartTime = i.mediaStartTime || 0;
  const newMediaStartTime = currentMediaStartTime - deltaTime;

  // Ensure mediaStartTime doesn't go negative
  const clampedMediaStartTime = Math.max(0, newMediaStartTime);

  // Adjust the actual startTime if mediaStartTime was clamped
  const actualDeltaTime = currentMediaStartTime - clampedMediaStartTime;
  const finalStartTime = i.startTime - actualDeltaTime;
  const finalDuration = i.duration + actualDeltaTime;

  // Ensure we don't exceed maxDuration
  const finalMediaEnd = clampedMediaStartTime + finalDuration;
  if (i.maxDuration && finalMediaEnd > i.maxDuration) {
    const excessDuration = finalMediaEnd - i.maxDuration;
    return {
      ...i,
      startTime: finalStartTime,
      duration: finalDuration - excessDuration,
      mediaStartTime: clampedMediaStartTime
    };
  }

  return {
    ...i,
    startTime: finalStartTime,
    duration: finalDuration,
    mediaStartTime: clampedMediaStartTime
  };
}
```

### 3. Update Right Edge Resize Bounds

The bounds calculation needs to consider mediaStartTime:

```typescript
// Right edge bounds
const minTime = item.startTime + 100; // Minimum duration

const currentMediaStartTime = item.mediaStartTime || 0;
const remainingMediaDuration = item.maxDuration
  ? item.maxDuration - currentMediaStartTime
  : Infinity;

const maxTimeBasedOnMaxDuration = item.maxDuration
  ? item.startTime + remainingMediaDuration
  : Infinity;

const maxTime = Math.min(
  rightItem ? rightItem.startTime : totalDuration,
  totalDuration,
  maxTimeBasedOnMaxDuration
);
```

### 4. Update Left Edge Resize Bounds

Similarly for left edge:

```typescript
// Left edge bounds
const minTime = leftItem ? leftItem.startTime + leftItem.duration : 0;

const currentMediaStartTime = item.mediaStartTime || 0;
const maxTimeForMinDuration = item.startTime + item.duration - 100;

// Calculate how far left we can go based on available media before current trim point
const maxTimeBasedOnMediaStart = item.startTime - currentMediaStartTime;

const maxTime = Math.max(maxTimeForMinDuration, maxTimeBasedOnMediaStart);
```

## Test Scenarios

### Scenario 1: Trim from left when at full duration
- Initial: startTime=2000, duration=10000, mediaStartTime=0, maxDuration=10000
- Action: Drag left edge from 2000 to 5000
- Expected:
  - startTime=5000 ✅
  - duration=7000 ✅
  - mediaStartTime=3000 ✅ (trimmed 3 seconds from beginning)
- Media playback: Shows source from 3000ms to 10000ms

### Scenario 2: Extend right after trimming from left
- Initial: startTime=5000, duration=7000, mediaStartTime=3000, maxDuration=10000
- Action: Drag right edge from 12000 to 15000
- Expected maxTime: 5000 + (10000 - 3000) = 12000ms ✅ (can't exceed source)
- Result:
  - startTime=5000
  - duration=7000 (unchanged, already at limit)
  - mediaStartTime=3000

### Scenario 3: Extend left to show earlier content
- Initial: startTime=5000, duration=7000, mediaStartTime=3000, maxDuration=10000
- Action: Drag left edge from 5000 to 2000
- Expected:
  - startTime=2000 ✅
  - duration=10000 ✅
  - mediaStartTime=0 ✅ (showing from beginning again)

### Scenario 4: Try to extend left beyond source start
- Initial: startTime=5000, duration=7000, mediaStartTime=3000, maxDuration=10000
- Action: Drag left edge from 5000 to 0 (trying to go 5000ms left)
- Available media before trim: 3000ms
- Expected:
  - startTime=2000 ✅ (can only go 3000ms left)
  - duration=10000 ✅
  - mediaStartTime=0 ✅ (at source start)

## Conclusion

The fix requires:
1. Adding `mediaStartTime?: number` to the MediaItem interface
2. Updating left edge resize to modify mediaStartTime
3. Updating right edge resize bounds to consider remaining media duration
4. Updating left edge resize bounds to prevent going before source start

This will provide proper video editing trim/clip functionality.
