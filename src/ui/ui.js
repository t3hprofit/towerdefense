import { TOWERS, TOWER_ORDER, SELL_RATIO } from '../data/towers.js';
import { QUICKHACKS, HACK_ORDER } from '../data/quickhacks.js';
import { DISTRICTS } from '../data/districts.js';
import { ENEMIES } from '../data/enemies.js';
import { Save } from '../core/save.js';
import { Audio } from '../core/audio.js';
import { Session } from '../core/session.js';

const $ = (s) => document.querySelector(s);
const fmtScore = (n) => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : String(n);
const fmtNum = (n) => Number(n).toLocaleString('en-US');

export class UI {
  constructor() {
    this.game = null; this.tab = 'build'; this.breachEl = $('#screen-breach'); this.lastHud = {};
    this.els = { top: $('#hud-top'), bottom: $('#hud-bottom'), panel: $('#panel'), toasts: $('#toasts'), trayBuild: $('#tray-build'), trayHacks: $('#tray-hacks'), waveInfo: $('#wave-info'), btnWave: $('#btn-wave'), btnBreach: $('#btn-breach'), btnSpeed: $('#btn-speed'), btnPause: $('#btn-pause') };
    this.screens = { menu: $('#screen-menu'), districts: $('#screen-districts'), howto: $('#screen-howto'), breach: $('#screen-breach'), result: $('#screen-result'), pause: $('#screen-pause') };
  }
  bind(game, onQuit) {
    this.game = game; this.onQuit = onQuit;
    $('#btn-play').onclick = () => { Audio.init(); Audio.startMusic(); this.showScreen('districts'); };
    $('#btn-howto').onclick = () => this.showScreen('howto');
    $('#btn-back-howto').onclick = () => this.showScreen('menu');
    $('#btn-back-menu').onclick = () => this.showScreen('menu');
    $('#btn-sfx').onclick = () => { const v = !Save.data.settings.sfx; Save.setSetting('sfx', v); Audio.init(); Audio.setSfx(v); this.syncSettings(); Audio.play('blip'); };
    $('#btn-music').onclick = () => { const v = !Save.data.settings.music; Save.setSetting('music', v); Audio.init(); Audio.setMusic(v); this.syncSettings(); };
    $('#btn-reset').onclick = () => { if (confirm('Wipe all progress?')) { Save.reset(); this.syncSettings(); this.toast('Save wiped', 'warn'); } };
    document.querySelectorAll('.tab[data-tab]').forEach(b => b.onclick = () => this.setTab(b.dataset.tab));
    this.els.btnBreach.onclick = () => { Audio.play('blip'); game.openBreach(); };
    this.els.btnWave.onclick = () => game.startWave();
    this.els.btnSpeed.onclick = () => { game.speed = game.speed === 1 ? 2 : game.speed === 2 ? 3 : 1; this.els.btnSpeed.textContent = game.speed + '×'; Audio.play('blip'); };
    this.els.btnPause.onclick = () => this.pause(true);
    $('#btn-resume').onclick = () => { Audio.init(); this.pause(false); };
    $('#btn-restart').onclick = () => { Audio.init(); this.pause(false); game.startDistrict(game.district); };
    $('#btn-quit').onclick = () => { Audio.init(); this.pause(false); this.quit(); };
    this.syncSettings();
    Audio.setSfx(Save.data.settings.sfx); Audio.setMusic(Save.data.settings.music);
  }
  syncSettings() { $('#btn-sfx').textContent = 'SFX: ' + (Save.data.settings.sfx ? 'ON' : 'OFF'); $('#btn-music').textContent = 'MUSIC: ' + (Save.data.settings.music ? 'ON' : 'OFF'); }
  showScreen(name) {
    for (const k in this.screens) this.screens[k].classList.toggle('hidden', k !== name);
    if (name === 'districts') this.renderDistricts();
  }
  hideScreens() { for (const k in this.screens) this.screens[k].classList.add('hidden'); }
  quit() { this.game.state = 'menu'; this.game.district = null; this.els.top.classList.add('hidden'); this.els.bottom.classList.add('hidden'); this.closePanel(); this.showScreen('districts'); if (this.onQuit) this.onQuit(); }
  pause(on) {
    if (this.game.state !== 'play' && on) return;
    this.game.paused = on; this.screens.pause.classList.toggle('hidden', !on);
  }

