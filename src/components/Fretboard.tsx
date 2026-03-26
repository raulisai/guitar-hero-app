import { useState } from 'react'
import { useGameStore } from '../store/useGameStore'

const NUM_STRINGS = 6
// Let's show up to fret 17 to fit nicely in the viewport and cover most tab
const NUM_FRETS = 17 
const NUM_FRET_BLOCKS = NUM_FRETS + 1
// Fret markers standard on guitar
const FRET_MARKERS = [3, 5, 7, 9, 15, 17]
const DOUBLE_MARKER = 12

export function Fretboard({ compact }: { compact?: boolean }) {
  const { expectedNote, gameState, gameMode } = useGameStore()
  const [showHands, setShowHands] = useState(true)

  const isActive = gameState === 'playing' || (gameMode === 'master' && gameState === 'paused')

  // We only show the indicator if there is an active note played/expected
  const showIndicator = isActive && expectedNote && expectedNote.stringNumber !== undefined && expectedNote.fretNumber !== undefined

  // Guitar strings: 1 is usually highest pitch (thinnest), 6 is lowest (thickest).
  // In typical Tab rendering, String 1 is at the TOP, String 6 is at the BOTTOM.
  const strings = Array.from({ length: NUM_STRINGS }, (_, i) => i + 1)
  const frets = Array.from({ length: NUM_FRETS + 1 }, (_, i) => i)

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1200px',
        margin: compact ? '4px auto' : '20px auto',
        padding: '0 10px',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      {/* Visual Options Toggle */}
      <div style={{ alignSelf: 'flex-end', display: 'flex', gap: '8px', zIndex: 30 }}>
        <button
          onClick={() => setShowHands(!showHands)}
          style={{
            background: showHands ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255,255,255,0.05)',
            border: `1px solid ${showHands ? 'rgba(34, 197, 94, 0.5)' : '#444'}`,
            color: showHands ? '#22c55e' : '#aaa',
            padding: compact ? '3px 8px' : '6px 12px',
            borderRadius: '4px',
            fontSize: compact ? '11px' : '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: showHands ? '0 0 10px rgba(34,197,94,0.2)' : 'none',
          }}
        >
          {showHands ? 'Ocultar Manos' : 'Mostrar Manos'}
        </button>
      </div>

      <div 
        style={{
          width: '100%',
          position: 'relative',
          // String height container
          height: '180px', 
        }}
      >
        {/* Fretboard Background & Cropped Elements Container */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to right, #1a1a1a, #2a2a2a, #1a1a1a)',
          border: '1px solid #333',
          borderLeft: '12px solid #ddd', // The nut
          borderRadius: '4px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.8), inset 0 2px 20px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}>
        {/* Frets Layer */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
          {frets.map((fretIndex) => {
            // Decreasing width slightly to emulate real fretboard? For UI, equal distribution is often cleaner
            return (
              <div 
                key={`fret-${fretIndex}`} 
                style={{
                  flex: 1,
                  borderRight: fretIndex < NUM_FRETS ? '2px solid #4a4a4a' : 'none',
                  boxShadow: fretIndex < NUM_FRETS ? '1px 0 2px rgba(0,0,0,0.6)' : 'none',
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                {/* Markers */}
                {fretIndex > 0 && FRET_MARKERS.includes(fretIndex) && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '14px',
                    height: '14px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, #888, #444)',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 1px 2px rgba(255,255,255,0.1)'
                  }} />
                )}
                {fretIndex === DOUBLE_MARKER && (
                  <>
                    <div style={{
                      position: 'absolute',
                      top: '25%',
                      transform: 'translateY(-50%)',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #888, #444)',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 1px 2px rgba(255,255,255,0.1)'
                    }} />
                    <div style={{
                      position: 'absolute',
                      top: '75%',
                      transform: 'translateY(-50%)',
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      background: 'radial-gradient(circle, #888, #444)',
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 1px 2px rgba(255,255,255,0.1)'
                    }} />
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Strings Layer */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', pointerEvents: 'none' }}>
          {strings.map((stringNum, idx) => {
            // Display: string 1 = TOP (thin/high-E), string 6 = BOTTOM (thick/low-E)
            // AlphaTab convention: string 1 = low-E (bottom), string 6 = high-E (top)
            // Invert to match: alphaTabString = NUM_STRINGS + 1 - displayString
            const stringThickness = 1 + (idx * 0.5)
            const isPlayingThisString = showIndicator &&
              expectedNote.stringNumber === (NUM_STRINGS + 1 - stringNum)

            return (
              <div 
                key={`string-${stringNum}`}
                style={{
                  flex: 1,
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {/* The actual string */}
                <div style={{
                  width: '100%',
                  height: `${stringThickness}px`,
                  background: isPlayingThisString 
                    ? 'linear-gradient(to bottom, #d1ffd6, #22c55e, #14532d)'
                    : 'linear-gradient(to bottom, #777, #aaa, #555)',
                  boxShadow: isPlayingThisString 
                    ? '0 0 10px rgba(34, 197, 94, 0.8), 0 0 20px rgba(34, 197, 94, 0.4)'
                    : '0 1px 3px rgba(0,0,0,0.8)',
                  zIndex: isPlayingThisString ? 10 : 2,
                  transition: 'background 0.2s ease, box-shadow 0.2s ease'
                }} />
              </div>
            )
          })}
        </div>
        </div>

        {/* Glowing Indicator Finger Layer (Outside overflow:hidden container) */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {showIndicator && (
             <Indicator 
               stringNum={expectedNote.stringNumber!} 
               fretNum={expectedNote.fretNumber!} 
               showHands={showHands}
             />
          )}
        </div>
      </div>
    </div>
  )
}

function Indicator({ stringNum, fretNum, showHands }: { stringNum: number, fretNum: number, showHands: boolean }) {
  const fretX = fretNum === 0
    ? 0
    : Math.min(Math.max((fretNum + 0.5) * (100 / NUM_FRET_BLOCKS), 0), 100)
  // AlphaTab string 1 = low-E (should render at BOTTOM); invert for display
  const displayStringNum = NUM_STRINGS + 1 - stringNum
  const stringY = (displayStringNum - 0.5) * (100 / NUM_STRINGS)

  // Spring-like easing: slight overshoot → natural hand movement feel
  const spring = '0.22s cubic-bezier(0.34, 1.56, 0.64, 1)'

  return (
    <>
      {/* Hand anchor — moves to fret/string position with spring easing */}
      <div
        style={{
          position: 'absolute',
          top: `${stringY}%`,
          left: `${fretX}%`,
          width: 0,
          height: 0,
          zIndex: 15,
          transition: `top ${spring}, left ${spring}`,
          pointerEvents: 'none',
        }}
      >
        {showHands && fretNum > 0 && (
          <svg
            viewBox="0 0 76 110"
            width="76"
            height="110"
            style={{
              position: 'absolute',
              left: '-12px',   // index-finger center (x≈12) aligns with anchor
              top: '-102px',   // index-finger tip contact (y≈102) aligns with anchor
              pointerEvents: 'none',
              filter: 'drop-shadow(0 0 8px rgba(34,197,94,0.45))',
            }}
          >
            {/* ── Palm ── */}
            <path
              d="M 8,2 L 64,2 Q 74,3 74,13 Q 74,25 70,34 L 4,34 Q 0,25 0,13 Q 0,3 8,2 Z"
              fill="rgba(255,255,255,0.08)"
              stroke="rgba(255,255,255,0.44)"
              strokeWidth="1.5"
            />

            {/* ── Thumb (left side) ── */}
            <path
              d="M 6,24 Q -5,18 -5,8 Q -5,-1 5,-1 Q 16,-1 16,9 Q 16,18 6,24 Z"
              fill="rgba(255,255,255,0.06)"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="1.2"
            />

            {/*
              Left → Right = nut → bridge:
              INDEX (pressing) · MIDDLE · RING · PINKY
              The INDEX is visually dominant: tallest, brightest, green-tipped.
            */}

            {/* ── INDEX — pressing finger (tallest, brightest, green tip) ── */}
            <rect x="3" y="28" width="18" height="72" rx="9"
              fill="rgba(34,197,94,0.10)"
              stroke="rgba(255,255,255,0.60)"
              strokeWidth="2"
            />
            {/* Fingernail */}
            <ellipse cx="12" cy="36" rx="6" ry="4"
              fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
            {/* Knuckles */}
            <path d="M 4,58  Q 12,55  21,58"  stroke="rgba(255,255,255,0.25)" strokeWidth="1.1" fill="none" />
            <path d="M 4,76  Q 12,73  21,76"  stroke="rgba(255,255,255,0.25)" strokeWidth="1.1" fill="none" />
            {/* Green pressed tip */}
            <path d="M 3,92 Q 3,100 12,100 Q 21,100 21,92 Z"
              fill="rgba(34,197,94,0.30)" stroke="none" />

            {/* ── MIDDLE ── */}
            <rect x="24" y="28" width="15" height="60" rx="7.5"
              fill="rgba(255,255,255,0.07)"
              stroke="rgba(255,255,255,0.38)"
              strokeWidth="1.4"
            />
            <ellipse cx="31" cy="35" rx="5" ry="3.5"
              fill="rgba(255,255,255,0.11)" stroke="rgba(255,255,255,0.24)" strokeWidth="0.9" />
            <path d="M 25,50 Q 31,48 38,50" stroke="rgba(255,255,255,0.20)" strokeWidth="1" fill="none" />
            <path d="M 25,65 Q 31,63 38,65" stroke="rgba(255,255,255,0.20)" strokeWidth="1" fill="none" />

            {/* ── RING ── */}
            <rect x="41" y="28" width="14" height="53" rx="7"
              fill="rgba(255,255,255,0.07)"
              stroke="rgba(255,255,255,0.36)"
              strokeWidth="1.4"
            />
            <ellipse cx="48" cy="35" rx="4.5" ry="3"
              fill="rgba(255,255,255,0.11)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.9" />
            <path d="M 42,49 Q 48,47 54,49" stroke="rgba(255,255,255,0.20)" strokeWidth="1" fill="none" />
            <path d="M 42,63 Q 48,61 54,63" stroke="rgba(255,255,255,0.20)" strokeWidth="1" fill="none" />

            {/* ── PINKY (shortest) ── */}
            <rect x="57" y="28" width="12" height="40" rx="6"
              fill="rgba(255,255,255,0.07)"
              stroke="rgba(255,255,255,0.32)"
              strokeWidth="1.3"
            />
            <ellipse cx="63" cy="35" rx="4" ry="2.8"
              fill="rgba(255,255,255,0.11)" stroke="rgba(255,255,255,0.20)" strokeWidth="0.8" />
            <path d="M 58,49 Q 63,47 68,49" stroke="rgba(255,255,255,0.20)" strokeWidth="1" fill="none" />

            {/* ── Contact ellipse — index fingertip on the string ── */}
            <ellipse cx="12" cy="103" rx="9" ry="5.5"
              fill="rgba(34,197,94,0.30)"
              stroke="rgba(34,197,94,0.75)"
              strokeWidth="1.5"
            />
          </svg>
        )}
      </div>

      {/* Glowing dot — same position, smooth transition */}
      <div
        style={{
          position: 'absolute',
          top: `${stringY}%`,
          left: `${fretX}%`,
          transform: 'translate(-50%, -50%)',
          width:        fretNum === 0 ? '8px'  : '22px',
          height:       '22px',
          borderRadius: fretNum === 0 ? '4px'  : '50%',
          backgroundColor: '#22c55e',
          boxShadow: '0 0 14px 4px rgba(34,197,94,0.65), inset 0 0 8px rgba(255,255,255,0.8)',
          zIndex: 20,
          transition: `top ${spring}, left ${spring}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{
          width: '45%',
          height: '45%',
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 0 8px #fff',
        }} />
      </div>
    </>
  )
}
