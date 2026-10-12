/**
 * The complete renderer <-> main contract. The renderer can do exactly these
 * things and nothing else: no file paths, no SQL, no Node APIs.
 */
import type { SaveSnapshot, SaveSummary } from './saveTypes';

export type IpcResult<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

export interface AppInfo {
  readonly version: string;
  readonly electron: string;
  readonly chrome: string;
  readonly node: string;
  readonly platform: string;
  readonly packaged: boolean;
  readonly security: {
    readonly contextIsolation: boolean;
    readonly nodeIntegration: boolean;
    readonly sandbox: boolean;
    readonly webSecurity: boolean;
  };
}

export interface ApexApi {
  readonly appInfo: () => Promise<AppInfo>;
  readonly saves: {
    readonly list: () => Promise<IpcResult<SaveSummary[]>>;
    readonly write: (slot: string, snapshot: SaveSnapshot) => Promise<IpcResult<SaveSummary>>;
    readonly read: (slot: string) => Promise<IpcResult<SaveSnapshot>>;
    readonly remove: (slot: string) => Promise<IpcResult<null>>;
  };
  readonly quit: () => Promise<void>;
}

export const IPC = {
  appInfo: 'apex:app-info',
  savesList: 'apex:saves:list',
  savesWrite: 'apex:saves:write',
  savesRead: 'apex:saves:read',
  savesRemove: 'apex:saves:remove',
  quit: 'apex:quit',
} as const;

export type { SaveSnapshot, SaveSummary };
