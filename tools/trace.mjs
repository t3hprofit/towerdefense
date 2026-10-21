// Wave-by-wave trace of one district with the hacking bot: lives, towers, towers knocked offline,
// shielded count, RAM and purges per wave. Usage: node tools/trace.mjs <districtId> [tier]
// Honors TUNE (see sim.mjs).
if (process.env.TUNE) globalThis.__NCB_TUNE = JSON.parse(process.env.TUNE);
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const { Game } = await import('../src/game/game.js');
const { DISTRICTS } = await import('../src/data/districts.js');
const { TOWERS } = await import('../src/data/towers.js');
const { QUICKHACKS } = await import('../src/data/quickhacks.js');
const { ENEMIES } = await import('../src/data/enemies.js');
const noop = () => {}; const ui = { onDistrictStart: noop, toast: noop, closePanel: noop, refreshTrays: noop, openTowerPanel: noop, openApPanel: noop, showBreach: noop, hideBreach: noop, tickBreach: noop, showResult: noop };
const d = DISTRICTS.find(x => x.id === process.argv[2]); const g = new Game(ui); g.startDistrict(d, process.argv[3] || 'netrunner');
const cov = (c, r, range) => { let n = 0; const routes = g.district.routeMode === 'all' ? g.routes : [g.routes[g.activeRoute]]; for (const rt of routes) for (const [pc, pr] of rt.cellList) if (Math.hypot(pc - c, pr - r) <= range) n++; return n; };
const order = ['smg', 'smg', 'tesla', 'sniper', 'deck', 'smg', 'rocket', 'flamer', 'sniper', 'tesla', 'deck', 'rocket', 'smg', 'sniper']; let idx = 0;
const bot = () => { for (let k = 0; k < 6; k++) { let t = order[idx % order.length]; let tries = 0; while (!g.towerUnlocked(t) && tries++ < 6) { idx++; t = order[idx % order.length]; } if (g.eddies < g.towerCost(t) || g.towers.length >= 14) break; let best = null, bs = -1; for (let c = 0; c < 9; c++) for (let r = 0; r < 14; r++) if (g.buildable(c, r)) { const s = cov(c, r, TOWERS[t].levels[0].range); if (s > bs) { bs = s; best = [c, r]; } } if (!best || bs < 3) break; g.build(t, best[0], best[1]); idx++; }
  if (g.towers.length >= 6) for (const t of g.towers.filter(t => t.level < 2).sort((a, b) => g.towerCost(a.type, a.level + 1) - g.towerCost(b.type, b.level + 1))) { if (g.eddies >= g.towerCost(t.type, t.level + 1) + 100) g.upgrade(t); else break; }
  for (const t of g.towers) if (t.offline > 0 && g.ram >= 2) g.purge(t);
  const iced = g.enemies.filter(e => e.ice).sort((a, b) => b.dist - a.dist)[0]; const boss = g.enemies.find(e => e.boss); const first = g.enemies.reduce((a, b) => (!a || b.dist > a.dist) ? b : a, null);
  if (iced && g.ram >= 3) g.castHack(QUICKHACKS.overheat, iced); else if (g.ram >= 10 && boss) g.castHack(QUICKHACKS.short, boss); else if (g.ram >= g.ramMax - 0.5 && first) g.castHack(QUICKHACKS.short, first); };
while (g.state === 'play') {
  bot(); const l0 = g.lives; let off = 0; const seen = new Set(); let iceLeaks = 0, runnerKills = 0;
  g.startWave(); let t = 0;
  while (g.waveActive && g.state === 'play' && t < 400) { g.step(1 / 30); t += 1 / 30; if (Math.floor(t * 30) % 30 === 0) bot(); for (const tw of g.towers) if (tw.offline > 0 && !seen.has(tw.id + ':' + Math.floor(tw.offline))) { if (!seen.has(tw.id)) off++; seen.add(tw.id); } }
  const w = g.currentWave; const comp = {}; for (const gr of w.groups) comp[gr.type] = (comp[gr.type] || 0) + gr.count; const iced = w.groups.reduce((s, gr) => s + (gr.ice || []).filter(Boolean).length, 0);
  console.log(`w${g.wave} lives ${l0}->${g.lives} towers=${g.towers.length} offlineEvents=${off} iced=${iced} ram=${g.ram.toFixed(0)}/${g.ramMax} purges=${g.stats.purges} | ${Object.entries(comp).map(([k, v]) => v + 'x' + k).join(' ')}`);
}
