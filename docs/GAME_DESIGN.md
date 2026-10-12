# PROJECT APEX — PREMIUM TACTICAL-SHOOTER ESPORTS MANAGER
## Research-led game design document, product requirements and engineering specification
**Working title:** PROJECT APEX (placeholder only; trademark-clear the final name)
**Prepared:** October 12, 2026
**Target:** Premium single-player PC game on Steam, Windows first
**Audience for this document:** Claude Code, solo/indie developer, UI artist, QA testers and prospective collaborators
**Status:** Pre-production brief; proposed numbers are balancing hypotheses, not verified empirical constants

> **One-sentence pitch:** Build your own five-player tactical-shooter esports dynasty: scout the next superstar, negotiate smart contracts, exploit the transfer market, outthink rivals in map vetoes and strategies, and *watch the match unfold on a gorgeous tactical broadcast viewer*—without pointless chores.

> **Core promise:** All of the satisfying franchise decisions, none of the fake management work. It must be a real game that happens to have a data-rich interface, not a spreadsheet with a launch button.

---

# 1. Executive decision and commercial positioning

We will build a **fictional tactical-shooter esports management simulator** strongly inspired by the structure of professional Counter-Strike-style 5v5 competition. Competitive identity comes from the attack/defense economy, rounds, maps, teams, roster roles, IGL calls, vetoes, tournaments and clutches. We will **not** ship Valve intellectual property, Counter-Strike logos, copied CS2 maps, weapon models, professional team/player likenesses or tournament branding without explicit rights or a qualified legal review.

We will prioritize three differentiators over feature count:

1. **Best-in-class match credibility:** a single deterministic event simulation drives *all* results, per-player stats, economic decisions, 2D positions and replays. The viewer never invents an unrelated version of the match. Watching a round should make you understand *why* it happened.
2. **Excellent roster GM gameplay:** prospective player quality, positional fit, believable contracts and transfers, strong rival-club AI, long-term development, smart scouting, meaningful but limited finances, and memorable career history.
3. **Low-friction premium UX:** minimal click depth, fast search, keyboard-friendly tables, readable tooltips, skippable viewer, action-oriented inbox, delegated routine administration, and sleek cohesive presentation from the first screen.

**Not the strategy:** implementing three dozen administrative systems, a full CS2 clone in 3D, precise mouse-controlled gunplay, cosmetic gambling, base building, micromanaged practice scheduling, or a calendar full of forced interruptions.

**Product model:** one-time premium purchase; no pay-to-win, loot boxes, skins marketplace, stamina timers, daily logins, or forced online account. Recommended launch-price experiment: **$19.99 USD**, with **$24.99** defensible only if the demonstrated scope, UI and simulation warrant it. Pricing requires market testing; these are proposed price points, not demand forecasts.

**Reality check:** competition is already present. *Esports Manager 2026* released in July 2026; *Rush B: Esports Manager* and *Esports Manager: FPS* advertise comparable FPS esports concepts, including radar views. Winning requires unusually high execution, not just a new concept.

---

# 2. Research: what makes management games compelling

## 2.1 Comparable products and lessons

| Source/game | Observed market signal (October 2026 snapshot) | Useful design lesson | Pitfall to avoid |
|---|---|---|---|
| Teamfight Manager (2021) | Very Positive; approximately 83% of English-language Steam reviews positive | Teams + draft/veto choices + *visible* auto-battles are accessible and watchable | Purely repetitive best-option strategies without long-term variation |
| Esports Godfather (2024) | Approximately 94% positive English reviews | Winning via playstyle/counters feels more satisfying than raw ratings | Overly specific mechanics that do not translate to tactical shooters |
| Teamfight Manager 2 (2026) | Approximately 73% positive English Steam reviews | More depth/content can build on the formula | Reviewer complaints about extra emails, confusing menus, menial merchandise chores and nonsensical wage offers |
| Esports Manager 2026 (2026) | Approximately 65% positive English Steam reviews | Direct proof there are paying players for tactical-FPS management | Community complaints involving broken AI, inconsistent tactical execution, crashes and implausible economics; evaluate current build rather than assume all historical bugs persist |
| Rush B: Esports Manager (upcoming as checked) | Store promises tactical radar, roster building and analytics | Direct competitive benchmark: radar alone is not a unique selling proposition | Do not copy its branding/assets/interface |
| Esports Manager: FPS (upcoming as checked) | Store promises map vetoes, live radar, scouting, money/roster systems | The audience understands this exact product category | Differentiate on believable simulation, usability and polish |
| Motorsport Manager (2016) | Approximately 90% positive English Steam reviews | A live event viewer plus timely strategic decisions is a strong management loop | Punitive busywork and controls that drown out the competition |
| OOTP Baseball 26 (2025) | Approximately 82% positive Steam reviews | Rich stats, legacy, records, generated prospects, alternate futures | Exposing every possible control to the player by default |
| Madden NFL 27 / NBA 2K26 MyNBA / MLB The Show 26 | Madden 27 emphasizes interconnected player motivations, free agency and a living league; NBA MyNBA adjustable simulation/legacy; MLB 26 a revised Trade Hub and streamlined control | Connected systems, sensible AI GMs and adaptable management depth | Wear-and-tear chores, exploitable contracts and excessive advance-week friction |
| Football Manager 26 | Steam/community criticism centers partly on click-heavy navigation | UX is gameplay in a management game | Nested panels and hiding basic roster/financial information |

**Research interpretation, not universal player consensus:** enthusiastic reviews commonly reward clear influence of choices on outcomes; negative reviews often describe a disconnect between systems, outcomes and player effort. This is a qualitative synthesis of store features and selected community reviews, not a representative survey.

## 2.2 Specific evidence worth remembering

- Some *Teamfight Manager 2* Steam negative reviews directly describe emails, maintenance/merchandise routines, unintuitive tables, and economically bizarre contract demands as chores.
- Steam discussions for *Esports Manager 2026* describe viewer behavior such as missed rotations or ignored dropped weapons and mismatch between intended tactics and simulation. At least some commenters also praise the broader management systems. Take this as evidence of **risk**, not a current exhaustive audit.
- *MLB The Show* franchise commentary highlights frustration with repetitive and uncertain scouting, unrealistic trades and missing contract flexibility; fans also explicitly want meaningful history and offseason decisions.
- *Football Manager 26* players complain that important information is harder to access and takes too many clicks. A game can have tremendous depth and still feel awful to operate.
- *Motorsport Manager* demonstrates that a spectacle-oriented match/race viewer lets users *watch their decisions matter*, even when they are not controlling an athlete or vehicle.

## 2.3 The jobs the player hires this game to do

1. **Find a hidden gem:** 'I found a 17-year-old with phenomenal positioning whom nobody valued, and they became a Major MVP.'
2. **Make a gutsy trade:** 'I sold an aging star at the right time, absorbed risk and rebuilt a contender.'
3. **Outsmart a better team:** 'I had a weaker lineup, but our map pool and economy plan won the semifinal.'
4. **Watch a story emerge:** 'Our veteran IGL kept the underdogs alive with a 1v2 on round 24.'
5. **Build a dynasty:** 'I can look back at the club's decade of rankings, lineups, records and trophies.'

Design every feature around one of those stories. If it cannot produce a meaningful decision, consequence, revelation or emotional payoff, it is a candidate for removal or delegation.

---

# 3. Creative vision and non-negotiable pillars

## 3.1 Four pillars

**A. Player agency without god-mode:** decisions are understandable, consequential and constrained; stars matter, but no single rating or tactic guarantees a result.

**B. A world that plays without you:** other clubs bid, trade, bench, develop, contend, rebuild and go bankrupt or restructure in ways consistent with their budgets and goals. The manager is in a living world, not facing mannequins.

**C. Moments over chores:** 3-5 meaningful manager decisions per typical in-game month is a design *target*, not a quota. Some windows can be busier (offseason, tournament playoffs). Repetitive routines are automatic.

**D. Broadcast-polished visual language:** a restrained esports-broadcast aesthetic rather than a browser admin template; responsive motion, rich hierarchy, strong player/team identity, excellent spectator readability and distinctive sound.

## 3.2 Explicit non-goals / prohibited features

- **No wear-and-tear, fatigue, stamina, sleep, burnout meters, accumulated health/injuries or recovery management.** Players are ready to play. Do not recreate these systems with synonyms.
- No need to replace gaming chairs, keyboards, mice, monitors or equipment; no degrading facilities, equipment repairs or recurring consumable purchases.
- No daily per-player training tasks, meal plans, practice click queues or physical wellness management.
- No mandatory repeated pep talks or forced personality-dialogue spam.
- No match puppeteering where the user moves all five agents or aims weapons.
- No arbitrary hard salary cap copied from the NFL; organizations operate on budgets and affordability, not a league cap.
- No requirement to manually play/watch every match; results must be statistically identical in method whether watched or skipped.
- No cosmetic lootboxes, skin trading, wagering or NFT/crypto features.
- No full game-engine recreation of commercial CS2, Valve-authored maps or weapons.
- No default always-online architecture.

