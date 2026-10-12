/**
 * Save files are self-contained SQLite databases (`*.apexsave`).
 *
 * Guarantees:
 *  - Atomic writes: a complete database is built at `<file>.tmp`, integrity-checked
 *    and fsynced, the previous save is kept as `<file>.bak`, then the temp file is
 *    renamed over the target. A crash mid-save never corrupts the last good save.
 *  - Explicit versions: schema version, simulation version and world seed live
 *    in `save_meta`. Older schemas are migrated forward on load (after a backup);
 *    newer schemas are refused rather than silently misread.
 *  - Integrity: a content fingerprint of the stored payload is verified on load.
 *  - The financial ledger is append-only (UPDATE/DELETE are rejected by triggers).
 *
 * Runs only in trusted Node contexts (Electron main process, tests, CLI tools).
 * The renderer never sees SQL or file paths.
 */
import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { LedgerEntrySchema, SaveSnapshotSchema, type LedgerEntry, type SaveSnapshot, type SaveSummary } from '../shared/saveTypes';
import { canonicalJson, fingerprint } from '../core/util/hash';

export { LedgerEntrySchema, SaveSnapshotSchema };
export type { LedgerEntry, SaveSnapshot, SaveSummary };

export const SAVE_SCHEMA_VERSION = 1;
export const SAVE_EXTENSION = '.apexsave';

interface Migration {
  readonly version: number;
  readonly sql: string;
}

/** Ordered, append-only list. Never edit a published migration; add a new one. */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE save_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE world_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL);
      CREATE TABLE ledger (
        id TEXT PRIMARY KEY,
        seq INTEGER NOT NULL UNIQUE,
        club_id TEXT NOT NULL,
        amount INTEGER NOT NULL,
        category TEXT NOT NULL,
        memo TEXT NOT NULL,
        game_date TEXT NOT NULL,
        source_event TEXT NOT NULL
      );
      CREATE INDEX ledger_club ON ledger (club_id, seq);
      CREATE TRIGGER ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
      CREATE TRIGGER ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT, 'ledger is append-only'); END;
    `,
  },
];

export class SaveError extends Error {
  constructor(
    readonly code: 'invalid_slot' | 'not_found' | 'corrupt' | 'newer_schema' | 'integrity_mismatch' | 'invalid_data',
    message: string,
  ) {
    super(message);
    this.name = 'SaveError';
  }
}

const SLOT_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;

export function assertSlot(slot: string): void {
  if (!SLOT_RE.test(slot)) throw new SaveError('invalid_slot', `Invalid save slot name "${slot}"`);
}

function migrate(db: DatabaseSync, from: number): number {
  let version = from;
  for (const m of MIGRATIONS) {
    if (m.version <= version) continue;
    db.exec('BEGIN');
    try {
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${m.version}`);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    version = m.version;
  }
  return version;
}

