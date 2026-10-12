// Contract market readout over N seasons: moves by kind, wages by OVR band and region, club finances.
import { readFileSync } from 'node:fs';
import { advanceTo, createEcosystem } from '../../src/core/competition/ecosystem';
import { quickResolver } from '../../src/core/competition/quickResolver';
import { dayOf } from '../../src/core/world/calendar';
import { generateWorld } from '../../src/core/world/generate';
import { ledgerBalance, marketValue, monthlyRevenue, playerPayroll } from '../../src/core/world/contracts';
import { toOvr } from '../../src/core/world/ratings';
const seasons = Number(process.argv[2] ?? 3);
const featured = JSON.parse(readFileSync('src/shared/art/world.json', 'utf8'));
const world = generateWorld({ seed: 'market-1', featured: { teams: featured.teams, players: featured.players } });
const eco = createEcosystem(world, quickResolver(world, 'market-1'), dayOf(0, 0, 1) - 1);
const report = (label: string) => {
  const bands: [string, number, number][] = [['<50', 0, 50], ['50-59', 50, 60], ['60-69', 60, 70], ['70-79', 70, 80], ['80-84', 80, 85], ['85-89', 85, 90], ['90-95', 90, 96], ['96+', 96, 100]];
  console.log(`\n== ${label} (day ${world.day})`);
  const ps = [...world.players.values()].filter((p) => p.contract);
  for (const [n, lo, hi] of bands) {
    const xs = ps.filter((p) => toOvr(p.skill) >= lo && toOvr(p.skill) < hi).map((p) => p.contract!.monthly).sort((a, b) => a - b);
    if (xs.length) console.log(`OVR ${n.padEnd(6)} n=${String(xs.length).padStart(4)}  median $${xs[xs.length >> 1]}  p10 $${xs[Math.floor(xs.length * 0.1)]}  p90 $${xs[Math.floor(xs.length * 0.9)]}`);
  }
  for (const r of ['EU', 'AM', 'AS']) {
    const xs = ps.filter((p) => p.region === r && toOvr(p.skill) >= 80).map((p) => p.contract!.monthly).sort((a, b) => a - b);
    console.log(`${r} OVR80+ median $${xs[xs.length >> 1] ?? 0} (n=${xs.length})`);
  }
  const orgs = [...world.orgs.values()];
  console.log(`clubs in debt: ${orgs.filter((o) => o.money < 0).length}/${orgs.length}; ledger mismatches: ${orgs.filter((o) => ledgerBalance(o) !== o.money).length}; backed: ${orgs.filter((o) => o.finance.backer && o.finance.backer.untilDay > world.day).length}`);
  for (const a of ['elite', 'contender', 'developing', 'grassroots'] as const) {
    const os = orgs.filter((o) => o.archetype === a);
    const avg = (f: (o: (typeof os)[number]) => number) => Math.round(os.reduce((s, o) => s + f(o), 0) / Math.max(1, os.length));
    console.log(`${a.padEnd(10)} n=${os.length} cash $${avg((o) => o.money)} revenue $${avg(monthlyRevenue)}/mo payroll $${avg((o) => playerPayroll(world, o))}/mo roster ${avg((o) => o.roster.length)}`);
  }
  const fa = [...world.players.values()].filter((p) => !p.orgId && !p.retired);
  console.log(`free agents: ${fa.length} (OVR70+: ${fa.filter((p) => toOvr(p.skill) >= 70).length}, OVR80+: ${fa.filter((p) => toOvr(p.skill) >= 80).length}); avg contracted skill ${(ps.reduce((s, p) => s + p.skill, 0) / ps.length).toFixed(1)}`);
  const bargains = ps.filter((p) => marketValue(world, p, world.day, 1).monthly >= 2 * p.contract!.monthly && toOvr(p.potential) >= 85).length;
  console.log(`bargain contracts (value ≥ 2× wage, POT 85+): ${bargains}`);
};
report('start');
for (let s = 0; s < seasons; s++) {
  advanceTo(eco, dayOf(s, 11, 31));
  report(`season ${s + 1}`);
}
const kinds = new Map<string, number>();
for (const m of eco.moves) {
  const k = m.reason.startsWith('Extended') ? 'extension' : m.reason.includes('left on a free') ? 'left on free' : m.reason.includes('expired') ? 'expired' : m.fromOrgId && m.fee > 0 ? 'transfer (fee)' : m.reason.startsWith('Released') ? 'release' : m.reason;
  kinds.set(k, (kinds.get(k) ?? 0) + 1);
}
console.log('\nmoves:', [...kinds].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${v} ${k}`).join(' | '));
const deals = eco.moves.filter((m) => m.deal && m.fee > 0).slice(-4);
for (const d of deals) console.log(`${d.reason}: fee $${d.fee}, ${JSON.stringify(d.deal)}`);
