// Design tokens: single source of truth for the neon palette, typography and timing.
// Rendering code and CSS both derive from these so the look is reskinnable in one place.
export const COLORS = {
  bg: '#06060d',
  bg2: '#0c0c18',
  grid: 'rgba(0, 240, 255, 0.06)',
  road: '#15131f',
  roadEdge: 'rgba(0, 240, 255, 0.55)',
  roadAlt: 'rgba(255, 42, 109, 0.35)',
  cyan: '#00f0ff',
  pink: '#ff2a6d',
  yellow: '#fcee0a',
  purple: '#b14cff',
  green: '#39ff14',
  orange: '#ff8c1a',
  red: '#ff3b3b',
  white: '#f4f4ff',
  dim: '#5a5a7a',
  offline: '#ff3b3b',
  firewall: 'rgba(57, 255, 20, 0.12)',
  hpBack: 'rgba(0,0,0,0.6)',
  hpFill: '#39ff14',
  hpArmor: '#fcee0a',
};

export const FACTION = {
  scav: '#ff3b3b', maelstrom: '#ff2a6d', tyger: '#fcee0a', sixth: '#ff8c1a', valentino: '#fcee0a',
  voodoo: '#b14cff', arasaka: '#ff2a6d', militech: '#00f0ff', animals: '#39ff14', wraith: '#ff8c1a', drone: '#00f0ff',
};

export const FONT = {
  ui: '"Rajdhani", "Orbitron", "Avenir Next Condensed", "Helvetica Neue", Arial, sans-serif',
  mono: '"SF Mono", Menlo, Consolas, monospace',
};

export const GRID = { cols: 9, rows: 14 };

export const TIMING = {
  toast: 2200,
  breachSeconds: 35,
  waveGap: 1.4,
};
