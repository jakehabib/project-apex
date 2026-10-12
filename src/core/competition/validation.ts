/**
 * Ecosystem validation: checks the ARP brief's requirements against a simulated
 * history and produces a readable Markdown report. Used by `npm run sim:career`
 * (20+ seasons) and by unit tests (short runs).
 */
import { formatDate, toParts } from '../world/calendar';
import { teamStrength } from '../world/evolution';
import type { Region } from '../world/types';
import { computeStandings } from './arp';
import { liveStandings, type Ecosystem } from './ecosystem';
import { addSeries } from './records';

export interface Check {
  readonly id: string;
  readonly label: string;
  readonly pass: boolean;
  readonly detail: string;
}

const spearman = (pairs: [number, number][]): number => {
  const rank = (xs: number[]) => {
    const idx = xs.map((x, i) => [x, i] as const).sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(xs.length);
    idx.forEach(([, i], k) => (r[i] = k + 1));
    return r;
  };
  const a = rank(pairs.map((p) => p[0]));
  const b = rank(pairs.map((p) => p[1]));
  const n = pairs.length;
  const d2 = a.reduce((s, x, i) => s + (x - b[i]!) ** 2, 0);
  return n < 3 ? 0 : 1 - (6 * d2) / (n * (n * n - 1));
};

