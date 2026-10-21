// Difficulty tiers. 'netrunner' is the baseline tuning; the others scale from it.
export const TIERS = {
  street:    { id: 'street',    name: 'STREET KID', color: '#39ff14', desc: 'Softer enemies, fewer of them, light ICE.', hp: 0.7, count: 0.8, speed: 1.0, ice: 0.6, bossRegen: 14, score: 1.0 },
  netrunner: { id: 'netrunner', name: 'NETRUNNER',  color: '#00f0ff', desc: 'The intended challenge. Hacking is mandatory.', hp: 1.0, count: 1.0, speed: 1.0, ice: 1.0, bossRegen: 10, score: 1.5 },
  legend:    { id: 'legend',    name: 'LEGEND',     color: '#ff2a6d', desc: 'Tougher, faster, more of everything. Shields everywhere.', hp: 1.5, count: 1.25, speed: 1.08, ice: 1.5, bossRegen: 7, score: 2.5 },
};
export const TIER_ORDER = ['street', 'netrunner', 'legend'];
export function tierById(id) { return TIERS[id] || TIERS.street; }
