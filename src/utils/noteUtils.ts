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
