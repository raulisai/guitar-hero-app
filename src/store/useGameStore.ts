import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DetectedNote, ExpectedNote, NoteAttempt, NoteResult, GameState, GameMode, Score, BeatBounds } from '../types'

interface FailedBeatOverlay {
  key: string
  bounds: BeatBounds
  playCount: number   // how many times play has been pressed since this overlay appeared
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
  noiseFloor: number      // auto-calibrated ambient RMS threshold
  waitMode: boolean       // master mode: wait indefinitely for user to play
  micEnabled: boolean     // persisted mic preference (auto-restart on load)
  songBpm: number
  isMuted: boolean

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
  setNoiseFloor: (floor: number) => void
  setWaitMode: (v: boolean) => void
  setMicEnabled: (v: boolean) => void
  setSongBpm: (bpm: number) => void
  setIsMuted: (v: boolean) => void
  setCurrentBeatBounds: (bounds: BeatBounds | null) => void
  setCurrentTabBounds: (bounds: BeatBounds | null) => void
  markCurrentBeatFailed: () => void
  fadeFailed: () => void
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
      noiseFloor: 0.01,
      waitMode: false,
      micEnabled: false,
      songBpm: 0,
      isMuted: false,
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
      setNoiseFloor: (floor) => set({ noiseFloor: floor }),
      setWaitMode: (v) => set({ waitMode: v }),
      setMicEnabled: (v) => set({ micEnabled: v }),
      setSongBpm: (bpm) => set({ songBpm: bpm }),
      setIsMuted: (v) => set({ isMuted: v }),
      setCurrentBeatBounds: (bounds) => set({ currentBeatBounds: bounds }),
      setCurrentTabBounds: (bounds) => set({ currentTabBounds: bounds }),
      setResumePlayback: (fn) => set({ resumePlayback: fn }),
      markCurrentBeatFailed: () => {
        const { currentBeatBounds, expectedNote, failedBeatOverlays } = get()
        if (!currentBeatBounds || !expectedNote) return
        const key = `${expectedNote.bar}-${expectedNote.beat}`
        if (failedBeatOverlays.some(o => o.key === key)) return
        set({ failedBeatOverlays: [...failedBeatOverlays, { key, bounds: currentBeatBounds, playCount: 0 }] })
      },
      fadeFailed: () => {
        const { failedBeatOverlays } = get()
        if (failedBeatOverlays.length === 0) return
        // Increment playCount; overlays that have been seen twice disappear
        const updated = failedBeatOverlays
          .map(o => ({ ...o, playCount: o.playCount + 1 }))
          .filter(o => o.playCount < 2)
        set({ failedBeatOverlays: updated })
      },
      updatePosition: (bar, beat) => set({ currentBar: bar, currentBeat: beat }),

      // ─────────────────────────────────────────────────
      // CORE ENGINE: compare expected vs detected note
      // ─────────────────────────────────────────────────
      evaluateNote: () => {
        const { expectedNote, detectedNote, latencyOffset, score, gameMode } = get()
        if (!expectedNote) return

        let result: NoteResult
        let timeDiff = 0

        if (!detectedNote || detectedNote.clarity < 0.85) {
          result = 'miss'
        } else if (gameMode === 'master') {
          // Master mode: staleness is filtered upstream in useGameLoop subscribe.
          // Here we only check MIDI match — no onset/timing check.
          result = detectedNote.midi === expectedNote.midi ? 'perfect' : 'wrong'
        } else if (detectedNote.onset < expectedNote.timestamp - 300) {
          // Reproduction mode: note onset predates this beat — string was ringing before beat fired
          result = 'miss'
        } else {
          // Reproduction mode: check timing + pitch
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
        noiseFloor: state.noiseFloor,
        micEnabled: state.micEnabled,
      }),
    }
  )
)
