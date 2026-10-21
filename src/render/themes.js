// Per-district visual themes. Everything is drawn procedurally: a static ground layer rendered once
// into an offscreen canvas, plus a cheap ambient particle effect per district.
import { makeRng, hashStr } from '../core/rng.js';

const TAU = Math.PI * 2;

function glyphStrip(ctx, x, y, w, h, color, rng) {
  // A vertical neon sign: a column of abstract "kana" strokes.
  ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, w * 0.12); ctx.globalAlpha = 0.85;
  const n = Math.max(2, Math.floor(h / (w * 1.1)));
  for (let i = 0; i < n; i++) {
    const gy = y + w * 0.3 + i * (h - w * 0.4) / n; const gw = w * 0.6, gx = x + w * 0.2;
    ctx.beginPath();
    const k = rng.int(0, 3);
    if (k === 0) { ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.moveTo(gx + gw / 2, gy); ctx.lineTo(gx + gw / 2, gy + gw); }
    else if (k === 1) { ctx.moveTo(gx, gy + gw); ctx.lineTo(gx + gw, gy); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw * 0.6, gy + gw); }
    else if (k === 2) { ctx.rect(gx, gy, gw, gw * 0.8); }
    else { ctx.moveTo(gx, gy + gw * 0.5); ctx.lineTo(gx + gw, gy + gw * 0.5); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gw); ctx.moveTo(gx + gw, gy); ctx.lineTo(gx + gw, gy + gw); }
    ctx.stroke();
  }
  ctx.restore();
}

