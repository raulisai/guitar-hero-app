import { useEffect, useRef } from 'react'

export function useMetronome(isActive: boolean, bpm: number, playbackSpeed: number) {
  const ctxRef = useRef<AudioContext | null>(null)
  const nextClickRef = useRef<number>(0)
  const timerRef = useRef<number>(0)

  useEffect(() => {
    if (!isActive || bpm <= 0) return

    const ctx = new AudioContext()
    ctxRef.current = ctx
    const intervalSec = 60 / (bpm * (playbackSpeed / 100))
    const LOOKAHEAD = 0.1  // schedule 100ms ahead

    const playClick = (when: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 1200
      gain.gain.setValueAtTime(0.35, when)
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.04)
      osc.start(when)
      osc.stop(when + 0.04)
    }

    nextClickRef.current = ctx.currentTime
    const schedule = () => {
      while (nextClickRef.current < ctx.currentTime + LOOKAHEAD) {
        playClick(nextClickRef.current)
        nextClickRef.current += intervalSec
      }
      timerRef.current = window.setTimeout(schedule, 25)
    }
    schedule()

    return () => {
      window.clearTimeout(timerRef.current)
      ctx.close()
    }
  }, [isActive, bpm, playbackSpeed])
}
