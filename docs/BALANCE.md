# Balance notes and playtest log

How the numbers got where they are, what the tools measure, and what "good" looks like. Read
this before changing anything in `src/data/` or the tunables at the top of `src/game/game.js`
and `src/game/waves.js`.

## The yardstick

`tools/sim.mjs` plays every district with a bot. Two modes:

- `basic`: builds and upgrades towers by route coverage; never hacks. Should **lose** on
  Netrunner from Watson onward (that proves hacking is mandatory).
- `hacker`: also purges offline towers, breaks ICE on the furthest shielded enemy, Short Circuits
  bosses, and uses access points opportunistically. Crude, but consistent.

Targets on the **Netrunner** tier (the baseline): hacker bot wins every district with 1–2 stars.
Street Kid: 2–3 stars. Legend: mostly losses. Blackwall: losses everywhere.

The owner is a strong TD player and beats the bot by a wide margin (perfect 20-core clears where
the bot has 6). Do not tune the global curve to the owner; that is what tiers are for.

**Boss rule (added after the City Center run):** a boss reaching the core is an immediate loss, so
the bot's wave-10 result now depends on its boss fight. The bot is bad at bosses (it under-upgrades
and mismanages RAM against shield regen), so from Westbrook on it typically reaches wave 10 with
14–20 core and then loses to the boss. Read the **wave 9 lives** column as the regular-wave signal
and use the owner's results for boss calibration. `BOSSDBG=1 TIER=… node tools/sim.mjs hacker <district>`
prints the boss's HP every 3 s.

Current readings (`hpRamp` 0.38, boss rule on, so the bot loses every Netrunner boss; read wave 9):

| Tier | Watson | Westbrook | Heywood | Santo | Pacifica | Center |
|---|---|---|---|---|---|---|
| Street (hacker) | 20 ★★★ | 20 ★★★ | 20 ★★★ | 20 ★★★ | 20 (boss) | 20 (boss) |
| Netrunner (hacker) | 12 | 10 | 20 | 20 | 15 | 20 |
| Legend (hacker) | wave 4 | wave 6 | wave 9 | wave 9 | wave 9 | wave 9 |

(numbers are core left on wave 9 for Netrunner, the wave the bot fell on for Legend)

Pre-rework readings for reference, core left on wave 10 before the boss rule: Street 15/14/20/15/15/15,
Netrunner 9/3/15/12/5/15.

Owner's own results on Netrunner so far: Watson 20 ★★★, Westbrook 4 ★ (under-hacked),
Heywood 13 ★★, Santo 20 ★★★, Pacifica 20 ★★★ (8 towers, 20 hacks, 0 purges, 5 access points;
feedback: breach urgency good, Arc Nodes carried, reroute under-used, no changes requested).
Blackwall Watson: lost on wave 7 (before the RAM refund), then **cleared 2/20 ★** with 10 towers,
64 quickhacks, 7 purges, 9 daemons, 6 access points, 18 leaks, 328,500 score. That is the intended
shape for the top tier: core spent as a resource, won on the last few points.

