// First-kill duel micro-analysis using shot traces.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const N = Number(process.argv[2] ?? 16);
type Shot = { t: number; shooter: string; target: string; p: number; cover: boolean; dist: number; weapon: string; moving: boolean; blind: boolean; burst: number };
const vstat: Record<string, number> = {};
const agg: Record<string, { n: number; firstShotKiller: number; kShots: number; vShots: number; kP: number; vP: number; dist: number; kCover: number; vCover: number }> = {};
for (let i = 0; i < N; i++) {
  let shots: Shot[] = [];
  let done = false;
  let lastT = 1e9;
  simulateMap({
    matchId: 'd', mapIndex: 0, seed: `sh-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('ta', 60, `r${i % 25}`), syntheticTeam('tb', 60, `r${i % 25}`)], firstAttacker: (i % 2) as 0 | 1,
    trace: (kind, d) => {
      const t = d.t as number;
      if (t < lastT - 1000) { shots = []; done = false; }
      lastT = t;
      if (kind === 'shot') shots.push(d as unknown as Shot);
      if (kind !== 'kill' || done) return;
      done = true;
      const a = d.attacker as { id: string; side: string; weapon: string };
      const v = d.victim as { id: string; side: string; weapon: string };
      const ks = shots.filter((s) => s.shooter === a.id && s.target === v.id);
      const vs = shots.filter((s) => s.shooter === v.id && s.target === a.id);
      for (const [who, list] of [['killer', ks], ['victim', vs]] as const) for (const s of list) { const kk = `${a.side}-kill ${who} shot: moving=${s.moving} blind=${s.blind} burst>5=${s.burst > 5}`; vstat[kk] = (vstat[kk] ?? 0) + 1; }
      const key = `${a.side} kills (${a.weapon} vs ${v.weapon})`;
      const key2 = `${a.side} kills`;
      for (const k of [key, key2]) {
        const g = (agg[k] ??= { n: 0, firstShotKiller: 0, kShots: 0, vShots: 0, kP: 0, vP: 0, dist: 0, kCover: 0, vCover: 0 });
        g.n++;
        if (ks.length && (!vs.length || ks[0]!.t <= vs[0]!.t)) g.firstShotKiller++;
        g.kShots += ks.length; g.vShots += vs.length;
        g.kP += ks.length ? ks.reduce((s, x) => s + x.p, 0) / ks.length : 0;
        g.vP += vs.length ? vs.reduce((s, x) => s + x.p, 0) / vs.length : 0;
        g.dist += ks[0]?.dist ?? 0;
        g.kCover += ks.some((s) => s.cover) ? 1 : 0; g.vCover += vs.some((s) => s.cover) ? 1 : 0;
      }
    },
  });
}
for (const [k, g] of Object.entries(agg).sort((x, y) => y[1].n - x[1].n).slice(0, 16))
  console.log(k.padEnd(44), 'n', g.n, 'killerFirst', (g.firstShotKiller / g.n).toFixed(2), 'shots k/v', (g.kShots / g.n).toFixed(1), (g.vShots / g.n).toFixed(1), 'p k/v', (g.kP / g.n).toFixed(2), (g.vP / g.n).toFixed(2), 'dist', (g.dist / g.n).toFixed(0), 'coverOnVictim', (g.kCover / g.n).toFixed(2));

for (const [k, v] of Object.entries(vstat).sort()) console.log(v, k);
