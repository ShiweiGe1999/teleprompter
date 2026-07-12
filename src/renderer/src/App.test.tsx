import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_OVERLAY_STATE, DEFAULT_SETTINGS } from '@shared/defaults'
import type { Script, ScriptOverlayApi } from '@shared/types'
import { App } from './App'

const firstScript: Script = {
  id: 'script-1',
  title: 'First script',
  body: 'The first script body.',
  createdAt: '2026-07-11T12:00:00.000Z',
  updatedAt: '2026-07-11T12:00:00.000Z',
  position: 0
}

const secondScript: Script = {
  ...firstScript,
  id: 'script-2',
  title: 'Second script',
  body: 'The second script body.'
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('App script deletion', () => {
  it('confirms deletion, removes the selected script, and selects the next script', async () => {
    let scripts = [firstScript, secondScript]
    const remove = vi.fn(async (id: string) => { scripts = scripts.filter((script) => script.id !== id) })
    const api: ScriptOverlayApi = {
      scripts: {
        list: vi.fn(async () => scripts),
        save: vi.fn(async (input) => ({ ...firstScript, ...input })),
        remove,
        duplicate: vi.fn(async () => secondScript),
        updatePosition: vi.fn(async () => undefined)
      },
      settings: {
        get: vi.fn(async () => DEFAULT_SETTINGS),
        update: vi.fn(async () => DEFAULT_SETTINGS)
      },
      overlay: {
        show: vi.fn(async () => undefined),
        close: vi.fn(async () => undefined),
        command: vi.fn(async () => undefined),
        getState: vi.fn(async () => DEFAULT_OVERLAY_STATE),
        updateState: vi.fn(async () => undefined),
        confirmLock: vi.fn(async () => undefined)
      },
      shortcuts: { status: vi.fn(async () => []) },
      events: {
        onOverlayCommand: vi.fn(() => () => undefined),
        onSettingsChanged: vi.fn(() => () => undefined),
        onOverlayStateChanged: vi.fn(() => () => undefined),
        onScriptsChanged: vi.fn(() => () => undefined),
        onUiCommand: vi.fn(() => () => undefined),
        onLockHintRequested: vi.fn(() => () => undefined)
      }
    }
    Object.defineProperty(window, 'scriptOverlay', { configurable: true, value: api })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()

    render(<App />)
    await screen.findByDisplayValue('First script')
    await user.click(screen.getByRole('button', { name: 'More script actions' }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete script' }))

    await waitFor(() => expect(remove).toHaveBeenCalledWith('script-1'))
    expect(confirm).toHaveBeenCalledWith('Delete “First script”? This cannot be undone.')
    await screen.findByDisplayValue('Second script')
  })
})
