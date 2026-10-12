# Economy and utility: research integration

Owner-supplied research, received 2026-10-12, is stored unchanged in `data/economy/reference-2026-10-12/`:
- `APEX_Economy_Utility_Research.md`: the brief;
- `apex_economy_reference.json`;
- `apex_item_prices_reference.csv`.

The brief separates **public rules and prices** (verifiable) from **behavioural rates** (unmeasured). We follow that split:
- rules and prices are data in `rules/ruleset.ts` and `rules/arsenal.ts`;
- behaviour is AI policy, and every behavioural number below is labelled as **measured from our engine** or as a **design hypothesis**.

None of the rates in this file are measured professional statistics.

## 1. Rules audit against the reference (P0)

| Rule | Reference | APEX | Status |
|---|---|---|---|
| Start money / cap | $800 / $16,000 | same | ✅ |
| Round win (elimination / time) | $3,250 | same | ✅ |
| Bomb detonated / defused win | $3,500 | same | ✅ |
| Loss ladder | 1400 / 1900 / 2400 / 2900 / 3400 | same | ✅ |
| Loss counter after a win | step down one (no full reset) | `winTeam.lossStreak - 1`; now verified by the invariant checker | ✅ |
| T planted-bomb loss award | $800 per T | **was $600** | ✅ fixed |
| Planter award | $300 | same | ✅ |
| T survivors of a time-expired loss | no loss award | same (`noRewardForTimeoutSurvivors`) | ✅ |
| Kill awards by weapon | $300 standard, AWP $100, SMG $600, shotgun $900 | stored per weapon in `arsenal.ts` | ✅ |
| Prices (19 items in the CSV) | see CSV | every price matches its equivalent slot | ✅ |
| Grenade limits | max 4 total, max 2 flashes, 1 of the others | `MAX_GRENADES`, `maxCarried` | ✅ now checked per loadout |

## 2. What was implemented

**Ledger and invariants** (`stats/invariants.ts`). These checks run on every simulated map in the tests and in `npm run sim:econ`:
- **Wallet reconciliation:** every buy, award and reset is replayed. Money at each loadout must equal the replayed balance.
- **Payout amounts follow the ruleset:**
  - round win by reason;
  - loss bonus from the replayed loss counter, with step-down after a win;
  - the plant-loss award only for attackers in a planted round;
  - kill awards by weapon;
  - plant and defuse awards.

  A capped wallet may receive less.
- **Inventory conservation:**
  - carried, bought and received weapons must cover the weapons kept and handed on;
  - a purchased weapon can never vanish, and only a carried weapon may be discarded for an upgrade;
  - there are no duplicated drops and no drops to opponents;
  - the fallen lose their weapons;
  - pick-ups come only from dead players, by living ones.
- **Grenade combinations** are legal for every player in every round.

**Coordinated team buys** (`engine/economy.ts`):
- **Half buy** (new buy type). Each player spends only what still guarantees next round's full buy if this round is lost: wallet + next loss bonus − full-buy need − a buffer. It buys armour, an SMG or pistol upgrade, a grenade and a kit.
- **AWP financing.** Two or three teammates can fund the sniper:
  - one drops the AWP;
  - that donor's rifle in turn comes from a third teammate's drop, or the donor falls back to a budget rifle.

  A teammate who picks up an AWP hands it to the AWPer and takes the AWPer's weapon back.
- **Weapon recovery.** After a round, surviving winners collect the fallen's best primaries. The sniper goes to the AWPer first.
- **AWPer rifle hand-off** now only passes a rifle to a teammate who could not buy one (fixes a vanished-purchase bug found by the new checks).
- **Bonus rounds** buy helmets when affordable.

**GM economy settings** (`EconomyPolicy` on `TeamSetup.economy`, brief §11). These are broad philosophy settings, never item-by-item buying:

| Setting | Options | Effect (design hypothesis) |
|---|---|---|
| Economy aggression | conservative / balanced / aggressive | Force threshold ±0.15; half-buy buffer $400 / $150 / $0 |
| AWP priority | low / standard / high | Low: the AWPer buys the sniper only from their own money, with a $1,000 margin, and no financing. High: financing with a smaller reserve, and the sniper on force buys when affordable |
| Utility focus | balanced / execute / retake | Grenade budget +25% on T for execute; +20% on CT plus an extra kit for retake |
| Save discipline | loose / standard / strict | Save threshold ×0.7 / 1 / 1.35; chance players follow the call −15 / 0 / +15 points |

**Purpose-driven HE grenades.** They were bought but never thrown before. Now:
- attackers HE a defender reported on an anchor spot, or the usual second anchor, as part of an execute;
- defenders HE a stack of two or more attackers reported at an entry;
- retakers HE the freshest known post-plant position.

**Weapon ranges** (measured fix). SMGs fell off at 14 m while the CT default pistol stayed accurate to 32 m, so bonus rounds were lost 58% of the time. SMG effective range is now 19–21.5 m; bonus rounds convert ~85%.

**Shift-walking** (owner question). Walking is silent (no footstep intel) and moves at 0.52× speed. It was used only by lurkers. Now:
- slow-paced teams walk the last stretch into map-control spots and site entries (chance 0.75 × (1 − pace));
- CT info pushes walk the final approach;
- the clock forces running again;
- shooting while walking is steadier than running (0.6 vs 0.42 accuracy factor), though still worse than standing.

## 3. Report

`npm run sim:econ -- <maps>` prints:
- buy types by side;
- win rate by buy matchup;
- AWP availability;
- drops and recovered weapons;
- plant rate and retake success;
- buys after losing streaks;
- utility thrown by side and map;
- utility damage, players flashed and flash assists.

Latest numbers are in HANDOFF §4.

## 4. Open items (measured gaps)

- **Eco / half buy against a full buy wins ~3–6%.** CS teams win noticeably more of these through stacks and close-range ambushes. We need eco-round tactics: stack a site, close angles, and anti-rifle positioning.
- **Plant rate 69–73%** against a ~54% target (pre-existing engine balance item).
- **Flash assists are low** (0.07 per round).
- **HE / fire / smoke counts** have no validated professional benchmark. Treat them as hypotheses until a demo-parsed dataset exists (brief §13, P3).
