import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, nativeTheme, Notification, screen, Tray } from 'electron'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { z } from 'zod'
import { DEFAULT_OVERLAY_STATE, SHORTCUTS } from '@shared/defaults'
import { recoverBounds } from '@shared/bounds'
import { clampPosition, parseId, parseSettingsPatch } from '@shared/validation'
import type { AppSettings, OverlayCommand, OverlayState, ShortcutRegistrationResult, UiCommand } from '@shared/types'
import { AppStore } from './store'

const dirname = fileURLToPath(new URL('.', import.meta.url))
const overlayCommandSchema = z.enum(['toggle-play', 'play', 'pause', 'restart', 'rewind', 'forward', 'speed-up', 'speed-down', 'toggle-lock', 'lock', 'unlock'])
const overlayPatchSchema = z.object({
  playing: z.boolean().optional(),
  locked: z.boolean().optional(),
  position: z.number().finite().min(0).optional()
}).strict()

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let store: AppStore
let overlayState: OverlayState = { ...DEFAULT_OVERLAY_STATE }
let shortcutStatus: ShortcutRegistrationResult[] = []
let boundsTimer: ReturnType<typeof setTimeout> | undefined
let isQuitting = false

function rendererUrl(query = ''): string {
  if (process.env.ELECTRON_RENDERER_URL) return `${process.env.ELECTRON_RENDERER_URL}${query}`
  return `${pathToFileURL(join(dirname, '../renderer/index.html')).toString()}${query}`
}

function secureWebPreferences(): Electron.WebPreferences {
  return {
    preload: join(dirname, '../preload/index.cjs'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true
  }
}

function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? '#0d0e13' : '#f7f7fa'
}

function iconPath(): string {
  const fileName = process.platform === 'win32' ? 'icon.ico' : 'icon.png'
  return app.isPackaged ? join(process.resourcesPath, fileName) : join(app.getAppPath(), 'build', fileName)
}

function applicationIcon(): Electron.NativeImage {
  const icon = nativeImage.createFromPath(iconPath())
  if (!icon.isEmpty()) return icon
  const fallback = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="15" fill="#071317"/><path d="M15 18h34M15 31h34M15 44h24" stroke="#43f5d0" stroke-width="6" stroke-linecap="round"/></svg>`
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(fallback).toString('base64')}`)
}

function sendUiCommand(command: UiCommand): void {
  showEditor()
  if (!mainWindow) return
  if (mainWindow.webContents.isLoading()) mainWindow.webContents.once('did-finish-load', () => mainWindow?.webContents.send('ui:command', command))
  else mainWindow.webContents.send('ui:command', command)
}

function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 880,
    minHeight: 600,
    title: 'Script Overlay',
    icon: applicationIcon(),
    backgroundColor: windowBackground(),
    show: false,
    webPreferences: secureWebPreferences()
  })
  if (process.platform !== 'darwin') window.removeMenu()
  void window.loadURL(rendererUrl())
  window.once('ready-to-show', () => window.show())
  window.on('close', () => {
    if (process.platform !== 'win32' || isQuitting) return
    const settings = store.getSettings()
    if (!settings.hasSeenTrayNotice && Notification.isSupported()) {
      new Notification({ title: 'Script Overlay is still running', body: 'Use the tray icon to reopen the editor or quit the app.' }).show()
      store.updateSettings({ hasSeenTrayNotice: true })
    }
  })
  window.on('closed', () => { mainWindow = null })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  return window
}

function defaultOverlayBounds(settings: AppSettings): Electron.Rectangle {
  const area = screen.getPrimaryDisplay().workArea
  const width = Math.min(settings.overlayWidth, area.width)
  const height = Math.min(520, area.height)
  return {
    x: area.x + Math.round((area.width - width) / 2),
    y: area.y + Math.round((area.height - height) / 2),
    width,
    height
  }
}

