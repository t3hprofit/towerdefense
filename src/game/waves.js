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
  const groups = [];
  let left = budget; let guard = 0;
  while (left > 0 && guard++ < 30) {
    const pick = rng.weighted(roster, e => e.weight * (ENEMIES[e.type].hacker ? 0.8 : 1));
    const def = ENEMIES[pick.type];
    const maxCount = Math.max(1, Math.floor(left / def.pts));
    let count = Math.min(maxCount, rng.int(2, 6));
    if (def.pts >= 6) count = Math.min(count, 2);
    if (def.hacker) count = Math.min(count, 2 + Math.floor(wave / 4));
    groups.push({ type: pick.type, count, interval: def.speed > 1.5 ? 0.45 : def.pts >= 6 ? 1.3 : 0.75, hpMult });
    left -= count * def.pts;
  }
  if (isBoss) {
    groups.splice(Math.floor(groups.length / 2), 0, { type: district.boss, count: 1, interval: 1, hpMult: diff * 0.75 * tier.hp, boss: true });
  }
  // ICE shields: from wave 4 a rising share of non-boss enemies spawn shielded; bosses always are.
  const iceChance = wave >= 4 ? Math.min(0.6, (0.08 + 0.05 * (wave - 4)) * tier.ice) : 0;
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
