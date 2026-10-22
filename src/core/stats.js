// Lifetime "stats for nerds": totals across every run, every district and every tier. Stored only
// in localStorage (never sent anywhere, independent of the analytics choice). Fed by the same
// gameplay events as analytics via Game.trackRun, plus a few local-only ones (kills, leaks, time).
const KEY = 'ncb_stats_v1';
const SAVE_DELAY = 2000; // kills fire many times a second; batch writes

function fresh() {
  return {
    since: Date.now(), playSeconds: 0,
    runs: { started: 0, won: 0, lost: 0 }, waves: 0, bossWaves: 0, bossKills: 0, kills: 0, leaks: 0,
    bestScore: 0, bestCombo: 0, perfectClears: 0,
    towers: {}, eddiesSpent: 0, eddiesRefunded: 0,
    hacks: {}, iceBroken: 0, bossHacks: 0, purges: 0,
    breaches: 0, emptyBreaches: 0, daemons: {}, accessPoints: {},
    districts: {}, tiers: {},
  };
}

const inc = (obj, k, n = 1) => { obj[k] = (obj[k] || 0) + n; };
const sub = (obj, k, init) => obj[k] || (obj[k] = init());

let timer = null;

export const Stats = {
  data: fresh(),

  load() {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) { const d = JSON.parse(raw); const f = fresh(); this.data = { ...f, ...d, runs: { ...f.runs, ...d.runs } }; }
    } catch (e) { this.data = fresh(); }
  },
  flush() {
    if (timer) { clearTimeout(timer); timer = null; }
    try { window.localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { /* unavailable: memory only */ }
  },
  dirty() {
    if (timer || typeof window === 'undefined') return;
    timer = setTimeout(() => this.flush(), SAVE_DELAY);
  },
  reset() { this.data = fresh(); this.flush(); },

  addTime(sec) { this.data.playSeconds += sec; this.dirty(); },

  // name/params match the analytics events (see Game.trackRun); unknown names are ignored.
  record(name, p = {}) {
    const d = this.data;
    const dist = () => sub(d.districts, p.district, () => ({ plays: 0, wins: 0, bestWave: 0 }));
    const tier = () => sub(d.tiers, p.tier, () => ({ plays: 0, wins: 0 }));
    const tower = () => sub(d.towers, p.tower, () => ({ built: 0, upgraded: 0, sold: 0 }));
    switch (name) {
      case 'district_start': d.runs.started++; dist().plays++; tier().plays++; break;
      case 'district_end': {
        const ds = dist(); ds.bestWave = Math.max(ds.bestWave, p.wave || 0);
        if (p.won) { d.runs.won++; ds.wins++; tier().wins++; if (p.lives === 20) d.perfectClears++; } else d.runs.lost++;
        d.bestScore = Math.max(d.bestScore, p.score || 0); d.bestCombo = Math.max(d.bestCombo, p.combo || 0);
        this.flush(); return;
      }
      case 'wave_start': d.waves++; if (p.boss) d.bossWaves++; break;
      case 'tower_build': tower().built++; d.eddiesSpent += p.cost || 0; break;
      case 'tower_upgrade': tower().upgraded++; d.eddiesSpent += p.cost || 0; break;
      case 'tower_sell': tower().sold++; d.eddiesRefunded += p.refund || 0; break;
      case 'quickhack': inc(d.hacks, p.hack); if (p.broke_ice) d.iceBroken++; if (p.boss) d.bossHacks++; break;
      case 'purge': d.purges++; break;
      case 'daemon_upload': inc(d.daemons, p.daemon); break;
      case 'breach_end': d.breaches++; if (!p.daemons) d.emptyBreaches++; break;
      case 'access_point': inc(d.accessPoints, p.type); break;
      case 'kill': d.kills++; if (p.boss) d.bossKills++; break;
      case 'leak': d.leaks++; break;
      default: return;
    }
    this.dirty();
  },
};
