# Claude Code — Match Engine Data Integration and Calibration

## Mission

Integrate APEX's match simulation with this reference dataset using a coherent, event-sourced model. The match viewer plays back events from the *same exact simulation*. Never choose a final score first and invent events to fit it. Never hardcode a 5v3 win in 90% of rounds independently of economy/position/objective/time.

## Order of work

1. Create typed schemas for the data and its provenance (`measured`, `derived`, `unverified`). Validate CSV/JSON loads and numeric ranges.
2. Make a deterministic seeded simulation producing each round as an event log: buy decision, spawn, utility, engagement, kill/trade, site control, plant, retake/save, final outcome, economic consequence.
3. Log detailed state transitions for telemetry: remaining alive by team at each change, team side, map, buy tiers, equipment value, time, bomb planted, current location/region, remaining utility, score and team strengths.
4. Create an independent telemetry analyzer (NOT the same result-generating code path) that measures statistics from simulated event logs, including denominators.
5. Simulate many games with matched-strength teams, realistic opponent-matchmaking distribution, and proper MR12/overtime format. Generate a comparison report for every measured published benchmark.
6. Tune parameters to target **joint distributions** without violating event logic or match rules. Use holdout random seeds to prevent overfitting.
7. Reproduce special situations and demonstrate how tactical choice changes resulting probabilities without violating calibration.
8. Make viewer timeline seek/pause/replay reliable by storing timestamps and source events, not regenerating viewer RNG.

## Benchmark thresholds (initial engineering criteria, adjustable after full QA)

- For mirror-strength teams over each map with realistic buys, simulated CT-side round shares within ±2.0 percentage points of published map rates, with sufficient simulated rounds.
- Opening kill holder: ~71.8% of rounds overall (target ±2.5 points) under a representative simulation population.
- Plant frequency ~53.9% (target ±3 points); CT win after plant ~23.1% (target ±3 points) measured with a representative roster and map mix.
- Pistol CT win ~50.3% overall (target ±2 points); avoid applying full-buy map-side advantage unchanged to pistols.
- Eco vs full-buy: use the NeuroStats map-specific 1.7–2.3% figures as one source's *descriptive* reference; alternate sources/definitions warrant wider tolerance. Force vs full: ~21–24%. Do not force all eco rounds to 30%.
- Overtime ~11.9% for a suitable professional-match-strength distribution (target ±2.5 points).
- Scores, kills, bomb events, equipment and final round winner must be logically consistent. No planted bomb can be defused after detonation; nobody kills after death; money remains within game rules; all matches terminate.
- State baseline ranges are *soft hypotheses* only. Never mark them as empirical validation until derived from parsed real demos.

## Situation studies to implement as automated reports

- Rounds that first reached 5v4 after the initial opening kill versus those reaching 5v4 later; they are different samples.
- 5v3, 5v2, 4v3, 4v2, 3v2, 2v1, 1v1, and solo 1vX. Count the event *first time a state is reached per round* to avoid overweighting states by time spent.
- Separate T-ahead and CT-ahead situations, pre-plant vs post-plant, full-vs-full versus disparate buys, and remaining-time bands.
- Measure clutches separately as solo wins divided by **all eligible solo clutch attempts**, not divided by rounds or by total kills.
- Retakes measured as CT-won / total planted rounds; separately measure attempted retakes (no save) and successful defended-plant wins.
- Separate full 3x3 buy matchup cells. Some published cells are absent; do not interpolate as official numbers.

## Calibration strategy

The game should model spatial/routing opportunities, skill, map control and utility. Aggregate win percentages are loss-function targets, NOT round outcome scripts. If a seeded scenario is replayed, the same event log and winner must result. For a match that the user watches, all stats must derive from those events.

A suggested scoring loss is a weighted sum of squared errors on observed aggregates where weights reflect sample size and importance, with safeguards for rule and event coherence. Avoid forcing all aggregate numbers from different datasets to match simultaneously, since cohorts, definitions, and years vary. Report conflicts clearly.

## Future research for real 5v3 and clutch data

Parse appropriately licensed professional demos using maintained demo libraries. Record player survival states at timestamped kill events, objective phase, equipment, site, utility, and final outcome. Compute P(round winner | first reached state) with binomial/Wilson confidence intervals, stratified by map and side. Publish numerator and denominator for every cell; do not use editorial guesses as pro stats.

## Operating mode

If these data are added to the game's source repository, retain source URLs, research date, and provenance. Provide a generated calibration report in CI and flag regressions when simulator changes materially shift distributions. Keep game balance tunable via config, without needing to alter code logic for every patch.
