# PROJECT APEX — Counter-Strike Economy, Roles & Utility Research
**Research date:** October 12, 2026  
**Audience:** Claude Code, APEX game design, simulation and QA  
**Status:** Source-grounded mechanical facts + explicitly labeled design recommendations. Not a measured professional buy-frequency dataset.

## 0. Executive conclusion
In CS-style esports, economy is an inter-round team decision. Players normally synchronize eco, force, half-buy and full-buy plans, with weapon drops and saved gear smoothing differences in personal money. Roles bias *allocation* rather than imposing fixed purchases. Utility affects routes, vision, information and the likelihood of trades and retakes. APEX should simulate these automatically; the human GM should choose broad tactical/economic philosophies, not purchase five inventories every round.

## 1. Sources, strengths and limitations
- CS2Sell, *CS2 weapon stats guide*, October 9, 2026, reports weapon prices from the October 8 game data and cites SteamTracking and dated Valve updates: https://cs2sell.com/blog/cs2-weapon-stats-guide
- CounterStrikeStats, *Economy Guide*, reviewed October 6, 2026, discusses loss-bonus step-down behavior: https://counterstrikestats.com/guides/cs2-economy-guide/
- CSDB.gg, *Economy Guide*: https://csdb.gg/guides/economy-guide/
- TradeUpAcademy, *Make a Team Buy*, updated October 10, 2026: https://tradeupacademy.org/articles/cs2-economy-money-management-full-buy-guide-2026
- HLTV player statistics expose actual utility metrics such as flashes per round, utility damage, flash assists, and time opponents flashed; individual career or selected filters are **not representative global estimates**: https://www.hltv.org/stats/players/3055/flusha
- Daily CS Nades Cache utility study: 408 throws across a curated guide catalog, not a representative sample of all tournament throws: https://dailycsnades.com/learn/cache-pro-utility-analysis

**Methodological warning:** No comprehensive, representative, 2026 professional role-by-role purchasing and grenade-usage sample was located in this research. Do not label role distributions or the synthetic calibration targets below as measured data. Obtain professional demo parses before trying to closely match real-world usage frequencies.

## 2. Current reference item costs (USD-equivalent CS2 in-game currency)
Prices from October 2026 game-data analysis. APEX should version its item catalog and implement updateable prices. The game may need original item names and assets for a commercial product.

| Category | Item | Side | Price |
|---|---|---|---:|
| Rifle | AK-47 | T | 2700 |
| Rifle | M4A4 | CT | 2900 |
| Rifle | M4A1-S | CT | 2900 |
| Rifle | Galil AR | T | 1800 |
| Rifle | FAMAS | CT | 1950 |
| Rifle | AUG | CT | 3300 |
| Rifle | SG 553 | T | 3000 |
| Sniper | AWP | Both | 4750 |
| Sniper | SSG 08 | Both | 1700 |
| SMG | MAC-10 | T | 1050 |
| SMG | MP9 | CT | 1250 |
| SMG | MP7 / MP5-SD | Both | 1400 |
| Shotgun | MAG-7 | CT | 1300 |
| Pistol | P250 | Both | 300 |
| Pistol | Tec-9 / Five-SeveN | T / CT | 500 |
| Pistol | Desert Eagle | Both | 700 |
| Armor | Kevlar | Both | 650 |
| Armor | Kevlar + helmet | Both | 1000 |
| Utility | Smoke | Both | 300 |
| Utility | Flash | Both | 200 |
| Utility | HE | Both | 300 |
| Utility | Molotov | T | 400 |
| Utility | Incendiary | CT | 500 |
| Utility | Defuse kit | CT | 400 |

**Inventory limits:** As a baseline use no more than four grenades per player, at most two flashes and at most one of each other grenade type, and restrictions preventing incompatible purchases (e.g., Molotov/incendiary depending on side). Check the installed game ruleset before locking details.

