# Coordinate Calculation Trace

## Scenario Setup
- viewport width: 1000px
- timeline totalDuration: 60000ms = 60 seconds
- zoomLevel: 50 pixels/second
- pixelsPerMillisecond: 0.05 pixels/ms
- timelineWidth: 60000 * 0.05 = 3000px
- TRACK_HEADER_WIDTH: 150px
- scrollLeft: 200px (scrolled 200px to the right)

## HTML Structure
```
<div class="scroll-container overflow-x-auto" style="width: 850px; scrollLeft: 200px">
  <div class="ruler-row flex">
    <div class="control-area min-w-[150px]">Controls</div>
    <div class="ruler-content-wrapper flex-1">
      <div class="#timelineRuler" style="width: 3000px">
        [Timeline markers...]
      </div>
    </div>
  </div>
  <div class="tracks">
    [Tracks with same 150px + 3000px structure]
  </div>
  <div class="playhead absolute" style="left: ???px">
    [Playhead]
  </div>
</div>
```

## Coordinate Systems

### 1. Viewport Coordinates
- Origin: Top-left of the browser window
- Mouse clientX: Position relative to viewport

### 2. Scroll Container Coordinates
- Origin: Top-left of the scroll container element
- Total width of content: 150 + 3000 = 3150px
- Visible width: 850px
- scrollLeft: 200px
- Visible range: [200px, 1050px] in container coordinates

### 3. Timeline Coordinates
- Origin: Left edge of #timelineRuler (which is 150px into the container)
- Range: [0, 3000px]
- This corresponds to time range: [0ms, 60000ms]

### 4. Playhead Position
- playheadPosition: Time in milliseconds (e.g., 5000ms)
- playheadPosition in pixels: 5000 * 0.05 = 250px (in timeline coordinates)
- playheadVisualPosition: 250 + 150 = 400px (in scroll container coordinates)
- The playhead's CSS `left` is set to 400px (relative to scroll container)

## Click Scenario: User clicks at viewport x = 500px with scrollLeft = 200px

### What we see:
- Viewport x = 500px
- We want to find: What timeline position did the user click?

### Calculation in onRulerMouseDown:
```typescript
const target = event.currentTarget as HTMLElement; // #timelineRuler
const rect = target.getBoundingClientRect();
const scrollContainer = target.closest('.overflow-x-auto') as HTMLElement;
const scrollLeft = scrollContainer.scrollLeft; // 200
const x = event.clientX - rect.left + scrollLeft;
```

### What is rect.left?
- rect = #timelineRuler.getBoundingClientRect()
- #timelineRuler is 150px into the scroll container (after control area)
- The scroll container is scrolled 200px to the right
- So the first 200px of the container content is hidden (scrolled out to the left)
- The visible part of the container starts at the 200px mark in container coordinates

In container coordinates:
- Control area: [0, 150px]
- #timelineRuler: [150px, 3150px]

With scrollLeft = 200:
- Visible range in container coords: [200px, 1050px]
- The first 200px is scrolled out
- At scrollLeft = 200, the control area (0-150px) is partially visible
- #timelineRuler starts at 150px in container coords
- 150px < 200px, so #timelineRuler's left edge is also scrolled out!
- The visible left edge of #timelineRuler is at: 200px (first visible pixel)

Now, rect.left (in viewport coordinates):
- If scroll container's left edge is at viewport x = 0
- And scrollLeft = 200, meaning first 200px is hidden
- Then the visible content starts from container coordinate 200px
- rect.left = container left (0) + (150 - scrollLeft) = 0 + 150 - 200 = -50px

Wait, that's negative! That means #timelineRuler's left edge is 50px to the LEFT of the visible area!

Actually, getBoundingClientRect() gives us the element's position relative to the viewport, not the container!

