import { GRID, TIMING } from '../config/tokens.js';
import { TOWERS, SELL_RATIO } from '../data/towers.js';
import { ENEMIES } from '../data/enemies.js';
import { QUICKHACKS } from '../data/quickhacks.js';
import { DAEMONS } from '../data/daemons.js';
import { DISTRICTS } from '../data/districts.js';
import { buildRoute, posAt, distToCell } from './path.js';
import { generateWave, scheduleWave, describeWave } from './waves.js';
import { Breach, daemonPoolFor } from './breach.js';
import { makeRng, hashStr } from '../core/rng.js';
import { Audio } from '../core/audio.js';
import { Save } from '../core/save.js';
import { Session } from '../core/session.js';
import { tierById } from '../data/tiers.js';

const RAM_BASE = 12, RAM_REGEN = 0.45;
// Economy: fraction of listed enemy reward actually paid out. Breach charges are earned every BREACH_EVERY waves.
const TUNE = () => globalThis.__NCB_TUNE || {};
const ECON = () => TUNE().econ ?? 0.6, REWARD_DECAY = () => TUNE().rewardDecay ?? 0.1, BREACH_EVERY = 3;
// Scoring
const COMBO_WINDOW = 1.5, COMBO_CAP = 25, MULT_CAP = 3.5, BOSS_KILL_BONUS = 5000;
const SCORE_KILL = 10, SCORE_WAVE = 500, SCORE_CLEAN_WAVE = 250, SCORE_DAEMON = 300, SCORE_AP = 100, SCORE_PURGE = 50, SCORE_LIFE = 200, SCORE_ICE = 150;
// ICE shields: tower damage multiplier while shielded, Arc Node multiplier, boss shield regen delay.
const ICE_TOWER_MUL = 0.2, ICE_TESLA_MUL = 0.5, ICE_BOSS_MUL = 0.1, ICE_REGEN = 10;
// Wave countdown: seconds before a wave auto-starts; breach adds time; calling early scores per second saved.
const PREP_FIRST = 45, PREP_WAVE = 25, PREP_BOSS = 30, BREACH_BONUS_TIME = 10, SCORE_EARLY = 25;

export class Game {
  constructor(ui) {
    this.ui = ui; this.cols = GRID.cols; this.rows = GRID.rows;
    this.state = 'menu'; this.speed = 1; this.paused = false; this.time = 0;
    this.district = null; this.rngId = 0;
  }

  // ---------------- District lifecycle ----------------
  startDistrict(district, tierId = Save.data.settings.tier || 'street') {
    this.tier = tierById(tierId);
    this.district = district; this.state = 'play'; this.time = 0; this.paused = false; this.speed = 1;
    this.routes = district.routes.map(w => buildRoute(w, this.cols, this.rows));
    this.activeRoute = 0; this.spawnCounter = 0;
    this.pathCells = new Set(); for (const r of this.routes) for (const k of r.cells) this.pathCells.add(k);
    this.blocked = new Set(district.blocked.map(([c, r]) => c + ',' + r));
    this.accessPoints = district.accessPoints.map(ap => ({ ...ap, cooldownDef: ap.cooldown, cooldown: 0, active: 0, fireCd: 0, doorDist: this.routes.map(rt => distToCell(rt, ap.c, ap.r)) }));
    this.apCells = new Set(this.accessPoints.map(ap => ap.c + ',' + ap.r));
    this.towers = []; this.enemies = []; this.projectiles = []; this.particles = []; this.texts = []; this.zaps = [];
    this.eddies = district.startEddies; this.lives = 20; this.ramMax = RAM_BASE; this.ram = RAM_BASE;
    this.wave = 0; this.waveActive = false; this.spawnList = []; this.waveTime = 0; this.waveWon = false;
    this.breachCharges = 1; this.breach = null;
    this.fx = { icepick: false, massvuln: 0, blackwall: 0, overclock: 0, bounty: 0 };
    this.uploadedOnce = new Set();
    this.selected = null; this.selectedTower = null; this.hoverCell = null;
    this.shake = 0; this.flash = 0;
    this.stats = { kills: 0, hacks: 0, breaches: 0, daemons: 0, built: 0, leaks: 0, purges: 0, apHacks: 0 };
    this.nextWave = generateWave(district, 1, this.tier.id);
    this.lastKillT = -Infinity; this.waveLeaked = false; this.waveTimer = PREP_FIRST;
    Session.beginRun(district.id);
    this.hintsShown = new Set();
    this.ui.onDistrictStart();
    this.hint('build', 'Tap a tower below, then tap an empty cell to build.');
  }

  hint(id, msg) {
    if (!this.district?.hints || this.hintsShown.has(id)) return;
    this.hintsShown.add(id); this.ui.toast(msg, 'good', 3600);
  }