**Allowed distinction:** stable long-term **confidence/form** and team **cohesion** may exist as small, bounded modifiers because they enrich narrative and decision-making. These are **not** maintenance bars, daily micro-tasks or disguised stamina. They change through results, stable playing time, roster changes and the occasional important event. Optional setting can disable personality/morale events.

---

# 4. Game setup, player fantasy and core loop

## 4.1 Game modes (release target)

**Career — Build From Nothing:** take over a low-budget fictional club in a regional tier, climb the rankings, sign talent and reach an international championship. This is the default and the marketing hero.

**Career — Take Over a Team:** choose any playable franchise in a fictional esports ecosystem with its own finances, reputation, history and players; rebuild or contend now.

**Sandbox:** customize starting money, world seed, difficulty, realism level of transactions, event frequency, and names/logos. In sandbox, achievements requiring competition integrity can be disabled or labeled clearly.

**Exhibition:** choose two teams, map/BO series, tactics and launch spectator match. This is valuable for testing, demoing and sharing clips.

## 4.2 First-session 15-minute experience

Minute 0-2: appealing splash/title; quick 'Create Dynasty' with game mode, name/logo, one of three start profiles, difficulty and optional deep customization.

Minute 2-5: attractive dashboard showing five starters, payroll, current ranking, upcoming qualifier and an analyst alert: 'Great aim, weak B-site holds; your fifth starter is on an expiring deal.'

Minute 5-8: player can browse three affordable candidates, inspect side-by-side scouting reports, make an offer or keep the current player. A recommended action speeds up onboarding, never forces it.

Minute 8-12: prepare a first match with a clear map veto and an approachable tactical preset. Watch a small number of dramatic rounds in a full-screen tactical broadcast, with understandable score/economy/commentary.

Minute 12-15: decisive close round, results, contribution breakdown, one earned reward (cash/reputation/opportunity), and a new meaningful decision. A user should understand what they are building toward and want 'one more match'.

## 4.3 Primary loop

**Observe world -> identify roster/strategic opportunity -> make a contract/roster/tactic/budget decision -> play or simulate matches -> see clear causal feedback -> advance to the next consequential moment.**

Support **Advance to Next Event**, **Advance 1 Week**, and **Stop At** configurable triggers (match, contract decision, offer, tournament, critical finance issue). Background weekly activity and news should be summarized instead of requesting irrelevant confirmations.

One season should feel like a story: opening window / qualifiers / regional events / international circuit / championship / awards / offseason. Suggested first balance target is 3-5 hours per season for an engaged viewer and much faster for a simulation-heavy player, to be adjusted through testing.

---

# 5. Fictional esports world and competitions

## 5.1 Scope deliberately constrained for indie development

**Vertical slice:** 8 clubs, 1 region, 1 small tournament, 2 original maps, roughly 60 player records, 1 full working exhibition viewer.

**Initial commercial release target:** approximately 48 clubs across 4 fictional regions and 3 competition levels, 7 original tactical maps, roughly 300-450 players including free agents/prospects/reserves, annual open qualifiers, regional championships, international invitationals and an end-of-season global championship. These are *scope proposals*, not demands before the first vertical slice.

All competitions have logical entry rules, seasons, payouts, prestige and ranking effects; if the player cannot qualify for an event, show why. Never use invented 'real-time' professional esports invitations presented as factual Valve rules.

## 5.2 Circuit rules

- Best-of-one, best-of-three and best-of-five series; map pick/ban/veto templates that reflect the series format.
- Series scheduling prevents a team from overlapping matches. Organizer events respect roster lock and qualification rules.
- Region, club prestige and recent results affect initial invitations; open qualifiers provide a route to higher tiers.
- World ranking formula is public enough to explain: recency-weighted event results, opponent strength, event quality; no secret 'fame' hardcoding.
- Rankings and seasonal narratives exist for all teams, not just the user.
- Round format modeled on modern MR12 tactical-shooter competitions: 12 regulation rounds per half, teams switch sides, first to 13 wins in regulation, tied 12-12 enters configurable overtime blocks (e.g. six rounds with sides switching after three, repeat if tied). Match format must be data-driven, tested and not misrepresented as exact esports event rules.
- Pistol rounds, buy decisions, saves, bomb plant/defuse and overtime starting credits are rules-engine settings rather than view-only cosmetic labels.

## 5.3 Original map identity

Seven **original** maps, each with distinct topology and style; e.g. Harbor, Switchyard, Citadel, Glassworks, Plateau, Underpass, Foundry (provisional names—check for conflicts). Every map must be an actual traversable node graph with A/B sites, spawn nodes, timed approach routes, sight lines, chokepoints, rotation paths and cover. It must be visibly different from CS2 maps. Do not trace or reconstruct Valve maps.

Each team has a persistent, comprehensible map-playbook rating built from practice philosophy, roster fit, recent play and demonstrated proficiency—not a weekly maintenance grind. Map pool breadth introduces genuine depth to vetoes.

---

# 6. Players, roles, attributes, chemistry and progression

## 6.1 The five-player roster

Each club has five active players, optional bench/reserve (release target, not necessarily slice), and an optional developmental prospect slot. Roster validity is hard-enforced at match registration; make emergency free agents available if an AI club becomes invalid.

**Roles are descriptions and tactical preferences, not rigid position classes:** primary AWPer; IGL; entry; support; lurk; site anchor. A player can possess multiple role proficiencies and CT/T-side specialties. Avoid the absurdity of counting all five as exclusive roles, because e.g. an IGL can also anchor or support.

## 6.2 Data model

**Visible core attributes, 0-100:** Rifling/Dueling, AWP, Opening Aggression, Positioning/Defense, Utility, Game Sense, Teamwork/Trading, Mental/Clutch, Leadership/Calling, Adaptability.

**Derived contextual indicators:** T entry impact; CT anchor effectiveness; opener survival/trade rate; postplant effectiveness; retake utility; map proficiency; tactical compatibility; IGL synergy; estimated market value. Display an approachable 1-5 star *summary* only as a high-level label—never use it as the sole input to the match engine.

**Background variables:** age, nationality/region, personality descriptors, experience, contract, annual salary, signing bonus, transfer clause, potential and uncertainty; hidden growth curve, true ceiling, development phase, preferred role, risk preferences, team loyalty and ambition. Users receive credible ranges/scouting confidence, not random lies.

**Scouting reports** explain fit: 'above-average entry on fast executes, but struggles anchoring a passive CT site' instead of only a 75 overall. Expose enough raw statistics that analytics-loving users can verify recommendations.

**Ratings principle:** talent distribution must not saturate at 95-100 after five years. Elite players should be scarce; generator constraints, age curves, role scarcity and controlled development ceilings keep the market healthy.

## 6.3 Development without wear and tear

Progress through passive season-to-season growth and at most one optional **development focus** per roster/player per season. Examples: sharpen AWP fundamentals, specialize in B-site anchoring, improve calling, switch to entry. Growth rate is influenced by age, coaching quality, match experience, ceiling and some uncertainty.

- Improvement has diminishing returns near potential and in late-career stages.
- Aging can eventually reduce technical attributes modestly, offset by experience/leadership; it is not 'wear and tear', an injury or a forced rest penalty.
- Role conversion can work over time, with real tradeoffs. No pay-to-grow skill points.
- Scouting quality narrows *knowledge uncertainty* rather than secretly generating the player after the fact.
- No random annual talent resets; every evolution leaves a legible history.

## 6.4 Chemistry and confidence

Keep an informative, bounded **cohesion** score and optional **confidence** state. Cohesion is determined by stable lineups, role complementarity, IGL support and substantial roster moves; it is not improved by clicking a 'bonding' button every week. It should be a relatively small edge, not a universal substitute for ability. Configurable off for pure strategy mode.

## 6.5 Memorable, inspectable legacies

Player profiles show career earnings, roles, teams, historical seasonal ratings, standout matches, MVPs, trophies, transfer fees, notable clutches and all-time accolades. The game tracks all clubs and leading retired players as an archival record. Important events automatically generate a compact news headline or match recap.

---

# 7. Scouting, free agency, contracts, trades and club AI

## 7.1 Scouting without a chores simulator

Search a global market with sortable/filterable table: role, age, asking salary, affordable transfer fee, region, attributes, public results, contract expiration, interest and estimated potential. Side-by-side compare up to 3 players and show their projected contribution on *your* roster, not an abstract overall.

Scouting is automatic and **persistent**: a hired general scouting capability creates reports as seasons advance, and user-shortlisted targets receive priority. No repeatedly assigning the same scout for a 20% -> 40% -> 60% progress bar. Initial information is imperfect but fair; higher report confidence uncovers narrow ranges. Users can filter unknown prospects and take a calculated risk.

Add an 'Identify Improvement' assistant: 'Our CT B defense is bottom quartile; these four players could fix it within your budget.' It makes recommendations with reasons and must not buy players autonomously unless delegation is enabled.

## 7.2 Free agency and negotiation

A player can be unaffiliated, expiring, transfer-listed or under contract. Player motivations have distinct weights: salary, role/promised starting spot, team prestige, recent success, region, teammate familiarity, contract length and playing time. Negotiation includes:

