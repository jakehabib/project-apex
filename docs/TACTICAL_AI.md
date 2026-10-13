# Tactical match intelligence

This is the owner brief (decision #38), Step 1: what's wrong today, what we keep, and the new
architecture in plain English.

## 1. What the current engine does, and why it looks wrong

The engine already has a planner per side:
- `attack.ts` picks default, rush, execute or split;
- `defense.ts` assigns defenders to positions and handles rotations and retakes.

Players then carry out simple tasks: "go to X", "hold here facing Y", plant, defuse, save. Frames
captured from the viewer (Harbor, round 1) show the owner's complaints are accurate.

| Symptom | Root cause in the code |
|---|---|
| Three or four attackers move as one blob and stand on the same spot | Every player in a group is sent to the *same* node (route `stage`, control spot). There's no formation, no spacing and no slots. |
| Stop-start movement | Players reach a node and switch to "hold"; executes then release them one by one with fixed delays (`notBefore`). Anyone who sees an enemy anywhere stops. Nothing paces the group as a unit. |
| No visible tactics or smokes on defaults | Utility is only thrown at the moment of an execute, and only if a lineup's thrower is in range. Map-control rounds throw nothing. |
| Defenders sometimes react too well | Footstep "intel" records the attacker's *exact* position. There's no uncertainty or ageing beyond a time cutoff. |
| Fakes can't exist | No plan uses deception, and defenders' beliefs aren't a model that utility or noise could mislead. |
| Little adaptation | One mid-round switch (25% chance for good callers) and a late-call for defaults. No regroup, no recommit, no cooldowns. |

## 2. What we keep

These parts are sound, tested and calibrated:
- perception (line of sight, field of view, smokes, flashes);
- combat (reaction, accuracy, damage, armour);
- utility physics (smoke, flash, fire and HE effects);
- bomb rules and the economy;
- navigation (tile lattice, A*, side-safe routes, string-pulled paths);
- the event log, replays, invariants, AMR and the recap.

The rebuild replaces **decision making**, not physics.

## 3. New architecture

Three layers that share one picture of the round.

1. **Team Director** (the IGL, one per team), `engine/ai/director.ts`.
   - Picks a **plan template** using the team's tactics, the economy, its memory of the opponent,
     the caller's skill and the map's tactical data.
   - Runs the plan through **phases**: setup → map control → commit (hit) → plant → post-plant;
     or regroup / save.
   - **Replans only on triggers, with cooldowns.** Examples: the entry dies, the site is revealed
     stacked, mid control is won, the bomb is lost, the clock forces a hit.
   - Defenders get setup templates (standard, stack, aggressive information, passive), rotation
     calls and retake/save decisions.
2. **Squads**, `engine/ai/squad.ts`.
   - Split the team into groups, each with a job (main hit, support, lurk/flank, mid control,
     fake), a route and roles inside the group: entry → trade → support → AWP/rear.
   - Move a group as a **file with trade spacing:** the entry leads, and each follower starts once
     the player ahead is a trade distance away.
   - Assign **distinct slots** around a position (no stacking).
   - **Synchronise:** smokes land, then flashes pop, then the entry swings. Two squads in a split
     arrive at a shared hit time.
3. **Player AI** (per tick, inside the round loop). It carries out the squad's instruction:
   - walk/run along a path;
   - stop and hold an angle without moving;
   - check the danger angles of a choke while passing through it;
   - stop to take a fight;
   - **trade** a teammate killed nearby;
   - **fall back** from a lost fight;
   - watch a flank;
   - protect a planted bomb;
   - retake as a group;
   - save a valuable weapon.

**Beliefs**, `engine/ai/beliefs.ts`. Each team keeps what it has actually learned:
- sightings (exact, then ageing);
- footsteps and gunfire (approximate position, lower confidence);
- enemy utility it sees land (which implies attackers nearby);
- the bomb when seen.

Each entry has an age and a confidence. Directors decide from *pressure per area*, never from the
other team's plan. A fake works by putting real noise and utility near one site, which raises the
defenders' belief there.

**Map tactical data** (authored per map in `maps/<map>.ts`, extending the strategy block):
- callout regions and site routes (stage, entry, angles to clear);
- map-control objectives, with the attackers' spots, the defenders' contest spots and the utility
  needed to cross;
- execute utility per route;
- defender anchor spots and what each watches;
- post-plant spots;
- retake stages.

Plans only use routes and objectives that exist on that map.

**Debug overlay** (developer mode in the viewer). `ai` events record each team's plan, phase,
reasons, assignments (group, role, destination) and belief pressure by area. The viewer draws:
- planned destinations as lines;
- group colours;
- the plan and phase banner;
- known enemy positions, faded by age;
- why a rotation or plan change happened.

## 4. Acceptance tests (automated)

- Execute groups keep trade spacing: no two members within 40 units for long, and the follower is
  within 500 units of the entry at first contact.
- Executes throw their available utility before the entry swings.
- Defenders hold still on their angles before contact.
- No defender rotation without belief evidence (each rotation event cites its evidence).
- No oscillation: a player switches destinations a bounded number of times per round.
- No stuck rounds: every round ends legally; nobody idles while the plan expects progress.
- Bomb carriers plant at legal plant spots; defenders retake as a group (stage, then push together).
- Saves happen only when economically justified.
- Scenarios: 5v5, 5v4, 5v3, 3v3 post-plant, 2v2, 1vX.
- Determinism: the same seed gives the same events.

Calibration targets stay in `scripts/dev/bal.ts`; they are measured, never forced.
