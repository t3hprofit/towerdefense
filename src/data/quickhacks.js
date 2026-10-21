// Quickhacks cost RAM and target an enemy (or a tower for PURGE).
export const QUICKHACKS = {
  short:    { id: 'short',    name: 'SHORT CIRCUIT', glyph: '⚡', cost: 4, color: '#00f0ff', target: 'enemy',
              desc: 'Instant 90 damage. Double vs mechs and drones. Ignores armor.' },
  overheat: { id: 'overheat', name: 'OVERHEAT',      glyph: '♨', cost: 3, color: '#ff8c1a', target: 'enemy',
              desc: 'Sets target ablaze: 18 dmg/s for 6s. Organics burn 50% hotter.' },
  reboot:   { id: 'reboot',   name: 'REBOOT OPTICS', glyph: '◎', cost: 3, color: '#fcee0a', target: 'enemy',
              desc: 'Blinds target. Slowed 70% for 4s.' },
  malfunc:  { id: 'malfunc',  name: 'CYBERWARE MALFUNCTION', glyph: '✖', cost: 5, color: '#ff2a6d', target: 'enemy',
              desc: 'Stuns target for 3s (bosses 1s). Netrunners drop their hack.' },
  contagion:{ id: 'contagion',name: 'CONTAGION',     glyph: '☣', cost: 6, color: '#39ff14', target: 'enemy',
              desc: 'Viral DoT: 10 dmg/s for 7s. Spreads to nearby enemies every second.' },
  purge:    { id: 'purge',    name: 'PURGE',         glyph: '⟳', cost: 2, color: '#b14cff', target: 'tower',
              desc: 'Restore a hacked tower to ONLINE instantly. Tap an offline tower.' },
};
export const HACK_ORDER = ['short', 'overheat', 'reboot', 'malfunc', 'contagion', 'purge'];
