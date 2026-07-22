import { describe, expect, it } from 'vitest'
import type { TimelineNote } from '../types'
import { HIGHWAY_HIT_LINE_PERCENT, layoutHighwayNotes } from './highwayTimeline'

const note = (overrides: Partial<TimelineNote> = {}): TimelineNote => ({
  id: 'note', midi: 45, name: 'A2', startTick: 960, durationTicks: 480,
  stringNumber: 5, fretNumber: 5, fingerNumber: 3, bar: 0, beat: 1,
  chordId: '0-1-960', ...overrides,
})

describe('layoutHighwayNotes', () => {
  it('places the active note head on the hit line and future notes to the right', () => {
    const [active, future] = layoutHighwayNotes([
      note(),
      note({ id: 'future', startTick: 1920 }),
    ], 960)

    expect(active.leftPercent).toBe(HIGHWAY_HIT_LINE_PERCENT)
    expect(active.active).toBe(true)
    expect(future.leftPercent).toBeGreaterThan(active.leftPercent)
  })

  it('makes sustained notes visibly longer according to their score duration', () => {
    const [short, sustained] = layoutHighwayNotes([
      note({ id: 'short', durationTicks: 240 }),
      note({ id: 'long', durationTicks: 1920, stringNumber: 4 }),
    ], 960)

    expect(sustained.lengthPercent).toBeGreaterThan(short.lengthPercent * 4)
  })
})
