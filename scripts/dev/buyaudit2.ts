// Economy audit from post-buy loadouts: per role and money band, what players actually carry into gun rounds.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const c: Record<string, number> = {};
const issues: Record<string, number> = {};
for (let i = 0; i < 16; i++) {
  const teams = [syntheticTeam('a', 60, `r${i}`), syntheticTeam('b', 60, `s${i}`)] as const;
  const roles = new Map(teams.flatMap((t) => t.players.map((p) => [p.id, p.roles[0]!] as const)));
  const r = simulateMap({ matchId: 'b', mapIndex: 0, seed: `ba-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD, teams: [teams[0], teams[1]], firstAttacker: 0 });
  const spent = new Map<string, number>();
  let buyTypes: readonly string[] = [];
  let pendingLoadout: Extract<(typeof r.events)[number], { type: 'loadout' }> | null = null;
  const team = new Map<string, number>();
  for (const e of r.events) {
    if (e.type === 'spawn') team.set(e.playerId, e.team);
    if (e.type === 'buy') spent.set(e.playerId, e.spent);
    if (e.type === 'loadout') pendingLoadout = e;
    if (e.type === 'round_start' && pendingLoadout) {
      buyTypes = e.buyTypes;
      const e2 = pendingLoadout;
      pendingLoadout = null;
      for (const l of e2.loadouts) {
        const before = l.money + (spent.get(l.playerId) ?? 0);
        const role = roles.get(l.playerId)!;
        const gun = l.primary === 'lance' ? 'AWP' : ['kraken', 'sentinel'].includes(l.primary ?? '') ? 'rifle' : ['galeforce', 'ferrum'].includes(l.primary ?? '') ? 'budget rifle' : l.primary ? 'SMG/other' : 'pistol only';
        const armor = l.armor > 0 ? (l.helmet ? 'armor+helmet' : 'armor') : 'no armor';
        // Real-game sanity: a player with a rifle-class primary and money left for armor should have armor.
        if (l.primary && l.armor === 0 && l.money >= 650) issues['has gun, no armor, but could afford armor'] = (issues['has gun, no armor, but could afford armor'] ?? 0) + 1;
        if (role === 'awper' && before >= 6000 && l.primary !== 'lance' && l.money >= 4750) issues['AWPer rich enough for AWP but did not get one'] = (issues['AWPer rich enough for AWP but did not get one'] ?? 0) + 1;
        if (role !== 'awper') continue;
        const band = before >= 6500 ? '$6500+' : before >= 5000 ? '$5000-6499' : before >= 3700 ? '$3700-4999' : '<$3700';
        const k = `${String(buyTypes[team.get(l.playerId)!]).padEnd(6)} ${band.padEnd(11)} ${gun.padEnd(12)} ${armor.padEnd(13)} ${l.utility.length} util`;
        c[k] = (c[k] ?? 0) + 1;
      }
      spent.clear();
    }
  }
}
console.log('issues:', issues);
for (const [k, v] of Object.entries(c).sort()) if (v >= 3) console.log(String(v).padStart(4), k);
