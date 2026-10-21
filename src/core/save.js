const KEY = 'ncb_save_v1';
const DEFAULT = { districts: {}, settings: { sfx: 1, music: true, tier: 'street' }, unlocked: ['watson'] };

function clone(o) { return JSON.parse(JSON.stringify(o)); }

export const Save = {
  data: clone(DEFAULT),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { ...clone(DEFAULT), ...parsed, settings: { ...DEFAULT.settings, ...(parsed.settings || {}) } };
        if (!Array.isArray(this.data.unlocked) || !this.data.unlocked.length) this.data.unlocked = ['watson'];
        const d = this.data.districts; if (!d || typeof d !== 'object' || Array.isArray(d)) this.data.districts = {};
      }
    } catch (e) { this.data = clone(DEFAULT); }
    return this.data;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ } },
  reset() { this.data = clone(DEFAULT); this.save(); },
  district(id) { return { stars: 0, bestWave: 0, won: false, plays: 0, bestScore: 0, ...(this.data.districts[id] || {}) }; },
  recordResult(id, { won, wave, stars, nextId, score = 0 }) {
    const cur = this.district(id);
    const rec = { stars: Math.max(+cur.stars || 0, won ? stars : 0), bestWave: Math.max(+cur.bestWave || 0, wave), won: !!cur.won || won, plays: (+cur.plays || 0) + 1, bestScore: Math.max(+cur.bestScore || 0, +score || 0) };
    this.data.districts[id] = rec;
    if (won && nextId && !this.data.unlocked.includes(nextId)) this.data.unlocked.push(nextId);
    this.save();
  },
  isUnlocked(id) { return this.data.unlocked.includes(id); },
  totalStars() { return Object.values(this.data.districts).reduce((s, d) => s + (d.stars || 0), 0); },
  setSetting(k, v) { this.data.settings[k] = v; this.save(); },
};
