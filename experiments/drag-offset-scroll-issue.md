# Drag Offset Scroll Issue Analysis

## Problem Statement
When dragging a placeholder in the timeline, if the timeline is scrolled horizontally, the cursor position jumps. This is because the current implementation doesn't account for the scroll offset.

## Root Cause

### Current Implementation (BUGGY)
In `onMediaItemMouseDown()` (lines 214-222):
```typescript
const trackElement = target.closest('.track') as HTMLElement;
if (trackElement) {
  const rect = trackElement.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const clickTime = clickX / this.pixelsPerMillisecond();
  this.dragOffsetTime = clickTime - item.startTime;
}
```

In `onTrackMouseMove()` (lines 237-242):
```typescript
const target = event.currentTarget as HTMLElement;
const rect = target.getBoundingClientRect();
const x = event.clientX - rect.left;
const requestedStartTime = Math.max(0, x / this.pixelsPerMillisecond() - this.dragOffsetTime);
```

### Why It's Buggy
The timeline content wrapper (line 17 in HTML) has `overflow-x-auto`, making it scrollable. When calculating positions:
- `getBoundingClientRect()` returns the visual position relative to the viewport
- `event.clientX - rect.left` gives the position relative to the visible left edge
- **BUT** this doesn't account for how much the container has scrolled!

### Example Scenario
1. Timeline is scrolled 200px to the right
2. Item starts at 5000ms (250px from timeline start at 0.05px/ms)
3. Item is now visible at 50px from viewport left edge
4. User clicks middle of item at visual position 125px
5. Without scroll offset: `clickX = 125px` → `clickTime = 2500ms` → `dragOffsetTime = 2500 - 5000 = -2500ms` ❌ WRONG!
6. With scroll offset: `clickX = 125px + 200px = 325px` → `clickTime = 6500ms` → `dragOffsetTime = 6500 - 5000 = 1500ms` ✓ CORRECT!

### How Playhead Dragging Handles This Correctly
In `onDocumentMouseMove()` (lines 359-361):
```typescript
const rect = contentWrapper.getBoundingClientRect();
const scrollLeft = contentWrapper.scrollLeft;
const x = event.clientX - rect.left + scrollLeft;  // ✓ Adds scroll offset!
```

## Solution
Add scroll offset to both `onMediaItemMouseDown()` and `onTrackMouseMove()`:

1. Get the scrollable container (the parent with `overflow-x-auto`)
2. Read its `scrollLeft` property
3. Add `scrollLeft` to the x coordinate calculation

### HTML Structure
```
div.flex-1.flex.flex-col.overflow-x-auto (SCROLLABLE CONTAINER)
  └─ div (tracks container)
      └─ div.track (individual track timeline) ← this is where getBoundingClientRect() is called
```

The `.track` element is inside the scrollable container, so we need to find the scrollable parent.
