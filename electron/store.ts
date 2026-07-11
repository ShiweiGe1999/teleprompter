import Store from 'electron-store'
import { randomUUID } from 'node:crypto'
import { DEFAULT_SETTINGS } from '@shared/defaults'
import { normalizeSettings, parseScriptInput } from '@shared/validation'
import type { AppSettings, Script, ScriptInput } from '@shared/types'

interface StoreShape {
  dataVersion: 1
  scripts: Script[]
  settings: AppSettings
}

export class AppStore {
  private readonly store = new Store<StoreShape>({
    name: 'script-overlay-data',
    defaults: { dataVersion: 1, scripts: [], settings: DEFAULT_SETTINGS }
  })

  constructor() {
    this.store.set('settings', normalizeSettings(this.store.get('settings')))
    const scripts = this.store.get('scripts', []).filter(isStoredScript)
    this.store.set('scripts', scripts)
  }

  listScripts(): Script[] {
    return [...this.store.get('scripts', [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }

  getScript(id: string): Script | undefined {
    return this.store.get('scripts', []).find((script) => script.id === id)
  }

  saveScript(rawInput: ScriptInput): Script {
    const input = parseScriptInput(rawInput)
    const scripts = this.store.get('scripts', [])
    const existing = input.id ? scripts.find((script) => script.id === input.id) : undefined
    const now = new Date().toISOString()
    const script: Script = {
      id: existing?.id ?? randomUUID(),
      title: input.title,
      body: input.body,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      position: input.position ?? existing?.position ?? 0
    }
    this.store.set('scripts', existing ? scripts.map((item) => item.id === script.id ? script : item) : [script, ...scripts])
    return script
  }

  removeScript(id: string): void {
    this.store.set('scripts', this.store.get('scripts', []).filter((script) => script.id !== id))
  }

  duplicateScript(id: string): Script {
    const source = this.getScript(id)
    if (!source) throw new Error('Script not found')
    return this.saveScript({ title: `${source.title} copy`, body: source.body, position: 0 })
  }

  updatePosition(id: string, position: number): void {
    const scripts = this.store.get('scripts', [])
    this.store.set('scripts', scripts.map((script) => script.id === id ? { ...script, position } : script))
  }

  getSettings(): AppSettings {
    return normalizeSettings(this.store.get('settings'))
  }

  updateSettings(patch: Partial<AppSettings>): AppSettings {
    const settings = normalizeSettings({ ...this.getSettings(), ...patch })
    this.store.set('settings', settings)
    return settings
  }
}

function isStoredScript(input: unknown): input is Script {
  if (!input || typeof input !== 'object') return false
  const value = input as Partial<Script>
  return typeof value.id === 'string' && typeof value.title === 'string' && typeof value.body === 'string'
    && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string' && typeof value.position === 'number'
}
