import type * as alphaTab from '@coderline/alphatab'
import type { TimelineNote } from '../types'
import { getFingeringSuggestion } from '../utils/fingeringUtils'
import { midiToNoteName } from '../utils/noteUtils'

export const MIDI_TICKS_PER_QUARTER = 960
export const HIGHWAY_LOOKAHEAD_TICKS = MIDI_TICKS_PER_QUARTER * 4
export const HIGHWAY_HIT_LINE_PERCENT = 18
export const HIGHWAY_END_PERCENT = 98

function clampToGuitarMidi(value: number): number {
  let midi = value
  while (midi < 40) midi += 12
  while (midi > 88) midi -= 12
  return midi
}

export function toTabStringNumber(alphaTabString: number): number {
  return alphaTabString >= 1 && alphaTabString <= 6 ? 7 - alphaTabString : alphaTabString
}

/**
 * Converts AlphaTab's score model into the compact data needed by the highway.
 * The first staff of the first track represents the selected guitar part; all
 * its voices and chord notes are retained.
 */
export function buildHighwayTimeline(score: alphaTab.model.Score | null | undefined): TimelineNote[] {
  const staff = score?.tracks[0]?.staves[0]
  if (!staff) return []

  const timeline: TimelineNote[] = []
  const seen = new Set<string>()

  for (const bar of staff.bars) {
    for (const voice of bar.voices) {
      for (const beat of voice.beats) {
        if (beat.notes.length === 0) continue

        const startTick = Math.max(0, beat.absolutePlaybackStart)
        const durationTicks = Math.max(1, beat.playbackDuration)
        const chordId = `${bar.index}-${beat.index}-${startTick}`

        for (const note of beat.notes) {
          const stringNumber = toTabStringNumber(note.string)
          if (stringNumber < 1 || stringNumber > 6) continue

          const dedupeKey = `${startTick}-${stringNumber}-${note.fret}`
          if (seen.has(dedupeKey)) continue
          seen.add(dedupeKey)

          const midi = clampToGuitarMidi(note.realValue)
          const fingering = getFingeringSuggestion(note.fret, note.leftHandFinger)
          timeline.push({
            id: `${note.id}-${dedupeKey}`,
            midi,
            name: midiToNoteName(midi),
            startTick,
            durationTicks,
            stringNumber,
            fretNumber: note.fret,
            fingerNumber: fingering.finger,
            bar: bar.index,
            beat: beat.index,
            chordId,
          })
        }
      }
    }
  }

  return timeline.sort((left, right) => left.startTick - right.startTick || left.stringNumber - right.stringNumber)
}

export function getTimelineEndTick(notes: TimelineNote[]): number {
  return notes.reduce((end, note) => Math.max(end, note.startTick + note.durationTicks), 0)
}

export interface HighwayNoteLayout extends TimelineNote {
  leftPercent: number
  lengthPercent: number
  active: boolean
  passed: boolean
}

/** Maps timeline ticks to a stable right-to-left lane without DOM measurement. */
export function layoutHighwayNotes(
  notes: TimelineNote[],
  playbackTick: number,
  lookaheadTicks = HIGHWAY_LOOKAHEAD_TICKS,
): HighwayNoteLayout[] {
  const trackWidth = HIGHWAY_END_PERCENT - HIGHWAY_HIT_LINE_PERCENT
  const pastWindow = Math.max(MIDI_TICKS_PER_QUARTER, lookaheadTicks * 0.35)
  // Timelines can contain thousands of notes. Binary-search a generous
  // look-behind window so playback cost depends on what is visible, not on the
  // total song length. Sixteen beats also keeps unusually long sustains alive.
  const earliestStart = playbackTick - Math.max(lookaheadTicks * 4, pastWindow)
  let low = 0
  let high = notes.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (notes[middle].startTick < earliestStart) low = middle + 1
    else high = middle
  }

  const visible: TimelineNote[] = []
  for (let index = low; index < notes.length; index += 1) {
    const note = notes[index]
    if (note.startTick > playbackTick + lookaheadTicks) break
    if (
      note.startTick + note.durationTicks >= playbackTick - pastWindow &&
      note.startTick <= playbackTick + lookaheadTicks
    ) visible.push(note)
  }

  return visible
    .map((note) => {
      const leftPercent = HIGHWAY_HIT_LINE_PERCENT + ((note.startTick - playbackTick) / lookaheadTicks) * trackWidth
      return {
        ...note,
        leftPercent,
        lengthPercent: Math.max(4.5, (note.durationTicks / lookaheadTicks) * trackWidth),
        active: playbackTick >= note.startTick && playbackTick < note.startTick + note.durationTicks,
        passed: playbackTick >= note.startTick + note.durationTicks,
      }
    })
}