  // ---------------- Helpers ----------------
  cellKey(c, r) { return c + ',' + r; }
  inGrid(c, r) { return c >= 0 && c < this.cols && r >= 0 && r < this.rows; }
  towerAt(c, r) { return this.towers.find(t => t.c === c && t.r === r); }
  apAt(c, r) { return this.accessPoints.find(a => a.c === c && a.r === r); }
  buildable(c, r) {
    if (!this.inGrid(c, r)) return false;
    const k = this.cellKey(c, r);
    return !this.pathCells.has(k) && !this.blocked.has(k) && !this.apCells.has(k) && !this.towerAt(c, r);
  }
  towerCost(id, level = 0) {
    const base = TOWERS[id].levels[level].cost;
    return Math.round(base * (this.fx.icepick ? 0.8 : 1));
  }
  towerUnlocked(id) {
    const need = TOWERS[id].unlock; const needIdx = DISTRICTS.findIndex(d => d.id === need);
    const curIdx = DISTRICTS.findIndex(d => d.id === this.district.id);
    return curIdx >= needIdx;
  }
  isFirewalled(tower) {
    return this.towers.some(d => d.type === 'deck' && d.offline <= 0 && Math.hypot(d.c - tower.c, d.r - tower.r) <= d.stats.range + 0.01);
  }
  enemyNear(x, y, radius = 0.6) {
    let best = null, bd = radius;
    for (const e of this.enemies) { if (e.dead) continue; const d = Math.hypot(e.x - x, e.y - y) - e.size * 0.5; if (d < bd) { bd = d; best = e; } }
    return best;
  }

  // ---------------- Input ----------------
  select(kind, id) {
    if (this.selected && this.selected.kind === kind && this.selected.id === id) this.selected = null;
    else this.selected = { kind, id };
    this.selectedTower = null; this.ui.closePanel(); this.ui.refreshTrays();
  }
  tap(x, y) {
    if (this.state !== 'play' || this.paused) return;
    const c = Math.floor(x), r = Math.floor(y);
    // A tap while a tower / access point panel is open only dismisses it (never builds or casts).
    if (this.ui.panelOpen?.()) { const t = this.towerAt(c, r), ap = this.apAt(c, r); this.selectedTower = null; this.ui.closePanel(); if (t) { this.selectedTower = t; this.ui.openTowerPanel(t); } else if (ap) this.ui.openApPanel(ap); return; }
    // Quickhack casting
    if (this.selected?.kind === 'hack') {
      const qh = QUICKHACKS[this.selected.id];
      if (qh.target === 'tower') {
        const t = this.towerAt(c, r);
        if (t && t.offline > 0) { this.purge(t); return; }
        this.ui.toast('PURGE needs an OFFLINE tower', 'warn'); return;
      }
      const e = this.enemyNear(x, y, 0.75);
      if (e) { this.castHack(qh, e); return; }
      // fall through to normal taps if nothing targeted
    }
    if (this.selected?.kind !== 'hack') { const se = this.enemyNear(x, y, 0.75); if (se && se.ice) { this.ui.toast('ICE SHIELD: open QUICKHACKS, pick one, then tap this enemy', 'warn', 3200); return; } }
    const ap = this.apAt(c, r);
    if (ap) { this.selectedTower = null; this.ui.openApPanel(ap); return; }
    const t = this.towerAt(c, r);
    if (t) { this.selectedTower = t; this.ui.openTowerPanel(t); return; }
    if (this.selected?.kind === 'tower') {
      if (this.buildable(c, r)) this.build(this.selected.id, c, r);
      else if (this.inGrid(c, r)) { this.ui.toast('Cannot build here', 'warn'); Audio.play('deny'); }
      return;
    }
    this.selectedTower = null; this.ui.closePanel();
  }

  // ---------------- Towers ----------------
  build(id, c, r) {
    const cost = this.towerCost(id);
    if (!this.towerUnlocked(id)) { this.ui.toast('Tower locked', 'warn'); return; }
    if (this.eddies < cost) { this.ui.toast('Not enough eddies', 'warn'); Audio.play('deny'); return; }
    this.eddies -= cost;
    const def = TOWERS[id];
    const t = { id: ++this.rngId, type: id, c, r, x: c + 0.5, y: r + 0.5, level: 0, stats: { ...def.levels[0] }, cooldown: 0, offline: 0, angle: -Math.PI / 2, kills: 0, spent: cost, flameTick: 0, hackers: 0, pulse: 0 };
    this.towers.push(t); this.stats.built++;
    Audio.play('build'); this.burst(t.x, t.y, def.color, 14, 2.2);
    this.ui.refreshTrays();
    if (this.towers.length === 2) this.hint('wave', 'Press START WAVE when ready. Enemies follow the glowing road.');
  }
  upgrade(t) {
    if (t.level >= 2) return;
    const cost = this.towerCost(t.type, t.level + 1);
    if (this.eddies < cost) { this.ui.toast('Not enough eddies', 'warn'); Audio.play('deny'); return; }
    this.eddies -= cost; t.level++; t.stats = { ...TOWERS[t.type].levels[t.level] }; t.spent += cost;
    Audio.play('upgrade'); this.burst(t.x, t.y, '#fcee0a', 18, 2.6); this.ui.openTowerPanel(t); this.ui.refreshTrays();
  }
  sell(t) {
    const val = Math.round(t.spent * SELL_RATIO);
    this.eddies += val; this.towers.splice(this.towers.indexOf(t), 1);
    this.text(t.x, t.y, `+€$${val}`, '#fcee0a'); Audio.play('sell'); this.selectedTower = null; this.ui.closePanel(); this.ui.refreshTrays();
  }
  purge(t) {
    const qh = QUICKHACKS.purge;
    if (this.ram < qh.cost) { this.ui.toast('Not enough RAM', 'warn'); Audio.play('deny'); return; }
    this.ram -= qh.cost; t.offline = 0; t.hackProgress = 0; this.stats.purges++; this.addScore(SCORE_PURGE);
    for (const e of this.enemies) if (e.hacks) e.hacks = e.hacks.filter(h => h.tower !== t);
    Audio.play('purge'); this.burst(t.x, t.y, '#b14cff', 16, 2.4); this.text(t.x, t.y, 'PURGED', '#b14cff');
    this.ui.closePanel(); this.ui.refreshTrays();
  }

