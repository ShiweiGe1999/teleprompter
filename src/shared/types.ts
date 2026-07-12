export type TextAlignment = 'left' | 'center'
export type ThemePreference = 'system' | 'light' | 'dark'
export type UiCommand = 'new-script' | 'focus-search' | 'open-settings'

export interface Script {
  id: string
  title: string
  body: string
  createdAt: string
  updatedAt: string
  position: number
}

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  displayId?: string
}

export interface AppSettings {
  version: 2
  theme: ThemePreference
  scrollSpeed: number
  fontSize: number
  lineHeight: number
  textAlign: TextAlignment
  textColor: string
  backgroundColor: string
  backgroundOpacity: number
  transparentMode: boolean
  overlayWidth: number
  hideFromCapture: boolean
  hasSeenLockHint: boolean
  hasSeenTrayNotice: boolean
  overlayBounds?: WindowBounds
}

export interface OverlayState {
  scriptId: string | null
  playing: boolean
  locked: boolean
  position: number
  scrollSpeed: number
}

export interface ShortcutRegistrationResult {
  accelerator: string
  action: OverlayCommand
  registered: boolean
}

export type OverlayCommand =
  | 'toggle-play'
  | 'play'
  | 'pause'
  | 'restart'
  | 'rewind'
  | 'forward'
  | 'speed-up'
  | 'speed-down'
  | 'toggle-lock'
  | 'lock'
  | 'unlock'

export interface ScriptInput {
  id?: string
  title: string
  body: string
  position?: number
}

export interface ScriptOverlayApi {
  scripts: {
    list(): Promise<Script[]>
    save(input: ScriptInput): Promise<Script>
    remove(id: string): Promise<void>
    duplicate(id: string): Promise<Script>
    updatePosition(id: string, position: number): Promise<void>
  }
  settings: {
    get(): Promise<AppSettings>
    update(patch: Partial<AppSettings>): Promise<AppSettings>
  }
  overlay: {
    show(scriptId: string, restart?: boolean): Promise<void>
    close(): Promise<void>
    command(command: OverlayCommand): Promise<void>
    getState(): Promise<OverlayState>
    updateState(patch: Partial<Pick<OverlayState, 'playing' | 'locked' | 'position'>>): Promise<void>
    confirmLock(): Promise<void>
  }
  shortcuts: {
    status(): Promise<ShortcutRegistrationResult[]>
  }
  events: {
    onOverlayCommand(callback: (command: OverlayCommand) => void): () => void
    onSettingsChanged(callback: (settings: AppSettings) => void): () => void
    onOverlayStateChanged(callback: (state: OverlayState) => void): () => void
    onScriptsChanged(callback: () => void): () => void
    onUiCommand(callback: (command: UiCommand) => void): () => void
    onLockHintRequested(callback: () => void): () => void
  }
}

declare global {
  interface Window {
    scriptOverlay: ScriptOverlayApi
  }
}
