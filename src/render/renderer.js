import { COLORS, FONT } from '../config/tokens.js';
import { TOWERS } from '../data/towers.js';
import { posAt } from '../game/path.js';

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.game = game;
    this.cs = 40; this.ox = 0; this.oy = 0; this.w = 0; this.h = 0; this.dpr = 1;
    this.resize();
  }
  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, Math.floor(rect.width)); this.h = Math.max(1, Math.floor(rect.height));
    this.canvas.width = Math.round(rect.width * this.dpr); this.canvas.height = Math.round(rect.height * this.dpr);
    this.vignette = null;
    const g = this.game; this.cs = Math.floor(Math.min(this.w / g.cols, this.h / g.rows));
    this.ox = Math.floor((this.w - this.cs * g.cols) / 2); this.oy = Math.floor((this.h - this.cs * g.rows) / 2);
  }
  toWorld(px, py) { return { x: (px - this.ox) / this.cs, y: (py - this.oy) / this.cs }; }
  sx(x) { return this.ox + x * this.cs; }
  sy(y) { return this.oy + y * this.cs; }

  draw() {
    const ctx = this.ctx, g = this.game, cs = this.cs;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, this.w, this.h);
    if (g.state === 'menu' || !g.district) { this.drawIdle(); return; }
    ctx.save();
    if (g.shake > 0) { const s = g.shake * 6; ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s); }
    this.drawGrid(); this.drawBlocked(); this.drawRoutes(); this.drawBuildHints(); this.drawAccessPoints();
    this.drawTowers(); this.drawHackLinks(); this.drawEnemies(); this.drawProjectiles(); this.drawZaps(); this.drawParticles(); this.drawTexts();
    ctx.restore();
    if (g.flash > 0) { ctx.fillStyle = `rgba(255,42,109,${g.flash * 0.5})`; ctx.fillRect(0, 0, this.w, this.h); }
    this.drawVignette();
  }
  drawIdle() {
    const ctx = this.ctx; ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let x = 0; x < this.w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.h); ctx.stroke(); }
    for (let y = 0; y < this.h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.w, y); ctx.stroke(); }
  }
  drawVignette() {
    const ctx = this.ctx;
    if (!this.vignette) {
      const grd = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.4, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
      grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.55)'); this.vignette = grd;
    }
    ctx.fillStyle = this.vignette; ctx.fillRect(0, 0, this.w, this.h);
  }
  drawGrid() {
    const ctx = this.ctx, g = this.game, cs = this.cs;
    const tint = g.district.color;
    ctx.fillStyle = COLORS.bg2; ctx.fillRect(this.ox, this.oy, cs * g.cols, cs * g.rows);
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
    for (let c = 0; c <= g.cols; c++) { ctx.beginPath(); ctx.moveTo(this.sx(c) + 0.5, this.oy); ctx.lineTo(this.sx(c) + 0.5, this.oy + cs * g.rows); ctx.stroke(); }
    for (let r = 0; r <= g.rows; r++) { ctx.beginPath(); ctx.moveTo(this.ox, this.sy(r) + 0.5); ctx.lineTo(this.ox + cs * g.cols, this.sy(r) + 0.5); ctx.stroke(); }
    ctx.strokeStyle = tint; ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5; ctx.strokeRect(this.ox + 0.5, this.oy + 0.5, cs * g.cols - 1, cs * g.rows - 1); ctx.globalAlpha = 1;
  }
  drawBlocked() {
    const ctx = this.ctx, g = this.game, cs = this.cs;
    for (const k of g.blocked) {
      const [c, r] = k.split(',').map(Number); const x = this.sx(c), y = this.sy(r);
      ctx.fillStyle = '#14101f'; ctx.fillRect(x + 2, y + 2, cs - 4, cs - 4);
      ctx.strokeStyle = g.district.accent; ctx.globalAlpha = 0.45; ctx.lineWidth = 1; ctx.strokeRect(x + 2.5, y + 2.5, cs - 5, cs - 5);
      ctx.globalAlpha = 0.6; ctx.fillStyle = g.district.accent;
      const seed = (c * 7 + r * 13);
      for (let i = 0; i < 6; i++) { if ((seed * (i + 3)) % 5 < 3) ctx.fillRect(x + 6 + (i % 3) * (cs - 12) / 3, y + 7 + Math.floor(i / 3) * (cs / 2 - 4), 3, 3); }
      ctx.globalAlpha = 1;
    }
  }
  drawRoutes() {
    const ctx = this.ctx, g = this.game, cs = this.cs;
    const all = g.district.routeMode === 'all';
    const order = g.routes.map((r, i) => i).sort((a, b) => (a === g.activeRoute ? 1 : 0) - (b === g.activeRoute ? 1 : 0));
    for (const i of order) {
      const route = g.routes[i]; const active = all || i === g.activeRoute;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); route.pts.forEach((p, k) => k ? ctx.lineTo(this.sx(p.x), this.sy(p.y)) : ctx.moveTo(this.sx(p.x), this.sy(p.y)));
      ctx.strokeStyle = active ? COLORS.road : '#100e16'; ctx.lineWidth = cs * 0.78; ctx.stroke();
      ctx.strokeStyle = active ? COLORS.roadEdge : COLORS.roadAlt; ctx.globalAlpha = active ? 0.9 : 0.35; ctx.lineWidth = active ? 2 : 1.5;
      ctx.setLineDash(active ? [] : [6, 8]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      // Centre dashes flowing in the direction of travel
      if (active) {
        ctx.strokeStyle = g.district.color; ctx.globalAlpha = 0.35; ctx.lineWidth = 2; ctx.setLineDash([cs * 0.25, cs * 0.5]); ctx.lineDashOffset = -(g.time * cs * 0.8) % (cs * 0.75);
        ctx.stroke(); ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.globalAlpha = 1;
      }
      // Entry marker and core marker
      const a = posAt(route, 1), b = posAt(route, route.length - 1);
      this.marker(this.sx(a.x), this.sy(a.y), active ? '#ff3b3b' : '#552', 'SPAWN');
      this.marker(this.sx(b.x), this.sy(b.y), '#39ff14', 'CORE');
    }
  }
  marker(x, y, color, label) {
    const ctx = this.ctx, cs = this.cs;
    ctx.fillStyle = color; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(x, y, cs * 0.22, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.font = `bold ${Math.max(7, cs * 0.2)}px ${FONT.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x, y);
  }
  drawBuildHints() {
    const g = this.game, ctx = this.ctx, cs = this.cs;
    if (g.selected?.kind !== 'tower') return;
    const def = TOWERS[g.selected.id]; const afford = g.eddies >= g.towerCost(def.id);
    ctx.fillStyle = afford ? 'rgba(0,240,255,0.10)' : 'rgba(255,59,59,0.08)';
    for (let c = 0; c < g.cols; c++) for (let r = 0; r < g.rows; r++) if (g.buildable(c, r)) ctx.fillRect(this.sx(c) + 3, this.sy(r) + 3, cs - 6, cs - 6);
    if (g.hoverCell && g.buildable(g.hoverCell.c, g.hoverCell.r)) {
      const x = this.sx(g.hoverCell.c + 0.5), y = this.sy(g.hoverCell.r + 0.5);
      ctx.strokeStyle = def.color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, def.levels[0].range * cs, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
    }
  }
  drawAccessPoints() {
    const ctx = this.ctx, g = this.game, cs = this.cs;
    for (const ap of g.accessPoints) {
      const x = this.sx(ap.c + 0.5), y = this.sy(ap.r + 0.5); const ready = ap.cooldown <= 0;
      const col = ap.type === 'DOOR' ? '#fcee0a' : ap.type === 'TRAP' ? '#ff8c1a' : ap.type === 'TURRET' ? '#b14cff' : '#00f0ff';
      if (ap.type === 'DOOR') {
        // Gate posts on the road; bars when sealed
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.moveTo(x - cs * 0.4, y - cs * 0.4); ctx.lineTo(x - cs * 0.4, y + cs * 0.4); ctx.moveTo(x + cs * 0.4, y - cs * 0.4); ctx.lineTo(x + cs * 0.4, y + cs * 0.4); ctx.stroke();
        if (ap.active > 0) { ctx.strokeStyle = '#ff3b3b'; ctx.lineWidth = 2; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x - cs * 0.4, y + i * cs * 0.22); ctx.lineTo(x + cs * 0.4, y + i * cs * 0.22); ctx.stroke(); } }
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = '#0a0a14'; ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = ready ? 1 : 0.45;
        ctx.beginPath(); ctx.moveTo(x, y - cs * 0.36); ctx.lineTo(x + cs * 0.36, y); ctx.lineTo(x, y + cs * 0.36); ctx.lineTo(x - cs * 0.36, y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col; ctx.font = `bold ${cs * 0.3}px ${FONT.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(ap.type === 'TRAP' ? '✸' : ap.type === 'TURRET' ? '⌖' : '⇄', x, y + 1);
        if (ap.type === 'TURRET' && ap.active > 0) {
          ctx.strokeStyle = '#b14cff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ap.angle || 0) * cs * 0.45, y + Math.sin(ap.angle || 0) * cs * 0.45); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      if (ready && !(ap.active > 0)) { const p = (Math.sin(g.time * 3) + 1) / 2; ctx.strokeStyle = col; ctx.globalAlpha = 0.25 + p * 0.35; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, cs * (0.42 + p * 0.08), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      if (!ready) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(x, y, cs * 0.42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - ap.cooldown / ap.cooldownDef)); ctx.stroke(); ctx.globalAlpha = 1; }
      if (ap.active > 0 && ap.type === 'TURRET') { ctx.strokeStyle = col; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(x, y, ap.range * cs, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
    }
  }
  hex(x, y, rad) {
    const ctx = this.ctx; ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
    ctx.closePath();
  }
  drawTowers() {
    const ctx = this.ctx, g = this.game, cs = this.cs;
    // Firewall auras first
    for (const t of g.towers) if (t.type === 'deck' && t.offline <= 0) {
      const x = this.sx(t.x), y = this.sy(t.y); ctx.fillStyle = COLORS.firewall; ctx.beginPath(); ctx.arc(x, y, t.stats.range * cs, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#39ff14'; ctx.globalAlpha = 0.3; ctx.setLineDash([4, 6]); ctx.lineDashOffset = -g.time * 10; ctx.lineWidth = 1; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    for (const t of g.towers) {
      const def = TOWERS[t.type]; const x = this.sx(t.x), y = this.sy(t.y); const off = t.offline > 0;
      const col = off ? COLORS.offline : def.color;
      if (g.selectedTower === t) { ctx.strokeStyle = def.color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, t.stats.range * cs, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      // Base
      ctx.fillStyle = off && Math.floor(g.time * 8) % 2 ? '#2a0a0a' : '#0d0d18'; this.hex(x, y, cs * 0.42); ctx.fill();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke();
      // Level pips
      for (let i = 0; i <= t.level; i++) { ctx.fillStyle = '#fcee0a'; ctx.fillRect(x - cs * 0.18 + i * cs * 0.14, y + cs * 0.3, cs * 0.09, 3); }
      // Barrel
      if (def.kind !== 'deck') { ctx.strokeStyle = col; ctx.lineWidth = def.kind === 'rocket' ? 5 : 3; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(t.angle) * cs * 0.42, y + Math.sin(t.angle) * cs * 0.42); ctx.stroke(); }
      else { ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t.pulse * 4); ctx.beginPath(); ctx.arc(x, y, cs * 0.3, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      ctx.fillStyle = col; ctx.font = `bold ${cs * 0.34}px ${FONT.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(def.glyph, x, y + 1);
      if (off) { ctx.fillStyle = '#ff3b3b'; ctx.font = `bold ${cs * 0.2}px ${FONT.ui}`; ctx.fillText('OFFLINE', x, y - cs * 0.42); ctx.fillStyle = 'rgba(255,59,59,0.8)'; ctx.fillRect(x - cs * 0.3, y + cs * 0.36, cs * 0.6, 3); ctx.fillStyle = '#ff8c1a'; }
      else if (t.hackProgress > 0) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - cs * 0.3, y - cs * 0.46, cs * 0.6, 4); ctx.fillStyle = '#b14cff'; ctx.fillRect(x - cs * 0.3, y - cs * 0.46, cs * 0.6 * Math.min(1, t.hackProgress), 4); }
    }
  }
  drawHackLinks() {
    const ctx = this.ctx, g = this.game;
    ctx.setLineDash([3, 4]); ctx.lineDashOffset = -g.time * 20; ctx.lineWidth = 1.5; ctx.strokeStyle = '#b14cff';
    for (const e of g.enemies) for (const hk of e.hacks) { ctx.beginPath(); ctx.moveTo(this.sx(e.x), this.sy(e.y)); ctx.lineTo(this.sx(hk.tower.x), this.sy(hk.tower.y)); ctx.stroke(); }
    ctx.setLineDash([]); ctx.lineDashOffset = 0;
  }
  drawEnemies() {
    const ctx = this.ctx, g = this.game, cs = this.cs;
    for (const e of g.enemies) {
      const x = this.sx(e.x), y = this.sy(e.y); const rad = e.size * cs;
      ctx.save(); ctx.translate(x, y);
      if (e.blind > 0) ctx.globalAlpha = 0.55;
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : '#0a0a12'; ctx.strokeStyle = e.color; ctx.lineWidth = e.boss ? 3 : 2;
      ctx.rotate(e.ang);
      switch (e.shape) {
        case 'tri': ctx.beginPath(); ctx.moveTo(rad, 0); ctx.lineTo(-rad * 0.8, rad * 0.7); ctx.lineTo(-rad * 0.8, -rad * 0.7); ctx.closePath(); break;
        case 'sq': ctx.beginPath(); ctx.rect(-rad * 0.8, -rad * 0.8, rad * 1.6, rad * 1.6); break;
        case 'rect': ctx.beginPath(); ctx.rect(-rad * 1.1, -rad * 0.65, rad * 2.2, rad * 1.3); break;
        case 'dia': ctx.beginPath(); ctx.moveTo(rad, 0); ctx.lineTo(0, rad * 0.7); ctx.lineTo(-rad, 0); ctx.lineTo(0, -rad * 0.7); ctx.closePath(); break;
        case 'hex': this.hex(0, 0, rad); break;
        case 'pent': ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; i ? ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad) : ctx.moveTo(rad, 0); } ctx.closePath(); break;
        case 'ring': ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2); break;
        case 'run': ctx.beginPath(); ctx.arc(0, 0, rad * 0.85, 0, Math.PI * 2); break;
      }
      ctx.fill(); ctx.stroke();
      if (e.shape === 'ring') { ctx.beginPath(); ctx.arc(0, 0, rad * 0.4, 0, Math.PI * 2); ctx.stroke(); }
      if (e.shape === 'run') { ctx.rotate(-e.ang); ctx.strokeStyle = '#b14cff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -rad * 0.85); ctx.lineTo(0, -rad * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(0, -rad * 1.5, 2.5 + Math.sin(g.time * 10) * 1, 0, Math.PI * 2); ctx.fillStyle = '#b14cff'; ctx.fill(); ctx.rotate(e.ang); }
      ctx.restore();
      // Status glyphs
      if (e.burn > 0) { ctx.fillStyle = Math.floor(g.time * 12) % 2 ? '#ff8c1a' : '#fcee0a'; ctx.beginPath(); ctx.arc(x + rad * 0.6, y - rad * 0.6, 3, 0, Math.PI * 2); ctx.fill(); }
      if (e.contagion > 0) { ctx.fillStyle = '#39ff14'; ctx.beginPath(); ctx.arc(x - rad * 0.6, y - rad * 0.6, 3, 0, Math.PI * 2); ctx.fill(); }
      if (e.stun > 0) { ctx.strokeStyle = '#fcee0a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, rad + 4, g.time * 6, g.time * 6 + Math.PI * 1.2); ctx.stroke(); }
      if (e.slowMul < 1 && e.stun <= 0) { ctx.strokeStyle = '#39ff14'; ctx.globalAlpha = 0.5; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, rad + 3, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
      // HP bar
      const bw = Math.max(cs * 0.6, rad * 2.2), bh = e.boss ? 5 : 3; const bx = x - bw / 2, by = y - rad - 8;
      ctx.fillStyle = COLORS.hpBack; ctx.fillRect(bx, by, bw, bh);
      const frac = Math.max(0, e.hp / e.maxHp);
      ctx.fillStyle = frac > 0.5 ? COLORS.hpFill : frac > 0.25 ? '#fcee0a' : '#ff3b3b'; ctx.fillRect(bx, by, bw * frac, bh);
      if (e.boss) { ctx.fillStyle = e.color; ctx.font = `bold ${cs * 0.22}px ${FONT.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(e.name, x, by - 2); }
    }
  }
  drawProjectiles() {
    const ctx = this.ctx, g = this.game, cs = this.cs;
    for (const p of g.projectiles) {
      const x = this.sx(p.x), y = this.sy(p.y); ctx.save(); ctx.translate(x, y); ctx.rotate(p.ang || 0);
      ctx.fillStyle = '#ff2a6d'; ctx.beginPath(); ctx.moveTo(cs * 0.18, 0); ctx.lineTo(-cs * 0.1, cs * 0.08); ctx.lineTo(-cs * 0.1, -cs * 0.08); ctx.closePath(); ctx.fill(); ctx.restore();
    }
  }
  drawZaps() {
    const ctx = this.ctx, g = this.game, cs = this.cs;
    for (const z of g.zaps) {
      const a = z.life / z.max; ctx.globalAlpha = a; ctx.strokeStyle = z.color; ctx.lineWidth = z.w;
      const x1 = this.sx(z.x1), y1 = this.sy(z.y1), x2 = this.sx(z.x2), y2 = this.sy(z.y2);
      ctx.beginPath(); ctx.moveTo(x1, y1);
      if (z.straight) ctx.lineTo(x2, y2);
      else { const segs = 6; for (let i = 1; i < segs; i++) { const t = i / segs; const nx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * cs * 0.3, ny = y1 + (y2 - y1) * t + (Math.random() - 0.5) * cs * 0.3; ctx.lineTo(nx, ny); } ctx.lineTo(x2, y2); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  drawParticles() {
    const ctx = this.ctx, g = this.game, cs = this.cs;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of g.particles) {
      const a = Math.max(0, p.life / p.max); ctx.globalAlpha = a; const x = this.sx(p.x), y = this.sy(p.y);
      if (p.type === 'ring') { ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, Math.min(p.rad, p.maxRad) * cs, 0, Math.PI * 2); ctx.stroke(); }
      else { ctx.fillStyle = p.color; ctx.fillRect(x - p.size / 2, y - p.size / 2, p.size, p.size); }
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  drawTexts() {
    const ctx = this.ctx, g = this.game, cs = this.cs;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of g.texts) { ctx.globalAlpha = Math.min(1, t.life * 2); ctx.fillStyle = t.color; ctx.font = `bold ${cs * 0.26 * t.scale}px ${FONT.ui}`; ctx.fillText(t.str, this.sx(t.x), this.sy(t.y)); }
    ctx.globalAlpha = 1;
  }
}
