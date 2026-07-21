export const FINGER_NAMES = ['Al aire', 'Índice', 'Medio', 'Anular', 'Meñique'] as const

export type FingerNumber = 0 | 1 | 2 | 3 | 4

export interface FingeringSuggestion {
  finger: FingerNumber
  position: number
  label: string
  source: 'score' | 'suggested'
}

/**
 * Prefer authored Guitar Pro fingering. If it is missing, use a predictable
 * four-fret position so the coach never claims an arbitrary finger is exact.
 */
export function getFingeringSuggestion(
  fret: number,
  authoredFinger?: number
): FingeringSuggestion {
  if (fret <= 0) {
    return { finger: 0, position: 0, label: FINGER_NAMES[0], source: 'score' }
  }

  if (authoredFinger && authoredFinger >= 1 && authoredFinger <= 4) {
    const finger = authoredFinger as FingerNumber
    return {
      finger,
      position: Math.max(1, fret - finger + 1),
      label: FINGER_NAMES[finger],
      source: 'score',
    }
  }

  const position = Math.floor((fret - 1) / 4) * 4 + 1
  const finger = (fret - position + 1) as FingerNumber
  return { finger, position, label: FINGER_NAMES[finger], source: 'suggested' }
}
