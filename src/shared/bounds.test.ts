import { describe, expect, it } from 'vitest'
import { recoverBounds } from './bounds'

const displays = [
  { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
  { id: 2, workArea: { x: 1920, y: 0, width: 1280, height: 1024 } }
]
const fallback = { x: 600, y: 280, width: 720, height: 520 }

describe('recoverBounds', () => {
  it('keeps visible saved bounds', () => {
    expect(recoverBounds({ x: 2100, y: 100, width: 800, height: 500, displayId: '2' }, displays, fallback)).toEqual({ x: 2100, y: 100, width: 800, height: 500 })
  })

  it('falls back when the saved monitor was disconnected', () => {
    expect(recoverBounds({ x: 4000, y: 0, width: 700, height: 500, displayId: '3' }, displays, fallback)).toEqual(fallback)
  })

  it('clamps an oversized window to its display', () => {
    expect(recoverBounds({ x: 1900, y: -50, width: 1800, height: 1400, displayId: '2' }, displays, fallback)).toEqual({ x: 1920, y: 0, width: 1280, height: 1024 })
  })
})