async function showOverlay(scriptId: string, restart: boolean): Promise<void> {
  const script = store.getScript(parseId(scriptId))
  if (!script) throw new Error('Script not found')
  const settings = store.getSettings()
  if (overlayWindow && overlayState.scriptId === script.id && !restart) {
    overlayWindow.setIgnoreMouseEvents(false)
    overlayState.locked = false
    overlayWindow.show()
    overlayWindow.focus()
    broadcastState()
    updateTrayMenu()
    return
  }
  overlayState = {
    scriptId: script.id,
    playing: false,
    locked: false,
    position: restart ? 0 : script.position,
    scrollSpeed: settings.scrollSpeed
  }

  if (overlayWindow) {
    overlayWindow.setIgnoreMouseEvents(false)
    overlayWindow.setContentProtection(settings.hideFromCapture)
    overlayWindow.show()
    overlayWindow.focus()
    overlayWindow.webContents.send('overlay:state-changed', overlayState)
    overlayWindow.webContents.reload()
    updateTrayMenu()
    return
  }

  const bounds = recoverBounds(settings.overlayBounds, screen.getAllDisplays(), defaultOverlayBounds(settings))
  overlayWindow = new BrowserWindow({
    ...bounds,
    minWidth: 320,
    minHeight: 180,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    show: false,
    hasShadow: false,
    webPreferences: secureWebPreferences()
  })
  overlayWindow.setAlwaysOnTop(true, 'floating')
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  overlayWindow.setContentProtection(settings.hideFromCapture)
  overlayWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  overlayWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  await overlayWindow.loadURL(rendererUrl('?overlay=1'))
  overlayWindow.show()
  overlayWindow.focus()
  overlayWindow.on('move', scheduleBoundsSave)
  overlayWindow.on('resize', scheduleBoundsSave)
  overlayWindow.on('closed', () => {
    if (overlayState.scriptId) store.updatePosition(overlayState.scriptId, overlayState.position)
    overlayWindow = null
    overlayState = { ...DEFAULT_OVERLAY_STATE, scrollSpeed: store.getSettings().scrollSpeed }
    broadcastState()
    updateTrayMenu()
  })
  broadcastState()
  updateTrayMenu()
}

function scheduleBoundsSave(): void {
  clearTimeout(boundsTimer)
  boundsTimer = setTimeout(() => {
    if (!overlayWindow) return
    const bounds = overlayWindow.getBounds()
    const displayId = String(screen.getDisplayMatching(bounds).id)
    store.updateSettings({ overlayBounds: { ...bounds, displayId } })
  }, 300)
}

function applyLock(locked: boolean): void {
  overlayState.locked = locked
  overlayWindow?.setIgnoreMouseEvents(locked, { forward: true })
}

function requestLock(): boolean {
  if (!store.getSettings().hasSeenLockHint) {
    overlayWindow?.webContents.send('overlay:lock-hint-requested')
    return false
  }
  applyLock(true)
  return true
}

function executeOverlayCommand(raw: OverlayCommand): void {
  const command = overlayCommandSchema.parse(raw)
  if (!overlayWindow && command !== 'unlock') return
  switch (command) {
    case 'toggle-play': overlayState.playing = !overlayState.playing; break
    case 'play': overlayState.playing = true; break
    case 'pause': overlayState.playing = false; break
    case 'restart': overlayState.position = 0; overlayState.playing = false; break
    case 'toggle-lock':
      if (overlayState.locked) applyLock(false)
      else if (!requestLock()) return
      break
    case 'lock': if (!requestLock()) return; break
    case 'unlock': applyLock(false); overlayWindow?.show(); overlayWindow?.focus(); break
    case 'speed-up': updateSpeed(5); break
    case 'speed-down': updateSpeed(-5); break
    case 'rewind': overlayWindow?.webContents.send('overlay:command', 'rewind'); return
    case 'forward': overlayWindow?.webContents.send('overlay:command', 'forward'); return
  }
  overlayWindow?.webContents.send('overlay:command', command)
  broadcastState()
  updateTrayMenu()
}

function updateSpeed(delta: number): void {
  const speed = Math.min(200, Math.max(10, overlayState.scrollSpeed + delta))
  overlayState.scrollSpeed = speed
  const settings = store.updateSettings({ scrollSpeed: speed })
  broadcastSettings(settings)
}

function broadcastState(): void {
  overlayWindow?.webContents.send('overlay:state-changed', { ...overlayState })
  mainWindow?.webContents.send('overlay:state-changed', { ...overlayState })
}

function broadcastSettings(settings: AppSettings): void {
  overlayWindow?.webContents.send('settings:changed', settings)
  mainWindow?.webContents.send('settings:changed', settings)
}

function broadcastScripts(): void {
  mainWindow?.webContents.send('scripts:changed')
}

