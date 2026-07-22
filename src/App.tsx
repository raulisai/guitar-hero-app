import { useCallback, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { AdminDashboard, type RepositoryFile } from './components/AdminDashboard'
import { Calibration } from './components/Calibration'
import { CameraCoach } from './components/CameraCoach'
import { DebugLog } from './components/DebugLog'
import { GameControlDeck } from './components/GameControlDeck'
import { GameTopBar } from './components/GameTopBar'
import { GuitarHighway } from './components/GuitarHighway'
import { ScoreViewer, type ScoreViewerHandle } from './components/ScoreViewer'
import { SongCoach } from './components/SongCoach'
import { ALL_SONGS, DEFAULT_DEMO, type DemoSong } from './demoSongs'
import { useAudioDetection } from './hooks/useAudioDetection'
import { useGameLoop } from './hooks/useGameLoop'
import { useMetronome } from './hooks/useMetronome'
import { useGameStore } from './store/useGameStore'
import type { GameMode } from './types'
import './game-ui.css'

type CalibrationTab = 'tuner' | 'latency'

const sleep = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))

export default function App() {
  const [songFile, setSongFile] = useState<File | string | null>(DEFAULT_DEMO.tex)
  const [selectedSong, setSelectedSong] = useState<DemoSong>(DEFAULT_DEMO)
  const [syncedSongs, setSyncedSongs] = useState<DemoSong[]>([])
  const [activeSection, setActiveSection] = useState<'game' | 'admin'>('game')
  const [showCalibration, setShowCalibration] = useState(false)
  const [calibrationTab, setCalibrationTab] = useState<CalibrationTab>('tuner')
  const [showCamera, setShowCamera] = useState(false)
  const [showDebugLog, setShowDebugLog] = useState(false)
  const [tempo, setTempo] = useState(100)
  const [isLooping, setIsLooping] = useState(false)
  const [isMetronome, setIsMetronome] = useState(true)
  const [countdown, setCountdown] = useState<string | null>(null)
  const [hasStarted, setHasStarted] = useState(false)
  const countdownTokenRef = useRef(0)
  const scoreRef = useRef<ScoreViewerHandle>(null)

  const {
    isCalibrated,
    gameMode,
    gameState,
    expectedNote,
    currentBar,
    songBpm,
    micEnabled,
    setMicEnabled,
    setGameMode,
    setWaitMode,
    setGameState,
    resetGame,
    fadeFailed,
  } = useGameStore(useShallow((state) => ({
    isCalibrated: state.isCalibrated,
    gameMode: state.gameMode,
    gameState: state.gameState,
    expectedNote: state.expectedNote,
    currentBar: state.currentBar,
    songBpm: state.songBpm,
    micEnabled: state.micEnabled,
    setMicEnabled: state.setMicEnabled,
    setGameMode: state.setGameMode,
    setWaitMode: state.setWaitMode,
    setGameState: state.setGameState,
    resetGame: state.resetGame,
    fadeFailed: state.fadeFailed,
  })))

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

  const availableSongs = [...ALL_SONGS, ...syncedSongs]
  const isSessionActive = countdown !== null || gameState === 'playing' || (
    gameMode === 'master' && gameState === 'paused' && Boolean(expectedNote)
  )

  useEffect(() => {
    fetch('/repertoire/catalog.json')
      .then((response) => response.ok ? response.json() : null)
      .then((catalog: { songs?: Array<{ title: string; artist: string; file: string }> } | null) => {
        if (!catalog?.songs) return
        setSyncedSongs(catalog.songs.map((song) => ({ title: song.title, artist: song.artist, tex: song.file })))
      })
      .catch(() => { /* El repertorio integrado permanece disponible sin conexión. */ })
  }, [])

  useEffect(() => {
    if (micEnabled && !isListening && !isRequesting) void startListening()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setMicEnabled(isListening)
  }, [isListening, setMicEnabled])

  useEffect(() => () => {
    countdownTokenRef.current += 1
    window.speechSynthesis?.cancel()
  }, [])

  const cancelCountdown = useCallback(() => {
    countdownTokenRef.current += 1
    setCountdown(null)
    window.speechSynthesis?.cancel()
  }, [])

  const speak = useCallback((message: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(message)
    utterance.lang = 'es-MX'
    utterance.rate = 1.05
    utterance.pitch = 1.08
    window.speechSynthesis.speak(utterance)
  }, [])

  const startWithCountdown = useCallback(async () => {
    const token = ++countdownTokenRef.current
    fadeFailed()

    if (!isListening && !isRequesting) await startListening()
    if (token !== countdownTokenRef.current) return

    if (hasStarted && gameMode === 'reproduction' && gameState === 'paused') {
      scoreRef.current?.play()
      return
    }

    setGameState('countdown')
    const effectiveBpm = Math.max(60, (songBpm || 112) * tempo / 100)
    const countDuration = Math.max(430, Math.min(820, 60_000 / effectiveBpm))

    for (const step of ['3', '2', '1']) {
      if (token !== countdownTokenRef.current) return
      setCountdown(step)
      speak(step === '3' ? 'tres' : step === '2' ? 'dos' : 'uno')
      await sleep(countDuration)
    }

    if (token !== countdownTokenRef.current) return
    setCountdown('¡TOCA!')
    speak('toca')
    await sleep(Math.min(360, countDuration * 0.55))
    if (token !== countdownTokenRef.current) return

    setCountdown(null)
    setHasStarted(true)
    scoreRef.current?.play()
  }, [fadeFailed, gameMode, gameState, hasStarted, isListening, isRequesting, setGameState, songBpm, speak, startListening, tempo])

  const handlePause = useCallback(() => {
    cancelCountdown()
    scoreRef.current?.pause()
    if (gameMode === 'master') setGameState('idle')
  }, [cancelCountdown, gameMode, setGameState])

  const handleReset = useCallback(() => {
    cancelCountdown()
    scoreRef.current?.stop()
    resetGame()
    setHasStarted(false)
  }, [cancelCountdown, resetGame])

  useEffect(() => {
    if (gameState !== 'finished' || !isLooping) return
    const timeout = window.setTimeout(() => {
      setHasStarted(false)
      void startWithCountdown()
    }, 650)
    return () => window.clearTimeout(timeout)
  }, [gameState, isLooping, startWithCountdown])

  const handleToggleMic = useCallback(() => {
    if (isListening) stopListening()
    else void startListening()
  }, [isListening, startListening, stopListening])

  const loadSong = useCallback((song: DemoSong) => {
    handleReset()
    setSelectedSong(song)
    setSongFile(song.tex)
    setActiveSection('game')
  }, [handleReset])

  const handleModeChange = useCallback((mode: GameMode, wait: boolean) => {
    handleReset()
    setGameMode(mode)
    setWaitMode(wait)
  }, [handleReset, setGameMode, setWaitMode])

  const handleTempoChange = useCallback((value: number) => {
    setTempo(value)
    scoreRef.current?.setTempo(value / 100)
  }, [])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    handleReset()
    const title = file.name.replace(/\.[^.]+$/, '')
    setSongFile(file)
    setSelectedSong({ title, artist: 'Mi biblioteca', tex: title })
    setActiveSection('game')
    event.target.value = ''
    if (!isCalibrated) {
      setCalibrationTab('latency')
      setShowCalibration(true)
    }
  }, [handleReset, isCalibrated])

  const handleRepositorySong = useCallback(async (entry: RepositoryFile) => {
    const response = await fetch(entry.downloadUrl)
    if (!response.ok) throw new Error(`descarga HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    const file = new File([buffer], entry.name, { type: 'application/octet-stream' })
    handleReset()
    const title = entry.name.replace(/\.[^.]+$/, '')
    setSongFile(file)
    setSelectedSong({ title, artist: entry.repository, tex: title })
    setActiveSection('game')
  }, [handleReset])

  if (activeSection === 'admin') {
    return (
      <div className="admin-app-shell">
        <button className="admin-return-button" type="button" onClick={() => setActiveSection('game')}>← Volver al juego</button>
        <AdminDashboard onLoadSong={handleRepositorySong} />
      </div>
    )
  }

  return (
    <div className="game-app">
      <div className="game-ambient game-ambient--violet" aria-hidden="true" />
      <div className="game-ambient game-ambient--cyan" aria-hidden="true" />

      <GameTopBar
        song={selectedSong}
        songs={availableSongs}
        onSelectSong={loadSong}
        onOpenAdmin={() => setActiveSection('admin')}
        onOpenCalibration={(tab) => { setCalibrationTab(tab); setShowCalibration(true) }}
        onOpenCamera={() => setShowCamera(true)}
        onToggleDebug={() => setShowDebugLog((visible) => !visible)}
        onUpload={handleFileUpload}
      />

      <main className="game-screen">
        <SongCoach song={selectedSong} />
        <GuitarHighway song={selectedSong} />

        <section className="notation-card game-card">
          <header>
            <span>PARTITURA EN VIVO</span>
            <strong>Compás {currentBar + 1}</strong>
          </header>
          <ScoreViewer ref={scoreRef} file={songFile} />
        </section>

        <GameControlDeck
          hasFile={Boolean(songFile)}
          tempo={tempo}
          isLooping={isLooping}
          isMetronome={isMetronome}
          isListening={isListening}
          isRequesting={isRequesting}
          isSessionActive={isSessionActive}
          onPlay={() => { void startWithCountdown() }}
          onPause={handlePause}
          onTempoChange={handleTempoChange}
          onToggleLooping={() => setIsLooping((looping) => !looping)}
          onToggleMetronome={() => setIsMetronome((enabled) => !enabled)}
          onToggleMic={handleToggleMic}
          onModeChange={handleModeChange}
          onOpenCamera={() => setShowCamera(true)}
          onOpenCalibration={() => { setCalibrationTab('tuner'); setShowCalibration(true) }}
        />
      </main>

      {countdown && (
        <div className="countdown-overlay" role="status" aria-live="assertive">
          <div className="countdown-rings"><i /><i /><i /></div>
          <small>PREPÁRATE</small>
          <strong key={countdown}>{countdown}</strong>
          <span>{gameMode === 'master' ? 'Escucha · respira · toca' : 'Sigue el pulso'}</span>
        </div>
      )}

      {showCamera && (
        <div className="game-modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShowCamera(false)}>
          <section className="game-tool-sheet">
            <header><div><small>COACH VISUAL</small><strong>Posición de la mano</strong></div><button type="button" onClick={() => setShowCamera(false)}>×</button></header>
            <CameraCoach />
          </section>
        </div>
      )}

      {showCalibration && (
        <div className="game-modal-backdrop" onClick={(event) => event.target === event.currentTarget && setShowCalibration(false)}>
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

      {showDebugLog && <DebugLog onClose={() => setShowDebugLog(false)} />}
      {micError && <div className="game-toast">No pudimos abrir el micrófono. Revisa el permiso del navegador.</div>}
    </div>
  )
}
