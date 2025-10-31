# Issue #50 Deep Analysis

## Problem Statement
According to the issue creator's latest comment (2025-10-31T11:23:04Z): "Это до сих пор не исправлено" (This is still not fixed).

PR #51 was merged with a fix, but the issue persists.

## Two Parts of Issue #50

### Part 1: Preview line position jumps when scrolling
> "Сейчас при изменении позиции линии предпросмотра не учитывается положение скроллинга, из-за этого происходят скачки при перетаскивании линии."

Translation: "Currently when changing the preview line position, the scroll position is not taken into account, which causes jumps when dragging the line."

### Part 2: Tracks should stretch to full project duration
> "Также треки должны растягиваться по всю длину проекта (по числу максимальной длительности)."

Translation: "Also tracks should stretch to the full length of the project (based on maximum duration)."

## Current Implementation Analysis

### Playhead Dragging (onDocumentMouseMove)
```typescript
// Lines 634-661
onDocumentMouseMove(event: MouseEvent): void {
  if (this.isDraggingPlayhead || this.isDraggingFromRuler) {
    const rootElement = event.currentTarget as HTMLElement;
    const scrollContainer = rootElement.querySelector('.flex-1.flex.flex-col.overflow-y-auto.overflow-x-auto') as HTMLElement;

    if (scrollContainer) {
      const rulerContent = scrollContainer.querySelector('.relative.h-full.min-w-full.cursor-pointer') as HTMLElement;

      if (rulerContent) {
        const rect = rulerContent.getBoundingClientRect();
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
}
```

### Ruler Click (onRulerMouseDown)
```typescript
// Lines 144-161
onRulerMouseDown(event: MouseEvent): void {
  event.preventDefault();
  this.isDraggingFromRuler = true;

  const target = event.currentTarget as HTMLElement;
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

## Potential Issues

### Issue 1: Selector Mismatch
The `onDocumentMouseMove` uses a hardcoded selector to find the ruler element:
```typescript
const rulerContent = scrollContainer.querySelector('.relative.h-full.min-w-full.cursor-pointer') as HTMLElement;
```

But `onRulerMouseDown` uses `event.currentTarget` directly.

**Problem**: If the HTML structure changes or the CSS classes are different, the selector might fail or find the wrong element.

### Issue 2: Scroll Container Reference
- `onRulerMouseDown`: Gets scroll container via `target.closest('.overflow-x-auto')`
- `onDocumentMouseMove`: Gets scroll container via `rootElement.querySelector('.flex-1.flex.flex-col.overflow-y-auto.overflow-x-auto')`

**Problem**: These might reference different elements or the querySelector might fail.

### Issue 3: Track Stretching
Looking at the HTML (line 113-114):
```html
<div class="track relative flex-1 bg-[#1a1a1a] min-h-[60px]"
     [style.width.px]="timelineWidth()"
     (mousemove)="onTrackMouseMove($event, track)">
```

The track DOES have `[style.width.px]="timelineWidth()"` which should make it stretch. However, this might not be working because:
- The parent container might have `flex-1` which could override the width
- The width might not be applied correctly due to CSS conflicts

## Hypothesis

The issue might be that:
1. The selectors in `onDocumentMouseMove` are not finding the correct elements
2. The track width is being set but CSS is preventing it from displaying correctly
3. There might be a CSS issue with `min-w-full` on the ruler that's not being applied to tracks

## Next Steps
1. Verify the HTML structure matches the selectors
2. Check if tracks actually have the correct width in the rendered DOM
3. Test if the playhead jump still occurs with the current fix
4. Ensure both ruler AND tracks have consistent width styling