function registerIpc(): void {
  const validSender = (event: Electron.IpcMainInvokeEvent): void => {
    if (event.sender !== mainWindow?.webContents && event.sender !== overlayWindow?.webContents) throw new Error('Unauthorized IPC sender')
  }
  ipcMain.handle('scripts:list', (event) => { validSender(event); return store.listScripts() })
  ipcMain.handle('scripts:save', (event, input) => { validSender(event); const result = store.saveScript(input); broadcastScripts(); return result })
  ipcMain.handle('scripts:remove', (event, id) => {
    validSender(event)
    const parsedId = parseId(id)
    if (overlayState.scriptId === parsedId) overlayWindow?.close()
    store.removeScript(parsedId)
    broadcastScripts()
  })
  ipcMain.handle('scripts:duplicate', (event, id) => { validSender(event); const result = store.duplicateScript(parseId(id)); broadcastScripts(); return result })
  ipcMain.handle('scripts:update-position', (event, id, position) => {
    validSender(event)
    const parsedId = parseId(id)
    const parsedPosition = clampPosition(position)
    store.updatePosition(parsedId, parsedPosition)
    if (overlayState.scriptId === parsedId) overlayState.position = parsedPosition
  })
  ipcMain.handle('settings:get', (event) => { validSender(event); return store.getSettings() })
  ipcMain.handle('settings:update', (event, patch) => {
    validSender(event)
    const parsedPatch = parseSettingsPatch(patch)
    const settings = store.updateSettings(parsedPatch)
    if (parsedPatch.theme !== undefined) {
      nativeTheme.themeSource = settings.theme
      mainWindow?.setBackgroundColor(windowBackground())
    }
    overlayState.scrollSpeed = settings.scrollSpeed
    overlayWindow?.setContentProtection(settings.hideFromCapture)
    if (overlayWindow && parsedPatch.overlayWidth) overlayWindow.setSize(settings.overlayWidth, overlayWindow.getBounds().height)
    broadcastSettings(settings)
    return settings
  })
  ipcMain.handle('overlay:show', async (event, id, restart) => { validSender(event); await showOverlay(parseId(id), Boolean(restart)) })
  ipcMain.handle('overlay:close', (event) => { validSender(event); overlayWindow?.close() })
  ipcMain.handle('overlay:command', (event, command) => { validSender(event); executeOverlayCommand(overlayCommandSchema.parse(command)) })
  ipcMain.handle('overlay:get-state', (event) => { validSender(event); return { ...overlayState } })
  ipcMain.handle('overlay:update-state', (event, rawPatch) => {
    validSender(event)
    const patch = overlayPatchSchema.parse(rawPatch)
    if (patch.locked !== undefined) applyLock(patch.locked)
    if (patch.playing !== undefined) overlayState.playing = patch.playing
    if (patch.position !== undefined) {
      overlayState.position = clampPosition(patch.position)
      if (overlayState.scriptId) store.updatePosition(overlayState.scriptId, overlayState.position)
    }
    broadcastState()
    updateTrayMenu()
  })
  ipcMain.handle('overlay:confirm-lock', (event) => {
    validSender(event)
    const settings = store.updateSettings({ hasSeenLockHint: true })
    applyLock(true)
    overlayWindow?.webContents.send('overlay:command', 'lock')
    broadcastSettings(settings)
    broadcastState()
    updateTrayMenu()
  })
  ipcMain.handle('shortcuts:status', (event) => { validSender(event); return shortcutStatus })
}

function createApplicationMenu(): void {
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null)
    return
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'Command+,', click: () => sendUiCommand('open-settings') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'New Script', accelerator: 'Command+N', click: () => sendUiCommand('new-script') },
        { label: 'Find', accelerator: 'Command+F', click: () => sendUiCommand('focus-search') },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    { role: 'editMenu' },
    { role: 'windowMenu' }
  ]))
}

function registerShortcuts(): void {
  shortcutStatus = SHORTCUTS.map(({ accelerator, action }) => ({
    accelerator,
    action,
    registered: globalShortcut.register(accelerator, () => executeOverlayCommand(action))
  }))
}

function createTray(): void {
  tray = new Tray(applicationIcon())
  tray.setToolTip('Script Overlay')
  tray.on('double-click', showEditor)
  updateTrayMenu()
}

function showEditor(): void {
  if (!mainWindow) mainWindow = createMainWindow()
  mainWindow.show()
  mainWindow.focus()
}

function updateTrayMenu(): void {
  if (!tray) return
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: overlayState.playing ? 'Pause' : 'Play', enabled: Boolean(overlayWindow), click: () => executeOverlayCommand('toggle-play') },
    { label: 'Restart', enabled: Boolean(overlayWindow), click: () => executeOverlayCommand('restart') },
    { label: overlayState.locked ? 'Unlock overlay' : 'Lock overlay', enabled: Boolean(overlayWindow), click: () => executeOverlayCommand('toggle-lock') },
    { type: 'separator' },
    { label: 'Show editor', click: showEditor },
    { label: 'Quit', click: () => { isQuitting = true; app.quit() } }
  ]))
}

app.whenReady().then(() => {
  store = new AppStore()
  nativeTheme.themeSource = store.getSettings().theme
  registerIpc()
  createApplicationMenu()
  mainWindow = createMainWindow()
  registerShortcuts()
  createTray()
  app.on('activate', showEditor)
  nativeTheme.on('updated', () => mainWindow?.setBackgroundColor(windowBackground()))
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) app.quit()
})

app.on('before-quit', () => {
  isQuitting = true
  globalShortcut.unregisterAll()
})
