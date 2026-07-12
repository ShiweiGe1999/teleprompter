import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, OverlayCommand, OverlayState, ScriptOverlayApi, UiCommand } from '@shared/types'

const api: ScriptOverlayApi = {
  scripts: {
    list: () => ipcRenderer.invoke('scripts:list'),
    save: (input) => ipcRenderer.invoke('scripts:save', input),
    remove: (id) => ipcRenderer.invoke('scripts:remove', id),
    duplicate: (id) => ipcRenderer.invoke('scripts:duplicate', id),
    updatePosition: (id, position) => ipcRenderer.invoke('scripts:update-position', id, position)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch)
  },
  overlay: {
    show: (scriptId, restart = false) => ipcRenderer.invoke('overlay:show', scriptId, restart),
    close: () => ipcRenderer.invoke('overlay:close'),
    command: (command) => ipcRenderer.invoke('overlay:command', command),
    getState: () => ipcRenderer.invoke('overlay:get-state'),
    updateState: (patch) => ipcRenderer.invoke('overlay:update-state', patch),
    confirmLock: () => ipcRenderer.invoke('overlay:confirm-lock')
  },
  shortcuts: {
    status: () => ipcRenderer.invoke('shortcuts:status')
  },
  events: {
    onOverlayCommand(callback) {
      const listener = (_event: Electron.IpcRendererEvent, command: OverlayCommand) => callback(command)
      ipcRenderer.on('overlay:command', listener)
      return () => ipcRenderer.removeListener('overlay:command', listener)
    },
    onSettingsChanged(callback) {
      const listener = (_event: Electron.IpcRendererEvent, settings: AppSettings) => callback(settings)
      ipcRenderer.on('settings:changed', listener)
      return () => ipcRenderer.removeListener('settings:changed', listener)
    },
    onOverlayStateChanged(callback) {
      const listener = (_event: Electron.IpcRendererEvent, state: OverlayState) => callback(state)
      ipcRenderer.on('overlay:state-changed', listener)
      return () => ipcRenderer.removeListener('overlay:state-changed', listener)
    },
    onScriptsChanged(callback) {
      const listener = () => callback()
      ipcRenderer.on('scripts:changed', listener)
      return () => ipcRenderer.removeListener('scripts:changed', listener)
    },
    onUiCommand(callback) {
      const listener = (_event: Electron.IpcRendererEvent, command: UiCommand) => callback(command)
      ipcRenderer.on('ui:command', listener)
      return () => ipcRenderer.removeListener('ui:command', listener)
    },
    onLockHintRequested(callback) {
      const listener = () => callback()
      ipcRenderer.on('overlay:lock-hint-requested', listener)
      return () => ipcRenderer.removeListener('overlay:lock-hint-requested', listener)
    }
  }
}

contextBridge.exposeInMainWorld('scriptOverlay', api)
