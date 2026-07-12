import { useEffect, useRef } from 'react'
import type { KeyboardEvent, RefObject } from 'react'
import type { AppSettings, ShortcutRegistrationResult, ThemePreference } from '@shared/types'
import { Icon } from './Icons'

interface Props {
  settings: AppSettings
  shortcuts: ShortcutRegistrationResult[]
  triggerRef: RefObject<HTMLButtonElement | null>
  onClose(): void
  onChange(settings: AppSettings): void
}

export function SettingsPanel({ settings, shortcuts, triggerRef, onClose, onChange }: Props) {
  const panelRef = useRef<HTMLElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
    return () => triggerRef.current?.focus()
  }, [triggerRef])

  async function update(patch: Partial<AppSettings>) {
    onChange(await window.scriptOverlay.settings.update(patch))
  }

  function handleDialogKey(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
    if (event.key !== 'Tab' || !panelRef.current) return
    const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={panelRef} className="settings-panel" role="dialog" aria-modal="true" aria-labelledby="settings-title" onKeyDown={handleDialogKey}>
        <header><div><h2 id="settings-title" ref={headingRef} tabIndex={-1}>Settings</h2><p>Personalize the editor and teleprompter.</p></div><button className="icon-button" aria-label="Close settings" title="Close settings" onClick={onClose}><Icon name="close" /></button></header>
        <div className="settings-scroll">
          <div className="setting-group"><h3>Appearance</h3>
            <fieldset className="theme-picker"><legend>App theme</legend>{(['system', 'light', 'dark'] as ThemePreference[]).map((theme) => <label key={theme} className={settings.theme === theme ? 'selected' : ''}><input type="radio" name="theme" value={theme} checked={settings.theme === theme} onChange={() => void update({ theme })} /><Icon name={theme === 'system' ? 'monitor' : theme === 'light' ? 'sun' : 'moon'} /><span>{theme[0].toUpperCase() + theme.slice(1)}</span></label>)}</fieldset>
          </div>
          <div className="setting-group"><h3>Reading</h3>
            <Range label="Scroll speed" value={settings.scrollSpeed} min={10} max={200} suffix="px/s" onChange={(value) => update({ scrollSpeed: value })} />
            <Range label="Font size" value={settings.fontSize} min={24} max={96} suffix="px" onChange={(value) => update({ fontSize: value })} />
            <Range label="Line height" value={settings.lineHeight} min={1} max={2.5} step={0.1} suffix="×" onChange={(value) => update({ lineHeight: value })} />
            <label className="setting-row"><span><strong>Text alignment</strong></span><select value={settings.textAlign} onChange={(event) => void update({ textAlign: event.target.value as AppSettings['textAlign'] })}><option value="center">Center</option><option value="left">Left</option></select></label>
          </div>
          <div className="setting-group"><h3>Overlay colors</h3><p className="group-description">These stay independent from the app theme.</p>
            <label className="toggle-row transparent-toggle"><span><strong>Transparent mode</strong><small>Remove the overlay panel while keeping the script text visible.</small></span><input type="checkbox" checked={settings.transparentMode} onChange={(event) => void update({ transparentMode: event.target.checked })} /></label>
            <Color label="Text color" value={settings.textColor} onChange={(value) => update({ textColor: value })} />
            <Color label="Background color" value={settings.backgroundColor} onChange={(value) => update({ backgroundColor: value })} />
            <Range label="Background opacity" value={settings.backgroundOpacity} min={0.1} max={1} step={0.05} suffix="" display={settings.transparentMode ? 'Off' : `${Math.round(settings.backgroundOpacity * 100)}%`} disabled={settings.transparentMode} onChange={(value) => update({ backgroundOpacity: value })} />
            <Range label="Overlay width" value={settings.overlayWidth} min={320} max={1600} step={20} suffix="px" onChange={(value) => update({ overlayWidth: value })} />
          </div>
          <div className="setting-group"><h3>Privacy</h3>
            <label className="toggle-row"><span><strong>Hide from screen capture</strong><small>Best-effort only. Support varies between operating systems and recording apps.</small></span><input type="checkbox" checked={settings.hideFromCapture} onChange={(event) => void update({ hideFromCapture: event.target.checked })} /></label>
          </div>
          <div className="setting-group shortcuts"><h3>Global shortcuts</h3>
            {shortcuts.map((shortcut) => <div className="shortcut-row" key={shortcut.accelerator}><span>{shortcut.action.replaceAll('-', ' ')}</span><kbd>{formatAccelerator(shortcut.accelerator)}</kbd><i className={shortcut.registered ? 'ok' : 'bad'}>{shortcut.registered ? 'Ready' : 'In use'}</i></div>)}
          </div>
        </div>
      </section>
    </div>
  )
}

function formatAccelerator(accelerator: string): string {
  const isMac = navigator.userAgent.includes('Mac')
  if (!isMac) return accelerator.replace('CommandOrControl', 'Ctrl').replaceAll('+', ' + ')
  return accelerator.replace('CommandOrControl', '⌘').replace('Shift', '⇧').replace('Space', 'Space').replaceAll('+', '')
}

function Range({ label, value, min, max, step = 1, suffix, display, disabled = false, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; display?: string; disabled?: boolean; onChange(value: number): void | Promise<unknown> }) {
  return <label className={`range-setting ${disabled ? 'disabled' : ''}`}><span><strong>{label}</strong><output>{display ?? `${value}${suffix}`}</output></span><input type="range" aria-label={label} value={value} min={min} max={max} step={step} disabled={disabled} onChange={(event) => void onChange(Number(event.target.value))} /></label>
}

function Color({ label, value, onChange }: { label: string; value: string; onChange(value: string): void | Promise<unknown> }) {
  return <label className="setting-row"><span><strong>{label}</strong></span><span className="color-control"><input aria-label={label} type="color" value={value} onChange={(event) => void onChange(event.target.value)} /><code>{value.toUpperCase()}</code></span></label>
}
