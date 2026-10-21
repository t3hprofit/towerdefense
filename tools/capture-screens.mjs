// Screenshots the district list, a Pacifica wave, a tower panel, the result screen and the pause screen.
// Run: NODE_PATH=/opt/node-tools/node_modules node tools/capture-screens.mjs
import fs from "fs";
import { createRequire } from "module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE_URL || "http://localhost:8080";
const SP = process.env.SHOT_DIR || 'tools/shots/screens'; fs.mkdirSync(SP, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errors = [];
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/index.html'); await page.waitForTimeout(300);
await page.evaluate(() => { const { Save } = window.__ncb; const td = Save.tierData(); td.unlocked = ['watson', 'westbrook', 'santo', 'pacifica']; td.districts.watson = { stars: 3, bestWave: 10, won: true, plays: 2 }; td.districts.westbrook = { stars: 2, bestWave: 10, won: true, plays: 1 }; });
await page.click('#btn-play'); await page.waitForTimeout(200); await page.screenshot({ path: SP + '/t1-districts.png' });
await page.click('.dcard:nth-child(4)'); await page.waitForTimeout(300);
await page.evaluate(() => { const g = window.__ncb.game; g.eddies += 3000; g.build('deck', 4, 10); g.build('smg', 2, 10); g.build('rocket', 6, 10); g.build('tesla', 4, 7); g.build('sniper', 2, 5); g.jackIn(g.accessPoints[0]); g.startWave(); g.speed = 3; });
await page.waitForTimeout(3500);
await page.evaluate(() => { const g = window.__ncb.game; g.speed = 1; const e = g.enemies[0]; if (e) { g.castHack({ id: 'contagion', name: 'CONTAGION', cost: 6, color: '#39ff14' }, e); } g.selectedTower = g.towers[0]; });
await page.waitForTimeout(400); await page.screenshot({ path: SP + '/t2-pacifica.png' });
// Tower panel for deck, then force a win result
await page.evaluate(() => { const g = window.__ncb.game; window.__ncb.ui.openTowerPanel(g.towers[0]); }); await page.waitForTimeout(100); await page.screenshot({ path: SP + '/t3-deckpanel.png' });
await page.evaluate(() => { const g = window.__ncb.game; g.wave = 10; g.lives = 17; g.finish(true); }); await page.waitForTimeout(200); await page.screenshot({ path: SP + '/t4-result.png' });
await page.click('#r-quit'); await page.waitForTimeout(200);
await page.click('.dcard:nth-child(1)'); await page.waitForTimeout(200);
await page.click('#btn-pause'); await page.waitForTimeout(100); await page.screenshot({ path: SP + '/t5-pause.png' });
await page.click('#btn-resume');
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