- Annual salary, term (1-4 seasons in full game), signing bonus, optional buyout/release clause, and limited performance bonus (if explicitly worthwhile).
- Visible **annual payroll impact**, **cash required now**, **total guaranteed cost**, and **future commitments** in a side panel throughout negotiations.
- A rational asking range, a few counteroffers, an agent patience / walkaway outcome and external competing interest.
- One-click 'suggest fair offer' and quick presets (team-friendly / balanced / player-friendly), plus advanced custom controls.
- Wage demands derived from skill, proven performance, prestige, scarcity, current salary, available competing offers and market conditions—not star rating in isolation.

Expiring contracts cause a timely **important-action** notification; extensions and walkaways create narrative, not dozen-step menus. Contracts must expire and players must become free agents correctly, even after player-controlled fast simulation.

## 7.3 Transfers and trades

In real esports, player buyouts and transfers are usually more relevant than NFL-style asset-for-asset trades. Support both **cash transfer** and **player exchange** rather than forcing a fictional league draft system. Negotiation model:

- Buy player, sell player, offer player-for-player, plus optional cash adjustment; optional loan moves can be **later scope**.
- True net value is context-aware: performance expectation, age/trajectory, role scarcity, contract term, salary burden, signing team need, region, buyer/seller finances, replacement difficulty, desire to leave and competitive rivalry.
- A public 'Why they rejected it' explanation: 'We have no replacement AWPer', 'Your offer fails our payroll constraint', 'We value future potential higher', 'Player refuses to join'.
- AI can send proactive offers and bid against other clubs. Most offers must be plausible, not necessarily flattering.
- No unlimited renegotiation exploit: reputation/price changes only through justified events; enforce cooldowns and realistic offer limits.
- No player buying outside roster-size/budget rules, simultaneous selling to multiple clubs, cash duplication, or salary disappearing from ledger.
- Rival teams must seek replacements, keep minimum rosters, avoid hemorrhaging money and be capable of smart rebuilds.

**Transfer AI test:** if a player valued at $50,000 is offered for $5 million, a rational buyer does not counter at $4 million. The market must value the asset independently of the player's outrageous anchor.

## 7.4 AI club archetypes

Each team has a budget profile, region, ambition, reputation, contender/rebuilder status and GM aggressiveness. Archetypes include patient talent farm, wealthy trophy hunter, financially disciplined regional club, win-now veteran buyer and bargain-value scout. These personalities affect *plausible decisions*, not cheating or free attribute bonuses.

Run club behavior through the same contractual, roster and tournament validation rules as the user. AI can overpay or make imperfect decisions within realistic bounds, but cannot exploit state mutation or use privileged user scouting data. Publish the reasons behind interesting trades in the world newsfeed.

---
# 8. Budgets, sponsorships and business strategy

## 8.1 One coherent financial ledger

Use a single cash balance with transparent forecasts and commitments, rather than several mystical sub-currencies. Display **cash on hand, operating runway, monthly payroll, future guaranteed salary, transfer funds available, projected sponsorship income, event payouts and anticipated season result** in a persistent finance summary.

Club revenue: primary sponsorship contract; secondary sponsorship contract (one or two active max); tournament winnings; simple baseline fan/brand revenue; player transfer income. Expenses: player wages, signing bonuses, transfer fees, minimal staff wages, small fixed club operations costs. No facility wear, no overpriced office upgrades, and no fictional league salary cap unless a scenario deliberately introduces one.

Each sponsorship proposal offers a recognizable decision:

- **Safe:** guaranteed money, small performance upside.
- **Growth:** moderate base payment and upside for qualification/fan growth.
- **High-risk:** larger bonuses tied to Major results, smaller baseline.

Limit sponsorship decisions to approximately once or twice per season unless an exceptional offer arrives. Auto-renew trivial contracts if delegated. A sponsor must not auto-punish the player for something outside reasonable control; expose clear terms before acceptance.

## 8.2 Budgets create compelling constraints

A roster's high salary should come with an *opportunity cost*. A small club may sign an expensive veteran to get an invitation and sponsorship visibility, or commit to two promising rookies and risk early losses. This should be an exciting budget dilemma, not bookkeeping. Show 'After deal: 8 months runway / 14% higher projected qualifying odds / $180k less transfer flexibility' using reliable simulation-derived estimates and honest uncertainty.

Year-end club valuation/reputation may rise, but the goal is to win championships, not maximize a fake stock price. Optional board requests: compete in a regional top four, finish with positive cash, promote one developing player. These influence budget and job security **in career takeover mode only**, with toggleable pressure. Never force random game-over solely because of one unlucky upset.

## 8.3 No manipulative progression economy

All stats/cash are in-game fictional competition economics. No microtransactions, in-game betting, skin economy, virtual currency purchases or power unlocks. A sandbox funds slider is adequate for experimentation.

---

# 9. Strategy, map veto and match-day decisions

## 9.1 Simple first, deep if desired

A player needs to be able to understand tactics in 60 seconds. **Beginner:** select an identity preset with an explanation: aggressive contact, methodical default, utility-heavy executes, balanced control, retake-oriented CT, aggressive CT information plays.

**Intermediate:** set map-specific game plans: T pace, A/B bias, default vs grouped attack, economy-risk tolerance, CT aggression, rotation speed, utility conservation and site assignments.

**Advanced optional:** define 2-4 labeled playbook presets per map and conditions when the coach/IGL can switch. Avoid writing scripts with 30 in-round if/then rules.

Tactical settings are meaningful *because players, maps, side and opponent matchups interact*. High-pressure tactics can increase opening duels and gain territory while giving up trade discipline. A passive CT team can preserve players but concede sites and retakes. Strong IGL/utility players help execute more complex plans reliably.

## 9.2 Player powers and IGL identity

The IGL attribute should matter, but not by giving a flat 15% buff. It influences response to changing states, economic alignment and tactical execution. If the five individuals are technically excellent but tactically incoherent, the viewer should show spacing, delayed trades or wrong-time site rotations at a *credible frequency*.

Players cannot instantly read all enemy positions. Teams infer information from deaths, utility, contact, objective cues, elapsed time and recent opponent tendencies. Rotations and decisions must use their own information state.

## 9.3 A 1-3 choices per match intervention philosophy

Before match: map veto and preset selection. Between maps/at halftime: optionally adapt after informative trend report. During a map: only at legitimate freezes and tactical timeouts can the manager issue a constrained strategy switch. Default **Coach Delegation** uses selected pre-match policy, so viewers are spectators unless they want agency. Decisions taken **after a round resolves cannot retroactively change it**.

Avoid asking the user to click buy/push/save 24-40 times per map. Economy is strategically configured through policies with contextual overrides at breakpoints or timeouts.

---

# 10. The match engine and viewer: core flagship system

**This system is the largest quality risk. Build it first, validate it with testing, and do not claim the product is ready before it is believable.** A 2D viewer with truthful movement and clear cause/effect will beat an impressive 3D model whose agents cannot take a sensible fight.

## 10.1 Architecture: one truth, many render speeds

A **headless deterministic match engine** consumes match state, team rosters, stats, tactics, map topology, legal rules and one seeded pseudorandom stream. It emits a sequence of authoritative structured events. Both:

- **Fast simulation:** execute the exact engine in a worker/headless process, skip visual playback, return the persisted final stats/result and optional highlight reel.
- **Watch mode:** execute the same simulation incrementally, display event-driven 2D gameplay, and pause only at valid decision windows. Allow speeds 1x, 2x, 4x, 8x, 'key moments' and 'instant result.'

**Never** roll a final winner up front and then synthesize an unrelated movie. **Never** use a different formula for autosim and spectator. Where the user makes a new live decision, fork/continue the deterministic state *only from that decision point* and record it in the replay.

## 10.2 Suggested layered simulation design

1. **Series layer:** tournament bracket, BO format, map veto, side selection, team morale/cohesion, coaches, map-specific plans.
2. **Round state machine:** prepare/freeze -> buy -> opening -> mid-round -> execute/hold -> plant/retake -> round result -> settlement; with legal transitions, timers, explicit terminal states.
3. **Economy layer:** starting credits, round outcome rewards, kills/plant rewards if modeled, purchases, equipment availability, drops, saved equipment, team/individual equipment values and loss streak accounting. Prefer credible rules over exact CS2 monetary duplication; configurable data and tests.
4. **Positioning layer:** original map navigation graph, node occupation, visibility/sightlines, sound/contact cues, movement durations, route goals, bomb site access, cover and fallback points; positions must be legal and coherent.
5. **Decision layer:** agents choose actions from *limited known information*, map control, tactical orders, enemy threat estimates, alive teammates, time remaining, health/equipment and objective state. Reevaluate after major events.
6. **Combat/utility layer:** encounters depend on aim, positioning, surprise, weapon type, utility state, distance, number advantage, focus fire/trading, preparation, RNG; outcomes emit source, timestamp, attacker/victim and damage.
7. **Objective layer:** plant/defuse, timers, site control and retake; deterministic when known outcomes are forced by clock and travel feasibility.
8. **Statistics/events layer:** kills/deaths/assists, opening duels, damage, plants/defuses, trade kills, ADR, round awards, clutches, round economy, team score, analytics. All totals reconcile to engine events.
9. **Viewer layer:** animated timeline playback; cannot mutate core state on its own.

## 10.3 Sample typed contracts (illustrative, not an entire implementation)

