/**
 * Experiment to understand and fix playhead drag offset issue
 *
 * Issue #29: When starting to drag the preview line (playhead), its position
 * jumps forward from the cursor because the left offset (TRACK_HEADER_WIDTH)
 * is not taken into account.
 *
 * Root Cause Analysis:
 * - The playhead visual position includes TRACK_HEADER_WIDTH (150px offset)
 * - playheadVisualPosition = playheadPosition + TRACK_HEADER_WIDTH
 * - When dragging, onDocumentMouseMove calculates position from contentWrapper rect
 * - But it doesn't subtract TRACK_HEADER_WIDTH, causing a 150px forward jump
 *
 * Expected Behavior:
 * - When user clicks/drags the playhead handle, it should stay under the cursor
 * - The calculation should account for the TRACK_HEADER_WIDTH offset
 */

describe('Playhead Drag Offset Fix', () => {
  const TRACK_HEADER_WIDTH = 150;

  // Simulate the current buggy behavior
  function calculatePositionBuggy(
    clientX: number,
    rectLeft: number,
    scrollLeft: number,
    pixelsPerMs: number
  ): number {
    const x = clientX - rectLeft + scrollLeft;
    return x / pixelsPerMs;
  }

  // Proposed fix: subtract TRACK_HEADER_WIDTH from x
  function calculatePositionFixed(
    clientX: number,
    rectLeft: number,
    scrollLeft: number,
    pixelsPerMs: number,
    trackHeaderWidth: number
  ): number {
    const x = clientX - rectLeft + scrollLeft - trackHeaderWidth;
    return x / pixelsPerMs;
  }

  test('should demonstrate the bug', () => {
    // Setup: user clicks at pixel position 200 from the left of contentWrapper
    // Playhead should be at (200 - 150) = 50 pixels in timeline coordinate
    const clientX = 200;
    const rectLeft = 0;
    const scrollLeft = 0;
    const pixelsPerMs = 0.05; // 50 pixels per second, 0.05 pixels per ms

    const buggyPosition = calculatePositionBuggy(clientX, rectLeft, scrollLeft, pixelsPerMs);
    // Buggy calculation: 200 / 0.05 = 4000ms
    expect(buggyPosition).toBe(4000);

    const fixedPosition = calculatePositionFixed(clientX, rectLeft, scrollLeft, pixelsPerMs, TRACK_HEADER_WIDTH);
    // Fixed calculation: (200 - 150) / 0.05 = 1000ms
    expect(fixedPosition).toBe(1000);

    // The difference is exactly TRACK_HEADER_WIDTH / pixelsPerMs
    expect(buggyPosition - fixedPosition).toBe(TRACK_HEADER_WIDTH / pixelsPerMs);
  });

  test('should work correctly with scroll offset', () => {
    const clientX = 300;
    const rectLeft = 50;
    const scrollLeft = 100;
    const pixelsPerMs = 0.05;

    const fixedPosition = calculatePositionFixed(clientX, rectLeft, scrollLeft, pixelsPerMs, TRACK_HEADER_WIDTH);
    // (300 - 50 + 100 - 150) / 0.05 = 200 / 0.05 = 4000ms
    expect(fixedPosition).toBe(4000);
  });
});

console.log('✅ Experiment complete: Fix is to subtract TRACK_HEADER_WIDTH from x coordinate');
console.log('   onDocumentMouseMove should use: const x = event.clientX - rect.left + scrollLeft - TRACK_HEADER_WIDTH;');
