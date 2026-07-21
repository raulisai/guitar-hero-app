export interface LessonBeatLike {
  start: number
  end: number
  beat: {
    notes: unknown[]
  }
}

export interface LessonTickLookup<T extends LessonBeatLike> {
  findBeat(trackIndices: Set<number>, tick: number): T | null
}

const MAX_LOOKUP_STEPS = 512

/**
 * Finds the first playable beat at or after a tick. AlphaTab includes rests in
 * its tick lookup, so lesson mode must explicitly skip them.
 */
export function findPlayableLessonBeat<T extends LessonBeatLike>(
  tickLookup: LessonTickLookup<T>,
  fromTick: number,
): T | null {
  const tracks = new Set([0])
  let tick = Math.max(0, Math.floor(fromTick))
  let previousStart = -1

  for (let step = 0; step < MAX_LOOKUP_STEPS; step += 1) {
    const lookup = tickLookup.findBeat(tracks, tick)
    if (!lookup) return null

    if (lookup.beat.notes.length > 0) return lookup

    const nextTick = Math.max(tick + 1, Math.floor(lookup.end) + 1)
    if (lookup.start === previousStart || nextTick <= tick) return null
    previousStart = lookup.start
    tick = nextTick
  }

  return null
}

/** Finds the next note after the currently active lesson beat. */
export function findNextPlayableLessonBeat<T extends LessonBeatLike>(
  tickLookup: LessonTickLookup<T>,
  current: T,
): T | null {
  return findPlayableLessonBeat(tickLookup, Math.max(current.start + 1, current.end + 1))
}
