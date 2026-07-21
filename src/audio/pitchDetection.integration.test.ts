import { PitchDetector } from 'pitchy'
import { describe, expect, it } from 'vitest'
import { hzToMidi, midiToHz } from '../utils/noteUtils'
import { MIN_DETECTION_CLARITY } from '../game/noteEvaluation'

const SAMPLE_RATE = 48_000
const BUFFER_SIZE = 4096

function guitarSignal(midi: number): Float32Array {
  const fundamental = midiToHz(midi)
  const buffer = new Float32Array(BUFFER_SIZE)
  for (let index = 0; index < buffer.length; index += 1) {
    const phase = 2 * Math.PI * fundamental * index / SAMPLE_RATE
    // Fundamental plus guitar-like harmonics and deterministic low-level hum.
    buffer[index] =
      0.62 * Math.sin(phase) +
      0.22 * Math.sin(phase * 2) +
      0.09 * Math.sin(phase * 3) +
      0.015 * Math.sin(2 * Math.PI * 60 * index / SAMPLE_RATE)
  }
  return buffer
}

describe('guitar pitch detection', () => {
  it.each([
    [40, 'E2'],
    [45, 'A2'],
    [48, 'C3'],
    [50, 'D3'],
    [52, 'E3'],
    [64, 'E4'],
  ])('detects MIDI %i (%s) from a guitar-like signal', (midi) => {
    const detector = PitchDetector.forFloat32Array(BUFFER_SIZE)
    const [frequency, clarity] = detector.findPitch(guitarSignal(midi), SAMPLE_RATE)

    expect(hzToMidi(frequency)).toBe(midi)
    expect(clarity).toBeGreaterThanOrEqual(MIN_DETECTION_CLARITY)
  })
})
