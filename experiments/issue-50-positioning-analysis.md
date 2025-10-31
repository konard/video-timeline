# Issue #50: Playhead Positioning Analysis

## HTML Structure

```
<div class="flex-1 flex flex-col overflow-y-auto overflow-x-auto relative">  ← Scrollable container
  <!-- Ruler -->
  <div class="flex border-b border-[#3a3a3a] flex-shrink-0">
    <div class="min-w-[150px] ...">  ← Track header (150px wide)
      <!-- Controls -->
    </div>
    <div class="relative h-10 bg-[#2a2a2a] flex-1">
      <div class="relative h-full min-w-full cursor-pointer"
           [style.width.px]="timelineWidth()">  ← Ruler content with dynamic width
        <!-- Time markers -->
      </div>
    </div>
  </div>

  <!-- Tracks -->
  <div class="flex-1">
    @for (track of state().tracks; track track.id) {
      <div class="flex border-b border-[#3a3a3a] min-h-[60px]">
        <div class="flex items-center justify-between min-w-[150px] ...">  ← Track header (150px wide)
          <!-- Track controls -->
        </div>
        <div class="track relative flex-1 bg-[#1a1a1a] min-h-[60px]"
             [style.width.px]="timelineWidth()">  ← Track content with dynamic width
          <!-- Media items -->
        </div>
      </div>
    }
  </div>

  <!-- Playhead - ABSOLUTELY positioned -->
  <div class="absolute top-0 bottom-0 pointer-events-none z-[1000]"
       [style.left.px]="playheadVisualPosition()">  ← Absolute position!
    <!-- Playhead elements -->
  </div>
</div>
```

## The Problem

The playhead is positioned with `position: absolute` and `left: X px` where X is calculated as:
```typescript
playheadVisualPosition() = playheadPosition() + TRACK_HEADER_WIDTH
```

Where:
- `playheadPosition()` = time position in milliseconds * pixelsPerMillisecond
- `TRACK_HEADER_WIDTH` = 150px (to offset for the track headers)

**The issue:** This absolute positioning is relative to the scrollable container, NOT relative to the timeline content!

## Why This Causes Jumps

When the scrollable container is scrolled:
- The timeline content (ruler and tracks) scroll horizontally
- But the playhead's absolute `left` position doesn't change
- The playhead appears to be at a different position in the timeline

Example:
- Timeline is scrolled 200px to the right (scrollLeft = 200)
- Playhead is at time position 5000ms
- pixelsPerMillisecond = 0.05 (50px/second)
- playheadPosition = 5000 * 0.05 = 250px
- playheadVisualPosition = 250 + 150 = 400px
- So the playhead is at `left: 400px` absolute

**But wait** - since the container is scrolled 200px to the right, the visible timeline content starts at 200px. So the playhead at `left: 400px` appears to be at timeline position 400px, but the actual timeline content at that visual position is at 600px (400 + 200 scroll)!

## The Fix from PR #51

PR #51 tried to fix the dragging calculation by using consistent elements for `getBoundingClientRect()`. But this doesn't fix the fundamental positioning issue!

The problem is that the playhead's position should account for scroll offset, OR the playhead should be positioned relative to the timeline content, not the scrollable container.

## Possible Solutions

### Solution 1: Account for scroll in playhead position
```typescript
playheadVisualPosition() {
  // This won't work because we don't have access to scrollLeft in the computed
  return this.playheadPosition() + this.TRACK_HEADER_WIDTH - scrollLeft;
}
```
Problem: Can't access scrollLeft in a computed property.

### Solution 2: Position playhead relative to timeline content
Move the playhead div from being a child of the scrollable container to being a child of the ruler/track content area.

Problem: The playhead needs to span both ruler and tracks, so it can't be in just one.

### Solution 3: Keep absolute positioning but DON'T subtract scroll offset
The current fix in PR #51 uses:
```typescript
const x = event.clientX - rect.left + scrollLeft;
```

This adds scrollLeft to account for the scroll. But the playhead position doesn't account for scroll when displaying!

Wait... let me re-think this...

## Re-analysis

Actually, looking at the code more carefully:

1. Playhead is absolutely positioned inside the scrollable container
2. When container scrolls, the playhead scrolls WITH it (because it's a child)
3. The playhead's `left` position is set to `playheadVisualPosition()`

So when scrolled:
- Container has `scrollLeft = 200px`
- Playhead is at `left: 400px` (absolute within container)
- The playhead DOES scroll with the container
- So visually, the playhead appears at `400px - 200px = 200px` from the left edge of the viewport

Wait no, that's not right either. Absolute positioning is relative to the nearest positioned ancestor (the container with `position: relative`), not affected by scroll!

Let me verify: If an element has `position: absolute` and is inside a scrollable container with `position: relative`, does the absolute element scroll with the container?

**YES!** Absolutely positioned elements DO scroll with their container if they're inside it.

So the playhead SHOULD scroll correctly...

## The Real Issue?

Maybe the issue isn't with the positioning, but with the DRAGGING calculation still being wrong?

Looking at onDocumentMouseMove (lines 634-661):
```typescript
const rulerContent = scrollContainer.querySelector('.relative.h-full.min-w-full.cursor-pointer') as HTMLElement;
```

This selector might be finding the wrong element or not finding anything at all!

If `rulerContent` is `null`, then the playhead position won't update during dragging, which would appear as a "jump" when you release.

## Hypothesis

The selector `.relative.h-full.min-w-full.cursor-pointer` might not be finding the ruler element correctly, causing the playhead to not update during dragging.

## Next Steps

1. Verify the selector is correct
2. Add error handling/logging if selector fails
3. Test that both onRulerMouseDown and onDocumentMouseMove are using the exact same element reference
