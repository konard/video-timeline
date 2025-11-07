/**
 * Experiment to verify the time markers issue
 * Issue #85: The last time mark extends beyond the timeline causing container expansion
 */

// Simulated getTimeMarkers with current implementation
function getCurrentMarkers(totalDuration, stepMs, pixelsPerMs) {
  const markers = [];

  for (let time = 0; time <= totalDuration; time += stepMs) {
    markers.push({
      position: time * pixelsPerMs,
      time: time,
      label: `${Math.floor(time / 60000)}:${String(Math.floor((time % 60000) / 1000)).padStart(2, '0')}`
    });
  }

  return markers;
}

// Proposed fix: exclude the last marker
function getFixedMarkers(totalDuration, stepMs, pixelsPerMs) {
  const markers = [];

  for (let time = 0; time < totalDuration; time += stepMs) {
    markers.push({
      position: time * pixelsPerMs,
      time: time,
      label: `${Math.floor(time / 60000)}:${String(Math.floor((time % 60000) / 1000)).padStart(2, '0')}`
    });
  }

  return markers;
}

// Test with example values
const totalDuration = 60000; // 60 seconds
const stepMs = 5000; // 5 seconds
const pixelsPerMs = 0.05; // 50 pixels per second

console.log('Current implementation (with last marker):');
const currentMarkers = getCurrentMarkers(totalDuration, stepMs, pixelsPerMs);
console.log(`Total markers: ${currentMarkers.length}`);
console.log('Last 3 markers:');
currentMarkers.slice(-3).forEach(m => {
  console.log(`  Time: ${m.time}ms, Position: ${m.position}px, Label: ${m.label}`);
});
console.log(`Timeline width: ${totalDuration * pixelsPerMs}px`);
console.log(`Last marker at: ${currentMarkers[currentMarkers.length - 1].position}px`);
console.log(`Issue: Last marker is exactly at totalDuration, text extends beyond timeline\n`);

console.log('Fixed implementation (without last marker):');
const fixedMarkers = getFixedMarkers(totalDuration, stepMs, pixelsPerMs);
console.log(`Total markers: ${fixedMarkers.length}`);
console.log('Last 3 markers:');
fixedMarkers.slice(-3).forEach(m => {
  console.log(`  Time: ${m.time}ms, Position: ${m.position}px, Label: ${m.label}`);
});
console.log(`Timeline width: ${totalDuration * pixelsPerMs}px`);
console.log(`Last marker at: ${fixedMarkers[fixedMarkers.length - 1].position}px`);
console.log(`Solution: Last marker is before totalDuration, no overflow\n`);
