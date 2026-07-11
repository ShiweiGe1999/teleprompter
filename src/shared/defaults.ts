import type { AppSettings, OverlayState } from './types'

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
  scrollSpeed: 50,
  fontSize: 48,
  lineHeight: 1.5,
  textAlign: 'center',
  textColor: '#ffffff',
  backgroundColor: '#111218',
  backgroundOpacity: 0.7,
  overlayWidth: 720,
  hideFromCapture: false
}

export const DEFAULT_OVERLAY_STATE: OverlayState = {
  scriptId: null,
  playing: false,
  locked: false,
  position: 0,
  scrollSpeed: DEFAULT_SETTINGS.scrollSpeed
}

export const SHORTCUTS = [
  { accelerator: 'CommandOrControl+Shift+Space', action: 'toggle-play' },
  { accelerator: 'CommandOrControl+Shift+L', action: 'toggle-lock' },
  { accelerator: 'CommandOrControl+Shift+Left', action: 'rewind' },
  { accelerator: 'CommandOrControl+Shift+Up', action: 'speed-up' },
  { accelerator: 'CommandOrControl+Shift+Down', action: 'speed-down' }
] as const