```ts
export type Side = 'attacker' | 'defender';
export type RoundPhase = 'freeze' | 'early' | 'mid' | 'late' | 'planted' | 'ended';
export type RoundOutcome = 'attack_elimination' | 'defense_elimination' |
  'objective_detonated' | 'objective_defused' | 'time_expired';

export interface Vector2 { x: number; y: number }
export interface SimulationContext {
  seed: string;
  version: string;
  mapId: string;
  matchId: string;
  activeRosterIds: [string, string, string, string, string][];
  strategyByClubId: Record<string, string>;
}
export interface BaseEvent {
  id: string;
  matchId: string;
  mapIndex: number;
  roundIndex: number;
  msIntoRound: number;
  sequence: number;
}
export type MatchEvent =
  | (BaseEvent & { type: 'spawn'; playerId: string; location: Vector2 })
  | (BaseEvent & { type: 'move'; playerId: string; from: Vector2; to: Vector2; durationMs: number })
  | (BaseEvent & { type: 'utility'; playerId: string; utility: 'smoke'|'flash'|'fire'|'explosive'; target: Vector2 })
  | (BaseEvent & { type: 'damage'; attackerId: string; targetId: string; amount: number })
  | (BaseEvent & { type: 'kill'; attackerId: string; victimId: string; weaponClass: string; headshot: boolean; traded: boolean })
  | (BaseEvent & { type: 'plant'; playerId: string; site: 'A' | 'B' })
  | (BaseEvent & { type: 'defuse'; playerId: string; site: 'A' | 'B' })
  | (BaseEvent & { type: 'timeout'; clubId: string; policyId: string })
  | (BaseEvent & { type: 'round_end'; winnerClubId: string; reason: RoundOutcome });
```

**Important:** actual runtime types must include validation and additional legal action events (buy, save, pickup, round start, side switch, overtime, etc.). The illustrative union is a starting design, not permission to silently omit these.

## 10.4 The 2D tactical broadcast

Aim for a vivid but readable radar-focused event screen, NOT a bare PixiJS canvas with dots:

- **Center (~60-65% width):** beautifully illustrated original top-down map (2D), nav overlays, player discs/silhouettes with name/role tags, movement interpolation, team colors, bomb/site marker, visible utility area-of-effect, subtle camera zoom for high-impact events.
- **Top broadcast bar:** club crests, map, match score, current map score, round, series score, attack/defense badges, time, objective status, overtime indicator.
- **Side roster strips:** 5 vs 5 player cards with HP, equipment tier, credits, utility indicators, avatar/initial, kills/deaths, spectator selected-player emphasis.
- **Bottom information:** collapsible live event feed, economy balance, mini damage report, collapsible tactical notes and interactive timeline/scrubber for completed rounds.
- **Highlights:** pop-up player ID / 1v3 tag / 'ACE' / opening kill, satisfying audio sting, replay prompt, relevant camera focus. Do not overdo animations or obscure action.
- **Observability:** tooltip explains 'Your default yielded mid control; low flash utility left B entry exposed' with real underlying signals, not a fabricated LLM-style explanation.
- **Camera modes:** full tactical view; focus on selected player; key-moments mode; optional picture-in-picture close-up cards (not 3D).
- **Viewer interaction:** pause/resume, speed control, skip round, skip to next close round, skip to match result, map switch, player focus, scoreboard, tactical timeout. Hotkeys displayed in accessibility/help.
- **Sound:** clean HUD feedback, short non-copyrighted objective cues, abstract weapon/utility audio, arena crowd intensity during key moments, meaningful win/lose sting. No stolen CS2 SFX.
- **Performance:** aim stable 60 FPS UI/2D rendering on modest Windows hardware; tune based on real profiles; gameplay sim in worker avoids UI freezes.

**Polish principle:** the viewer must be understandable to a CS fan in 5 seconds and to a management-game fan through contextual labels in 30 seconds.

## 10.5 Credible round tactical outcomes

The following are **balance targets and invariant tests**, not empirical claims about professional CS2:

- In otherwise equal conditions, a 5v3 should convert materially more often than a 5v4, and an isolated 1v4 should be very rare. Neither guarantee should override equipment, remaining time, planted bomb or positional information.
- A higher skill team should beat an otherwise similar weaker team *over many matches*, but individual results must remain uncertain. Avoid deterministic 99/100 domination and also avoid a pure coin toss.
- Tactical strength matters in context and is never a universal 'press win' switch; map veto and role-fit are important but do not automatically decide a BO3.
- The stronger roster must be capable of losing to a better-prepared opponent, especially on a favorable map or short sample.
- Economy-driven save decisions must recognize **round remaining and future value**: no saving at the last round of a half/map when saving has no future utility; calculate objective time, feasible defuse, available players and equipment.
- Player vision and line-of-sight need truth conditions. No walking past a known visible enemy to plant; no defusing through walls; no rotation to an obviously irrelevant site after a planted objective.
- Reward smart utility use and support players without artificially inflating their kill counts.
- Use controlled probabilities, spatial checks and small bounded randomness to create coherent action; do not require heavyweight full FPS pathfinding to begin.

## 10.6 Replay integrity

Every event has stable ID, timestamp, round/series reference and seed. Replays use an event stream or resumable state + seed + action log; compression and snapshot cadence must be decided before long careers create massive files. At minimum persist the player's completed matches' summaries and highlight events; optional full replay retention may be disabled to conserve disk/cloud quota.

Any statistic shown on post-match screens (K/D/A, ADR, opening duels, clutches, equipment spent, economy rounds, side win rates) is derived from the authoritative event log. Never independently generate plausible-looking stats to fill tables. Run automated reconciliations on every match in development builds.

---

# 11. UI/UX and high-end art direction

## 11.1 Visual identity

Target inspiration: **modern esports tournament broadcast x premium sports front-office application**. A serious, confident, ownable look, not a generic blue React admin page and not a garish cyberpunk casino.

- Palette: deep neutral charcoal/navy surfaces; near-white text; one primary accent (e.g. electric teal or amber, subject to brand exploration); status colors limited to meaningful information; consistent team colors in match context.
- Typography: tasteful licensed professional sans for UI, condensed display face for headings/numbers; avoid default Arial-heavy feel and 11px text.
- 8px spacing grid (or comparable design token scale), restrained radius, subtle elevation and high-contrast focus states.
- Visual polish: animated panel transitions (120-220 ms), stat count-up where appropriate, player highlight interactions, tactile hover and selection, stage-specific tournament background, scalable logo identity.
- Authentic maps/crests: commissioned/vector originals, consistent illustrative direction. No unlicensed portraits or live external image URLs in release builds.
- First-run loading: branded progress, not a blank browser window.

## 11.2 Required information architecture

Persistent left sidebar on desktop: **Home, Roster, Market, Tactics, Calendar, Competitions, Statistics, Finances, News/History**. Manager/profile/settings available discreetly; a contextual 'Next Important Event' action is always accessible.

### Home / Club HQ
- Upcoming next relevant match/event prominently displayed with opponent, competitive significance and one-click prepare/watch/simulate.
- Overview: world rank, season objective, current form and budget runway.
- Starting five player cards with status/contract expiry.
- Smart action cards: contract expires, trade offer, prospect fits a team need.
- Right rail or secondary drawer: latest league headline, upcoming events, simple form summary.

### Roster
- Five starter slots + reserve, coherent role and CT/T assignments, map pool context.
- Compact table and detailed player profiles, clear salary and contract status.
- Drag/drop starter movement *and* accessible menu alternative; show role changes immediately.
- 'What changed?' comparison when swapping two players (roster attribute fit, salary delta, map impact).

### Player detail
- Distinct hero identity, position/role, ability radar/bar visualization, contract, market estimated value, career history, past performance, scouting confidence, rivalry stories.
- Primary controls: Compare, Shortlist, Make Offer, Extend, List/Transfer, Assign Role. Controls appear only when valid.

### Market
- Search/filter/sort table (keyboard accessible); one-click star shortlist; tabs for Free Agents / Transfer List / Contract Expiring / Prospects.
- Negotiation side drawer with all-cash-in / annual expense / affordability clearly visible. No hidden cost or surprise payroll math.

### Tactics
- Select basic playstyle instantly, inspect map-specific strengths, optional advanced side strategies, assign site/entry responsibilities with readable tradeoff descriptions.

### Competitions
- Clean bracket, current event stage, qualification path, prize/prestige, results and context; simulated world continually updates.

### Finance
- Small number of understandable KPIs, 12-month forecast and transaction ledger, 2-3 sponsor decisions, rather than an expense-entry app.

### Match viewer
- Full screen by default, no persistent giant sidebar; broadcast-quality overlays and tactical board.

### History
- Past seasons, records, awards, retired stars, team all-time roster, trophies, world timeline and rivalry stats.

## 11.3 Interaction rules

