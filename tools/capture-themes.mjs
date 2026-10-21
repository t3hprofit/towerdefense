// Screenshots every district mid-wave to tools/shots/themes/. Server must be running (see README Testing).
// Run: NODE_PATH=/opt/node-tools/node_modules node tools/capture-themes.mjs
import fs from "fs";
import { createRequire } from "module";
const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.env.BASE_URL || "http://localhost:8080";
const SP = process.env.SHOT_DIR || "tools/shots/themes"; fs.mkdirSync(SP, { recursive: true });
const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(BASE + '/index.html'); await page.waitForTimeout(300);
await page.evaluate(() => { window.__ncb.Save.tierData().unlocked = ['watson','westbrook','heywood','santo','pacifica','center']; });
await page.click('#btn-play'); await page.waitForTimeout(200);
for (let i = 1; i <= 6; i++) {
  await page.click(`.dcard:nth-child(${i})`); await page.waitForTimeout(400);
  await page.evaluate(() => { const g = window.__ncb.game; g.eddies += 1500; let n = 0; for (let c = 0; c < 9 && n < 4; c++) for (let r = 0; r < 14 && n < 4; r++) if (g.buildable(c, r) && (c + r) % 3 === 0) { g.build(['smg','tesla','sniper','deck'][n], c, r); n++; } g.startWave(); g.speed = 2; });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SP}/d${i}.png` });
  await page.evaluate(() => window.__ncb.ui.quit()); await page.waitForTimeout(200);
}
console.log('ERRORS:', errors.length ? errors : 'none'); await browser.close();
