import React, { useEffect, useRef } from 'react'
import { useGameStore } from '../store/useGameStore'
import type { GameMode } from '../types'
import { Fretboard } from './Fretboard'

const WV_W = 80   // waveform canvas width
const WV_H = 18   // waveform canvas height
const WV_BUF = 512

export type PanelView = 'fretboard' | 'metronome' | 'keyboard'

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
  // mic
  isListening: boolean
  isRequesting: boolean
  onToggleMic: () => void
  analyserRef: React.RefObject<AnalyserNode | null>
  micError: string | null
  // panel
  panelOpen: boolean
  panelView: PanelView
  onTogglePanel: () => void
  onChangePanelView: (v: PanelView) => void
}

export function FloatingBar({
  onPlay, onPause, onStop: _onStop,
  onTempoChange, hasFile, tempo, onTempoInput,
  showDebugLog, onToggleDebugLog,
  isLooping, onToggleLooping,
  isMetronome, onToggleMetronome,
  onModeChange, onReset,
  isListening, isRequesting, onToggleMic,
  analyserRef, micError,
  panelOpen, panelView, onTogglePanel, onChangePanelView,
}: FloatingBarProps) {
  const {
    gameState, gameMode, score, currentBar, currentBeat,
    waitMode, setWaitMode, isMuted, setIsMuted,
    detectedNote, expectedNote, songBpm,
  } = useGameStore()

  const isPlaying = gameState === 'playing'
  const isMaster  = gameMode === 'master'

  const matches = !!(detectedNote && expectedNote && detectedNote.midi === expectedNote.midi)

  // ── Waveform ────────────────────────────────────────────────
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const frameRef   = useRef<number>(0)
  const wvDataRef  = useRef(new Float32Array(WV_BUF))
  const colorRef   = useRef('#444')
  colorRef.current = matches ? '#22c55e' : detectedNote ? '#e5e5e5' : '#444'

  useEffect(() => {
    if (!isListening) { cancelAnimationFrame(frameRef.current); return }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      frameRef.current = requestAnimationFrame(draw)
      if (!analyserRef.current) return
      analyserRef.current.getFloatTimeDomainData(wvDataRef.current)
      ctx.clearRect(0, 0, WV_W, WV_H)
      ctx.strokeStyle = colorRef.current
      ctx.lineWidth = 1.3
      ctx.beginPath()
      const step = WV_BUF / WV_W
      for (let i = 0; i < WV_W; i++) {
        const s = wvDataRef.current[Math.floor(i * step)] ?? 0
        const y = ((s + 1) / 2) * WV_H
        i === 0 ? ctx.moveTo(i, y) : ctx.lineTo(i, y)
      }
      ctx.stroke()
    }
    draw()
    return () => cancelAnimationFrame(frameRef.current)
  }, [isListening, analyserRef])

  return (
    <div style={{
      position: 'fixed', bottom: 14, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      zIndex: 100, userSelect: 'none',
    }}>

      {/* ── Panel card (when open) ── */}
      {panelOpen && (
        <div style={{
          width: 'min(900px, calc(100vw - 32px))',
          background: 'rgba(14,14,14,0.97)',
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          borderRadius: 16, border: '1px solid #2a2a2a',
          boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
          overflow: 'hidden',
        }}>
          {/* Panel header with tabs + minimize button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '5px 8px', borderBottom: '1px solid #1e1e1e' }}>
            {(['fretboard', 'metronome', 'keyboard'] as PanelView[]).map(v => (
              <button key={v} onClick={() => onChangePanelView(v)} style={{
                height: 26, padding: '0 10px', borderRadius: 6, border: 'none',
                background: panelView === v ? '#22c55e22' : 'transparent',
                color: panelView === v ? '#22c55e' : '#555',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {v === 'fretboard' ? '🎸 Mástil' : v === 'metronome' ? '🥁 Metrónomo' : '🎹 Teclado'}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <button onClick={onTogglePanel} title="Minimizar" style={{
              width: 26, height: 26, borderRadius: 6, border: 'none',
              background: 'transparent', color: '#444', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'color 0.15s',
            }}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="18 15 12 21 6 15"/>
              </svg>
            </button>
          </div>
          {/* Panel content */}
          <div>
            {panelView === 'fretboard' && <Fretboard compact />}
            {panelView === 'metronome' && (
              <MetronomePanel
                bpm={songBpm}
                tempo={tempo}
                currentBeat={currentBeat}
                isActive={isMetronome}
                onToggle={onToggleMetronome}
              />
            )}
            {panelView === 'keyboard' && <KeyboardPanel />}
          </div>
        </div>
      )}

      {/* ── Bar row ── */}
      <div style={{ position: 'relative' }}>

        {/* Bubble — floats to the left of the pill */}
        <button
          onClick={onTogglePanel}
          title={panelOpen ? 'Minimizar panel' : 'Abrir panel'}
          style={{
            position: 'absolute',
            right: 'calc(100% + 8px)',
            top: '50%',
            transform: 'translateY(-50%)',
            width: 40, height: 40, borderRadius: '50%',
            border: `1px solid ${panelOpen ? '#22c55e44' : '#2a2a2a'}`,
            background: panelOpen ? 'rgba(34,197,94,0.08)' : 'rgba(14,14,14,0.97)',
            backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
            boxShadow: panelOpen ? '0 0 12px rgba(34,197,94,0.18)' : '0 4px 16px rgba(0,0,0,0.5)',
            color: panelOpen ? '#22c55e' : '#555',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', flexShrink: 0,
          }}
        >
          {panelView === 'fretboard' ? <FretboardIcon /> : panelView === 'metronome' ? <MetronomeIcon /> : <KeyboardIcon />}
        </button>

        {/* The pill (existing bar) */}
        <div style={{
          background: 'rgba(16,16,16,0.97)',
          backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          borderRadius: 20,
          border: `1px solid ${isListening && matches ? '#22c55e55' : '#2a2a2a'}`,
          boxShadow: isListening && matches
            ? '0 8px 40px rgba(0,0,0,0.65), 0 0 16px rgba(34,197,94,0.12)'
            : '0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transition: 'border-color 0.25s, box-shadow 0.25s',
        }}>

          {/* ── Mic info row (only when listening) ── */}
          {isListening && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '7px 16px',
              borderBottom: '1px solid #1e1e1e',
              whiteSpace: 'nowrap',
            }}>
              {micError ? (
                <span style={{ fontSize: 10, color: '#ef4444' }}>{micError}</span>
              ) : (
                <>
                  <NoteCell name={expectedNote?.name ?? '—'} label="espera" color="#3b82f6" />
                  <span style={{
                    fontSize: 14,
                    color: matches ? '#22c55e' : '#2e2e2e',
                    transition: 'color 0.15s',
                    lineHeight: 1,
                    fontWeight: 600,
                  }}>
                    {matches ? '✓' : '→'}
                  </span>
                  <NoteCell
                    name={detectedNote?.name ?? '—'}
                    label="tocando"
                    color={matches ? '#22c55e' : detectedNote ? '#e5e5e5' : '#444'}
                  />
                  <div style={{ width: 1, height: 20, background: '#222', flexShrink: 0 }} />
                  <canvas
                    ref={canvasRef}
                    width={WV_W}
                    height={WV_H}
                    style={{ display: 'block', borderRadius: 3, background: '#080808', flexShrink: 0 }}
                  />
                </>
              )}
            </div>
          )}

          {/* ── Controls row ── */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '0 12px',
            height: '52px',
            whiteSpace: 'nowrap',
          }}>

            {/* Transport */}
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

            {/* Mic button */}
            <button
              onClick={onToggleMic}
              disabled={isRequesting}
              title={isListening ? 'Apagar micrófono' : 'Activar micrófono'}
              style={{
                width: 30, height: 30, borderRadius: '50%', border: 'none', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isListening ? '#22c55e' : '#1e1e1e',
                color: isListening ? '#000' : '#666',
                cursor: isRequesting ? 'default' : 'pointer',
                opacity: isRequesting ? 0.5 : 1,
                transition: 'background 0.2s, color 0.2s',
                boxShadow: isListening ? '0 0 8px rgba(34,197,94,0.35)' : 'none',
              }}
            >
              <MicIcon />
            </button>

            <Divider />

            {/* Speed */}
            <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.05em' }}>SPD</span>
            <input
              type="range" min={50} max={200} value={tempo} step={5}
              onChange={(e) => { const v = Number(e.target.value); onTempoInput(v); onTempoChange(v / 100) }}
              style={{ width: 64, accentColor: '#22c55e', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11, color: '#22c55e', minWidth: 32 }}>{tempo}%</span>

            <Divider />

            {/* Position */}
            <span style={{ fontSize: 11, color: '#666' }}>
              <span style={{ color: '#aaa' }}>{currentBar + 1}</span>
              <span style={{ color: '#383838', margin: '0 3px' }}>·</span>
              <span style={{ color: '#aaa' }}>{currentBeat + 1}</span>
            </span>

            {/* Score — master only */}
            {isMaster && (score.perfect + score.good + score.miss + score.wrong) > 0 && (
              <>
                <Divider />
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: score.accuracy >= 80 ? '#22c55e' : score.accuracy >= 50 ? '#f59e0b' : '#ef4444',
                }}>{score.accuracy}%</span>
                {score.streak > 2 && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>🔥{score.streak}</span>
                )}
              </>
            )}

            {/* Spacer */}
            <div style={{ flex: 1, minWidth: 8 }} />

            {/* Tools */}
            {isMaster && (
              <button onClick={onToggleDebugLog} title="Log de notas" style={toggleBtnStyle(showDebugLog)}>
                LOG
              </button>
            )}
            {isMaster && (
              <button onClick={() => setWaitMode(!waitMode)} title="Esperar nota antes de avanzar" style={toggleBtnStyle(waitMode)}>
                ⏳
              </button>
            )}
            <button onClick={onToggleMetronome} title={isMetronome ? 'Desactivar metrónomo' : 'Activar metrónomo'} style={toggleBtnStyle(isMetronome)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
              </svg>
            </button>
            <button onClick={onToggleLooping} title={isLooping ? 'Desactivar bucle' : 'Activar bucle'} style={toggleBtnStyle(isLooping)}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </button>
            <button onClick={() => setIsMuted(!isMuted)} title={isMuted ? 'Activar audio' : 'Silenciar'} style={toggleBtnStyle(isMuted)}>
              {isMuted
                ? <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                : <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
              }
            </button>

            <Divider />

            {/* Mode switch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: gameMode === 'reproduction' ? 600 : 400, color: gameMode === 'reproduction' ? '#fff' : '#444', transition: 'color 0.2s' }}>Libre</span>
              <button
                onClick={() => onModeChange(gameMode === 'reproduction' ? 'master' : 'reproduction')}
                title="Cambiar modo"
                style={{
                  position: 'relative', width: 44, height: 24, borderRadius: 12, padding: 0, flexShrink: 0,
                  background: gameMode === 'master' ? '#22c55e' : '#333', border: 'none',
                  cursor: 'pointer', transition: 'background 0.25s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3,
                  left: gameMode === 'master' ? 23 : 3,
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  transition: 'left 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                }} />
              </button>
              <span style={{ fontSize: 11, fontWeight: gameMode === 'master' ? 600 : 400, color: gameMode === 'master' ? '#fff' : '#444', transition: 'color 0.2s' }}>Master</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

// ── Panel inner components ─────────────────────────────────────────────

function MetronomePanel({ bpm, tempo, currentBeat, isActive, onToggle }: {
  bpm: number; tempo: number; currentBeat: number; isActive: boolean; onToggle: () => void
}) {
  const effectiveBpm = bpm > 0 ? Math.round(bpm * tempo / 100) : 0
  const beatIdx = currentBeat % 4

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 32, padding: '16px 24px', height: 100 }}>
      {/* BPM */}
      <div style={{ textAlign: 'center', minWidth: 80 }}>
        <div style={{ fontSize: 52, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
          {effectiveBpm || '—'}
        </div>
        <div style={{ fontSize: 10, color: '#444', letterSpacing: '0.1em', marginTop: 4 }}>BPM</div>
      </div>

      {/* Pendulum */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <div style={{ position: 'relative', width: 4, height: 56, display: 'flex', justifyContent: 'center' }}>
          {/* Pivot dot */}
          <div style={{ position: 'absolute', top: 0, width: 6, height: 6, borderRadius: '50%', background: '#444', left: -1 }} />
          {/* Rod */}
          <div style={{
            width: 2, height: '100%', background: 'linear-gradient(to bottom, #555, #888)',
            borderRadius: 1,
            transformOrigin: 'top center',
            transform: isActive ? `rotate(${beatIdx % 2 === 0 ? -22 : 22}deg)` : 'rotate(0deg)',
            transition: isActive && bpm > 0 ? `transform ${(60 / (effectiveBpm || 60)) * 0.45}s ease-in-out` : 'none',
          }} />
          {/* Bob */}
          <div style={{
            position: 'absolute', bottom: -4, left: '50%', transform: 'translateX(-50%)',
            width: 12, height: 12, borderRadius: '50%',
            background: isActive ? '#22c55e' : '#444',
            boxShadow: isActive ? '0 0 8px rgba(34,197,94,0.5)' : 'none',
            transition: 'background 0.2s, box-shadow 0.2s',
          }} />
        </div>
      </div>

      {/* Beat dots */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            width: i === 0 ? 18 : 13,
            height: i === 0 ? 18 : 13,
            borderRadius: '50%',
            background: isActive && beatIdx === i
              ? (i === 0 ? '#22c55e' : '#e5e5e5')
              : '#222',
            boxShadow: isActive && beatIdx === i && i === 0 ? '0 0 10px rgba(34,197,94,0.5)' : 'none',
            transition: 'background 0.06s, box-shadow 0.06s',
            border: '1px solid #333',
          }} />
        ))}
      </div>

      {/* Toggle */}
      <button onClick={onToggle} style={toggleBtnStyle(isActive)}>
        {isActive ? 'Detener' : 'Iniciar'}
      </button>
    </div>
  )
}

