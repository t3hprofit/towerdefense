// Persistent progress. Unlocks, stars, best wave and best score are tracked per difficulty tier.
const KEY = 'ncb_save_v1';
const DEFAULT = { tiers: {}, settings: { sfx: 1, music: true, tier: 'street' } };
// Saves written before per-tier tracking had one `districts` map and one `unlocked` list.
// Those were earned on the two tiers the game was tuned on; the top two start fresh.
const LEGACY_TIERS = ['street', 'netrunner'];

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function freshTier() { return { unlocked: ['watson'], districts: {} }; }
function sanitizeTier(t) {
  const out = freshTier();
  if (t && typeof t === 'object') {
    if (Array.isArray(t.unlocked) && t.unlocked.length) out.unlocked = t.unlocked.filter(x => typeof x === 'string');
    if (!out.unlocked.includes('watson')) out.unlocked.unshift('watson');
    if (t.districts && typeof t.districts === 'object' && !Array.isArray(t.districts)) out.districts = t.districts;
  }
  return out;
}

export const Save = {
  data: clone(DEFAULT),
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.data = { tiers: {}, settings: { ...DEFAULT.settings, ...(parsed.settings || {}) } };
        if (parsed.tiers && typeof parsed.tiers === 'object') for (const [k, v] of Object.entries(parsed.tiers)) this.data.tiers[k] = sanitizeTier(v);
        if (parsed.districts || parsed.unlocked) {
          const legacy = sanitizeTier({ unlocked: parsed.unlocked, districts: parsed.districts });
          for (const id of LEGACY_TIERS) if (!this.data.tiers[id]) this.data.tiers[id] = clone(legacy);
          this.save();
        }
      }
    } catch (e) { this.data = clone(DEFAULT); }
    return this.data;
  },
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* private mode */ } },
  reset() { this.data = clone(DEFAULT); this.save(); },
  currentTier() { return this.data.settings.tier || 'street'; },
  tierData(tier = this.currentTier()) { return this.data.tiers[tier] || (this.data.tiers[tier] = freshTier()); },
  district(id, tier = this.currentTier()) { return { stars: 0, bestWave: 0, won: false, plays: 0, bestScore: 0, ...(this.tierData(tier).districts[id] || {}) }; },
  recordResult(id, { won, wave, stars, nextId, score = 0, tier = this.currentTier() }) {
    const td = this.tierData(tier); const cur = this.district(id, tier);
    td.districts[id] = { stars: Math.max(+cur.stars || 0, won ? stars : 0), bestWave: Math.max(+cur.bestWave || 0, wave), won: !!cur.won || won, plays: (+cur.plays || 0) + 1, bestScore: Math.max(+cur.bestScore || 0, +score || 0) };
    if (won && nextId && !td.unlocked.includes(nextId)) td.unlocked.push(nextId);
    this.save();
  },
  isUnlocked(id, tier = this.currentTier()) { return this.tierData(tier).unlocked.includes(id); },
  totalStars(tier = this.currentTier()) { return Object.values(this.tierData(tier).districts).reduce((s, d) => s + (d.stars || 0), 0); },
  setSetting(k, v) { this.data.settings[k] = v; this.save(); },
};
