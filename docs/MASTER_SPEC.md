# PROJECT APEX: Master spec

This is the owner's complete autonomous development directive, received 2026-10-13, condensed
without dropping requirements. It supersedes earlier briefs where they conflict. The earlier detailed
specs (`GAME_DESIGN.md`, `START_HERE.md`, `ARP_BRIEF.md`, `AMR_BRIEF.md`, `ECONOMY_RESEARCH.md`)
remain valid reference material.

## Owner overrides (highest priority)

1. **Browser game first, Steam later.** Build and ship a browser-playable game first. Electron/Steam
   packaging comes afterwards (the desktop shell already exists and is kept working).
2. **Use AI image generation (OpenAI, development-time only)** for art, logos and imagery wherever it
   helps. It is never called during gameplay. Track provenance in `art/manifest.json`.
3. **Amazing animations:**
   - matches: smooth continuous movement, recoil, tracers, smokes, flashes, fire, bomb plant/defuse
     and broadcast camera moves;
   - UI: transitions, counters, kill-feed slide-ins, banners and reveals.
4. **Viewer look:** top-down, but rendered to look close to 3D. Competitor reference: detailed map
   with depth and lighting, portrait side panels with weapon, utility, K/D, money and HP, a score bar,
   a kill feed and a round timeline with event markers.
5. **Tactical match intelligence rebuild:**
   - Director / Squad / Player layers;
   - semantic map regions;
   - plan templates;
   - honest information;
   - coordinated utility;
   - adaptation;
   - a debug overlay;
   - scenario tests.

   Perfect one round on one map first. Full brief text: decision #38 in `DECISION_LOG.md`.

## Mission and working mode

- Act as the whole development team. The owner has zero coding knowledge.
- Work autonomously without asking for routine decisions or approval between phases. Stop only for
  genuinely external actions: credentials, legal agreements, purchases, Steamworks.
- **The objective is a finished game,** not a plan or a prototype.
- Keep the continuity docs accurate:
  - `CLAUDE.md`, `HANDOFF.md`;
  - `docs/MASTER_SPEC.md`, `docs/ARCHITECTURE.md`, `docs/DEVELOPMENT_ROADMAP.md`;
  - `docs/IMPLEMENTATION_STATUS.md`, `docs/DECISION_LOG.md`, `docs/TEST_RESULTS.md`;
  - `docs/KNOWN_ISSUES.md`, `docs/RELEASE_CHECKLIST.md`.
- Commit stable work. Never claim untested or unfinished work as done.

## Definition of success

The player can:
- launch the game;
- start a career and select or create an organization;
- manage the roster;
- scout, sign free agents and negotiate contracts;
- buy, sell and trade players;
- manage a budget and configure tactics;
- play tournaments and qualifiers, and gain or lose world ranking;
- watch tactically coherent matches or simulate them instantly;
- view accurate statistics;
- develop prospects, and see aging and retirement;
- progress through many seasons, win championships and view history;
- save and load;
- play with no developer tools.

## Product

- Single-player GM of a five-player tactical-shooter organization. No direct control of players in
  matches.
- References (conceptual only): FM, Madden Franchise, 2K MyNBA, MLB The Show, OOTP, Motorsport
  Manager, pro CS.
- Easy to learn, deep, replayable, polished, believable, fast to navigate.
- **Never add:**
  - wear and tear, injuries, fatigue or equipment degradation;
  - mandatory training;
  - repetitive conversations or morale chores;
  - manual weapon buying;
  - email spam;
  - skill-point chores or click-heavy admin.

  Automate routine admin.
- **Career fantasy:** start as an unknown regional organization, discover prospects, climb to
  dynasty, while AI rivals react.

## Technical

- Stack: TypeScript, React, PixiJS (2D viewer), Vite, a standalone deterministic simulation core
  and an automated test suite. Electron for the later desktop/Steam build. Persistence: SQLite on
  desktop, IndexedDB in the browser.
- Offline. No account. No AI calls during gameplay.
- Separated systems: domain models, calendar, organizations, players, development, scouting,
  contracts, transfers, finances, AI organizations, tournaments, rankings, match simulation,
  tactical AI, economy, combat, utility, stats, viewer, UI, assets, persistence, tests, packaging.
  The engine does not depend on the renderer, and the renderer shows recorded events.
- Deterministic seeded simulation with event logs. Stats and ratings derive from events. Testable
  headless.
- **Saves:**
  - new career, continue, multiple slots, manual saves and autosave;
  - metadata and migrations;
  - version compatibility;
  - corruption detection and backups;
  - 20+ seasons without corruption.

