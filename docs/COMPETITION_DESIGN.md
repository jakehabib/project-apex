# Competition ecosystem: APEX Ranking Points, invitations, qualifiers, calendar

This doc is authoritative for `src/core/world` and `src/core/competition`. It implements the owner's ranking brief (2026-10-12).
It is inspired by the *structure* of Valve Regional Standings. It is not Valve's formula, and all branding is original.

## Building blocks

| Concept | Module | Notes |
|---|---|---|
| Calendar dates | `world/calendar.ts` | Integer day numbers from world start, with real month lengths. Snapshots are published on the 1st of each month. |
| Organisation (club) | `world/types.ts` | Brand, home region, money and AI archetype. Ranking is **not** stored on the club. |
| Player | `world/types.ts` | Stable ID, nationality → competitive region, skill, age. |
| Roster lineage | `competition/lineage.ts` | The competitive core that owns ranking history. Continuity needs ≥3 of the 5 core players. Two disjoint 5-player rosters cannot both hold 3 of the same 5, so duplicate histories are impossible by construction (also asserted in tests). |
| Match record | `competition/records.ts` | One immutable record per series: lineage IDs, maps, event, tier, date and ranked flag. Ingest is idempotent by record ID. |
| ARP model | `competition/arp.ts` | Pure function `(records, prizes, asOf, config) → standings`. Recomputed weekly; published monthly as frozen snapshots. |
| Map veto | `competition/veto.ts` | BO1/BO3/BO5 templates over the active pool, decided by seeded team preferences. |
| Formats | `competition/formats.ts` | Single elimination, double elimination, GSL groups, Swiss (Buchholz seeding), round robin. |
| Tournaments | `competition/tournaments.ts` | Config: tier, region scope, dates, cutoff snapshot, invite rules, qualifier slots, format stages, prize distribution. |
| Invitations | `competition/invitations.ts` | Walk a frozen snapshot list in order. Skip ineligible teams with recorded reasons. Every decision has an explanation string. |
| Season runner | `competition/season.ts` | Day loop: publish snapshots, issue invites at cutoffs, run qualifiers and events, AI decisions, roster windows. |

## ARP model (v1, configurable in `ARP_CONFIG`)

All inputs are results inside a **rolling 180-day window**. Recency weight is 1.0 for the latest 30 days, falling linearly to 0 at 180 days.

1. **Prize standing:** the lineage's recency-weighted prize money from its best 10 events, normalised to the world's best lineage. It reflects legitimate deep runs.
2. **Bounty collected:** for each win, the beaten opponent's *prize standing* × recency. Sum the best 10 wins. Beating strong teams matters; farming amateurs collects near zero.
3. **Opponent network:** the number of distinct opponents beaten, each weighted by how many distinct opponents *they* beat (one PageRank-style pass), summed over the best 10.
4. **Seed rating:** `400 + 1600 × mean(normalised factors)`.
5. **Head-to-head:** chronological Elo-style pass over the window's ranked series, starting from the seed rating. K is scaled by recency. The expected score comes from the rating gap (/400). A big favourite beating an underdog gains almost nothing, so there are no fixed +20/−10 rewards.
6. **Eligibility to be listed:** at least 5 ranked series in the window and at least one in the last 90 days. Inactive teams decay out as their results age.
7. **Tier is not a multiplier.** Elite events matter because their opponents and prize money are strong.

Unranked matches (exhibitions, showmatches) are stored but never ingested. Repeated series inside one event between the same pair count once per event for the network factor.

Global and regional lists are the same scores, filtered by roster region. Region is the majority of the 5 players' nationality regions; ties go to the org's home region.

## Invitations and qualifiers

- Each tournament stores: announcement date, cutoff date (a published snapshot), list (`global` | region), first rank considered, invite count, qualifier slots and eligibility rules.
- Invitations are issued at the cutoff in snapshot order. A team is skipped if:
  - it is in the wrong region;
  - its roster does not contain ≥3 of its listed core;
  - it already declined this event;
  - it has a conflicting commitment.

  The walk continues until slots fill. Each skip records its reason.
- Accepted invites stay valid if the team later drops in rank, as long as roster continuity holds at the event start.
- Qualifier slots are filled by **simulated** qualifier events (open, or closed by rank band). Qualifying awards access, not points.
- World Championships happen twice a year. The Stage 1 and Stage 2 direct places come from regional snapshots. Regional qualifiers (open → closed) fill the remaining Stage 1 places.

## Season template (per year)

| Month | Content |
|---|---|
| Jan | Offseason roster window; Tier 3 regional cups start |
| Feb–May | 4 Tier 1 internationals, 6 Tier 2, Tier 3 cups every ~2 weeks per region; Championship 1 regional qualifiers (May) |
| Jun | **World Championship I** |
| Jul | Mid-season roster window |
| Aug–Nov | 4 Tier 1, 6 Tier 2, Tier 3 cups; Championship 2 regional qualifiers (Oct) |
| Dec | **World Championship II**; awards |

## Match resolution

In game, every series is resolved by the real engine (veto → `simulateMap` per map).
The ecosystem modules depend only on the `SeriesResolver` interface. Multi-season validation
(`npm run sim:career`) uses a seeded strength-based resolver so 20-season runs finish in minutes. That resolver is clearly labelled and test-only. It tests ecosystem mechanics, not match realism.
