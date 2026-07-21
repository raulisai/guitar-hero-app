import { describe, expect, it } from 'vitest'
import { findNextPlayableLessonBeat, findPlayableLessonBeat, type LessonBeatLike } from './lessonNavigator'

function makeLookup(beats: LessonBeatLike[]) {
  return {
    findBeat: (_tracks: Set<number>, tick: number) =>
      beats.find((beat) => tick >= beat.start && tick <= beat.end) ?? null,
  }
}

describe('lesson beat navigation', () => {
  it('skips rests and crosses the third-note boundary deterministically', () => {
    const note = (): unknown[] => [{}]
    const beats: LessonBeatLike[] = [
      { start: 0, end: 119, beat: { notes: note() } },
      { start: 120, end: 239, beat: { notes: [] } },
      { start: 240, end: 359, beat: { notes: note() } },
      { start: 360, end: 479, beat: { notes: [] } },
      { start: 480, end: 599, beat: { notes: note() } },
      { start: 600, end: 719, beat: { notes: [] } },
      { start: 720, end: 839, beat: { notes: note() } },
      { start: 840, end: 959, beat: { notes: [] } },
      { start: 960, end: 1079, beat: { notes: note() } },
    ]
    const lookup = makeLookup(beats)

    const first = findPlayableLessonBeat(lookup, 0)
    const second = findNextPlayableLessonBeat(lookup, first!)
    const third = findNextPlayableLessonBeat(lookup, second!)
    const fourth = findNextPlayableLessonBeat(lookup, third!)
    const fifth = findNextPlayableLessonBeat(lookup, fourth!)

    expect([first?.start, second?.start, third?.start, fourth?.start, fifth?.start])
      .toEqual([0, 240, 480, 720, 960])
  })

  it('returns null after the final playable beat', () => {
    const final = { start: 0, end: 119, beat: { notes: [{}] } }
    expect(findNextPlayableLessonBeat(makeLookup([final]), final)).toBeNull()
  })
})
