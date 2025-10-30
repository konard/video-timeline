# Drag Offset Fix - Issue #9

## Problem
When dragging a placeholder/media item, the cursor would jump to the beginning of the placeholder, causing a sudden position change. This happened because the drag offset was not being preserved.

## Root Cause
In `timeline.component.ts`, the `onMediaItemMouseDown` method tried to calculate the drag offset by finding the parent `.track` element:

```typescript
const trackElement = target.closest('.track') as HTMLElement;
```

However, in `timeline.component.html`, the track timeline container did not have the `track` class, causing `trackElement` to be `null`. This resulted in the offset always being set to 0:

```typescript
if (trackElement) {
  // ... calculate offset
} else {
  this.dragOffsetTime = 0; // Always executed!
}
```

## Solution
Added the missing `track` class to the track timeline container in `timeline.component.html`:

```html
<div class="track relative flex-1 bg-[#1a1a1a] min-h-[60px]"
     [style.width.px]="timelineWidth()"
     (mousemove)="onTrackMouseMove($event, track)">
```

## How It Works Now
1. User clicks on a media item at position X within the item
2. `onMediaItemMouseDown` finds the track element (now successfully)
3. Calculates `clickX` relative to the track's left edge
4. Calculates `clickTime = clickX / pixelsPerMillisecond()`
5. Stores `dragOffsetTime = clickTime - item.startTime` (offset from item start to cursor)
6. When dragging in `onTrackMouseMove`, calculates `requestedStartTime = x / pixelsPerMillisecond() - dragOffsetTime`
7. The item moves smoothly, maintaining the cursor position where the drag started

## Testing
To test:
1. Run the application
2. Click on a media item in the middle or end (not at the start)
3. Drag it - the item should move smoothly without jumping
4. The cursor should stay at the same position within the item where you clicked
