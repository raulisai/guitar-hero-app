import type { DetectedNote, ExpectedNote } from '../types'
import { isUsableDetection, matchesExpectedNote } from './noteEvaluation'

export const MASTER_NOTE_TIMEOUT_MS = 3500
export const MASTER_WAIT_SAFETY_TIMEOUT_MS = 10_000
export const MASTER_RETRIGGER_GUARD_MS = 70
export const MASTER_EARLY_INPUT_GRACE_MS = 140

export function getMasterTimeout(waitMode: boolean): number {
  return waitMode ? MASTER_WAIT_SAFETY_TIMEOUT_MS : MASTER_NOTE_TIMEOUT_MS
}

/**
 * A master beat advances only for a clean, matching and newly attacked note.
 * Wrong transients remain visible in the validator but no longer steal a beat.
 */
export function shouldAdvanceMasterBeat(
  expected: ExpectedNote,
  detected: DetectedNote | null,
  lastEvaluationAt: number,
): detected is DetectedNote {
  if (!isUsableDetection(detected) || !matchesExpectedNote(expected, detected)) return false

  const earliestFreshOnset = Math.max(
    expected.timestamp - MASTER_EARLY_INPUT_GRACE_MS,
    lastEvaluationAt + MASTER_RETRIGGER_GUARD_MS,
  )
  return detected.onset >= earliestFreshOnset
}