  // ---------------- Quickhacks ----------------
  castHack(qh, e) {
    if (this.ram < qh.cost) { this.ui.toast('Not enough RAM', 'warn'); Audio.play('deny'); return; }
    this.ram -= qh.cost; this.stats.hacks++;
    if (e.ice) { e.ice = false; e.iceRegen = this.tier.bossRegen; this.addScore(SCORE_ICE); this.text(e.x, e.y - 0.7, 'ICE BROKEN', '#00f0ff', 1.2);
      if (this.tier.iceRefund) { this.ram = Math.min(this.ramMax, this.ram + this.tier.iceRefund); this.text(e.x, e.y - 1.1, `+${this.tier.iceRefund} RAM`, '#00f0ff', 0.9); } this.ring(e.x, e.y, 0.9, '#00f0ff'); Audio.play('purge'); }
    const organic = e.tags.includes('organic'), mech = e.tags.includes('mech') || e.tags.includes('drone');
    switch (qh.id) {
      case 'short': this.damage(e, mech ? 180 : 90, { pierce: true, kind: 'hack' }); this.zap(e.x, e.y - 2.5, e.x, e.y, '#00f0ff'); break;
      case 'overheat': e.burn = Math.max(e.burn, 6); e.burnDps = Math.max(e.burnDps, organic ? 27 : 18); break;
      case 'reboot': e.blind = 4; break;
      case 'malfunc': e.stun = Math.max(e.stun, e.boss ? 1 : 3); this.dropHacks(e); Audio.play('stun'); break;
      case 'contagion': e.contagion = 7; e.contagionDps = 10; e.spreadTick = 1; break;
    }
    Audio.play('hack'); this.burst(e.x, e.y, qh.color, 12, 2);
    this.text(e.x, e.y - 0.4, qh.name, qh.color);
    this.ui.refreshTrays();
  }

  dropHacks(e) { for (const hk of e.hacks) { hk.tower.hackers = Math.max(0, hk.tower.hackers - 1); hk.tower.hackProgress = 0; } e.hacks = []; }

  // ---------------- Access points ----------------
  jackIn(ap) {
    if (ap.cooldown > 0) { this.ui.toast('Access point rebooting', 'warn'); return; }
    if (this.ram < ap.cost) { this.ui.toast('Not enough RAM', 'warn'); Audio.play('deny'); return; }
    this.ram -= ap.cost; this.stats.apHacks++; this.addScore(SCORE_AP);
    const x = ap.c + 0.5, y = ap.r + 0.5;
    switch (ap.type) {
      case 'TRAP': {
        let n = 0;
        for (const e of this.enemies.slice()) if (!e.dead && Math.hypot(e.x - x, e.y - y) <= ap.radius) { this.damage(e, ap.dmg, { pierce: true, kind: 'trap' }); n++; }
        this.burst(x, y, '#ff8c1a', 40, 4.5); this.ring(x, y, ap.radius, '#ff8c1a'); this.shake = 0.5; Audio.play('boom');
        this.ui.toast(`${ap.name} DETONATED${n ? ' · ' + n + ' hit' : ''}`, 'pink'); break;
      }
      case 'DOOR': ap.active = ap.duration; Audio.play('door'); this.ui.toast(`${ap.name} SEALED`, 'pink'); break;
      case 'TURRET': ap.active = ap.duration; Audio.play('ap'); this.ui.toast(`${ap.name} HIJACKED`, 'pink'); this.burst(x, y, '#b14cff', 20, 3); break;
      case 'REROUTE':
        this.activeRoute = 1; ap.active = ap.duration; Audio.play('ap');
        this.ui.toast(`REROUTED for ${ap.duration}s · new spawns take the long way`, 'pink'); this.flash = 0.3; break;
    }
    ap.cooldown = ap.cooldownDef;
    this.ui.closePanel(); this.ui.refreshTrays();
  }

