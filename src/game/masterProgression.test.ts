import { describe, expect, it } from 'vitest'
import type { DetectedNote, ExpectedNote } from '../types'
import {
  getMasterTimeout,
  MASTER_NOTE_TIMEOUT_MS,
  MASTER_WAIT_SAFETY_TIMEOUT_MS,
  shouldAdvanceMasterBeat,
} from './masterProgression'

const expected: ExpectedNote = {
  midi: 45,
  name: 'A2',
  timestamp: 2000,
  beat: 0,
  bar: 0,
  duration: 250,
  chordMidis: [45],
}

function detection(overrides: Partial<DetectedNote> = {}): DetectedNote {
  return {
    midi: 45,
    name: 'A2',
    frequency: 110,
    clarity: 0.95,
    timestamp: 2200,
    onset: 2150,
    cents: 0,
    rms: 0.08,
    stableFrames: 4,
    ...overrides,
  }
}

describe('master progression', () => {
  it('advances only on a fresh matching attack', () => {
    expect(shouldAdvanceMasterBeat(expected, detection(), 1500)).toBe(true)
    expect(shouldAdvanceMasterBeat(expected, detection({ midi: 48 }), 1500)).toBe(false)
    expect(shouldAdvanceMasterBeat(expected, detection({ onset: 1200 }), 1500)).toBe(false)
  })

  it('accepts a repeated pitch only after it is plucked again', () => {
    const repeatedExpected = { ...expected, timestamp: 2600, beat: 1 }
    const oldSustain = detection({ timestamp: 2650, onset: 2150, stableFrames: 20 })
    const newPluck = detection({ timestamp: 2770, onset: 2700, stableFrames: 3 })

    expect(shouldAdvanceMasterBeat(repeatedExpected, oldSustain, 2200)).toBe(false)
    expect(shouldAdvanceMasterBeat(repeatedExpected, newPluck, 2200)).toBe(true)
  })

  it('always has a finite timeout, including wait mode', () => {
    expect(getMasterTimeout(false)).toBe(MASTER_NOTE_TIMEOUT_MS)
    expect(getMasterTimeout(true)).toBe(MASTER_WAIT_SAFETY_TIMEOUT_MS)
    expect(getMasterTimeout(true)).toBeGreaterThan(getMasterTimeout(false))
  })
})