export function validate(eco: Ecosystem, history: SeasonSample[]): Check[] {
  const checks: Check[] = [];
  const add = (id: string, label: string, pass: boolean, detail: string) => checks.push({ id, label, pass, detail });
  const ev = (id: string) => eco.events.get(id)!;

  // 1. Invitations follow the frozen snapshot: every accepted invite's rank matches that snapshot,
  //    and nobody eligible ranked inside the window was passed over without a recorded reason.
  let mismatches = 0;
  let passedOver = 0;
  let checked = 0;
  for (const inv of eco.invitations) {
    if (inv.snapshotDay === null) continue;
    const snap = eco.snapshots.find((s) => s.day === inv.snapshotDay);
    const s = snap?.standings.find((x) => x.lineageId === inv.lineageId);
    const rank = s ? (inv.list === 'global' ? s.globalRank : s.regionalRank) : -1;
    checked++;
    if (rank !== inv.rank) mismatches++;
  }
  for (const e of eco.events.values()) {
    if (!e.cutoffDay || e.invites.length === 0) continue;
    const snap = eco.snapshots.find((s) => s.day === e.cutoffDay);
    if (!snap) continue;
    for (const rule of e.invites) {
      const invited = eco.invitations.filter((i) => i.eventId === e.id && i.list === rule.list && i.status !== 'declined');
      const worst = Math.max(0, ...invited.map((i) => i.rank));
      const list = rule.list === 'global' ? snap.standings : snap.standings.filter((x) => x.region === rule.list);
      for (const s of list) {
        const r = rule.list === 'global' ? s.globalRank : s.regionalRank;
        if (r < rule.fromRank || r > worst) continue;
        const handled = eco.invitations.some((i) => i.eventId === e.id && i.lineageId === s.lineageId) || eco.skips.some((k) => k.eventId === e.id && k.lineageId === s.lineageId);
        if (!handled) passedOver++;
      }
    }
  }
  add('frozen-snapshots', 'Invitations follow frozen snapshots in rank order', mismatches === 0 && passedOver === 0, `${checked} invitations checked against their cutoff snapshot; ${mismatches} rank mismatches; ${passedOver} eligible teams passed over without a recorded reason.`);

  // 2. Ineligible teams are skipped with reasons.
  const reasons = new Map<string, number>();
  for (const k of eco.skips) {
    const key = k.reason.replace(/\(.*\)/, '').replace(/ in the .* region/, ' in the event region').trim();
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }
  add('skips', 'Ineligible or declining teams are skipped with a reason', eco.skips.every((k) => k.reason.length > 0), [...reasons].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${n}× ${r}`).join('; ') || 'no skips');

  // 3. Regional invitations use the right list (roster region at cutoff matches the list).
  const wrongRegion = eco.invitations.filter((i) => i.list !== 'global' && i.region !== i.list).length;
  add('regional-lists', 'Regional invitations use the correct regional list', wrongRegion === 0, `${eco.invitations.filter((i) => i.list !== 'global').length} regional invitations; ${wrongRegion} issued to rosters outside the list's region.`);

  // 4. Qualified underdogs reach main stages (and sometimes go deep).
  let qualEntries = 0;
  let deepRuns = 0;
  let qualWins = 0;
  for (const [eid, entries] of eco.entries) {
    const e = ev(eid);
    if (e.feeds || (e.tier !== 1 && e.tier !== 'championship')) continue;
    const res = eco.results.get(eid);
    if (!res) continue;
    for (const en of entries.filter((x) => x.via === 'qualifier')) {
      qualEntries++;
      const pl = res.placements.find((p) => p.entrant.orgId === en.orgId);
      if (pl && pl.place <= 8) deepRuns++;
      if (pl && pl.place === 1) qualWins++;
    }
  }
  add('underdogs', 'Qualified teams compete in Tier 1 / Championship main stages', qualEntries > 0 && deepRuns > 0, `${qualEntries} qualifier places used in Tier 1 and Championship events; ${deepRuns} reached the top 8; ${qualWins} won the event.`);

  // 5. Roster continuity: replacing 3 core players ends a lineage; voided places recorded.
  const ended = [...eco.reg.lineages.values()].filter((l) => l.history.some((h) => h.note.startsWith('Lost continuity'))).length;
  const moved = [...eco.reg.lineages.values()].filter((l) => l.history.some((h) => h.note.startsWith('Core moved'))).length;
  const voids = eco.invitations.filter((i) => i.status === 'void').length;
  // Duplicate-history guard: no two active lineages share ≥3 players.
  const active = [...eco.reg.lineages.values()].filter((l) => l.endedDay === null);
  let dupes = 0;
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) if (active[i]!.core.filter((p) => active[j]!.core.includes(p)).length >= 3) dupes++;
  add('continuity', 'Replacing three core players ends ranking continuity; no duplicate histories', ended > 0 && dupes === 0, `${ended} lineages ended by losing continuity; ${moved} cores moved clubs and kept their ranking; ${voids} event places voided by roster changes; ${dupes} duplicate active histories.`);

  // 6. Duplicate records add nothing.
  const asOf = eco.world.day;
  const before = liveStandings(eco, asOf).map((s) => `${s.lineageId}:${s.arp}`).join(',');
  const sample = [...eco.store.series.values()].slice(0, 200);
  let accepted = 0;
  for (const r of sample) if (addSeries(eco.store, r)) accepted++;
  const after = liveStandings(eco, asOf).map((s) => `${s.lineageId}:${s.arp}`).join(',');
  add('no-duplicates', 'Re-ingesting results creates no points', accepted === 0 && before === after, `Re-submitted ${sample.length} existing series: ${accepted} accepted; standings ${before === after ? 'unchanged' : 'CHANGED'}.`);

  // 7. Unranked exhibitions don't count.
  const fake = sample[0];
  if (fake) {
    const store = { series: new Map(eco.store.series), prizes: eco.store.prizes };
    for (let k = 0; k < 50; k++) store.series.set(`exhibition-${k}`, { ...fake, id: `exhibition-${k}`, ranked: false, day: asOf });
    const info = { active: (id: string) => eco.reg.lineages.get(id)?.endedDay === null, orgOf: (id: string) => eco.reg.lineages.get(id)?.orgId ?? '', regionOf: () => 'EU' as Region };
    const a = computeStandings(eco.store, asOf, info).map((s) => s.arp).join(',');
    const b = computeStandings(store, asOf, info).map((s) => s.arp).join(',');
    add('exhibitions', 'Unranked exhibition matches never count', a === b, `Injected 50 unranked exhibition wins: standings ${a === b ? 'unchanged' : 'CHANGED'}.`);
  }

  // 8. Strong teams rise; weak teams fall (rank tracks roster strength each season).
  const rhos = history.map((h) => h.spearman);
  const meanRho = rhos.reduce((s, x) => s + x, 0) / Math.max(1, rhos.length);
  add('strength-tracks-rank', 'Strong teams rise and weak teams fall', meanRho > 0.75, `Mean Spearman correlation between roster strength and ARP rank across ${rhos.length} season-end samples: ${meanRho.toFixed(3)} (min ${Math.min(...rhos).toFixed(3)}).`);

  // 9. New / low-ranked clubs can reach elite events.
  const climbers = history.length ? climbersFrom(eco) : [];
  add('climbers', 'Unranked or low-ranked clubs can reach elite events', climbers.length > 0, `${climbers.length} clubs ranked outside the top 60 (or unranked) at some season start later played a Tier 1 or Championship main event. Examples: ${climbers.slice(0, 5).join('; ') || 'none'}.`);

  // 10. AI behaviour: elite clubs avoid Tier 3; developing clubs use qualifiers.
  const t3 = [...eco.entries].filter(([id]) => ev(id).tier === 3 && !ev(id).feeds).flatMap(([, es]) => es);
  const t3Top = t3.filter((e) => (e.seedRank ?? 999) <= 12).length;
  const qualEntrants = [...eco.entries].filter(([id]) => !!ev(id).feeds).flatMap(([, es]) => es);
  const qualTop = qualEntrants.filter((e) => (e.seedRank ?? 999) <= 12).length;
  add('ai-behaviour', 'AI clubs choose events sensibly', t3Top / Math.max(1, t3.length) < 0.05, `Top-12 teams made up ${(100 * t3Top / Math.max(1, t3.length)).toFixed(1)}% of Tier 3 entries and ${(100 * qualTop / Math.max(1, qualEntrants.length)).toFixed(1)}% of qualifier entries; ${eco.invitations.filter((i) => i.status === 'declined').length} invitations declined (conflicts, priorities, travel budget).`);

  // 11. Long-run coherence: ranking sizes, ARP spread and skill level stay stable.
  const first = history[0];
  const last = history[history.length - 1];
  const stable = !!first && !!last && Math.abs(last.avgSkill - first.avgSkill) < 4 && last.ranked > 60 && last.top1 < 2100;
  add('coherence', `Rankings stay coherent over ${history.length} seasons`, stable, first && last ? `Ranked teams ${first.ranked} → ${last.ranked}; #1 ARP ${first.top1} → ${last.top1}; #10 ${first.top10} → ${last.top10}; #50 ${first.top50} → ${last.top50}; average contracted skill ${first.avgSkill.toFixed(1)} → ${last.avgSkill.toFixed(1)}.` : 'no history');

  // 12. Inactive teams fall out (no permanent elite rank without competing): verified by design + a probe.
  const listed = liveStandings(eco, asOf).length;
  const later = liveStandings(eco, asOf + 200).length;
  add('inactivity', 'Teams that stop competing drop out of the rankings', later === 0, `${listed} teams listed today; if nobody played for 200 days, ${later} would remain listed.`);
  return checks;
}

