import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DetectedNote, ExpectedNote, NoteAttempt, NoteResult, GameState, GameMode, Score, BeatBounds } from '../types'

interface FailedBeatOverlay {
  key: string
  bounds: BeatBounds
}

interface GameStore {
  // Game state
  gameState: GameState
  gameMode: GameMode
  currentSongFile: File | null
  songDuration: number

  // Audio
  latencyOffset: number
  isCalibrated: boolean

  // Real-time notes
  expectedNote: ExpectedNote | null
  detectedNote: DetectedNote | null
  currentBar: number
  currentBeat: number

  // Visual beat tracking
  currentBeatBounds: BeatBounds | null
  currentTabBounds: BeatBounds | null
  failedBeatOverlays: FailedBeatOverlay[]

  // Master mode: callback to resume AlphaTab playback
  resumePlayback: (() => void) | null

  // History for heatmap
  attempts: NoteAttempt[]

  // Score
  score: Score

  // Actions
  setGameState: (state: GameState) => void
  setGameMode: (mode: GameMode) => void
  setSongFile: (file: File) => void
  setExpectedNote: (note: ExpectedNote | null) => void
  setDetectedNote: (note: DetectedNote | null) => void
  setLatencyOffset: (offset: number) => void
  setCurrentBeatBounds: (bounds: BeatBounds | null) => void
  setCurrentTabBounds: (bounds: BeatBounds | null) => void
  markCurrentBeatFailed: () => void
  setResumePlayback: (fn: () => void) => void
  evaluateNote: () => void
  resetGame: () => void
  updatePosition: (bar: number, beat: number) => void
}

const initialScore: Score = {
  perfect: 0,
  good: 0,
  late: 0,
  early: 0,
  wrong: 0,
  miss: 0,
  streak: 0,
  maxStreak: 0,
  accuracy: 0,
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      gameState: 'idle',
      gameMode: 'reproduction',
      currentSongFile: null,
      songDuration: 0,
      latencyOffset: 0,
      isCalibrated: false,
      expectedNote: null,
      detectedNote: null,
      currentBar: 0,
      currentBeat: 0,
      currentBeatBounds: null,
      currentTabBounds: null,
      failedBeatOverlays: [],
      resumePlayback: null,
      attempts: [],
      score: { ...initialScore },

      setGameState: (state) => set({ gameState: state }),
      setGameMode: (mode) => set({ gameMode: mode }),
      setSongFile: (file) => set({ currentSongFile: file }),
      setExpectedNote: (note) => set({ expectedNote: note }),
      setDetectedNote: (note) => set({ detectedNote: note }),
      setLatencyOffset: (offset) => set({ latencyOffset: offset, isCalibrated: true }),
      setCurrentBeatBounds: (bounds) => set({ currentBeatBounds: bounds }),
      setCurrentTabBounds: (bounds) => set({ currentTabBounds: bounds }),
      setResumePlayback: (fn) => set({ resumePlayback: fn }),
      markCurrentBeatFailed: () => {
        const { currentBeatBounds, expectedNote, failedBeatOverlays } = get()
        if (!currentBeatBounds || !expectedNote) return
        const key = `${expectedNote.bar}-${expectedNote.beat}`
        // Avoid duplicates
        if (failedBeatOverlays.some(o => o.key === key)) return
        set({ failedBeatOverlays: [...failedBeatOverlays, { key, bounds: currentBeatBounds }] })
      },
      updatePosition: (bar, beat) => set({ currentBar: bar, currentBeat: beat }),

      // ─────────────────────────────────────────────────
      // CORE ENGINE: compare expected vs detected note
      // ─────────────────────────────────────────────────
      evaluateNote: () => {
        const { expectedNote, detectedNote, latencyOffset, score } = get()
        if (!expectedNote) return

        let result: NoteResult
        let timeDiff = 0

        if (!detectedNote || detectedNote.clarity < 0.85) {
          result = 'miss'
        } else {
          // Compensate for microphone latency
          const adjustedDetectedTime = detectedNote.timestamp - latencyOffset
          timeDiff = adjustedDetectedTime - expectedNote.timestamp

          const noteMatch = detectedNote.midi === expectedNote.midi

          if (!noteMatch) {
            result = 'wrong'
          } else if (Math.abs(timeDiff) <= 100) {
            result = 'perfect'
          } else if (Math.abs(timeDiff) <= 200) {
            result = 'good'
          } else if (timeDiff > 200) {
            result = 'late'
          } else {
            result = 'early'
          }
        }

        const attempt: NoteAttempt = {
          expected: expectedNote,
          detected: detectedNote,
          result,
          timeDiff,
        }

        const isHit = ['perfect', 'good', 'late', 'early'].includes(result)
        const newStreak = isHit ? score.streak + 1 : 0
        const newMaxStreak = Math.max(score.maxStreak, newStreak)

        const newScore: Score = {
          ...score,
          [result]: (score[result as keyof Score] as number) + 1,
          streak: newStreak,
          maxStreak: newMaxStreak,
        }

        const total =
          newScore.perfect + newScore.good + newScore.late +
          newScore.early + newScore.wrong + newScore.miss
        const hits = newScore.perfect + newScore.good + newScore.late + newScore.early
        newScore.accuracy = total > 0 ? Math.round((hits / total) * 100) : 0

        set((state) => ({
          attempts: [...state.attempts, attempt],
          score: newScore,
        }))
      },

      resetGame: () =>
        set({
          gameState: 'idle',
          attempts: [],
          score: { ...initialScore },
          expectedNote: null,
          detectedNote: null,
          currentBar: 0,
          currentBeat: 0,
          currentBeatBounds: null,
          currentTabBounds: null,
          failedBeatOverlays: [],
        }),
    }),
    {
      name: 'guitar-hero-storage',
      // Only persist calibration between sessions
      partialize: (state) => ({
        latencyOffset: state.latencyOffset,
        isCalibrated: state.isCalibrated,
      }),
    }
  )
)
