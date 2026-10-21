// Tower definitions. `levels[0]` is the build cost/stats, levels[1..2] are upgrades.
// kind: hitscan | rocket | chain | flame | deck
export const TOWERS = {
  smg: {
    id: 'smg', name: 'SARATOGA', brand: 'Militech SMG turret', glyph: '▲', color: '#00f0ff', kind: 'hitscan',
    desc: 'Cheap, fast single-target fire. Backbone of any defense.',
    levels: [
      { cost: 90,  dmg: 7,  rate: 5,   range: 2.6 },
      { cost: 70,  dmg: 11, rate: 6,   range: 2.8 },
      { cost: 110, dmg: 17, rate: 7.5, range: 3.0 },
    ],
    unlock: 'watson',
  },
  sniper: {
    id: 'sniper', name: 'NEKOMATA', brand: 'Tsunami tech sniper', glyph: '◆', color: '#fcee0a', kind: 'hitscan',
    desc: 'Long range, huge damage, ignores armor. Slow to cycle.',
    levels: [
      { cost: 170, dmg: 55,  rate: 0.7,  range: 4.6, pierce: true },
      { cost: 130, dmg: 95,  rate: 0.8,  range: 5.0, pierce: true },
      { cost: 200, dmg: 170, rate: 0.9,  range: 5.4, pierce: true },
    ],
    unlock: 'watson',
  },
  tesla: {
    id: 'tesla', name: 'ARC NODE', brand: 'Short-circuit emitter', glyph: '⚡', color: '#b14cff', kind: 'chain',
    desc: 'Chain lightning jumps between targets. Fries drones and mechs.',
    levels: [
      { cost: 150, dmg: 16, rate: 1.6, range: 2.4, chain: 3 },
      { cost: 120, dmg: 24, rate: 1.8, range: 2.6, chain: 4 },
      { cost: 180, dmg: 36, rate: 2.0, range: 2.8, chain: 6 },
    ],
    unlock: 'watson',
  },
  flamer: {
    id: 'flamer', name: 'THERMAL VENT', brand: 'Incendiary projector', glyph: '♨', color: '#ff8c1a', kind: 'flame',
    desc: 'Short range stream that sets everything in range on fire. Organics burn fast.',
    levels: [
      { cost: 140, dmg: 14, rate: 1, range: 1.9, burn: 4 },
      { cost: 110, dmg: 22, rate: 1, range: 2.1, burn: 6 },
      { cost: 170, dmg: 34, rate: 1, range: 2.3, burn: 8 },
    ],
    unlock: 'westbrook',
  },
  deck: {
    id: 'deck', name: 'ICE DECK', brand: 'Netrunner firewall', glyph: '◉', color: '#39ff14', kind: 'deck',
    desc: 'No weapons. Projects a firewall that blocks enemy hacks, slows enemies in range and regenerates RAM.',
    levels: [
      { cost: 190, dmg: 0, rate: 0, range: 2.2, slow: 0.25, ram: 0.35 },
      { cost: 150, dmg: 0, rate: 0, range: 2.6, slow: 0.35, ram: 0.6 },
      { cost: 220, dmg: 0, rate: 0, range: 3.0, slow: 0.45, ram: 0.9 },
    ],
    unlock: 'heywood',
  },
  rocket: {
    id: 'rocket', name: 'ARASAKA POD', brand: 'Micro-rocket launcher', glyph: '✦', color: '#ff2a6d', kind: 'rocket',
    desc: 'Slow-firing rockets with splash damage. Shreds packs.',
    levels: [
      { cost: 240, dmg: 48,  rate: 0.55, range: 3.4, splash: 1.1 },
      { cost: 180, dmg: 80,  rate: 0.65, range: 3.7, splash: 1.25 },
      { cost: 260, dmg: 130, rate: 0.75, range: 4.0, splash: 1.4 },
    ],
    unlock: 'santo',
  },
};

export const TOWER_ORDER = ['smg', 'sniper', 'tesla', 'flamer', 'deck', 'rocket'];
export const SELL_RATIO = 0.6;
