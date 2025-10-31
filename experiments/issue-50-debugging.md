# Issue #50 Debugging Analysis

## Problem Statement
According to issue owner's comment on 2025-10-31:
> "Не исправлено. При клике на линейке, если горизонтальный скроллинг находится не в начальном положении, линия перемещается дальше, чем место, на которое кликнули (скроллинг не учитывается). Исправить."

Translation:
> "Not fixed. When clicking on the timeline, if horizontal scrolling is not in the initial position, the line moves further than where you clicked (scrolling is not accounted for). Fix."

## Current Implementation Analysis

### ViewChild Approach (Already Implemented)
The code currently uses `@ViewChild('timelineRuler')` to get a reference to the ruler element.

**In TypeScript (line 22):**
```typescript
@ViewChild('timelineRuler') timelineRuler?: ElementRef<HTMLElement>;
```

**In HTML (line 67):**
```html
#timelineRuler
```

### Coordinate Calculation

**onRulerMouseDown (lines 147-164):**
```typescript
onRulerMouseDown(event: MouseEvent): void {
  event.preventDefault();
  this.isDraggingFromRuler = true;

  const target = event.currentTarget as HTMLElement;  // #timelineRuler element
  const rect = target.getBoundingClientRect();
  const scrollContainer = target.closest('.overflow-x-auto') as HTMLElement;
  const scrollLeft = scrollContainer ? scrollContainer.scrollLeft : 0;
  const x = event.clientX - rect.left + scrollLeft;
  const newPosition = x / this.pixelsPerMillisecond();

  this.state.update(s => ({
    ...s,
    playheadPosition: Math.max(0, Math.min(newPosition, s.totalDuration))
  }));
}
```

**onDocumentMouseMove (lines 637-660):**
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

## Potential Issues to Investigate

### 1. HTML Structure
The scroll container is:
```html
<div class="flex-1 flex flex-col overflow-y-auto overflow-x-auto relative">
```

The ruler element is:
```html
<div class="relative h-full min-w-full cursor-pointer"
     [style.width.px]="timelineWidth()"
     (mousedown)="onRulerMouseDown($event)"
     #timelineRuler>
```

**Question:** Is the ruler element the direct child of the scroll container, or is there a wrapper?

Looking at the HTML:
- Line 47: Scroll container `<div class="flex-1 flex flex-col overflow-y-auto overflow-x-auto relative">`
- Line 49: Ruler row `<div class="flex border-b border-[#3a3a3a] flex-shrink-0">`
- Line 63: Ruler content wrapper `<div class="relative h-10 bg-[#2a2a2a] flex-1">`
- Line 64: Ruler element with #timelineRuler `<div class="relative h-full min-w-full cursor-pointer" #timelineRuler>`

**Structure:**
```
scroll-container (overflow-x-auto)
  └─ ruler-row (flex)
      ├─ control-area (min-w-[150px]) - FIXED WIDTH
      └─ ruler-content-wrapper (flex-1)
          └─ #timelineRuler (with width set to timelineWidth())
```

### 2. The Problem
When the user clicks on the ruler, the calculation is:
```
x = event.clientX - rect.left + scrollLeft
```

Where:
- `event.clientX` = mouse X position in viewport
- `rect.left` = ruler element's left edge in viewport
- `scrollLeft` = horizontal scroll offset

**However**, the ruler element has a fixed 150px control area to its left!

Let me check if this is the issue...

### 3. Hypothesis

The ruler content wrapper (line 63) has `flex-1` which makes it grow, but there's a 150px fixed control area to the left.

When we do `rect.left`, we're getting the left edge of the `#timelineRuler` element, which is:
- After the 150px control area
- Inside the ruler content wrapper

So the calculation should be:
```
x = event.clientX - rect.left + scrollLeft
```

This should be correct because `rect.left` already accounts for the 150px offset in viewport coordinates.

### 4. Wait - Let's Check the Playhead Position

The playhead uses `playheadVisualPosition()`:
```typescript
readonly playheadVisualPosition = computed(() => {
  return this.playheadPosition() + this.TRACK_HEADER_WIDTH;
});
```

Where `TRACK_HEADER_WIDTH = 150`.

So the playhead position includes the 150px offset!

