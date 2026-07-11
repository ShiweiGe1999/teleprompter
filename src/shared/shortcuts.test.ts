import { describe, expect, it } from 'vitest'
import { SHORTCUTS } from './defaults'

describe('global shortcuts', () => {
  it('defines a unique accelerator for every action', () => {
    expect(new Set(SHORTCUTS.map((shortcut) => shortcut.accelerator)).size).toBe(SHORTCUTS.length)
    expect(new Set(SHORTCUTS.map((shortcut) => shortcut.action)).size).toBe(SHORTCUTS.length)
  })

  it('always includes a global lock recovery shortcut', () => {
    expect(SHORTCUTS).toContainEqual({ accelerator: 'CommandOrControl+Shift+L', action: 'toggle-lock' })
  })
})
