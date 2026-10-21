// Checks the one-time Breach Protocol intro card: shows on a fresh save, pauses, JACK IN opens the breach, never repeats.
// Run: NODE_PATH=/opt/node-tools/node_modules node tools/intro-test.mjs
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch(); const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto((process.env.BASE_URL || 'http://localhost:8080') + '/index.html'); await page.waitForTimeout(300);
await page.click('#btn-play'); await page.waitForTimeout(200); await page.click('.dcard'); await page.waitForTimeout(3200);
console.log('intro visible:', await page.locator('#screen-intro').isVisible(), 'paused:', await page.evaluate(() => window.__ncb.game.paused));
await page.screenshot({ path: (process.env.SHOT_DIR || 'tools/shots') + '/intro.png' });
await page.click('#i-pri'); await page.waitForTimeout(300);
console.log('after JACK IN: state', await page.evaluate(() => window.__ncb.game.state), 'breach visible', await page.locator('#screen-breach').isVisible(), 'paused', await page.evaluate(() => window.__ncb.game.paused));
await page.click('#b-abort'); await page.waitForTimeout(200);
await page.evaluate(() => window.__ncb.ui.quit()); await page.waitForTimeout(200); await page.click('.dcard'); await page.waitForTimeout(3200);
console.log('second run intro visible:', await page.locator('#screen-intro').isVisible());
console.log('ERRORS:', errors.length ? errors : 'none'); await browser.close();
