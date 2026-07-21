import { describe, expect, it } from 'vitest'
import { calculateLatencyOffset } from './calibrationUtils'

describe('latency calibration', () => {
  it('returns zero until enough fresh attacks were captured', () => {
    expect(calculateLatencyOffset([])).toBe(0)
    expect(calculateLatencyOffset([{ expectedTime: 1000, detectedTime: 1120 }])).toBe(0)
  })

  it('uses matching clocks and filters reaction-time outliers', () => {
    const offsets = [100, 110, 120, 130, 900]
    const samples = offsets.map((offset, index) => ({
      expectedTime: 10_000 + index * 1000,
      detectedTime: 10_000 + index * 1000 + offset,
    }))
    expect(calculateLatencyOffset(samples)).toBe(120)
  })
})