- Common action reachable in <= 2-3 deliberate clicks from relevant screen; no critical information behind 5 nested menus.
- Sortable tables, sticky column headings, filters that persist per save, consistent back behavior and keyboard shortcuts.
- Inline numbers explain calculations and sources; forecast assumptions are labeled.
- One-click action 'Delegate routine' and persistent preferred settings; never force tutorial popups repeatedly.
- Font scaling and responsive resolutions from 1280x720 to ultrawide; keyboard + mouse first; gamepad/Steam Deck only after usability/quality is proven.
- All destructive actions have intentional undo or confirmation. Save states cannot corrupt because of failed negotiations.
- Never show non-functional buttons, fake placeholders, lorem ipsum copy or stub screens in demo/release.
- Automated accessibility pass: contrast, hover/focus differences, motion-reduction mode, readable tooltips, color-independent indicators, resize text.

## 11.4 Definition of 'premium' visual quality

Not enough: a functional Bootstrap/Tailwind dashboard, an emoji as team crest, auto-generated gradients on every card, one font everywhere, clip-art players, flat radar circles or screenshots of empty lists.

Minimum bar: cohesive bespoke component library, good spacing/typography, stylized original team identities, match animation polish, transitions, full empty/loading/error states, coherent hover/selection interactions, useful data visualization, robust menu hierarchy, game-specific audio and a visually compelling title/setup screen.

A dedicated artist or designer review is budgeted as a product requirement before commercial launch, even if the first designs are assembled in code.

---

# 12. AI opponents, difficulty and long-term balance

Difficulty has three core presets **Relaxed**, **Standard**, **Hard**; tuning controls for Scout Certainty, Market Ruthlessness, Rival Tactics and Starting Resources. Do not simply make enemies roll +25 to aim or give them infinite cash. Higher settings mean more competitive transfers, slightly smarter tactics/lineups and less generous initial conditions.

AI club agents simulate career actions at world ticks. Every action passes:

1. Budget check.
2. Roster-slot and eligibility check.
3. Contract/legal ownership check.
4. Offer valuation and negotiation with preferences.
5. Transaction log and event notifications.
6. Subsequent lineup/tactic adaptation if roster changed.

**World balance must continue for 15+ seasons:** generated rookies replace retirees, wage inflation is controlled, clubs remain solvent (or reorganize plausibly), no league collapses through roster shortage, prospects don't all become stars, reputations move both ways, and trophy distribution remains varied.

Player skill influences games with map/position/tactics interaction; do not store a hidden 'winner' on match schedule records. Any match can be fully recomputed from its actual starting state/seed for QA and replay.

---

# 13. Product content and story systems

## 13.1 Emergent moments

Keep episodic narrative light and grounded in systems:

- Aging veteran wants one last chance at a title.
- Rival club poaches a prospect after their breakout tournament.
- Your AWPer becomes coveted after an international upset.
- A homegrown IGL reaches 1,000 career maps; give the moment visual recognition.
- A star's demands strain payroll; extend, cash out, or risk free agency.
- A manager archetype aggressively rebuilds a former champion, creating an unexpected rival.

Use curated conditional templates anchored to real saved-game events; avoid unlimited generative dialogues and fake press interactions. The player always knows the direct decision and stakes. Include a setting for rare / normal / minimal narrative events.

## 13.2 Club identity and content customization

Custom club name, primary/secondary colors, city/region choice and user-uploaded logo where legal. Include robust sanitization, cropping and save security. Fictional generated club identities should be attractive, varied and avoid accidental close copies of real logos.

User-imported community databases/mods are a later enhancement behind data validation and legal guidance, not an excuse to bundle unlicensed real-world team data.

## 13.3 Endgame and replayability

Permanent or configurable goals: win a Major-style global championship, take an underdog to top 10, win with a roster below a self-imposed salary ceiling, build the best academy, build a multi-title dynasty, or carry a small-market squad through years of roster turnover. New worlds start with a controlled random seed and selectable theme/competition density; no two universes identical.

---

# 14. Recommended engineering architecture

## 14.1 Technology choice and why

**Default choice for a Claude Code / TypeScript-heavy solo development workflow:**

| Layer | Recommended technology | Rationale / cautions |
|---|---|---|
| Distribution | Windows desktop via Electron, packaged for Steam | Mature desktop ecosystem, native file access via privileged main process; heavier footprint than a native game engine |
| UI | React + TypeScript + Vite | Rapid iteration, component ecosystem, sophisticated tables and layouts; create original design system, not stock admin panels |
| Match visualization | PixiJS (current maintained major version), custom shaders/effects only where useful | Fast, attractive 2D rendering and timeline animation; no need for Unity-style 3D |
| Core simulation | Pure, platform-independent TypeScript, deterministic reducer/state machine | Testable without graphics or Electron and runnable in a Web Worker or headless Node |
| State | Explicit domain services and typed commands; lightweight reactive UI store (e.g., Zustand) | Prevent UI click handlers from directly changing economy and league facts |
| Save data | SQLite through a controlled Electron main-process data-access service | Relational contracts, rounds, competitions, stats and career history; migration/version infrastructure mandatory |
| Schema validation | Zod or equivalent runtime validator for boundaries and imported data | Guard against corrupted saves, unsafe mods and invalid operations |
| Testing | Vitest for unit/property tests, Playwright for end-to-end UI, simulation batch/seed regression harness | Business-rule bugs are the highest existential risk |
| Packaging | Electron Builder/Forge, tested against the chosen native SQLite and Steam API bindings | Verify native module compatibility and Steam client launch early |
| Audio | Licensed/original assets and web audio APIs in renderer | No Counter-Strike audio reuse |

**Why not build in Next.js:** This is primarily a local/offline desktop game. Server-side routing, hosting and a web API are unnecessary complexity. React/Vite is familiar without making the product dependent on a website. There should be **no mandatory cloud database or subscription backend**.

**Why not immediately use Godot/Unity:** Both can be very good options, and Godot in particular is a serious alternative for the match renderer. However, for an interface-first title under a TypeScript-focused AI-assisted development workflow, React/Pixi allows rapid iteration and unusually powerful management tables. A technical prototype should verify animation performance, native file packaging and Steam integration before committing irrevocably. If the viewer/desktop constraints cannot be met efficiently, switch early rather than forcing the stack.

**Critical security caveat:** Some community Steamworks/Electron integration examples disable context isolation and enable Node integration. Do **not** adopt that pattern for a commercial product. Keep `contextIsolation: true`, `nodeIntegration: false`, sandboxing where compatible, a restrictive content-security policy and a narrow, validated Electron preload IPC boundary. Run privileged Steam/file/SQLite operations in the trusted main process; conduct an explicit native-module/overlay proof-of-concept and choose integration based on verified compatibility. Never load untrusted remote content in a privileged window. Follow current Electron security guidance.

## 14.2 Domain boundaries

Architecture should contain five separable modules with **zero React import dependencies in the game domain**:

1. `core/world`: calendar, world generation, seasons, leagues, reputation, rankings, tournaments, free-agent and transfer windows, rival-club decision policies.
2. `core/management`: players, role fit, scouts, contracts, player movement, club finances, sponsorships, development, AI managers.
3. `core/match`: maps, rules, seeded PRNG, series, round state, buy logic, decisions, spatial positioning, visibility, combat, objective logic, event emission, canonical stats.
4. `app/persistence`: save/load, SQLite migrations, autosave, versioning, event/snapshot retention and backward-compatible import/export; UI cannot issue arbitrary SQL.
5. `app/presentation`: React screens, design system, animations and Pixi match renderer, sound, localization, accessibility.

Core game code takes commands and returns results/events, never queries the DOM, network or global time. Example: `advanceWorld(world, { to: nextEvent }, rng)` returns `{ newWorld, events }`. UI commands pass through a validator and domain service; a transaction commits validated changes or none at all.

## 14.3 Project layout proposal

```text
project-apex/
  apps/desktop/
    electron/main.ts
    electron/preload.ts
    src/app/
    src/screens/
    src/components/design-system/
    src/features/match-viewer/
    src/assets/
  packages/core/
    src/world/
    src/entities/
    src/management/
    src/competition/
    src/match/
      rules/
      maps/
      agents/
      economy/
      spatial/
      events/
      replay/
      stats/
    src/rng/
    src/types/
  packages/persistence/
    src/repositories/
    src/migrations/
    src/validators/
  packages/seed-content/
    original-maps/
    team-identities/
    localizations/
  packages/test-harness/
    fixtures/
    batch-sim/
    golden-seeds/
    invariant-tests/
  docs/
    GAME_DESIGN.md
    DESIGN_SYSTEM.md
    TECH_ARCHITECTURE.md
    DEVELOPMENT_LOG.md
    BALANCE_REPORT.md
    KNOWN_ISSUES.md
  scripts/
  package.json
```

This is a suggested structure, not a reason to spend days on monorepo tooling. Choose a simple npm/pnpm workspace only if it clearly improves boundaries.

## 14.4 Save-file strategy

- Save schema has explicit `schema_version`, `simulation_version`, world seed, timestamp and integrity metadata; retain all essential entities using stable IDs rather than player names.
- Before migrating or overwriting a save, preserve a previous known-good copy; use atomic file/transaction operations.
- Autosave on user-controlled advancement and important transactions; enable manual named slots and multiple careers. No online dependency.
- Replay logs use compact event representations and optionally snapshots; avoid saving gigabytes of repeated animation frames. Distinguish saved career history from optional full replays.
- A user upgrading from older versions should retain career progress wherever feasible; support migrations and export for bug reports.
- Be conservative with Steam Cloud quota and test cloud conflict cases; large binary replay collections should be optional/local by default.
- Every generated ID is unique and referential integrity is checked; orphaned lineups/roster IDs and players appearing on two teams are illegal.