## 3. Money rules and reconciliation
- Start each half with **$800 per player**; cap wallet at **$16,000**.
- Standard round win: **$3,250** per player; bomb explosion / successful defuse: **$3,500** for relevant winning team in standard competitive rules.
- Round-loss ladder: **$1,400 / $1,900 / $2,400 / $2,900 / $3,400** at successive loss stages.
- Importantly, the loss counter **steps down after a win**, not necessarily resetting straight to the first stage. Do not code the old full-reset rule.
- T planted-bomb loss award and planter's award must be tracked separately; typical values are **$800 per T player** for a lost planted round and **$300** planter award. Verify edge cases from the chosen current game ruleset.
- Baseline kill awards are typically $300 for standard rifles/pistols, $100 for AWP, $600 for most SMGs and $900 for many shotguns, with specific exceptions. Store reward **by weapon**, not only class.
- Saved equipment survives the round; spent utility does not. Armor, helmet, utility, kits and dropped weapons must have individual persist/drop semantics.
- Player wallets, inventory carry-over, drop-to-teammate transactions, weapon pick-ups, kill rewards and objective awards must reconcile exactly against the round event log.
- T players surviving a bomb-timeout loss can have different award rules; model the precise ruleset rather than granting every loser the same default automatically.

## 4. Buy categories — decision logic, not only dollar thresholds
- **Pistol:** $800 opening allocation at the start of each half; mix armor, utility, kits and pistol upgrades according to plan.
- **Eco:** Minimal spending to restore team finances; objective can be plant, economic damage, or opportunistic weapon recovery.
- **Half-buy:** Limited purchases bounded by a **next-round guaranteed full-buy target**. Can include upgraded pistols, armor, limited utility.
- **Force:** Team deliberately spends despite insufficient standard full-buy funds, accepting poor next-round finances for immediate upset chances.
- **Full buy:** Team can field its planned rifles/sniper, armor and tactical utility; per-player costs vary substantially due to carried gear and roles.
- **Bonus:** Winners keep profitable SMGs/cheaper gear after anti-eco to strengthen future economy, accepting a tactical disadvantage against upgraded rifles.
- **Hero rifle/AWP:** One high-impact player gets premium equipment while teammates take weaker equipment. Rare, situational and strategically coherent rather than random.
- **Save in-round:** Decide whether surviving players attempt a low-probability retake or preserve valuable equipment. This is separate from pre-round eco.

**Do not classify buys only by money spent**: an AWPer with a carried AWP may spend little and still have a powerful full-buy loadout; a team that spends $5,000 each on poor combinations can be strategically broken.

## 5. Typical role priorities — research-informed qualitative archetypes (NOT measured frequencies)

| Role | T buy preference | CT buy preference | Utility intent | Important flexibility |
|---|---|---|---|---|
| Entry | AK, armor/helmet, flash and/or smoke | M4/SMG, armor, entry/retake flash | Support initial fights, clear space | Teammates often throw flashes for entry; entry can have little utility on fast rounds |
| Primary AWPer | AWP prioritized if affordable; Galil/AK/Scout when not | AWP prioritized, save AWP where rational | Smoke for angle control, self/teammate flash | Protect sniper funding through drops and coordinated ecos; no guaranteed AWP every gun round |
| Support | Rifle and as much role-relevant utility as team can afford | Rifle or FAMAS/MP9 with smoke/flash/fire and kits as needed | Setup flashes, execute smokes, delay/retake | Support does not automatically sacrifice armor or all frag potential |
| Lurker | AK, smoke/fire for independent map control | M4 and utility for anchor/rotator positioning | Isolate routes, delay rotations | T lurker and CT site role need separate templates |
| IGL | AK/Galil depending team budget | M4/FAMAS and coordinated kits/utility | Execute timing and rotations | IGL is a decision-maker, not a permanent 'worst gun' player |

Role is one input alongside side, map, position, remaining team funds, opponent likely buy, carried gear, player weapon proficiency and tactical plan. Role preferences should apply probabilistically, but final inventories must be legal and financially coherent.

## 6. Example coordinated buys (fresh gear; no carryover)
**T full buy example:** entry AK+helmet+smoke+flash = $4,200; AWPer AWP+helmet+smoke+flash = $6,250; support AK+helmet+smoke+2 flashes+Molotov = $4,800; lurker AK+helmet+smoke+Molotov+HE = $4,700; IGL AK+helmet+smoke+flash+Molotov = $4,600. **Total $24,550.**

