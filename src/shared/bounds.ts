import type { Rectangle } from 'electron'
import type { WindowBounds } from './types'

export interface DisplayLike {
  id: number | string
  workArea: Rectangle
}

function overlaps(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}

export function recoverBounds(saved: WindowBounds | undefined, displays: DisplayLike[], fallback: Rectangle): Rectangle {
  if (!saved || displays.length === 0) return fallback
  const candidate = { x: saved.x, y: saved.y, width: saved.width, height: saved.height }
  const target = displays.find((display) => String(display.id) === saved.displayId) ?? displays.find((display) => overlaps(candidate, display.workArea))
  if (!target) return fallback

  const area = target.workArea
  const width = Math.min(Math.max(candidate.width, 320), area.width)
  const height = Math.min(Math.max(candidate.height, 180), area.height)
  return {
    x: Math.min(Math.max(candidate.x, area.x), area.x + area.width - width),
    y: Math.min(Math.max(candidate.y, area.y), area.y + area.height - height),
    width,
    height
  }
}
