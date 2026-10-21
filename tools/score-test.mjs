// End-to-end check of the scoring / session-state feature (HUD, sessionStorage, reload, best score, fallback).
// Run: NODE_PATH=/opt/node-tools/node_modules node tools/score-test.mjs
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const SP = 'tools/shots';
const errors = []; const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok }); console.log((ok ? 'PASS' : 'FAIL') + ' ' + name + (info ? ' :: ' + info : '')); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.goto(BASE + '/');
await page.waitForFunction(() => window.__ncb);
await page.click('#btn-play');
await page.click('.dcard');
await page.waitForFunction(() => window.__ncb.game.state === 'play');
let s = await page.evaluate(() => JSON.parse(sessionStorage.getItem('ncb_session_v1')));
check('beginRun stored runDistrict', s && s.runDistrict === 'watson', JSON.stringify(s));

// build towers next to the path
const built = await page.evaluate(() => {
  const { game } = window.__ncb; game.eddies += 2000; let n = 0;
  const cand = [];
  for (let r = 0; r < game.rows; r++) for (let c = 0; c < game.cols; c++) {
    if (!game.buildable(c, r)) continue;
    let near = 0;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (game.pathCells.has((c + dc) + ',' + (r + dr))) near++;
    if (near) cand.push([near, c, r]);
  }
  cand.sort((a, b) => b[0] - a[0]);
  for (const [, c, r] of cand) { if (n >= 8) break; if (game.buildable(c, r)) { game.build('smg', c, r); n++; } }
  return n;
});
check('built towers', built >= 6, 'built ' + built);
await page.evaluate(() => { const { game } = window.__ncb; game.speed = 1; game.startWave(); });
await page.waitForTimeout(2500);
await page.evaluate(() => { window.__ncb.game.speed = 3; });
await page.screenshot({ path: SP + '/hud-wave.png' });
const hudBox = await page.evaluate(() => {
  const h = document.querySelector('#hud-top'); const hr = h.getBoundingClientRect();
  const kids = [...h.children].map(k => { const r = k.getBoundingClientRect(); return { id: k.id || k.className, l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom) }; });
  return { sw: h.scrollWidth, cw: h.clientWidth, h: hr.height, docSw: document.documentElement.scrollWidth, kids };
});
console.log(JSON.stringify(hudBox));
check('HUD no horizontal overflow', hudBox.sw <= hudBox.cw && hudBox.docSw <= 390 && hudBox.kids.every(k => k.r <= 390 && k.l >= 0));
check('HUD single row', hudBox.h < 60, 'height ' + hudBox.h);

// poll until wave over, capturing combo badge state
let sawCombo = false, maxCombo = 0;
const t0 = Date.now();
while (Date.now() - t0 < 120000) {
  const st = await page.evaluate(() => { const { game, Session } = window.__ncb; const cb = document.querySelector('#combo-badge'); return { active: game.waveActive, st: game.state, combo: Session.state.combo, badge: cb.classList.contains('on') ? cb.textContent : '' }; });
  maxCombo = Math.max(maxCombo, st.combo); if (st.badge) { if (!sawCombo) await page.screenshot({ path: SP + '/hud-combo.png' }); sawCombo = true; }
  if (!st.active || st.st !== 'play') break;
  await page.waitForTimeout(150);
}
s = await page.evaluate(() => ({ ...window.__ncb.Session.state, raw: sessionStorage.getItem('ncb_session_v1'), stats: window.__ncb.game.stats, wave: window.__ncb.game.wave }));
console.log(JSON.stringify(s));
check('runScore > 0 after wave', s.runScore > 0, 'runScore ' + s.runScore);
check('sessionStorage populated', !!s.raw && JSON.parse(s.raw).runScore === s.runScore);
check('wave-clear bonus included (>=500)', s.runScore >= 500);
console.log('sawCombo', sawCombo, 'maxCombo', maxCombo, 'bestCombo', s.bestCombo);
const hudScore = await page.evaluate(() => document.querySelector('[data-v="score"]').textContent);
check('HUD score matches', hudScore === String(s.runScore), hudScore);

// reload survival
const before = s.runScore;
await page.reload(); await page.waitForFunction(() => window.__ncb);
const after = await page.evaluate(() => ({ ...window.__ncb.Session.state }));
check('session survives reload', after.runScore === before && after.runDistrict === 'watson', JSON.stringify(after));

