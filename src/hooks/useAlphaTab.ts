import { useEffect, useRef, useCallback } from 'react'
import * as alphaTab from '@coderline/alphatab'
import { useShallow } from 'zustand/react/shallow'
import { useGameStore } from '../store/useGameStore'
import { midiToNoteName } from '../utils/noteUtils'
import { getFingeringSuggestion } from '../utils/fingeringUtils'
import type { ExpectedNote } from '../types'
import { findNextPlayableLessonBeat, findPlayableLessonBeat } from '../game/lessonNavigator'
import { scrollScoreBeatIntoView } from '../game/scoreAutoScroll'

// Standard guitar range: E2 (MIDI 40) to E6 (MIDI 88)
const GUITAR_MIDI_MIN = 40
const GUITAR_MIDI_MAX = 88

function clampToGuitarMidi(midi: number): number {
  while (midi < GUITAR_MIDI_MIN) midi += 12
  while (midi > GUITAR_MIDI_MAX) midi -= 12
  return midi
}

// AlphaTab's model numbers strings from the lowest-pitched string upward,
// while guitar tablature labels string 1 as high E and string 6 as low E.
function toTabStringNumber(alphaTabString: number): number {
  return alphaTabString >= 1 && alphaTabString <= 6 ? 7 - alphaTabString : alphaTabString
}

const { PlayerState } = alphaTab.synth
type PositionChangedEventArgs = alphaTab.synth.PositionChangedEventArgs
type PlayerStateChangedEventArgs = alphaTab.synth.PlayerStateChangedEventArgs
type LessonBeatLookup = alphaTab.midi.MidiTickLookupFindBeatResult

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildSettings(scrollElement: HTMLElement | null): any {
  return {
    core: {
      fontDirectory: '/font/',
      includeNoteBounds: true,
    },
    display: {
      layoutMode: 'page',
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
      scrollOffsetY: -120,
      bufferTimeInMilliseconds: 400,
    },
  }
}

