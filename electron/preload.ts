/**
 * Sandboxed preload. Exposes a narrow, frozen API object; never exposes
 * ipcRenderer itself or any Node primitive to the page.
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type ApexApi } from '../src/shared/ipc';

const api: ApexApi = Object.freeze({
  appInfo: () => ipcRenderer.invoke(IPC.appInfo),
  saves: Object.freeze({
    list: () => ipcRenderer.invoke(IPC.savesList),
    write: (slot: string, snapshot: unknown) => ipcRenderer.invoke(IPC.savesWrite, slot, snapshot),
    read: (slot: string) => ipcRenderer.invoke(IPC.savesRead, slot),
    remove: (slot: string) => ipcRenderer.invoke(IPC.savesRemove, slot),
  }),
  quit: () => ipcRenderer.invoke(IPC.quit),
}) as ApexApi;

contextBridge.exposeInMainWorld('apex', api);