  // ---------------- Breach ----------------
  canBreach() { return this.state === 'play' && !this.paused && !this.waveActive && this.breachCharges > 0; }
  openBreach() {
    if (!this.canBreach()) return;
    const rng = makeRng(hashStr(this.district.id + ':breach:' + this.wave + ':' + Date.now()));
    const size = this.district.num >= 4 ? 6 : 5;
    this.breach = new Breach({ size, bufferLen: size === 6 ? 8 : 7, rng, daemonPool: daemonPoolFor(this), seconds: TIMING.breachSeconds - (this.district.num - 1) * 2 });
    this.breachCharges--; this.stats.breaches++;
    if (this.waveTimer !== null) { this.waveTimer += BREACH_BONUS_TIME; this.ui.toast(`+${BREACH_BONUS_TIME}s on the wave clock`, 'pink'); }
    this.state = 'breach'; this.ui.showBreach(this.breach);
  }
  finishBreach() {
    const done = this.breach ? this.breach.completed() : [];
    for (const d of done) this.applyDaemon(d.id);
    this.breach = null; this.state = 'play';
    this.ui.hideBreach(done); this.ui.refreshTrays();
    if (done.length) Audio.play('daemon'); else Audio.play('fail');
  }
  applyDaemon(id) {
    this.stats.daemons++; this.addScore(SCORE_DAEMON); if (DAEMONS[id].once) this.uploadedOnce.add(id);
    switch (id) {
      case 'datamine1': this.eddies += 80; break;
      case 'datamine2': this.eddies += 180; break;
      case 'datamine3': this.eddies += 350; break;
      case 'icepick': this.fx.icepick = true; break;
      case 'massvuln': this.fx.massvuln = 1; break;
      case 'blackwall': this.fx.blackwall = 1; break;
      case 'overclock': this.fx.overclock = 1; break;
      case 'rampatch': this.ramMax += 4; this.ram = this.ramMax; break;
      case 'corerepair': this.lives = Math.min(20, this.lives + 4); break;
      case 'bounty': this.fx.bounty = 1; break;
    }
  }

  // ---------------- Waves ----------------
  startWave() {
    if (this.state !== 'play' || this.paused || this.waveActive || this.wave >= this.district.waves) return;
    if (this.waveTimer !== null && this.waveTimer > 1) { const early = Math.round(this.waveTimer * SCORE_EARLY); this.addScore(early); this.ui.toast(`EARLY CALL +${early} score`, 'good'); }
    this.beginWave();
  }
  beginWave() {
    if (this.waveActive || this.wave >= this.district.waves) return;
    this.waveTimer = null; this.wave++; this.waveActive = true; this.waveTime = 0; this.waveLeaked = false;
    const w = this.nextWave; this.spawnList = scheduleWave(w); this.currentWave = w;
    this.selectedTower = null; this.ui.closePanel();
    Audio.play(w.boss ? 'boss' : 'wave');
    this.ui.toast(w.boss ? `BOSS WAVE · ${ENEMIES[this.district.boss].name}` : `WAVE ${this.wave}`, w.boss ? 'warn' : 'default');
    this.ui.refreshTrays();
  }
  endWave() {
    this.waveActive = false;
    const bonus = this.currentWave.bonus; this.eddies += bonus;
    this.addScore(SCORE_WAVE * this.wave + (this.waveLeaked ? 0 : SCORE_CLEAN_WAVE));
    this.ui.toast(`WAVE ${this.wave} CLEARED · +€$${bonus}`, 'good');
    if (this.fx.massvuln > 0) this.fx.massvuln--; if (this.fx.blackwall > 0) this.fx.blackwall--;
    if (this.fx.overclock > 0) this.fx.overclock--; if (this.fx.bounty > 0) this.fx.bounty--;
    if (this.wave >= this.district.waves) { this.finish(true); return; }
    if (this.wave % BREACH_EVERY === 0) { this.breachCharges++; this.ui.toast('BREACH CHARGE ACQUIRED', 'pink'); }
    this.nextWave = generateWave(this.district, this.wave + 1, this.tier.id);
    if (this.breachCharges > 0) this.hint('breach', 'BREACH available: hack the local net for daemons between waves.');
    if (this.nextWave.groups.some(g => ENEMIES[g.type].hacker)) this.hint('runner', 'Netrunners next wave! They hack towers offline. PURGE restores them.');
    this.waveTimer = this.nextWave.boss ? PREP_BOSS : PREP_WAVE;
    this.ui.refreshTrays();
  }
  waveInfoText() {
    if (this.state !== 'play') return '';
    if (this.waveActive) {
      const left = this.spawnList.length + this.enemies.length;
      return `<b>WAVE ${this.wave}</b> in progress · ${left} hostiles remaining`;
    }
    if (this.wave >= this.district.waves) return 'District secured.';
    const w = this.nextWave; const t = this.waveTimer !== null ? ` · auto in ${Math.ceil(this.waveTimer)}s` : '';
    return `<b>NEXT: WAVE ${this.wave + 1}${w.boss ? ' · BOSS' : ''}</b>${t}<br>${describeWave(w)}`;
  }
  finish(won) {
    if (this.state === 'result') return;
    if (this.state === 'breach') { this.breach = null; this.ui.hideBreach([]); }
    this.state = 'result';
    const stars = won ? (this.lives >= 18 ? 3 : this.lives >= 10 ? 2 : 1) : 0;
    const idx = DISTRICTS.indexOf(this.district); const next = DISTRICTS[idx + 1];
    if (won) this.addScore(this.lives * SCORE_LIFE);
    Session.endRun({ won });
    // A loss banks half its score so a high-tier wipe cannot outrank a real clear.
    const score = won ? Session.state.runScore : Math.round(Session.state.runScore * 0.5); const prevBest = Save.district(this.district.id).bestScore || 0;
    Save.recordResult(this.district.id, { won, wave: this.wave, stars, nextId: next ? next.id : null, score });
    const extra = { score, best: Math.max(prevBest, score), newBest: score > prevBest, total: Session.state.sessionScore, bestCombo: Session.state.bestCombo };
    Audio.play(won ? 'win' : 'lose');
    this.ui.showResult({ won, stars, next, stats: this.stats, wave: this.wave, lives: this.lives, ...extra });
  }