export const THEMES = {
  watson: {
    ground: ['#0b0a16', '#0e0c1c'], grid: 'rgba(0,240,255,0.06)', road: '#17141f', roadEdge: 'rgba(0,240,255,0.55)', wet: true,
    decor(ctx, L, rng) {
      const { cs, free } = L;
      // Puddles
      for (const [c, r] of free) if (rng.next() < 0.18) { const x = L.sx(c + rng.next()), y = L.sy(r + rng.next()); ctx.fillStyle = 'rgba(0,240,255,0.05)'; ctx.beginPath(); ctx.ellipse(x, y, cs * (0.2 + rng.next() * 0.3), cs * 0.12, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,42,109,0.12)'; ctx.lineWidth = 1; ctx.stroke(); }
      // Neon sign strips on building cells and some free cells near them
      for (const [c, r] of L.blocked) { const col = rng.next() < 0.5 ? '#ff2a6d' : '#00f0ff'; glyphStrip(ctx, L.sx(c) + cs * 0.1, L.sy(r) + cs * 0.1, cs * 0.22, cs * 0.8, col, rng); }
      for (const [c, r] of free) if (rng.next() < 0.07) glyphStrip(ctx, L.sx(c) + cs * 0.7, L.sy(r) + cs * 0.15, cs * 0.18, cs * 0.6, rng.next() < 0.5 ? '#fcee0a' : '#ff2a6d', rng);
    },
    ambient: { kind: 'rain', count: 70, color: 'rgba(160,220,255,0.35)' },
  },
  westbrook: {
    ground: ['#120f0c', '#161109'], grid: 'rgba(252,238,10,0.05)', road: '#1b1712', roadEdge: 'rgba(252,238,10,0.55)',
    decor(ctx, L, rng) {
      const { cs, free } = L;
      // Roof tiles on blocked cells
      for (const [c, r] of L.blocked) { ctx.strokeStyle = 'rgba(252,238,10,0.35)'; ctx.lineWidth = 1; for (let i = 1; i < 5; i++) { const y = L.sy(r) + cs * i / 5; ctx.beginPath(); ctx.moveTo(L.sx(c) + 3, y); ctx.lineTo(L.sx(c) + cs - 3, y); ctx.stroke(); } }
      // Paper lanterns beside the road
      for (const [c, r] of L.roadside) if (rng.next() < 0.16) { const x = L.sx(c + 0.5), y = L.sy(r + 0.5); ctx.fillStyle = 'rgba(255,42,109,0.6)'; ctx.beginPath(); ctx.ellipse(x, y, cs * 0.11, cs * 0.14, 0, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(252,238,10,0.9)'; ctx.fillRect(x - 1, y - cs * 0.2, 2, cs * 0.07); ctx.fillStyle = 'rgba(255,42,109,0.04)'; ctx.beginPath(); ctx.arc(x, y, cs * 0.4, 0, TAU); ctx.fill(); }
      // Garden gravel patches
      for (const [c, r] of free) if (rng.next() < 0.12) { ctx.strokeStyle = 'rgba(252,238,10,0.08)'; ctx.lineWidth = 1; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(L.sx(c + 0.5), L.sy(r + 0.5), cs * (0.12 + i * 0.1), 0, TAU); ctx.stroke(); } }
    },
    ambient: { kind: 'petals', count: 26, color: 'rgba(255,150,200,0.7)' },
  },
  heywood: {
    ground: ['#13100c', '#17110a'], grid: 'rgba(255,140,26,0.05)', road: '#1c1712', roadEdge: 'rgba(255,140,26,0.55)',
    decor(ctx, L, rng) {
      const { cs, free } = L;
      // Murals on buildings: stacked colour bands
      const pal = ['#ff8c1a', '#fcee0a', '#ff2a6d', '#39ff14', '#00f0ff'];
      for (const [c, r] of L.blocked) { for (let i = 0; i < 4; i++) { ctx.fillStyle = rng.pick(pal); ctx.globalAlpha = 0.28; ctx.fillRect(L.sx(c) + 4, L.sy(r) + 4 + i * (cs - 8) / 4, cs - 8, (cs - 8) / 4 - 1); } ctx.globalAlpha = 1; }
      // Graffiti tags: short bezier scribbles
      for (const [c, r] of free) if (rng.next() < 0.1) { const x = L.sx(c + 0.2), y = L.sy(r + 0.5); ctx.strokeStyle = rng.pick(pal); ctx.globalAlpha = 0.3; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + cs * 0.2, y - cs * 0.3, x + cs * 0.4, y + cs * 0.3, x + cs * 0.6, y - cs * 0.1); ctx.stroke(); ctx.globalAlpha = 1; }
      // Cracked asphalt lines
      for (const [c, r] of free) if (rng.next() < 0.08) { ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.beginPath(); let x = L.sx(c + rng.next()), y = L.sy(r + rng.next()); ctx.moveTo(x, y); for (let i = 0; i < 4; i++) { x += (rng.next() - 0.5) * cs * 0.6; y += (rng.next() - 0.5) * cs * 0.6; ctx.lineTo(x, y); } ctx.stroke(); }
    },
    ambient: { kind: 'heat', count: 10, color: 'rgba(255,140,26,0.035)' },
  },
  santo: {
    ground: ['#0b100d', '#0c130f'], grid: 'rgba(57,255,20,0.05)', road: '#171a17', roadEdge: 'rgba(255,140,26,0.6)', hazard: true,
    decor(ctx, L, rng) {
      const { cs, free } = L;
      // Pipe runs along some rows
      for (let r = 0; r < L.rows; r++) if (rng.next() < 0.22) { const y = L.sy(r + 0.15 + rng.next() * 0.7); ctx.strokeStyle = 'rgba(57,255,20,0.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(L.ox, y); ctx.lineTo(L.ox + cs * L.cols, y); ctx.stroke(); ctx.strokeStyle = 'rgba(57,255,20,0.35)'; ctx.lineWidth = 1; for (let c = 0; c < L.cols; c += 2) { ctx.beginPath(); ctx.arc(L.sx(c + 0.5), y, 4, 0, TAU); ctx.stroke(); } }
      // Floor grating
      for (const [c, r] of free) if (rng.next() < 0.14) { ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(L.sx(c) + cs * i / 5, L.sy(r) + 4); ctx.lineTo(L.sx(c) + cs * i / 5, L.sy(r) + cs - 4); ctx.stroke(); } }
      // Hazard chevrons on buildings
      for (const [c, r] of L.blocked) { ctx.save(); ctx.beginPath(); ctx.rect(L.sx(c) + 3, L.sy(r) + 3, cs - 6, cs - 6); ctx.clip(); ctx.strokeStyle = 'rgba(252,238,10,0.35)'; ctx.lineWidth = 4; for (let i = -1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(L.sx(c) + i * cs * 0.3, L.sy(r) + cs); ctx.lineTo(L.sx(c) + i * cs * 0.3 + cs, L.sy(r)); ctx.stroke(); } ctx.restore(); }
    },
    ambient: { kind: 'sparks', count: 20, color: 'rgba(255,200,80,0.9)' },
  },
  pacifica: {
    ground: ['#0d0a16', '#0a0f18'], grid: 'rgba(177,76,255,0.06)', road: '#17131f', roadEdge: 'rgba(177,76,255,0.55)', cracked: true,
    decor(ctx, L, rng) {
      const { cs, free } = L;
      // Ocean along the right edge: layered wave lines
      const shoreX = L.ox + cs * L.cols; 
      for (let i = 0; i < 6; i++) { ctx.strokeStyle = `rgba(0,240,255,${0.18 - i * 0.025})`; ctx.lineWidth = 1.5; ctx.beginPath(); for (let y = L.oy; y <= L.oy + cs * L.rows; y += 6) { const x = shoreX - cs * 0.15 - i * cs * 0.12 + Math.sin(y / (cs * 0.5) + i) * cs * 0.06; y === L.oy ? ctx.moveTo(x, y) : ctx.lineTo(x, y); } ctx.stroke(); }
      // Cracked concrete
      for (const [c, r] of free) if (rng.next() < 0.16) { ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.beginPath(); let x = L.sx(c + rng.next()), y = L.sy(r + rng.next()); ctx.moveTo(x, y); for (let i = 0; i < 5; i++) { x += (rng.next() - 0.5) * cs * 0.7; y += (rng.next() - 0.5) * cs * 0.7; ctx.lineTo(x, y); } ctx.stroke(); }
      // VDB sigils: circle + spokes, purple
      for (const [c, r] of free) if (rng.next() < 0.06) { const x = L.sx(c + 0.5), y = L.sy(r + 0.5), R = cs * 0.3; ctx.strokeStyle = 'rgba(177,76,255,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.stroke(); for (let i = 0; i < 6; i++) { const a = i * TAU / 6; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); ctx.stroke(); } }
      // Boarded windows on buildings
      for (const [c, r] of L.blocked) { ctx.strokeStyle = 'rgba(177,76,255,0.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(L.sx(c) + 6, L.sy(r) + 6); ctx.lineTo(L.sx(c) + cs - 6, L.sy(r) + cs - 6); ctx.moveTo(L.sx(c) + cs - 6, L.sy(r) + 6); ctx.lineTo(L.sx(c) + 6, L.sy(r) + cs - 6); ctx.stroke(); }
    },
    ambient: { kind: 'fog', count: 7, color: 'rgba(177,76,255,0.07)' },
  },
  center: {
    ground: ['#100a10', '#140c12'], grid: 'rgba(255,42,109,0.05)', road: '#1a141c', roadEdge: 'rgba(252,238,10,0.6)', clean: true,
    decor(ctx, L, rng) {
      const { cs, free } = L;
      // Marble: 2x2 tile seams with faint veins
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
      for (let c = 0; c <= L.cols; c += 2) { ctx.beginPath(); ctx.moveTo(L.sx(c) + 0.5, L.oy); ctx.lineTo(L.sx(c) + 0.5, L.oy + cs * L.rows); ctx.stroke(); }
      for (let r = 0; r <= L.rows; r += 2) { ctx.beginPath(); ctx.moveTo(L.ox, L.sy(r) + 0.5); ctx.lineTo(L.ox + cs * L.cols, L.sy(r) + 0.5); ctx.stroke(); }
      for (const [c, r] of free) if (rng.next() < 0.1) { ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); const x = L.sx(c), y = L.sy(r + rng.next()); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + cs * 0.5, y + (rng.next() - 0.5) * cs, x + cs, y + (rng.next() - 0.5) * cs * 0.5); ctx.stroke(); }
      // Corporate logos on buildings: red hex with a bar
      for (const [c, r] of L.blocked) { const x = L.sx(c + 0.5), y = L.sy(r + 0.5); ctx.strokeStyle = 'rgba(255,42,109,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; i ? ctx.lineTo(x + Math.cos(a) * cs * 0.26, y + Math.sin(a) * cs * 0.26) : ctx.moveTo(x + Math.cos(a) * cs * 0.26, y + Math.sin(a) * cs * 0.26); } ctx.closePath(); ctx.stroke(); ctx.fillStyle = 'rgba(252,238,10,0.6)'; ctx.fillRect(x - cs * 0.12, y - 1.5, cs * 0.24, 3); }
      // Planters: green squares at plaza corners
      for (const [c, r] of free) if (rng.next() < 0.05) { ctx.fillStyle = 'rgba(57,255,20,0.12)'; ctx.fillRect(L.sx(c) + cs * 0.3, L.sy(r) + cs * 0.3, cs * 0.4, cs * 0.4); ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.strokeRect(L.sx(c) + cs * 0.3 + 0.5, L.sy(r) + cs * 0.3 + 0.5, cs * 0.4, cs * 0.4); }
    },
    ambient: { kind: 'sweep', count: 3, color: 'rgba(252,238,10,0.05)' },
  },
};

export function themeFor(district) { return THEMES[district.id] || THEMES.watson; }

// Build the static ground layer for a district at the current cell size.
export function buildGroundLayer(renderer, game) {
  const theme = themeFor(game.district); const { cs, ox, oy, w, h } = renderer; const cols = game.cols, rows = game.rows;
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w * renderer.dpr)); cv.height = Math.max(1, Math.round(h * renderer.dpr));
  const ctx = cv.getContext('2d'); ctx.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
  const grd = ctx.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, theme.ground[0]); grd.addColorStop(1, theme.ground[1]);
  ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
  // Grid
  ctx.strokeStyle = theme.grid; ctx.lineWidth = 1;
  for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(ox + c * cs + 0.5, oy); ctx.lineTo(ox + c * cs + 0.5, oy + cs * rows); ctx.stroke(); }
  for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(ox, oy + r * cs + 0.5); ctx.lineTo(ox + cs * cols, oy + r * cs + 0.5); ctx.stroke(); }
  // Cell classes for the decorator
  const free = [], roadside = [], blocked = [];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const k = c + ',' + r;
    if (game.blocked.has(k)) { blocked.push([c, r]); continue; }
    if (game.pathCells.has(k) || game.apCells.has(k)) continue;
    free.push([c, r]);
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => game.routes[0].cells.has((c + dc) + ',' + (r + dr)))) roadside.push([c, r]);
  }
  const L = { cs, ox, oy, cols, rows, free, roadside, blocked, sx: (x) => ox + x * cs, sy: (y) => oy + y * cs };
  theme.decor(ctx, L, makeRng(hashStr('decor:' + game.district.id)));
  // District frame
  ctx.strokeStyle = game.district.color; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5; ctx.strokeRect(ox + 0.5, oy + 0.5, cs * cols - 1, cs * rows - 1); ctx.globalAlpha = 1;
  return cv;
}

