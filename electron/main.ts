import { BrowserWindow, app, ipcMain, net, protocol, session, type IpcMainInvokeEvent } from 'electron';
import { existsSync } from 'node:fs';
import { join, normalize, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { SaveError, SaveSnapshotSchema, SaveStore, saveDirectoryFor } from '../src/persistence/saveStore';
import { IPC, type AppInfo, type IpcResult } from '../src/shared/ipc';
import { isTrustedAppUrl } from './security';

const APP_SCHEME = 'app';
const APP_HOST = 'apex';
const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIR = resolve(__dirname, '..', 'dist');

// Isolated profile for automated tests / multiple careers on one machine.
if (process.env.APEX_USER_DATA_DIR) app.setPath('userData', resolve(process.env.APEX_USER_DATA_DIR));

protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true } },
]);

const PROD_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self'",
  "media-src 'self' data: blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

// Vite's dev server needs inline preamble scripts and a websocket for HMR.
const DEV_CSP = PROD_CSP.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'").replace(
  "connect-src 'self'",
  "connect-src 'self' ws://localhost:* http://localhost:*",
);

const securePrefs = { contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } as const;

let mainWindow: BrowserWindow | null = null;
let store: SaveStore | null = null;

function rendererUrl(): string {
  return DEV_URL ?? `${APP_SCHEME}://${APP_HOST}/index.html`;
}

const isAppUrl = (raw: string): boolean => isTrustedAppUrl(raw, { scheme: APP_SCHEME, host: APP_HOST, devUrl: DEV_URL });

function registerAppProtocol(): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    if (url.host !== APP_HOST) return new Response('Not found', { status: 404 });
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '') || 'index.html';
    const file = resolve(RENDERER_DIR, rel);
    const inside = relative(RENDERER_DIR, file);
    if (inside.startsWith('..') || inside.includes(`..${sep}`) || !existsSync(file)) {
      return new Response('Not found', { status: 404 });
    }
    const res = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(res.headers);
    headers.set('Content-Security-Policy', PROD_CSP);
    headers.set('X-Content-Type-Options', 'nosniff');
    return new Response(res.body, { status: res.status, headers });
  });
}

function hardenSession(): void {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  if (DEV_URL) {
    ses.webRequest.onHeadersReceived((details, cb) => {
      cb({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [DEV_CSP] } });
    });
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    backgroundColor: '#090d12',
    title: 'Project Apex',
    autoHideMenuBar: true,
    webPreferences: { ...securePrefs, preload: join(__dirname, 'preload.cjs'), spellcheck: false },
  });
  const wc = mainWindow.webContents;
  wc.setWindowOpenHandler(() => ({ action: 'deny' }));
  wc.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  wc.on('will-redirect', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  wc.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => (mainWindow = null));
  void mainWindow.loadURL(rendererUrl());
}

/** Only our own top-level frame may call privileged handlers. */
function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const frame = event.senderFrame;
  if (!frame || frame !== event.sender.mainFrame || !isAppUrl(frame.url)) {
    throw new Error('Untrusted IPC sender');
  }
}

function handle<T>(channel: string, fn: (...args: unknown[]) => T): void {
  ipcMain.handle(channel, (event, ...args): IpcResult<Awaited<T>> | Promise<IpcResult<Awaited<T>>> => {
    try {
      assertTrustedSender(event);
      const value = fn(...args);
      return { ok: true, value: value as Awaited<T> };
    } catch (err) {
      if (err instanceof SaveError) return { ok: false, code: err.code, message: err.message };
      if (err instanceof z.ZodError) return { ok: false, code: 'invalid_request', message: 'The request was rejected as invalid.' };
      return { ok: false, code: 'internal', message: (err as Error).message };
    }
  });
}

const Slot = z.string().min(1).max(48);

function registerIpc(): void {
  const saves = () => (store ??= new SaveStore(saveDirectoryFor(app.getPath('userData'))));
  ipcMain.handle(IPC.appInfo, (event): AppInfo => {
    assertTrustedSender(event);
    return {
      version: app.getVersion(),
      electron: process.versions.electron ?? '',
      chrome: process.versions.chrome ?? '',
      node: process.versions.node,
      platform: `${process.platform}-${process.arch}`,
      packaged: app.isPackaged,
      // Configured preferences; the renderer independently verifies the effects
      // (no require/process globals) in the Systems Check and e2e suite.
      security: { ...securePrefs },
    };
  });
  handle(IPC.savesList, () => saves().list());
  handle(IPC.savesWrite, (slot, snapshot) => saves().write(Slot.parse(slot), SaveSnapshotSchema.parse(snapshot)));
  handle(IPC.savesRead, (slot) => saves().read(Slot.parse(slot)));
  handle(IPC.savesRemove, (slot) => {
    saves().delete(Slot.parse(slot));
    return null;
  });
  ipcMain.handle(IPC.quit, (event) => {
    assertTrustedSender(event);
    app.quit();
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  app.on('web-contents-created', (_e, contents) => {
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  });
  void app.whenReady().then(() => {
    hardenSession();
    registerAppProtocol();
    registerIpc();
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
