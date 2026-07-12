import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { AppSettings, OverlayState, Script, ShortcutRegistrationResult, UiCommand } from '@shared/types'
import { DEFAULT_OVERLAY_STATE, DEFAULT_SETTINGS } from '@shared/defaults'
import { getReadingMetrics } from '@shared/reading'
import { Icon } from './Icons'
import { SettingsPanel } from './SettingsPanel'

type SaveStatus = 'saved' | 'saving' | 'error'
interface AppError { message: string; retry?: () => void }

function formatRelativeDate(value: string): string {
  const days = Math.round((new Date(value).getTime() - Date.now()) / 86_400_000)
  if (Math.abs(days) < 7) return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(days, 'day')
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value))
}

function formatMinutes(value: number): string {
  if (value <= 0) return '0 min'
  if (value < 1) return '<1 min'
  return `${Math.ceil(value)} min`
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
  const [actionsOpen, setActionsOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [error, setError] = useState<AppError | null>(null)
  const saveSequence = useRef(0)
  const draftRef = useRef(draft)
  const searchRef = useRef<HTMLInputElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  draftRef.current = draft

  const reloadScripts = useCallback(async () => {
    const next = await window.scriptOverlay.scripts.list()
    setScripts(next)
    setSelectedId((current) => current && next.some((script) => script.id === current) ? current : next[0]?.id ?? null)
  }, [])

  const createScript = useCallback(async () => {
    try {
      const script = await window.scriptOverlay.scripts.save({ title: 'Untitled script', body: '' })
      await reloadScripts()
      setSelectedId(script.id)
      window.setTimeout(() => titleRef.current?.select(), 0)
    } catch (cause) { setError({ message: String(cause), retry: () => void createScript() }) }
  }, [reloadScripts])

  const handleUiCommand = useCallback((command: UiCommand) => {
    if (command === 'new-script') void createScript()
    if (command === 'focus-search') searchRef.current?.focus()
    if (command === 'open-settings') setSettingsOpen(true)
  }, [createScript])

  useEffect(() => {
    void Promise.all([
      reloadScripts(),
      window.scriptOverlay.settings.get().then(setSettings),
      window.scriptOverlay.overlay.getState().then(setOverlayState),
      window.scriptOverlay.shortcuts.status().then(setShortcuts)
    ]).catch((cause) => setError({ message: String(cause) }))
    const cleanups = [
      window.scriptOverlay.events.onScriptsChanged(() => void reloadScripts()),
      window.scriptOverlay.events.onSettingsChanged(setSettings),
      window.scriptOverlay.events.onOverlayStateChanged(setOverlayState),
      window.scriptOverlay.events.onUiCommand(handleUiCommand)
    ]
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [handleUiCommand, reloadScripts])

  useEffect(() => {
    setDraft(scripts.find((script) => script.id === selectedId) ?? null)
    setSaveStatus('saved')
  }, [selectedId, scripts])

  const saveDraftNow = useCallback(async () => {
    const current = draftRef.current
    if (!current) return
    const sequence = ++saveSequence.current
    setSaveStatus('saving')
    try {
      const saved = await window.scriptOverlay.scripts.save({ id: current.id, title: current.title || 'Untitled script', body: current.body, position: current.position })
      if (saveSequence.current === sequence) {
        setDraft(saved)
        setSaveStatus('saved')
        setError(null)
      }
    } catch (cause) {
      setSaveStatus('error')
      setError({ message: `Could not save this script. ${String(cause)}`, retry: () => void saveDraftNow() })
    }
  }, [])

  useEffect(() => {
    if (!draft) return
    const stored = scripts.find((script) => script.id === draft.id)
    if (!stored || (stored.title === draft.title && stored.body === draft.body)) return
    setSaveStatus('saving')
    const timer = window.setTimeout(() => void saveDraftNow(), 600)
    return () => window.clearTimeout(timer)
  }, [draft, saveDraftNow, scripts])

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      const modifier = event.ctrlKey || event.metaKey
      if (modifier && event.key.toLowerCase() === 'n') { event.preventDefault(); void createScript() }
      if (modifier && event.key.toLowerCase() === 'f') { event.preventDefault(); searchRef.current?.focus() }
      if (modifier && event.key === ',') { event.preventDefault(); setSettingsOpen(true) }
      if (event.key === 'F2' && draftRef.current) { event.preventDefault(); titleRef.current?.focus(); titleRef.current?.select() }
      if (event.key === 'Escape') setActionsOpen(false)
    }
    function handlePointer(event: PointerEvent) {
      if (actionsRef.current && !actionsRef.current.contains(event.target as Node)) setActionsOpen(false)
    }
    window.addEventListener('keydown', handleKey)
    window.addEventListener('pointerdown', handlePointer)
    return () => { window.removeEventListener('keydown', handleKey); window.removeEventListener('pointerdown', handlePointer) }
  }, [createScript])

  const filteredScripts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return needle ? scripts.filter((script) => `${script.title} ${script.body}`.toLowerCase().includes(needle)) : scripts
  }, [query, scripts])

  async function duplicateScript() {
    if (!draft) return
    setActionsOpen(false)
    try {
      const copy = await window.scriptOverlay.scripts.duplicate(draft.id)
      await reloadScripts()
      setSelectedId(copy.id)
    } catch (cause) { setError({ message: String(cause), retry: () => void duplicateScript() }) }
  }

  async function deleteScript() {
    if (!draft || !window.confirm(`Delete “${draft.title}”? This cannot be undone.`)) return
    setActionsOpen(false)
    try {
      await window.scriptOverlay.scripts.remove(draft.id)
      await reloadScripts()
    } catch (cause) { setError({ message: String(cause), retry: () => void deleteScript() }) }
  }

  async function openOverlay(restart: boolean) {
    if (!draft) return
    setActionsOpen(false)
    try {
      if (saveStatus === 'saving') await saveDraftNow()
      await window.scriptOverlay.overlay.show(draft.id, restart)
    } catch (cause) { setError({ message: `Could not open the overlay. ${String(cause)}`, retry: () => void openOverlay(restart) }) }
  }

  function handleLibraryKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!filteredScripts.length) return
    const current = filteredScripts.findIndex((script) => script.id === selectedId)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      const next = filteredScripts[(current + delta + filteredScripts.length) % filteredScripts.length]
      setSelectedId(next.id)
      document.getElementById(`script-${next.id}`)?.focus()
    }
    if (event.key === 'Enter' && current >= 0) setSelectedId(filteredScripts[current].id)
  }

  const failedShortcuts = shortcuts.filter((shortcut) => !shortcut.registered)
  const isLive = Boolean(draft && overlayState.scriptId === draft.id)
  const metrics = draft ? getReadingMetrics(draft, settings) : null
  const modifierLabel = navigator.userAgent.includes('Mac') ? '⌘' : 'Ctrl'

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">S</span><div><strong>Script Overlay</strong><small>Creator teleprompter</small></div></div>
        <button className="primary full" onClick={() => void createScript()}><Icon name="plus" />New script</button>
        <label className="search"><Icon name="search" /><input ref={searchRef} aria-label="Search scripts" placeholder="Search scripts" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setQuery(''); event.currentTarget.blur() } }} />{query && <button type="button" className="clear-search" aria-label="Clear search" title="Clear search" onClick={() => { setQuery(''); searchRef.current?.focus() }}><Icon name="close" /></button>}</label>
        <div className="script-list" aria-label="Script library" role="listbox" tabIndex={filteredScripts.length ? 0 : -1} onKeyDown={handleLibraryKey}>
          {filteredScripts.map((script) => <button id={`script-${script.id}`} role="option" aria-selected={selectedId === script.id} key={script.id} className={`script-card ${selectedId === script.id ? 'selected' : ''}`} onClick={() => setSelectedId(script.id)}><strong>{script.title}</strong><span>{script.body.trim().slice(0, 72) || 'Empty script'}</span><small>{formatRelativeDate(script.updatedAt)}</small></button>)}
          {!filteredScripts.length && <div className="empty-small">{query ? <><span>No scripts match.</span><button className="text-button" onClick={() => setQuery('')}>Clear search</button></> : 'Create your first script.'}</div>}
        </div>
        <button ref={settingsButtonRef} className="ghost settings-button" onClick={() => setSettingsOpen(true)}><Icon name="settings" />Settings <kbd>{modifierLabel} ,</kbd></button>
      </aside>

      <section className="workspace">
        {failedShortcuts.length > 0 && <div className="warning" role="status"><Icon name="alert" /><span>Some global shortcuts are in use. Tray controls remain available.</span></div>}
        {error && <div className="error-banner" role="alert"><Icon name="alert" /><span>{error.message}</span><div>{error.retry && <button onClick={error.retry}>Retry</button>}<button className="icon-button small" aria-label="Dismiss error" onClick={() => setError(null)}><Icon name="close" /></button></div></div>}
        {draft ? <>
          <header className="editor-header">
            <div className="title-field"><input ref={titleRef} aria-label="Script title" value={draft.title} maxLength={120} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /><span className={`save-state ${saveStatus}`} role="status" aria-live="polite">{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'error' ? 'Save failed' : <><Icon name="check" />Saved locally</>}</span></div>
            <div className="header-actions">
              <button className="ghost danger-button" aria-label="Delete script" title="Delete script" onClick={() => void deleteScript()}><Icon name="trash" />Delete</button>
              <div ref={actionsRef} className="action-menu-wrap"><button className="ghost icon-only" aria-label="More script actions" title="More script actions" aria-haspopup="menu" aria-expanded={actionsOpen} onClick={() => setActionsOpen((open) => !open)}><Icon name="more" /></button>{actionsOpen && <div className="action-menu" role="menu"><button role="menuitem" onClick={() => void openOverlay(true)}><Icon name="restart" />Start overlay at top</button><button role="menuitem" onClick={() => void duplicateScript()}><Icon name="copy" />Duplicate script</button></div>}</div>
              <button className="primary" onClick={() => void openOverlay(false)}>Open overlay<Icon name="open" /></button>
            </div>
          </header>
          <div className="editor-wrap"><textarea aria-label="Script content" spellCheck value={draft.body} placeholder="Paste or write your video script here…" onChange={(event) => setDraft({ ...draft, body: event.target.value })} /><footer className="editor-footer"><span>{metrics?.wordCount ?? 0} words</span><span>{metrics?.progressPercent ?? 0}% read</span><span>{formatMinutes(metrics?.remainingMinutes ?? 0)} remaining</span>{isLive && <span className="live-controls"><span className="live-dot">Live</span><button onClick={() => window.scriptOverlay.overlay.command('toggle-play')}><Icon name={overlayState.playing ? 'pause' : 'play'} />{overlayState.playing ? 'Pause' : 'Play'}</button></span>}</footer></div>
        </> : <div className="empty-state"><span className="empty-icon"><Icon name="file" /></span><h1>Your words, right where you need them.</h1><p>Create a script and turn it into a distraction-free teleprompter.</p><ol className="first-run-steps"><li><span>1</span><strong>Create or paste</strong><small>Write in the editor</small></li><li><span>2</span><strong>Open overlay</strong><small>Preview your script</small></li><li><span>3</span><strong>Position and lock</strong><small>Keep clicks flowing through</small></li></ol><button className="primary" onClick={() => void createScript()}><Icon name="plus" />Create blank script</button></div>}
      </section>

      {settingsOpen && <SettingsPanel settings={settings} shortcuts={shortcuts} triggerRef={settingsButtonRef} onClose={() => setSettingsOpen(false)} onChange={setSettings} />}
    </main>
  )
}