function fsyncFile(path: string): void {
  const fd = openSync(path, 'r+');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function payloadFingerprint(world: unknown, ledger: readonly LedgerEntry[]): string {
  return fingerprint({ world, ledger });
}

export class SaveStore {
  constructor(readonly directory: string) {
    mkdirSync(directory, { recursive: true });
  }

  pathFor(slot: string): string {
    assertSlot(slot);
    return join(this.directory, `${slot}${SAVE_EXTENSION}`);
  }

  write(slot: string, input: SaveSnapshot, now: Date = new Date()): SaveSummary {
    const snapshot = SaveSnapshotSchema.parse(input);
    const target = this.pathFor(slot);
    const tmp = `${target}.tmp`;
    rmSync(tmp, { force: true });

    const db = new DatabaseSync(tmp);
    try {
      db.exec('PRAGMA journal_mode = DELETE');
      migrate(db, 0);
      db.exec('BEGIN');
      const meta = db.prepare('INSERT INTO save_meta (key, value) VALUES (?, ?)');
      const createdAt = existsSync(target) ? (this.tryReadMeta(target)?.created_at ?? now.toISOString()) : now.toISOString();
      const metaRows: Record<string, string> = {
        schema_version: String(SAVE_SCHEMA_VERSION),
        simulation_version: snapshot.simulationVersion,
        world_seed: snapshot.worldSeed,
        name: snapshot.name,
        created_at: createdAt,
        updated_at: now.toISOString(),
        integrity: payloadFingerprint(snapshot.world, snapshot.ledger),
      };
      for (const [k, v] of Object.entries(metaRows)) meta.run(k, v);
      db.prepare('INSERT INTO world_state (id, payload) VALUES (1, ?)').run(canonicalJson(snapshot.world));
      const ins = db.prepare(
        'INSERT INTO ledger (id, seq, club_id, amount, category, memo, game_date, source_event) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      );
      for (const e of snapshot.ledger) ins.run(e.id, e.seq, e.clubId, e.amount, e.category, e.memo, e.gameDate, e.sourceEvent);
      db.exec('COMMIT');
      const check = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      if (check.integrity_check !== 'ok') throw new SaveError('corrupt', `Integrity check failed: ${check.integrity_check}`);
    } finally {
      db.close();
    }
    fsyncFile(tmp);
    if (existsSync(target)) copyFileSync(target, `${target}.bak`);
    renameSync(tmp, target);
    return this.summary(slot);
  }

  read(slot: string): SaveSnapshot {
    const path = this.pathFor(slot);
    if (!existsSync(path)) throw new SaveError('not_found', `No save named "${slot}"`);
    let db: DatabaseSync;
    try {
      db = new DatabaseSync(path);
    } catch (err) {
      throw new SaveError('corrupt', `Save "${slot}" could not be opened: ${(err as Error).message}`);
    }
    try {
      let version: number;
      try {
        const check = db.prepare('PRAGMA quick_check').get() as { quick_check: string };
        if (check.quick_check !== 'ok') throw new Error(check.quick_check);
        version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
      } catch (err) {
        throw new SaveError('corrupt', `Save "${slot}" is damaged: ${(err as Error).message}`);
      }
      if (version > SAVE_SCHEMA_VERSION) {
        throw new SaveError('newer_schema', `Save "${slot}" was made by a newer version of the game (schema ${version}).`);
      }
      if (version < SAVE_SCHEMA_VERSION) {
        db.close();
        copyFileSync(path, `${path}.pre-migration-v${version}`);
        db = new DatabaseSync(path);
        migrate(db, version);
      }
      const metaRows = db.prepare('SELECT key, value FROM save_meta').all() as { key: string; value: string }[];
      const meta = Object.fromEntries(metaRows.map((r) => [r.key, r.value]));
      const worldRow = db.prepare('SELECT payload FROM world_state WHERE id = 1').get() as { payload: string } | undefined;
      if (!worldRow) throw new SaveError('corrupt', `Save "${slot}" has no world state`);
      const ledgerRows = db
        .prepare('SELECT id, seq, club_id, amount, category, memo, game_date, source_event FROM ledger ORDER BY seq')
        .all() as { id: string; seq: number; club_id: string; amount: number; category: string; memo: string; game_date: string; source_event: string }[];
      const ledger = ledgerRows.map((r) => ({
        id: r.id, seq: r.seq, clubId: r.club_id, amount: r.amount, category: r.category, memo: r.memo, gameDate: r.game_date, sourceEvent: r.source_event,
      }));
      const world = JSON.parse(worldRow.payload) as Record<string, unknown>;
      if (meta.integrity !== payloadFingerprint(world, ledger)) {
        throw new SaveError('integrity_mismatch', `Save "${slot}" failed its integrity check; it may have been edited or damaged.`);
      }
      const parsed = SaveSnapshotSchema.safeParse({
        name: meta.name, worldSeed: meta.world_seed, simulationVersion: meta.simulation_version, world, ledger,
      });
      if (!parsed.success) throw new SaveError('invalid_data', `Save "${slot}" contains invalid data`);
      return parsed.data;
    } finally {
      db.close();
    }
  }

  /** Restores `<slot>.bak` over the main file (used when the main file is damaged). */
  restoreBackup(slot: string): boolean {
    const path = this.pathFor(slot);
    if (!existsSync(`${path}.bak`)) return false;
    copyFileSync(`${path}.bak`, path);
    return true;
  }

  delete(slot: string): void {
    const path = this.pathFor(slot);
    for (const p of [path, `${path}.bak`, `${path}.tmp`]) rmSync(p, { force: true });
  }

  list(): SaveSummary[] {
    return readdirSync(this.directory)
      .filter((f) => f.endsWith(SAVE_EXTENSION))
      .map((f) => basename(f, SAVE_EXTENSION))
      .filter((slot) => SLOT_RE.test(slot))
      .flatMap((slot) => {
        try {
          return [this.summary(slot)];
        } catch {
          return [];
        }
      })
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  summary(slot: string): SaveSummary {
    const path = this.pathFor(slot);
    const meta = this.tryReadMeta(path);
    if (!meta) throw new SaveError('corrupt', `Save "${slot}" is unreadable`);
    return {
      slot,
      name: meta.name ?? slot,
      worldSeed: meta.world_seed ?? '',
      simulationVersion: meta.simulation_version ?? '',
      schemaVersion: Number(meta.schema_version ?? 0),
      updatedAt: meta.updated_at ?? '',
      sizeBytes: statSync(path).size,
    };
  }

  private tryReadMeta(path: string): Record<string, string> | null {
    try {
      const db = new DatabaseSync(path, { readOnly: true });
      try {
        const rows = db.prepare('SELECT key, value FROM save_meta').all() as { key: string; value: string }[];
        return Object.fromEntries(rows.map((r) => [r.key, r.value]));
      } finally {
        db.close();
      }
    } catch {
      return null;
    }
  }
}

export const saveDirectoryFor = (userDataDir: string): string => join(userDataDir, 'saves');
