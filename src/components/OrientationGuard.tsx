import { useState, useEffect } from 'react'

export function OrientationGuard() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const check = () => {
      // Only trigger on portrait AND small enough to be a phone/tablet
      setShow(window.innerWidth < window.innerHeight && window.innerWidth < 768)
    }
    check()
    window.addEventListener('resize', check)
    window.addEventListener('orientationchange', check)
    return () => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
    }
  }, [])

  if (!show) return null

  return (
    <>
      <style>{`
        @keyframes _phone-spin {
          0%  { transform: rotate(0deg) scale(1);   }
          35% { transform: rotate(-90deg) scale(1.1); }
          65% { transform: rotate(-90deg) scale(1.1); }
          100%{ transform: rotate(0deg) scale(1);   }
        }
        @keyframes _arrows-pulse {
          0%, 30% { opacity: 0.15; transform: translateX(0); }
          60%      { opacity: 1;    transform: translateX(6px); }
          100%     { opacity: 0.15; transform: translateX(0); }
        }
        @keyframes _hint-fade {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 1; }
        }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(160deg, #080808 0%, #0f0f0f 60%, #0a0a0a 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 28, padding: 32,
      }}>
        {/* Animated phone */}
        <div style={{ animation: '_phone-spin 2.8s ease-in-out infinite', transformOrigin: 'center' }}>
          <svg viewBox="0 0 56 88" width="64" height="100" fill="none" strokeLinecap="round" strokeLinejoin="round">
            {/* Phone body */}
            <rect x="4" y="2" width="48" height="84" rx="8"
              stroke="#22c55e" strokeWidth="2.5" fill="rgba(34,197,94,0.04)" />
            {/* Home bar */}
            <rect x="20" y="76" width="16" height="4" rx="2" fill="#22c55e" opacity="0.6" />
            {/* Speaker */}
            <rect x="21" y="8" width="14" height="3" rx="1.5" fill="#22c55e" opacity="0.4" />
            {/* Screen lines (partitura hint) */}
            {[20, 26, 32, 38, 44, 50].map(y => (
              <line key={y} x1="13" y1={y} x2="43" y2={y}
                stroke="#22c55e" strokeWidth="1" opacity="0.2" />
            ))}
          </svg>
        </div>

        {/* Arrow hint */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, animation: '_arrows-pulse 2.8s ease-in-out infinite' }}>
          {[0, 1, 2].map(i => (
            <svg key={i} viewBox="0 0 16 24" width="14" height="20" fill="none"
              stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round"
              style={{ opacity: 0.4 + i * 0.3 }}
            >
              <polyline points="4 4 12 12 4 20" />
            </svg>
          ))}
        </div>

        {/* Text */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ color: '#fff', fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.3px' }}>
            Gira tu dispositivo
          </p>
          <p style={{ color: '#555', fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            Para una mejor experiencia<br />usa el modo horizontal
          </p>
        </div>

        {/* GuitarrStudio tag */}
        <p style={{
          position: 'absolute', bottom: 24,
          color: '#22c55e', fontSize: 12, fontWeight: 700,
          letterSpacing: '-0.2px', margin: 0,
          animation: '_hint-fade 3s ease-in-out infinite',
        }}>
          GuitarrStudio
        </p>
      </div>
    </>
  )
}
