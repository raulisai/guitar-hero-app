import type {
  DetectedNote,
  ExpectedNote,
  GameMode,
  NoteAttempt,
  NoteResult,
  Score,
} from '../types'

export const MIN_DETECTION_CLARITY = 0.78
export const MIN_DETECTION_STABLE_FRAMES = 3

const RESULT_WEIGHT: Record<NoteResult, number> = {
  perfect: 1,
  good: 0.8,
  late: 0.55,
  early: 0.55,
  wrong: 0,
  miss: 0,
}

const RESULT_POINTS: Record<NoteResult, number> = {
  perfect: 1000,
  good: 750,
  late: 500,
  early: 500,
  wrong: 0,
  miss: 0,
}

export const EMPTY_SCORE: Score = {
  perfect: 0,
  good: 0,
  late: 0,
  early: 0,
  wrong: 0,
  miss: 0,
  streak: 0,
  maxStreak: 0,
  accuracy: 0,
  points: 0,
  multiplier: 1,
}

export function isUsableDetection(note: DetectedNote | null): note is DetectedNote {
  return Boolean(
    note &&
    note.clarity >= MIN_DETECTION_CLARITY &&
    note.stableFrames >= MIN_DETECTION_STABLE_FRAMES
  )
}

export function matchesExpectedNote(expected: ExpectedNote, detected: DetectedNote): boolean {
  return expected.chordMidis?.includes(detected.midi) ?? detected.midi === expected.midi
}

export function evaluateAttempt(
  expected: ExpectedNote,
  detected: DetectedNote | null,
  gameMode: GameMode,
  latencyOffset: number,
): NoteAttempt {
  if (!isUsableDetection(detected)) {
    return { expected, detected, result: 'miss', timeDiff: 0 }
  }

  const matches = matchesExpectedNote(expected, detected)
  if (!matches) {
    return { expected, detected, result: 'wrong', timeDiff: detected.onset - expected.timestamp }
  }

  if (gameMode === 'master') {
    const timeDiff = Math.max(0, detected.onset - latencyOffset - expected.timestamp)
    const result: NoteResult = timeDiff <= 350
      ? 'perfect'
      : timeDiff <= 750
        ? 'good'
        : 'late'
    return { expected, detected, result, timeDiff }
  }

  // In free playback, a note that began before this beat is a sustain from the
  // previous beat. It must not score as a fresh hit, especially on repeated notes.
  if (detected.onset < expected.timestamp - 220) {
    return { expected, detected, result: 'miss', timeDiff: detected.onset - expected.timestamp }
  }

  const timeDiff = detected.onset - latencyOffset - expected.timestamp
  const absDiff = Math.abs(timeDiff)
  const result: NoteResult = absDiff <= 120
    ? 'perfect'
    : absDiff <= 240
      ? 'good'
      : timeDiff > 0
        ? 'late'
        : 'early'

  return { expected, detected, result, timeDiff }
}

export function applyAttemptToScore(score: Score, result: NoteResult): Score {
  const isHit = result === 'perfect' || result === 'good' || result === 'late' || result === 'early'
  const newStreak = isHit ? score.streak + 1 : 0
  const newMaxStreak = Math.max(score.maxStreak, newStreak)
  const multiplier = Math.min(4, 1 + Math.floor(newStreak / 10))

  const next: Score = {
    ...score,
    [result]: (score[result as keyof Score] as number) + 1,
    streak: newStreak,
    maxStreak: newMaxStreak,
    multiplier,
    points: score.points + RESULT_POINTS[result] * (isHit ? multiplier : 1),
  }

  const total = next.perfect + next.good + next.late + next.early + next.wrong + next.miss
  const weightedHits =
    next.perfect * RESULT_WEIGHT.perfect +
    next.good * RESULT_WEIGHT.good +
    next.late * RESULT_WEIGHT.late +
    next.early * RESULT_WEIGHT.early
  next.accuracy = total > 0 ? Math.round((weightedHits / total) * 100) : 0

  return next
}
