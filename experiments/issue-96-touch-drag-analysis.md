# Issue #96 - Touch Drag Between Tracks Analysis

## Problem
When dragging a media item between tracks on mobile (touch), the placeholder doesn't follow the touch point to other tracks. The dragging only works within the same track.

## Root Cause Analysis

### Current Implementation
Looking at `timeline.component.html`:

```html
<!-- Global touch handlers -->
<div (touchmove)="onDocumentPointerMove($event)" ...>

  <!-- Track-specific touch handlers -->
  <div class="track"
       (touchmove)="onTrackPointerMove($event, track)" ...>
```

### The Issue
1. **Mouse behavior**: Works correctly because `mousemove` bubbles from the track element to the document
2. **Touch behavior**: When you start touching on a track element:
   - The track's `touchmove` handler gets the events while over that track
   - When the touch moves outside the track element boundaries, the track's `touchmove` stops firing
   - The global `onDocumentPointerMove` is ONLY for playhead dragging (checks `isDraggingPlayhead || isDraggingFromRuler`)

### Key Code in `onDocumentPointerMove`:
```typescript
onDocumentPointerMove(event: MouseEvent | TouchEvent): void {
  if (this.isDraggingPlayhead || this.isDraggingFromRuler) {
    // Only handles playhead movement
    // Does NOT handle media item dragging
  }
}
```

### Why Mouse Works But Touch Doesn't
- **Mouse**: When dragging a media item with mouse, `mousemove` fires on both:
  1. The specific track element (calls `onTrackPointerMove`)
  2. The document (but `onDocumentPointerMove` ignores it since it's not playhead)

- **Touch**: When dragging with touch:
  1. `touchmove` on track works ONLY while touch is within that track's bounds
  2. When touch moves to another track, the original track's `touchmove` stops
  3. The new track's `touchmove` doesn't pick up the drag because `draggedItem` is set but no `touchstart` happened on that track

## Solution Approach

The fix needs to handle media item dragging at the document level for touch events, similar to how playhead dragging works.

### Option 1: Extend `onDocumentPointerMove` (RECOMMENDED)
Modify `onDocumentPointerMove` to also handle media item dragging when `draggedItem` is set.

### Option 2: Use pointer-events CSS
Use CSS `pointer-events: none` on tracks during drag, but this is more complex.

### Option 3: Track detection at document level
When touch is moving at document level with `draggedItem` set, calculate which track the touch is over.

## Implementation Plan

We'll use Option 1 combined with Option 3:
1. Modify `onDocumentPointerMove` to detect media item dragging
2. Calculate which track the touch point is over using element bounds
3. Call the same logic as `onTrackPointerMove` but with the detected track