## 14.5 Determinism, event sourcing and live decisions

Implement a seeded PRNG with explicitly documented algorithm/version; never use `Math.random()` within core gameplay. If the same initial snapshot, seed, engine version and recorded commands are supplied, the same events/results/stats must emerge. Distinguish aesthetic animation randomness from simulation randomness and never let visuals advance the authoritative RNG.

**Live intervention protocol:** the engine runs until a legal decision gate; freezes the authoritative state; a manager command is validated; the command is appended to the deterministic command log; the engine resumes. When a user watches, the simulation can run incrementally; when a user skips, the very same engine executes immediately with default/previously selected policies. Testing must show watch versus sim yields an identical result under identical commands and seed. In-memory round states are not persistent truths until validated/committed.

## 14.6 Performance and safe extensibility

- Keep the main process responsive. Run mass simulations in a worker thread/Web Worker and show non-blocking progress for large jobs.
- Separate domain and presentation clocks; rendering at 60 FPS must not alter match results at lower FPS.
- Avoid a huge per-frame DOM state update; batch only relevant animation state to Pixi and UI overlays.
- Indexed querying/search/pagination for hundreds or thousands of historical player records.
- No network API keys or content-generation credentials embedded in release executable.
- Any mods/imports are data-only, validated and versioned; never execute arbitrary community scripts inside a privileged Electron process.

---

# 15. Data schemas and simulation balance contracts

## 15.1 Minimum database entities

| Entity | Essential relationships and fields |
|---|---|
| `World` | seed, version, current date, settings, league IDs, chosen user club |
| `Club` | stable ID, region, branding, balance, payroll obligations, prestige, AI GM archetype, ranking, roster ID set |
| `Player` | stable ID, unique identity, age, skills, potential range, career phase, role proficiencies, preferences, club status, archived career |
| `Contract` | player/club IDs, start/end, wages, guaranteed obligations, clauses, transfer rights and history |
| `Offer` | offering/receiving party, player(s), cash terms, type, expiration, state, reasons/counteroffers |
| `FinancialTransaction` | unique immutable ID, originating event, club, amount, date, categorized ledger entry |
| `Tournament` | stage, eligibility, region, dates, prize structure, entry and qualifying rules |
| `Series` | two valid club entries, format, seed, veto result, map results, final winner |
| `MapDefinition` | topology, sites, paths, cover, sight lines, simulation geometry and illustration coordinates |
| `Match/MapState` | roster snapshot, roles, side, credits, equipment, clock, round counters, tactics, RNG state, live command log |
| `MatchEvent` | typed event, sequence/time, authoritative participants and values |
| `Statistic` | derived match/season/career aggregates, provenance and generation version |
| `News` | source event IDs, short headline template, relevant clubs/players, timeline/date |
| `SaveManifest` | schema/simulation version, save type, timestamp, migrations/integrity information |

**No duplicate source of truth:** cash is derived from transactions plus opening balance; match stats derive from match events; contract cost follows contract terms; a player has one ownership state. Use cached aggregates only if invalidation/reconciliation is tested.

## 15.2 Where every player rating matters

Implement **causal attribute contributions** and test them individually:

| Attribute | Observable influence (examples) |
|---|---|
| Rifling | Encounter win probability in rifle situations, adjusted by positioning/trades/weapon availability |
| AWP | Long sightline strength, picks and weapon assignment preferences; counterbalanced by economy and mobility |
| Opening aggression | Willingness/success to take first contact; creates entry opportunities but may increase exposure |
| Positioning | Survival behind cover, anchoring and timing of advantageous fights |
| Utility | Effectiveness, timing and resource value of flashes/smokes/denials; supports teammates |
| Game sense | Contextual rotation, objective inference, save/retake judgment |
| Teamwork | Trade spacing and coordination; makes two-player protocols more reliable |
| Clutch | Risk evaluation and execution under numerically disadvantaged/high-stakes conditions, with bounded impact |
| Calling | Effective plan selection/adaptation based on imperfect information |
| Adaptability | Reduced loss from side/map/role switches and nondefault tactical plans |

Avoid displaying a player attribute that never affects the simulation; avoid static `overallRating > x` shortcuts. Attribute weights vary by role/map/weapon/phase; automated sensitivity sweeps verify increasing an attribute has a sensible *average* effect and no universally dominant attributes arise.

## 15.3 Economics invariant rules

- Every expense has a matching debit; every fee paid between clubs has matching payer/recipient transfers; sponsorship/prize inflows are minted only from explicitly defined world external sources.
- All transaction settlements idempotent; rerunning event processing cannot pay a tournament twice.
- Signings/fees cannot create negative cash beyond explicit, bounded credit policy. Future guaranteed salary counts in commitment forecast; no invisible salary forgiveness.
- Existing club contracts prevent illegal double-signing; free agents can accept at most one offer even if offers resolve simultaneously.
- Player release, contract expiration and transfer ownership are atomic. No duplication by save/load or simultaneous AI offers.
- AI evaluates contract *cost*, not just an unsigned wage number; difficulty controls smarter behavior, not financial cheats.

## 15.4 Competitions and stats invariants

- A regulation map requires a valid round winner each round and ends only at a legitimate terminal condition; no more rounds after a winner has clinched.
- Score always equals count of awarded rounds; map/series winners match those scores; side switches occur at correct boundaries.
- A kill assigns exactly one victim death and updates live count; suicides/environmental events require explicit representation.
- Opening-duel stats and clutches derive from event state; team K/D aggregate reconciles with all kill/death events.
- Bomb plant requires available bomb, living planter at valid site and legal phase; defuse requires planted objective and defusing side; timeout loss follows explicit rule.
- Economy purchases require sufficient funds; equipment transfers cannot duplicate items; no impossible retention of consumed utility.
- Series map veto cannot yield duplicate/illegal selections; all maps exist in pool; seeded tie breakers stable.

## 15.5 Quantitative testing methodology

Do not claim exact realistic CS outcomes without calibrated data. Instead run repeatable batch sims. Provide a `npm run sim:balance` command producing charts/CSV for:

1. 10,000 equal-team maps: side win-rate distribution, round lengths, economy round distribution, overtime frequency and closeness.
2. Skill-strength sweep across small, medium and large ability gaps: higher skill should improve expected win rate monotonically; measure variance and confidence intervals.
3. Tactical sensitivity: plan changes should produce visible but bounded changes conditional on map/opponent; no universal exploit.
4. Map-pool sensitivity: specialists become valuable on suitable maps, not unbeatable everywhere.
5. Starting advantage scenarios: 5v4, 5v3, 4v2, 1v3 under fixed economy, objective and time conditions to test coherent ordering, not invented fixed CS2 percentages.
6. Economy phase trends: saving, eco buying and force buying vary with stakes/score/available cash; late-half no-value saves should be uncommon/illegal under policy.
7. Career simulation of 15-25 seasons with 20-100 different seeds: budget solvency, filled rosters, roster churn, transfer volumes, ranking movement, talent inflation, aging and league persistence.

Store baseline histograms and fail CI on serious regression or impossible events; use tolerance bands for noisy outcomes. Have experienced Counter-Strike viewers review real playback of unusual edge cases: a model can pass aggregate statistics while visually making stupid rotations.

---

# 16. Vertical slice: the first playable game

**Do not begin by creating 48 clubs, 7 maps and 300 players.** First build one entertaining fully integrated loop. The slice is the irreversible make-or-break proof that AI-assisted coding can actually deliver the design.

**Slice scope:** 8 fictional clubs, ~60 players (starters + reserves/agents), 2 distinct original maps, one 8-team event with qualifying/seeding, plausible budgets, basic free-agent signing plus one cash transfer negotiation, map veto, tactics presets, one genuine full BO1 or BO3 simulation, viewer, match recap, save/load, world advancement and one offseason progression pass.

**First-session path:**

1. Launch to a polished title screen, create/select a club and difficulty. Begin with five playable starters, clear roster quality and a real budget.
2. Dashboard signals an actionable weakness and upcoming match. Player inspects a prospect and compares roster fit.
3. Player can sign a free agent through a validated contract flow or try a transfer/buyout.
4. Player chooses maps/tactic preset, watches interactive seeded radar match with correct economies, utility, planting, kills, time and scoreboard.
5. Player receives a match report showing what happened and why; gains or loses rewards/prestige; advances to another fixture.
6. Player saves, closes and reopens with identical club finances, lineup, match history and calendar.

**Vertical-slice ship gate:** a stranger can play 30-45 minutes without developer instructions and independently say which specific choices were interesting; a knowledgeable tactical-shooter player can inspect the viewer without immediately encountering nonsensical behavior; no buttons pretend to work; saves survive restarting; match stats reconcile.

**Demo design recommendation:** once the slice is polished, expand it into a 45-90 minute public Steam demo with a clear conclusion, two to three roster decisions and one meaningful tournament arc. The demo should demonstrate the premium viewer and economics instead of dumping every mechanic at once. Save transfer to the full game is nice-to-have, not a launch blocker.

