# Night City Breach

A cyberpunk tower defense game for iPhone, built as an installable web app (PWA). No app store, no build step: open it in Safari, add it to your home screen, and play full-screen offline.

## Play it on your iPhone

1. Host the folder anywhere static (GitHub Pages is wired up, see below).
2. Open the URL in **Safari** on your iPhone.
3. Tap the **Share** button, then **Add to Home Screen**.
4. Launch it from the home screen icon. It runs full-screen in portrait and works offline after the first load.

### GitHub Pages

A workflow in `.github/workflows/pages.yml` deploys the repo root on every push to `main`.
Enable it once in the repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
The game will be live at `https://<your-user>.github.io/towerdefense/`.

### Local

```
npx http-server -p 8080 .
```

Then open `http://localhost:8080`. Keyboard shortcuts on desktop: `1-6` select towers, `Space` starts a wave, `B` opens Breach Protocol, `Q` toggles the quickhack tray, `P` pauses.

## The game

Defend the CORE across six Night City districts, ten waves each, boss on wave ten. Winning a district unlocks the next one and new towers.

| # | District | Threat | Boss |
|---|----------|--------|------|
| 1 | Watson | Scavs, Maelstrom, drones | Royce |
| 2 | Westbrook | Tyger Claws, cyber-ronin, reroutable path | Oni |
| 3 | Heywood | Valentinos, 6th Street heavies, trucks | War Wagon |
| 4 | Santo Domingo | Militech mechs, two spawn points | Minotaur |
| 5 | Pacifica | Voodoo Boys netrunners everywhere | Placide |
| 6 | City Center | Arasaka troopers, runners, mechs | Smasher |

### Towers

Saratoga SMG, Nekomata sniper, Arc Node chain lightning, Thermal Vent flamer, ICE Deck firewall, Arasaka rocket pod. Three upgrade tiers each.

### Hacking

- **Quickhacks** cost RAM, which regenerates (faster near ICE Decks): Short Circuit, Overheat, Reboot Optics, Cyberware Malfunction, Contagion, and Purge.
- **Enemy netrunners** hack your towers offline. Towers inside an ICE Deck firewall are immune. Purge brings a hacked tower back instantly.
- **Breach Protocol** runs between waves: pick codes from the matrix, alternating rows and columns, to upload daemons (cheaper towers, extra eddies, enemy vulnerability, Blackwall ICE, overclock, and more). One breach per wave, timer starts on your first pick.
- **Access points** on the map can be jacked into for RAM: detonate traps, seal blast doors, hijack turrets, or reroute the enemy path.

## Code layout

```
index.html            shell + DOM for HUD, trays, panels, screens
css/style.css         neon UI
src/config/tokens.js  design tokens (palette, fonts, grid, timing)
src/data/             towers, enemies, quickhacks, daemons, districts
src/core/             seeded rng, save (localStorage), synthesized audio
src/game/             path geometry, wave generator, breach puzzle, Game simulation
src/render/           canvas renderer
src/ui/               DOM UI controller
src/main.js           loop, input, PWA registration
sw.js                 offline cache
manifest.webmanifest  PWA manifest
```

Everything is plain ES modules. No dependencies, no bundler.