**CT example (one option):** entry/rotator M4+helmet+flash+smoke = $4,400; AWPer AWP+helmet+smoke = $6,050; anchor M4+helmet+smoke+incendiary = $4,700; support M4+helmet+smoke+2 flashes+kit = $5,000; IGL M4+helmet+smoke+HE+kit = $4,900. **Total $25,050.** Check totals in code and adjust. In actual buys teams often have carried armor/weapons and will not repurchase everything.

**Pistol T:** balanced default-weapon + armor on some players; others buy smoke/flash or utility for a coordinated site entry. **Pistol CT:** distribute armor and at least some defuse capability plus retake/support utility; the entire team does not need a kit each.

## 7. Utility function and timing

| Item | Tactical function | Proposed observable simulation effects |
|---|---|---|
| Smoke | Block sightlines, screen crossing or plant, delay defense, obscure defuse | Dynamic line-of-sight blockers, route-cost changes, uncertain enemy position |
| Flashbang | Enable peak/entry, disrupt hold, aid retake | Temporary vision/aim handicap based on facing, distance, cover, timing; assists |
| Molotov/incendiary | Force displacement, clear corners, delay pushes/plants/defuses | Timed area denial, damage per exposure, navigation pressure, possible extinguish by smoke |
| HE grenade | Damage known/likely positions, finish tagged players, disrupt stacks | Bounded health damage depending on explosion geometry and obstacles |
| Decoy | Audio misinformation, niche fake | Sound-event hypothesis changes; very low default tactical utility |
| Defuse kit | Accelerate bomb defuse | Shorter defuse duration, can change retake win probability |

Utility should be thrown **for a purpose**. Do not simulate 'one flash per round' merely to satisfy statistics. Create tactical intents: establish map control; deny space; execute site; hold choke; fake; rotate; retake; save. Given the map geometry, timings and available equipment, agents choose relevant legal throws. Grenades reduce inventories on use and alter real simulation events; the viewer then replays those events.

## 8. T-side usage flow
1. Buy based on intended default/executed rush/fake/late hit and enemy economy.
2. Early phase: smoke defenders' long sightlines, contest map control with timed fire/HE, use sparing flashes to create safe openings.
3. Mid-round: lurker retains smoke or fire for cutting rotations; supports hold flashes and execution smokes; IGL may trigger group utility timing.
4. Execute: smokes remove critical defender lines, fires clear known holds, flashes synchronize entry peeks, HE punishes vulnerable anchors.
5. Post-plant: save utility for delay and late defuse denial; avoid dumping every grenade before the plant unless fast tactics require it.
6. Pistol/eco: reduced utility, higher dependence on a single crucial smoke/flash and coordinated close-range fights.

## 9. CT-side usage flow
1. Allocate site/rotator roles and distribute one or more kits based on plan and budgets.
2. Early: incendiary and smoke stall fast hits, HE punishes rush corridors, flashes enable safe peeks or teammate escapes.
3. Mid-round: manage the tension between delaying attackers and preserving some late-round retake utility.
4. Retake: smoke isolates a line or bomb, pop flash enables entry, incendiary flushes strong post-plant positions; kits change the time requirement.
5. If retake chance is low, preserving rifles/AWP is a rational strategic alternative, especially with limited next-round funds.

## 10. Economy policies for AI team behavior
Implement **one team purchase coordinator**, which receives five wallets and inventories, round number/side, score, loss-bonus stage, opponent probable economy, carried weapons, utility requirements and next-round goals. It returns a legal coordinated plan and legal five-player item allocations.

Suggested strategic profiles (game-design tuning knobs, NOT observed frequencies):
- Conservative: higher next-round buffer, fewer forces, more saves.
- Balanced: regular full/half buys, forces only at favorable leverage.
- Aggressive: greater willingness to force after pistol losses, high-upside gun allocation.
- Sniper-centric: prioritize financing or recovering primary AWP, use defensive setups to maximize it.
- Utility-heavy: preserve enough funds for a complete tactical utility plan, possibly choosing cheaper rifles.

Evaluate purchase plans by expected *two- to three-round* outcome, not only P(win this round). For manageable simulation, a small candidate-plan search is preferable to an enormous unconstrained optimization. Plans must account for weapon carryover, teammate drops and minimum equipment needs.

