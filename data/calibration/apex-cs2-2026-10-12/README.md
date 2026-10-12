# APEX — CS2 Match-Simulation Calibration Pack

**Research date:** 2026-10-12. **Status:** reference/calibration data, NOT ready-made outcome probabilities for every situation.

## Important interpretation

There are three different types of numbers:

1. **MEASURED_PUBLISHED_AGGREGATE**: a real statistic published by the linked data provider. Different publishers use different populations, dates, sampling methods, and definitions.
2. **DERIVED**: simple arithmetic from a published statistic (e.g. 100% minus measured CT post-plant wins).
3. **DESIGN_HYPOTHESIS_UNVERIFIED**: our own game-balance seeds. These are *not* researched professional CS2 facts. They require more data and empirical validation.

Do not use these percentages as independent dice rolls: e.g. do NOT multiply opening-kill advantage × map-side bias × retake chance. Those are correlated conditional summaries of round outcomes. Implement one coherent event-based match model, instrument it, and tune until aggregate outputs approximately match the benchmarks.

## Contents

- `01_map_side_rates.csv`: last-six-month CT/T win shares, map selection, average map length and sample sizes, consistently from EsportsOdds overview through October 11, 2026.
- `02_map_bomb_and_economy.csv`: separate NeuroStats map data: plant and defuse frequencies, pistol and underdog buy statistics. **Different cohort** from map side figures.
- `03_global_benchmarks.csv`: published pro aggregate targets including openings, retakes, economy, comeback rates, overtime.
- `04_UNVERIFIED_situation_estimates.csv`: initial man-count-state seeds, not measured facts. Replace after parsing professional demos.
- `05_measured_retakes_by_both_buys.csv`: *partial* 3×3 buy-state matrix containing **only** published values. Other three cells intentionally missing.
- `06_hltv_pistol_round2_examples.csv`: illustrative team-specific pistol conversion, NOT an overall population rate.
- `07_apex_calibration_baselines.json`: reference config for importing into code, with measured versus unverified separated.
- `CLAUDE_CODE_IMPLEMENTATION_NOTES.md`: instructions and acceptance testing.

## Headline empirical targets

- **After opening kill** (professional rounds): 71.8% (not every arbitrary 5v4 state). Source: https://esportsodds.gg/learn/cs2-comebacks
- **Plant frequency**: 53.9%; **CT win after plant**: 23.1% from 354,436 planted pro rounds. Source: https://esportsodds.gg/learn/cs2-retakes
- **Pistol CT share**: 50.3%, T share 49.7% (population of pistol rounds). Source: https://esportsodds.gg/learn/cs2-economy
- **Overtime maps**: 11.9%, as defined in sample. Source: https://esportsodds.gg/learn/cs2-comebacks
- **Map-side win shares**: see data file and https://esportsodds.gg/maps

## Data-population traps

- **All-eco 30.1% round win** is *across all opponent buys*. Eco versus a full-buy opponent is nearer 1.7–2.3% on NeuroStats map samples. These answer different questions; both can be true due to opponent equipment distributions and classification differences.
- **Full-buy 57.6%** is pooled against all buys. Full-vs-full must approximate parity for equal-strength teams (with map/side factors), not 57.6% for *both* teams.
- **CT retake 23.1%** is all professional planted rounds and money contexts. The **full CT vs full T** cell is 23.9%. Different teams, conditions, and selection effects matter.
- **CT retake conditional on plant** is not the same as **CT round win probability**.
- **5v4 after opening kill** is not interchangeable with an arbitrary 5v4 reached after a late trade; an opening kill selects particular states.
- **1v1 symmetric fight = 50%** is a theoretical neutral case; it is NOT a measurement of observed 1v1 clutch conversion, which depends on bomb, time and player position.
- **5v3, 4v2, 1vX** public measured pro aggregate data was not verified in this research pass. Files intentionally label all such figures as hypotheses.
- **Round length** means rounds played *per completed map*, not real-time seconds.

## Source links and dates

- Professional map/side stats as of 2026-10-11: https://esportsodds.gg/maps
- Retakes (published 2026-07-20): https://esportsodds.gg/learn/cs2-retakes
- Opening kill and comebacks (published 2026-07-19): https://esportsodds.gg/learn/cs2-comebacks
- Economy (published 2026-07-10): https://esportsodds.gg/learn/cs2-economy
- Premier and FACEIT opening-kill data (published 2026-08-20): https://scope.gg/guides/cs2-first-kill-round-win-rate-premier-faceit/
- Map-specific bomb/eco, NeuroStats pages (accessed 2026-10-12): https://neurostats.net/cs2/map/de_nuke (and matching per-map paths)
- Team pistol round-2 conversion examples: https://www.hltv.org/stats/teams/pistols?csVersion=CS2

Sources may be dynamically refreshed; source figures above capture the snapshot at research time. If you buy a data API license or parse demos, create a new dated dataset, do not silently replace these values.

## Commercial/IP warning

Use these aggregated facts only as benchmark references. Do not assume permission to redistribute proprietary raw event feeds, logos, map layouts or branded tournament content. PROJECT APEX should use original or appropriately licensed maps, names and assets.