// finish
await page.click('#btn-play'); await page.click('.dcard');
await page.waitForFunction(() => window.__ncb.game.state === 'play');
const fin = await page.evaluate(() => {
  const { game, Session, Save } = window.__ncb; const sessBefore = Session.state.sessionScore;
  game.eddies += 2000; game.wave = 3; game.lives = 17;
  Session.add(1234); game.finish(true);
  return { sessBefore, runScore: Session.state.runScore, st: Session.state, rec: Save.district('watson'), raw: localStorage.getItem('ncb_save_v1') };
});
console.log(JSON.stringify(fin));
check('score includes lives*200 bonus', fin.runScore === 1234 + 17 * 200, '' + fin.runScore);
check('Save bestScore recorded', fin.rec.bestScore === fin.runScore, JSON.stringify(fin.rec));
check('endRun folded session score', fin.st.sessionScore === fin.sessBefore + fin.runScore && fin.st.districtsCleared === 1);
const txt = await page.innerText('#screen-result');
console.log(txt.replace(/\n+/g, ' | '));
check('result shows SCORE/BEST/SESSION TOTAL', /SCORE/.test(txt) && /BEST/.test(txt) && /SESSION TOTAL/.test(txt));
check('NEW BEST shown', /NEW BEST/.test(txt));
await page.screenshot({ path: SP + '/result.png' });
// district card
await page.click('#r-quit');
const card = await page.innerText('.dcard');
check('district card shows best score', /best score/.test(card), card.replace(/\n+/g, ' | '));
// second run lower score: no NEW BEST, best kept
await page.click('.dcard');
const fin2 = await page.evaluate(() => { const { game, Save } = window.__ncb; game.wave = 1; game.finish(false); return Save.district('watson'); });
const txt2 = await page.innerText('#screen-result');
check('lower run keeps best, no NEW BEST', fin2.bestScore === fin.runScore && !/NEW BEST/.test(txt2), JSON.stringify(fin2));
// backward compat: old record without bestScore
const compat = await page.evaluate(() => { const { Save } = window.__ncb; Save.tierData().districts.westbrook = { stars: 1, bestWave: 4, won: true, plays: 2 }; Save.recordResult('westbrook', { won: false, wave: 2, stars: 0, nextId: null, score: 50 }); const a = Save.district('westbrook'); Save.recordResult('westbrook', { won: false, wave: 2, stars: 0, nextId: null }); return [a, Save.district('westbrook')]; });
check('old record backward compatible', compat[0].bestScore === 50 && compat[0].stars === 1 && compat[1].bestScore === 50, JSON.stringify(compat));
// per-tier progress: a win on one tier does not unlock or star on another; legacy saves migrate to street + netrunner
const tiers = await page.evaluate(() => {
  const { Save } = window.__ncb;
  Save.recordResult('watson', { won: true, wave: 10, stars: 2, nextId: 'westbrook', score: 900, tier: 'legend' });
  const a = { legendUnlocked: Save.isUnlocked('westbrook', 'legend'), blackwallUnlocked: Save.isUnlocked('westbrook', 'blackwall'), legendStars: Save.totalStars('legend'), blackwallStars: Save.totalStars('blackwall'), legendBest: Save.district('watson', 'legend').bestScore };
  localStorage.setItem('ncb_save_v1', JSON.stringify({ districts: { watson: { stars: 3, bestWave: 10, won: true, plays: 1, bestScore: 5000 } }, unlocked: ['watson', 'westbrook'], settings: { tier: 'netrunner' } }));
  Save.load();
  return { ...a, migNet: Save.district('watson', 'netrunner').stars, migStreet: Save.isUnlocked('westbrook', 'street'), migLegend: Save.isUnlocked('westbrook', 'legend'), legacyKeysGone: !('districts' in Save.data) && !('unlocked' in Save.data), tier: Save.currentTier() };
});
check('progress is per tier', tiers.legendUnlocked && !tiers.blackwallUnlocked && tiers.legendStars === 2 && tiers.blackwallStars === 0 && tiers.legendBest === 900, JSON.stringify(tiers));
check('legacy save migrates to street + netrunner only', tiers.migNet === 3 && tiers.migStreet && !tiers.migLegend && tiers.legacyKeysGone && tiers.tier === 'netrunner', JSON.stringify(tiers));

// fallback when sessionStorage throws
const p2 = await ctx.newPage(); const err2 = [];
p2.on('pageerror', e => err2.push(e.message));
await p2.addInitScript(() => { Object.defineProperty(window, 'sessionStorage', { get() { throw new Error('denied'); } }); });
await p2.goto(BASE + '/'); await p2.waitForFunction(() => window.__ncb);
const fb = await p2.evaluate(() => { const { Session } = window.__ncb; Session.beginRun('x'); Session.add(10); Session.endRun({ won: true }); Session.load(); return Session.state; });
check('in-memory fallback works', fb.sessionScore === 10 && fb.runs === 1 && err2.length === 0, JSON.stringify(fb) + err2.join());

check('zero console/page errors', errors.length === 0, errors.join(' || '));
await browser.close();
process.exit(results.every(r => r.ok) ? 0 : 1);
