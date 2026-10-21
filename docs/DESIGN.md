# Night City Breach — design reference

What the game is, mechanic by mechanic, as it stands on the branch. Numbers here are the
Netrunner-tier baseline; see `docs/BALANCE.md` for how tiers scale them and why they are what they are.

## Loop

Six districts, ten waves each, boss on wave ten. Winning unlocks the next district and awards
1–3 stars by core left (18+ / 10+ / 1+). Progress, stars, best score and settings persist in
`localStorage`; the live run score and session total live in `sessionStorage` so a reload
mid-run keeps them.

The grid is 9×14 cells, portrait. Enemies follow one or more routes from an off-grid spawn to
the CORE. Each leak costs 1 core (5 for a boss). 20 core.

### Wave clock
Waves auto-start: 45s before wave 1, 25s between waves, 30s before a boss. Calling a wave early
scores 25 per second skipped. The clock keeps running during a breach; opening one adds 10s.

## Economy

- **Eddies (€$)** buy and upgrade towers. Kills pay `reward × 0.6 / (1 + 0.1 × (wave − 1))`,
  so income per kill decays as waves grow; wave clears pay `40 + 12 × wave`. Sell returns 60%.
- **RAM** powers quickhacks and access points. 12 max, 0.45/s regen, ICE Decks add regen.
  RAM Patch daemon adds +4 max. Legend/Blackwall refund RAM on shield breaks.
- **Score** (see Scoring).

## Towers (`src/data/towers.js`)

| Tower | Role | Unlock |
|---|---|---|
| Saratoga (SMG) | cheap hitscan, backbone | Watson |
| Nekomata (sniper) | long range, armor-piercing, slow | Watson |
| Arc Node (tesla) | chain lightning, ×1.6 vs mech/drone, 50% through ICE | Watson |
| Thermal Vent (flamer) | short-range burn aura, organics ×1.3 | Westbrook |
| ICE Deck | no weapon: firewall (towers inside are immune to enemy hacks), slow aura, RAM regen | Heywood |
| Arasaka Pod (rocket) | splash | Santo Domingo |

Three levels each. Targeting is "first" (furthest along the route).

## Enemies (`src/data/enemies.js`)

Shapes, not sprites. Tags drive bonuses: `organic`, `mech`, `drone`, `runner`, `boss`. Armor is
flat damage reduction (floored at 25% of the hit); hacks, snipers, traps and DoTs pierce it.

### Enemy netrunners
Any enemy with a `hacker` block (netrunner, VDB netrunner, Arasaka runner, Placide) acquires the
nearest online tower within `range` that is not inside an ICE Deck firewall, and after `time`
seconds of continuous contact takes it OFFLINE for `disable` seconds. Ranges are set to sit just
outside SMG range and inside sniper range (2.8–3.6). Placide holds two hacks at once. Purge
(2 RAM) restores a tower instantly; Cyberware Malfunction drops a runner's hacks.

**Blackwall Husk** (elite, white with a red ring and HUSK label): its hacks **pierce ICE Deck
firewalls**, drawn as a red link. Appears sparingly: Pacifica from wave 7, City Center from wave 5,
capped at one per wave (two from wave 9). The counter is killing it before 2.4s elapse, or purging.

### ICE shields
From wave 4 a share of non-runner enemies spawn shielded; every boss is shielded and its shield
regenerates (10s baseline). A shielded enemy takes 20% tower damage (Arc Node 50%, bosses 10%)
until **any quickhack cast on it** breaks the shield (+150 score). Share ramps 8% → 38% per wave
and is capped per district (22% Watson, +6%/district, max 40%) so early maps are feasible on base
RAM. This is the mechanic that makes hacking mandatory rather than optional.

## Quickhacks (`src/data/quickhacks.js`)

Short Circuit (4, burst, ×2 vs mech/drone), Overheat (3, burn), Reboot Optics (3, slow 70%),
Cyberware Malfunction (5, stun, drops hacks), Contagion (6, spreading DoT), Purge (2, on a tower).
Selecting one shows its description in the strip over the wave bar; tap an enemy to cast.

