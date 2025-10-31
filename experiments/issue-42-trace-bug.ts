/**
 * Experiment to trace the bug in issue #42
 *
 * Issue #42: When starting to drag the preview position bar (playhead) on the ruler,
 * it jumps forward from the cursor.
 *
 * This is supposedly the same bug as issue #29, which was "fixed" in PR #31.
 * But the issue persists, so let's trace through exactly what's happening.
 *
 * HTML Structure (from timeline.component.html):
 * Line 43: <div class="flex-1 flex flex-col overflow-y-auto overflow-x-auto"> <!-- scroll container -->
 * Line 45:   <div class="flex border-b"> <!-- ruler row -->
 * Line 47:     <div class="min-w-[150px]"> <!-- 150px track header spacer -->
 * Line 62:     <div class="relative h-10 bg-[#2a2a2a] flex-1"> <!-- ruler container -->
 * Line 63:       <div class="relative h-full min-w-full cursor-pointer" (mousedown)="onRulerMouseDown($event)">
 *
 * Key Question:
 * When we call getBoundingClientRect() on the .cursor-pointer element (line 63),
 * does rect.left include or exclude the 150px track header?
 *
 * Answer:
 * The .cursor-pointer element is INSIDE the flex container that comes AFTER the 150px header.
 * So rect.left should be 150px to the right of the scroll container's left edge.
 *
 * When user clicks at pixel 200 from the viewport left:
 * - If .cursor-pointer rect.left = 150, then event.clientX - rect.left = 200 - 150 = 50
 * - This gives us the correct position within the timeline (excluding header)
 *
 * BUT: What if the scroll container itself has a left offset from the viewport?
 * Example: scroll container starts at viewport x=10
 * - User clicks at viewport x=200
 * - .cursor-pointer rect.left = 10 (container) + 150 (header) = 160
 * - event.clientX - rect.left = 200 - 160 = 40 (correct timeline position)
 *
 * So far this looks correct. Let's check what happens with the playhead visual position.
 */

