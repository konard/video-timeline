# Issue #83: Fix Resize Bug with Scrolled Timeline

## Problem Description

When the timeline is scrolled horizontally and the user resizes a media placeholder, the placeholder's size "jumps" by the amount of the scroll distance. This makes resizing unusable when the timeline is scrolled.

**Original issue (Russian):** "Исправить баг с изменением размера плейсхолдера медиа на таймлайн. Если проскроллить когизонтально таймлайн, то при изменении размера плейсхолдера, его размер прыгает сразу на величину расстояния скролла. Исправить."

## Root Cause Analysis

### Current Implementation

Looking at `timeline.component.ts`, the resize logic in `handleResize()` method (lines 286-354):

```typescript
private handleResize(event: MouseEvent, track: Track): void {
  if (!this.resizingItem) return;

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  // Get the scrollable container to account for scroll offset
  const scrollContainer = target.closest('.overflow-x-auto') as HTMLElement;
  const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
  const x = event.clientX - rect.left + scrollLeft;
  const timeAtCursor = x / this.pixelsPerMillisecond();
  // ...
}
```

### The Bug

The issue is similar to Issue #50 (playhead jumping). The problem is:

1. **`event.currentTarget`** in `onTrackMouseMove` is the `.track` element (from HTML line 110-111)
2. **`getBoundingClientRect()`** on the `.track` element returns coordinates relative to the viewport
3. When the timeline is scrolled, the `.track` element's position in the viewport changes
4. The code adds `scrollLeft` to compensate, BUT this creates a problem

### Why Adding scrollLeft Causes Problems

When we have a scrolled timeline:
- `scrollContainer.scrollLeft` = 200px (scrolled 200px to the right)
- User's cursor is at viewport x = 500px
- `.track` element's `getBoundingClientRect().left` might be negative (e.g., -50px) because it's scrolled left

Calculation:
```
x = event.clientX - rect.left + scrollLeft
x = 500 - (-50) + 200
x = 750px
```

But this is WRONG! The `getBoundingClientRect().left` already accounts for the scroll in a way - when scrolled, the element moves left in the viewport. Adding `scrollLeft` on top of this effectively counts the scroll offset twice.

### The Real Issue: Reference Element

Looking at the HTML structure:
```html
<!-- Line 47: Scrollable container -->
<div class="flex-1 flex flex-col overflow-y-auto overflow-x-auto relative">
  <!-- Line 86-155: Tracks wrapper -->
  <div class="flex-1" [style.width.px]="timelineWidth() + TRACK_HEADER_WIDTH">
    <!-- Track structure -->
    <div class="flex border-b border-[#3a3a3a] min-h-[60px]">
      <!-- Line 89-106: Track header (fixed width 150px) -->
      <div class="flex items-center justify-between min-w-[150px]...">
        <!-- Track header content -->
      </div>
      <!-- Line 109-152: Track timeline (scrollable content) -->
      <div class="relative flex-1">
        <div class="track relative bg-[#1a1a1a] min-h-[60px]"
             (mousemove)="onTrackMouseMove($event, track)">
          <!-- Media items here -->
        </div>
      </div>
    </div>
  </div>
</div>
```

The track element (`.track`) is inside a wrapper that includes the track header. The coordinate system is complex because:
1. The track header (150px) is NOT scrollable
2. Only the track timeline content scrolls

### Comparison with Other Operations

Let's compare with the drag operation in `onMediaItemMouseDown` (lines 177-189):
```typescript
const trackElement = target.closest('.track') as HTMLElement;
if (trackElement) {
  const rect = trackElement.getBoundingClientRect();
  const scrollContainer = trackElement.closest('.overflow-x-auto') as HTMLElement;
  const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
  const clickX = event.clientX - rect.left + scrollLeft;
  const clickTime = clickX / this.pixelsPerMillisecond();
  this.dragOffsetTime = clickTime - item.startTime;
}
```

