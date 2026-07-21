import { describe, expect, it } from 'vitest'
import { DEMO_SONGS } from '../demoSongs'
import type { DetectedNote, ExpectedNote } from '../types'
import { applyAttemptToScore, EMPTY_SCORE, evaluateAttempt } from './noteEvaluation'
import { shouldAdvanceMasterBeat } from './masterProgression'

// Standard tuning in AlphaTex string order: 1=high E, 6=low E.
const OPEN_STRING_MIDI: Record<number, number> = {
  1: 64,
  2: 59,
  3: 55,
  4: 50,
  5: 45,
  6: 40,
}

function extractSongNotes(alphaTex: string): Array<{ midi: number; bar: number; beat: number }> {
  const scoreBody = alphaTex.split('\n').filter((line) => !line.startsWith('\\')).join(' ')
  return scoreBody.split('|').flatMap((barText, bar) =>
    [...barText.matchAll(/(\d+)\.(\d+)/g)].map((match, beat) => {
      const fret = Number(match[1])
      const stringNumber = Number(match[2])
      return { midi: OPEN_STRING_MIDI[stringNumber] + fret, bar, beat }
    })
  )
}

describe('Smoke on the Water master-game simulation', () => {
  it('plays the complete demo without freezing and scores every fresh note', () => {
    const smoke = DEMO_SONGS.find((song) => song.title === 'Smoke on the Water')
    expect(smoke).toBeDefined()

    const notes = extractSongNotes(smoke!.tex)
    expect(notes).toHaveLength(16)
    expect(notes.slice(0, 4).map((note) => note.midi)).toEqual([45, 48, 50, 48])
    expect(notes[3]).toMatchObject({ midi: 48, bar: 0 })
    expect(notes[4]).toMatchObject({ midi: 45, bar: 1, beat: 0 })

    let score = { ...EMPTY_SCORE }
    let lastEvaluationAt = 0
    const attempts = notes.map(({ midi, bar, beat }, index) => {
      const activeAt = 1000 + index * 500
      const expected: ExpectedNote = {
        midi,
        name: `midi-${midi}`,
        timestamp: activeAt,
        beat,
        bar,
        duration: 268,
        chordMidis: [midi],
      }
      const detected: DetectedNote = {
        midi,
        name: `midi-${midi}`,
        frequency: 110,
        clarity: 0.93,
        timestamp: activeAt + 190,
        onset: activeAt + 160,
        cents: 2,
        rms: 0.07,
        stableFrames: 4,
      }

      expect(shouldAdvanceMasterBeat(expected, detected, lastEvaluationAt)).toBe(true)
      const attempt = evaluateAttempt(expected, detected, 'master', 0)
      score = applyAttemptToScore(score, attempt.result)
      lastEvaluationAt = detected.timestamp
      return attempt
    })

    expect(attempts).toHaveLength(notes.length)
    expect(attempts.every((attempt) => attempt.result === 'perfect')).toBe(true)
    expect(score.perfect).toBe(16)
    expect(score.streak).toBe(16)
    expect(score.accuracy).toBe(100)
    expect(score.points).toBe(23_000)
  })
})
