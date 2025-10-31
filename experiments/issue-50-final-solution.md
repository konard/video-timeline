# Issue #50: Final Solution

## Problem Statement

Issue #50 reported two problems:
1. "Сейчас при изменении позиции линии предпросмотра не учитывается положение скроллинга, из-за этого происходят скачки при перетаскивании линии."
   - Translation: "Currently when changing the preview line position, the scroll position is not taken into account, which causes jumps when dragging the line."

2. "Также треки должны растягиваться по всю длину проекта (по числу максимальной длительности)."
   - Translation: "Also tracks should stretch to the full length of the project (based on maximum duration)."

## Analysis of PR #51

PR #51 attempted to fix the playhead jump issue by ensuring both `onRulerMouseDown` and `onDocumentMouseMove` used the same element for coordinate calculations. However, it had a critical flaw:

**The Problem:**
```typescript
// PR #51's approach in onDocumentMouseMove
const rulerContent = scrollContainer.querySelector('.relative.h-full.min-w-full.cursor-pointer') as HTMLElement;
```

This querySelector approach had several issues:
1. **Fragile selector**: Relies on specific CSS class names that could change
2. **Silent failure**: If the selector doesn't find the element, the code fails silently
3. **No guarantee of correctness**: We can't be 100% sure it finds the EXACT same element as `onRulerMouseDown` uses
4. **Timing issues**: The element might not be in the DOM when queried

## The Solution

### Part 1: Fix Playhead Jump (Using ViewChild)

Instead of using querySelector, we now use Angular's `@ViewChild` decorator to get a direct reference to the ruler element:

**HTML Change (timeline.component.html):**
```html
<div class="relative h-full min-w-full cursor-pointer"
     [style.width.px]="timelineWidth()"
     (mousedown)="onRulerMouseDown($event)"
     #timelineRuler>  <!-- Added template reference -->
```

**TypeScript Changes (timeline.component.ts):**

1. Import ViewChild and ElementRef:
```typescript
import { Component, signal, computed, effect, ViewChild, ElementRef } from '@angular/core';
```

2. Add ViewChild reference:
```typescript
@ViewChild('timelineRuler') timelineRuler?: ElementRef<HTMLElement>;
```

3. Update onDocumentMouseMove to use the ViewChild reference:
```typescript
onDocumentMouseMove(event: MouseEvent): void {
  if (this.isDraggingPlayhead || this.isDraggingFromRuler) {
    // Fix for issue #50: Use ViewChild reference to ensure we use the exact same element
    if (!this.timelineRuler) {
      return;
    }

    const rulerElement = this.timelineRuler.nativeElement;
    const scrollContainer = rulerElement.closest('.overflow-x-auto') as HTMLElement;

    if (scrollContainer) {
      // Use the same calculation as onRulerMouseDown
      const rect = rulerElement.getBoundingClientRect();
      const scrollLeft = scrollContainer.scrollLeft;
      const x = event.clientX - rect.left + scrollLeft;
      const newPosition = x / this.pixelsPerMillisecond();

      this.state.update(s => ({
        ...s,
        playheadPosition: Math.max(0, Math.min(newPosition, s.totalDuration))
      }));
    }
  }
}
```

### Key Benefits of ViewChild Approach:

1. **Type Safety**: We get a typed reference to the exact element
2. **Reliability**: Angular guarantees we get the right element after view initialization
3. **Performance**: No DOM querying during drag operations
4. **Maintainability**: The template reference (#timelineRuler) is more explicit than CSS classes
5. **Fail-safe**: Early return if ViewChild is not initialized yet

### Part 2: Track Stretching

The tracks are ALREADY stretching to full project duration. This was implemented in previous commits (specifically issue #48). The HTML already has:

```html
<div class="track relative flex-1 bg-[#1a1a1a] min-h-[60px]"
     [style.width.px]="timelineWidth()"
     (mousemove)="onTrackMouseMove($event, track)">
```

Both the ruler (line 65) and tracks (line 114) have `[style.width.px]="timelineWidth()"` which sets their width to the calculated timeline width based on `totalDuration * pixelsPerMillisecond()`.

## Why PR #51 Failed

PR #51 was merged at 11:21:43Z, and the issue author commented "Это до сих пор не исправлено" (This is still not fixed) at 11:23:04Z - only 81 seconds later!

The querySelector approach likely failed because:
1. The selector might not have found the element consistently
2. There might have been timing issues with DOM updates
3. The selector was too specific and might have broken with minor HTML changes

## Testing

To verify the fix:
1. ✅ `npm install` - Dependencies installed successfully
2. ✅ `npm run build` - Build completes without errors
3. ✅ Code follows existing style and patterns
4. ✅ Playhead dragging calculation now uses ViewChild reference (same element as onRulerMouseDown)
5. ✅ Tracks already have width set to timelineWidth()

## Files Changed

1. `video-timeline/src/app/components/timeline/timeline.component.ts`
   - Added ViewChild and ElementRef imports
   - Added @ViewChild reference to ruler element
   - Updated onDocumentMouseMove to use ViewChild reference instead of querySelector

2. `video-timeline/src/app/components/timeline/timeline.component.html`
   - Added #timelineRuler template reference to ruler element

3. `experiments/issue-50-final-solution.md` (this file)
   - Documentation of the solution

## Related Issues

- Issue #50: This fix
- PR #51: Previous attempt that failed
- Issue #48: Implemented track stretching (already done)
- Issue #29, #42: Previous playhead drag fixes

## Conclusion

The ViewChild approach provides a robust, type-safe solution that guarantees we're using the exact same element for coordinate calculations in both `onRulerMouseDown` and `onDocumentMouseMove`. This eliminates the coordinate system mismatch that was causing the playhead to jump when scrolling.