This uses the same logic! So if resize is broken, drag might also be broken.

Let me check `onTrackMouseMove` (lines 196-284) for dragging:
```typescript
const target = event.currentTarget as HTMLElement;
const rect = target.getBoundingClientRect();
const scrollContainer = target.closest('.overflow-x-auto') as HTMLElement;
const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
const x = event.clientX - rect.left + scrollLeft;
const requestedStartTime = Math.max(0, x / this.pixelsPerMillisecond() - this.dragOffsetTime);
```

Same pattern! If the bug exists, it affects both drag and resize.

## Hypothesis

The issue is that `getBoundingClientRect()` already accounts for the element's position in the viewport (which changes when scrolled), so adding `scrollLeft` is incorrect or unnecessary in this context.

The correct approach (as learned from Issue #50) is to NOT add scrollLeft when using `getBoundingClientRect()`, because:
- `getBoundingClientRect()` returns viewport-relative coordinates
- `event.clientX` is also viewport-relative
- `event.clientX - rect.left` gives us the position within the element
- This already accounts for scroll implicitly

OR, we should use a different reference element that doesn't move when scrolling (like a parent container).

## Proposed Solution

Based on the fix for Issue #50, we should:

1. Use a consistent reference element that doesn't change position when scrolling
2. OR remove the `scrollLeft` addition if using viewport-relative coordinates

Looking at the ruler implementation (which works correctly after Issue #50 fix):
```typescript
onRulerMouseDown(event: MouseEvent): void {
  event.preventDefault();
  this.isDraggingFromRuler = true;

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  // NOTE: No scrollLeft addition here!
  const x = event.clientX - rect.left;
  const newPosition = x / this.pixelsPerMillisecond();
  // ...
}
```

The ruler mousedown does NOT add scrollLeft! This is the key insight.

### Why Ruler Works Without scrollLeft

The ruler element (from HTML line 63-74) is part of the scrollable content. When you scroll:
- The ruler scrolls with the content
- `getBoundingClientRect().left` changes to reflect the ruler's new viewport position
- `event.clientX` is viewport-relative
- `event.clientX - rect.left` gives the correct position within the ruler
- NO need to add scrollLeft because the geometry already accounts for it

## Solution

Remove the `scrollLeft` addition from both drag and resize operations:

```typescript
// In handleResize (line 286-295)
private handleResize(event: MouseEvent, track: Track): void {
  if (!this.resizingItem) return;

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  // Remove scrollLeft calculation - not needed with getBoundingClientRect()
  const x = event.clientX - rect.left;
  const timeAtCursor = x / this.pixelsPerMillisecond();
  // ...
}

// In onTrackMouseMove (line 196-212)
onTrackMouseMove(event: MouseEvent, track: Track): void {
  // ... (resize handling) ...

  if (!this.draggedItem) return;

  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  // Remove scrollLeft calculation
  const x = event.clientX - rect.left;
  const requestedStartTime = Math.max(0, x / this.pixelsPerMillisecond() - this.dragOffsetTime);
  // ...
}

// In onMediaItemMouseDown (line 177-189)
onMediaItemMouseDown(event: MouseEvent, item: MediaItem, track: Track): void {
  // ... (resize handle check) ...

  const trackElement = target.closest('.track') as HTMLElement;
  if (trackElement) {
    const rect = trackElement.getBoundingClientRect();
    // Remove scrollLeft calculation
    const clickX = event.clientX - rect.left;
    const clickTime = clickX / this.pixelsPerMillisecond();
    this.dragOffsetTime = clickTime - item.startTime;
  } else {
    this.dragOffsetTime = 0;
  }
  // ...
}
```

## Testing Plan

1. Add a media item to the timeline
2. Scroll the timeline horizontally
3. Try to resize the media item from both left and right edges
4. Verify that the resize operation works smoothly without jumping
5. Also test dragging items after scroll to ensure it still works
6. Test at different zoom levels
