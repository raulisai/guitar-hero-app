import type { DemoSong } from '../demoSongs'

export interface SongGoal {
  name: string
  stringNumber: number
  fretNumber: number
  fingerNumber: 0 | 1 | 2 | 3 | 4
}

export interface SongPresentation {
  title: string
  artist: string
  cover: string
  tuning: string
  bpm: number
  timeSignature: string
  goal: SongGoal
}

const SONG_DETAILS: Record<string, Pick<SongPresentation, 'bpm' | 'goal'>> = {
  'Smoke on the Water': {
    bpm: 112,
    goal: { name: 'A2', stringNumber: 5, fretNumber: 5, fingerNumber: 3 },
  },
  'Seven Nation Army': {
    bpm: 124,
    goal: { name: 'E3', stringNumber: 5, fretNumber: 7, fingerNumber: 3 },
  },
  'Come As You Are': {
    bpm: 120,
    goal: { name: 'G2', stringNumber: 6, fretNumber: 3, fingerNumber: 2 },
  },
  'Back in Black': {
    bpm: 196,
    goal: { name: 'E2', stringNumber: 6, fretNumber: 0, fingerNumber: 0 },
  },
  'Wish You Were Here (Intro)': {
    bpm: 62,
    goal: { name: 'G3', stringNumber: 3, fretNumber: 0, fingerNumber: 0 },
  },
}

const FALLBACK_GOAL: SongGoal = {
  name: 'E3',
  stringNumber: 4,
  fretNumber: 2,
  fingerNumber: 2,
}

export function getSongPresentation(song: DemoSong, detectedBpm = 0): SongPresentation {
  const details = SONG_DETAILS[song.title]
  const étudeMatch = song.title.match(/Estudio No\. (\d+)/)
  const étudeNumber = étudeMatch ? Number(étudeMatch[1]) : 0

  return {
    title: song.title,
    artist: song.artist,
    cover: '/game-assets/neon-strings-cover.webp',
    tuning: 'Afinación estándar',
    bpm: detectedBpm || details?.bpm || (étudeNumber ? 72 + étudeNumber * 2 : 100),
    timeSignature: '4/4',
    goal: details?.goal ?? FALLBACK_GOAL,
  }
}
