import { useState, useCallback, useRef } from 'react'
import { ScoreViewer, type ScoreViewerHandle } from './components/ScoreViewer'
import { PitchOverlay } from './components/PitchOverlay'
import { Calibration } from './components/Calibration'
import { BottomBar } from './components/BottomBar'
import { DebugLog } from './components/DebugLog'
import { useGameLoop } from './hooks/useGameLoop'
import { useGameStore } from './store/useGameStore'
import { DEMO_SONGS, DEFAULT_DEMO, type DemoSong } from './demoSongs'
import type { GameMode } from './types'

export default function App() {
  const [songFile, setSongFile] = useState<File | string | null>(DEFAULT_DEMO.tex)
  const [songTitle, setSongTitle] = useState<string>(
    `${DEFAULT_DEMO.title} — ${DEFAULT_DEMO.artist}`
  )
  const [showCalibration, setShowCalibration] = useState(false)
  const [showDemoMenu, setShowDemoMenu] = useState(false)
  const [showDebugLog, setShowDebugLog] = useState(false)
  const [tempo, setTempoState] = useState(100)
  const scoreRef = useRef<ScoreViewerHandle>(null)
  const { isCalibrated, gameMode, setGameMode, resetGame, fadeFailed } = useGameStore()

  useGameLoop()

  const loadDemo = useCallback((song: DemoSong) => {
    setSongFile(song.tex)
    setSongTitle(`${song.title} — ${song.artist}`)
    setShowDemoMenu(false)
    resetGame()
  }, [resetGame])

  const handleModeChange = useCallback((mode: GameMode) => {
    setGameMode(mode)
    resetGame()
    scoreRef.current?.stop()
  }, [setGameMode, resetGame])

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        setSongFile(file)
        setSongTitle(file.name.replace(/\.[^.]+$/, ''))
        if (!isCalibrated) setShowCalibration(true)
      }
    },
    [isCalibrated]
  )

  return (
    <div className="flex flex-col" style={{ height: '100svh', background: '#111' }}>
      {/* ── Header ─────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-5 shrink-0"
        style={{ height: '44px', background: '#111', borderBottom: '1px solid #1e1e1e' }}
      >
        {/* Logo + song title */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-bold shrink-0" style={{ color: '#22c55e', fontSize: '15px' }}>
            GuitarHero
          </span>
          <span
            className="truncate text-sm"
            style={{ color: '#777', maxWidth: '280px' }}
          >
            {songTitle}
          </span>
        </div>

        {/* Right: demo menu + calibrate */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Demo songs dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDemoMenu((v) => !v)}
              className="text-xs px-3 py-1.5 rounded transition-colors"
              style={{ background: '#1e1e1e', color: '#aaa', border: '1px solid #2e2e2e' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
            >
              Demos ▾
            </button>
            {showDemoMenu && (
              <div
                className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden z-50"
                style={{ background: '#1a1a1a', border: '1px solid #333', minWidth: '200px' }}
              >
                {DEMO_SONGS.map((song) => (
                  <button
                    key={song.title}
                    onClick={() => loadDemo(song)}
                    className="w-full text-left px-4 py-2.5 text-sm transition-colors"
                    style={{ color: '#ccc' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#252525'
                      e.currentTarget.style.color = '#fff'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = '#ccc'
                    }}
                  >
                    <div style={{ color: '#fff', fontWeight: 500 }}>{song.title}</div>
                    <div style={{ color: '#555', fontSize: '11px' }}>{song.artist}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mode toggle */}
          <div
            className="flex items-center rounded overflow-hidden"
            style={{ border: '1px solid #2e2e2e' }}
          >
            {(['reproduction', 'master'] as GameMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => handleModeChange(mode)}
                className="text-xs px-3 py-1.5 transition-colors"
                style={{
                  background: gameMode === mode ? '#22c55e' : '#1e1e1e',
                  color: gameMode === mode ? '#000' : '#888',
                  fontWeight: gameMode === mode ? 600 : 400,
                }}
              >
                {mode === 'reproduction' ? '▶ Libre' : '🎸 Master'}
              </button>
            ))}
          </div>

          {isCalibrated && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: '#22c55e', background: '#22c55e18', border: '1px solid #22c55e33' }}
            >
              calibrado
            </span>
          )}
          <button
            onClick={() => setShowCalibration(true)}
            className="text-xs px-2.5 py-1.5 rounded transition-colors"
            style={{ color: '#666', border: '1px solid #2e2e2e' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ccc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
          >
            Calibrar
          </button>
        </div>
      </header>

      {/* ── Score area ─────────────────────────────────── */}
      <div
        className="relative"
        style={{ flex: 1, overflow: 'hidden' }}
        onClick={() => { showDemoMenu && setShowDemoMenu(false); showCalibration && setShowCalibration(false) }}
      >
        <ScoreViewer ref={scoreRef} file={songFile} />

        {/* Pitch detector overlay — top-right */}
        <div className="absolute top-3 right-3" style={{ zIndex: 10 }}>
          <PitchOverlay />
        </div>

        {/* Debug log — bottom-right corner */}
        {showDebugLog && <DebugLog onClose={() => setShowDebugLog(false)} />}

        {/* Calibration panel — centered overlay */}
        {showCalibration && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: '#000000cc', zIndex: 20 }}
            onClick={(e) => e.target === e.currentTarget && setShowCalibration(false)}
          >
            <Calibration onComplete={() => setShowCalibration(false)} />
          </div>
        )}
      </div>

      {/* ── Bottom control bar ─────────────────────────── */}
      <BottomBar
        hasFile={!!songFile}
        tempo={tempo}
        onPlay={() => { fadeFailed(); scoreRef.current?.play() }}
        onPause={() => scoreRef.current?.pause()}
        onStop={() => scoreRef.current?.stop()}
        onTempoChange={(r) => scoreRef.current?.setTempo(r)}
        onTempoInput={setTempoState}
        onFileUpload={handleFileUpload}
        showDebugLog={showDebugLog}
        onToggleDebugLog={() => setShowDebugLog((v) => !v)}
      />
    </div>
  )
}