---

# 17. Implementation roadmap, delivery gates and work order

A single ambitious instruction like 'build the whole Steam game' will produce superficial code. Use the roadmap below and require a playable build and evidence at every gate.

## Phase 0 — Feasibility/prototype spikes

**Deliverables:** engine skeleton, typed domain contracts, seeded RNG, static PixiJS scene with map image and 10 moving units, basic desktop package, SQLite smoke test, secure native/preload API proof, Steam API compatibility spike in a private environment if developer credentials exist.

**Gate:** Windows executable launches; consistent results in headless engine; animation remains fluid; save file survives restart; tooling documented. If Electron/Steam compatibility requires insecure settings, stop and choose safer alternative.

## Phase 1 — Deterministic one-map competition simulator

**Deliverables:** two original map topologies with navigation/visibility tests, complete round state machine, economy and objective logic, seeded event timeline, side swaps, map terminal rules, sample stat reports, 10,000-match test harness.

**Gate:** simulator can produce plausible full results with no UI and passes event/stat invariants. No match viewer illusions until engine exists.

## Phase 2 — Tactical broadcast viewer

**Deliverables:** map illustration assets (placeholder art acceptable during proof, not release), event-driven animated tokens and utility, round clock, bomb sites, team rosters, kill feed, damage/economy overlays, pausing, speeds, rewind/scrub for completed rounds, highlights and round/post-match recap.

**Gate:** one entire map can be watched and understood; watch and sim produce same data on same seed and decisions; 60 FPS target on baseline test machine; user can navigate without a developer.

## Phase 3 — Club management vertical slice

**Deliverables:** real roster table/profiles, contracts with end dates, free-agent market, money ledger, one transfer flow, team/market AI, meaningful tactical presets, start-to-finish 8-team tournament. Integrate into actual world-save system.

**Gate:** a 30-45-minute coherent session with at least three consequential decisions; no duplicate transfers, budget errors or repeated system spam.

## Phase 4 — Living season and broader game content

**Deliverables:** 4-region 48-club proposal only after feasibility proof; qualifiers, regional/cross-region events, rankings, rival managerial personas, role-aware progression, prospect generation, broader scouting, sponsor decisions and 7 original maps; 15-season automated aging/finance tests.

**Gate:** multiple careers can be run for 15 years without crashes or dead leagues; no rampant skill/wage inflation; AI makes comprehensible decisions and recovers from setbacks.

## Phase 5 — Premium game UX and commercial content

**Deliverables:** unified design system, bespoke club art/crests, match effects/sound, strong onboarding, contextual analytics, legacy/history screens, rebindable or discoverable hotkeys, accessibility options, quality settings, screen resolution handling, data-driven event content, functional empty and error states.

**Gate:** screenshots look like a purposeful game; user testing shows the majority of testers reach the first match quickly; routine actions can be delegated.

## Phase 6 — Steam-ready production and QA

**Deliverables:** Windows distribution build, save migrations and backups, store capsule/screenshots/trailer, Steam achievements/cloud (if tested), content survey, crash logs with opt-in privacy practices, demo build, public feedback loop and performance profiling.

**Gate:** verified Steam-client launch, offline launch, cold-install, high-DPI, windowed/fullscreen, 720p/1080p/1440p, extended save simulations, store submission and release compliance.

## Scope priority matrix

| System | Must work for vertical slice | Target for launch | Later / only if players demand it |
|---|---|---|---|
| Deterministic MR12 rounds/economy/objective | Yes | Polished | Advanced niche rules |
| Tactical 2D map viewer | Yes | 7 map artworks + full polish | Experimental 3D camera |
| Player role attributes and fit | Yes | Advanced map/side profile | Extremely granular per-weapon micro-ratings |
| Free agency + contracts | Yes | Rival bidding, clauses and future payroll | Complex agent politics |
| Transfers/buyouts | One realistic flow | Cash plus player exchanges | Loans and multi-club deals |
| Scouting and prospects | Compare basic reports | Persistent uncertainty and new generations | Academy subdivisions |
| Sponsors/finances | Cash + wages + tournament prize | 2-3 meaningful offer archetypes | Complex merchandising |
| Season circuit | One small event | Multi-region annual cycle | Detailed organizer licenses |
| Career history | Season summaries | Trophies, player legacies, rivalries | Historical media archive |
| Steam Workshop/mods | No | Optional if stable | Full Workshop ecosystem |
| Multiplayer/online | No | No | Only with overwhelming demand |
| Wear and tear | **Never** | **Never** | **Never** |

**Schedule realism:** An indie developer with Claude Code should treat this as a substantial commercial project, not a weekend application. A vertical slice can be developed in stages over months, but high-quality launch content, art, testing and balancing could take a year or more depending on skill and contractor involvement. Do not promise a fixed completion date before proving the core match engine.

---

# 18. Test acceptance criteria / commercial quality bar

## 18.1 Functionality

- 100% of all visible primary buttons perform a documented action; disabled buttons explain why they are unavailable.
- New save -> sign player -> roster/payroll update -> play match -> report -> progress season -> save -> restart -> restore succeeds across repeated tests.
- No losing, duplication or negative cash from transfers. All fees, salary and contract obligations reconcile.
- Rival teams' decisions are actionable and competitive, but their rosters remain legal.
- All map/bomb/overtime edge cases follow documented rules; no invisible kills or generated ghost statistics.
- The player can fast-sim a season without clicking 70 repeated dialogues.
- No blocking errors on expected missing data; accessible message explains the issue and recovery.

## 18.2 Experience

- The first meaningful decision arrives within a few minutes, the first match within about 10-15 minutes. Targets to validate rather than arbitrary launch claims.
- Each transfer and signature shows clear short-term and future consequence before acceptance.
- The viewer conveys position, objective, time, score, health, alive count and key utility at a glance.
- Stronger teams win more often *on aggregate*, but underdogs win sometimes for understandable reasons.
- Multiple strategies are viable; no single aggressive/default exploit wins regardless of roster/map.
- Actionable inbox items are rare, clear, linked to relevant screen and skip safely when delegated.
- Buttons and lists remain legible, performant and keyboard accessible at baseline resolutions.

## 18.3 Reliability and release

- Daily automated unit/invariant tests, plus seeded replay regression suite and CI for every main branch change.
- Automated batch run of 15-25 seasons across many independent seeds without invalid rosters, economy overflow or fatal exceptions.
- Save/load checksum, fallback copy and migration tests from each published schema version.
- Tested offline mode. Optional Steam services should degrade gracefully outside a logged-in Steam context where licensing allows.
- No unlicensed real-world assets, copyrighted gameplay sound files, copied maps, trademark-implying official league claim or third-party likenesses.
- Human art/design review and independent usability test before any paid launch.

---

# 19. Product risks and commercial strategy

## 19.1 Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| Match simulation feels arbitrary or unintelligent | Critical | Start headless; impose invariant tests, map legality, observation-based decisions, CS fan playback review |
| Scope explosion, no shippable game | Critical | Slice first; enforce phase gates and feature deferral |
| Smart-looking but broken AI contracts/economy | Critical | State machine, transactional ledger, bounded valuations, long-run league tests |
| UI is generic/unclear | High | Custom game-specific visual identity, design system, user testing, professional art pass |
| Legal issues with CS2/team assets | High | Original names/maps/visuals/audio/brands, permissions for specific licenses, legal review |
| Native desktop/Steam compatibility | High | Package/proof test in Phase 0; do not compromise security for quick overlay support |
| Generated content raises rights/disclosure questions | High | Asset provenance records, human review, Steam content survey accuracy |
| Balance gets distorted across 15 years | Medium-high | Automated dynasty regression tests and inflation/scarcity limits |
| Players struggle to understand why they lost | Medium-high | Match explanations derived from actual events, scouting and map context |
| Indie release visibility is poor | High | Coming Soon page, trailer footage of actual viewer, demos, creator outreach, test with target niche early |

## 19.2 Pricing and target audience (hypotheses, not forecasts)

**Core niche:** dedicated Counter-Strike viewers, Football Manager/OOTP enthusiasts, sports franchise dynasty players, esports fans, streamers who enjoy emergent sporting stories. Do not assume all CS2 players enjoy management games.

**Positioning line:** *Build the roster. Call the strategy. Watch the clutch. Create a dynasty.*

**Initial pricing test:** $19.99 USD premium single-purchase, possibly $24.99 if the viewer, 7 maps and career system are polished and testers demonstrate strong retention. Market research supports comparable paid products, not a guaranteed conversion rate; validate with a Steam page and creator feedback.

**Potential marketing hooks:**

- Watch your undrafted prospect clutch a global final on a readable tactical broadcast.
- Sell your best AWPer for a massive fee and attempt to rebuild.
- Build a championship five with a fraction of the top team's payroll.
- Win a best-of-three by exploiting the opposing map pool.
- Advance 10 seasons and view your complete record book.

**Promotion plan:** release a credible gameplay trailer only when it shows actual in-engine footage; get a Coming Soon page online as soon as assets are representative; collect wishlists, demo funnel engagement and qualitative feedback. Playtest with both hardcore CS players and management-game enthusiasts because one audience will catch simulation errors and the other will catch UX chores.

