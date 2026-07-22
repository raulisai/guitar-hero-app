import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DetectedNote, ExpectedNote, NoteAttempt, GameState, GameMode, Score, BeatBounds } from '../types'
import { applyAttemptToScore, EMPTY_SCORE, evaluateAttempt } from '../game/noteEvaluation'

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

  // Teaching mode: deterministic callback to select the next playable beat
  advanceLesson: (() => void) | null

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
  setAdvanceLesson: (fn: () => void) => void
  evaluateNote: (detectedOverride?: DetectedNote | null) => NoteAttempt | null
  resetGame: () => void
  updatePosition: (bar: number, beat: number) => void
}

const initialScore: Score = { ...EMPTY_SCORE }

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
      advanceLesson: null,
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
      setAdvanceLesson: (fn) => set({ advanceLesson: fn }),
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
      evaluateNote: (detectedOverride) => {
        const { expectedNote, detectedNote, latencyOffset, score, gameMode } = get()
        if (!expectedNote) return null

        const selectedDetection = detectedOverride === undefined ? detectedNote : detectedOverride
        const attempt = evaluateAttempt(expectedNote, selectedDetection, gameMode, latencyOffset)
        const newScore = applyAttemptToScore(score, attempt.result)

        set((state) => ({
          attempts: [...state.attempts.slice(-499), attempt],
          score: newScore,
        }))
        return attempt
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
