import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const CORE = walk('src/core');

describe('architecture boundaries', () => {
  it('core has no UI, Electron, Node or network dependencies', () => {
    const offenders: string[] = [];
    for (const f of CORE) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        const spec = m[1]!;
        if (!spec.startsWith('.')) offenders.push(`${f}: ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('core never uses ambient randomness or wall-clock time', () => {
    const offenders = CORE.filter((f) => /Math\.random\s*\(|Date\.now\s*\(|new Date\s*\(|performance\.now\s*\(/.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('no prohibited systems sneak into the domain model', () => {
    const banned = /\b(fatigue|stamina|injur(y|ies)|burnout|wear[_ -]?and[_ -]?tear|exhaust(ion|ed))\b/i;
    const offenders = CORE.filter((f) => banned.test(readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
