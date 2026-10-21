// Headless balance simulator: a simple bot plays each district. Reports lives after each wave.
import { Game } from '../src/game/game.js';
import { DISTRICTS } from '../src/data/districts.js';
import { TOWERS } from '../src/data/towers.js';
import { QUICKHACKS } from '../src/data/quickhacks.js';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const noop = () => {};
const ui = { onDistrictStart: noop, toast: noop, closePanel: noop, refreshTrays: noop, openTowerPanel: noop, openApPanel: noop, showBreach: noop, hideBreach: noop, tickBreach: noop, showResult(r) { this.result = r; }, result: null };
const mode = process.argv[2] || 'basic';
const only = process.argv[3];

function coverage(g, c, r, range) { let n = 0; for (const rt of g.routes) for (const [pc, pr] of rt.cellList) if (Math.hypot(pc - c, pr - r) <= range) n++; return n; }
function bestCell(g, range) {
  let best = null, bs = -1;
  for (let c = 0; c < g.cols; c++) for (let r = 0; r < g.rows; r++) {
    if (!g.buildable(c, r)) continue; const s = coverage(g, c, r, range) - 0.05 * g.towers.filter(t => Math.hypot(t.c - c, t.r - r) < 1.5).length * 0; if (s > bs) { bs = s; best = { c, r, s }; }
  }
  return best;
}
function bot(g) {
  const order = ['smg', 'smg', 'tesla', 'sniper', 'deck', 'smg', 'rocket', 'flamer', 'sniper', 'tesla', 'deck', 'rocket', 'smg', 'sniper', 'rocket', 'tesla', 'flamer', 'smg'];
  let idx = g.stats.built; let guard = 0;
  while (guard++ < 10) {
    let id = order[idx % order.length]; let tries = 0;
    while (!g.towerUnlocked(id) && tries++ < 6) { idx++; id = order[idx % order.length]; }
    const cost = g.towerCost(id);
    if (g.eddies < cost) {
      // try upgrades instead when rich enough relative to next tower
      break;
    }
    const cell = bestCell(g, TOWERS[id].levels[0].range);
    if (!cell || cell.s < 3) break;
    if (g.towers.length >= 14) break;
    g.build(id, cell.c, cell.r); idx++;
  }
  // Upgrades: cheapest available upgrade if affordable and towers >= 6
  if (g.towers.length >= 6) {
    const cands = g.towers.filter(t => t.level < 2).sort((a, b) => g.towerCost(a.type, a.level + 1) - g.towerCost(b.type, b.level + 1));
    for (const t of cands) { if (g.eddies >= g.towerCost(t.type, t.level + 1) + 100) g.upgrade(t); else break; }
  }
  if (mode === 'hacker') {
    for (const t of g.towers) if (t.offline > 0 && g.ram >= 2) g.purge(t);
    const boss = g.enemies.find(e => e.boss); const first = g.enemies.reduce((a, b) => (!a || b.dist > a.dist) ? b : a, null);
    if (g.ram >= 10 && boss) g.castHack(QUICKHACKS.short, boss);
    else if (g.ram >= g.ramMax - 0.5 && first) g.castHack(QUICKHACKS.short, first);
    for (const ap of g.accessPoints) if (ap.cooldown <= 0 && g.ram >= ap.cost + 4) {
      const x = ap.c + 0.5, y = ap.r + 0.5;
      if (ap.type === 'TRAP' && g.enemies.filter(e => Math.hypot(e.x - x, e.y - y) <= ap.radius).length >= 3) g.jackIn(ap);
      if (ap.type === 'TURRET' && g.enemies.length >= 6) g.jackIn(ap);
      if (ap.type === 'DOOR' && g.enemies.filter(e => Math.hypot(e.x - x, e.y - y) <= 1.5).length >= 3) g.jackIn(ap);
    }
  }
}
for (const d of DISTRICTS) {
  if (only && d.id !== only) continue;
  const g = new Game(ui); ui.result = null; g.startDistrict(d);
  const log = [];
  while (g.state === 'play') {
    bot(g);
    g.startWave();
    let t = 0;
    while (g.waveActive && g.state === 'play' && t < 400) { g.step(1 / 30); t += 1 / 30; if (Math.floor(t * 30) % 30 === 0) bot(g); }
    log.push(`w${g.wave}:${g.lives}`);
    if (g.state !== 'play') break;
  }
  const r = ui.result;
  console.log(`${d.id.padEnd(10)} ${r && r.won ? 'WIN ' : 'LOSS'} stars=${r ? r.stars : '?'} towers=${g.towers.length} built=${g.stats.built} eddiesLeft=${Math.floor(g.eddies)} | ${log.join(' ')}`);
}
