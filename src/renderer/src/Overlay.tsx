import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_OVERLAY_STATE, DEFAULT_SETTINGS } from '@shared/defaults'
import { nextScrollPosition, seekBySeconds } from '@shared/scrolling'
import type { AppSettings, OverlayCommand, OverlayState, Script } from '@shared/types'

export function Overlay() {
  const [script, setScript] = useState<Script | null>(null)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [state, setState] = useState<OverlayState>(DEFAULT_OVERLAY_STATE)
  const scrollRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const lastFrame = useRef<number | null>(null)
  const stateRef = useRef(state)
  const lastSaved = useRef(0)
  stateRef.current = state

  const applyCommand = useCallback((command: OverlayCommand) => {
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
    void Promise.all([window.scriptOverlay.overlay.getState(), window.scriptOverlay.settings.get(), window.scriptOverlay.scripts.list()]).then(([overlay, nextSettings, scripts]) => {
      setState(overlay)
      setSettings(nextSettings)
      setScript(scripts.find((item) => item.id === overlay.scriptId) ?? null)
    })
    const cleanups = [
      window.scriptOverlay.events.onOverlayCommand(applyCommand),
      window.scriptOverlay.events.onSettingsChanged(setSettings),
      window.scriptOverlay.events.onOverlayStateChanged((next) => setState((current) => ({ ...current, ...next })))
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

  if (!script) return <div className="overlay-loading">Loading script…</div>

  const background = hexToRgba(settings.backgroundColor, settings.backgroundOpacity)
  return (
    <main className={`overlay-shell ${state.locked ? 'locked' : ''}`} style={{ background }}>
      {!state.locked && (
        <header className="overlay-toolbar">
          <span className="drag-handle">⠿ <strong>{script.title}</strong></span>
          <div className="overlay-actions no-drag">
            <button title="Rewind 5 seconds" onClick={() => command('rewind')}>−5s</button>
            <button className="play" title="Play or pause" onClick={() => command('toggle-play')}>{state.playing ? 'Ⅱ' : '▶'}</button>
            <button title="Forward 5 seconds" onClick={() => command('forward')}>+5s</button>
            <button title="Restart" onClick={() => command('restart')}>↺</button>
            <span>{state.scrollSpeed} px/s</span>
            <button className="lock" title="Lock and enable click-through" onClick={() => command('lock')}>Lock ↗</button>
            <button title="Close overlay" onClick={() => window.scriptOverlay.overlay.close()}>×</button>
          </div>
        </header>
      )}
      <div ref={scrollRef} className="prompter-scroll">
        <article style={{ color: settings.textColor, fontSize: settings.fontSize, lineHeight: settings.lineHeight, textAlign: settings.textAlign }}>
          {script.body || 'This script is empty. Unlock the overlay and return to the editor to add text.'}
        </article>
      </div>
      {!state.locked && <div className="resize-hint">Drag an edge to resize · Lock when ready</div>}
    </main>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}
