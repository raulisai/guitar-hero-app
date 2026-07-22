import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { GameMode } from '../types'
import { useGameStore } from '../store/useGameStore'

interface GameControlDeckProps {
  hasFile: boolean
  tempo: number
  isLooping: boolean
  isMetronome: boolean
  isListening: boolean
  isRequesting: boolean
  isSessionActive: boolean
  onPlay: () => void
  onPause: () => void
  onTempoChange: (value: number) => void
  onToggleLooping: () => void
  onToggleMetronome: () => void
  onToggleMic: () => void
  onModeChange: (mode: GameMode, wait: boolean) => void
  onOpenCamera: () => void
  onOpenCalibration: () => void
}

export function GameControlDeck({
  hasFile,
  tempo,
  isLooping,
  isMetronome,
  isListening,
  isRequesting,
  isSessionActive,
  onPlay,
  onPause,
  onTempoChange,
  onToggleLooping,
  onToggleMetronome,
  onToggleMic,
  onModeChange,
  onOpenCamera,
  onOpenCalibration,
}: GameControlDeckProps) {
  const [optionsOpen, setOptionsOpen] = useState(false)
  const { expectedNote, detectedNote, currentBeat, gameMode, waitMode, score, attempts } = useGameStore(useShallow((state) => ({
    expectedNote: state.expectedNote,
    detectedNote: state.detectedNote,
    currentBeat: state.currentBeat,
    gameMode: state.gameMode,
    waitMode: state.waitMode,
    score: state.score,
    attempts: state.attempts,
  })))
  const tuningGood = Boolean(detectedNote && Math.abs(detectedNote.cents) <= 15)
  const lastAttempt = attempts.at(-1)
  const nextNote = expectedNote?.name ?? 'G8'
  const updateTempo = (change: number) => onTempoChange(Math.max(50, Math.min(150, tempo + change)))

  return (
    <>
      <section className="beat-status game-card">
        <span>Próxima nota: <strong>{nextNote}</strong></span>
        <div className="beat-pulse" aria-label={`Pulso ${currentBeat % 4 + 1} de 4`}>
          {[0, 1, 2, 3].map((beat) => <i key={beat} className={currentBeat % 4 === beat ? 'is-current' : ''} />)}
          <small>Pulso</small>
        </div>
        <p>{lastAttempt?.result === 'wrong' || lastAttempt?.result === 'miss' ? 'Respira y vuelve a intentarlo' : 'Lleva tiempo, tú puedes'} <b>♥</b></p>
      </section>

      <section className="control-deck game-card">
        <div className="control-deck__main">
          <ControlToggle
            icon={<MetronomeIcon />}
            label="Metrónomo"
            active={isMetronome}
            onClick={onToggleMetronome}
          />
          <ControlToggle
            icon={<MicIcon />}
            label="Micrófono"
            active={isListening}
            pending={isRequesting}
            onClick={onToggleMic}
          />

          <button
            className={`transport-button${isSessionActive ? ' is-playing' : ''}`}
            type="button"
            disabled={!hasFile}
            onClick={isSessionActive ? onPause : onPlay}
            aria-label={isSessionActive ? 'Pausar' : 'Reproducir'}
          >
            {isSessionActive ? <PauseIcon /> : <PlayIcon />}
            <span aria-hidden="true" />
          </button>

          <div className="speed-control">
            <span>Velocidad</span>
            <div><button type="button" onClick={() => updateTempo(-5)}>−</button><strong>{tempo}%</strong><button type="button" onClick={() => updateTempo(5)}>+</button></div>
          </div>

          <button className={`repeat-control${isLooping ? ' is-active' : ''}`} type="button" onClick={onToggleLooping}>
            <RepeatIcon /><span><strong>Repetir</strong><small>{isLooping ? 'SECCIÓN' : 'OFF'}</small></span>
          </button>

          <button
            className={`deck-options-trigger${optionsOpen ? ' is-open' : ''}`}
            type="button"
            onClick={() => setOptionsOpen((open) => !open)}
            aria-expanded={optionsOpen}
            aria-label="Más opciones"
          >
            <ChevronIcon />
          </button>
        </div>

        {optionsOpen && (
          <div className="control-cloud">
            <header><span>Modo de avance</span><button type="button" onClick={() => setOptionsOpen(false)}>×</button></header>
            <div className="flow-mode-picker">
              <button
                className={gameMode === 'reproduction' ? 'is-active' : ''}
                type="button"
                onClick={() => onModeChange('reproduction', false)}
              >
                <FlowIcon />
                <span><strong>Seguido</strong><small>La canción nunca se detiene</small></span>
              </button>
              <button
                className={gameMode === 'master' && waitMode ? 'is-active' : ''}
                type="button"
                onClick={() => onModeChange('master', true)}
              >
                <WaitIcon />
                <span><strong>Esperar nota</strong><small>Avanza cuando la tocas bien</small></span>
              </button>
              <button
                className={gameMode === 'master' && !waitMode ? 'is-active' : ''}
                type="button"
                onClick={() => onModeChange('master', false)}
              >
                <PracticeIcon />
                <span><strong>Práctica</strong><small>Da tiempo y registra intentos</small></span>
              </button>
            </div>
            <div className="control-cloud__tools">
              <button type="button" onClick={onOpenCamera}><CameraIcon /> Coach de cámara</button>
              <button type="button" onClick={onOpenCalibration}><TunerIcon /> Afinar guitarra</button>
              <span>Precisión <strong>{score.accuracy}%</strong></span>
            </div>
          </div>
        )}

        <footer className="control-status">
          <span className={`listen-dot${isListening ? ' is-on' : ''}`} />
          <strong>{isListening ? 'Escuchando tu guitarra…' : 'Micrófono listo para activar'}</strong>
          <div>
            <span>Afinación</span>
            <strong className={tuningGood ? 'is-good' : ''}>{detectedNote ? tuningGood ? 'Bien' : `${detectedNote.cents > 0 ? '+' : ''}${detectedNote.cents}¢` : '—'}</strong>
            <TuningIcon />
          </div>
        </footer>
      </section>
    </>
  )
}