  // ---------- District select ----------
  renderDistricts() {
    const list = $('#district-list'); list.innerHTML = ''; $('#cred').textContent = '★ ' + Save.totalStars();
    for (const d of DISTRICTS) {
      const unlocked = Save.isUnlocked(d.id); const rec = Save.district(d.id);
      const card = document.createElement('button'); card.className = 'dcard' + (unlocked ? '' : ' locked'); card.style.setProperty('--c', d.color);
      const stars = [1, 2, 3].map(i => `<span class="${rec.stars >= i ? '' : 'off'}">★</span>`).join('');
      card.innerHTML = `<div class="num">${String(d.num).padStart(2, '0')}</div><div class="info"><div class="nm">${d.name}</div><div class="sub">${d.sub}${rec.bestWave ? ` · best wave ${rec.bestWave}` : ''}${rec.bestScore ? ` · <span class="bs">best score ${rec.bestScore.toLocaleString('en-US')}</span>` : ''}</div><div class="desc">${d.desc}</div></div><div class="stars">${stars}</div>`;
      if (unlocked) card.onclick = () => { Audio.init(); Audio.startMusic(); Audio.play('bselect'); this.hideScreens(); this.game.startDistrict(d); };
      list.appendChild(card);
    }
  }

  // ---------- In-game HUD ----------
  onDistrictStart() {
    this.hideScreens(); this.els.top.classList.remove('hidden'); this.els.bottom.classList.remove('hidden'); this.closePanel();
    this.els.btnSpeed.textContent = '1×'; this.buildTrays(); this.setTab('build'); this.refreshTrays(); this.lastHud = {};
    this.toast(`${this.game.district.name} · ${this.game.district.sub}`, 'default', 2600);
    if (window.__onResize) window.__onResize();
  }
  setTab(t) { this.tab = t; document.querySelectorAll('.tab[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === t)); this.els.trayBuild.classList.toggle('hidden', t !== 'build'); this.els.trayHacks.classList.toggle('hidden', t !== 'hacks'); }
  buildTrays() {
    const g = this.game;
    this.els.trayBuild.innerHTML = ''; this.els.trayHacks.innerHTML = '';
    for (const id of TOWER_ORDER) {
      const d = TOWERS[id]; const b = document.createElement('button'); b.className = 'tbtn'; b.dataset.id = id; b.style.color = d.color;
      b.innerHTML = `<span class="glyph">${d.glyph}</span><span class="nm">${d.name}</span><span class="cost">€$<span class="cv"></span></span>`;
      b.onclick = () => { if (!g.towerUnlocked(id)) { this.toast(`Unlocked in ${DISTRICTS.find(x => x.id === d.unlock).name}`, 'warn'); return; } Audio.play('blip'); g.select('tower', id); };
      this.els.trayBuild.appendChild(b);
    }
    for (const id of HACK_ORDER) {
      const q = QUICKHACKS[id]; const b = document.createElement('button'); b.className = 'tbtn hack'; b.dataset.id = id; b.style.color = q.color;
      b.innerHTML = `<span class="glyph">${q.glyph}</span><span class="nm">${q.name.split(' ')[0]}</span><span class="cost">${q.cost} RAM</span>`;
      b.onclick = () => { Audio.play('blip'); g.select('hack', id); this.toast(`${q.name}: ${q.desc}`, 'default', 2600); };
      this.els.trayHacks.appendChild(b);
    }
  }
  refreshTrays() {
    const g = this.game; if (!g.district) return;
    for (const b of this.els.trayBuild.children) {
      const id = b.dataset.id; const cost = g.towerCost(id); b.querySelector('.cv').textContent = cost;
      b.classList.toggle('sel', g.selected?.kind === 'tower' && g.selected.id === id);
      b.classList.toggle('locked', !g.towerUnlocked(id)); b.classList.toggle('poor', g.towerUnlocked(id) && g.eddies < cost);
    }
    for (const b of this.els.trayHacks.children) {
      const id = b.dataset.id; b.classList.toggle('sel', g.selected?.kind === 'hack' && g.selected.id === id); b.classList.toggle('poor', g.ram < QUICKHACKS[id].cost);
    }
    this.els.btnBreach.disabled = !g.canBreach();
    this.els.btnWave.disabled = g.waveActive || g.wave >= g.district.waves;
    this.els.btnWave.textContent = g.wave === 0 ? 'START WAVE' : g.waveActive ? 'IN PROGRESS' : 'NEXT WAVE';
    this.els.waveInfo.innerHTML = g.waveInfoText();
  }
  // Called every frame; only touches the DOM when a value changed.
  refreshHud() {
    const g = this.game; if (!g.district) return;
    const set = (k, v) => { if (this.lastHud[k] !== v) { this.lastHud[k] = v; const el = this.els.top.querySelector(`[data-v="${k}"]`); if (el) el.textContent = v; } };
    set('eddies', Math.floor(g.eddies)); set('lives', g.lives); set('wave', `${g.wave}/${g.district.waves}`);
    set('score', fmtScore(Session.state.runScore));
    const cm = g.comboMult(); const comboTxt = cm > 1 ? 'x' + cm.toFixed(1) : '';
    if (this.lastHud.combo !== comboTxt) {
      this.lastHud.combo = comboTxt; const cb = $('#combo-badge'); cb.textContent = comboTxt; cb.classList.toggle('on', !!comboTxt);
      cb.classList.remove('pulse'); if (comboTxt) { void cb.offsetWidth; cb.classList.add('pulse'); }
    }
    const ramTxt = `${Math.floor(g.ram)}/${g.ramMax}`; set('ram', ramTxt);
    const pct = Math.round(g.ram / g.ramMax * 100); if (this.lastHud.pct !== pct) { this.lastHud.pct = pct; this.els.top.querySelector('[data-v="ramfill"]').style.width = pct + '%'; }
    $('#stat-lives').classList.toggle('low', g.lives <= 5);
    if (this.lastHud.eddiesTray !== Math.floor(g.eddies) || this.lastHud.ramTray !== Math.floor(g.ram)) { this.lastHud.eddiesTray = Math.floor(g.eddies); this.lastHud.ramTray = Math.floor(g.ram); this.refreshTrays(); }
    if (g.waveActive) { const left = g.spawnList.length + g.enemies.length; if (this.lastHud.left !== left) { this.lastHud.left = left; this.els.waveInfo.innerHTML = g.waveInfoText(); } }
  }

  // ---------- Panels ----------
  closePanel() { this.els.panel.classList.add('hidden'); this.els.panel.innerHTML = ''; this.els.panel.className = 'panel hidden'; }
  openTowerPanel(t) {
    const g = this.game; const d = TOWERS[t.type]; const s = t.stats; const p = this.els.panel; const off = t.offline > 0;
    p.className = 'panel' + (off ? ' offline' : '');
    const up = t.level < 2 ? g.towerCost(t.type, t.level + 1) : null;
    const statBits = [`RANGE <b>${s.range}</b>`];
    if (s.dmg) statBits.push(`DMG <b>${s.dmg}</b>`); if (s.rate) statBits.push(`RATE <b>${s.rate}/s</b>`);
    if (s.chain) statBits.push(`CHAIN <b>${s.chain}</b>`); if (s.splash) statBits.push(`SPLASH <b>${s.splash}</b>`); if (s.burn) statBits.push(`BURN <b>${s.burn}/s</b>`);
    if (s.slow) statBits.push(`SLOW <b>${Math.round(s.slow * 100)}%</b>`); if (s.ram) statBits.push(`RAM <b>+${s.ram}/s</b>`);
    statBits.push(`KILLS <b>${t.kills}</b>`);
    p.innerHTML = `<div class="ph"><span class="t" style="color:${d.color}">${d.name} <span style="color:var(--dim);font-size:11px">MK.${t.level + 1}${off ? ' · <span style="color:var(--red)">OFFLINE ' + Math.ceil(t.offline) + 's</span>' : ''}${!off && g.isFirewalled(t) ? ' · <span style="color:var(--green)">FIREWALLED</span>' : ''}</span></span><button class="x">✕</button></div>
      <div class="stats">${statBits.join(' · ')}</div><div class="desc">${d.desc}</div>
      <div class="acts">${off ? `<button class="btn pink" id="p-purge">PURGE (${QUICKHACKS.purge.cost} RAM)</button>` : ''}${up !== null ? `<button class="btn yellow" id="p-up">UPGRADE €$${up}</button>` : '<button class="btn" disabled>MAX LEVEL</button>'}<button class="btn danger" id="p-sell">SELL €$${Math.round(t.spent * SELL_RATIO)}</button></div>`;
    p.classList.remove('hidden');
    p.querySelector('.x').onclick = () => { g.selectedTower = null; this.closePanel(); };
    const u = p.querySelector('#p-up'); if (u) u.onclick = () => g.upgrade(t);
    p.querySelector('#p-sell').onclick = () => g.sell(t);
    const pu = p.querySelector('#p-purge'); if (pu) pu.onclick = () => g.purge(t);
  }
  openApPanel(ap) {
    const g = this.game; const p = this.els.panel; p.className = 'panel ap';
    const eff = { TRAP: `Detonates for ${ap.dmg} damage to everything within ${ap.radius} cells.`, DOOR: `Seals the road for ${ap.duration}s. Ground enemies stop; drones fly over.`, TURRET: `Hijack this turret for ${ap.duration}s. ${ap.dmg} dmg × ${ap.rate}/s, range ${ap.range}.`, REROUTE: `Switch the enemy route. Current: ROUTE ${g.activeRoute === 0 ? 'A' : 'B'}. New spawns take the other road.` }[ap.type];
    const cd = ap.cooldown > 0 ? `REBOOT ${Math.ceil(ap.cooldown)}s` : null;
    p.innerHTML = `<div class="ph"><span class="t" style="color:var(--purple)">ACCESS POINT · ${ap.name}</span><button class="x">✕</button></div>
      <div class="stats">TYPE <b>${ap.type}</b> · COST <b>${ap.cost} RAM</b> · COOLDOWN <b>${ap.cooldownDef}s</b></div><div class="desc">${eff}</div>
      <div class="acts"><button class="btn pink primary" id="p-jack" ${cd || g.ram < ap.cost ? 'disabled' : ''}>${cd || (g.ram < ap.cost ? 'NEED RAM' : 'JACK IN')}</button></div>`;
    p.classList.remove('hidden');
    p.querySelector('.x').onclick = () => this.closePanel();
    p.querySelector('#p-jack').onclick = () => g.jackIn(ap);
  }

  // ---------- Toasts ----------
  toast(msg, kind = 'default', ms = 2200) {
    const el = document.createElement('div'); el.className = 'toast' + (kind !== 'default' ? ' ' + kind : ''); el.textContent = msg;
    this.els.toasts.appendChild(el);
    while (this.els.toasts.children.length > 4) this.els.toasts.firstChild.remove();
    setTimeout(() => el.classList.add('fade'), ms); setTimeout(() => el.remove(), ms + 450);
  }

  // ---------- Breach Protocol ----------
  showBreach(b) {
    const el = this.breachEl; el.classList.remove('hidden');
    el.innerHTML = `<div class="breach"><div class="bh"><h2>BREACH PROTOCOL</h2><span class="timer" id="b-timer">${b.seconds.toFixed(2)}</span></div>
      <div class="buffer" id="b-buffer"></div><div class="matrix" id="b-matrix" style="grid-template-columns:repeat(${b.size},1fr)"></div>
      <div class="daemons" id="b-daemons"></div><div class="msg" id="b-msg">Select a code in the first row to begin. Timer starts on first pick.</div>
      <div class="bf"><button class="btn" id="b-abort">ABORT</button><button class="btn pink primary" id="b-done">UPLOAD</button></div></div>`;
    el.querySelector('#b-abort').onclick = () => { b.done = true; for (const d of b.daemons) if (!d.done) d.dead = true; this.game.finishBreach(); };
    el.querySelector('#b-done').onclick = () => this.game.finishBreach();
    this.renderBreach(b);
  }
  renderBreach(b) {
    const el = this.breachEl; const avail = b.available(); const availSet = new Set(avail.map(([r, c]) => r + ',' + c));
    const buf = el.querySelector('#b-buffer'); buf.innerHTML = '<span class="lbl">BUFFER</span>' + Array.from({ length: b.bufferLen }, (_, i) => `<span class="slot ${b.buffer[i] ? 'filled' : ''}">${b.buffer[i] || ''}</span>`).join('');
    const m = el.querySelector('#b-matrix'); m.innerHTML = '';
    for (let r = 0; r < b.size; r++) for (let c = 0; c < b.size; c++) {
      const d = document.createElement('div'); const k = r + ',' + c;
      d.className = 'cell' + (b.used.has(k) ? ' used' : availSet.has(k) ? ' avail' : ''); d.textContent = b.used.has(k) ? '[ ]' : b.grid[r][c];
      if (availSet.has(k)) d.onclick = () => { if (b.pick(r, c)) { Audio.play('bselect'); this.renderBreach(b); } };
      m.appendChild(d);
    }
    const dl = el.querySelector('#b-daemons'); dl.innerHTML = '';
    for (const d of b.daemons) {
      const part = d.done ? d.seq.length : b.partial(d.seq);
      const row = document.createElement('div'); row.className = 'daemon' + (d.done ? ' ok' : d.dead ? ' dead' : '');
      row.innerHTML = `<div class="seq">${d.seq.map((s, i) => `<span class="${d.done ? 'done' : i < part ? 'part' : ''}">${s}</span>`).join('')}</div><div><div class="dn">${d.name}</div><div class="dd">${d.desc}</div></div>`;
      dl.appendChild(row);
    }
    const done = b.daemons.filter(d => d.done).length;
    const msg = el.querySelector('#b-msg');
    if (b.done) { msg.textContent = done ? `${done} DAEMON${done > 1 ? 'S' : ''} READY · press UPLOAD` : 'BREACH FAILED · no daemons uploaded'; msg.style.color = done ? 'var(--green)' : 'var(--red)'; }
    else msg.textContent = b.started ? `${b.axis === 'col' ? 'Pick from the highlighted COLUMN' : 'Pick from the highlighted ROW'} · ${done} uploaded` : 'Select a code in the first row to begin. Timer starts on first pick.';
  }
  tickBreach(b) {
    if (!b) return; const t = this.breachEl.querySelector('#b-timer'); if (!t) return;
    t.textContent = b.timeLeft.toFixed(2); t.classList.toggle('low', b.timeLeft < 8 && b.started);
    if (b.done && !b._shownDone) { b._shownDone = true; this.renderBreach(b); }
  }
  hideBreach(done) {
    this.breachEl.classList.add('hidden'); this.breachEl.innerHTML = '';
    if (done.length) this.toast('UPLOADED: ' + done.map(d => d.name).join(', '), 'good', 3200); else this.toast('BREACH FAILED', 'warn');
  }

  // ---------- Results ----------
  showResult({ won, stars, next, stats, wave, lives, score = 0, best = 0, newBest = false, total = 0, bestCombo = 0 }) {
    const g = this.game; const el = this.screens.result; el.classList.remove('hidden'); this.closePanel();
    const starHtml = [1, 2, 3].map(i => `<span class="${stars >= i ? '' : 'off'}">★</span>`).join('');
    el.innerHTML = `<div class="result ${won ? 'win' : 'lose'}"><h1>${won ? 'DISTRICT SECURED' : 'CORE BREACHED'}</h1>
      <div style="color:var(--dim);letter-spacing:0.2em">${g.district.name} · ${won ? 'WAVE ' + wave + ' COMPLETE' : 'FELL ON WAVE ' + wave}</div>
      <div class="bigstars">${starHtml}</div>
      <div class="rstats"><span>SCORE</span><span class="sc">${fmtNum(score)}</span><span>BEST</span><span>${fmtNum(best)}${newBest ? '<em class="nb">NEW BEST</em>' : ''}</span><span>SESSION TOTAL</span><span>${fmtNum(total)}</span><span>BEST COMBO</span><span>${bestCombo}</span><span>KILLS</span><span>${stats.kills}</span><span>CORE LEFT</span><span>${lives}/20</span><span>TOWERS BUILT</span><span>${stats.built}</span><span>QUICKHACKS</span><span>${stats.hacks}</span><span>DAEMONS</span><span>${stats.daemons}</span><span>PURGES</span><span>${stats.purges}</span><span>ACCESS POINTS</span><span>${stats.apHacks}</span><span>LEAKS</span><span>${stats.leaks}</span></div>
      ${won && next ? `<div style="color:var(--green)">UNLOCKED: ${next.name}</div>` : ''}
      <div class="menu-btns">${won && next ? `<button class="btn primary" id="r-next">NEXT: ${next.name}</button>` : ''}<button class="btn ${won ? '' : 'primary'}" id="r-retry">${won ? 'REPLAY' : 'RETRY'}</button><button class="btn" id="r-quit">DISTRICTS</button></div></div>`;
    const nx = el.querySelector('#r-next'); if (nx) nx.onclick = () => { el.classList.add('hidden'); g.startDistrict(next); };
    el.querySelector('#r-retry').onclick = () => { el.classList.add('hidden'); g.startDistrict(g.district); };
    el.querySelector('#r-quit').onclick = () => { el.classList.add('hidden'); this.quit(); };
  }
}
