# Night City Breach

A cyberpunk tower defense for iPhone with a hacking layer: quickhacks, enemy netrunners, ICE
shields, Breach Protocol, and map access points. Built as an installable web app (PWA): no app
store, no build step, no dependencies. Open it in Safari, add it to the home screen, play offline.

Live: **https://t3hprofit.github.io/towerdefense/** (deployed from this branch by
`.github/workflows/static.yml` on every push).

Docs:
- `docs/DESIGN.md` — every mechanic and its numbers.
- `docs/BALANCE.md` — how it is tuned, the playtest log, and which knob fixes which complaint.
- `CLAUDE.md` — orientation for an AI session picking the project up.

## Play it on your iPhone

1. Open the live URL in **Safari**.
2. Share → **Add to Home Screen**.
3. Launch from the icon. Full-screen portrait, works offline after the first load.

Updates: every deploy gets a new cache version, so the installed app picks up changes on its
next launch (it checks when foregrounded and reloads itself from the main menu).

## The game in one screen

- **Build** towers in the BUILD tray, tap a cell. Tap a tower to upgrade, sell, or purge.
- **Quickhacks** cost RAM: Short Circuit, Overheat, Reboot Optics, Cyberware Malfunction,
  Contagion, Purge. Select one, tap an enemy. RAM regenerates; ICE Decks regenerate it faster.
- **ICE shields**: from wave 4 some enemies (and every boss) are shielded. Towers do 20% damage
  until any quickhack breaks the shield. The QUICKHACKS tab pulses when one is on the field.
- **Enemy netrunners** hack your towers offline unless the tower sits inside an ICE Deck firewall.
  PURGE (2 RAM) brings a tower back.
- **Breach Protocol** between waves (charges: 1 to start, +1 after waves 3, 6, 9): the code
  matrix. Alternate row/column picks to upload daemons. The wave clock keeps running (+10s).
- **Access points**: jack in for RAM to detonate traps, seal blast doors, hijack map turrets, or
  reroute the enemy road for 25 seconds.
- **Wave clock**: waves auto-start; call early for bonus score.
- **Tiers**: Street Kid, Netrunner (the intended challenge), Legend, Blackwall. Picked on the
  district screen. Higher tiers multiply score; a loss banks half.

Six districts, ten waves each: Watson, Westbrook, Heywood, Santo Domingo, Pacifica, City Center.
Each has its own look, roster, access points and boss.

## Run locally

```
npx http-server -p 8080 -s .
```

Open `http://localhost:8080`. Desktop keys: `1-6` select towers, `Space` starts a wave,
`B` opens Breach, `Q` toggles the quickhack tray, `P` pauses.

## Code layout

```
index.html            shell + DOM for HUD, trays, panels, screens
css/style.css         neon UI, safe-area handling, tier picker
src/config/tokens.js  design tokens
src/data/             towers, enemies, quickhacks, daemons, districts (maps), tiers
src/core/             rng, save (localStorage), session (sessionStorage score), synthesized audio
src/game/             path geometry, wave generator + ICE assignment, breach puzzle, Game simulation
src/render/           canvas renderer, per-district themes (ground layer + ambient particles)
src/ui/               DOM UI controller
src/main.js           loop, input, PWA registration, window.__ncb debug handle
sw.js                 offline precache (cache name stamped by the deploy workflow)
manifest.webmanifest  PWA manifest
tools/                validator, balance sim, traces, Playwright tests and captures
docs/                 design + balance references
```

Everything is plain ES modules. Adding a source file means adding it to `ASSETS` in `sw.js`.

## Testing and tuning tools

Run from the repo root. Node-only tools need nothing installed. Browser tools need a running
server (`npx http-server -p 8080 -s .`) and Playwright with Chromium; on the cloud runner that is
`NODE_PATH=/opt/node-tools/node_modules`, elsewhere `npm i -g playwright && npx playwright install chromium`
and `NODE_PATH="$(npm root -g)"`.

| Command | What it tells you |
|---|---|
| `node tools/validate.mjs` | Routes, blocked cells, access points and rosters are consistent; prints every wave. Ends `VALIDATION OK`. |
| `node tools/sim.mjs hacker [district]` | The balance yardstick. Bot plays each district; prints result, stars, lives per wave. `basic` = no hacking. Env: `TIER=street\|netrunner\|legend\|blackwall`, `TUNE='{json}'`, `START='{json}'`. |
| `node tools/trace.mjs <district> [tier]` | Per-wave trace: lives, towers, towers hacked offline, shielded count, RAM, purges, composition. |
| `node tools/hackcount.mjs [tier]` | How many towers enemy runners knock offline per district against a bot that never purges. |
| `NODE_PATH=… node tools/smoke.mjs` | Browser end-to-end: menu → build → wave → quickhack → breach → access point → 5 waves. Must end `ERRORS: none`. Screenshots in `tools/shots/`. |
| `NODE_PATH=… node tools/score-test.mjs` | Scoring and session-state checks (HUD, sessionStorage, reload, best score, fallback). All lines `PASS`. |
| `NODE_PATH=… node tools/intro-test.mjs` | The one-time Breach Protocol intro card shows, pauses, opens the breach, and does not repeat. |
| `NODE_PATH=… node tools/capture-themes.mjs` | One mid-wave screenshot per district in `tools/shots/themes/`. |
| `NODE_PATH=… node tools/capture-screens.mjs` | District list, Pacifica wave, tower panel, result and pause screens in `tools/shots/screens/`. |
| `python3 tools/make-icons.py icons` | Regenerates the PWA icons (needs Pillow). |

`BASE_URL` and `SHOT_DIR` override the server and screenshot directory for the browser tools.