**Public demo / Steam Next Fest:** plan for a future eligible festival when there is a stable, compelling 45-90 minute demo, not according to an arbitrary date. October 2026 is far too soon for this starting-from-zero project. Steam's 2027 fest schedule and eligibility must be rechecked as plans develop.

## 19.3 Steam requirements and compliance checklist

Based on current Steamworks documents, new apps carry a **$100 Steam Direct fee per app**, an initial **30-day waiting period** before first release, and a **Coming Soon page visible for at least 2 weeks** before launch; Valve reviews store presence and product builds. These are operational requirements, not the primary project budget. Verify terms in Steamworks near submission.

Steam Cloud is optional and can sync local save files via Auto-Cloud if correctly configured. Prioritize reliable local saves before cloud. Steam's content survey distinguishes pre-generated AI material distributed to players (art, text, audio, etc.) from ordinary developer productivity assistance; explain shipped generative AI material and any live AI appropriately. Do not assume 'vibe coding' either automatically requires or removes content disclosure. Maintain asset ownership/provenance documentation and verify exact current policy.

Keep a branding/IP checklist: trademark research for final game title, no Valve/Counter-Strike marks or copied HUD/weapon/map assets without permission, original logos and player identities, licensed stock/fonts/audio, disclosure and privacy compliance, and developer agreements. Obtain professional legal advice for commercial IP questions.

---

# 20. Claude Code execution instructions (IMPORTANT)

> **You are the principal engineer, simulation engineer and interim technical art director for PROJECT APEX. Read this entire document before implementation. Build a serious, polished single-player desktop game for eventual paid Steam sale, not a wireframe, static template or pretend demo. When a spec choice is ambiguous, decide and document a sensible design; preserve the hard boundaries.**

## 20.1 Non-negotiable working rules

1. Read `docs/GAME_DESIGN.md` and the repository before touching files. If starting from scratch, create concise `docs/TECH_ARCHITECTURE.md`, `docs/DEVELOPMENT_LOG.md`, `docs/KNOWN_ISSUES.md` and a phase task tracker.
2. Start with **Phase 0 feasibility**, not with every UI screen. Verify native packaging, SQLite, rendering and an offline deterministic core. Treat Steam native compatibility as a gated spike—not a reason to enable insecure browser settings.
3. Work in small feature-vertical increments: implementation -> automated tests -> launch/run instructions -> gameplay verification -> concise change log. No 'finished' claims without verifying commands and actual outcomes.
4. No placeholder actions disguised as finished controls. No fake match results, dummy API responses, hard-coded roster states masquerading as persistence, randomly assembled stats, or attractive screens without integrated gameplay.
5. All core simulations must use a versioned deterministic RNG. All displayed match statistics and narrative explanations must come from authoritative actual events.
6. Store and validate financial transactions and contracts in one domain model and use atomic commits. AI clubs obey the same economic and roster constraints as the user.
7. **Never implement fatigue, wear-and-tear, injuries, stamina, sleep, burnout, training-grind or equipment maintenance systems.** Do not rename them to circumvent the instruction.
8. Every screen must have real empty/loading/error/disabled states, coherent keyboard and pointer interaction and consistent navigation. UX is product functionality.
9. Prefer original, data-driven content and legally safe fictional branding. Do not copy Valve maps, logos, sounds or roster likenesses.
10. Keep performance, save compatibility and testability in mind from the start; do not build everything as one React component or one `gameEngine.ts` file.
11. If a requested detail would balloon scope, implement a smaller complete version and log the deferred scope openly. A robust smaller game beats a half-working giant.
12. No mandatory server, cloud account, microtransactions, online authentication, chat systems or multiplayer.
13. Track test results with explicit evidence. If a dependency is blocked, document why and create a minimal stub **only inside a separately labeled experimental spike**, never pass that off as a finished player-facing feature.
14. Require visual screenshot review of key screens and match viewer, test 1280x720 through 2560x1440 layouts, and complete manual user-journey playthroughs.

## 20.2 Required initial response from Claude Code

Before writing most of the code, output:

- 1-page architecture decision record: chosen stack, reasons, risks, fallback stack and packaging feasibility plan.
- Brief map of domain entities and commands/events.
- Phase-by-phase task plan, with earliest playable vertical slice and objective proof points.
- The first 8-12 concrete tasks, arranged in dependency order, with files/tests expected.
- Anything needed from the developer to enable Steam packaging; **do not** block all offline game development if Steam credentials are absent.

Then execute **Phase 0** autonomously with reasonable defaults and document exact run commands. When Phase 0 gates pass, continue to the deterministic match simulator. Don't pause for approval after every ordinary implementation detail. Do not jump directly to a fictional all-features-complete game.

## 20.3 Required working commands (representative)

Choose appropriate package scripts; supply instructions for:

```bash
npm install
npm run dev                 # launch desktop development game
npm run test                # unit and domain invariant suite
npm run test:e2e            # integration / desktop user journey suite
npm run sim:balance         # write batch sim reports and anomaly summary
npm run sim:career          # simulate 15+ years, assert all invariants
npm run build               # production build
npm run package:win         # installable/Steam-ready Windows directory/build
```

If commands differ because of the chosen stack, document the alternatives. No external paid service should be required for local development.

## 20.4 Required quality self-review after each phase

Report: (a) playable functionality added, (b) tests performed and results, (c) issues or limitations, (d) screenshot/artifacts of visible UI where possible, (e) what phase gate passed, and (f) next highest-value task. Do not hide known defects. Do not spend most of the phase making attractive mockups before domain functionality exists.

## 20.5 Initial build order in one sentence

**Seeded 5v5 simulator -> true tactical viewer -> playable roster/contract/transfer loop -> one tournament -> save/load -> living career world -> content expansion -> premium polish -> Steam QA.**

---

# 21. Research and authoritative source links (checked October 12, 2026)

The following are research sources, **not** code dependencies. Store ratings are transient; developer feature announcements are marketing claims, not independent verification of implementation quality. Player criticism is qualitative feedback, not a statistically representative survey.

**Competitor Steam pages:**

- Teamfight Manager: https://store.steampowered.com/app/1372810/Teamfight_Manager/
- Teamfight Manager 2: https://store.steampowered.com/app/3009300/Teamfight_Manager_2/
- Esports Godfather: https://store.steampowered.com/app/1278540/Esport_Godfather/
- Esports Manager 2026: https://store.steampowered.com/app/2749950/Esports_Manager_2026/
- Rush B: Esports Manager: https://store.steampowered.com/app/4417410/Rush_B_Esports_Manager/
- Esports Manager: FPS: https://store.steampowered.com/app/4326170/Esports_Manager_FPS/
- Motorsport Manager: https://store.steampowered.com/app/415200/Motorsport_Manager/
- Out of the Park Baseball 26: https://store.steampowered.com/app/3116890/Out_of_the_Park_Baseball_26/
- Esports Manager 2026 reviews / user-surfaced potential bugs: https://steamcommunity.com/app/2749950/reviews/?browsefilter=toprated
- Esports Manager 2026 community issue example: https://steamcommunity.com/app/2749950/discussions/0/563661921716293279/

**Sports franchise features and primary publications:**

- Madden NFL 27 Franchise Deep Dive (Persona Engine, trade logic, contracts, league behavior): https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-27-franchise-mode
- Madden NFL 27 franchise issue fixes (shows practical QA risks): https://www.ea.com/games/madden-nfl/madden-nfl-27/news/madden-nfl-27-title-update-september-16
- MLB The Show 26 official franchise manual (trade hub, counteroffers, streamlined control): https://mlb26.manual.theshow.com/en/franchise-1.html
- NBA 2K26 official MyNBA announcement (adjustable simulation, banners, scenarios): https://newsroom-uk.2k.com/news/endless-possibilities-await-as-mynba-levels-up-in-nbar-2k26

**Steamworks and architecture:**

- Steam Direct Fee: https://partner.steamgames.com/doc/gettingstarted/appfee
- Steam onboarding and timing: https://partner.steamgames.com/doc/gettingstarted/onboarding
- Steam Coming Soon: https://partner.steamgames.com/doc/store/coming_soon
- Steam Cloud: https://partner.steamgames.com/doc/features/cloud
- Steam content survey including shipped generative AI material: https://partner.steamgames.com/doc/gettingstarted/contentsurvey
- Steam Next Fest: https://partner.steamgames.com/doc/marketing/upcoming_events/nextfest
- Electron security: https://www.electronjs.org/docs/latest/tutorial/security/

---

# 22. Producer's final scope decision

Build a game that players will describe by stories instead of feature counts:

> 'I signed an unknown 18-year-old because his aggressive entry profile worked on our best map. Two seasons later, he carried my cheap roster into the world championship. I sold him for a fortune, rebuilt around our veteran IGL, and watched us upset his new superstar team in the final.'

If the game consistently generates credible, emotionally memorable stories of that kind, backed by a trustworthy match simulation and fast premium UI, it has the foundation of a sellable indie management game.

If instead it produces generic dashboards, dozens of tasks, arbitrary random scores, nonsensical offers and an attractive but fake spectator viewer, it has missed the product.

**Make the match engine honest. Make the roster market compelling. Make the interface beautiful. Make the season flow effortlessly.**
