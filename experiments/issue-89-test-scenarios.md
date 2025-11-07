# Issue #89: Test Scenarios for mediaStartTime Implementation

## Test Setup

All tests assume a 10-second (10000ms) video file as the source media.

## Scenario 1: Trim from left when at full duration

**Initial State:**
```typescript
{
  startTime: 2000,
  duration: 10000,
  mediaStartTime: 0,  // or undefined (defaults to 0)
  maxDuration: 10000
}
```

**Action:** User drags left edge from 2000ms to 5000ms (dragging RIGHT, trimming beginning)

**Expected deltaTime:** 5000 - 2000 = 3000ms (moving right)

**Expected Calculations:**
- currentMediaStartTime = 0
- newMediaStartTime = 0 - 3000 = -3000ms
- clampedMediaStartTime = max(0, -3000) = 0ms
- actualDeltaTime = 0 - 0 = 0ms
- finalStartTime = 2000 - 0 = 2000ms
- finalDuration = 10000 + 0 = 10000ms

**Wait, this doesn't look right!**

Let me reconsider: When dragging left edge to the RIGHT:
- We're TRIMMING the beginning of the clip
- The timeline startTime should INCREASE
- The mediaStartTime should INCREASE (skipping beginning content)
- The duration should DECREASE

So the deltaTime calculation is correct: deltaTime = newStartTime - i.startTime = 5000 - 2000 = +3000ms

For mediaStartTime: if we move right by 3000ms, we're skipping 3000ms of the source, so:
- newMediaStartTime = currentMediaStartTime + 3000 = 0 + 3000 = 3000ms

**CORRECTION NEEDED:** The formula should be:
```typescript
const newMediaStartTime = currentMediaStartTime + deltaTime; // NOT minus!
```

Wait, let me think about this more carefully:

When dragging the LEFT edge:
- Dragging LEFT (negative deltaTime): Extending the clip backwards
  - startTime decreases
  - duration increases
  - mediaStartTime decreases (showing earlier content)

- Dragging RIGHT (positive deltaTime): Trimming from beginning
  - startTime increases
  - duration decreases
  - mediaStartTime increases (skipping beginning content)

So if deltaTime is positive (dragging right), mediaStartTime should increase:
```typescript
const newMediaStartTime = currentMediaStartTime - deltaTime;
```

When deltaTime = +3000 (dragging right):
- newMediaStartTime = 0 - (+3000) = -3000

No wait, that's still wrong. Let me think step by step:

**Original clip:** Shows source media from 0ms to 10000ms
**After dragging left edge right by 3000ms:**
- Should show source media from 3000ms to 10000ms
- So mediaStartTime should become 3000ms

If currentMediaStartTime = 0 and deltaTime = +3000:
- We need: newMediaStartTime = 3000
- Formula: newMediaStartTime = currentMediaStartTime + deltaTime
- But in the code I wrote: newMediaStartTime = currentMediaStartTime - deltaTime

**The issue:** I had the sign backwards!

Let me reconsider the duration calculation too:
- Original duration = 10000ms
- deltaTime = +3000ms (timeline position moved right)
- New duration should be 10000 - 3000 = 7000ms
- Formula in code: finalDuration = i.duration + actualDeltaTime

If actualDeltaTime = 3000:
- finalDuration = 10000 + 3000 = 13000ms ❌ WRONG!

I need to fix my implementation. The logic should be:

**When dragging left edge:**
1. Calculate new timeline startTime (from cursor position)
2. deltaTime = newStartTime - currentStartTime
3. newDuration = currentDuration - deltaTime
4. newMediaStartTime = currentMediaStartTime + deltaTime

Let me write out the correct logic:

## Corrected Logic

### Left Edge Resize

```typescript
// newStartTime is already calculated from cursor with bounds
const deltaTime = newStartTime - i.startTime;

// Duration changes inversely to startTime
const newDuration = i.duration - deltaTime;

// Media start time changes with startTime
const currentMediaStartTime = i.mediaStartTime || 0;
const newMediaStartTime = currentMediaStartTime + deltaTime;

// Clamp media start time to valid range
const clampedMediaStartTime = Math.max(0, newMediaStartTime);

// If mediaStartTime was clamped, we can't move as far as requested
if (newMediaStartTime < 0) {
  // We tried to extend too far left - limit by available media
  const maxExtension = currentMediaStartTime;
  const finalStartTime = i.startTime - maxExtension;
  const finalDuration = i.duration + maxExtension;
  const finalMediaStartTime = 0;

  // Still need to check maxDuration
  if (i.maxDuration && finalDuration > i.maxDuration) {
    return {
      ...i,
      startTime: finalStartTime + (finalDuration - i.maxDuration),
      duration: i.maxDuration,
      mediaStartTime: finalMediaStartTime
    };
  }

  return {
    ...i,
    startTime: finalStartTime,
    duration: finalDuration,
    mediaStartTime: finalMediaStartTime
  };
}

// mediaStartTime is valid, check if we exceed maxDuration from the end
if (i.maxDuration && clampedMediaStartTime + newDuration > i.maxDuration) {
  const maxAllowedDuration = i.maxDuration - clampedMediaStartTime;
  return {
    ...i,
    startTime: i.startTime + (i.duration - maxAllowedDuration),
    duration: maxAllowedDuration,
    mediaStartTime: clampedMediaStartTime
  };
}

return {
  ...i,
  startTime: newStartTime,
  duration: newDuration,
  mediaStartTime: clampedMediaStartTime
};
```