// Ambient particles: purely cosmetic, owned by the renderer.
export class Ambient {
  constructor(theme, w, h) { this.cfg = theme.ambient; this.w = w; this.h = h; this.p = []; for (let i = 0; i < this.cfg.count; i++) this.p.push(this.make(true)); }
  make(anywhere) {
    const k = this.cfg.kind, w = this.w, h = this.h;
    switch (k) {
      case 'rain': return { x: Math.random() * w, y: anywhere ? Math.random() * h : -10, vx: -60, vy: 900 + Math.random() * 300, len: 10 + Math.random() * 10 };
      case 'petals': return { x: Math.random() * w, y: anywhere ? Math.random() * h : -6, vx: 15 + Math.random() * 20, vy: 25 + Math.random() * 20, r: 2 + Math.random() * 2, ph: Math.random() * TAU };
      case 'heat': return { x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10, vy: -(12 + Math.random() * 10), r: 20 + Math.random() * 30, ph: Math.random() * TAU };
      case 'sparks': return { x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 80, vy: -40 - Math.random() * 80, life: 0, max: 0.4 + Math.random() * 0.5, delay: Math.random() * 4 };
      case 'fog': return { x: Math.random() * w, y: Math.random() * h, vx: 8 + Math.random() * 10, r: 60 + Math.random() * 60 };
      case 'sweep': return { y: Math.random() * h, vy: 40 + Math.random() * 30, hgt: 40 + Math.random() * 60 };
    }
  }
  draw(ctx, dt) {
    const k = this.cfg.kind, w = this.w, h = this.h; ctx.save();
    for (let i = 0; i < this.p.length; i++) {
      const p = this.p[i];
      if (k === 'rain') { p.x += p.vx * dt; p.y += p.vy * dt; if (p.y > h + 20) this.p[i] = this.make(false); ctx.strokeStyle = this.cfg.color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.012, p.y - p.len); ctx.stroke(); }
      else if (k === 'petals') { p.ph += dt * 3; p.x += (p.vx + Math.sin(p.ph) * 20) * dt; p.y += p.vy * dt; if (p.y > h + 10 || p.x > w + 10) this.p[i] = this.make(false); ctx.fillStyle = this.cfg.color; ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * 0.5, p.ph, 0, TAU); ctx.fill(); }
      else if (k === 'heat') { p.ph += dt * 2; p.y += p.vy * dt; if (p.y < -p.r) this.p[i] = this.make(false); ctx.fillStyle = this.cfg.color; ctx.beginPath(); ctx.ellipse(p.x + Math.sin(p.ph) * 6, p.y, p.r * 0.6, p.r, 0, 0, TAU); ctx.fill(); }
      else if (k === 'sparks') { if (p.delay > 0) { p.delay -= dt; continue; } p.life += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 200 * dt; if (p.life > p.max) { this.p[i] = this.make(true); continue; } ctx.globalAlpha = 1 - p.life / p.max; ctx.fillStyle = this.cfg.color; ctx.fillRect(p.x, p.y, 2, 2); ctx.globalAlpha = 1; }
      else if (k === 'fog') { p.x += p.vx * dt; if (p.x - p.r > w) p.x = -p.r; const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, this.cfg.color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2); }
      else if (k === 'sweep') { p.y += p.vy * dt; if (p.y > h + p.hgt) p.y = -p.hgt; const g = ctx.createLinearGradient(0, p.y, 0, p.y + p.hgt); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, this.cfg.color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, p.y, w, p.hgt); }
    }
    ctx.restore();
  }
}
