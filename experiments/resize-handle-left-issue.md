# Issue #12: Исправить изменение размера плейсхолдера от начала

## Problem Description

When attempting to resize a placeholder from the left side, it doesn't work. When resizing from the beginning, it should work like we're moving the clip's playback start time.

## Root Cause Analysis

The issue was in the HTML template (`timeline.component.html`). The resize handles were missing identifying CSS classes that the TypeScript code relies on to determine which edge is being resized.

### Before Fix

**HTML (lines 79 and 101):**
```html
<!-- Left handle - MISSING resize-handle-left class -->
<div class="resize-handle absolute top-0 left-0 w-2 h-full cursor-ew-resize z-10 bg-gradient-to-r from-white/30 to-transparent hover:bg-white/50"></div>

<!-- Right handle - MISSING resize-handle-right class -->
<div class="resize-handle absolute top-0 right-0 w-2 h-full cursor-ew-resize z-10 bg-gradient-to-l from-white/30 to-transparent hover:bg-white/50"></div>
```

**TypeScript (timeline.component.ts:210):**
```typescript
edge: target.classList.contains('resize-handle-left') ? 'left' : 'right'
```

The code checks for `resize-handle-left` class, but since it was missing from the HTML, the condition always evaluated to `false`, defaulting to `'right'` for both handles.

## Solution

Added the identifying classes `resize-handle-left` and `resize-handle-right` to their respective div elements in the HTML template.

### After Fix

**HTML (lines 79 and 101):**
```html
<!-- Left handle - NOW HAS resize-handle-left class -->
<div class="resize-handle resize-handle-left absolute top-0 left-0 w-2 h-full cursor-ew-resize z-10 bg-gradient-to-r from-white/30 to-transparent hover:bg-white/50"></div>

<!-- Right handle - NOW HAS resize-handle-right class -->
<div class="resize-handle resize-handle-right absolute top-0 right-0 w-2 h-full cursor-ew-resize z-10 bg-gradient-to-l from-white/30 to-transparent hover:bg-white/50"></div>
```

## How It Works Now

1. User clicks on the left resize handle
2. `onMediaItemMouseDown()` detects the click on an element with class `resize-handle`
3. The code checks if the element also has `resize-handle-left` class
4. Since the class is now present, `edge` is correctly set to `'left'`
5. `handleResize()` uses the left edge logic:
   ```typescript
   if (this.resizingItem!.edge === 'left') {
     const newStartTime = Math.max(
       bounds.minTime,
       Math.min(timeAtCursor, bounds.maxTime)
     );
     const newDuration = i.duration + (i.startTime - newStartTime);
     return { ...i, startTime: newStartTime, duration: newDuration };
   }
   ```
6. This correctly adjusts both `startTime` and `duration`, moving the clip's playback start time

## Testing

The fix enables:
- Resizing placeholders from the left edge
- Proper adjustment of start time and duration
- Maintaining the end time while changing the start time
- Collision detection with items to the left (already implemented in `getResizeBounds()`)

## Files Modified

- `video-timeline/src/app/components/timeline/timeline.component.html`: Added `resize-handle-left` and `resize-handle-right` classes