Let me reconsider:
- Scroll container occupies viewport x = [0, 850px]
- scrollLeft = 200px means the first 200px of content is scrolled out
- #timelineRuler's left edge in container space is at 150px
- Since 200px is scrolled out, and 150 < 200, the #timelineRuler's left edge is at:
  - viewport x = 0 + (150 - 200) = -50px (it's 50px to the left of the viewport, off-screen)

So rect.left = -50px (but it's actually clamped to the viewport, or just off-screen)

Wait, no. The scroll container might not start at viewport x = 0. Let's say:
- Scroll container viewport left edge: scLeft (viewport coordinates)
- Scroll container scrollLeft: 200px
- #timelineRuler left edge in container coordinates: 150px

Then:
- #timelineRuler viewport left: scLeft + 150 - scrollLeft = scLeft + 150 - 200 = scLeft - 50

So rect.left = scLeft - 50

For simplicity, let's say scLeft = 0:
- rect.left = -50px

Now the calculation:
```
x = event.clientX - rect.left + scrollLeft
x = 500 - (-50) + 200
x = 500 + 50 + 200
x = 750px
```

This means we clicked at timeline position 750px, which is:
- time = 750 / 0.05 = 15000ms = 15 seconds

### Verify with playhead position:
If we set playheadPosition = 15000ms:
- playheadPosition in px = 15000 * 0.05 = 750px (timeline coordinates)
- playheadVisualPosition = 750 + 150 = 900px (container coordinates)
- With scrollLeft = 200, playhead viewport position = scLeft + 900 - 200 = 0 + 700 = 700px

Hmm, we clicked at viewport x = 500px, but the playhead appears at viewport x = 700px?

That's a 200px difference! That's wrong!

## Debugging the Issue

Let me reconsider the calculation...

### Actually, let me think about it differently:

When we click at viewport position `event.clientX`, we want to know:
1. What position in the scroll container did we click?
2. What position in the #timelineRuler did we click?

The formula is:
```
x = event.clientX - rect.left + scrollLeft
```

Let me think about what each term means:
- `event.clientX`: Viewport X position
- `rect.left`: #timelineRuler's left edge in viewport coordinates
- `event.clientX - rect.left`: Position within #timelineRuler (in pixels from its left edge), visible portion only
- `+ scrollLeft`: ???

Wait, I think the issue is that `event.clientX - rect.left` gives us the position within the VISIBLE part of #timelineRuler, not accounting for the part that's scrolled out.

Actually no, `event.clientX - rect.left` gives us the position relative to the #timelineRuler's origin (0,0), even if that origin is off-screen.

If rect.left = -50 (the ruler's left edge is 50px to the left of the viewport):
- Click at viewport x = 500
- Position in ruler = 500 - (-50) = 550px from the ruler's left edge

So we clicked 550px into the ruler. That should correspond to:
- time = 550 / 0.05 = 11000ms = 11 seconds

Then playhead position:
- playheadPosition = 11000ms
- playheadPosition in px = 550px (timeline coordinates)
- playheadVisualPosition = 550 + 150 = 700px (container coordinates)
- Viewport position = scLeft + (700 - scrollLeft) = 0 + (700 - 200) = 500px ✓

Great! So if we DON'T add scrollLeft, we get the correct answer!

## The Bug!

The current code does:
```
x = event.clientX - rect.left + scrollLeft
```

But it should be:
```
x = event.clientX - rect.left
```

WITHOUT adding scrollLeft!

Because `getBoundingClientRect()` already accounts for the scroll position.

Let me verify with another example:

### Example 2: scrollLeft = 0

- rect.left = scLeft + 150 - 0 = 0 + 150 = 150px (ruler's left edge is at viewport x = 150)
- Click at viewport x = 500
- Position in ruler = 500 - 150 = 350px ✓
- time = 350 / 0.05 = 7000ms
- playheadVisualPosition = 350 + 150 = 500px (container coordinates)
- Viewport position = 0 + (500 - 0) = 500px ✓

With the WRONG formula (adding scrollLeft):
```
x = 500 - 150 + 0 = 350px ✓
```

So when scrollLeft = 0, both formulas give the same result!

But when scrollLeft = 200:
- Correct: x = 500 - (-50) = 550px ✓
- Wrong: x = 500 - (-50) + 200 = 750px ✗

## Conclusion

The bug is that the code adds `scrollLeft` to the calculation, but `getBoundingClientRect()` already accounts for scrolling!

The fix is to remove `+ scrollLeft` from both `onRulerMouseDown` and `onDocumentMouseMove`.

## Wait... Let me double-check

Actually, I need to verify this. Let me think about getBoundingClientRect()...

According to MDN:
> The returned DOMRect object contains the top, left, right, and bottom properties, which are relative to the viewport.

So `rect.left` is the element's left edge position in the VIEWPORT, not in the document or container.

When an element is inside a scrolled container:
- If scrollLeft = 0, element at container position 150px appears at viewport position (containerViewportLeft + 150)
- If scrollLeft = 200, element at container position 150px appears at viewport position (containerViewportLeft + 150 - 200)

So `getBoundingClientRect()` DOES account for the scroll position.

Therefore:
```
x = event.clientX - rect.left
```

Should be sufficient! We should NOT add scrollLeft.

## Actually, wait again...

Let me reconsider what we want:
- We want `x` to be the position in timeline coordinates (0 = left edge of ruler)
- event.clientX is in viewport coordinates
- rect.left is #timelineRuler's left edge in viewport coordinates

So:
```
x = event.clientX - rect.left
```

Gives us the position in the ruler's coordinate system, which is what we want!

If the ruler is partially scrolled out of view, rect.left will be negative, and that's fine!

## So the fix is:

Change:
```typescript
const x = event.clientX - rect.left + scrollLeft;
```

To:
```typescript
const x = event.clientX - rect.left;
```

In BOTH `onRulerMouseDown` and `onDocumentMouseMove`.
