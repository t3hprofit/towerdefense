# Night City Breach — agent notes

Cyberpunk tower defense PWA for iPhone. Plain ES modules, canvas renderer, no bundler, no
dependencies. Everything (art, audio, icons) is generated in code. Read this file first, then
`docs/DESIGN.md` (what the mechanics are) and `docs/BALANCE.md` (how they are tuned and why).

## Where things are

| Path | What |
|---|---|
| `index.html`, `css/style.css` | DOM shell: HUD, trays, panels, overlay screens. Portrait, safe-area aware. |
| `src/main.js` | Boot, input (pointer events), game loop, PWA registration, `window.__ncb` debug handle. |
| `src/game/game.js` | The simulation: towers, enemies, projectiles, hacking, breach, waves, scoring hooks. |
| `src/game/waves.js` | Deterministic wave generator (seeded per district+wave) and ICE shield assignment. |
| `src/game/breach.js` | Breach Protocol puzzle logic (row/column alternation, planted solvable path). |
| `src/game/path.js` | Route expansion (waypoints → polyline, cells, distances). |
| `src/data/*.js` | Content: towers, enemies, quickhacks, daemons, districts (maps), tiers (difficulty). |
| `src/render/renderer.js` | Canvas drawing. `src/render/themes.js` per-district ground layer + ambient particles. |
| `src/ui/ui.js` | All DOM: menus, trays, panels, tip strip, breach overlay, results, toasts. |
| `src/core/` | `audio.js` (synth SFX + music), `save.js` (localStorage), `session.js` (sessionStorage score), `rng.js`. |
| `sw.js`, `manifest.webmanifest` | Offline cache + install metadata. |
| `tools/` | Validator, balance sim, traces, Playwright smoke/capture tests. See README "Testing". |
| `.github/workflows/static.yml` | Deploys this branch to GitHub Pages on push (the owner's workflow). |

## Hard rules

- **Add every new source file to the `ASSETS` list in `sw.js`** or installed PWAs will fail to load it offline.
- **Never hand-edit the cache name in `sw.js`.** It is `ncb-dev` in the repo; the deploy workflow stamps it with the commit SHA. That is what makes installed apps update.
- **No build step.** Anything added must run as-is from static hosting. No npm dependencies in the game itself.
- **Portrait, 390px wide is the design target.** The top HUD must stay one row at that width.
- **Commit with the attribution footer** the session reminder gives you and push to the designated branch; the owner's workflow deploys from it.
- Run `node tools/validate.mjs` after touching `src/data/districts.js`; run the smoke test after touching UI.

## Decisions the owner has made (do not relitigate)

- The ICE Deck unlocks at Heywood (district 3), **not earlier**. Watson and Westbrook are meant to be played without a firewall.
- Losses record **half** score toward the district best and zero stars.
- Nothing is ever drawn over the map: tower/quickhack descriptions live in the strip over the wave bar, and all game messages go through the one-line **ticker** under the map (`ui.toast()` queues into it). No overlay toasts on the field.
- The game must **not** auto-switch trays. The QUICKHACKS tab pulses when a shielded enemy is present; that is the only prompt.
- A tap on the field while a panel is open only dismisses the panel. It never builds or casts.
- A boss reaching the core is an immediate loss, never a 5-core leak.
- Reroute access points are temporary (25s), not a permanent toggle.
- Breach charges: 1 to start, +1 after waves 3, 6, 9. The breach does not pause the battlefield.
- Four tiers: Street Kid / Netrunner / Legend / Blackwall. **Netrunner is the baseline the whole game is tuned around.**

## Balance workflow (short version, details in docs/BALANCE.md)

1. Make the change in `src/data/*` or the tunables at the top of `src/game/game.js` / `waves.js`.
2. `node tools/sim.mjs hacker` with `TIER=netrunner` (default) — target is a win in every district with 1–2 stars for the bot.
   `TIER=street` should be 2–3 stars; `TIER=legend` mostly losses; `TIER=blackwall` losses.
3. `node tools/trace.mjs <district>` to see which wave breaks and why (lives, offline towers, shielded count, RAM).
4. `node tools/hackcount.mjs` to confirm enemy netrunners actually complete hacks (should be >0 everywhere, large on Pacifica).
5. The bot is weaker than the owner. If the owner reports a perfect 20-core clear on Netrunner where the bot gets ~6, that is expected; do not chase the owner with global knobs — that is what tiers are for.
6. Sweep candidate values without editing files: `TUNE='{"hpRamp":0.3,"econ":0.6,"diffs":{"watson":1.6}}' node tools/sim.mjs hacker`.

## Testing commands

```
node tools/validate.mjs                       # map/route/AP sanity + wave listing
node tools/sim.mjs hacker [district]          # balance bot (TIER=, TUNE=, START= env)
node tools/trace.mjs <district> [tier]        # per-wave trace with the hacking bot
node tools/hackcount.mjs [tier]               # towers knocked offline per district
npx http-server -p 8080 -s .                  # then, in another shell:
NODE_PATH=/opt/node-tools/node_modules node tools/smoke.mjs          # must end ERRORS: none
NODE_PATH=/opt/node-tools/node_modules node tools/score-test.mjs     # scoring/session checks
NODE_PATH=/opt/node-tools/node_modules node tools/capture-themes.mjs # 6 district screenshots
NODE_PATH=/opt/node-tools/node_modules node tools/capture-screens.mjs
```

Playwright is at `/opt/node-tools/node_modules` on the cloud runner; elsewhere install it and set `NODE_PATH` to `npm root -g`. Screenshots land in `tools/shots/` (git-ignored). View PNGs with the Read tool to check layout.

## Gotchas learned the hard way

- `pkill -f "<pattern>"` from a Bash tool call matches the Bash call's own command line and kills the shell (exit 144). Use `kill $(pgrep -f ...)` in a separate call, or just leave `http-server` running.
- The stop hook wants a clean, pushed tree. If the owner halts a change mid-edit, `git checkout --` the files rather than committing them.
- Wave composition is seeded by district id + wave number, so changing a roster reshuffles every wave in that district. Re-run the sim after any roster edit.
- The balance bot scores tower spots by coverage of the *active* route only (`routeMode: 'switch'` maps have an inactive alternate road).
- The bot is weak at bosses: expect it to reach wave 10 healthy and then lose from Westbrook on. Its wave-9 lives are the signal; bosses are calibrated on the owner's runs. `BOSSDBG=1` shows the fight.
- Boss HP has its own curve (`1.2 + 0.3 × (district.num − 1)`) independent of the per-map `difficulty`, because lowering a map's base difficulty once made its boss weaker than the previous district's.
- iOS: `AudioContext` can be `'interrupted'`, not just `'suspended'`. `audio.js` handles both; keep it that way.

## Open ideas (not started)

- Endless / survival mode after City Center, using the tier multipliers.
- Per-tier best scores on the district cards (currently one best per district).
- A fifth tower unlock for City Center (nothing new unlocks there now).
- Sound: a real mix pass with headphones; the current weapon bus was tuned blind.
- Self-hosted Rajdhani/Orbitron woff2 so canvas text matches the intended face offline.