## Updated Test Scenarios

### Scenario 1: Trim 3s from left when at full duration

**Initial:**
- startTime: 2000ms
- duration: 10000ms
- mediaStartTime: 0ms
- maxDuration: 10000ms

**Action:** Drag left edge from 2000ms → 5000ms

**Calculations:**
- deltaTime = 5000 - 2000 = 3000ms
- newDuration = 10000 - 3000 = 7000ms
- newMediaStartTime = 0 + 3000 = 3000ms
- clampedMediaStartTime = max(0, 3000) = 3000ms
- mediaEnd = 3000 + 7000 = 10000ms ≤ 10000ms ✅

**Result:**
- startTime: 5000ms ✅
- duration: 7000ms ✅
- mediaStartTime: 3000ms ✅

**Interpretation:** Clip now shows source media from 3000ms to 10000ms on timeline from 5000ms to 12000ms

### Scenario 2: Extend 2s left from trimmed state

**Initial:**
- startTime: 5000ms
- duration: 7000ms
- mediaStartTime: 3000ms
- maxDuration: 10000ms

**Action:** Drag left edge from 5000ms → 3000ms

**Calculations:**
- deltaTime = 3000 - 5000 = -2000ms (negative = extending left)
- newDuration = 7000 - (-2000) = 9000ms
- newMediaStartTime = 3000 + (-2000) = 1000ms
- clampedMediaStartTime = max(0, 1000) = 1000ms
- mediaEnd = 1000 + 9000 = 10000ms ≤ 10000ms ✅

**Result:**
- startTime: 3000ms ✅
- duration: 9000ms ✅
- mediaStartTime: 1000ms ✅

**Interpretation:** Clip now shows source media from 1000ms to 10000ms

### Scenario 3: Try to extend left beyond source start

**Initial:**
- startTime: 5000ms
- duration: 7000ms
- mediaStartTime: 3000ms
- maxDuration: 10000ms

**Action:** Drag left edge from 5000ms → 0ms (trying to extend 5000ms left)

**Calculations:**
- deltaTime = 0 - 5000 = -5000ms
- newMediaStartTime = 3000 + (-5000) = -2000ms ❌ (negative!)
- clampedMediaStartTime = max(0, -2000) = 0ms

Since newMediaStartTime < 0, we can only extend by currentMediaStartTime (3000ms):
- maxExtension = 3000ms
- finalStartTime = 5000 - 3000 = 2000ms
- finalDuration = 7000 + 3000 = 10000ms
- finalMediaStartTime = 0ms
- Check maxDuration: 10000ms ≤ 10000ms ✅

**Result:**
- startTime: 2000ms ✅
- duration: 10000ms ✅
- mediaStartTime: 0ms ✅

**Interpretation:** Clip shows full source media (0-10000ms), couldn't extend further left

### Scenario 4: Extend right edge after trimming from left

**Initial (after Scenario 1):**
- startTime: 5000ms
- duration: 7000ms
- mediaStartTime: 3000ms
- maxDuration: 10000ms

**Action:** Drag right edge from 12000ms → 15000ms (trying to extend 3000ms right)

**Right edge bounds calculation:**
- currentMediaStartTime = 3000ms
- remainingMediaDuration = 10000 - 3000 = 7000ms
- maxTimeBasedOnRemainingMedia = 5000 + 7000 = 12000ms

The bounds will prevent dragging beyond 12000ms because we've already used 3000ms at the start!

**Result:**
- startTime: 5000ms (unchanged)
- duration: 7000ms (unchanged)
- mediaStartTime: 3000ms (unchanged)

**Interpretation:** Cannot extend right because we're already showing all remaining media (3000-10000ms)

### Scenario 5: Trim from left, then from right, then extend right

**Step 1:** Initial state
- startTime: 2000ms, duration: 10000ms, mediaStartTime: 0ms

**Step 2:** Trim 3s from left → 5000ms
- startTime: 5000ms, duration: 7000ms, mediaStartTime: 3000ms

**Step 3:** Trim 2s from right (drag right edge from 12000ms → 10000ms)
- startTime: 5000ms, duration: 5000ms, mediaStartTime: 3000ms
- Now showing source 3000-8000ms

**Step 4:** Extend 2s right (drag right edge from 10000ms → 12000ms)
- remainingMediaDuration = 10000 - 3000 = 7000ms
- current duration = 5000ms
- can extend by 2000ms ✅
- startTime: 5000ms, duration: 7000ms, mediaStartTime: 3000ms
- Now showing source 3000-10000ms again ✅

This confirms the implementation is correct!
