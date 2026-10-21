import { CODES, DAEMONS } from '../data/daemons.js';

// Breach Protocol: the Cyberpunk code-matrix puzzle. Selection alternates row -> column -> row...
// Generation plants a valid path through the matrix so every offered daemon is reachable.
export class Breach {
  constructor({ size = 5, bufferLen = 7, rng, daemonPool, seconds = 35 }) {
    this.size = size; this.bufferLen = bufferLen; this.rng = rng; this.seconds = seconds;
    this.timeLeft = seconds; this.started = false; this.done = false;
    this.buffer = []; this.used = new Set(); this.last = null; this.axis = 'row'; // first pick anywhere in row 0
    this.grid = []; for (let r = 0; r < size; r++) { const row = []; for (let c = 0; c < size; c++) row.push(rng.pick(CODES)); this.grid.push(row); }
    // Plant a solution path.
    const path = []; const usedP = new Set();
    let r = 0, c = rng.int(0, size - 1); let axis = 'col';
    path.push([r, c]); usedP.add(r + ',' + c);
    for (let i = 1; i < bufferLen; i++) {
      const options = [];
      for (let k = 0; k < size; k++) {
        const nr = axis === 'col' ? k : r, nc = axis === 'col' ? c : k;
        if (!usedP.has(nr + ',' + nc)) options.push([nr, nc]);
      }
      if (!options.length) break;
      [r, c] = rng.pick(options); path.push([r, c]); usedP.add(r + ',' + c); axis = axis === 'col' ? 'row' : 'col';
    }
    const codesAlong = path.map(([pr, pc]) => this.grid[pr][pc]);
    // Choose daemons and lay their sequences along the path with small overlaps.
    // Pick 3 daemons; at most one from any exclusive group (e.g. the DATAMINE eddies family).
    let pool = daemonPool.slice();
    const chosen = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      const d = rng.weighted(pool, x => x.weight); chosen.push(d);
      pool = pool.filter(x => x !== d && !(d.group && x.group === d.group));
    }
    chosen.sort((a, b) => a.len - b.len);
    let start = 0;
    this.daemons = chosen.map(d => {
      let s = start;
      if (s + d.len > codesAlong.length) s = Math.max(0, rng.int(0, codesAlong.length - d.len));
      const seq = codesAlong.slice(s, s + d.len);
      start = s + d.len - (rng.next() < 0.6 ? 1 : 0);
      return { id: d.id, name: d.name, desc: d.desc, seq, done: false, dead: false };
    });
  }
  available() {
    const out = [];
    if (this.done || this.buffer.length >= this.bufferLen) return out;
    if (!this.last) { for (let c = 0; c < this.size; c++) if (!this.used.has('0,' + c)) out.push([0, c]); return out; }
    const [lr, lc] = this.last;
    for (let k = 0; k < this.size; k++) {
      const r = this.axis === 'col' ? k : lr, c = this.axis === 'col' ? lc : k;
      if (!this.used.has(r + ',' + c)) out.push([r, c]);
    }
    return out;
  }
  pick(r, c) {
    if (this.done) return false;
    const ok = this.available().some(([ar, ac]) => ar === r && ac === c);
    if (!ok) return false;
    this.started = true;
    this.buffer.push(this.grid[r][c]); this.used.add(r + ',' + c); this.last = [r, c];
    this.axis = this.axis === 'col' ? 'row' : 'col';
    this.evaluate();
    if (this.buffer.length >= this.bufferLen || !this.available().length || this.daemons.every(d => d.done || d.dead)) this.done = true;
    return true;
  }
  // How many chars of daemon seq are matched at the END of the buffer (longest suffix/prefix match).
  partial(seq) {
    const b = this.buffer;
    for (let n = Math.min(seq.length - 1, b.length); n > 0; n--) {
      let m = true; for (let i = 0; i < n; i++) if (b[b.length - n + i] !== seq[i]) { m = false; break; }
      if (m) return n;
    }
    return 0;
  }
  evaluate() {
    const b = this.buffer;
    for (const d of this.daemons) {
      if (d.done || d.dead) continue;
      for (let s = 0; s + d.seq.length <= b.length; s++) {
        let m = true; for (let i = 0; i < d.seq.length; i++) if (b[s + i] !== d.seq[i]) { m = false; break; }
        if (m) { d.done = true; break; }
      }
      if (!d.done) {
        const need = d.seq.length - this.partial(d.seq);
        if (need > this.bufferLen - b.length) d.dead = true;
      }
    }
  }
  tick(dt) {
    if (!this.started || this.done) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.done = true; for (const d of this.daemons) if (!d.done) d.dead = true; }
  }
  completed() { return this.daemons.filter(d => d.done); }
}

export function daemonPoolFor(state) {
  return Object.values(DAEMONS).filter(d => !(d.once && state.uploadedOnce.has(d.id)));
}