But when we calculate the click position, we're doing:
```
x = event.clientX - rect.left + scrollLeft
```

And `rect.left` is the left edge of `#timelineRuler`, which is AFTER the 150px control area.

So:
- Click position `x` is relative to the start of `#timelineRuler` (after 150px offset)
- Playhead visual position is `playheadPosition() + 150`

Wait, that should be correct...

### 5. Deeper Investigation Needed

Let me think about this more carefully:

1. The scroll container scrolls horizontally
2. Inside the scroll container, we have:
   - A fixed 150px control area (doesn't scroll)
   - The ruler content that scrolls

Actually, looking at the HTML more carefully:

Line 51-61: Control area has `min-w-[150px]` but no fixed positioning
Line 63-75: Ruler content has `flex-1` and grows

So when we scroll, BOTH the control area and the ruler content are inside the scrollable area!

### 6. The Real Issue?

If the control area is also inside the scrollable container, then when we scroll:
- The control area might partially scroll out of view
- The ruler element's `rect.left` changes based on scroll position

But wait, that doesn't make sense for a timeline editor. The control area should be fixed...

Let me check if there's a fixed positioning on the control area...

Looking at line 51: `<div class="min-w-[150px] bg-[#252525] border-r border-[#3a3a3a] flex justify-center items-center gap-1 p-2">`

No `position: fixed` or `position: sticky`!

**This might be the issue!** The control area is scrolling along with the content, which might cause coordinate calculation problems.

### 7. Expected Behavior

For a timeline editor:
- The track headers (left side, 150px wide) should be FIXED and not scroll horizontally
- Only the timeline content (ruler + tracks) should scroll horizontally

Let me check the track headers...

Line 83: Track header: `<div class="flex items-center justify-between min-w-[150px] p-2 bg-[#252525] border-r border-[#3a3a3a]">`

Also no fixed positioning!

So the current implementation allows the entire content (including headers) to scroll horizontally, which is unusual for a timeline editor.

### 8. Testing Hypothesis

To confirm the issue, we need to:
1. Build the application
2. Add some media items to extend the timeline width
3. Scroll horizontally
4. Click on the ruler and observe if the playhead jumps

If the playhead jumps, then the coordinate calculation is wrong.

### 9. Possible Fixes

**Option A: Keep current layout, fix coordinate calculation**
- Ensure the coordinate calculation properly accounts for all offsets
- This is what the ViewChild approach tried to do

**Option B: Change layout to have fixed headers**
- Make track headers and control area fixed (sticky)
- Only scroll the timeline content
- This is more standard for timeline editors

Let me investigate the coordinate calculation more carefully...

### 10. Detailed Coordinate Analysis

When clicking on the ruler:

**Viewport:**
```
[---Viewport---]
 ^             ^
 0         clientX (mouse position)
```

**Scroll Container (scrolled right by scrollLeft pixels):**
```
[---Visible Part of Container---]
^                                ^
scrollLeft                   scrollLeft + viewportWidth
```

**Inside Container:**
```
[Control Area 150px][#timelineRuler .........]
^                   ^                         ^
0                   150px                     timelineWidth() + 150px
```

**When we click:**
- `event.clientX` = mouse X in viewport
- `rect = rulerElement.getBoundingClientRect()` = position of #timelineRuler in viewport
- `rect.left` = distance from viewport left edge to #timelineRuler left edge

**If scrollLeft = 0:**
- rect.left = 150px (because control area is 150px wide)
- x = clientX - 150 + 0 = clientX - 150
- This is correct! Click at 150px viewport = position 0 in ruler

**If scrollLeft = 100:**
- The container has scrolled 100px to the right
- rect.left = 150 - 100 = 50px (the #timelineRuler is now 100px closer to viewport left)
- x = clientX - 50 + 100 = clientX + 50
- For click at viewport x=50: x = 50 + 50 = 100px in ruler
- But without scroll, click at viewport x=50 would be: x = 50 - 150 + 0 = -100 (invalid)

Hmm, this is getting confusing. Let me think about it differently...

### 11. Alternative Analysis

The formula is:
```
x = event.clientX - rect.left + scrollLeft
```

This gives us the position in the element's coordinate system, accounting for scroll.

But we want the position in the **timeline's coordinate system**, which starts at 0 at the left edge of the ruler content (after the 150px header).

The playhead visual position is:
```
playheadVisualPosition = playheadPosition + 150
```

So when we set playheadPosition, we need to ensure:
- playheadPosition = 0 means the left edge of the ruler (time 0)
- playheadVisualPosition = 150 means 150px from the left edge of the scroll container

So when we click:
- If we click at the left edge of #timelineRuler
- event.clientX - rect.left = 0 (click is at rect.left)
- x = 0 + scrollLeft
- newPosition = scrollLeft / pixelsPerMillisecond()

Wait, that's wrong! If we click at the left edge of the ruler (time 0), we should get newPosition = 0, not scrollLeft!

**I think I found the bug!**

The formula should be:
```
x = event.clientX - rect.left + scrollLeft
```

But this gives us a position that includes scrollLeft, which is wrong.

When scrollLeft = 0:
- Click at ruler left edge: clientX = rect.left, x = 0 ✓

When scrollLeft = 100:
- Click at ruler left edge (which is now at viewport x = rect.left):
  - clientX = rect.left
  - x = rect.left - rect.left + 100 = 100 ✗
  - We should get x = 0!

**The correct formula should be:**
```
x = event.clientX - rect.left
```

Without adding scrollLeft! Because rect.left already accounts for the scroll position.

NO WAIT. Let me think again...

When scrollLeft = 100, the container has scrolled 100px to the right, meaning:
- The left 100px of content is now hidden (scrolled out of view to the left)
- The ruler's left edge (time 0) is 100px to the left of the visible area
- If we click at viewport position rect.left, we're clicking at timeline position 100px (not 0)

So the formula SHOULD include scrollLeft:
```
x = (event.clientX - rect.left) + scrollLeft
```

Where:
- `event.clientX - rect.left` = position within the visible part of the ruler
- `+ scrollLeft` = adjust for the part that's scrolled out of view

Let me verify:
- scrollLeft = 100
- Click at ruler's visible left edge: clientX = rect.left
- x = (rect.left - rect.left) + 100 = 100 ✓ (we clicked at the part that's at timeline position 100)

- scrollLeft = 100
- Click 50px to the right of ruler's visible left edge: clientX = rect.left + 50
- x = (rect.left + 50 - rect.left) + 100 = 150 ✓

This seems correct!

### 12. So What's the Actual Bug?

If the formula is correct, why does the issue owner say it's still broken?

Let me check if there's a mismatch between onRulerMouseDown and onDocumentMouseMove...

Both use the same formula, both use the ViewChild reference... they should be consistent.

**Hypothesis:** Maybe the issue is that the playhead is positioned relative to the scroll container, not relative to the ruler element?

Let me check the playhead positioning again...

The playhead is at line 162-167:
```html
<div class="absolute top-0 bottom-0 pointer-events-none z-[1000]"
     [style.left.px]="playheadVisualPosition()"
     (mousedown)="onPlayheadMouseDown($event)">
```

It's positioned with `position: absolute` and `left` style.

The parent is the scroll container (line 47).

So the playhead's left position is relative to the scroll container's left edge (not the viewport).

When scrollLeft = 0:
- Playhead at timeline position 0: left = 0 + 150 = 150px from container left ✓

When scrollLeft = 100:
- Playhead at timeline position 100: left = 100 + 150 = 250px from container left
- But the container is scrolled 100px, so the playhead appears at viewport position 250 - 100 = 150px from viewport left ✓

This seems correct too!

### 13. Need to Actually Test

I think the implementation might actually be correct, but we need to build and test to confirm.

Alternatively, the issue owner might be testing an older version without the ViewChild fix merged yet.

Let me check when PR #52 was merged...

Looking at git log:
- f259966: Merge pull request #52 (which includes the ViewChild fix)
- 3457e07: "Initial commit with task details for issue #50" (HEAD)

Wait, the current HEAD (3457e07) is BEFORE the merge (f259966)?

Let me check the git structure more carefully...

## Conclusion

Need to:
1. Build the project and manually test
2. Verify the fix is actually present in the current code
3. If fix is present but issue persists, investigate further
4. If fix is not present, cherry-pick or re-apply the fix
