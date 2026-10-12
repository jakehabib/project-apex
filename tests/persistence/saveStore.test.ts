import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';
import { SAVE_SCHEMA_VERSION, SaveError, SaveStore, type SaveSnapshot } from '../../src/persistence/saveStore';

const sample = (cash = 250000): SaveSnapshot => ({
  name: 'Harbor Hawks Career',
  worldSeed: 'world-42',
  simulationVersion: 'apex-proof/1',
  world: { gameDate: '2027-01-08', userClubId: 'club_hawks', clubs: [{ id: 'club_hawks', openingCash: cash }], lineup: ['p1', 'p2', 'p3', 'p4', 'p5'] },
  ledger: [
    { id: 'tx_1', seq: 1, clubId: 'club_hawks', amount: -42000, category: 'wages', memo: 'January payroll', gameDate: '2027-01-01', sourceEvent: 'payroll_2027_01' },
    { id: 'tx_2', seq: 2, clubId: 'club_hawks', amount: 15000, category: 'prize', memo: 'Qualifier prize', gameDate: '2027-01-07', sourceEvent: 'event_q1' },
  ],
});

describe('SaveStore', () => {
  let dir: string;
  let store: SaveStore;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'apex-saves-'));
    store = new SaveStore(dir);
  });

  it('round-trips a snapshot exactly', () => {
    const s = sample();
    store.write('career-1', s);
    expect(store.read('career-1')).toEqual(s);
  });

  it('survives a fresh process-equivalent: new store instance reads identical data', () => {
    store.write('career-1', sample());
    const reopened = new SaveStore(dir);
    expect(reopened.read('career-1')).toEqual(sample());
    expect(reopened.list().map((x) => x.slot)).toEqual(['career-1']);
  });

  it('records schema/simulation version and seed in the summary', () => {
    const summary = store.write('career-1', sample());
    expect(summary.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(summary.simulationVersion).toBe('apex-proof/1');
    expect(summary.worldSeed).toBe('world-42');
    expect(summary.sizeBytes).toBeGreaterThan(0);
  });

  it('keeps the previous save as .bak and leaves no temp file', () => {
    store.write('career-1', sample(100));
    store.write('career-1', sample(200));
    const path = store.pathFor('career-1');
    expect(existsSync(`${path}.bak`)).toBe(true);
    expect(existsSync(`${path}.tmp`)).toBe(false);
    expect(store.read('career-1').world).toMatchObject({ clubs: [{ openingCash: 200 }] });
    store.restoreBackup('career-1');
    expect(store.read('career-1').world).toMatchObject({ clubs: [{ openingCash: 100 }] });
  });

  it('a crash before rename (stale .tmp) never affects the last good save', () => {
    store.write('career-1', sample(100));
    writeFileSync(`${store.pathFor('career-1')}.tmp`, 'half-written garbage');
    expect(store.read('career-1').world).toMatchObject({ clubs: [{ openingCash: 100 }] });
    store.write('career-1', sample(300));
    expect(store.read('career-1').world).toMatchObject({ clubs: [{ openingCash: 300 }] });
  });

  it('detects a corrupted file', () => {
    store.write('career-1', sample());
    const path = store.pathFor('career-1');
    const bytes = readFileSync(path);
    bytes.fill(0x41, 0, 100);
    writeFileSync(path, bytes);
    expect(() => store.read('career-1')).toThrow(SaveError);
  });

  it('detects out-of-band edits through the integrity fingerprint', () => {
    store.write('career-1', sample());
    const db = new DatabaseSync(store.pathFor('career-1'));
    db.exec(`UPDATE world_state SET payload = replace(payload, '250000', '999999999')`);
    db.close();
    expect(() => store.read('career-1')).toThrow(/integrity/);
  });

  it('enforces an append-only ledger at the database level', () => {
    store.write('career-1', sample());
    const db = new DatabaseSync(store.pathFor('career-1'));
    expect(() => db.exec(`UPDATE ledger SET amount = 0`)).toThrow(/append-only/);
    expect(() => db.exec(`DELETE FROM ledger`)).toThrow(/append-only/);
    db.close();
  });

  it('refuses saves from a newer schema', () => {
    store.write('career-1', sample());
    const db = new DatabaseSync(store.pathFor('career-1'));
    db.exec(`PRAGMA user_version = ${SAVE_SCHEMA_VERSION + 1}`);
    db.close();
    expect(() => store.read('career-1')).toThrow(/newer version/);
  });

  it('rejects path traversal and malformed slot names', () => {
    for (const bad of ['../evil', 'a/b', '', 'UPPER', '.hidden', 'x'.repeat(60), 'c:\\win']) {
      expect(() => store.pathFor(bad)).toThrow(SaveError);
    }
  });

  it('rejects invalid snapshots before touching disk', () => {
    const bad = { ...sample(), ledger: [{ ...sample().ledger[0]!, amount: 1.5 }] };
    expect(() => store.write('career-1', bad)).toThrow();
    expect(existsSync(store.pathFor('career-1'))).toBe(false);
  });

  it('lists only valid saves, newest first, and deletes cleanly', () => {
    store.write('a-save', sample(), new Date('2027-01-01T00:00:00Z'));
    store.write('b-save', sample(), new Date('2027-02-01T00:00:00Z'));
    writeFileSync(join(dir, 'junk.apexsave'), 'not sqlite');
    expect(store.list().map((s) => s.slot)).toEqual(['b-save', 'a-save']);
    store.delete('a-save');
    expect(store.list().map((s) => s.slot)).toEqual(['b-save']);
  });
});
