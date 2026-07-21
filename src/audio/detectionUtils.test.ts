import { describe, expect, it } from 'vitest'
import { ATTACK_MIN_INTERVAL_MS, isRmsAttack } from './detectionUtils'

describe('RMS attack detection', () => {
  it('detects a strong pluck above the ambient baseline', () => {
    expect(isRmsAttack(0.08, 0.02, 0.005, 500)).toBe(true)
  })

  it('rejects normal sustain variation and ambient noise', () => {
    expect(isRmsAttack(0.021, 0.02, 0.005, 500)).toBe(false)
    expect(isRmsAttack(0.004, 0.003, 0.005, 500)).toBe(false)
  })

  it('uses a refractory period to avoid duplicate onsets from one pluck', () => {
    expect(isRmsAttack(0.09, 0.02, 0.005, ATTACK_MIN_INTERVAL_MS - 1)).toBe(false)
    expect(isRmsAttack(0.09, 0.02, 0.005, ATTACK_MIN_INTERVAL_MS)).toBe(true)
  })
})
