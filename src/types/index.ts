export interface DetectedNote {
  midi: number       // MIDI number (0-127)
  name: string       // "E4", "A2", "G#3", etc.
  frequency: number  // exact Hz
  clarity: number    // 0-1 (>0.9 = clean note)
  timestamp: number  // performance.now() — updated every frame while ringing
  onset: number      // performance.now() when this note STARTED (silence/diff MIDI → this MIDI)
}

export interface ExpectedNote {
  midi: number
  name: string
  timestamp: number    // ms within the song
  beat: number         // beat index in the song
  bar: number          // bar index
  duration: number     // duration in ms
  stringNumber?: number
  fretNumber?: number
}

export type NoteResult = 'perfect' | 'good' | 'late' | 'early' | 'wrong' | 'miss'

export interface NoteAttempt {
  expected: ExpectedNote
  detected: DetectedNote | null
  result: NoteResult
  timeDiff: number  // ms diff (negative = early, positive = late)
}

export type GameState = 'idle' | 'calibrating' | 'countdown' | 'playing' | 'paused' | 'finished'

export type GameMode = 'reproduction' | 'master'

export interface BeatBounds {
  x: number
  y: number
  w: number
  h: number
}

export interface Score {
  perfect: number
  good: number
  late: number
  early: number
  wrong: number
  miss: number
  streak: number
  maxStreak: number
  accuracy: number  // 0-100
}
