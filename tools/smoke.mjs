// Playwright smoke test for the running game (see the Testing section of README.md).
// Needs playwright and a Chromium build: `npm i -g playwright` (or `npm i playwright` in the
// repo) followed by `npx playwright install chromium`. A global install is found through
// NODE_PATH="$(npm root -g)". The package is loaded with createRequire because NODE_PATH only
// applies to CommonJS require, not to ES module imports. On this machine run it with:
//   NODE_PATH=/opt/node-tools/node_modules node tools/smoke.mjs
// Environment: BASE_URL (default http://localhost:8080), SHOT_DIR (default tools/shots).
import fs from 'fs';
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('playwright');
const SP = process.env.SHOT_DIR || 'tools/shots';
fs.mkdirSync(SP, { recursive: true });
const BASE = process.env.BASE_URL || 'http://localhost:8080';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
await page.goto(BASE + '/index.html');
await page.waitForTimeout(600);
await page.screenshot({ path: SP + '/s1-menu.png' });
await page.click('#btn-play'); await page.waitForTimeout(300);
await page.screenshot({ path: SP + '/s2-districts.png' });
await page.click('.dcard'); await page.waitForTimeout(500);
await page.screenshot({ path: SP + '/s3-play.png' });
// Build via UI: select SMG then tap a cell
const r = await page.evaluate(() => { const { game, renderer } = window.__ncb; return { cs: renderer.cs, ox: renderer.ox, oy: renderer.oy, top: document.getElementById('field').getBoundingClientRect().top, buildable: game.buildable(4, 2) }; });
console.log('layout', r);
await page.click('.tbtn[data-id="smg"]');
const fieldBox = await page.locator('#field').boundingBox();
const tapCell = async (c, rr) => { await page.mouse.click(fieldBox.x + r.ox + (c + 0.5) * r.cs, fieldBox.y + r.oy + (rr + 0.5) * r.cs); await page.waitForTimeout(80); };
await tapCell(4, 2); await tapCell(5, 5); await tapCell(3, 5);
await page.click('.tbtn[data-id="sniper"]'); await tapCell(4, 8);
let st = await page.evaluate(() => { const g = window.__ncb.game; return { towers: g.towers.map(t => t.type + '@' + t.c + ',' + t.r), eddies: g.eddies }; });
console.log('after build', st);
// Tap a tower -> panel
await tapCell(4, 2); await page.waitForTimeout(100);
console.log('panel visible', await page.locator('#panel').isVisible(), (await page.locator('#panel .t').textContent()));
await page.screenshot({ path: SP + '/s4-towerpanel.png' });
await page.click('#panel .x');
// Start wave at 3x and run
await page.click('#btn-wave'); await page.evaluate(() => { window.__ncb.game.speed = 3; });
await page.waitForTimeout(2500);
await page.screenshot({ path: SP + '/s5-wave.png' });
// Cast a quickhack on the first enemy
await page.click('.tab[data-tab="hacks"]'); await page.click('.tbtn[data-id="short"]');
const en = await page.evaluate(() => { const g = window.__ncb.game; const e = g.enemies[0]; return e ? { x: e.x, y: e.y, hp: e.hp } : null; });
if (en) { await page.mouse.click(fieldBox.x + r.ox + en.x * r.cs, fieldBox.y + r.oy + en.y * r.cs); await page.waitForTimeout(50); console.log('hack cast', await page.evaluate(() => ({ hacks: window.__ncb.game.stats.hacks, ram: window.__ncb.game.ram }))); }
await page.screenshot({ path: SP + '/s6-hack.png' });
// Wait for wave end
for (let i = 0; i < 40; i++) { await page.waitForTimeout(500); const w = await page.evaluate(() => window.__ncb.game.waveActive); if (!w) break; }
st = await page.evaluate(() => { const g = window.__ncb.game; return { wave: g.wave, active: g.waveActive, lives: g.lives, eddies: g.eddies, kills: g.stats.kills, canBreach: g.canBreach() }; });
console.log('after wave 1', st);
// Breach
await page.click('#btn-breach'); await page.waitForTimeout(200);
await page.screenshot({ path: SP + '/s7-breach.png' });
// Solve: click a sequence of available cells following the first daemon's seq greedily
const solved = await page.evaluate(() => {
  const b = window.__ncb.game.breach;
  return { daemons: b.daemons.map(d => d.name + ':' + d.seq.join('-')), grid: b.grid.map(r => r.join(' ')) };
});
console.log('breach', solved);
// Click available cells matching first daemon via DOM
for (let i = 0; i < 7; i++) {
  const next = await page.evaluate(() => { const b = window.__ncb.game.breach; if (b.done) return null; const av = b.available(); const d = b.daemons.find(x => !x.done && !x.dead); if (!d) return null; const p = b.partial(d.seq); const want = d.seq[p]; const m = av.find(([r, c]) => b.grid[r][c] === want) || av[0]; return m; });
  if (!next) break;
  await page.click(`#b-matrix .cell:nth-child(${next[0] * (await page.evaluate(() => window.__ncb.game.breach.size)) + next[1] + 1})`); await page.waitForTimeout(60);
}
console.log('breach result', await page.evaluate(() => { const b = window.__ncb.game.breach; return { buffer: b.buffer, done: b.done, ok: b.daemons.filter(d => d.done).map(d => d.name) }; }));
await page.screenshot({ path: SP + '/s8-breach-solved.png' });
await page.click('#b-done'); await page.waitForTimeout(200);
console.log('after breach', await page.evaluate(() => { const g = window.__ncb.game; return { state: g.state, eddies: g.eddies, fx: g.fx, ramMax: g.ramMax }; }));
// Access point panel
await tapCell(4, 3); await page.waitForTimeout(100);
console.log('ap panel', await page.locator('#panel').isVisible(), await page.locator('#panel .t').textContent());
await page.screenshot({ path: SP + '/s9-ap.png' });
await page.click('#panel .x');
// Run several more waves with auto strategy to check netrunner behaviour
await page.evaluate(() => { const g = window.__ncb.game; g.eddies += 2000; g.build('tesla', 5, 8); g.build('smg', 0, 3); g.build('smg', 3, 11); g.build('sniper', 8, 5); });
for (let w = 0; w < 4; w++) {
  await page.click('#btn-wave'); await page.evaluate(() => { window.__ncb.game.speed = 3; });
  for (let i = 0; i < 80; i++) { await page.waitForTimeout(400); const s = await page.evaluate(() => ({ a: window.__ncb.game.waveActive, st: window.__ncb.game.state })); if (!s.a || s.st !== 'play') break; }
  const s = await page.evaluate(() => { const g = window.__ncb.game; return { wave: g.wave, lives: g.lives, eddies: Math.floor(g.eddies), kills: g.stats.kills, offline: g.towers.filter(t => t.offline > 0).length, state: g.state }; });
  console.log('wave done', s);
  if (s.state !== 'play') break;
}
await page.screenshot({ path: SP + '/s10-late.png' });
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
