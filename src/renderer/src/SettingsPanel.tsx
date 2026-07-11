import type { AppSettings, ShortcutRegistrationResult } from '@shared/types'

interface Props {
  settings: AppSettings
  shortcuts: ShortcutRegistrationResult[]
  onClose(): void
  onChange(settings: AppSettings): void
}

export function SettingsPanel({ settings, shortcuts, onClose, onChange }: Props) {
  async function update(patch: Partial<AppSettings>) {
    onChange(await window.scriptOverlay.settings.update(patch))
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="settings-panel" role="dialog" aria-modal="true" aria-label="Overlay settings">
        <header><div><h2>Overlay settings</h2><p>Changes apply to the open overlay immediately.</p></div><button className="icon-button" aria-label="Close settings" onClick={onClose}>×</button></header>
        <div className="settings-scroll">
          <div className="setting-group"><h3>Reading</h3>
            <Range label="Scroll speed" value={settings.scrollSpeed} min={10} max={200} suffix="px/s" onChange={(value) => update({ scrollSpeed: value })} />
            <Range label="Font size" value={settings.fontSize} min={24} max={96} suffix="px" onChange={(value) => update({ fontSize: value })} />
            <Range label="Line height" value={settings.lineHeight} min={1} max={2.5} step={0.1} suffix="×" onChange={(value) => update({ lineHeight: value })} />
            <label className="setting-row"><span><strong>Text alignment</strong></span><select value={settings.textAlign} onChange={(event) => update({ textAlign: event.target.value as AppSettings['textAlign'] })}><option value="center">Center</option><option value="left">Left</option></select></label>
          </div>
          <div className="setting-group"><h3>Appearance</h3>
            <Color label="Text color" value={settings.textColor} onChange={(value) => update({ textColor: value })} />
            <Color label="Background color" value={settings.backgroundColor} onChange={(value) => update({ backgroundColor: value })} />
            <Range label="Background opacity" value={settings.backgroundOpacity} min={0.1} max={1} step={0.05} suffix="" display={`${Math.round(settings.backgroundOpacity * 100)}%`} onChange={(value) => update({ backgroundOpacity: value })} />
            <Range label="Overlay width" value={settings.overlayWidth} min={320} max={1600} step={20} suffix="px" onChange={(value) => update({ overlayWidth: value })} />
          </div>
          <div className="setting-group"><h3>Privacy</h3>
            <label className="toggle-row"><span><strong>Hide from screen capture</strong><small>Best-effort only. Support varies between operating systems and recording apps.</small></span><input type="checkbox" checked={settings.hideFromCapture} onChange={(event) => update({ hideFromCapture: event.target.checked })} /></label>
          </div>
          <div className="setting-group shortcuts"><h3>Global shortcuts</h3>
            {shortcuts.map((shortcut) => <div className="shortcut-row" key={shortcut.accelerator}><span>{shortcut.action.replaceAll('-', ' ')}</span><kbd>{shortcut.accelerator.replace('CommandOrControl', 'Ctrl / ⌘')}</kbd><i className={shortcut.registered ? 'ok' : 'bad'}>{shortcut.registered ? 'Ready' : 'In use'}</i></div>)}
          </div>
        </div>
      </section>
    </div>
  )
}

function Range({ label, value, min, max, step = 1, suffix, display, onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix: string; display?: string; onChange(value: number): void }) {
  return <label className="range-setting"><span><strong>{label}</strong><output>{display ?? `${value}${suffix}`}</output></span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>
}

function Color({ label, value, onChange }: { label: string; value: string; onChange(value: string): void }) {
  return <label className="setting-row"><span><strong>{label}</strong></span><span className="color-control"><input type="color" value={value} onChange={(event) => onChange(event.target.value)} /><code>{value.toUpperCase()}</code></span></label>
}
