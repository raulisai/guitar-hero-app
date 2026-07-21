import { describe, expect, it } from 'vitest'
import type { DetectedNote, ExpectedNote } from '../types'
import {
  applyAttemptToScore,
  EMPTY_SCORE,
  evaluateAttempt,
  isUsableDetection,
  matchesExpectedNote,
} from './noteEvaluation'

function expected(overrides: Partial<ExpectedNote> = {}): ExpectedNote {
  return {
    midi: 45,
    name: 'A2',
    timestamp: 1000,
    beat: 0,
    bar: 0,
    duration: 250,
    chordMidis: [45],
    ...overrides,
  }
}

function detected(overrides: Partial<DetectedNote> = {}): DetectedNote {
  return {
    midi: 45,
    name: 'A2',
    frequency: 110,
    clarity: 0.92,
    timestamp: 1200,
    onset: 1180,
    cents: 0,
    rms: 0.08,
    stableFrames: 4,
    ...overrides,
  }
}

describe('note evaluation', () => {
  it('rejects unstable or unclear microphone readings', () => {
    expect(isUsableDetection(detected({ clarity: 0.5 }))).toBe(false)
    expect(isUsableDetection(detected({ stableFrames: 2 }))).toBe(false)
    expect(evaluateAttempt(expected(), null, 'master', 0).result).toBe('miss')
  })

  it('accepts any played note contained in a chord', () => {
    const chord = expected({ midi: 45, chordMidis: [45, 52, 57] })
    const note = detected({ midi: 52, name: 'E3' })
    expect(matchesExpectedNote(chord, note)).toBe(true)
    expect(evaluateAttempt(chord, note, 'master', 0).result).toBe('perfect')
  })

  it('does not turn a wrong pitch into a successful hit', () => {
    expect(evaluateAttempt(expected(), detected({ midi: 46 }), 'master', 0).result).toBe('wrong')
  })

  it('scores fresh free-play notes and rejects an old sustain', () => {
    expect(evaluateAttempt(expected(), detected({ onset: 1080 }), 'reproduction', 0).result).toBe('perfect')
    expect(evaluateAttempt(expected(), detected({ onset: 600 }), 'reproduction', 0).result).toBe('miss')
  })

  it('updates points, streak, multiplier and accuracy consistently', () => {
    let score = { ...EMPTY_SCORE }
    for (let index = 0; index < 10; index += 1) score = applyAttemptToScore(score, 'perfect')
    expect(score.streak).toBe(10)
    expect(score.multiplier).toBe(2)
    expect(score.accuracy).toBe(100)

    score = applyAttemptToScore(score, 'wrong')
    expect(score.streak).toBe(0)
    expect(score.multiplier).toBe(1)
    expect(score.accuracy).toBe(91)
  })
})