## Breach Protocol (`src/game/breach.js`)

Cyberpunk 2077 code matrix: 5×5 (6×6 from Santo Domingo), buffer 7 (8). First pick from row 0,
then alternate column/row of the last pick. The generator plants a valid path and cuts the three
daemon sequences from it with overlaps, so every offered daemon is reachable in one buffer
(brute-force verified over thousands of seeds). Timer 35s minus 2 per district, starts on first pick.
Charges: 1 at start, +1 after waves 3, 6, 9. At most one money (DATAMINE) daemon per matrix.

Daemons: Datamine V1/V2/V3 (80/180/350 €$), Icepick (−20% tower cost, once), Mass Vulnerability
(+35% damage next wave), Blackwall ICE (runners can't hack next wave; rare), Overclock (+50% fire
rate next wave), RAM Patch (+4 max RAM, refill), Core Repair (+4 core), Bounty Hunter (+60% eddies).

## Access points (`src/data/districts.js`)

Nodes on the map, jacked for RAM with a cooldown. TRAP (AoE burst), DOOR (seals the road 4–5s,
drones fly over), TURRET (hijack a map turret for ~20s; placed inside route loops), REROUTE
(Westbrook, Pacifica: new spawns take the long road for 25s, then traffic reverts).

## Districts

| # | id | Routes | Signature |
|---|---|---|---|
| 1 | watson | 1 (28 cells) | tutorial; rain, neon, puddles |
| 2 | westbrook | 2, reroute | fast Tyger Claws; lanterns, petals |
| 3 | heywood | 1 | 6th Street heavies, trucks; murals, heat |
| 4 | santo | 2 simultaneous | mechs; pipes, hazard road, sparks |
| 5 | pacifica | 2, reroute | runner-heavy; surf, sigils, fog |
| 6 | center | 2 simultaneous | Arasaka; marble, holo sweeps |

Bosses: Royce, Oni, War Wagon, Minotaur, Placide, Smasher (regenerating).

## Difficulty tiers (`src/data/tiers.js`)

| Tier | HP | Count | Speed | ICE | Boss regen | RAM refund | Score |
|---|---|---|---|---|---|---|---|
| Street Kid | 0.7 | 0.8 | 1.0 | 0.6 | 14s | 0 | ×1 |
| Netrunner | 1.0 | 1.0 | 1.0 | 1.0 | 10s | 0 | ×1.5 |
| Legend | 1.5 | 1.25 | 1.08 | 1.5 | 7s | 1 | ×2.5 |
| Blackwall | 1.8 | 1.35 | 1.12 | 1.8 | 6s | 1.5 | ×4 |

Picked on the district screen, saved in settings. Stars count from any tier.

## Scoring (`src/core/session.js`, hooks in `game.js`)

Kill `reward × 10 × combo multiplier` (combo climbs on kills within 1.5s, multiplier up to ×3.5),
boss +5000, wave clear `500 × wave` (+250 clean), daemon +300, access point +100, purge +50,
shield break +150, early call 25/s, win `core × 200`. Tier multiplier applies to everything.
A loss banks half toward the district best and zero stars.

## Presentation

Canvas 2D at DPR ≤ 2. Per-district ground layer rendered once to an offscreen canvas
(`src/render/themes.js`), ambient particles per district. All audio is synthesized in
`src/core/audio.js`: weapon sounds run on a quieter low-passed bus; events (wave, boss, breach,
shield break) on the main bus. SFX has FULL / LOW / OFF.

## PWA

`sw.js` precaches every file under a versioned cache name; the deploy workflow stamps the name
with the commit SHA so installed apps fetch a new version on their next launch. The page checks
for updates when foregrounded and reloads itself only from the main menu. Audio resumes after
iOS interruptions; the ringer switch is bypassed via `navigator.audioSession`.