## Visual design

- **Target:** a polished $25–$40 PC management game, not a SaaS dashboard.
- **References:** FM information density, 2K player presentation, F1 Manager dark polish, HLTV
  stats, esports broadcasts.
- **Palette:**

  | Token | Value |
  |---|---|
  | Background | #0D1117 |
  | Primary surface | #141B24 |
  | Secondary surface | #1B2531 |
  | Hover | #253244 |
  | Borders | #2B3746 |
  | Primary text | #F1F5F9 |
  | Secondary text | #A1AEBD |
  | Muted text | #728196 |
  | Accent | #49A7EF |
  | Accent hover | #75C3FA |
  | Success | #45C995 |
  | Warning | #E5B35C |
  | Danger | #E16C74 |

- Compact, dense, readable tables; clear hierarchy; small icons; subtle motion; consistent spacing.
- **Avoid:**
  - huge empty cards and oversized widgets;
  - blue glow and generic gradients;
  - emoji;
  - giant buttons;
  - needless scrolling;
  - placeholders.
- **Layout:** optimized for 1920×1080; supports 1440p and common sizes.
- **Navigation:** Dashboard, Roster, Scouting, Transfers, Contracts, Tactics, Schedule, Tournaments,
  Rankings, Finances, Statistics, History, Settings.
- **Persistent top bar:** organization, date, world rank, cash, next match, Continue.
- **Dashboard:**
  - organization branding, world and regional rank, season record;
  - **next match as the centrepiece**;
  - current tournament, roster and recent results;
  - payroll and cash;
  - contract expirations and scouting discoveries;
  - ranking cutoff and news.
- **Roster:** sortable table with portrait, nickname, nationality, age, role, OVR, POT estimate,
  development trait, AMR, wage, contract and form. Filters, compare and actions.
- **Player profile:** big portrait, identity, OVR/POT, trait, AMR and contract. Tabs: Overview,
  Attributes, Performance, Career, Contract, Scouting. Attribute bars and charts.
- **Scouting:** two panels (searchable database and report), uncertainty shown, shortlist, compare.
- **Negotiation:** edit salary, duration, bonus, buyout, prize share, fee and player exchange. Show
  the financial consequences; the AI explains its reasoning.
- **Match viewer (broadcast):**
  - map, team names and logos, score, round timer, series score;
  - HP, armour, weapons, money, utility;
  - kill feed, bomb indicator, round history, spectator controls;
  - smooth movement, visible utility, facing direction, restrained transitions.

## World

- **Organizations:** about 48–64 active, across Europe, Americas and Asia-Pacific. Each has:
  - name, ID, nationality and region;
  - logo and colours;
  - reputation and prestige;
  - finances, backing, sponsorship and ambition;
  - management style, roster, coach, ranking and history.

  Each has a distinct AI philosophy.
- **Players:** 400–500 active professionals plus free agents and prospects. Each has:
  - stable identity, birth date, nationality and portrait;
  - roles and attributes, OVR, POT and development trait;
  - contract, wage, reputation and personality;
  - career stats, match history, transfer history, awards and rating history.

  No repeated identities.
- **Portraits:** fictional, with a permanent portrait mapping. Team framing changes on transfer;
  the face never does. Logos and assets are original, and their licences are tracked.

## Ratings and development

- **Attributes (1–99):** Aim, Reactions, Recoil control, Rifling, AWP, Positioning, Game sense,
  Utility, Teamwork, Entry, Clutch, Composure. Traits: Leadership, Communication, Adaptability,
  Consistency, Aggression, Discipline. All must influence the simulation.
- **OVR (40–99):**

  | OVR | Tier |
  |---|---|
  | 40–49 | Amateur |
  | 50–59 | Developing |
  | 60–69 | Regional pro |
  | 70–79 | Tier 2 |
  | 80–84 | Tier 1 capable |
  | 85–89 | Elite |
  | 90–94 | Superstar |
  | 95–99 | Generational |

  OVR is computed from attributes with role weights (AWPer, Entry, Support, Lurker, IGL, Rifler).
- **Potential:** hidden, 40–99.
- **Development traits:** Normal, Promising, Star, Prodigy. They set speed of improvement, separate
  from the ceiling. Career outcomes vary: generational talents, late bloomers, busts, specialists,
  long-lived elite players.
- **Progression:** periodic. Driven by age, trait, minutes, opposition, coaching, role fit and
  variance. Never an automatic OVR jump after a good match. Attributes decline differently
  (mechanics before tactics). No universal age cliff.
