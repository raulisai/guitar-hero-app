// Convert frequency Hz to MIDI number (0-127)
export function hzToMidi(hz: number): number {
  return Math.round(12 * Math.log2(hz / 440) + 69)
}

// Convert MIDI to note name with octave
export function midiToNoteName(midi: number): string {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  const octave = Math.floor(midi / 12) - 1
  const note = noteNames[midi % 12]
  return `${note}${octave}`
}

// Convert MIDI to Hz (for verification)
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

// Standard guitar frequency range (EADGBe)
export const GUITAR_RANGE = {
  min: 82.41,   // E2 — open 6th string
  max: 1318.5,  // E6 — 1st string fret 24
}

// Check if two notes match within tolerance (±1 semitone default)
export function notesMatch(midi1: number, midi2: number, tolerance = 1): boolean {
  return Math.abs(midi1 - midi2) <= tolerance
}

// Given a raw Hz reading, return the nearest MIDI note and how many cents off we are.
// cents: negative = flat, positive = sharp, range roughly -50..+50
export function hzToCents(hz: number): { midi: number; name: string; cents: number } {
  const exactMidi = 12 * Math.log2(hz / 440) + 69
  const midi = Math.round(exactMidi)
  const cents = Math.round((exactMidi - midi) * 100)
  return { midi, name: midiToNoteName(midi), cents }
}

// Standard open-string reference notes for a guitar in standard tuning
export const OPEN_STRINGS: { string: number; name: string; midi: number; hz: number }[] = [
  { string: 6, name: 'E2', midi: 40, hz: 82.41 },
  { string: 5, name: 'A2', midi: 45, hz: 110.00 },
  { string: 4, name: 'D3', midi: 50, hz: 146.83 },
  { string: 3, name: 'G3', midi: 55, hz: 196.00 },
  { string: 2, name: 'B3', midi: 59, hz: 246.94 },
  { string: 1, name: 'E4', midi: 64, hz: 329.63 },
]
