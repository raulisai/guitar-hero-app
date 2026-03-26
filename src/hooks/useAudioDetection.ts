// @refresh reset
import { useEffect, useRef, useState, useCallback } from 'react'
import { PitchDetector } from 'pitchy'
import { useGameStore } from '../store/useGameStore'
import { hzToMidi, midiToNoteName } from '../utils/noteUtils'

const BUFFER_SIZE = 8192
const CLARITY_THRESHOLD = 0.85
// Guitar range: E2 (82 Hz) to high E (1318 Hz) with a bit of margin
const MIN_FREQUENCY = 70
const MAX_FREQUENCY = 1400
// High-pass cutoff to remove power-line hum and low-frequency room rumble
const HIGHPASS_CUTOFF_HZ = 70
// Guitar lowest standard note = E2 = MIDI 40
const MIN_GUITAR_MIDI = 40
// If the same MIDI re-appears within this window after a signal dropout,
// it's the same string still ringing — keep original onset
const GAP_TOLERANCE_MS = 300

export function useAudioDetection() {
  const [isListening, setIsListening] = useState(false)
  const [isRequesting, setIsRequesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const detectorRef = useRef<PitchDetector<Float32Array> | null>(null)
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)

  const { setDetectedNote, noiseFloor } = useGameStore()
  const noiseFloorRef = useRef(noiseFloor)
  noiseFloorRef.current = noiseFloor

  // Track note onset: when the MIDI value changes (or comes from silence), record a new onset
  const prevMidiRef       = useRef<number | null>(null)
  const onsetTimeRef      = useRef<number>(0)
  // Gap-tolerant onset: track what MIDI was playing before a dropout and when
  const lastKnownMidiRef  = useRef<number | null>(null)
  const gapStartRef       = useRef<number>(0)

  // sampleRate passed as arg to avoid an extra useRef that changes hook count
  const startDetectionLoop = useCallback(
    (analyser: AnalyserNode, detector: PitchDetector<Float32Array>, sampleRate: number) => {
      const buffer = bufferRef.current!

      const detect = () => {
        analyser.getFloatTimeDomainData(buffer)

        // RMS energy gate — ignore signal below noise floor
        let sum = 0
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
        const rms = Math.sqrt(sum / buffer.length)

        if (rms < noiseFloorRef.current) {
          if (prevMidiRef.current !== null) {
            lastKnownMidiRef.current = prevMidiRef.current
            gapStartRef.current = performance.now()
          }
          prevMidiRef.current = null
          setDetectedNote(null)
          animFrameRef.current = requestAnimationFrame(detect)
          return
        }

        const [frequency, clarity] = detector.findPitch(buffer, sampleRate)

        if (
          clarity >= CLARITY_THRESHOLD &&
          frequency >= MIN_FREQUENCY &&
          frequency <= MAX_FREQUENCY
        ) {
          let midi = hzToMidi(frequency)
          const now = performance.now()

          // Octave correction: autocorrelation sometimes locks onto a subharmonic
          // when a string is plucked softly. MIDI < 40 (below E2) is outside
          // standard guitar range — bump up one octave.
          while (midi < MIN_GUITAR_MIDI) midi += 12

          // New onset: coming from silence or a different note
          if (prevMidiRef.current === null || prevMidiRef.current !== midi) {
            // Gap-tolerant: if the same MIDI re-appears after a brief signal
            // dropout, it's the same string still ringing — keep the original
            // onset to prevent stale notes from getting a fresh onset.
            const isSameNoteAfterGap =
              prevMidiRef.current === null &&
              midi === lastKnownMidiRef.current &&
              now - gapStartRef.current < GAP_TOLERANCE_MS

            if (!isSameNoteAfterGap) {
              onsetTimeRef.current = now
            }
            prevMidiRef.current = midi
          }

          setDetectedNote({
            midi,
            name: midiToNoteName(midi),
            frequency,
            clarity,
            timestamp: now,
            onset: onsetTimeRef.current,
          })
        } else {
          if (prevMidiRef.current !== null) {
            lastKnownMidiRef.current = prevMidiRef.current
            gapStartRef.current = performance.now()
          }
          prevMidiRef.current = null
          setDetectedNote(null)
        }

        animFrameRef.current = requestAnimationFrame(detect)
      }

      animFrameRef.current = requestAnimationFrame(detect)
    },
    [setDetectedNote]
  )

  const startListening = useCallback(async () => {
    setIsRequesting(true)
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      streamRef.current = stream

      // Use native device sample rate — avoids resampling artifacts
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext

      // AudioContext might start suspended — resume it (requires user gesture, which we have)
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      const sampleRate = audioContext.sampleRate

      const source = audioContext.createMediaStreamSource(stream)

      // High-pass filter: cuts power-line hum and low-frequency room rumble
      const highpass = audioContext.createBiquadFilter()
      highpass.type = 'highpass'
      highpass.frequency.value = HIGHPASS_CUTOFF_HZ
      highpass.Q.value = 0.7

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = BUFFER_SIZE * 2
      analyser.smoothingTimeConstant = 0

      source.connect(highpass)
      highpass.connect(analyser)
      analyserRef.current = analyser

      const detector = PitchDetector.forFloat32Array(BUFFER_SIZE)
      detectorRef.current = detector
      bufferRef.current = new Float32Array(BUFFER_SIZE) as Float32Array<ArrayBuffer>

      setIsListening(true)
      setIsRequesting(false)

      startDetectionLoop(analyser, detector, sampleRate)
    } catch (err) {
      const msg = (err as Error).name === 'NotAllowedError'
        ? 'Permiso denegado. Habilita el micrófono en la configuración del navegador.'
        : 'No se pudo acceder al micrófono.'
      setError(msg)
      setIsRequesting(false)
      console.error('Audio error:', err)
    }
  }, [startDetectionLoop])

  const stopListening = useCallback(() => {
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioContextRef.current?.close()
    analyserRef.current = null
    setIsListening(false)
    setDetectedNote(null)
  }, [setDetectedNote])

  useEffect(() => {
    return () => { stopListening() }
  }, [stopListening])

  // Measure average RMS over `durationMs` — for ambient noise calibration
  const measureAmbientRms = useCallback(async (durationMs = 3000): Promise<number> => {
    if (!analyserRef.current || !bufferRef.current) return 0
    const analyser = analyserRef.current
    const buffer = bufferRef.current
    const samples: number[] = []
    const end = performance.now() + durationMs

    await new Promise<void>((resolve) => {
      const tick = () => {
        analyser.getFloatTimeDomainData(buffer)
        let sum = 0
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i]
        samples.push(Math.sqrt(sum / buffer.length))
        if (performance.now() < end) requestAnimationFrame(tick)
        else resolve()
      }
      requestAnimationFrame(tick)
    })

    return samples.reduce((a, b) => a + b, 0) / samples.length
  }, [])

  return { isListening, isRequesting, error, startListening, stopListening, analyserRef, measureAmbientRms }
}