function ControlToggle({ icon, label, active, pending, onClick }: { icon: React.ReactNode; label: string; active: boolean; pending?: boolean; onClick: () => void }) {
  return (
    <button className={`control-toggle${active ? ' is-active' : ''}`} type="button" onClick={onClick} disabled={pending}>
      {icon}<span><strong>{label}</strong><small>{pending ? '…' : active ? 'ON' : 'OFF'}<i /></small></span>
    </button>
  )
}

function Icon({ children, fill = 'none' }: { children: React.ReactNode; fill?: string }) {
  return <svg viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}
function MetronomeIcon() { return <Icon><path d="m8 4-4 16h16L16 4zM12 7l4 8M9 17h6" /></Icon> }
function MicIcon() { return <Icon><rect x="8" y="2" width="8" height="13" rx="4" /><path d="M5 11a7 7 0 0 0 14 0M12 18v4M9 22h6" /></Icon> }
function PauseIcon() { return <Icon fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" stroke="none" /><rect x="14" y="5" width="4" height="14" rx="1" stroke="none" /></Icon> }
function PlayIcon() { return <Icon fill="currentColor"><path d="m8 5 11 7-11 7z" stroke="none" /></Icon> }
function RepeatIcon() { return <Icon><path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3" /></Icon> }
function ChevronIcon() { return <Icon><path d="m7 10 5 5 5-5" /></Icon> }
function FlowIcon() { return <Icon><path d="M4 7h13l-3-3M20 17H7l3 3" /></Icon> }
function WaitIcon() { return <Icon><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></Icon> }
function PracticeIcon() { return <Icon><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></Icon> }
function CameraIcon() { return <Icon><path d="M8 6 9.5 4h5L16 6h3a2 2 0 0 1 2 2v10H3V8a2 2 0 0 1 2-2z" /><circle cx="12" cy="12" r="3" /></Icon> }
function TunerIcon() { return <Icon><path d="M5 20a7 7 0 1 1 14 0M12 16l4-5M12 3v3M5 7l2 2M19 7l-2 2" /></Icon> }
function TuningIcon() { return <Icon><path d="M5 17V7M12 20V4M19 15V9M2 12h20" /></Icon> }