First-time player (owner's coworker), Street Kid Watson: 19 ★★★, 6 towers, 15 hacks, **0 daemons**
(never opened a breach), 3 purges, 11 access points, 1 leak. Street Kid is landing where intended for
new players; breach discoverability for non-Cyberpunk players is an open question.

## Knobs

| Knob | Where | Current | Effect |
|---|---|---|---|
| `difficulty` per district | `districts.js` | 1.6 / 0.95 / 1.15 / 1.25 / 0.9 / 1.0 | base HP and budget multiplier for regular waves |
| `startEddies` | `districts.js` | 280 → 540 | opening build |
| `hpRamp` | `waves.js` | 0.38 | HP growth per wave (wave 10 = 4.4× wave 1) |
| `budgetRamp` | `waves.js` | 4.5 | budget growth per wave (budget × 60 × hpMult = the wave's effective HP) |
| enemy cost | `waves.js` | `hp/60 × (0.75+0.25·speed) × (1+armor/15) × (runner 1.3)` | what a type costs the budget; `pts` on enemies is unused |
| HP normalization | `waves.js` | on | group counts scaled so Σ hp×(1+armor/15) matches the budget; runner caps topped up from the biggest non-runner group |
| boss curve | `waves.js` | `1.2 + 0.3 × (num − 1)` | independent of district difficulty |
| ICE share | `waves.js` | 8% + 5%/wave from wave 4, capped `0.22 + 0.06 × (num − 1)` ≤ 0.4 | shielded fraction |
| `econ` | `game.js` | 0.60 | fraction of listed kill reward paid |
| `rewardDecay` | `game.js` | 0.10 | per-wave decay of kill reward |
| `BREACH_EVERY` | `game.js` | 3 | waves per breach charge |
| wave clock | `game.js` | 45 / 25 / 30 s, +10 s per breach | pacing |
| ICE multipliers | `game.js` | tower 0.2, tesla 0.5, boss 0.1 | damage through shields |
| runner `hacker` blocks | `enemies.js` | range 2.8–3.6, time 1.6–2.8, disable 10–14 | enemy hacking |
| tiers | `tiers.js` | see DESIGN.md | everything above × tier |

All of `econ`, `rewardDecay`, `hpRamp`, `budgetRamp`, `diffScale` and per-district `diffs` can be
overridden for a sim run without editing files:

```
TUNE='{"hpRamp":0.35,"econ":0.55,"diffs":{"watson":1.4}}' START='{"watson":300}' node tools/sim.mjs hacker
```

## Why the numbers are what they are (chronological)

1. **First build** was trivially easy: perfect runs with 8 towers and 2 quickhacks. Income grew
   with enemy count while tower DPS compounded, so by wave 10 the bot had 22 turrets vs 210-HP
   scavs. Fix: kill rewards ×0.6 with 10%/wave decay, steeper HP ramp (0.16 → 0.30), fewer but
   tougher enemies (budget ramp 6.5 → 4.5), Watson's road shortened from 35 to 28 cells.
2. **Breach every wave** made daemons a faucet, and one matrix could roll three DATAMINEs for
   850 €$. Fix: breach charges (1 + one per 3 waves), max one money daemon per matrix, payouts
   80/180/350.
3. **Hacks were optional.** Perfect clears with zero quickhacks. Fix: ICE shields (towers do 20%
   until a quickhack breaks the shield). This flipped the basic bot from winning everywhere to
   losing everywhere, which is the intent.
4. **Westbrook's boss felt weak** because its base difficulty had been lowered to fix a wave-1
   cliff (fast Tyger Claws vs 2 turrets). Fix: bosses scale by district number instead.
5. **Reroute was a permanent setting** (long road all game). Fix: 25 s window, 40 s cooldown.
6. **Tiers** added because the owner outplays the bot; Netrunner = the baseline tuning, Street
   Kid easier, Legend and Blackwall above. Losses bank half score so a Blackwall wipe cannot
   outrank a clear.
7. **Purges were always zero.** Cause one: Blackwall ICE was common and lasted 2 waves (now rare,
   1 wave). Cause two: enemy runners had less reach than turrets and needed 3.2 s of contact, so
   they died before finishing. Buffed reach/time/HP, which proved *too* strong in play (owner:
   "OP AF"), then pulled back to range 2.8–3.6 (just outside SMG, inside sniper). `tools/hackcount.mjs`
   should show >0 towers hacked per district and dozens on Pacifica.
8. **Early-district RAM feasibility.** Watson/Westbrook have no ICE Deck (owner's decision: it stays
   at Heywood), so the ICE share is capped lower there (22%, 28%).
9. **Smasher was unkillable**: 12000 base × 2.7 boss curve = 32400 HP with 12 HP/s regen behind a
   10% shield; the owner cleared City Center with 15 core and had "barely put a dent" in him when
   he walked into the core. Now 7000 base (18900 at Netrunner), regen 3, and a boss leak is a loss.
10. **Wave 7 cliff.** Owner: Blackwall Watson wave 7 "hardest by a mile". It rolled 17 armored
    Maelstroms: the old point costs gave heavies 70 HP per point and drones 30, so a heavy roll sat
    30–40% above the curve and the next drone roll fell flat. Enemy cost is now health-based (with
    speed, armor and runner premiums) and every wave's effective HP is normalized to its budget.
    Composition still varies; the health curve no longer does. Side effect: roughly 10% less raw
    HP per district at Netrunner. Re-check with the owner before touching `hpRamp`.
11. **Audio**: weapon SFX were a square-wave chirp every 45 ms. Now a separate quieter bus with
   longer throttles, plus FULL/LOW/OFF. Tuned without listening; expect another pass.
12. **Post-rework drift.** After item 10 the owner cleared Netrunner Watson 20/20 with 5 towers and
    1270 eddies unspent, and Westbrook 20/20 with 4 towers; the bot's wave-9 core went 9 → 17 on
    Watson and 3 → 17 on Westbrook. The drop sat in the two pre-Deck maps (the armor premium made
    heavies rarer); Heywood onward was already clean at wave 9. Swept `hpRamp` 0.30–0.40 and
    `diffScale`/`budgetRamp` (a bigger budget is *easier* for the bot: more bodies, more eddies).
    `hpRamp` 0.38 lands Watson 12 / Westbrook 10 at wave 9, leaves the Deck maps at 20, keeps Street
    Kid a clean 3-star and Legend a wipe. Bosses have their own curve and are untouched.

## How to tune a specific complaint

- "District X is too easy/hard" → change its `difficulty` only; re-run `sim.mjs hacker` for that
  district and its neighbours.
- "Boss is weak/strong" → the boss curve in `waves.js`, never the district difficulty.
- "I never need hacks" → ICE share cap / tier `ice`, not HP.
- "RAM famine" → tier `iceRefund`, ICE Deck `ram` values, or RAM Patch daemon weight.
- "Runners never hack me" → `hacker.range` relative to SMG range (2.6–3.0); check with `hackcount.mjs`.
- "Runners are OP" → `hacker.time` up or `disable` down before touching range.
- "Economy snowballs" → `rewardDecay` first, then `econ`.
