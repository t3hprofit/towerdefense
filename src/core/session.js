// Session-scoped scoring state. Stores numbers only; the rules live in game.js.
// Backed by sessionStorage with an in-memory fallback (private mode / blocked storage).
const KEY = 'ncb_session_v1';

function fresh() {
  return { runScore: 0, runDistrict: null, combo: 0, bestCombo: 0, sessionScore: 0, districtsCleared: 0, runs: 0, startedAt: Date.now() };
}
function num(v) { return Number.isFinite(v) && v >= 0 ? v : 0; }

let memRaw = null; // fallback copy of the serialized state

function readRaw() {
  try { const v = window.sessionStorage.getItem(KEY); if (v != null) return v; } catch (e) { /* unavailable */ }
  return memRaw;
}
function writeRaw(str) {
  memRaw = str;
  try { window.sessionStorage.setItem(KEY, str); } catch (e) { /* unavailable, memory copy still holds */ }
}

export const Session = {
  state: fresh(),
  load() {
    const base = fresh();
    try {
      const raw = readRaw();
      if (raw) {
        const p = JSON.parse(raw);
        this.state = {
          runScore: num(p.runScore), runDistrict: typeof p.runDistrict === 'string' ? p.runDistrict : null,
          combo: num(p.combo), bestCombo: num(p.bestCombo), sessionScore: num(p.sessionScore),
          districtsCleared: num(p.districtsCleared), runs: num(p.runs), startedAt: num(p.startedAt) || base.startedAt,
        };
        return this.state;
      }
    } catch (e) { /* corrupt, start over */ }
    this.state = base;
    return this.state;
  },
  save() { try { writeRaw(JSON.stringify(this.state)); } catch (e) { /* ignore */ } },
  reset() { this.state = fresh(); this.save(); },
  beginRun(districtId) {
    this.state.runScore = 0; this.state.combo = 0; this.state.runDistrict = districtId;
    this.save();
  },
  // Dumb accumulator: any multiplier is applied by the caller.
  add(points) {
    const p = Number.isFinite(points) ? Math.round(points) : 0;
    if (p > 0) { this.state.runScore += p; this.save(); }
  },
  endRun({ won } = {}) {
    const s = this.state;
    s.sessionScore += s.runScore; s.runs++; if (won) s.districtsCleared++;
    s.combo = 0; this.save();
  },
};