function KeyboardPanel() {
  const { expectedNote, detectedNote } = useGameStore()
  const expMidi = expectedNote?.midi
  const detMidi = detectedNote?.midi

  const START = 48 // C3
  const OCTAVES = 3
  const W = 34   // white key width (SVG units)
  const H = 82   // white key height
  const BW = 21  // black key width
  const BH = 52  // black key height

  const WHITE_CLASSES = [0, 2, 4, 5, 7, 9, 11] // C D E F G A B
  const BLACK_CENTER: Record<number, number> = { 1: 0.62, 3: 1.68, 6: 3.62, 8: 4.50, 10: 5.68 }

  const svgW = OCTAVES * 7 * W

  const getX = (midi: number): { isBlack: boolean; x: number } => {
    const noteClass = midi % 12
    const oct = Math.floor((midi - START) / 12)
    const octX = oct * 7 * W
    if (WHITE_CLASSES.includes(noteClass)) {
      return { isBlack: false, x: octX + WHITE_CLASSES.indexOf(noteClass) * W }
    }
    return { isBlack: true, x: octX + BLACK_CENTER[noteClass] * W - BW / 2 }
  }

  const whites: React.ReactNode[] = []
  const blacks: React.ReactNode[] = []
  const labels: React.ReactNode[] = []

  for (let midi = START; midi < START + OCTAVES * 12; midi++) {
    const { isBlack, x } = getX(midi)
    const isExp = midi === expMidi
    const isDet = midi === detMidi
    const fill = isExp && isDet ? '#22c55e'
      : isExp ? '#3b82f6'
      : isDet ? '#22c55e'
      : isBlack ? '#181818' : '#d8d8d8'
    const stroke = isBlack ? '#000' : '#aaa'
    const glow = (isExp || isDet) ? `drop-shadow(0 0 4px ${fill}88)` : undefined

    const el = (
      <g key={midi} style={{ filter: glow }}>
        <rect x={x} y={0} width={isBlack ? BW : W - 1} height={isBlack ? BH : H}
          fill={fill} stroke={stroke} strokeWidth={0.8} rx={isBlack ? 3 : 2} />
        {(isExp || isDet) && (
          <text
            x={x + (isBlack ? BW / 2 : W / 2 - 0.5)} y={isBlack ? BH - 6 : H - 8}
            textAnchor="middle" fontSize={isBlack ? 7 : 9} fontWeight="700"
            fill={isBlack ? '#fff' : '#111'}
          >
            {noteToName(midi)}
          </text>
        )}
      </g>
    )
    if (isBlack) blacks.push(el)
    else whites.push(el)
  }

  // C note labels (every octave)
  for (let o = 0; o < OCTAVES; o++) {
    const midi = START + o * 12
    const { x } = getX(midi)
    labels.push(
      <text key={`label-${o}`} x={x + W / 2 - 0.5} y={H - 2}
        textAnchor="middle" fontSize={7} fill="#555">
        C{Math.floor(midi / 12) - 1}
      </text>
    )
  }

  return (
    <div style={{ padding: '10px 16px 12px' }}>
      <svg viewBox={`0 0 ${svgW} ${H}`} width="100%" style={{ display: 'block', maxHeight: 90 }}>
        {whites}
        {labels}
        {blacks}
      </svg>
    </div>
  )
}

