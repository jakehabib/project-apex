// Economy audit: what AWPers (and everyone) buy by money available on full-buy rounds; no overspending.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const c: Record<string, number> = {};
let negative = 0;
for (let i = 0; i < 16; i++) {
  const teams = [syntheticTeam('a', 60, `r${i}`), syntheticTeam('b', 60, `s${i}`)] as const;
  const roles = new Map(teams.flatMap((t) => t.players.map((p) => [p.id, p.roles[0]!] as const)));
  const r = simulateMap({ matchId: 'b', mapIndex: 0, seed: `ba-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD, teams: [teams[0], teams[1]], firstAttacker: 0 });
  for (const e of r.events) {
    if (e.type !== 'buy') continue;
    if (e.moneyAfter < 0) negative++;
    if (roles.get(e.playerId) !== 'awper') continue;
    const before = e.moneyAfter + e.spent;
    const band = before >= 6500 ? '$6500+' : before >= 5000 ? '$5000-6499' : before >= 3700 ? '$3700-4999' : before >= 2000 ? '$2000-3699' : '<$2000';
    const gun = e.items.includes('lance') ? 'AWP' : e.items.some((x) => ['kraken', 'sentinel'].includes(x)) ? 'rifle' : e.items.some((x) => ['galeforce', 'ferrum'].includes(x)) ? 'budget rifle' : e.items.some((x) => ['mako', 'wasp', 'bastion'].includes(x)) ? 'SMG' : 'no primary';
    const armor = e.items.includes('vest_helmet') ? 'armor+helmet' : e.items.includes('vest') ? 'armor' : 'no armor';
    const util = e.items.filter((x) => ['smoke', 'flash', 'frag', 'cinder', 'ember'].includes(x)).length;
    const k = `${band.padEnd(11)} ${gun.padEnd(12)} ${armor.padEnd(13)} ${util} util`;
    c[k] = (c[k] ?? 0) + 1;
  }
}
console.log('purchases leaving negative money:', negative);
for (const [k, v] of Object.entries(c).sort()) console.log(String(v).padStart(4), k);
