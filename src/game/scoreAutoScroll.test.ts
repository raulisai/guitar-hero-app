import { describe, expect, it } from 'vitest'
import { calculateScoreScrollTarget, type ScoreViewport } from './scoreAutoScroll'

const viewport: ScoreViewport = {
  scrollTop: 0,
  scrollLeft: 0,
  clientWidth: 390,
  clientHeight: 500,
  scrollWidth: 760,
  scrollHeight: 1800,
}

describe('score auto scroll', () => {
  it('does not move a note that is already fully visible', () => {
    const target = calculateScoreScrollTarget(viewport, { top: 42, left: 0 }, {
      x: 120, y: 100, w: 30, h: 90,
    })

    expect(target).toEqual({ top: 0, left: 0, shouldScroll: false })
  })

  it('brings a note from the next score system into the safe area', () => {
    const target = calculateScoreScrollTarget(viewport, { top: 42, left: 0 }, {
      x: 510, y: 720, w: 34, h: 110,
    })

    expect(target.shouldScroll).toBe(true)
    expect(target.top).toBeGreaterThan(500)
    expect(target.left).toBeGreaterThan(250)
  })

  it('keeps the current position when only the horizontal axis needs movement', () => {
    const target = calculateScoreScrollTarget(
      { ...viewport, scrollTop: 300 },
      { top: 42, left: 0 },
      { x: 600, y: 400, w: 30, h: 70 },
    )

    expect(target.top).toBe(300)
    expect(target.left).toBeGreaterThan(300)
  })
})
