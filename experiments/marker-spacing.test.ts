/**
 * Experiment to test dynamic marker spacing algorithm for timeline ruler
 *
 * Issue: Time markers on the ruler overlap when zooming in/out
 * Solution: Adjust marker intervals dynamically based on zoom level
 */

interface TimeMarker {
  position: number;
  label: string;
}

// Constants from TimelineComponent
const MIN_ZOOM = 10;
const MAX_ZOOM = 200;
const TOTAL_DURATION = 60000; // 60 seconds in milliseconds

// Minimum spacing between markers in pixels to prevent overlap
const MIN_MARKER_SPACING_PX = 60; // Enough space for "0:00.000" text (about 50-60px)

/**
 * Calculate appropriate time interval for markers based on zoom level
 * @param zoomLevel - pixels per second
 * @returns time interval in milliseconds
 */
function getMarkerInterval(zoomLevel: number): number {
  // Calculate how much time represents MIN_MARKER_SPACING_PX at current zoom
  const pixelsPerMs = zoomLevel / 1000;
  const minTimeSpacing = MIN_MARKER_SPACING_PX / pixelsPerMs;

  // Define possible intervals (in ms): 100ms, 250ms, 500ms, 1s, 2s, 5s, 10s, 30s, 60s
  const intervals = [100, 250, 500, 1000, 2000, 5000, 10000, 30000, 60000];

  // Find the smallest interval that's larger than or equal to minTimeSpacing
  for (const interval of intervals) {
    if (interval >= minTimeSpacing) {
      return interval;
    }
  }

  // If even 60s is too small, use larger intervals
  return Math.ceil(minTimeSpacing / 60000) * 60000;
}

/**
 * Format time for display
 */
function formatTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  const ms = milliseconds % 1000;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Get time markers with dynamic interval based on zoom level
 */
function getTimeMarkers(zoomLevel: number, totalDuration: number): TimeMarker[] {
  const markers: TimeMarker[] = [];
  const pixelsPerMs = zoomLevel / 1000;
  const interval = getMarkerInterval(zoomLevel);

  for (let time = 0; time <= totalDuration; time += interval) {
    markers.push({
      position: time * pixelsPerMs,
      label: formatTime(time)
    });
  }

  return markers;
}

/**
 * Test function to validate marker spacing
 */
function testMarkerSpacing() {
  console.log('Testing dynamic marker spacing algorithm\n');
  console.log('Minimum marker spacing:', MIN_MARKER_SPACING_PX, 'pixels\n');

  // Test various zoom levels
  const zoomLevels = [MIN_ZOOM, 20, 30, 50, 70, 100, 150, MAX_ZOOM];

  for (const zoom of zoomLevels) {
    const markers = getTimeMarkers(zoom, TOTAL_DURATION);
    const interval = getMarkerInterval(zoom);
    const pixelsPerMs = zoom / 1000;
    const actualSpacing = interval * pixelsPerMs;

    console.log(`Zoom: ${zoom} px/s`);
    console.log(`  Interval: ${interval}ms (${formatTime(interval)})`);
    console.log(`  Marker spacing: ${actualSpacing.toFixed(2)} pixels`);
    console.log(`  Total markers: ${markers.length}`);
    console.log(`  Spacing OK: ${actualSpacing >= MIN_MARKER_SPACING_PX ? '✓' : '✗'}`);

    // Show first few markers
    console.log(`  First 5 markers:`);
    for (let i = 0; i < Math.min(5, markers.length); i++) {
      console.log(`    ${markers[i].label} at ${markers[i].position.toFixed(2)}px`);
    }
    console.log('');
  }

  // Test edge cases
  console.log('Edge case tests:');

  // Very low zoom
  const veryLowZoom = 5;
  const lowZoomInterval = getMarkerInterval(veryLowZoom);
  console.log(`  Very low zoom (${veryLowZoom} px/s): interval = ${lowZoomInterval}ms`);

  // Very high zoom
  const veryHighZoom = 500;
  const highZoomInterval = getMarkerInterval(veryHighZoom);
  console.log(`  Very high zoom (${veryHighZoom} px/s): interval = ${highZoomInterval}ms`);
}

// Run tests
testMarkerSpacing();

export { getMarkerInterval, getTimeMarkers, formatTime };
