// Counts how many towers get hacked offline per district by a bot that never purges.
// Use it to check enemy netrunners actually complete hacks. Usage: node tools/hackcount.mjs [tier]
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Game } = await import('../src/game/game.js');
const { DISTRICTS } = await import('../src/data/districts.js');
const { TOWERS } = await import('../src/data/towers.js');
const noop = () => {}; let offlineEvents = 0;
const ui = { onDistrictStart: noop, toast: noop, closePanel: noop, refreshTrays: noop, openTowerPanel: noop, openApPanel: noop, showBreach: noop, hideBreach: noop, tickBreach: noop, showResult: noop };
for (const d of DISTRICTS) {
  const g = new Game(ui); g.startDistrict(d, process.argv[2] || 'netrunner'); offlineEvents = 0; let wasOff = new Set();
  const cov = (c, r, range) => { let n = 0; for (const rt of g.routes) for (const [pc, pr] of rt.cellList) if (Math.hypot(pc - c, pr - r) <= range) n++; return n; };
  const order = ['smg', 'smg', 'tesla', 'sniper', 'smg', 'rocket', 'smg', 'tesla']; let idx = 0;
  while (g.state === 'play') {
    for (let k = 0; k < 4; k++) { const t = order[idx % order.length]; if (!g.towerUnlocked(t) || g.eddies < g.towerCost(t)) break; let best = null, bs = -1; for (let c = 0; c < 9; c++) for (let r = 0; r < 14; r++) if (g.buildable(c, r)) { const s = cov(c, r, TOWERS[t].levels[0].range); if (s > bs) { bs = s; best = [c, r]; } } if (!best) break; g.build(t, best[0], best[1]); idx++; }
    g.startWave(); let t = 0;
    while (g.waveActive && g.state === 'play' && t < 400) { g.step(1 / 30); t += 1 / 30; for (const tw of g.towers) { const off = tw.offline > 0; if (off && !wasOff.has(tw.id)) offlineEvents++; off ? wasOff.add(tw.id) : wasOff.delete(tw.id); } }
  }
  console.log(d.id.padEnd(10), 'towers hacked offline:', offlineEvents, '| result wave', g.wave, 'lives', g.lives);
}
