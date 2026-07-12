import { describe, expect, it } from 'vitest'
import { nextScrollPosition, seekBySeconds, seekOverlayState } from './scrolling'

describe('scrolling', () => {
  it('uses elapsed time so speed is frame-rate independent', () => {
    expect(nextScrollPosition(100, 50, 500)).toBe(125)
    expect(nextScrollPosition(100, 50, 1000)).toBe(150)
  })

  it('never seeks above the beginning', () => {
    expect(seekBySeconds(100, 50, -5)).toBe(0)
    expect(seekBySeconds(100, 50, 5)).toBe(350)
  })

  it('handles invalid animation inputs safely', () => {
    expect(nextScrollPosition(Number.NaN, 50, 16)).toBe(0)
  })

  it('rewinds a stopped overlay without changing its playback state', () => {
    const state = { scriptId: 'script-1', playing: false, locked: false, position: 600, scrollSpeed: 50 }
    expect(seekOverlayState(state, -5)).toEqual({ ...state, position: 350 })
  })
})
