import { ENEMIES } from '../data/enemies.js';
import { makeRng, hashStr } from '../core/rng.js';

// Deterministic wave composition: same district + wave always produces the same spawn script.
// Tunables (overridable from the balance sim via globalThis.__NCB_TUNE).
const T = () => globalThis.__NCB_TUNE || {};

import { tierById } from '../data/tiers.js';

export function generateWave(district, wave, tierId = 'netrunner') {
  const tier = tierById(tierId);
  const rng = makeRng(hashStr(district.id + ':' + wave));
  const isBoss = wave === district.waves;
  const diff = (T().diffs?.[district.id] ?? district.difficulty) * (T().diffScale ?? 1);
  const budget = Math.round((9 + (T().budgetRamp ?? 4.5) * (wave - 1)) * (0.75 + 0.25 * diff) * (isBoss ? 0.6 : 1) * tier.count);
  const hpMult = diff * (1 + (T().hpRamp ?? 0.3) * (wave - 1)) * tier.hp;
  const roster = district.roster.filter(e => e.from <= wave);
  // Budget cost is health-based (60 HP = 1 point) with a small speed premium and a runner premium,
  // so every wave's total health tracks the budget curve regardless of which types are rolled.
  // (The hand-set `pts` on enemies is no longer used for budgeting.)
  const cost = (def) => (def.hp / 60) * (0.75 + 0.25 * def.speed) * (1 + def.armor / 15) * (def.hacker ? 1.3 : 1);
  const groups = [];
  let left = budget; let guard = 0;
  while (left > 0 && guard++ < 30) {
    // Only types that still fit the remaining budget: a last-second mech overshoot used to add +40%.
    const affordable = roster.filter(e => cost(ENEMIES[e.type]) <= left);
    if (!affordable.length) break;
    const pick = rng.weighted(affordable, e => e.weight * (ENEMIES[e.type].hacker ? 0.8 : 1));
    const def = ENEMIES[pick.type];
    const maxCount = Math.max(1, Math.floor(left / cost(def)));
    let count = Math.min(maxCount, rng.int(2, 6));
    if (cost(def) >= 6) count = Math.min(count, 2);
    if (def.hacker) count = Math.min(count, 2 + Math.floor(wave / 4));
    groups.push({ type: pick.type, count, interval: def.speed > 1.5 ? 0.45 : def.pts >= 6 ? 1.3 : 0.75, hpMult });
    left -= count * cost(def);
  }
  // Normalize: scale group counts so the wave's total health matches what the budget implies
  // (60 HP per point). Composition still varies with the roll; the health curve does not.
  // Effective health counts armor (an armored body soaks more tower damage than its HP says).
  {
    const eff = (def) => def.hp * (1 + def.armor / 15);
    const targetHP = budget * 60 * hpMult;
    const sum = () => groups.reduce((s, g) => s + g.count * eff(ENEMIES[g.type]) * g.hpMult, 0);
    const actual = sum();
    if (actual > 0) {
      const f = targetHP / actual;
      for (const g of groups) { const def = ENEMIES[g.type]; let c = Math.max(1, Math.round(g.count * f)); if (def.hacker) c = Math.min(c, 2 + Math.floor(wave / 4)); g.count = c; }
      // Runner caps can leave the wave light: top up the biggest non-runner group.
      const deficit = targetHP - sum(); const filler = groups.filter(g => !ENEMIES[g.type].hacker).sort((a, b) => b.count - a.count)[0];
      if (filler && deficit > 0.05 * targetHP) filler.count += Math.round(deficit / (eff(ENEMIES[filler.type]) * filler.hpMult));
    }
  }
  // Elites: rolled separately from the budget so they are rare but reliable. One per eligible wave at
  // `chance`, guaranteed on wave 9, two on the boss wave at the top tiers.
  for (const el of district.elites || []) {
    if (wave < el.from) continue;
    const n = wave === 9 ? 1 : isBoss ? (tier.hp >= 1.5 ? 2 : 0) : (rng.next() < el.chance ? 1 : 0);
    if (n) groups.splice(Math.max(1, Math.floor(groups.length / 2)), 0, { type: el.type, count: n, interval: 2, hpMult });
  }
  if (isBoss) {
    // Bosses scale by district order, not the per-map base difficulty, so each one is tougher than the last.
    const bossMult = (1.2 + 0.3 * (district.num - 1)) * tier.hp;
    groups.splice(Math.floor(groups.length / 2), 0, { type: district.boss, count: 1, interval: 1, hpMult: bossMult, boss: true });
  }
  // ICE shields: from wave 4 a rising share of non-boss enemies spawn shielded; bosses always are.
  // Shield share ramps per wave but is capped by district so early maps (no ICE Deck yet) stay RAM-feasible.
  const iceCap = Math.min(0.4, 0.22 + 0.06 * (district.num - 1));
  const iceChance = wave >= 4 ? Math.min(iceCap * Math.max(1, tier.ice), (0.08 + 0.05 * (wave - 4)) * tier.ice) : 0;
  for (const g of groups) { g.ice = []; for (let i = 0; i < g.count; i++) g.ice.push(g.boss || (!ENEMIES[g.type].hacker && rng.next() < iceChance)); }
  return { wave, groups, boss: isBoss, bonus: 40 + 12 * wave };
}

// Flatten groups into a timed spawn list.
export function scheduleWave(w) {
  const list = []; let t = 0.6;
  for (const g of w.groups) {
    for (let i = 0; i < g.count; i++) { list.push({ type: g.type, t, hpMult: g.hpMult, ice: !!(g.ice && g.ice[i]) }); t += g.interval; }
    t += 1.2;
  }
  return list;
}

export function describeWave(w) {
  const counts = {};
  for (const g of w.groups) counts[g.type] = (counts[g.type] || 0) + g.count;
  return Object.entries(counts).map(([k, n]) => `${n}× ${ENEMIES[k].name}`).join(', ');
}
