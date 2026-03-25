import { useEffect, useRef, useCallback } from 'react'
import * as alphaTab from '@coderline/alphatab'
import { useGameStore } from '../store/useGameStore'
import { midiToNoteName } from '../utils/noteUtils'
import type { ExpectedNote } from '../types'

const MASTER_VOLUME_MUTED = 0
const MASTER_VOLUME_NORMAL = 1

// Standard guitar range: E2 (MIDI 40) to E6 (MIDI 88)
const GUITAR_MIDI_MIN = 40
const GUITAR_MIDI_MAX = 88

function clampToGuitarMidi(midi: number): number {
  while (midi < GUITAR_MIDI_MIN) midi += 12
  while (midi > GUITAR_MIDI_MAX) midi -= 12
  return midi
}

const { PlayerState } = alphaTab.synth
type PositionChangedEventArgs = alphaTab.synth.PositionChangedEventArgs
type PlayerStateChangedEventArgs = alphaTab.synth.PlayerStateChangedEventArgs

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSettings(scrollElement: HTMLElement | null): any {
  return {
    core: {
      fontDirectory: '/font/',
    },
    display: {
      layoutMode: 'horizontal',
      staveProfile: 'scoreTab',
      resources: {
        staffLineColor: '#666666',
        barSeparatorColor: '#444444',
        barNumberColor: '#555555',
        mainGlyphColor: '#e5e5e5',
        secondaryGlyphColor: '#aaaaaa',
        scoreInfoColor: '#cccccc',
      },
    },
    player: {
      enablePlayer: true,
      soundFont: '/soundfont/sonivox.sf2',
      enableCursor: true,
      scrollElement: scrollElement ?? undefined,
      scrollMode: 2, // OffScreen: scrolls when cursor leaves view
      scrollOffsetX: -150,
      bufferTimeInMilliseconds: 400,
    },
  }
}

