import { useEffect, useRef, useCallback } from 'react'
import * as alphaTab from '@coderline/alphatab'
import { useGameStore } from '../store/useGameStore'
import { midiToNoteName } from '../utils/noteUtils'
import type { ExpectedNote } from '../types'

const MASTER_VOLUME_MUTED = 0
const MASTER_VOLUME_NORMAL = 1

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
    setCurrentBeatBounds, setResumePlayback,
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
        const beatKey = `${beat.voice.bar.index}-${beat.index}`

        // Track visual bounds for note overlays
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const boundsLookup = (api as any).renderer?.boundsLookup
        const beatBounds = boundsLookup?.findBeat(beat)
        if (beatBounds?.realBounds) {
          const { x, y, w, h } = beatBounds.realBounds
          setCurrentBeatBounds({ x, y, w, h })
        }

        const mainNote = beat.notes.reduce((prev, curr) =>
          prev.realValue < curr.realValue ? prev : curr
        )
        const midi = mainNote.realValue

        setExpectedNote({
          midi,
          name: midiToNoteName(midi),
          timestamp: args.currentTime,
          beat: beat.index,
          bar: beat.voice.bar.index,
          duration: lookupResult.duration,
          stringNumber: mainNote.string,
          fretNumber: mainNote.fret,
        } as ExpectedNote)
        updatePosition(beat.voice.bar.index, beat.index)

        // Master mode: pause on each new note (deduplicated by beatKey)
        const { gameMode } = useGameStore.getState()
        if (gameMode === 'master' && beatKey !== lastMasterBeatKey.current) {
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
  }, [containerRef, scrollRef, setExpectedNote, setGameState, updatePosition, setCurrentBeatBounds, setResumePlayback])

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
