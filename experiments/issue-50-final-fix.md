# Issue #50 - Final Fix Explanation

## Problem Summary
When clicking on the timeline ruler while horizontally scrolled, the playhead jumps to an incorrect position. The playhead moves further than where the user clicked, indicating that the scrolling offset is not being properly accounted for.

## Root Cause Analysis

### Previous Attempts
1. **PR #51**: Attempted to fix using `querySelector` to find the ruler element
2. **PR #52**: Improved using `@ViewChild` decorator for more reliable element reference

Both attempts used this formula:
```typescript
const x = event.clientX - rect.left + scrollLeft;
```

This formula incorrectly adds `scrollLeft` to the calculation.

### The Actual Bug

The issue is a **misunderstanding of how `getBoundingClientRect()` works**.

**Key Insight**: `getBoundingClientRect()` returns positions **relative to the viewport**, and it **already accounts for scroll positions**.

When an element is inside a scrolled container:
- If `scrollLeft = 0`: `rect.left` is the element's position in the viewport
- If `scrollLeft = 200`: `rect.left` changes to reflect the element's new viewport position after scrolling

### Coordinate Systems

There are three coordinate systems at play:

1. **Viewport Coordinates**:
   - Origin: Top-left of browser window
   - `event.clientX` uses this system

2. **Scroll Container Coordinates**:
   - Origin: Top-left of the scroll container's content (not visible area)
   - Total width: 150px (header) + timelineWidth()
   - `scrollLeft` tells us how much is scrolled

3. **Timeline Coordinates** (what we need):
   - Origin: Left edge of `#timelineRuler` element
   - Range: [0, timelineWidth()]

### The Incorrect Formula

```typescript
const x = event.clientX - rect.left + scrollLeft;
```

