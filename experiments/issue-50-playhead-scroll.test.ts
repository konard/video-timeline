/**
 * Issue #50: Playhead Jump When Scrolled
 *
 * Problem: When timeline is scrolled, dragging the playhead causes it to jump
 *
 * Analysis:
 * 1. onRulerMouseDown (lines 144-161) - handles initial click on ruler
 * 2. onPlayheadMouseDown (lines 163-167) - handles click on playhead
 * 3. onDocumentMouseMove (lines 634-656) - handles dragging
 *
 * Current implementation in onDocumentMouseMove:
 * - Finds scroll container with selector: '.flex-1.flex.flex-col.overflow-y-auto.overflow-x-auto'
 * - Gets scrollLeft from container
 * - Calculates: x = event.clientX - rect.left + scrollLeft - TRACK_HEADER_WIDTH
 *
 * Potential issues:
 * 1. Selector might not be finding the right element
 * 2. getBoundingClientRect() is called on scrollContainer, not the ruler
 * 3. TRACK_HEADER_WIDTH subtraction might be inconsistent with initial click
 *
 * Expected behavior:
 * - When you click on ruler at position X, playhead should move to X
 * - When you drag playhead, it should follow the cursor smoothly regardless of scroll
 * - No jumps when scrolling is present
 */

// Test case 1: Initial click on ruler with scroll
function testRulerClickWithScroll() {
  console.log('Test 1: Ruler click with scroll');

  // Scenario:
  // - Timeline scrolled 200px to the right
  // - User clicks at visual position 300px from left edge of viewport
  // - Expected: playhead moves to time position accounting for scroll

  const TRACK_HEADER_WIDTH = 150;
  const pixelsPerMs = 0.05; // 50 pixels per second / 1000
  const scrollLeft = 200;

  // Simulating onRulerMouseDown logic:
  // event.clientX = 300 (from viewport left)
  // rect.left = 150 (ruler starts after track header)
  // scrollLeft = 200

  const eventClientX = 300;
  const rectLeft = 150; // Track header width

  // Current implementation in onRulerMouseDown (line 154):
  const x = eventClientX - rectLeft + scrollLeft;
  const position = x / pixelsPerMs;

  console.log(`  clientX: ${eventClientX}px`);
  console.log(`  rect.left: ${rectLeft}px`);
  console.log(`  scrollLeft: ${scrollLeft}px`);
  console.log(`  Calculated x: ${x}px`);
  console.log(`  Playhead position: ${position}ms`);
  console.log(`  Expected: ${(300 - 150 + 200) / pixelsPerMs}ms = ${(350) / pixelsPerMs}ms`);
  console.log('');
}

// Test case 2: Dragging playhead with scroll
function testPlayheadDragWithScroll() {
  console.log('Test 2: Playhead drag with scroll');

  // Scenario:
  // - Timeline scrolled 200px to the right
  // - User drags playhead
  // - Mouse moves to visual position 300px from left edge of viewport

  const TRACK_HEADER_WIDTH = 150;
  const pixelsPerMs = 0.05;
  const scrollLeft = 200;

  // Simulating onDocumentMouseMove logic:
  // scrollContainer.getBoundingClientRect().left would be the left edge of the scroll container
  // In the HTML, this is the parent of the ruler and tracks, which starts at 0

  const eventClientX = 300;
  const scrollContainerRectLeft = 0; // Scroll container starts at viewport left

  // Current implementation in onDocumentMouseMove (line 647):
  const x = eventClientX - scrollContainerRectLeft + scrollLeft - TRACK_HEADER_WIDTH;
  const position = x / pixelsPerMs;

  console.log(`  clientX: ${eventClientX}px`);
  console.log(`  scrollContainer rect.left: ${scrollContainerRectLeft}px`);
  console.log(`  scrollLeft: ${scrollLeft}px`);
  console.log(`  TRACK_HEADER_WIDTH: ${TRACK_HEADER_WIDTH}px`);
  console.log(`  Calculated x: ${x}px`);
  console.log(`  Playhead position: ${position}ms`);
  console.log(`  Expected: should be same as Test 1 = ${(350) / pixelsPerMs}ms`);
  console.log('');
}

// Test case 3: Inconsistency analysis
function analyzeInconsistency() {
  console.log('Test 3: Inconsistency Analysis');
  console.log('');
  console.log('Issue identified:');
  console.log('  In onRulerMouseDown:');
  console.log('    - Uses ruler element getBoundingClientRect()');
  console.log('    - rect.left = TRACK_HEADER_WIDTH (150px)');
  console.log('    - x = clientX - rect.left + scrollLeft');
  console.log('');
  console.log('  In onDocumentMouseMove:');
  console.log('    - Uses scrollContainer getBoundingClientRect()');
  console.log('    - rect.left = 0 (container starts at viewport left)');
  console.log('    - x = clientX - rect.left + scrollLeft - TRACK_HEADER_WIDTH');
  console.log('');
  console.log('  These calculations should be equivalent, but the different');
  console.log('  elements used for getBoundingClientRect() may cause issues');
  console.log('  depending on the actual DOM structure.');
  console.log('');
  console.log('Solution:');
  console.log('  Use consistent element for getBoundingClientRect() in both methods');
  console.log('  OR ensure the math accounts for the difference correctly');
}

// Run tests
testRulerClickWithScroll();
testPlayheadDragWithScroll();
analyzeInconsistency();

export {};
