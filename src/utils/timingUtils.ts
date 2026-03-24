import type { NoteResult } from '../types'

const TIMING_WINDOWS = {
  perfect: 100, // ±100ms
  good: 200,    // ±200ms
  close: 300,   // ±300ms (late/early)
}

export function getTimingResult(timeDiff: number, noteMatches: boolean): NoteResult {
  if (!noteMatches) return 'wrong'

  const absDiff = Math.abs(timeDiff)
  if (absDiff <= TIMING_WINDOWS.perfect) return 'perfect'
  if (absDiff <= TIMING_WINDOWS.good) return 'good'
  if (absDiff <= TIMING_WINDOWS.close) {
    return timeDiff > 0 ? 'late' : 'early'
  }
  return 'wrong'
}

export const RESULT_COLORS: Record<NoteResult, string> = {
  perfect: '#22c55e',
  good: '#84cc16',
  late: '#f59e0b',
  early: '#3b82f6',
  wrong: '#ef4444',
  miss: '#6b7280',
}

export const RESULT_TEXT: Record<NoteResult, string> = {
  perfect: '¡PERFECTO!',
  good: 'BIEN',
  late: 'TARDE',
  early: 'PRONTO',
  wrong: 'NOTA INCORRECTA',
  miss: 'FALLASTE',
}
