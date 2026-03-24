import { useEffect, useRef, useState, useCallback } from 'react'
import { PitchDetector } from 'pitchy'
import { useGameStore } from '../store/useGameStore'
import { hzToMidi, midiToNoteName } from '../utils/noteUtils'

const BUFFER_SIZE = 8192
const CLARITY_THRESHOLD = 0.85
// Guitar range: E2 (82 Hz) to high E (1318 Hz) with a bit of margin
const MIN_FREQUENCY = 70
const MAX_FREQUENCY = 1400
// RMS energy gate: guitar pluck is typically 0.02–0.3; ambient noise <0.01
const MIN_RMS = 0.01
// High-pass cutoff to remove power-line hum and low-frequency room rumble
const HIGHPASS_CUTOFF_HZ = 70

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

  const { setDetectedNote } = useGameStore()

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

        if (rms < MIN_RMS) {
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
          const midi = hzToMidi(frequency)
          setDetectedNote({
            midi,
            name: midiToNoteName(midi),
            frequency,
            clarity,
            timestamp: performance.now(),
          })
        } else {
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

  return { isListening, isRequesting, error, startListening, stopListening, analyserRef }
}
