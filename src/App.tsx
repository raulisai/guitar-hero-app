import { useState, useCallback, useRef, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ScoreViewer, type ScoreViewerHandle } from './components/ScoreViewer'
import { Calibration } from './components/Calibration'
import { FloatingBar } from './components/FloatingBar'
import type { PanelView } from './components/FloatingBar'
import { DebugLog } from './components/DebugLog'
import { AdminDashboard, type RepositoryFile } from './components/AdminDashboard'
import { useGameLoop } from './hooks/useGameLoop'
import { useGameStore } from './store/useGameStore'
import { useMetronome } from './hooks/useMetronome'
import { useAudioDetection } from './hooks/useAudioDetection'
import { useAutoHide } from './hooks/useAutoHide'
import { ALL_SONGS, DEFAULT_DEMO, type DemoSong } from './demoSongs'
import type { GameMode } from './types'

type CalibrationTab = 'tuner' | 'latency'

export default function App() {
  const [songFile, setSongFile] = useState<File | string | null>(DEFAULT_DEMO.tex)
  const [songTitle, setSongTitle] = useState<string>(
    `${DEFAULT_DEMO.title} — ${DEFAULT_DEMO.artist}`
  )
  const [showCalibration, setShowCalibration] = useState(false)
  const [calibrationTab, setCalibrationTab] = useState<CalibrationTab>('tuner')
  const [showDemoMenu, setShowDemoMenu] = useState(false)
  const [showDebugLog, setShowDebugLog] = useState(false)
  const [panelOpen, setPanelOpen] = useState(() =>
    typeof window === 'undefined' || (window.innerWidth > 900 && window.innerHeight > 520)
  )
  const [panelView, setPanelView] = useState<PanelView>('fretboard')
  const [tempo, setTempoState] = useState(100)
  const [isLooping, setIsLooping] = useState(false)
  const [isMetronome, setIsMetronome] = useState(false)
  const [activeSection, setActiveSection] = useState<'game' | 'admin'>('game')
  const [syncedSongs, setSyncedSongs] = useState<DemoSong[]>([])
  const scoreRef = useRef<ScoreViewerHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isCalibrated, gameMode, gameState, setGameMode, resetGame, fadeFailed, songBpm, micEnabled, setMicEnabled } = useGameStore(useShallow((state) => ({
    isCalibrated: state.isCalibrated,
    gameMode: state.gameMode,
    gameState: state.gameState,
    setGameMode: state.setGameMode,
    resetGame: state.resetGame,
    fadeFailed: state.fadeFailed,
    songBpm: state.songBpm,
    micEnabled: state.micEnabled,
    setMicEnabled: state.setMicEnabled,
  })))
  const { barHidden, showBar, hideNow } = useAutoHide(gameMode)

  // Audio detection — lifted to App so mic button in FloatingBar and MicPill share one instance
  const {
    isListening,
    isRequesting,
    error: micError,
    startListening,
    stopListening,
    analyserRef,
    measureAmbientRms,
  } = useAudioDetection()

  useGameLoop()
  useMetronome(isMetronome, songBpm, tempo)

  useEffect(() => {
    fetch('/repertoire/catalog.json')
      .then((response) => response.ok ? response.json() : null)
      .then((catalog: { songs?: Array<{ title: string; artist: string; file: string }> } | null) => {
        if (catalog?.songs) {
          setSyncedSongs(catalog.songs.map((song) => ({ title: song.title, artist: song.artist, tex: song.file })))
        }
      })
      .catch(() => { /* the built-in repertoire remains available offline */ })
  }, [])

  const availableSongs = [...ALL_SONGS, ...syncedSongs]

  // Auto-start mic if user had it on in last session
  useEffect(() => {
    if (micEnabled && !isListening && !isRequesting) {
      startListening()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist mic state whenever it changes
  useEffect(() => { setMicEnabled(isListening) }, [isListening, setMicEnabled])

  const handleToggleMic = useCallback(() => {
    if (isListening) stopListening()
    else startListening()
  }, [isListening, startListening, stopListening])

  // When panel closes, show the bar so the bubble is reachable to reopen
  useEffect(() => {
    if (!panelOpen) showBar()
  }, [panelOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  // Loop: restart when song finishes
  useEffect(() => {
    if (gameState === 'finished' && isLooping) {
      setTimeout(() => scoreRef.current?.play(), 300)
    }
  }, [gameState, isLooping])

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

  const handleReset = useCallback(() => {
    scoreRef.current?.stop()
    resetGame()
  }, [resetGame])

  const handlePlay = useCallback(async () => {
    fadeFailed()
    if (gameMode === 'master' && !isListening && !isRequesting) {
      await startListening()
    }
    scoreRef.current?.play()
  }, [fadeFailed, gameMode, isListening, isRequesting, startListening])

  const handleRepositorySong = useCallback(async (entry: RepositoryFile) => {
    const response = await fetch(entry.downloadUrl)
    if (!response.ok) throw new Error(`descarga HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    const file = new File([buffer], entry.name, { type: 'application/octet-stream' })
    setSongFile(file)
    setSongTitle(entry.name.replace(/\.[^.]+$/, ''))
    setActiveSection('game')
    resetGame()
  }, [resetGame])

  return (
    <div className="flex flex-col" style={{ height: '100svh', background: '#111' }}>
      {/* ── Header ─────────────────────────────────────── */}
      <header
        className="app-header flex items-center justify-between px-5 shrink-0"
        style={{ height: '44px', background: '#111', borderBottom: '1px solid #1e1e1e' }}
      >
        {/* Left: Logo */}
        <div className="flex items-center shrink-0">
          <span className="font-bold" style={{ color: '#22c55e', fontSize: '15px', letterSpacing: '-0.3px' }}>
            GuitarrStudio
          </span>
        </div>

        {/* Center: Song search bar */}
        <div className="app-song-picker flex-1 flex justify-center px-6" style={{ maxWidth: 480 }}>
          <div className="relative w-full">
            <button
              onClick={() => { setActiveSection('game'); setShowDemoMenu((v) => !v) }}
              style={{
                width: '100%',
                height: 30,
                background: '#1a1a1a',
                border: '1px solid #2a2a2a',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '0 10px',
                cursor: 'pointer',
                color: '#aaa',
                fontSize: 12,
                textAlign: 'left',
                overflow: 'hidden',
              }}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {activeSection === 'admin' ? 'Panel admin · repertorio' : songTitle}
              </span>
              <span style={{ color: '#444', fontSize: 10, flexShrink: 0 }}>▾</span>
            </button>

            {showDemoMenu && (
              <div
                className="absolute top-full mt-1 rounded-lg z-50"
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  minWidth: '220px',
                  left: 0,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  maxHeight: '70vh',
                  overflowY: 'auto',
                }}
              >
                {/* Group by artist */}
                {[...new Set(availableSongs.map(s => s.artist))].map((artist) => (
                  <div key={artist}>
                    <div style={{ padding: '6px 14px 2px', fontSize: 9, color: '#444', letterSpacing: '0.08em', fontWeight: 700, textTransform: 'uppercase', borderTop: '1px solid #222' }}>
                      {artist}
                    </div>
                    {availableSongs.filter(s => s.artist === artist).map((song) => (
                      <button
                        key={song.title}
                        onClick={() => loadDemo(song)}
                        className="w-full text-left px-4 py-2 text-sm transition-colors"
                        style={{ color: '#ccc', background: 'transparent' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#252525'
                          e.currentTarget.style.color = '#fff'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent'
                          e.currentTarget.style.color = '#ccc'
                        }}
                      >
                        {song.title}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: action buttons */}
        <div className="app-header-actions flex items-center gap-2 shrink-0">
          <button
            onClick={() => { setActiveSection((section) => section === 'admin' ? 'game' : 'admin'); setShowDemoMenu(false) }}
            className="admin-nav-button text-xs px-3 py-1.5 rounded transition-colors"
            style={{ background: activeSection === 'admin' ? '#22c55e' : '#22c55e15', color: activeSection === 'admin' ? '#061008' : '#22c55e', border: '1px solid #22c55e44', fontWeight: 700 }}
          >
            {activeSection === 'admin' ? 'Volver al juego' : 'Admin'}
          </button>
          {/* Demos button */}
          <button
            onClick={() => setShowDemoMenu((v) => !v)}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{ background: '#1e1e1e', color: '#aaa', border: '1px solid #2e2e2e' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
          >
            Demos
          </button>

          {/* Calibrar */}
          <button
            onClick={() => { setCalibrationTab('latency'); setShowCalibration(true) }}
            className="text-xs px-2.5 py-1.5 rounded transition-colors"
            style={{ color: '#666', border: '1px solid #2e2e2e' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ccc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
          >
            Calibrar
          </button>

          {/* Afinador */}
          <button
            onClick={() => { setCalibrationTab('tuner'); setShowCalibration(true) }}
            className="text-xs px-2.5 py-1.5 rounded transition-colors"
            style={{ color: '#666', border: '1px solid #2e2e2e' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ccc')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
          >
            Afinador
          </button>

          {/* Cargar .gp5 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs px-2.5 py-1.5 rounded transition-colors"
            style={{ background: '#1e1e1e', color: '#aaa', border: '1px solid #2e2e2e' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
          >
            Cargar .gp5
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".gp,.gp4,.gp5,.gpx,.gp7"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />

          {isCalibrated && (
            <span
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: '#22c55e', background: '#22c55e18', border: '1px solid #22c55e33' }}
            >
              calibrado
            </span>
          )}
        </div>
      </header>

      {activeSection === 'admin' ? (
        <AdminDashboard onLoadSong={handleRepositorySong} />
      ) : (
      <>
      {/* ── Score area ─────────────────────────────────── */}
      <div
        className={`score-stage relative ${panelOpen ? 'panel-open' : 'panel-closed'} ${barHidden ? 'dock-hidden' : 'dock-visible'} panel-${panelView}`}
        style={{
          flex: 1, overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          transition: 'padding-bottom 0.45s cubic-bezier(0.4,0,0.2,1)',
        }}
        onClick={() => {
          if (showDemoMenu) setShowDemoMenu(false)
          if (showCalibration) setShowCalibration(false)
        }}
      >
        <ScoreViewer
          ref={scoreRef}
          file={songFile}
          onScroll={hideNow}
          isListening={isListening}
          isRequesting={isRequesting}
          micError={micError}
          onToggleMic={handleToggleMic}
        />

        {/* Debug log — bottom-right corner */}
        {showDebugLog && <DebugLog onClose={() => setShowDebugLog(false)} />}

        {/* Calibration panel — centered overlay */}
        {showCalibration && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: '#000000cc', zIndex: 20 }}
            onClick={(e) => e.target === e.currentTarget && setShowCalibration(false)}
          >
            <Calibration
              onComplete={() => setShowCalibration(false)}
              initialTab={calibrationTab}
              isListening={isListening}
              startListening={startListening}
              analyserRef={analyserRef}
              measureAmbientRms={measureAmbientRms}
            />
          </div>
        )}
      </div>

      {/* ── Floating control bar (includes mic info row when active) ── */}
      <FloatingBar
        hasFile={!!songFile}
        tempo={tempo}
        onPlay={() => { void handlePlay() }}
        onPause={() => scoreRef.current?.pause()}
        onStop={() => scoreRef.current?.stop()}
        onTempoChange={(r) => scoreRef.current?.setTempo(r)}
        onTempoInput={setTempoState}
        showDebugLog={showDebugLog}
        onToggleDebugLog={() => setShowDebugLog((v) => !v)}
        isLooping={isLooping}
        onToggleLooping={() => setIsLooping((v) => !v)}
        isMetronome={isMetronome}
        onToggleMetronome={() => setIsMetronome((v) => !v)}
        onModeChange={handleModeChange}
        onReset={handleReset}
        isListening={isListening}
        isRequesting={isRequesting}
        onToggleMic={handleToggleMic}
        panelOpen={panelOpen}
        panelView={panelView}
        onTogglePanel={() => setPanelOpen(v => !v)}
        onChangePanelView={setPanelView}
        barHidden={barHidden}
        onShowBar={showBar}
      />
      </>
      )}
    </div>
  )
}
