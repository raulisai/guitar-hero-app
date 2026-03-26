import React from 'react'
import { useGameStore } from '../store/useGameStore'
import type { GameMode } from '../types'

interface FloatingBarProps {
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  onTempoChange: (ratio: number) => void
  hasFile: boolean
  tempo: number
  onTempoInput: (v: number) => void
  showDebugLog: boolean
  onToggleDebugLog: () => void
  isLooping: boolean
  onToggleLooping: () => void
  isMetronome: boolean
  onToggleMetronome: () => void
  onModeChange: (mode: GameMode) => void
  onReset: () => void
}

export function FloatingBar({
  onPlay,
  onPause,
  onStop,
  onTempoChange,
  hasFile,
  tempo,
  onTempoInput,
  showDebugLog,
  onToggleDebugLog,
  isLooping,
  onToggleLooping,
  isMetronome,
  onToggleMetronome,
  onModeChange,
  onReset,
}: FloatingBarProps) {
  const {
    gameState, gameMode, score, currentBar, currentBeat,
    attempts, waitMode, setWaitMode, isMuted, setIsMuted,
  } = useGameStore()

  const isPlaying = gameState === 'playing'
  const isMaster  = gameMode === 'master'

  void attempts // used for lastAttempt reference in future expansions

  return (
    <div style={{
      position: 'fixed',
      bottom: '14px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(16, 16, 16, 0.96)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      borderRadius: '20px',
      border: '1px solid #2a2a2a',
      boxShadow: '0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '0 12px',
      height: '52px',
      userSelect: 'none',
      zIndex: 100,
      whiteSpace: 'nowrap',
    }}>

      {/* ── Transport ── */}
      {isPlaying ? (
        <button onClick={onPause} title="Pausar" style={btnStyle('#22c55e', '#000', 36)}>
          <PauseIcon />
        </button>
      ) : (
        <button onClick={onPlay} disabled={!hasFile} title="Reproducir" style={btnStyle('#22c55e', '#000', 36)}>
          <PlayIcon />
        </button>
      )}
      <button onClick={onReset} disabled={!hasFile} title="Reiniciar" style={iconBtnStyle()}>
        <ResetIcon />
      </button>

      <Divider />

      {/* ── Speed ── */}
      <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.05em' }}>SPD</span>
      <input
        type="range" min={50} max={200} value={tempo} step={5}
        onChange={(e) => { const v = Number(e.target.value); onTempoInput(v); onTempoChange(v / 100) }}
        style={{ width: 64, accentColor: '#22c55e', cursor: 'pointer' }}
      />
      <span style={{ fontSize: 11, color: '#22c55e', minWidth: 32 }}>{tempo}%</span>

      <Divider />

      {/* ── Position ── */}
      <span style={{ fontSize: 11, color: '#666' }}>
        <span style={{ color: '#aaa' }}>{currentBar + 1}</span>
        <span style={{ color: '#444', margin: '0 3px' }}>·</span>
        <span style={{ color: '#aaa' }}>{currentBeat + 1}</span>
      </span>

      {/* ── Score (master only) ── */}
      {isMaster && (score.perfect + score.good + score.miss + score.wrong) > 0 && (
        <>
          <Divider />
          <span style={{ fontSize: 11, color: '#888' }}>
            <span style={{
              fontWeight: 700,
              color: score.accuracy >= 80 ? '#22c55e' : score.accuracy >= 50 ? '#f59e0b' : '#ef4444',
            }}>{score.accuracy}%</span>
          </span>
          {score.streak > 2 && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>🔥{score.streak}</span>
          )}
        </>
      )}

      {/* ── Spacer ── */}
      <div style={{ flex: 1, minWidth: 8 }} />

      {/* ── Tool buttons ── */}
      {/* Debug log — master only */}
      {isMaster && (
        <button
          onClick={onToggleDebugLog}
          title="Log de notas"
          style={toggleBtnStyle(showDebugLog)}
        >LOG</button>
      )}

      {/* Esperar — master only */}
      {isMaster && (
        <button
          onClick={() => setWaitMode(!waitMode)}
          title="Esperar nota antes de avanzar"
          style={toggleBtnStyle(waitMode)}
        >⏳</button>
      )}

      {/* Metronome */}
      <button
        onClick={onToggleMetronome}
        title={isMetronome ? 'Desactivar metrónomo' : 'Activar metrónomo'}
        style={toggleBtnStyle(isMetronome)}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
      </button>

      {/* Loop */}
      <button
        onClick={onToggleLooping}
        title={isLooping ? 'Desactivar bucle' : 'Activar bucle'}
        style={toggleBtnStyle(isLooping)}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
        </svg>
      </button>

      {/* Mute */}
      <button
        onClick={() => setIsMuted(!isMuted)}
        title={isMuted ? 'Activar audio' : 'Silenciar'}
        style={toggleBtnStyle(isMuted)}
      >
        {isMuted
          ? <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
          : <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
        }
      </button>

      <Divider />

      {/* ── Mode switch ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: gameMode === 'reproduction' ? '#fff' : '#444', fontWeight: gameMode === 'reproduction' ? 600 : 400, transition: 'color 0.2s' }}>Libre</span>
        <button
          onClick={() => onModeChange(gameMode === 'reproduction' ? 'master' : 'reproduction')}
          title="Cambiar modo"
          style={{
            position: 'relative',
            width: 44,
            height: 24,
            borderRadius: 12,
            background: gameMode === 'master' ? '#22c55e' : '#333',
            border: 'none',
            cursor: 'pointer',
            transition: 'background 0.25s',
            padding: 0,
            flexShrink: 0,
          }}
        >
          <div style={{
            position: 'absolute',
            top: 3,
            left: gameMode === 'master' ? 23 : 3,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.25s cubic-bezier(0.34,1.56,0.64,1)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
          }} />
        </button>
        <span style={{ fontSize: 11, color: gameMode === 'master' ? '#fff' : '#444', fontWeight: gameMode === 'master' ? 600 : 400, transition: 'color 0.2s' }}>Master</span>
      </div>

    </div>
  )
}

// ── Helper styles ──────────────────────────────────────────────
function Divider() {
  return <div style={{ width: 1, height: 24, background: '#2a2a2a', margin: '0 4px', flexShrink: 0 }} />
}

function btnStyle(bg: string, color: string, size: number): React.CSSProperties {
  return {
    width: size, height: size, borderRadius: '50%', background: bg, color, border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, opacity: 1,
  }
}

function iconBtnStyle(): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 8, background: 'transparent', color: '#666',
    border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, transition: 'color 0.15s',
  }
}

function toggleBtnStyle(active: boolean): React.CSSProperties {
  return {
    height: 28, borderRadius: 6, padding: '0 8px',
    background: active ? '#22c55e22' : 'transparent',
    color: active ? '#22c55e' : '#555',
    border: `1px solid ${active ? '#22c55e44' : 'transparent'}`,
    cursor: 'pointer', fontSize: 11, fontFamily: 'monospace', fontWeight: 600,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
    flexShrink: 0, transition: 'all 0.15s',
  }
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="5,3 19,12 5,21"/></svg>
}
function PauseIcon() {
  return <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
}
function ResetIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
}