## 11. User-facing GM controls — avoid busywork
Expose only broad settings: economy aggression (conservative/balanced/aggressive), AWP priority (low/standard/high), utility focus (balanced/execute-heavy/retake-heavy), save discipline, and optional map-specific tactical identities. The coach/IGL AI handles individual buys. Post-match reports can show insightful events: 'Our forced buy in R18 increased upset chance but delayed a full buy to R20'. Do not ask players to buy grenades one by one.

## 12. Proposed event and state schema
Persist for each round: `team_wallets_before`, `team_wallets_after`, `loss_bonus_stage_before/after`, `player_inventory_before`, purchases, refunds where applicable, team weapon drops, pick-ups, player purchases, utility throws, damage/flash effects, weapon saves, round result, money from wins/losses/kills/objectives, inventory carryover. Event IDs allow deterministic accounting and replay.

For utility events store: `thrower_id`, `item_id`, `throw_time`, `origin`, `destination`, `detonation_time`, `duration`, `affected_agents`, `line_of_sight_before_after` where relevant, `damage`, `flash_time`, `purpose`, `event_seed`. These events feed APEX Match Rating utility and impact stats.

## 13. Statistics and research separation
Measured public per-player HLTV metrics can illustrate scope but should not be universal calibration targets. E.g., HLTV provides flashes thrown per round, utility damage per round, flash assists per round, time opponents flashed and saves. Representative per-role distributions require a curated professional demo dataset with team/side/role annotation.

A public Cache *guide catalog* reported 226 smokes, 80 flashes, 41 HEs, 35 Molotovs and 26 incendiaries in 408 captured throws; this sample was selected for instructional guides and must **not** be used as professional overall throw proportions.

**Recommended future data extraction:** Parse several thousand pro rounds from different maps and skill tiers; classify live buy state and player tactical role for each half, count purchases and actual thrown utility (not just items owned), weapon drops and saved equipment, smoke coverage/time, flash exposure and assists, weapon availability after buy, as well as conditional win outcomes by buy-vs-buy. Publish confidence intervals and sample counts. Do not assume raw sample selection is unbiased.

## 14. QA acceptance criteria for Claude Code
- Exactly reconcile each player's cash and inventory between rounds.
- Buying never produces negative money, illegal grenade combinations or duplicated dropped weapons.
- Two or three teammates can finance a primary AWP through legal drop mechanics when appropriate.
- Winning a round steps down the loss-bonus counter according to configured rules, not an obsolete full reset.
- Grenade effects are computed from map geometry and actual event position/time, and are visible in replay.
- Flashes do not affect people behind solid barriers; smokes block the intended lines and disperse predictably.
- Buying a full kit with no tactically useful utility is distinguishable from a proper execute-ready full buy.
- The same seed yields the same buys, events, final result and economy stats.
- Every AI-controlled club uses the same system as the player.
- Match-viewer playback stays synchronized with purchased, thrown and saved equipment.
- A 100,000-round offline calibration run reports: % eco/half/force/full by side; win rate conditional on both teams' buys; AWP availability; weapons saved; % rounds with plant; CT retake success; average smokes/flashes/fires/HE *thrown* by side and map; utility damage; flashes/flash assists; purchase allocation by role; economy breaks after losing streaks.
- Separate validated empirical benchmarks from initial tuning hypotheses in the dashboard.

## 15. Priorities
**P0:** Correct wallets, prices, loss-bonus ladder, inventory, drops, round-end awards and coordinated buy policies.  
**P1:** Utility that actually affects line of sight, timing, engagements and damage.  
**P2:** Role-, map- and opponent-sensitive purchase/throw preferences, utility allocation and save discipline.  
**P3:** High-resolution professional demo parsing and statistical calibration.

## 16. Claude Code handoff prompt
> Read `APEX_Economy_Utility_Research.md` fully and inspect the existing APEX simulation before making changes. Implement a deterministic economy ledger and coordinated team-buy planner using configurable 2026 CS2-inspired prices and rewards. Extend match-event simulation for real grenade physics/effects at the appropriate level of map abstraction. Use role biases as preferences, not hard rules. Keep the user-facing game simple: economy philosophy and tactical plans, not manual item purchasing. Add comprehensive invariant checks and a statistical simulation report. Mark unverified behavioral rates as game-design hypotheses, not measured CS2 facts. Do not add wear and tear or management chores.