describe('Issue #42 Bug Trace', () => {
  const TRACK_HEADER_WIDTH = 150;

  test('trace the bug with playhead visual position', () => {
    // From timeline.component.ts:
    // Line 41-43: playheadPosition = computed(() => this.state().playheadPosition * this.pixelsPerMillisecond())
    // Line 45-47: playheadVisualPosition = computed(() => this.playheadPosition() + TRACK_HEADER_WIDTH)

    // The playhead LINE in the UI is positioned using playheadVisualPosition
    // This adds 150px to account for the track header

    // Scenario: Playhead is at time 2000ms, zoom is 50 pixels/second (0.05 px/ms)
    const playheadTime = 2000; // ms
    const pixelsPerMs = 0.05;
    const playheadPosition = playheadTime * pixelsPerMs; // 100px in timeline coordinates
    const playheadVisualPosition = playheadPosition + TRACK_HEADER_WIDTH; // 250px in DOM coordinates

    expect(playheadPosition).toBe(100);
    expect(playheadVisualPosition).toBe(250);

    // The playhead visual element is positioned at left: 250px
    // This is relative to the scroll container (not the ruler content)

    // Now user clicks on the playhead handle:
    // The playhead handle is visually at 250px from the scroll container's left
    // User's mouse is at the same position

    // In onDocumentMouseMove:
    // - We get rulerContent (the .cursor-pointer element)
    // - rulerContent.getBoundingClientRect() gives us the ruler's bounding box
    // - The ruler starts at TRACK_HEADER_WIDTH (150px) from the scroll container

    // If scroll container is at viewport x=0:
    // - rulerContent rect.left = 150
    // - User clicks at viewport x=250 (on the playhead)
    // - Calculation: x = 250 - 150 + 0 = 100px
    // - newPosition = 100 / 0.05 = 2000ms ✅ CORRECT!

    // So the calculation should be correct. What's the issue then?
  });

  test('hypothesis: playhead visual position is relative to wrong parent', () => {
    // Wait! Let me check the HTML again.
    // The playhead visual element - where is it positioned?

    // Looking at the template, the playhead should be positioned using:
    // [style.left.px]="playheadVisualPosition()"

    // But WHAT ELEMENT is it positioned within?
    // If the playhead is absolutely positioned within the scroll container,
    // then left=250px means 250px from the scroll container's left edge.

    // But the ruler content starts at 150px from the scroll container's left.
    // So the playhead at 250px is visually at position 100px within the ruler.

    // When we calculate position in onDocumentMouseMove:
    // - rulerContent rect.left = 150 (assuming viewport offset = 0)
    // - User mouse at viewport x = 250
    // - x = 250 - 150 + 0 = 100px
    // - This is correct!

    // Unless... the playhead is positioned relative to the RULER CONTENT, not the scroll container!
  });

  test('hypothesis: using wrong element in onDocumentMouseMove', () => {
    // Let's think about this differently.

    // In onRulerMouseDown (line 140-157):
    // - event.currentTarget is the .cursor-pointer element (the one with the mousedown handler)
    // - We get its bounding rect
    // - Calculate: x = event.clientX - rect.left + scrollLeft

    // In onDocumentMouseMove (line 615-638):
    // - We query for scrollContainer
    // - Then query for rulerContent = scrollContainer.querySelector('.cursor-pointer')
    // - Get its bounding rect
    // - Calculate: x = event.clientX - rect.left + scrollLeft

    // Both should give the same result... UNLESS the querySelector returns a different element!

    // Let's check: how many .cursor-pointer elements are there?
    // From the HTML, there should only be one on line 63.

    // But what if scrollContainer is not what we think it is?
  });

  test('hypothesis: wrong scrollContainer query', () => {
    // In onDocumentMouseMove line 619:
    // const scrollContainer = rootElement.querySelector('.flex-1.flex.flex-col.overflow-y-auto.overflow-x-auto')

    // This is supposed to match line 43 in the HTML.
    // But that element has classes: flex-1 flex flex-col overflow-y-auto overflow-x-auto

    // The query uses: .flex-1.flex.flex-col.overflow-y-auto.overflow-x-auto
    // This should work correctly.

    // Then we query: scrollContainer.querySelector('.cursor-pointer')
    // This should find the element on line 63.

    // Hmm, everything looks correct in theory...
  });

  test('THE REAL BUG: playhead handle has drag offset!', () => {
    // Wait, let me reconsider the problem statement:
    // "When starting to drag the preview position bar on the ruler, it jumps forward"

    // What if the issue is specifically when dragging the PLAYHEAD HANDLE,
    // not when clicking on the ruler?

    // In onPlayheadMouseDown (line 159-163):
    // - Sets isDraggingPlayhead = true
    // - But doesn't calculate any offset from where the user clicked!

    // Compare this to media item dragging (line 428-458):
    // - Calculates dragOffsetTime (line 441-453)
    // - This is the offset from the item's start to where user clicked
    // - Used in onTrackMouseMove to maintain cursor position during drag

    // The playhead dragging doesn't have this offset calculation!
    // So when dragging the playhead handle:
    // 1. User clicks on playhead handle (which has some width)
    // 2. onPlayheadMouseDown fires, sets isDraggingPlayhead = true
    // 3. onDocumentMouseMove calculates position from cursor
    // 4. But it doesn't account for where within the handle the user clicked!

    // Example:
    // - Playhead is at position 2000ms (100px in timeline coords)
    // - Playhead visual position is 250px
    // - Playhead handle is, say, 10px wide, centered at 250px (so 245px to 255px)
    // - User clicks at 255px (right edge of handle)
    // - onDocumentMouseMove calculates: x = 255 - 150 = 105px
    // - newPosition = 105 / 0.05 = 2100ms
    // - Playhead jumps forward by 100ms!

    expect('playhead to stay under cursor').toBe('but it jumps because no drag offset');
  });
});

console.log('✅ Found the bug!');
console.log('   The playhead drag doesn\'t calculate the offset from where user clicked');
console.log('   Unlike media items which save dragOffsetTime, playhead uses raw cursor position');
console.log('   Fix: Calculate offset in onPlayheadMouseDown and use it in onDocumentMouseMove');