  // ---------------- Simulation ----------------
  update(dtReal) {
    if (this.state === 'breach') { this.breach?.tick(dtReal); this.ui.tickBreach(this.breach); }
    if (!this.simActive() || this.paused) return;
    // The battlefield keeps running under the breach overlay (at 1x) so a slow breach costs real time.
    let dt = dtReal * (this.state === 'breach' ? 1 : this.speed);
    while (dt > 0 && this.simActive()) { const step = Math.min(dt, 1 / 60); this.step(step); dt -= step; }
  }
  addScore(points) { Session.add(points * this.tier.score); }
  simActive() { return this.state === 'play' || this.state === 'breach'; }
  step(dt) {
    this.time += dt;
    // Wave countdown
    if (!this.waveActive && this.waveTimer !== null) { this.waveTimer -= dt; if (this.waveTimer <= 0) { this.waveTimer = null; this.beginWave(); } }
    this.shake = Math.max(0, this.shake - dt * 2); this.flash = Math.max(0, this.flash - dt);
    // RAM regen
    let regen = RAM_REGEN; for (const t of this.towers) if (t.type === 'deck' && t.offline <= 0) regen += t.stats.ram;
    this.ram = Math.min(this.ramMax, this.ram + regen * dt);
    // Combo decays when no kill lands within the window
    if (Session.state.combo > 0 && this.time - this.lastKillT > COMBO_WINDOW) Session.state.combo = 0;
    // Spawning
    if (this.waveActive) {
      this.waveTime += dt;
      while (this.spawnList.length && this.spawnList[0].t <= this.waveTime) this.spawn(this.spawnList.shift());
    }
    // Access points
    for (const ap of this.accessPoints) {
      if (ap.cooldown > 0) ap.cooldown -= dt;
      if (ap.active > 0) {
        ap.active -= dt; if (ap.type === 'TURRET') this.apTurretFire(ap, dt);
        if (ap.active <= 0 && ap.type === 'REROUTE') { this.activeRoute = 0; this.ui.toast('TRAFFIC RESTORED · route A', 'default'); this.flash = 0.2; }
      }
    }
    this.updateEnemies(dt);
    this.updateTowers(dt);
    this.updateProjectiles(dt);
    this.updateFx(dt);
    if (this.lives <= 0 && this.simActive()) { this.finish(false); return; }
    if (this.waveActive && !this.spawnList.length && !this.enemies.length) this.endWave();
  }
  spawn(s) {
    const def = ENEMIES[s.type];
    const ri = this.district.routeMode === 'all' ? (this.spawnCounter++ % this.routes.length) : this.activeRoute;
    const route = this.routes[ri]; const p = posAt(route, 0);
    const hp = Math.round(def.hp * s.hpMult);
    this.enemies.push({ id: ++this.rngId, type: s.type, name: def.name, hp, maxHp: hp, speed: def.speed * this.tier.speed, armor: def.armor, reward: def.reward, size: def.size, shape: def.shape, color: def.color,
      tags: def.tags, boss: !!def.boss, hacker: def.hacker || null, regen: def.regen || 0, route, routeIdx: ri, dist: 0, x: p.x, y: p.y, ang: p.ang,
      burn: 0, burnDps: 0, blind: 0, stun: 0, contagion: 0, contagionDps: 0, spreadTick: 0, slowMul: 1, hacks: [], hitFlash: 0, dead: false, t: 0,
      ice: !!s.ice, iceRegen: 0 });
    if (s.ice && !this.hintsShown.has('ice')) { this.hint('ice', 'ICE SHIELD: towers do almost nothing to it. Pick a QUICKHACK below and tap the shielded enemy.'); }
    if (def.boss) { this.ui.toast(`${def.name} · ${def.title}`, 'warn', 3000); this.shake = 0.6; }
    if (def.tags.includes('elite')) this.hint('elite', 'BLACKWALL HUSK: its hacks go straight through firewalls. Kill it fast or be ready to PURGE.');
  }
  updateEnemies(dt) {
    const decks = this.towers.filter(t => t.type === 'deck' && t.offline <= 0);
    const doors = this.accessPoints.filter(a => a.type === 'DOOR' && a.active > 0);
    for (const e of this.enemies) {
      e.t += dt; e.hitFlash = Math.max(0, e.hitFlash - dt);
      // Status effects
      if (e.burn > 0) { e.burn -= dt; this.damage(e, e.burnDps * dt, { pierce: true, kind: 'dot' }); if (e.dead) continue; }
      if (e.contagion > 0) {
        e.contagion -= dt; this.damage(e, e.contagionDps * dt, { pierce: true, kind: 'dot' }); if (e.dead) continue;
        e.spreadTick -= dt;
        if (e.spreadTick <= 0) { e.spreadTick = 1; for (const o of this.enemies) if (o !== e && o.contagion <= 0 && Math.hypot(o.x - e.x, o.y - e.y) < 1.1) { o.contagion = Math.max(2, e.contagion); o.contagionDps = e.contagionDps; o.spreadTick = 1; this.zap(e.x, e.y, o.x, o.y, '#39ff14'); } }
      }
      if (e.blind > 0) e.blind -= dt;
      if (e.regen) e.hp = Math.min(e.maxHp, e.hp + e.regen * dt);
      if (e.boss && !e.ice) { e.iceRegen -= dt; if (e.iceRegen <= 0) { e.ice = true; this.text(e.x, e.y - 0.5, 'ICE RESTORED', '#00f0ff'); } }
      let slow = 1;
      for (const d of decks) if (Math.hypot(d.x - e.x, d.y - e.y) <= d.stats.range) slow = Math.min(slow, 1 - d.stats.slow);
      if (e.blind > 0) slow *= 0.3;
      if (e.boss) slow = Math.max(slow, 0.55);
      e.slowMul = slow;
      if (e.stun > 0) { e.stun -= dt; continue; }
      // Movement with door blocking
      let move = e.speed * slow * dt;
      if (!e.tags.includes('drone')) {
        for (const d of doors) { const dd = d.doorDist[e.routeIdx]; if (dd !== null && e.dist < dd - 0.45 && e.dist + move > dd - 0.45) move = Math.max(0, dd - 0.45 - e.dist); else if (dd !== null && e.dist >= dd - 0.45 && e.dist < dd - 0.44) move = 0; }
      }
      e.dist += move;
      const p = posAt(e.route, e.dist); e.x = p.x; e.y = p.y; e.ang = p.ang;
      if (e.dist >= e.route.length) { this.leak(e); continue; }
      // Netrunner hacking behaviour
      if (e.hacker && this.fx.blackwall <= 0) this.runnerAI(e, dt);
    }
    this.enemies = this.enemies.filter(e => !e.dead);
  }
  runnerAI(e, dt) {
    const h = e.hacker; const cap = h.multi || 1;
    // Progress existing hacks
    for (const hk of e.hacks) {
      const t = hk.tower;
      if (!this.towers.includes(t) || t.offline > 0 || Math.hypot(t.x - e.x, t.y - e.y) > h.range + 0.2 || (!h.pierce && this.isFirewalled(t))) { hk.dead = true; t.hackers = Math.max(0, t.hackers - 1); t.hackProgress = 0; continue; }
      hk.p += dt / h.time; t.hackProgress = Math.max(t.hackProgress || 0, hk.p);
      if (hk.p >= 1) {
        t.offline = h.disable; t.hackProgress = 0; t.hackers = Math.max(0, t.hackers - 1); hk.dead = true;
        Audio.play('hacked'); this.text(t.x, t.y - 0.3, 'OFFLINE', '#ff3b3b'); this.burst(t.x, t.y, '#ff3b3b', 12, 2); this.shake = Math.max(this.shake, 0.25);
        this.hint('purge', 'Tower hacked! Tap it and PURGE, or cover it with an ICE Deck.');
      }
    }
    e.hacks = e.hacks.filter(hk => !hk.dead);
    if (e.hacks.length >= cap) return;
    // Acquire new target: nearest online, unprotected tower in range
    let best = null, bd = h.range;
    for (const t of this.towers) {
      if (t.offline > 0 || e.hacks.some(hk => hk.tower === t)) continue;
      const d = Math.hypot(t.x - e.x, t.y - e.y); if (d > bd) continue;
      if (!h.pierce && this.isFirewalled(t)) continue;
      bd = d; best = t;
    }
    if (best) { e.hacks.push({ tower: best, p: 0 }); best.hackers = (best.hackers || 0) + 1; }
  }
  leak(e) {
    e.dead = true; const dmg = e.boss ? 5 : 1; this.lives = Math.max(0, this.lives - dmg); this.stats.leaks++;
    this.shake = Math.max(this.shake, 0.4); this.flash = 0.35; Audio.play('leak');
    this.waveLeaked = true; Session.state.combo = 0; this.lastKillT = -Infinity;
    this.ui.toast(`${e.name} breached the core! -${dmg}`, 'warn');
    this.dropHacks(e);
  }
  damage(e, amount, { pierce = false, kind = 'bullet', src = null } = {}) {
    if (e.dead) return 0;
    let a = amount;
    if (!pierce) a = Math.max(amount * 0.25, amount - e.armor);
    if (e.ice && kind !== 'hack' && kind !== 'trap') {
      a *= kind === 'tesla' ? ICE_TESLA_MUL : e.boss ? ICE_BOSS_MUL : ICE_TOWER_MUL;
      if (kind !== 'dot' && this.time - (e.iceTextT || 0) > 0.8) { e.iceTextT = this.time; this.text(e.x, e.y - 0.5, 'ICE', '#00f0ff', 0.8); }
    }
    if (this.fx.massvuln > 0) a *= 1.35;
    e.hp -= a; if (kind !== 'dot') e.hitFlash = 0.08;
    if (e.hp <= 0) this.kill(e, src);
    return a;
  }
  kill(e, src = null) {
    e.dead = true;
    let reward = Math.max(1, Math.round(e.reward * ECON() / (1 + REWARD_DECAY() * (this.wave - 1)))); if (this.fx.bounty > 0) reward = Math.round(reward * 1.6);
    this.eddies += reward; this.stats.kills++;
    this.scoreKill(e);
    this.text(e.x, e.y - 0.3, `+${reward}`, '#fcee0a', e.boss ? 1.6 : 1);
    this.burst(e.x, e.y, e.color, e.boss ? 60 : 10, e.boss ? 5 : 2.2);
    if (e.boss) { this.shake = 0.9; this.ring(e.x, e.y, 2.5, e.color); Audio.play('boom'); this.ui.toast(`${e.name} NEUTRALIZED`, 'good', 3000); } else Audio.play('kill');
    this.dropHacks(e);
    if (src) src.kills++;
  }
  // Score multiplier from the current combo: x1.0 up to x3.5.
  comboMult(combo = Session.state.combo) { return Math.min(MULT_CAP, 1 + Math.floor(combo / 5) * 0.5); }
  scoreKill(e) {
    const S = Session.state;
    const prevTier = Math.floor(S.combo / 5);
    S.combo = this.time - this.lastKillT <= COMBO_WINDOW ? Math.min(COMBO_CAP, S.combo + 1) : 0;
    this.lastKillT = this.time; if (S.combo > S.bestCombo) S.bestCombo = S.combo;
    const mult = this.comboMult();
    this.addScore(e.reward * SCORE_KILL * mult + (e.boss ? BOSS_KILL_BONUS : 0));
    if (Math.floor(S.combo / 5) > prevTier) this.text(e.x, e.y - 0.9, `COMBO x${mult.toFixed(1)}`, '#ff2a6d', 1.2);
  }
  firstInRange(x, y, range, exclude = null) {
    let best = null, bd = -1;
    for (const e of this.enemies) { if (e.dead || e === exclude) continue; if (Math.hypot(e.x - x, e.y - y) <= range + e.size * 0.5 && e.dist > bd) { bd = e.dist; best = e; } }
    return best;
  }
  updateTowers(dt) {
    const rateMul = this.fx.overclock > 0 ? 1.5 : 1;
    for (const t of this.towers) {
      t.pulse += dt;
      if (t.offline > 0) { t.offline -= dt; if (t.offline <= 0) { t.offline = 0; this.text(t.x, t.y - 0.3, 'ONLINE', '#39ff14'); } continue; }
      if (t.type === 'deck') continue;
      t.cooldown -= dt * rateMul;
      const s = t.stats;
      if (t.type === 'flamer') {
        const targets = this.enemies.filter(e => Math.hypot(e.x - t.x, e.y - t.y) <= s.range + e.size * 0.5);
        if (targets.length) {
          const first = targets.reduce((a, b) => a.dist > b.dist ? a : b); t.angle = Math.atan2(first.y - t.y, first.x - t.x); t.lastTargetId = first.id;
          for (const e of targets) { const organic = e.tags.includes('organic'); this.damage(e, s.dmg * dt * (organic ? 1.3 : 0.8), { pierce: true, kind: 'dot', src: t }); e.burn = Math.max(e.burn, 1.5); e.burnDps = Math.max(e.burnDps, s.burn); }
          t.flameTick -= dt; if (t.flameTick <= 0) { t.flameTick = 0.05; this.flame(t.x, t.y, t.angle, s.range); Audio.play('flame'); }
        }
        continue;
      }
      if (t.cooldown > 0) continue;
      const target = this.firstInRange(t.x, t.y, s.range);
      if (!target) continue;
      t.cooldown = 1 / s.rate; t.angle = Math.atan2(target.y - t.y, target.x - t.x); t.lastTargetId = target.id;
      if (t.type === 'smg') { this.damage(target, s.dmg, { src: t }); this.tracer(t, target, '#00f0ff'); Audio.play('shoot'); this.spark(target.x, target.y, '#00f0ff'); }
      else if (t.type === 'sniper') { this.damage(target, s.dmg, { pierce: true, src: t }); this.tracer(t, target, '#fcee0a', 2.5); Audio.play('sniper'); this.burst(target.x, target.y, '#fcee0a', 6, 1.6); }
      else if (t.type === 'tesla') {
        let cur = target, prev = { x: t.x, y: t.y }; const hit = new Set();
        for (let i = 0; i < s.chain; i++) {
          if (!cur) break; hit.add(cur);
          this.zap(prev.x, prev.y, cur.x, cur.y, '#b14cff');
          const mech = cur.tags.includes('mech') || cur.tags.includes('drone');
          this.damage(cur, s.dmg * Math.pow(0.85, i) * (mech ? 1.6 : 1), { pierce: true, src: t, kind: 'tesla' });
          prev = cur;
          let nx = null, nd = 1.7; for (const e of this.enemies) if (!hit.has(e) && !e.dead) { const d = Math.hypot(e.x - cur.x, e.y - cur.y); if (d < nd) { nd = d; nx = e; } }
          cur = nx;
        }
        Audio.play('zap');
      }
      else if (t.type === 'rocket') { this.projectiles.push({ x: t.x, y: t.y, target, tx: target.x, ty: target.y, speed: 6.5, dmg: s.dmg, splash: s.splash, trail: 0, src: t }); Audio.play('rocket'); }
    }
  }
  apTurretFire(ap, dt) {
    ap.fireCd -= dt; if (ap.fireCd > 0) return;
    const x = ap.c + 0.5, y = ap.r + 0.5; const target = this.firstInRange(x, y, ap.range);
    if (!target) return;
    ap.fireCd = 1 / ap.rate; ap.angle = Math.atan2(target.y - y, target.x - x);
    this.damage(target, ap.dmg); this.tracer({ x, y }, target, '#b14cff'); Audio.play('shoot'); this.spark(target.x, target.y, '#b14cff');
  }
  updateProjectiles(dt) {
    for (const p of this.projectiles) {
      if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y; const d = Math.hypot(dx, dy); const mv = p.speed * dt;
      p.trail -= dt; if (p.trail <= 0) { p.trail = 0.03; this.particles.push({ x: p.x, y: p.y, vx: 0, vy: 0, life: 0.3, max: 0.3, color: '#ff8c1a', size: 2.5, type: 'dot' }); }
      if (d <= mv) {
        p.x = p.tx; p.y = p.ty; p.dead = true;
        for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) <= p.splash + e.size * 0.5) this.damage(e, p.dmg, { src: p.src });
        this.burst(p.x, p.y, '#ff2a6d', 18, 3); this.ring(p.x, p.y, p.splash, '#ff2a6d'); this.shake = Math.max(this.shake, 0.12); Audio.play('boom');
      } else { p.x += dx / d * mv; p.y += dy / d * mv; p.ang = Math.atan2(dy, dx); }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }
  updateFx(dt) {
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.92; p.vy *= 0.92; if (p.type === 'ring') p.rad += dt * 4; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= dt * 0.6; }
    this.texts = this.texts.filter(t => t.life > 0);
    for (const z of this.zaps) z.life -= dt;
    this.zaps = this.zaps.filter(z => z.life > 0);
  }

  // ---------------- FX helpers ----------------
  burst(x, y, color, n = 10, spd = 2) {
    if (this.particles.length > 400) return;
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = (0.3 + Math.random()) * spd; this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.35 + Math.random() * 0.4, max: 0.75, color, size: 1.5 + Math.random() * 2.5, type: 'dot' }); }
  }
  spark(x, y, color) { this.burst(x, y, color, 3, 1.5); }
  ring(x, y, rad, color) { this.particles.push({ x, y, vx: 0, vy: 0, life: 0.45, max: 0.45, color, rad: rad * 0.3, maxRad: rad, type: 'ring' }); }
  flame(x, y, ang, range) {
    if (this.particles.length > 400) return;
    for (let i = 0; i < 3; i++) { const a = ang + (Math.random() - 0.5) * 0.6, v = range * (1.5 + Math.random()); this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.25 + Math.random() * 0.2, max: 0.45, color: Math.random() < 0.5 ? '#ff8c1a' : '#fcee0a', size: 3 + Math.random() * 3, type: 'dot' }); }
  }
  tracer(from, to, color, w = 1.5) { this.zaps.push({ x1: from.x, y1: from.y, x2: to.x, y2: to.y, color, life: 0.07, max: 0.07, w, straight: true }); }
  zap(x1, y1, x2, y2, color) { this.zaps.push({ x1, y1, x2, y2, color, life: 0.14, max: 0.14, w: 2, straight: false }); }
  text(x, y, str, color, scale = 1) { this.texts.push({ x, y, str, color, life: 0.9, scale }); }
}
