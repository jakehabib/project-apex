# Owner brief: APEX Match Rating (AMR)

Received 2026-10-12 (prepared with ChatGPT, sent by the owner). Condensed faithfully; every requirement is kept. The owner also wants AMR to be "almost a 1:1 clone" of HLTV Rating 3.0 in structure and feel (reference: hltv.org/news/42485). It must be implemented as an original APEX calculation.

**Goal:** a player performance rating with a long-run average ≈ 1.00 that rewards meaningful contributions to winning rounds, not just kills.

**Scopes it must support:**
- map, BO3/BO5 series, tournament, season and career ratings;
- separate T and CT ratings;
- historical comparisons.

Aggregates are **round-weighted from the underlying components**, never a naive average of match ratings.

## Six sub-ratings (initial weights are design hypotheses, not HLTV's)

| Sub-rating | Weight | Definition |
|---|---|---|
| A. Kill | 30% | Kills per round with an economic difficulty adjustment from configurable duel-win probabilities. A kill on an unarmoured pistol player is worth less; a pistol kill on a rifler is worth more. Cap extreme multipliers. |
| B. Round Swing | 20% | Change in team round-win probability after actions. Covers kills, deaths, important damage, flash-assisted kills, trades and failed trades, clutches, defuses and round-ending actions. The probability model accounts for map, side, alive players, equipment and the plant, calibrated to the APEX CS2 data pack. 5v4 isn't a constant. Credit is shared between the killer and meaningful contributors, with no double-counting. |
| C. Damage | 15% | Effective damage per round: health actually removed, no overkill. Economy-adjusted. Track raw ADR and adjusted ADR separately. |
| D. Survival | 15% | Survival vs death cost. Surviving won rounds is positive. Survivals in lost rounds without contribution must not inflate the rating. Don't punish entry fraggers for their role; account for trades and team contribution. (A performance stat, not fatigue.) |
| E. KAST | 10% | % of rounds with a kill, assist, survival or traded death, counted once per round. Modest eco adjustment if the data justifies it. |
| F. Multi-kill | 10% | 2K/3K/4K/ace rounds, adjusted for opponent equipment and normalised. Five anti-eco kills must not outweigh important gun-round fights. |

AMR = 0.30·Kill + 0.20·Swing + 0.15·Damage + 0.15·Survival + 0.10·KAST + 0.10·Multi.

Each component is normalised against a representative simulated pro population (mean ≈ 1.00), with robust normalisation and guards for small samples and unusual match lengths. Don't force every team, match or event to average exactly 1.00.

## Tuning examples (illustrative, not hard asserts)

| Player | Line | Target AMR |
|---|---|---|
| A | 25–12, 112 ADR, 80% KAST, several important opening kills | 1.60–1.90 |
| B | 20–14, 85 ADR, mostly kills on weak economies, little round-winning impact | 1.05–1.25 |
| C | 17–16, 78 ADR, important 1v2 clutch, two high-impact opening kills | 1.15–1.40 |
| D | 9–21, 42 ADR, 48% KAST, several untraded opening deaths | 0.45–0.70 |

## Engine integration

AMR is derived **only from deterministic match events**. The same seed must give the same stats and AMR. Events must cover:
- kills and deaths, with equipment at the engagement;
- damage dealt and received;
- assists and flash assists;
- round state before and after important actions;
- openings, trades and trade denials;
- plants and defuses;
- clutches, outcomes and survivors;
- side and map.

AMR is a measurement and must never influence what happens in a match.

## UI

- Post-match scoreboard: Player | K | D | A | ADR | KAST | AMR.
- Clicking a player shows the six sub-ratings, entry stats, clutches and T/CT splits, and explains why the player got their rating.
- AMR is used for MVPs, scouting history and comparisons, with sample size and opponent strength in mind. One great game doesn't make someone elite.

## Testing and calibration

Use at least 100k player-map performances once the simulator supports that scale. Check:
- population mean ≈ 1.00 and realistic variance;
- believable extremes;
- limited anti-eco inflation;
- rewards for high-impact plays;
- no reward for saving in lost rounds;
- fairness across roles (AWP, entry, lurker, support, anchor);
- stability across maps and match lengths.

Automated examples must show that more meaningful performance raises AMR and that low-impact kills don't overpower valuable actions. Also build an internal analytics view: distribution, correlation with outcomes, by role, and outliers.

**Role-aware (owner):** anchors and supports naturally post lower frag stats; show AMR against role averages and recognise anchor contributions.
