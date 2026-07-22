import type { BeatBounds } from '../types'

export interface ScoreViewport {
  scrollTop: number
  scrollLeft: number
  clientWidth: number
  clientHeight: number
  scrollWidth: number
  scrollHeight: number
}

export interface ScoreContentOffset {
  top: number
  left: number
}

export interface ScoreScrollTarget {
  top: number
  left: number
  shouldScroll: boolean
}

const TOP_SAFE_AREA = 52
const BOTTOM_SAFE_AREA = 24
const SIDE_SAFE_AREA = 28

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), Math.max(minimum, maximum))
}

/**
 * Keeps the complete active beat inside a comfortable viewport safe area.
 * It does not move the score while the beat is already visible.
 */
export function calculateScoreScrollTarget(
  viewport: ScoreViewport,
  contentOffset: ScoreContentOffset,
  bounds: BeatBounds,
): ScoreScrollTarget {
  const noteTop = contentOffset.top + bounds.y
  const noteBottom = noteTop + bounds.h
  const noteLeft = contentOffset.left + bounds.x
  const noteRight = noteLeft + bounds.w

  const visibleTop = viewport.scrollTop + TOP_SAFE_AREA
  const visibleBottom = viewport.scrollTop + viewport.clientHeight - BOTTOM_SAFE_AREA
  const visibleLeft = viewport.scrollLeft + SIDE_SAFE_AREA
  const visibleRight = viewport.scrollLeft + viewport.clientWidth - SIDE_SAFE_AREA

  const needsVerticalScroll = noteTop < visibleTop || noteBottom > visibleBottom
  const needsHorizontalScroll = noteLeft < visibleLeft || noteRight > visibleRight
  const usableHeight = Math.max(1, viewport.clientHeight - TOP_SAFE_AREA - BOTTOM_SAFE_AREA)
  const usableWidth = Math.max(1, viewport.clientWidth - SIDE_SAFE_AREA * 2)

  const top = needsVerticalScroll
    ? clamp(
        noteTop - TOP_SAFE_AREA - Math.max(0, usableHeight - bounds.h) * 0.38,
        0,
        viewport.scrollHeight - viewport.clientHeight,
      )
    : viewport.scrollTop
  const left = needsHorizontalScroll
    ? clamp(
        noteLeft - SIDE_SAFE_AREA - Math.max(0, usableWidth - bounds.w) / 2,
        0,
        viewport.scrollWidth - viewport.clientWidth,
      )
    : viewport.scrollLeft

  return { top, left, shouldScroll: needsVerticalScroll || needsHorizontalScroll }
}

export function scrollScoreBeatIntoView(
  scrollElement: HTMLElement,
  scoreCanvas: HTMLElement,
  bounds: BeatBounds,
): void {
  const target = calculateScoreScrollTarget(
    {
      scrollTop: scrollElement.scrollTop,
      scrollLeft: scrollElement.scrollLeft,
      clientWidth: scrollElement.clientWidth,
      clientHeight: scrollElement.clientHeight,
      scrollWidth: scrollElement.scrollWidth,
      scrollHeight: scrollElement.scrollHeight,
    },
    { top: scoreCanvas.offsetTop, left: scoreCanvas.offsetLeft },
    bounds,
  )

  if (!target.shouldScroll) return
  scrollElement.scrollTo({
    top: target.top,
    left: target.left,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
}