function noteToName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  return names[midi % 12]
}

// ── Panel icons ────────────────────────────────────────────────────────

function FretboardIcon() {
  return (
    <svg viewBox="0 0 20 16" width="18" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <line x1="1" y1="3" x2="19" y2="3"/>
      <line x1="1" y1="8" x2="19" y2="8"/>
      <line x1="1" y1="13" x2="19" y2="13"/>
      <line x1="5" y1="1" x2="5" y2="15" strokeWidth="1" stroke="#555"/>
      <line x1="10" y1="1" x2="10" y2="15" strokeWidth="1" stroke="#555"/>
      <line x1="15" y1="1" x2="15" y2="15" strokeWidth="1" stroke="#555"/>
    </svg>
  )
}

function MetronomeIcon() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M10 3 L4 17 L16 17 Z"/>
      <line x1="10" y1="3" x2="14" y2="11"/>
      <circle cx="10" cy="17" r="1.5" fill="currentColor"/>
    </svg>
  )
}

function KeyboardIcon() {
  return (
    <svg viewBox="0 0 22 14" width="18" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="1" y="1" width="20" height="12" rx="1.5"/>
      {[5, 9, 13, 17].map(x => <line key={x} x1={x} y1="1" x2={x} y2="13"/>)}
      {[4, 7, 11, 15, 18].map(x => <rect key={x} x={x - 1} y="1" width="2.5" height="7" fill="currentColor" rx="0.5"/>)}
    </svg>
  )
}

// ── Sub-components & helpers ───────────────────────────────────────────
function NoteCell({ name, label, color }: { name: string; label: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 26 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color, lineHeight: 1 }}>{name}</div>
      <div style={{ fontSize: 8, color: '#383838', marginTop: 2, letterSpacing: '0.04em' }}>{label}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 24, background: '#2a2a2a', margin: '0 4px', flexShrink: 0 }} />
}

function btnStyle(bg: string, color: string, size: number): React.CSSProperties {
  return { width: size, height: size, borderRadius: '50%', background: bg, color, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
}
function iconBtnStyle(): React.CSSProperties {
  return { width: 30, height: 30, borderRadius: 8, background: 'transparent', color: '#666', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'color 0.15s' }
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

function PlayIcon()  { return <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><polygon points="5,3 19,12 5,21"/></svg> }
function PauseIcon() { return <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg> }
function ResetIcon() { return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg> }
function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
      <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2z"/>
      <path d="M19 11a1 1 0 0 1 1 1 8 8 0 0 1-7 7.94V22h2a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2h2v-2.06A8 8 0 0 1 4 12a1 1 0 0 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1z"/>
    </svg>
  )
}