- **Scouting:** estimated ranges (e.g. OVR 72–78, POT 84–94, confidence 67%) that sharpen with
  scouting. The AI also uses imperfect information.

## Contracts, transfers, finances

- **Monthly wage bands:**

  | Level | Monthly wage |
  |---|---|
  | Amateur | $0–750 |
  | Emerging prospect | $750–2,500 |
  | Tier 3 | $1,500–4,000 |
  | Established Tier 2 | $3,000–10,000 |
  | Tier 1 newcomer | $8,000–17,500 |
  | Established Tier 1 | $15,000–30,000 |
  | Elite | $30,000–60,000 |
  | Marquee | $60,000–100,000+ |

- Wage demand depends on ability, potential, age, performance, reputation, role scarcity, demand,
  current contract, organization prestige, ambitions and competing offers.
- **Contracts:** wages, duration, bonus, buyout, prize share, extensions, expiry, free agency and
  termination cost. No leaving a valid contract without a contractual mechanism.
- **Transfers:** sign free agents, offers and fee negotiation, player exchange, sell, release,
  extend, evaluate bids. The AI values ability, potential, contract, budget, replacement cost,
  needs, ambition and player preference. No lowball steals of stars.
- **Valuation:** OVR, POT, AMR, market value, fee and wage demand are all distinct.
- **Finances:**
  - cash, revenue and expenses;
  - payroll, transfers, bonuses and staff;
  - prize money, sponsorships and operating costs;
  - forecasts.

  Explicit subsidies for wealthy owners. No infinite money.
- **Sponsors:** monthly payments, performance, ranking and championship bonuses. Not a chore.

## Rankings and tournaments

- **ARP:**
  - global, Europe, Americas and Asia-Pacific lists;
  - snapshots, peak and movement;
  - based on recent results, opponent strength, prize performance, recency, schedule and continuity.

  Underdogs can climb.
- **Invitations:** from snapshot rankings, regional rules, slots, roster eligibility and acceptance.
  Never random. Never retroactive.
- **Lineage:** the 3-of-5 core rule. Never duplicated. Warn the player before consequential changes.
- **Calendar:**
  - regional, Tier 3, Tier 2 and Tier 1 events;
  - open and closed qualifiers;
  - two world championships a year.

  Formats: BO1/BO3/BO5; single and double elimination, round robin, Swiss. Each event has dates,
  region, tier, prize pool, prestige, entrants, cutoff, invites, qualifier slots, format, bracket
  and champions history.
- **Qualifiers** are a real path for underdogs, decided by actual match results.

## Match simulation (the most important system)

- Coordinated professional play. Never independent random destinations, a predetermined winner or
  fabricated kills.
- **Rules:** MR12, overtime, BO1/BO3/BO5, vetoes.
- **Maps:**
  - 7 original maps, each with spawns, two sites, cover, chokes, sightlines, routes, rotations and
    flanks;
  - tactical zones, post-plant and retake positions;
  - distinct layouts and balance;
  - semantic tactical geometry on top of navigation.
- **AI layers:**
  - Team Director: strategy, pace, site, map control, rotations, regroup, commitment, retake/save.
  - Squad: entry, trade support, utility, bomb carrier, flank watch, anchor, rotator, retake partner;
    simultaneous moves and utility.
  - Player: movement, cover, angles, detection, combat, grenades, trading, repositioning,
    communication, retreat.
- **T tactics:** default, rush, contact, A/B execute, split, fake, mid control, late rotation,
  regroup; abandon failed plans; no oscillation.
- **CT tactics:** standard, anchors, rotators, crossfires, aggressive info plays, passive, retakes,
  saves. They respond only to real information.
- **Information:**
  - last seen positions, with age;
  - footsteps and gunfire;
  - visible utility;
  - bomb information;
  - map control;
  - confidence.

  Fakes can work. Strong IGLs read information better.
- **Movement:** pathfinding, collision avoidance, cover, waiting, angle holds, trade spacing, group
  movement, crossfires, entries, retreat, rotations. Holding still is allowed.
- **Combat:**
  - weapon, distance, aim, reactions;
  - positioning, movement, cover, surprise;
  - utility, equipment, numbers and attributes.

  Upsets are possible; skill wins over large samples.
- **Bomb:** carrier, drops, recovery, plant, timer, defuse, kits, post-plant, retake, detonation.
- **Economy:**
  - money for start, wins, losses, kills and plants, with a cap;
  - purchases and carried equipment;
  - drops;
  - pistol, full, force, half, eco, bonus and save rounds.

  A team planner coordinates buys. Reference prices are configurable.