function climbersFrom(eco: Ecosystem): string[] {
  const out: string[] = [];
  // From season 2 on: by then every club has had a full year to establish a ranking.
  const seasonsStarts = eco.snapshots.filter((s) => toParts(s.day).month === 0 && toParts(s.day).season >= 2);
  for (const snap of seasonsStarts) {
    for (const org of eco.world.orgs.values()) {
      const lid = eco.reg.activeByOrg.get(org.id);
      const s = snap.standings.find((x) => x.orgId === org.id);
      if (s && s.globalRank <= 60) continue;
      // Did this org later play a Tier 1 / Championship main event?
      const later = [...eco.results.values()].find((r) => {
        const e = eco.events.get(r.eventId)!;
        return !e.feeds && (e.tier === 1 || e.tier === 'championship') && e.startDay > snap.day && r.placements.some((p) => p.entrant.orgId === org.id);
      });
      if (later && !out.some((x) => x.startsWith(org.name))) out.push(`${org.name} (${s ? `#${s.globalRank}` : 'unranked'} in ${snap.label} → ${eco.events.get(later.eventId)!.name}, ${formatDate(eco.events.get(later.eventId)!.startDay)})`);
      void lid;
    }
  }
  return out;
}

export interface SeasonSample {
  readonly season: number;
  readonly ranked: number;
  readonly top1: number;
  readonly top10: number;
  readonly top50: number;
  readonly spearman: number;
  readonly avgSkill: number;
  readonly regionTop20: Record<Region, number>;
  readonly champions: string[];
}

export function sampleSeason(eco: Ecosystem, season: number): SeasonSample {
  const st = liveStandings(eco, eco.world.day);
  const w = eco.world;
  const orgs = [...w.orgs.values()].filter((o) => o.roster.length === 5);
  const pairs: [number, number][] = orgs.map((o) => [-teamStrength(w, o), st.find((s) => s.orgId === o.id)?.globalRank ?? 999]);
  const contracted = [...w.players.values()].filter((p) => p.orgId && !p.retired);
  const regionTop20: Record<Region, number> = { EU: 0, AM: 0, AS: 0 };
  for (const s of st.slice(0, 20)) regionTop20[s.region]++;
  const champions = [...eco.results.values()]
    .filter((r) => eco.events.get(r.eventId)!.tier === 'championship' && !eco.events.get(r.eventId)!.feeds && eco.events.get(r.eventId)!.season === season)
    .map((r) => `${eco.events.get(r.eventId)!.name}: ${w.orgs.get(r.placements[0]!.entrant.orgId)!.name}`);
  return {
    season, ranked: st.length, top1: st[0]?.arp ?? 0, top10: st[9]?.arp ?? 0, top50: st[49]?.arp ?? 0, spearman: spearman(pairs),
    avgSkill: contracted.reduce((s, p) => s + p.skill, 0) / Math.max(1, contracted.length), regionTop20, champions,
  };
}

export function reportMarkdown(seed: string, checks: Check[], history: SeasonSample[], eco: Ecosystem, seconds: number): string {
  const lines: string[] = [];
  lines.push(`# ARP ecosystem validation report`, ``, `Seed \`${seed}\` · ${history.length} seasons · ${eco.store.series.size.toLocaleString('en-US')} ranked series · ${eco.results.size} events · ${eco.snapshots.length} monthly snapshots · ${seconds.toFixed(1)} s`, ``);
  lines.push(`Series resolved by the **validation-only strength resolver** (tests ecosystem mechanics, not match realism).`, ``);
  lines.push(`## Checks`, ``, `| Result | Check | Detail |`, `|---|---|---|`);
  for (const c of checks) lines.push(`| ${c.pass ? '✅' : '❌'} | ${c.label} | ${c.detail} |`);
  lines.push(``, `## Season by season`, ``, `| Season | Ranked | #1 ARP | #10 | #50 | Strength↔rank ρ | Avg skill | Top-20 EU/AM/AS | World Champions |`, `|---|---|---|---|---|---|---|---|---|`);
  for (const h of history) lines.push(`| ${h.season} | ${h.ranked} | ${h.top1} | ${h.top10} | ${h.top50} | ${h.spearman.toFixed(2)} | ${h.avgSkill.toFixed(1)} | ${h.regionTop20.EU}/${h.regionTop20.AM}/${h.regionTop20.AS} | ${h.champions.map((c) => c.split(': ')[1]).join(', ')} |`);
  const st = liveStandings(eco, eco.world.day);
  lines.push(``, `## Final world ranking (top 20)`, ``, `| # | Team | Region | ARP | W–L | Seed | H2H |`, `|---|---|---|---|---|---|---|`);
  for (const s of st.slice(0, 20)) lines.push(`| ${s.globalRank} | ${eco.world.orgs.get(s.orgId)!.name} | ${s.region} #${s.regionalRank} | ${s.arp} | ${s.wins}–${s.losses} | ${s.components.seed} | ${s.components.h2h >= 0 ? '+' : ''}${s.components.h2h} |`);
  const viaCount = new Map<string, number>();
  for (const es of eco.entries.values()) for (const e of es) viaCount.set(e.via, (viaCount.get(e.via) ?? 0) + 1);
  lines.push(``, `## Qualification frequency`, ``, ...[...viaCount].map(([k, v]) => `- ${k}: ${v.toLocaleString('en-US')} entries`));
  const reasons = new Map<string, number>();
  for (const m of eco.moves) reasons.set(m.reason.replace(/ \S+ \(.*$| over .*$| veteran .*$| early.*$/, ''), (reasons.get(m.reason.replace(/ \S+ \(.*$| over .*$| veteran .*$| early.*$/, '')) ?? 0) + 1);
  lines.push(``, `## Roster activity`, ``, ...[...reasons].sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`));
  const anomalies = checks.filter((c) => !c.pass);
  lines.push(``, `## Anomalies`, ``, anomalies.length ? anomalies.map((a) => `- **${a.label}:** ${a.detail}`).join('\n') : 'None detected by the automated checks.', ``);
  return lines.join('\n');
}
