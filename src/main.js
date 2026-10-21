import { Game } from './game/game.js';
import { Renderer } from './render/renderer.js';
import { UI } from './ui/ui.js';
import { Save } from './core/save.js';
import { Audio } from './core/audio.js';
import { Session } from './core/session.js';
import { initAnalytics } from './core/analytics.js';

Save.load();
Session.load();
initAnalytics();
const ui = new UI();
const game = new Game(ui);
const canvas = document.getElementById('game');
const renderer = new Renderer(canvas, game);
ui.bind(game, () => renderer.resize());
window.__onResize = () => renderer.resize();
window.addEventListener('resize', () => renderer.resize());
window.addEventListener('orientationchange', () => setTimeout(() => renderer.resize(), 150));
if (window.visualViewport) window.visualViewport.addEventListener('resize', () => renderer.resize());
// Catches HUD height changes and stale iOS viewports after rotation.
if (window.ResizeObserver) new ResizeObserver(() => renderer.resize()).observe(document.getElementById('field'));

// ---------- Input (pointer events cover touch + mouse) ----------
let downPos = null;
canvas.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return;
  Audio.init();
  downPos = { x: e.clientX, y: e.clientY, t: performance.now() };
  const rect = canvas.getBoundingClientRect(); const w = renderer.toWorld(e.clientX - rect.left, e.clientY - rect.top);
  game.hoverCell = { c: Math.floor(w.x), r: Math.floor(w.y) };
}, { passive: true });
canvas.addEventListener('pointermove', (e) => {
  if (game.selected?.kind !== 'tower') return;
  const rect = canvas.getBoundingClientRect(); const w = renderer.toWorld(e.clientX - rect.left, e.clientY - rect.top);
  game.hoverCell = { c: Math.floor(w.x), r: Math.floor(w.y) };
}, { passive: true });
canvas.addEventListener('pointerup', (e) => {
  if (!downPos || !e.isPrimary) return;
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y); downPos = null;
  if (moved > 14) return; // drag, not a tap
  const rect = canvas.getBoundingClientRect(); const w = renderer.toWorld(e.clientX - rect.left, e.clientY - rect.top);
  game.tap(w.x, w.y);
}, { passive: true });
canvas.addEventListener('pointercancel', () => { downPos = null; });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());
// iOS: unlock audio on the first real activation (touchend/click), enable :active styles. Browsers
// allow no sound before a gesture, so the title music also starts here, on the first tap anywhere.
const unlock = () => { Audio.init(); Audio.startMusic(); };
document.addEventListener('touchend', unlock, { capture: true, passive: true });
document.addEventListener('click', unlock, { capture: true });
document.addEventListener('touchstart', () => {}, { passive: true });
// Landscape guard: pause while the rotate overlay is showing.
const landscapeMq = window.matchMedia('(orientation: landscape) and (max-height: 500px)');
landscapeMq.addEventListener('change', (e) => { if (e.matches && game.state === 'play') ui.pause(true); });

// Keyboard shortcuts for desktop testing
window.addEventListener('keydown', (e) => {
  if (game.state !== 'play') return;
  if (e.key === ' ') { e.preventDefault(); game.startWave(); }
  if (e.key === 'p' || e.key === 'Escape') ui.pause(!game.paused);
  if (e.key === 'b') game.openBreach();
  if (e.key >= '1' && e.key <= '6') { const ids = ['smg', 'sniper', 'tesla', 'flamer', 'deck', 'rocket']; if (game.towerUnlocked(ids[e.key - 1])) game.select('tower', ids[e.key - 1]); }
  if (e.key === 'q') ui.setTab(ui.tab === 'build' ? 'hacks' : 'build');
});

// Pause when backgrounded (phone lock, app switch)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (game.state === 'play') ui.pause(true); Audio.background(); return; }
  // Back from lock / app switch: resume audio and check for a new version.
  Audio.foreground();
  if (swReg) swReg.update().catch(() => {});
});

window.addEventListener('pagehide', () => Audio.background());

// ---------- Main loop ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  game.update(dt);
  renderer.draw();
  ui.refreshHud();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
ui.showScreen('menu');

// ---------- PWA ----------
let swReg = null;
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(r => { swReg = r; }).catch(() => {}));
  // When a new version takes over, reload only while nothing is in progress.
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && game.state === 'menu') location.reload(); hadController = true; });
}
// Expose for debugging / automated tests
window.__ncb = { game, ui, renderer, Save, Audio, Session };