export function useAlphaTab(
  containerRef: React.RefObject<HTMLDivElement | null>,
  scrollRef: React.RefObject<HTMLDivElement | null>
) {
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null)
  const lastMasterBeatKey = useRef<string>('')
  const gameMode = useGameStore(s => s.gameMode)
  const {
    setExpectedNote, setGameState, updatePosition,
    setCurrentBeatBounds, setCurrentTabBounds, setResumePlayback,
  } = useGameStore()

  const getOrCreateApi = useCallback(() => {
    if (apiRef.current) return apiRef.current
    if (!containerRef.current) return null

    // Clear any leftover DOM from a previous instance (React StrictMode double-init)
    containerRef.current.innerHTML = ''

    const api = new alphaTab.AlphaTabApi(
      containerRef.current,
      buildSettings(scrollRef.current)
    )
    apiRef.current = api

    // Register the play callback so master mode can resume
    setResumePlayback(() => api.play())

    api.renderFinished.on(() => {
      setGameState('idle')
      lastMasterBeatKey.current = ''
    })

    api.playerPositionChanged.on((args: PositionChangedEventArgs) => {
      const trackIndices = new Set<number>([0])
      const lookupResult = api.tickCache?.findBeat(trackIndices, args.currentTick)

      if (lookupResult?.beat && lookupResult.beat.notes.length > 0) {
        const beat = lookupResult.beat

        const mainNote = beat.notes.reduce((prev, curr) =>
          prev.realValue < curr.realValue ? prev : curr
        )
        const midi = clampToGuitarMidi(mainNote.realValue)

        // Track visual bounds for note overlays
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const boundsLookup = (api as any).renderer?.boundsLookup
        const beatBounds = boundsLookup?.findBeat(beat)
        if (beatBounds?.realBounds) {
          const { x, y, w, h } = beatBounds.realBounds
          setCurrentBeatBounds({ x, y, w, h })

          // TAB note bounds: find all note heads on the TAB staff (bottom part of the screen)
          // and combine their bounds so the rectangle covers the entire chord accurately.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const allNoteBounds: any[] = beatBounds.notes ?? []
          const withHeads = allNoteBounds.filter((nb: any) => nb.noteHeadBounds)
          if (withHeads.length > 0) {
            const maxY = Math.max(...withHeads.map((nb: any) => nb.noteHeadBounds.y))
            // TAB notes are those near maxY (e.g., within 100px, covering the TAB staff height)
            const tabEntries = withHeads.filter((nb: any) => maxY - nb.noteHeadBounds.y < 100)
            
            let minX = Infinity, minY = Infinity
            let maxX = -Infinity, maxYTotal = -Infinity
            
            tabEntries.forEach((entry: any) => {
               const nb = entry.noteHeadBounds
               if (nb.x < minX) minX = nb.x
               if (nb.y < minY) minY = nb.y
               if (nb.x + nb.w > maxX) maxX = nb.x + nb.w
               if (nb.y + nb.h > maxYTotal) maxYTotal = nb.y + nb.h
            })
            
            const w = Math.max(maxX - minX + 4, 18)
            const h = Math.max(maxYTotal - minY + 4, 18)
            
            setCurrentTabBounds({ x: minX - 2, y: minY - 2, w, h })
          } else {
            setCurrentTabBounds(null)
          }
        }

        setExpectedNote({
          midi,
          name: midiToNoteName(midi),
          timestamp: performance.now(),   // wall-clock ms — same base as detectedNote
          beat: beat.index,
          bar: beat.voice.bar.index,
          duration: lookupResult.duration,
          stringNumber: mainNote.string,
          fretNumber: mainNote.fret,
        } as ExpectedNote)
        updatePosition(beat.voice.bar.index, beat.index)

        // Master mode: pause on each new beat so the user can play it
        const beatKey = `${beat.voice.bar.index}-${beat.index}`
        if (useGameStore.getState().gameMode === 'master' && beatKey !== lastMasterBeatKey.current) {
          lastMasterBeatKey.current = beatKey
          api.pause()
        }
      }
    })

    api.playerStateChanged.on((args: PlayerStateChangedEventArgs) => {
      if (args.state === PlayerState.Playing) {
        setGameState('playing')
      } else if (args.stopped) {
        setGameState('finished')
        lastMasterBeatKey.current = ''
      } else {
        setGameState('paused')
      }
    })

    return api
  }, [containerRef, scrollRef, setExpectedNote, setGameState, updatePosition, setCurrentBeatBounds, setCurrentTabBounds, setResumePlayback])

  const loadSong = useCallback(
    (file?: File | string) => {
      const api = getOrCreateApi()
      if (!api || !file) return

      try { api.stop() } catch { /* ignore if no score loaded yet */ }
      lastMasterBeatKey.current = ''

      if (file instanceof File) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const buffer = e.target?.result as ArrayBuffer
          api.load(new Uint8Array(buffer))
        }
        reader.readAsArrayBuffer(file)
      } else if (typeof file === 'string' && !file.startsWith('http') && !file.endsWith('.gp') && !file.endsWith('.gp5') && !file.endsWith('.gpx')) {
        api.tex(file)
      } else {
        api.load(file as string)
      }
    },
    [getOrCreateApi]
  )

  const initialize = useCallback((file?: File | string) => { loadSong(file) }, [loadSong])
  const play = useCallback(() => apiRef.current?.play(), [])
  const pause = useCallback(() => apiRef.current?.pause(), [])
  const stop = useCallback(() => {
    lastMasterBeatKey.current = ''
    apiRef.current?.stop()
  }, [])
  const setTempo = useCallback((ratio: number) => {
    if (apiRef.current) apiRef.current.playbackSpeed = ratio
  }, [])

  // Mute AlphaTab output in master mode — user should play the note, not hear it
  useEffect(() => {
    if (apiRef.current) {
      apiRef.current.masterVolume = gameMode === 'master' ? MASTER_VOLUME_MUTED : MASTER_VOLUME_NORMAL
    }
  }, [gameMode])

  useEffect(() => {
    getOrCreateApi()
    return () => {
      apiRef.current?.destroy()
      apiRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { initialize, play, pause, stop, setTempo, apiRef }
}
