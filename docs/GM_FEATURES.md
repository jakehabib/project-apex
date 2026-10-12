# Best-of-genre feature matrix

The owner wants an incredibly detailed game that includes the best aspects of every general-manager game. This matrix lists what each reference game does best, how it translates to tactical-shooter esports, and where it lives in our backlog (HANDOFF §7).

Status: ✅ built · 🟡 partial · ⬜ planned.

**Non-negotiables always apply:**
- no fatigue, injuries or training chores;
- one deterministic simulation;
- original IP.

Anything a reference game does with those mechanics is reinterpreted, or left out.

## Football Manager (depth, scouting, staff, match day, narrative)

| Feature | APEX version | Status |
|---|---|---|
| Hidden attributes and potential, scout-dependent knowledge | Hidden ceilings. Reports estimate attributes and POT as ranges whose width depends on the scout's Judging and Potential Eye and on time watched. | 🟡 ceilings ✅, scouting reports next |
| Scouting network: assignments by region and competition | Scout assignments (region, tier, matchmaking ladder, specific event). A weekly shortlist with "wonderkid" alerts. | ⬜ |
| Staff with attributes that matter | Head coach (Development, Preparation, Reading, Adaptation), scouts (Judging, Potential Eye, Reach). Later: analyst, sports psychologist (morale/pressure, never fatigue), team manager (logistics). | 🟡 coach and scout ✅ |
| Player development driven by age, coaching and minutes | Automatic growth toward hidden ceilings, set by age curves, coach Development, playing time and competition level. No training sessions to schedule. | ✅ v2 |
| Match day: watch, change tactics, shouts, timeouts | Play match with stance calls at freeze time, speeds, sim to end. Next: manager tactical timeouts and half-time talk. | 🟡 |
| Dynamic media, press conferences, player promises | News feed from events. Optional short press questions that affect morale and fan sentiment, never mandatory. | ⬜ |
| Morale, team chemistry, player personalities | Personality traits (ambition, loyalty, professionalism, temperament), morale from results, role and playing time; chemistry from shared seasons. These have small, bounded effects. | ⬜ |
| Contracts: wages, length, clauses, release fees | Contracts with salary, length, buyout, performance bonuses and loan clauses. Negotiation with agents. | ⬜ |
| Board and owner expectations | Organisation goals: ranking target, budget, fan growth. Job security for the manager career. | ⬜ |
| History, records and hall of fame | Persistent records for players, teams and events; career pages; hall of fame. | 🟡 data exists |

## Out of the Park Baseball (minor leagues, history, sim depth)

| Feature | APEX version | Status |
|---|---|---|
| Minor-league affiliates and call-ups | Academy teams as minor-league affiliates: their own roster, ranking lineage and Tier 3 / qualifier schedule; call-ups and send-downs. | ⬜ (task 12) |
| Draft and amateur pool | The matchmaking ladder (our original FACEIT-like platform) is the amateur pool: Elo leaderboards, unsigned talents, scouting there. | ⬜ (task 13) |
| Decades-long simulations with coherent history | 20-season ecosystem validation passes; history screens planned. | 🟡 |
| Customisable leagues and fictional universes | World seed, number of clubs and regions configurable (`WorldSpec`). | 🟡 |

## Madden / NBA 2K MyGM (presentation and readability)

| Feature | APEX version | Status |
|---|---|---|
| 1–99 OVR/POT, X-factor style headline talents | Madden-style OVR/POT; generational 99s; rating tiers. Next: trait badges such as "Clutch Gene", "Entry Machine" and "Utility Wizard", earned from attributes and AMR history. | ✅ OVR, ⬜ traits |
| Polished player cards and progression reports | Player cards with kit-composited AI portraits; season progression reports ("+4 OVR: Rifling +6"). | 🟡 portraits ✅ |
| Weekly loop with clear goals | Dashboard: next match, invitations, cutoffs, finances, development alerts, sponsor goals. | ⬜ |

## Basketball GM / Hockey GM (speed and depth)

| Feature | APEX version | Status |
|---|---|---|
| Instant sim of whole seasons; every stat recorded | Sim-to-date over the ecosystem. The engine must be fast enough: worker pool and day-by-day processing. | 🟡 |
| Trade AI that values contracts and age | AI valuation: OVR, age curve, POT, contract and role need. Need-based transfers ✅; trade negotiation ⬜. | 🟡 |
| Deep stats pages and leaders | AMR leaders, role-adjusted tables, event and season splits, head-to-head records. | 🟡 AMR ✅ |

## Motorsport Manager / Teamfight Manager / esports managers (genre-specific)

| Feature | APEX version | Status |
|---|---|---|
| Strategy decisions during a visible match | Stance calls, timeouts; next: per-side plans, map-specific playbooks, economy calls (force or save). | 🟡 |
| Draft / veto as a strategic layer | BO1/3/5 veto from map proficiency. Next: an interactive veto screen with opponent tendencies. | 🟡 engine ✅ |
| Facilities and bootcamps (without chores) | Facilities that raise development speed or preparation; LAN bootcamps before big events (a one-click decision). | ⬜ |
| Sponsors with objectives | Sponsor offers tied to rankings, regions, fanbase and event placements. | ⬜ (task 14) |
| Fans and followers | Fanbase by region, growth from results, stars and storylines. Drives merchandise, sponsor value and attendance. | ⬜ (task 14) |
| Streaming and content | Player streaming income and follower growth (small, optional). | ⬜ |

## UX principles taken from the best (non-negotiable for APEX)

- **Delegation everywhere** (FM): assistant coaches handle trivial registrations, scouting assignments and contracts if the user wants.
- **Every number explains itself:** hover or click shows why (ARP, AMR and invitations already do).
- **One-click sim, deep dive on demand** (Basketball GM, OOTP).
- **No busywork** (owner rule): no stamina, no training schedules, no equipment upkeep.
