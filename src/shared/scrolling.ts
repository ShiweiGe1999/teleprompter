import type { OverlayState } from './types'

export function nextScrollPosition(position: number, speed: number, elapsedMs: number): number {
  if (!Number.isFinite(position) || !Number.isFinite(speed) || !Number.isFinite(elapsedMs)) return 0
  return Math.max(0, position + Math.max(0, speed) * Math.max(0, elapsedMs) / 1000)
}

export function seekBySeconds(position: number, speed: number, seconds: number): number {
  return Math.max(0, position + speed * seconds)
}

export function seekOverlayState(state: OverlayState, seconds: number): OverlayState {
  return { ...state, position: seekBySeconds(state.position, state.scrollSpeed, seconds) }
}
