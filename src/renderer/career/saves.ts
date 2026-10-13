/**
 * Browser save store (IndexedDB). Each slot holds the gzip-compressed career with a SHA-256
 * checksum of the uncompressed text, plus the previous save as a backup: a damaged or interrupted
 * save falls back to the backup instead of losing the career. Works in workers and in Electron.
 */
import type { CareerSummary } from '../../core/career/career';

const DB = 'apex-saves';
const STORE = 'careers';

export interface SaveMeta extends CareerSummary {
  readonly slot: string;
  readonly savedAt: number;
  readonly version: number;
  readonly bytes: number;
}

interface Packed {
  readonly checksum: string;
  readonly data: Blob;
}

interface SaveRecord {
  readonly slot: string;
  readonly meta: SaveMeta;
  readonly current: Packed;
  readonly backup: Packed | null;
}

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'slot' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open the save database'));
  });
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const r = run(t.objectStore(STORE));
        t.oncomplete = () => resolve(r.result);
        t.onerror = () => reject(t.error ?? new Error('Save database error'));
        t.onabort = () => reject(t.error ?? new Error('Save aborted (storage full?)'));
      }),
  );
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const gzip = (text: string): Promise<Blob> => new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).blob();
export const gunzip = (data: Blob): Promise<string> => new Response(data.stream().pipeThrough(new DecompressionStream('gzip'))).text();

async function unpack(p: Packed): Promise<string> {
  const text = await gunzip(p.data);
  if ((await sha256(text)) !== p.checksum) throw new Error('checksum mismatch');
  return text;
}

export async function listSaves(): Promise<SaveMeta[]> {
  const all = await tx<SaveRecord[]>('readonly', (s) => s.getAll() as IDBRequest<SaveRecord[]>);
  return all.map((r) => r.meta).sort((a, b) => b.savedAt - a.savedAt);
}

export async function writeSave(slot: string, text: string, summary: CareerSummary, version: number, savedAt: number): Promise<SaveMeta> {
  const prev = await tx<SaveRecord | undefined>('readonly', (s) => s.get(slot) as IDBRequest<SaveRecord | undefined>);
  const current: Packed = { checksum: await sha256(text), data: await gzip(text) };
  const meta: SaveMeta = { ...summary, slot, savedAt, version, bytes: current.data.size };
  const rec: SaveRecord = { slot, meta, current, backup: prev?.current ?? null };
  await tx('readwrite', (s) => s.put(rec));
  return meta;
}

/** Reads a slot; falls back to the backup when the current save is damaged. */
export async function readSave(slot: string): Promise<{ text: string; restoredFromBackup: boolean }> {
  const rec = await tx<SaveRecord | undefined>('readonly', (s) => s.get(slot) as IDBRequest<SaveRecord | undefined>);
  if (!rec) throw new Error('Save not found');
  try {
    return { text: await unpack(rec.current), restoredFromBackup: false };
  } catch (e) {
    if (!rec.backup) throw new Error(`The save is damaged (${(e as Error).message}) and has no backup`);
    return { text: await unpack(rec.backup), restoredFromBackup: true };
  }
}

export const deleteSave = (slot: string): Promise<undefined> => tx('readwrite', (s) => s.delete(slot) as IDBRequest<undefined>);

/** Export file: gzip of the career text (portable between browser and desktop builds). */
export async function exportSave(slot: string): Promise<Blob> {
  const { text } = await readSave(slot);
  return gzip(text);
}
