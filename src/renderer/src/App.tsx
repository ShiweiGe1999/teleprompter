import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings, OverlayState, Script, ShortcutRegistrationResult } from '@shared/types'
import { DEFAULT_OVERLAY_STATE, DEFAULT_SETTINGS } from '@shared/defaults'
import { SettingsPanel } from './SettingsPanel'

function formatDate(value: string): string {
  const date = new Date(value)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

export function App() {
  const [scripts, setScripts] = useState<Script[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Script | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [overlayState, setOverlayState] = useState<OverlayState>(DEFAULT_OVERLAY_STATE)
  const [shortcuts, setShortcuts] = useState<ShortcutRegistrationResult[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [error, setError] = useState('')
  const saveSequence = useRef(0)

  const reloadScripts = useCallback(async () => {
    const next = await window.scriptOverlay.scripts.list()
    setScripts(next)
    setSelectedId((current) => current && next.some((script) => script.id === current) ? current : next[0]?.id ?? null)
  }, [])

  useEffect(() => {
    void Promise.all([
      reloadScripts(),
      window.scriptOverlay.settings.get().then(setSettings),
      window.scriptOverlay.overlay.getState().then(setOverlayState),
      window.scriptOverlay.shortcuts.status().then(setShortcuts)
    ]).catch((cause) => setError(String(cause)))
    const cleanups = [
      window.scriptOverlay.events.onScriptsChanged(() => void reloadScripts()),
      window.scriptOverlay.events.onSettingsChanged(setSettings),
      window.scriptOverlay.events.onOverlayStateChanged(setOverlayState)
    ]
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [reloadScripts])

  useEffect(() => {
    setDraft(scripts.find((script) => script.id === selectedId) ?? null)
    setSaveStatus('saved')
  }, [selectedId, scripts])

  useEffect(() => {
    if (!draft) return
    const stored = scripts.find((script) => script.id === draft.id)
    if (!stored || (stored.title === draft.title && stored.body === draft.body)) return
    const sequence = ++saveSequence.current
    setSaveStatus('saving')
    const timer = window.setTimeout(async () => {
      try {
        const saved = await window.scriptOverlay.scripts.save({ id: draft.id, title: draft.title || 'Untitled script', body: draft.body, position: draft.position })
        if (saveSequence.current === sequence) {
          setDraft(saved)
          setSaveStatus('saved')
        }
      } catch (cause) {
        setSaveStatus('error')
        setError(`Could not save: ${String(cause)}`)
      }
    }, 600)
    return () => window.clearTimeout(timer)
  }, [draft, scripts])

  const filteredScripts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? scripts.filter((script) => `${script.title} ${script.body}`.toLowerCase().includes(needle)) : scripts
  }, [query, scripts])

  async function createScript() {
    try {
      const script = await window.scriptOverlay.scripts.save({ title: 'Untitled script', body: '' })
      await reloadScripts()
      setSelectedId(script.id)
    } catch (cause) { setError(String(cause)) }
  }

  async function duplicateScript() {
    if (!draft) return
    try {
      const copy = await window.scriptOverlay.scripts.duplicate(draft.id)
      await reloadScripts()
      setSelectedId(copy.id)
    } catch (cause) { setError(String(cause)) }
  }

  async function deleteScript() {
    if (!draft || !window.confirm(`Delete “${draft.title}”? This cannot be undone.`)) return
    try {
      await window.scriptOverlay.scripts.remove(draft.id)
      await reloadScripts()
    } catch (cause) { setError(String(cause)) }
  }

  async function openOverlay(restart: boolean) {
    if (!draft) return
    try {
      if (saveStatus === 'saving') await new Promise((resolve) => window.setTimeout(resolve, 700))
      await window.scriptOverlay.overlay.show(draft.id, restart)
    } catch (cause) { setError(`Could not open overlay: ${String(cause)}`) }
  }

  const failedShortcuts = shortcuts.filter((shortcut) => !shortcut.registered)

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <div><strong>Script Overlay</strong><small>Creator teleprompter</small></div>
        </div>
        <button className="primary full" onClick={createScript}>＋ New script</button>
        <label className="search"><span>⌕</span><input aria-label="Search scripts" placeholder="Search scripts" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="script-list" aria-label="Script library">
          {filteredScripts.map((script) => (
            <button key={script.id} className={`script-card ${selectedId === script.id ? 'selected' : ''}`} onClick={() => setSelectedId(script.id)}>
              <strong>{script.title}</strong>
              <span>{script.body.trim().slice(0, 72) || 'Empty script'}</span>
              <small>{formatDate(script.updatedAt)}</small>
            </button>
          ))}
          {!filteredScripts.length && <div className="empty-small">{query ? 'No scripts match.' : 'Create your first script.'}</div>}
        </div>
        <button className="ghost settings-button" onClick={() => setSettingsOpen(true)}>⚙ Settings</button>
      </aside>

      <section className="workspace">
        {failedShortcuts.length > 0 && (
          <div className="warning">Some global shortcuts are already in use. You can always unlock the overlay from the tray menu.</div>
        )}
        {error && <button className="error-banner" onClick={() => setError('')}>{error}<span>×</span></button>}
        {draft ? (
          <>
            <header className="editor-header">
              <div className="title-field">
                <input aria-label="Script title" value={draft.title} maxLength={120} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
                <span className={`save-state ${saveStatus}`}>{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : 'Saved locally'}</span>
              </div>
              <div className="header-actions">
                <button className="ghost" onClick={duplicateScript}>Duplicate</button>
                <button className="ghost danger" onClick={deleteScript}>Delete</button>
                <button className="ghost" onClick={() => openOverlay(true)}>Start at top</button>
                <button className="primary" onClick={() => openOverlay(false)}>Open overlay <span>↗</span></button>
              </div>
            </header>
            <div className="editor-wrap">
              <textarea aria-label="Script content" spellCheck value={draft.body} placeholder="Paste or write your video script here…" onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
              <footer className="editor-footer">
                <span>{draft.body.trim() ? draft.body.trim().split(/\s+/).length : 0} words</span>
                <span>Progress {Math.round(draft.position)} px</span>
                {overlayState.scriptId === draft.id && <span className="live-dot">● Overlay live</span>}
              </footer>
            </div>
          </>
        ) : (
          <div className="empty-state"><span className="empty-icon">▤</span><h1>Your words, right where you need them.</h1><p>Create a script, then float it above your camera or recording app.</p><button className="primary" onClick={createScript}>Create your first script</button></div>
        )}
      </section>

      {settingsOpen && <SettingsPanel settings={settings} shortcuts={shortcuts} onClose={() => setSettingsOpen(false)} onChange={setSettings} />}
    </main>
  )
}
