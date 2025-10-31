# Issue #50: Fix Playhead Position Jump When Scrolled

## Problem Statement
When the timeline is horizontally scrolled and the user drags the playhead (preview line), the playhead jumps from its expected position. This makes it difficult to accurately position the playhead when working with long timelines.

## Root Cause Analysis

### The Bug
The issue was caused by an **inconsistency in coordinate system calculations** between two methods:

1. **`onRulerMouseDown`** (initial click on ruler):
   ```typescript
   const target = event.currentTarget as HTMLElement; // Ruler element
   const rect = target.getBoundingClientRect();
   const x = event.clientX - rect.left + scrollLeft;
   ```
   - Uses the **ruler element** as the reference
   - `rect.left` = position of ruler in viewport (includes track header offset)

2. **`onDocumentMouseMove`** (dragging playhead):
   ```typescript
   const rect = scrollContainer.getBoundingClientRect(); // Scroll container!
   const x = event.clientX - rect.left + scrollLeft - TRACK_HEADER_WIDTH;
   ```
   - Uses the **scroll container** as the reference
   - `rect.left` = position of scroll container in viewport
   - Manually subtracts `TRACK_HEADER_WIDTH` to compensate

### Why It Caused Jumps
While mathematically these should be equivalent, using different DOM elements for `getBoundingClientRect()` introduced subtle inconsistencies:

1. **Rounding errors**: Different elements may have slightly different computed positions due to CSS and layout calculations
2. **Layout changes**: Dynamic layout changes (zoom, window resize) could affect elements differently
3. **CSS transforms**: Any transforms on parent elements would affect the calculations differently
4. **Timing issues**: The bounding rects might be calculated at slightly different times during the layout cycle

## The Fix

Make both methods use the **exact same calculation**:

### Updated `onDocumentMouseMove`:
```typescript
onDocumentMouseMove(event: MouseEvent): void {
  if (this.isDraggingPlayhead || this.isDraggingFromRuler) {
    const rootElement = event.currentTarget as HTMLElement;
    const scrollContainer = rootElement.querySelector('.flex-1.flex.flex-col.overflow-y-auto.overflow-x-auto') as HTMLElement;

    if (scrollContainer) {
      // Find the ruler content element - same as onRulerMouseDown uses
      const rulerContent = scrollContainer.querySelector('.relative.h-full.min-w-full.cursor-pointer') as HTMLElement;

      if (rulerContent) {
        // Use the ruler element's bounding rect (SAME AS onRulerMouseDown)
        const rect = rulerContent.getBoundingClientRect();
        const scrollLeft = scrollContainer.scrollLeft;
        // SAME calculation - no TRACK_HEADER_WIDTH subtraction needed
        const x = event.clientX - rect.left + scrollLeft;
        const newPosition = x / this.pixelsPerMillisecond();

        this.state.update(s => ({
          ...s,
          playheadPosition: Math.max(0, Math.min(newPosition, s.totalDuration))
        }));
      }
    }
  }
}
```

### Key Changes:
1. **Query for ruler element**: Added selector for `.relative.h-full.min-w-full.cursor-pointer` to find the ruler content div
2. **Use ruler's bounding rect**: Changed from `scrollContainer.getBoundingClientRect()` to `rulerContent.getBoundingClientRect()`
3. **Removed TRACK_HEADER_WIDTH subtraction**: No longer needed because we're using the same reference element as `onRulerMouseDown`

## Testing Strategy

To verify the fix works:

1. **Basic functionality**:
   - Click on ruler at any position → Playhead should jump to that exact position
   - Drag playhead → Should follow cursor smoothly without jumping

2. **With scrolling** (the main bug):
   - Scroll timeline horizontally to any position
   - Click on ruler → Playhead should appear exactly where you clicked
   - Drag playhead → Should follow cursor smoothly, no jumps

3. **Edge cases**:
   - Zoom in/out while dragging
   - Drag near timeline boundaries (start/end)
   - Fast dragging movements

## Related Issues

This fix addresses similar issues that were partially solved in previous commits:
- Issue #29: Playhead drag position jump by accounting for track header offset
- Issue #42: Playhead drag offset bug by subtracting track header width

The current fix (#50) completes the solution by ensuring **complete consistency** between the initial click and drag calculations.

## Technical Notes

### DOM Structure (from timeline.component.html):
```
<div (mouseup)="onMouseUp()" (mousemove)="onDocumentMouseMove($event)"> ← Root element
  └─ <div class="flex-1 flex flex-col overflow-y-auto overflow-x-auto"> ← Scroll container
      └─ Ruler section
          └─ <div class="relative h-full min-w-full cursor-pointer"
                  (mousedown)="onRulerMouseDown($event)"> ← Ruler content
```

### Key Principle
**Always use the same reference element for coordinate calculations in related operations.**

When one operation (mousedown) uses element A's bounding rect, all related operations (mousemove, mouseup) should use the same element A's bounding rect. This ensures coordinate system consistency.
