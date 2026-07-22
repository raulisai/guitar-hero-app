import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { DemoSong } from '../demoSongs'
import { useGameStore } from '../store/useGameStore'

type TopMenu = 'navigation' | 'songs' | 'profile' | null

interface GameTopBarProps {
  song: DemoSong
  songs: DemoSong[]
  onSelectSong: (song: DemoSong) => void
  onOpenAdmin: () => void
  onOpenCalibration: (tab: 'tuner' | 'latency') => void
  onOpenCamera: () => void
  onToggleDebug: () => void
  onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
}

export function GameTopBar({
  song,
  songs,
  onSelectSong,
  onOpenAdmin,
  onOpenCalibration,
  onOpenCamera,
  onToggleDebug,
  onUpload,
}: GameTopBarProps) {
  const [menu, setMenu] = useState<TopMenu>(null)
  const [query, setQuery] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const { score, attempts } = useGameStore(useShallow((state) => ({
    score: state.score,
    attempts: state.attempts,
  })))

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [])

  const filteredSongs = songs.filter((candidate) =>
    `${candidate.title} ${candidate.artist}`.toLocaleLowerCase('es')
      .includes(query.trim().toLocaleLowerCase('es'))
  )

  const selectSong = (candidate: DemoSong) => {
    onSelectSong(candidate)
    setMenu(null)
    setQuery('')
  }

  return (
    <header className="game-topbar">
      <button
        className="topbar-icon-button"
        type="button"
        onClick={() => setMenu((current) => current === 'navigation' ? null : 'navigation')}
        aria-label="Abrir menú"
        aria-expanded={menu === 'navigation'}
      >
        <MenuIcon />
      </button>

      <button
        className="song-search-trigger"
        type="button"
        onClick={() => setMenu((current) => current === 'songs' ? null : 'songs')}
        aria-expanded={menu === 'songs'}
      >
        <SearchIcon />
        <span>Buscar canciones o lecciones…</span>
        <ChevronIcon />
      </button>

      <button
        className="streak-button"
        type="button"
        onClick={() => setMenu((current) => current === 'profile' ? null : 'profile')}
        aria-label={`${score.streak || 7} notas en racha`}
        aria-expanded={menu === 'profile'}
      >
        <span className="streak-flame" aria-hidden="true"><FlameIcon /></span>
        <strong>{score.streak || 7}</strong>
        <small>Racha</small>
      </button>

      <button
        className="topbar-icon-button profile-button"
        type="button"
        onClick={() => setMenu((current) => current === 'profile' ? null : 'profile')}
        aria-label="Abrir progreso"
        aria-expanded={menu === 'profile'}
      >
        <ProfileIcon />
      </button>

      {menu && (
        <>
          <button className="game-cloud-backdrop" type="button" onClick={() => setMenu(null)} aria-label="Cerrar menú" />
          <section className={`game-cloud game-cloud--${menu}`} aria-label="Opciones desplegables">
            <div className="game-cloud__handle" />

            {menu === 'navigation' && (
              <>
                <header className="game-cloud__header">
                  <div>
                    <small>GUITARRSTUDIO</small>
                    <strong>Centro de control</strong>
                  </div>
                  <button type="button" onClick={() => setMenu(null)} aria-label="Cerrar">×</button>
                </header>
                <div className="game-cloud__grid">
                  <CloudAction icon={<MusicIcon />} label="Canciones" onClick={() => setMenu('songs')} />
                  <CloudAction icon={<TunerIcon />} label="Afinador" onClick={() => { setMenu(null); onOpenCalibration('tuner') }} />
                  <CloudAction icon={<PulseIcon />} label="Calibración" onClick={() => { setMenu(null); onOpenCalibration('latency') }} />
                  <CloudAction icon={<CameraIcon />} label="Cámara" onClick={() => { setMenu(null); onOpenCamera() }} />
                  <CloudAction icon={<ChartIcon />} label="Panel admin" onClick={() => { setMenu(null); onOpenAdmin() }} />
                  <CloudAction icon={<BugIcon />} label="Diagnóstico" onClick={() => { setMenu(null); onToggleDebug() }} />
                </div>
                <button className="cloud-upload" type="button" onClick={() => fileRef.current?.click()}>
                  <UploadIcon /> Importar archivo Guitar Pro
                </button>
              </>
            )}

            {menu === 'songs' && (
              <>
                <header className="game-cloud__header">
                  <div>
                    <small>REPERTORIO</small>
                    <strong>Elige una canción</strong>
                  </div>
                  <button type="button" onClick={() => setMenu(null)} aria-label="Cerrar">×</button>
                </header>
                <label className="cloud-search">
                  <SearchIcon />
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar canciones o lecciones…"
                  />
                </label>
                <div className="cloud-song-list">
                  {filteredSongs.map((candidate) => (
                    <button
                      key={`${candidate.artist}-${candidate.title}`}
                      className={candidate.title === song.title && candidate.artist === song.artist ? 'is-active' : ''}
                      type="button"
                      onClick={() => selectSong(candidate)}
                    >
                      <img src="/game-assets/neon-strings-cover.webp" alt="" />
                      <span><strong>{candidate.title}</strong><small>{candidate.artist}</small></span>
                      <i>{candidate.title === song.title ? '✓' : '›'}</i>
                    </button>
                  ))}
                  {filteredSongs.length === 0 && <p className="cloud-empty">No encontramos coincidencias.</p>}
                </div>
              </>
            )}

            {menu === 'profile' && (
              <>
                <header className="game-cloud__header">
                  <div>
                    <small>TU PROGRESO</small>
                    <strong>Sesión actual</strong>
                  </div>
                  <button type="button" onClick={() => setMenu(null)} aria-label="Cerrar">×</button>
                </header>
                <div className="profile-cloud-stats">
                  <article><strong>{score.points.toLocaleString('es-MX')}</strong><span>Puntos</span></article>
                  <article><strong>{score.accuracy}%</strong><span>Precisión</span></article>
                  <article><strong>{score.maxStreak}</strong><span>Mejor racha</span></article>
                  <article><strong>{attempts.length}</strong><span>Notas tocadas</span></article>
                </div>
                <p className="profile-cloud-message">Cada nota limpia fortalece tu memoria muscular. Sigue así.</p>
              </>
            )}
          </section>
        </>
      )}

      <input
        ref={fileRef}
        className="visually-hidden"
        type="file"
        accept=".gp,.gp3,.gp4,.gp5,.gpx,.gp7"
        onChange={onUpload}
      />
    </header>
  )
}

function CloudAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick}><span>{icon}</span><strong>{label}</strong></button>
}

function Icon({ children, fill = 'none' }: { children: React.ReactNode; fill?: string }) {
  return <svg viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}

function MenuIcon() { return <Icon><path d="M4 6h16M4 12h16M4 18h16" /></Icon> }
function SearchIcon() { return <Icon><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon> }
function ChevronIcon() { return <Icon><path d="m8 10 4 4 4-4" /></Icon> }
function ProfileIcon() { return <Icon><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></Icon> }
function FlameIcon() { return <Icon fill="currentColor"><path d="M13.4 2.5c.5 3.2-1.8 4.5-2.9 6.4-.8-1.1-1-2.3-.5-3.7-2.8 2.1-5.3 5-5.3 8.8A7.3 7.3 0 0 0 12 21.5a7.3 7.3 0 0 0 7.3-7.5c0-4.2-2.7-8-5.9-11.5ZM12 18.7a3.1 3.1 0 0 1-3.1-3.2c0-1.7 1-3.1 2.2-4.3.1 1.3.7 2.1 1.3 2.8.7-.9 1.2-1.9 1.2-3.3 1 1.2 1.6 2.8 1.6 4.8a3.1 3.1 0 0 1-3.2 3.2Z" stroke="none" /></Icon> }
function MusicIcon() { return <Icon><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></Icon> }
function TunerIcon() { return <Icon><path d="M12 3v5M5 6l3 3M19 6l-3 3" /><path d="M5 20a7 7 0 1 1 14 0" /><path d="m12 16 4-4" /></Icon> }
function PulseIcon() { return <Icon><path d="M3 12h4l2-6 4 12 2-6h6" /></Icon> }
function CameraIcon() { return <Icon><path d="M8 6 9.5 4h5L16 6h3a2 2 0 0 1 2 2v10H3V8a2 2 0 0 1 2-2z" /><circle cx="12" cy="12" r="3" /></Icon> }
function ChartIcon() { return <Icon><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></Icon> }
function BugIcon() { return <Icon><path d="M8 9h8v7a4 4 0 0 1-8 0zM9 5l3 3 3-3M4 13h4M16 13h4M5 7l3 3M19 7l-3 3" /></Icon> }
function UploadIcon() { return <Icon><path d="M12 16V4m0 0L7 9m5-5 5 5M4 20h16" /></Icon> }
