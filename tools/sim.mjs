// Headless balance simulator: a simple bot plays each district. Reports lives after each wave.
if (process.env.TUNE) globalThis.__NCB_TUNE = JSON.parse(process.env.TUNE);
if (process.env.START) { const { DISTRICTS: DS } = await import('../src/data/districts.js'); const st = JSON.parse(process.env.START); for (const d of DS) if (st[d.id]) d.startEddies = st[d.id]; }
const { Game } = await import('../src/game/game.js');
import { DISTRICTS } from '../src/data/districts.js';
import { TOWERS } from '../src/data/towers.js';
import { QUICKHACKS } from '../src/data/quickhacks.js';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const noop = () => {};
const ui = { onDistrictStart: noop, toast: noop, closePanel: noop, refreshTrays: noop, openTowerPanel: noop, openApPanel: noop, showBreach: noop, hideBreach: noop, tickBreach: noop, showResult(r) { this.result = r; }, result: null };
const mode = process.argv[2] || 'basic';
const only = process.argv[3];

function coverage(g, c, r, range) { let n = 0; const routes = g.district.routeMode === 'all' ? g.routes : [g.routes[g.activeRoute]]; for (const rt of routes) for (const [pc, pr] of rt.cellList) if (Math.hypot(pc - c, pr - r) <= range) n++; return n; }
function bestCell(g, range) {
  let best = null, bs = -1;
  for (let c = 0; c < g.cols; c++) for (let r = 0; r < g.rows; r++) {
    if (!g.buildable(c, r)) continue; const s = coverage(g, c, r, range) - 0.05 * g.towers.filter(t => Math.hypot(t.c - c, t.r - r) < 1.5).length * 0; if (s > bs) { bs = s; best = { c, r, s }; }
  }
  return best;
}
function bot(g) {
  // SMGs open cheaply; snipers and Arc Nodes carry bosses (armor-piercing / shield-piercing).
  const order = ['smg', 'smg', 'sniper', 'tesla', 'sniper', 'deck', 'tesla', 'rocket', 'sniper', 'tesla', 'deck', 'sniper', 'rocket', 'sniper', 'tesla', 'rocket', 'sniper', 'tesla'];
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
    if (g.towers.length >= 10) break;
    g.build(id, cell.c, cell.r); idx++;
  }
  // Upgrades: cheapest available upgrade if affordable and towers >= 6
  // Past six towers, upgrades come before new builds: snipers and Arc Nodes first (they carry bosses).
  if (g.towers.length >= 6) {
    const pri = { sniper: 0, tesla: 1, rocket: 2, deck: 3, smg: 4, flamer: 5 };
    const cands = g.towers.filter(t => t.level < 2).sort((a, b) => (pri[a.type] - pri[b.type]) || (a.level - b.level));
    for (const t of cands) { if (g.eddies >= g.towerCost(t.type, t.level + 1)) g.upgrade(t); else break; }
  }
  if (mode === 'hacker') {
    const boss = g.enemies.find(e => e.boss);
    // While a boss is up, RAM is reserved for it: no purges, no access points except traps on the boss.
    for (const t of g.towers) if (!boss && t.offline > 0 && g.ram >= 2) g.purge(t); const first = g.enemies.reduce((a, b) => (!a || b.dist > a.dist) ? b : a, null);
    const iced = g.enemies.filter(e => e.ice && !e.boss).sort((a, b) => b.dist - a.dist)[0];
    // Boss on the field: every 4 RAM goes into Short Circuit on it (ignores armor, breaks its shield).
    if (boss && g.ram >= 4) g.castHack(QUICKHACKS.short, boss);
    else if (!boss && iced && g.ram >= 3) g.castHack(QUICKHACKS.overheat, iced);
    else if (g.ram >= g.ramMax - 0.5 && first) g.castHack(QUICKHACKS.short, first);
    const bossWave = g.waveActive && g.currentWave && g.currentWave.boss;
    for (const ap of g.accessPoints) if (ap.cooldown <= 0) {
      const x = ap.c + 0.5, y = ap.r + 0.5;
      if (bossWave) {
        // Boss wave: the long road, the door and the trap are all aimed at the boss.
        if (ap.type === 'REROUTE' && g.activeRoute === 0 && g.ram >= ap.cost && (boss ? boss.dist < 2 : g.spawnList.some(s => s.type === g.district.boss))) g.jackIn(ap);
        else if (boss && ap.type === 'DOOR' && g.ram >= ap.cost && Math.hypot(boss.x - x, boss.y - y) <= 1.2 && boss.dist < (ap.doorDist[boss.routeIdx] ?? -1)) g.jackIn(ap);
        else if (boss && ap.type === 'TRAP' && g.ram >= ap.cost && Math.hypot(boss.x - x, boss.y - y) <= ap.radius) g.jackIn(ap);
        else if (boss && ap.type === 'TURRET' && g.ram >= ap.cost + 4 && Math.hypot(boss.x - x, boss.y - y) <= ap.range + 1) g.jackIn(ap);
        continue;
      }
      if (g.ram < ap.cost + 4) continue;
      if (ap.type === 'TRAP' && g.enemies.filter(e => Math.hypot(e.x - x, e.y - y) <= ap.radius).length >= 3) g.jackIn(ap);
      if (ap.type === 'TURRET' && g.enemies.length >= 6) g.jackIn(ap);
      if (ap.type === 'DOOR' && g.enemies.filter(e => Math.hypot(e.x - x, e.y - y) <= 1.5).length >= 3) g.jackIn(ap);
    }
  }
}
for (const d of DISTRICTS) {
  if (only && d.id !== only) continue;
  const g = new Game(ui); ui.result = null; g.startDistrict(d, process.env.TIER || 'netrunner');
  const log = [];
  while (g.state === 'play') {
    bot(g);
    g.startWave();
    let t = 0;
    let lastLog = -1;
    while (g.waveActive && g.state === 'play' && t < 400) {
      g.step(1 / 30); t += 1 / 30; if (Math.floor(t * 30) % 15 === 0) bot(g);
      if (process.env.BOSSDBG) { const b = g.enemies.find(e => e.boss); if (b && Math.floor(t / 3) !== lastLog) { lastLog = Math.floor(t / 3); console.log(`  boss t=${t.toFixed(0)}s hp=${Math.round(b.hp)}/${b.maxHp} ice=${b.ice} dist=${b.dist.toFixed(1)}/${b.route.length} ram=${g.ram.toFixed(1)} towers=${g.towers.map(x => x.type[0] + x.level).join('')}`); } }
    }
    log.push(`w${g.wave}:${g.lives}`);
    if (g.state !== 'play') break;
  }
  const r = ui.result;
  console.log(`${d.id.padEnd(10)} ${r && r.won ? 'WIN ' : 'LOSS'} stars=${r ? r.stars : '?'} towers=${g.towers.length} built=${g.stats.built} eddiesLeft=${Math.floor(g.eddies)} | ${log.join(' ')}`);
}
