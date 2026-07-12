import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_OVERLAY_STATE, DEFAULT_SETTINGS } from '@shared/defaults'
import { nextScrollPosition, seekBySeconds } from '@shared/scrolling'
import type { AppSettings, OverlayCommand, OverlayState, Script, ShortcutRegistrationResult } from '@shared/types'
import { Icon } from './Icons'

export function Overlay() {
  const [script, setScript] = useState<Script | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [state, setState] = useState<OverlayState>(DEFAULT_OVERLAY_STATE)
  const [shortcuts, setShortcuts] = useState<ShortcutRegistrationResult[]>([])
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [lockHintOpen, setLockHintOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const lastFrame = useRef<number | null>(null)
  const stateRef = useRef(state)
  const lastSaved = useRef(0)
  stateRef.current = state

  const applyCommand = useCallback((command: OverlayCommand) => {
    setOverflowOpen(false)
    setState((current) => {
      switch (command) {
        case 'toggle-play': return { ...current, playing: !current.playing }
        case 'play': return { ...current, playing: true }
        case 'pause': return { ...current, playing: false }
        case 'restart': return { ...current, playing: false, position: 0 }
        case 'rewind': return { ...current, position: seekBySeconds(current.position, current.scrollSpeed, -5) }
        case 'forward': return { ...current, position: seekBySeconds(current.position, current.scrollSpeed, 5) }
        case 'speed-up': return { ...current, scrollSpeed: Math.min(200, current.scrollSpeed + 5) }
        case 'speed-down': return { ...current, scrollSpeed: Math.max(10, current.scrollSpeed - 5) }
        case 'toggle-lock': return { ...current, locked: !current.locked }
        case 'lock': return { ...current, locked: true }
        case 'unlock': return { ...current, locked: false }
      }
    })
  }, [])

  useEffect(() => {
    void Promise.all([window.scriptOverlay.overlay.getState(), window.scriptOverlay.settings.get(), window.scriptOverlay.scripts.list(), window.scriptOverlay.shortcuts.status()]).then(([overlay, nextSettings, scripts, nextShortcuts]) => {
      setState(overlay)
      setSettings(nextSettings)
      setShortcuts(nextShortcuts)
      setScript(scripts.find((item) => item.id === overlay.scriptId) ?? null)
    })
    const cleanups = [
      window.scriptOverlay.events.onOverlayCommand(applyCommand),
      window.scriptOverlay.events.onSettingsChanged(setSettings),
      window.scriptOverlay.events.onOverlayStateChanged((next) => setState((current) => ({ ...current, ...next }))),
      window.scriptOverlay.events.onLockHintRequested(() => setLockHintOpen(true))
    ]
    return () => cleanups.forEach((cleanup) => cleanup())
  }, [applyCommand])

  useEffect(() => {
    if (scrollRef.current && Math.abs(scrollRef.current.scrollTop - state.position) > 1) scrollRef.current.scrollTop = state.position
  }, [state.position])

  useEffect(() => {
    function tick(time: number) {
      const current = stateRef.current
      if (current.playing && lastFrame.current !== null) {
        const max = scrollRef.current ? scrollRef.current.scrollHeight - scrollRef.current.clientHeight : Infinity
        const position = Math.min(max, nextScrollPosition(current.position, current.scrollSpeed, time - lastFrame.current))
        if (scrollRef.current) scrollRef.current.scrollTop = position
        setState((value) => ({ ...value, position, playing: position < max }))
        if (script && time - lastSaved.current > 1000) {
          lastSaved.current = time
          void window.scriptOverlay.scripts.updatePosition(script.id, position)
        }
      }
      lastFrame.current = time
      frameRef.current = requestAnimationFrame(tick)
    }
    frameRef.current = requestAnimationFrame(tick)
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }
  }, [script])

  useEffect(() => () => {
    if (script) void window.scriptOverlay.scripts.updatePosition(script.id, stateRef.current.position)
  }, [script])

  async function command(value: OverlayCommand) {
    await window.scriptOverlay.overlay.command(value)
  }

  async function confirmLock() {
    setLockHintOpen(false)
    await window.scriptOverlay.overlay.confirmLock()
  }

  if (!script) return <div className="overlay-loading">Loading script…</div>

  const lockShortcut = shortcuts.find((shortcut) => shortcut.action === 'toggle-lock')
  const background = settings.transparentMode ? 'transparent' : hexToRgba(settings.backgroundColor, settings.backgroundOpacity)
  return (
    <main className={`overlay-shell ${state.locked ? 'locked' : ''} ${settings.transparentMode ? 'transparent-mode' : ''}`} style={{ background }}>
      {!state.locked && <header className="overlay-toolbar">
        <span className="drag-handle"><Icon name="grip" /><strong>{script.title}</strong></span>
        <div className="overlay-actions">
          <div className="overlay-secondary">
            <ToolbarButton label="Rewind 5 seconds" icon="rewind" onClick={() => void command('rewind')} />
            <ToolbarButton label="Forward 5 seconds" icon="forward" onClick={() => void command('forward')} />
            <ToolbarButton label="Restart" icon="restart" onClick={() => void command('restart')} />
            <span className="speed-readout" aria-label={`Scroll speed ${state.scrollSpeed} pixels per second`}>{state.scrollSpeed} px/s</span>
          </div>
          <ToolbarButton className="play persistent-control" label={state.playing ? 'Pause' : 'Play'} icon={state.playing ? 'pause' : 'play'} onClick={() => void command('toggle-play')} />
          <ToolbarButton className="lock persistent-control" label="Lock overlay" icon="lock" onClick={() => void command('lock')} />
          <ToolbarButton className="close-control overlay-secondary" label="Close overlay" icon="close" onClick={() => void window.scriptOverlay.overlay.close()} />
          <div className="overflow-wrap">
            <ToolbarButton label="More overlay controls" icon="more" expanded={overflowOpen} onClick={() => setOverflowOpen((open) => !open)} />
            {overflowOpen && <div className="overlay-overflow" role="menu">
              <button role="menuitem" onClick={() => void command('rewind')}><Icon name="rewind" />Rewind 5 seconds</button>
              <button role="menuitem" onClick={() => void command('forward')}><Icon name="forward" />Forward 5 seconds</button>
              <button role="menuitem" onClick={() => void command('restart')}><Icon name="restart" />Restart</button>
              <button role="menuitem" onClick={() => void command('speed-down')}>Slower <span>{state.scrollSpeed} px/s</span></button>
              <button role="menuitem" onClick={() => void command('speed-up')}>Faster <span>{state.scrollSpeed} px/s</span></button>
              <button role="menuitem" onClick={() => void window.scriptOverlay.overlay.close()}><Icon name="close" />Close overlay</button>
            </div>}
          </div>
        </div>
      </header>}
      <div ref={scrollRef} className="prompter-scroll"><article style={{ color: settings.textColor, fontSize: settings.fontSize, lineHeight: settings.lineHeight, textAlign: settings.textAlign }}>{script.body || 'This script is empty. Unlock the overlay and return to the editor to add text.'}</article></div>
      {!state.locked && <div className="resize-hint">Drag an edge to resize · Lock when ready</div>}
      {lockHintOpen && <div className="overlay-dialog-backdrop"><section className="lock-hint" role="dialog" aria-modal="true" aria-labelledby="lock-hint-title"><div className="lock-hint-icon"><Icon name="lock" /></div><h2 id="lock-hint-title">Before you lock the overlay</h2><p>Locking makes the overlay click-through so you can control the app underneath it.</p><div className="recovery-card"><span>Unlock shortcut</span><kbd>{formatAccelerator(lockShortcut?.accelerator ?? 'CommandOrControl+Shift+L')}</kbd><small>{lockShortcut?.registered === false ? 'This shortcut is currently in use by another app. Use the tray menu to unlock.' : 'The tray menu is always available as a backup.'}</small></div><div className="dialog-actions"><button className="overlay-ghost" onClick={() => setLockHintOpen(false)}>Not yet</button><button className="overlay-primary" onClick={() => void confirmLock()}><Icon name="lock" />Lock overlay</button></div></section></div>}
    </main>
  )
}

function ToolbarButton({ label, icon, className = '', expanded, onClick }: { label: string; icon: Parameters<typeof Icon>[0]['name']; className?: string; expanded?: boolean; onClick(): void }) {
  return <button className={`toolbar-button ${className}`} title={label} aria-label={label} aria-expanded={expanded} onClick={onClick}><Icon name={icon} /><span className="button-label">{label}</span></button>
}

function formatAccelerator(accelerator: string): string {
  return navigator.userAgent.includes('Mac') ? accelerator.replace('CommandOrControl', '⌘').replace('Shift', '⇧').replaceAll('+', '') : accelerator.replace('CommandOrControl', 'Ctrl').replaceAll('+', ' + ')
}

function hexToRgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}