export function useAlphaTab(
  containerRef: React.RefObject<HTMLDivElement | null>,
  scrollRef: React.RefObject<HTMLDivElement | null>
) {
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null)
  const lastFreeBeatKey   = useRef<string>('')   // debounce free-mode state updates
  const currentLessonBeatRef = useRef<LessonBeatLookup | null>(null)
  const startLessonRef = useRef<(() => void) | null>(null)
  const scrollFrameRef = useRef<number | null>(null)
  const gameMode = useGameStore(s => s.gameMode)
  const isMuted = useGameStore(s => s.isMuted)
  const {
    setExpectedNote, setGameState, updatePosition,
    setCurrentBeatBounds, setCurrentTabBounds, setAdvanceLesson,
  } = useGameStore(useShallow((state) => ({
    setExpectedNote: state.setExpectedNote,
    setGameState: state.setGameState,
    updatePosition: state.updatePosition,
    setCurrentBeatBounds: state.setCurrentBeatBounds,
    setCurrentTabBounds: state.setCurrentTabBounds,
    setAdvanceLesson: state.setAdvanceLesson,
  })))

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

    const activateLessonBeat = (lookup: LessonBeatLookup) => {
      const beat = lookup.beat
      if (beat.notes.length === 0) return

      currentLessonBeatRef.current = lookup
      const mainNote = beat.notes.reduce((prev, curr) =>
        prev.realValue < curr.realValue ? prev : curr
      )
      const midi = clampToGuitarMidi(mainNote.realValue)
      const chordMidis = [...new Set(beat.notes.map((note) => clampToGuitarMidi(note.realValue)))]
      const fingering = getFingeringSuggestion(mainNote.fret, mainNote.leftHandFinger)

      // Moving the cursor directly is reliable on mobile and avoids repeatedly
      // pausing/resuming AlphaSynth between notes and rests.
      api.tickPosition = lookup.start

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const boundsLookup = (api as any).renderer?.boundsLookup
      const beatBounds = boundsLookup?.findBeat(beat)
      if (beatBounds?.realBounds) {
        const { x, y, w, h } = beatBounds.realBounds
        const activeBounds = { x, y, w, h }
        setCurrentBeatBounds(activeBounds)

        if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current)
        scrollFrameRef.current = requestAnimationFrame(() => {
          scrollFrameRef.current = requestAnimationFrame(() => {
            const scrollElement = scrollRef.current
            const scoreCanvas = containerRef.current?.parentElement
            if (scrollElement && scoreCanvas) {
              scrollScoreBeatIntoView(scrollElement, scoreCanvas, activeBounds)
            }
            scrollFrameRef.current = null
          })
        })

        type NoteBoundsEntry = { noteHeadBounds?: { x: number; y: number; w: number; h: number } }
        const withHeads = ((beatBounds.notes ?? []) as NoteBoundsEntry[])
          .filter((entry) => entry.noteHeadBounds)
        if (withHeads.length > 0) {
          const lowestStaffY = Math.max(...withHeads.map((entry) => entry.noteHeadBounds!.y))
          const tabEntries = withHeads.filter((entry) => lowestStaffY - entry.noteHeadBounds!.y < 100)
          const minX = Math.min(...tabEntries.map((entry) => entry.noteHeadBounds!.x))
          const minY = Math.min(...tabEntries.map((entry) => entry.noteHeadBounds!.y))
          const maxX = Math.max(...tabEntries.map((entry) => entry.noteHeadBounds!.x + entry.noteHeadBounds!.w))
          const maxY = Math.max(...tabEntries.map((entry) => entry.noteHeadBounds!.y + entry.noteHeadBounds!.h))
          setCurrentTabBounds({
            x: minX - 2,
            y: minY - 2,
            w: Math.max(maxX - minX + 4, 18),
            h: Math.max(maxY - minY + 4, 18),
          })
        } else {
          setCurrentTabBounds(null)
        }
      } else {
        setCurrentBeatBounds(null)
        setCurrentTabBounds(null)
      }

      setExpectedNote({
        midi,
        name: midiToNoteName(midi),
        timestamp: performance.now(),
        beat: beat.index,
        bar: beat.voice.bar.index,
        duration: lookup.duration,
        stringNumber: toTabStringNumber(mainNote.string),
        fretNumber: mainNote.fret,
        fingerNumber: fingering.finger,
        handPosition: fingering.position,
        chordMidis,
      } as ExpectedNote)
      updatePosition(beat.voice.bar.index, beat.index)
      setGameState('paused')
    }

    startLessonRef.current = () => {
      if (!api.tickCache) return
      const first = findPlayableLessonBeat(api.tickCache, 0)
      if (first) activateLessonBeat(first)
    }

    setAdvanceLesson(() => {
      if (!api.tickCache || !currentLessonBeatRef.current) return
      const next = findNextPlayableLessonBeat(api.tickCache, currentLessonBeatRef.current)
      if (!next) {
        currentLessonBeatRef.current = null
        setExpectedNote(null)
        setCurrentBeatBounds(null)
        setCurrentTabBounds(null)
        setGameState('finished')
        return
      }
      activateLessonBeat(next)
    })

    api.renderFinished.on(() => {
      setGameState('idle')
      lastFreeBeatKey.current = ''
      currentLessonBeatRef.current = null
      const bpm = api.score?.tempo ?? 0
      if (bpm > 0) useGameStore.getState().setSongBpm(bpm)
    })

    api.playerPositionChanged.on((args: PositionChangedEventArgs) => {
      const trackIndices = new Set<number>([0])
      const lookupResult = api.tickCache?.findBeat(trackIndices, args.currentTick)
      if (!lookupResult?.beat || lookupResult.beat.notes.length === 0) return

      const beat     = lookupResult.beat
      const mainNote = beat.notes.reduce((prev, curr) =>
        prev.realValue < curr.realValue ? prev : curr
      )
      const midi    = clampToGuitarMidi(mainNote.realValue)
      const chordMidis = [...new Set(beat.notes.map((note) => clampToGuitarMidi(note.realValue)))]
      const fingering = getFingeringSuggestion(mainNote.fret, mainNote.leftHandFinger)
      const beatKey = `${beat.voice.bar.index}-${beat.index}`

      // ── FREE MODE (reproduction) ────────────────────────────────────────────
      // Skip bounds lookup and evaluation entirely.
      // Only update fretboard indicator once per new beat to avoid 60fps re-renders.
      if (useGameStore.getState().gameMode === 'reproduction') {
        if (beatKey === lastFreeBeatKey.current) return
        lastFreeBeatKey.current = beatKey
        setExpectedNote({
          midi,
          name: midiToNoteName(midi),
          timestamp: performance.now(),
          beat: beat.index,
          bar: beat.voice.bar.index,
          duration: lookupResult.duration,
          stringNumber: toTabStringNumber(mainNote.string),
          fretNumber: mainNote.fret,
          fingerNumber: fingering.finger,
          handPosition: fingering.position,
          chordMidis,
        } as ExpectedNote)
        updatePosition(beat.voice.bar.index, beat.index)
        return
      }

      // Teaching mode is advanced directly by the lesson sequencer. Ignore
      // AlphaSynth position events so they cannot pause the session mid-song.
      return
    })

    api.playerStateChanged.on((args: PlayerStateChangedEventArgs) => {
      if (useGameStore.getState().gameMode === 'master') return
      if (args.state === PlayerState.Playing) {
        setGameState('playing')
      } else if (args.stopped) {
        setGameState('finished')
      } else {
        setGameState('paused')
      }
    })

    return api
  }, [containerRef, scrollRef, setExpectedNote, setGameState, updatePosition, setCurrentBeatBounds, setCurrentTabBounds, setAdvanceLesson])

  const loadSong = useCallback(
    (file?: File | string) => {
      const api = getOrCreateApi()
      if (!api || !file) return

      try { api.stop() } catch { /* ignore if no score loaded yet */ }
      lastFreeBeatKey.current = ''
      currentLessonBeatRef.current = null

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
  const play = useCallback(() => {
    if (useGameStore.getState().gameMode === 'master') {
      startLessonRef.current?.()
      return
    }
    apiRef.current?.play()
  }, [])
  const pause = useCallback(() => apiRef.current?.pause(), [])
  const stop = useCallback(() => {
    lastFreeBeatKey.current = ''
    currentLessonBeatRef.current = null
    apiRef.current?.stop()
  }, [])
  const setTempo = useCallback((ratio: number) => {
    if (apiRef.current) apiRef.current.playbackSpeed = ratio
  }, [])

  // Mute AlphaTab output in master mode — user should play the note, not hear it
  useEffect(() => {
    if (!apiRef.current) return
    if (gameMode === 'master') {
      apiRef.current.masterVolume = 0
    } else {
      apiRef.current.masterVolume = isMuted ? 0 : 1
    }
  }, [gameMode, isMuted])

  useEffect(() => {
    getOrCreateApi()
    return () => {
      apiRef.current?.destroy()
      apiRef.current = null
      startLessonRef.current = null
      if (scrollFrameRef.current !== null) cancelAnimationFrame(scrollFrameRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { initialize, play, pause, stop, setTempo, apiRef }
}