**Example with scrollLeft = 200px**:
- User clicks at viewport x = 500px
- `rect.left = -50px` (ruler's left edge is off-screen to the left)
- `x = 500 - (-50) + 200 = 750px` ❌ WRONG!
- The playhead appears at viewport x = 700px (not where we clicked!)

### The Correct Formula

```typescript
const x = event.clientX - rect.left;
```

**Same example**:
- User clicks at viewport x = 500px
- `rect.left = -50px`
- `x = 500 - (-50) = 550px` ✓ CORRECT!
- The playhead appears at viewport x = 500px (exactly where we clicked!)

### Why This Works

`event.clientX - rect.left` gives us the position **within the element's coordinate system**, and since `rect.left` already accounts for scrolling (being in viewport coordinates), we don't need to add `scrollLeft`.

Think of it this way:
- `rect.left` = "Where is the element's origin in the viewport?"
- `event.clientX` = "Where is the mouse in the viewport?"
- `event.clientX - rect.left` = "How far is the mouse from the element's origin?"

That's exactly what we want!

## The Fix

### File: `timeline.component.ts`

#### 1. Fix `onRulerMouseDown` (lines 147-163)

**Before**:
```typescript
onRulerMouseDown(event: MouseEvent): void {
  event.preventDefault();
  this.isDraggingFromRuler = true;

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const scrollContainer = target.closest('.overflow-x-auto') as HTMLElement;
  const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
  const x = event.clientX - rect.left + scrollLeft; // ❌ WRONG
  const newPosition = x / this.pixelsPerMillisecond();

  this.state.update(s => ({
    ...s,
    playheadPosition: Math.max(0, Math.min(newPosition, s.totalDuration))
  }));
}
```

**After**:
```typescript
onRulerMouseDown(event: MouseEvent): void {
  event.preventDefault();
  this.isDraggingFromRuler = true;

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  // getBoundingClientRect() already accounts for scroll, so we don't add scrollLeft
  const x = event.clientX - rect.left; // ✓ CORRECT
  const newPosition = x / this.pixelsPerMillisecond();

  this.state.update(s => ({
    ...s,
    playheadPosition: Math.max(0, Math.min(newPosition, s.totalDuration))
  }));
}
```

#### 2. Fix `onDocumentMouseMove` (lines 636-655)

**Before**:
```typescript
onDocumentMouseMove(event: MouseEvent): void {
  if (this.isDraggingPlayhead || this.isDraggingFromRuler) {
    if (!this.timelineRuler) {
      return;
    }

    const rulerElement = this.timelineRuler.nativeElement;
    const scrollContainer = rulerElement.closest('.overflow-x-auto') as HTMLElement;

    if (scrollContainer) {
      const rect = rulerElement.getBoundingClientRect();
      const scrollLeft = scrollContainer.scrollLeft;
      const x = event.clientX - rect.left + scrollLeft; // ❌ WRONG
      const newPosition = x / this.pixelsPerMillisecond();

      this.state.update(s => ({
        ...s,
        playheadPosition: Math.max(0, Math.min(newPosition, s.totalDuration))
      }));
    }
  }
}
```

**After**:
```typescript
onDocumentMouseMove(event: MouseEvent): void {
  if (this.isDraggingPlayhead || this.isDraggingFromRuler) {
    if (!this.timelineRuler) {
      return;
    }

    const rulerElement = this.timelineRuler.nativeElement;
    // getBoundingClientRect() already accounts for scroll, so we don't add scrollLeft
    const rect = rulerElement.getBoundingClientRect();
    const x = event.clientX - rect.left; // ✓ CORRECT
    const newPosition = x / this.pixelsPerMillisecond();

    this.state.update(s => ({
      ...s,
      playheadPosition: Math.max(0, Math.min(newPosition, s.totalDuration))
    }));
  }
}
```

### Changes Made:
1. Removed `scrollContainer` variable and `scrollLeft` calculation (no longer needed)
2. Changed formula from `event.clientX - rect.left + scrollLeft` to `event.clientX - rect.left`
3. Added comments explaining why we don't add scrollLeft

## Second Part of Issue #50: Tracks Stretch to Project Length

**Requirement**: "Также треки должны растягиваться по всю длину проекта (по числу максимальной длительности)"
Translation: "Also, tracks should stretch to the entire project length (by the maximum duration number)"

**Status**: ✅ Already implemented!

### Verification:

**In `timeline.component.html`**:
- Line 65: Ruler width: `[style.width.px]="timelineWidth()"`
- Line 115: Track width: `[style.width.px]="timelineWidth()"`

**In `timeline.component.ts`**:
```typescript
readonly timelineWidth = computed(() => {
  return this.state().totalDuration * this.pixelsPerMillisecond();
});
```

Both ruler and tracks use `timelineWidth()`, which is calculated based on `totalDuration`, ensuring they always stretch to the full project length.

## Testing

### Build Status
```bash
npm run build
```
✅ Build successful with no errors or warnings

### Manual Testing Scenarios

To verify the fix works:

1. **Scenario 1: No scrolling (scrollLeft = 0)**
   - Click at any position on the ruler
   - ✓ Playhead should appear exactly where clicked

2. **Scenario 2: Partially scrolled (scrollLeft > 0)**
   - Zoom in to make timeline wider than viewport
   - Scroll horizontally to the right
   - Click on the ruler at various positions
   - ✓ Playhead should appear exactly where clicked (not offset)

3. **Scenario 3: Dragging playhead while scrolled**
   - Zoom in and scroll horizontally
   - Click and drag the playhead handle
   - ✓ Playhead should follow the mouse cursor precisely (no jumping)

4. **Scenario 4: Dragging from ruler while scrolled**
   - Zoom in and scroll horizontally
   - Click on ruler and drag (without releasing)
   - ✓ Playhead should follow the mouse cursor precisely

### Expected Results
- ✅ No playhead jumping when clicking on scrolled timeline
- ✅ Smooth dragging regardless of scroll position
- ✅ Playhead position matches click position exactly
- ✅ Ruler and tracks have same width as project duration

## Summary

The fix is simple but critical:
- **Remove `+ scrollLeft`** from the playhead position calculation
- `getBoundingClientRect()` already handles scroll positioning
- This fixes the jumping playhead issue reported in issue #50

The second requirement (tracks stretching to project length) was already implemented and verified.

## Related Issues

- Issue #50: This fix
- PR #51: First attempt (querySelector approach) - had the same scrollLeft bug
- PR #52: Second attempt (ViewChild approach) - improved element reference but still had scrollLeft bug
- PR #53 (this PR): Final fix removing the scrollLeft addition

## Files Modified

1. `video-timeline/src/app/components/timeline/timeline.component.ts`:
   - `onRulerMouseDown` method (lines 147-163)
   - `onDocumentMouseMove` method (lines 636-655)

Total lines changed: ~10 lines (removed scrollLeft logic, updated comments)
