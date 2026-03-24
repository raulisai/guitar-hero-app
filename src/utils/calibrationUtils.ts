interface CalibrationSample {
  expectedTime: number  // time of Tone.js click
  detectedTime: number  // time of note detected by Pitchy
}

// Calculate average latency offset, filtering outliers via IQR
export function calculateLatencyOffset(samples: CalibrationSample[]): number {
  if (samples.length < 3) return 0

  const diffs = samples.map(s => s.detectedTime - s.expectedTime)
  diffs.sort((a, b) => a - b)

  const q1Idx = Math.floor(diffs.length * 0.25)
  const q3Idx = Math.ceil(diffs.length * 0.75)
  const filtered = diffs.slice(q1Idx, q3Idx)

  const avg = filtered.reduce((a, b) => a + b, 0) / filtered.length
  return Math.round(avg)
}