- **Utility:** smokes block, flashes impair, fire denies, HE damages, kits speed defuses.
  - Every throw has a purpose.
  - Track bought, used and unused utility, utility damage and flash assists.

## Performance stats

- **AMR:** mean about 1.00. Weights: kills 30%, swing 20%, damage 15%, survival 15%, KAST 10%,
  multi-kills 10%.
- **Stats:**
  - K/D/A, ADR, KAST;
  - opening attempts and success;
  - trades, clutches and multi-kills;
  - utility damage and flash assists;
  - T/CT splits.

  All from the event log. Round swing comes from a win-probability model.
- OVR, POT and AMR are distinct.

## Viewer

- **HUD:** map, facing markers, movement, HP, armour, weapons, utility, bomb, score, timer, kill
  feed, economy, series.
- **Controls:** play/pause, 1×/2×/4×/8×, next round, replay, instant map, instant series, stats.
- Interpolated, authoritative movement.
- **Developer tactical overlay:** tactic, phase, assignments, routes, objectives, enemy information,
  utility targets, rotation reasons, AI states.
- **Highlights:** openings, trades, multi-kills, clutches, plants, retakes, overtime, match point,
  finals, championships. Broadcast motion and sound, restrained.

## AI organizations, world, news, legacy

- **AI clubs:**
  - roster, contracts, recruiting, selling, scouting;
  - money, events, development, retirements, rankings.

  They have varied philosophies, no unlimited money, no perfect knowledge of hidden attributes and
  no match bonuses. Difficulty changes management sophistication and resources.
- **Persistence:** careers, organizations, transfers, contracts, tournaments, rankings, titles,
  awards, stats and finances. Sustainable population, no rating inflation.
- **News:** data-driven only, covering transfers, breakouts, ranking moves, upsets, titles,
  retirements, disputes, financial trouble, prospects and milestones.
- **Legacy:** titles, records, MVPs, career AMR, peak OVR, earnings, transfer records, historical
  rosters, dynasties.

## Testing

- **Batch match tests:**
  - side win rates and opening conversion;
  - 5v4 and 5v3 outcomes, retakes, clutches;
  - eco, force and pistol conversion;
  - plant rate and utility usage;
  - player distributions;
  - overtime frequency.

  Benchmarks are configurable and never forced.
- **20-season career tests:**
  - development, retirement and replacement;
  - financial sustainability;
  - rankings, AI roster building, contract expiry;
  - participation, title distribution, wage inflation, continuity.
- **Functional tests:**
  - transfers, wages, expiry;
  - rankings, invites, qualifiers;
  - attribute effects, tactics, utility;
  - plants and defuses;
  - stats match the events;
  - save/load, long-run stability.
- **Performance:** a responsive UI, a smooth viewer, instant sim much faster than real time, and
  headless league progression.

## Roadmap phases

1. Foundation
2. Tactical engine (one map, hierarchical AI)
3. Viewer
4. Full rules and economy
5. Management
6. Ecosystem
7. Career simulation
8. Content: 48–64 orgs, 400–500 players, 7 maps
9. Premium presentation
10. Testing and release

Don't expand content while core systems are broken.

## Quality gates

- **Tactical round:** a coordinated plan, roles, site coverage, information gathering, purposeful
  movement, supporting utility, fights, trades, rotations, plant or hold, post-plant or retake,
  and an accurate viewer. Wandering fails the gate.
- **Management loop:** find, scout, negotiate and sign a prospect; see them on the roster and in the
  finances; play them in matches; see their performance; develop them over seasons; keep their
  history.
- **UI:** no dead buttons, fake screens, unconnected stats, broken navigation, unreadable text,
  empty space, inconsistency, wrong portraits, missing branding or placeholders.
- **Saves:** create a career, advance a season, sign a player, finish a tournament, save, close,
  reopen, load and verify. Then the same with long saves.

## Commercial

- Fictional IP only.
- Licensed fonts, sounds, libraries and art, recorded in `docs/ASSET_LICENSES.md`.
- Windows release candidate later. Steam integration stays modular; never claim it is published.
- Offline, no subscription, no AI at runtime, no "Coming Soon".

## Final deliverables

- Source and a runnable build (browser first, then a Windows build).
- Instructions.
- A full career mode with the viewer, roster, scouting, contracts, transfers, finances, rankings,
  tournaments, AI organizations, development, saves and history.
- Tests and test results.
- Asset licences.
- Known limitations.
- An honest readiness assessment.
