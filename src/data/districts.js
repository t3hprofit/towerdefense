// District (level) definitions. Grid is 9 cols x 14 rows. Routes are waypoint lists in cell coords;
// the first and last waypoints sit off-grid so enemies walk in and out of frame.
// routeMode: 'switch' = one active route, REROUTE access point toggles it. 'all' = spawns alternate between routes.
// roster entries: { type, from (wave), weight }.
export const DISTRICTS = [
  {
    id: 'watson', num: 1, name: 'WATSON', sub: 'Kabuki · Northside', color: '#00f0ff', accent: '#ff2a6d',
    desc: 'Scav chop-shops and Maelstrom bikers. A good place to learn which end of the turret points at the enemy.',
    difficulty: 1.45, waves: 10, startEddies: 280, routeMode: 'switch',
    routes: [
      [[-1,1],[6,1],[6,5],[2,5],[2,9],[6,9],[6,14]],
    ],
    blocked: [[8,0],[8,1],[0,5],[0,6],[8,12],[8,13],[4,0],[4,12],[8,7]],
    accessPoints: [
      { id: 'trap1', type: 'TRAP', c: 4, r: 3, name: 'VENDING MACHINE', radius: 2.0, dmg: 140, cost: 5, cooldown: 30 },
      { id: 'door1', type: 'DOOR', c: 2, r: 7, name: 'SERVICE GATE', duration: 4, cost: 3, cooldown: 24 },
    ],
    roster: [
      { type: 'scav', from: 1, weight: 5 }, { type: 'maelstrom', from: 3, weight: 2 },
      { type: 'drone', from: 2, weight: 2 }, { type: 'netrunner', from: 4, weight: 1.2 },
    ],
    boss: 'royce',
    hints: true,
  },
  {
    id: 'westbrook', num: 2, name: 'WESTBROOK', sub: 'Japantown · Charter Hill', color: '#fcee0a', accent: '#ff2a6d',
    desc: 'Tyger Claws move fast. The traffic control node can send them the long way around the pagoda.',
    difficulty: 0.95, waves: 10, startEddies: 340, routeMode: 'switch',
    routes: [
      [[4,-1],[4,2],[7,2],[7,9],[4,9],[4,14]],
      [[4,-1],[4,2],[1,2],[1,6],[6,6],[6,8],[1,8],[1,12],[4,12],[4,14]],
    ],
    blocked: [[0,0],[8,0],[0,13],[8,13],[8,12],[2,4],[8,4],[0,9]],
    accessPoints: [
      { id: 'reroute', type: 'REROUTE', c: 8, r: 1, name: 'TRAFFIC CONTROL', cost: 6, cooldown: 12 },
      { id: 'turret1', type: 'TURRET', c: 4, r: 5, name: 'ARASAKA TURRET', duration: 20, dmg: 22, rate: 4, range: 2.8, cost: 5, cooldown: 40 },
    ],
    roster: [
      { type: 'tyger', from: 1, weight: 5 }, { type: 'drone', from: 2, weight: 2 },
      { type: 'ronin', from: 4, weight: 2 }, { type: 'netrunner', from: 3, weight: 1.5 }, { type: 'scav', from: 1, weight: 2 },
    ],
    boss: 'oni',
  },
  {
    id: 'heywood', num: 3, name: 'HEYWOOD', sub: 'Vista del Rey · The Glen', color: '#ff8c1a', accent: '#fcee0a',
    desc: 'Valentinos and 6th Street trade bullets in the barrio. Heavies and trucks shrug off small arms.',
    difficulty: 1.15, waves: 10, startEddies: 380, routeMode: 'switch',
    routes: [
      [[9,1],[2,1],[2,4],[6,4],[6,7],[2,7],[2,10],[6,10],[6,14]],
    ],
    blocked: [[0,0],[0,1],[0,12],[0,13],[8,6],[8,7],[8,12],[4,13],[0,6]],
    accessPoints: [
      { id: 'door', type: 'DOOR', c: 4, r: 4, name: 'BLAST DOOR', duration: 4.5, cost: 3, cooldown: 22 },
      { id: 'trap', type: 'TRAP', c: 4, r: 6, name: 'GAS MAIN', radius: 2.2, dmg: 220, cost: 5, cooldown: 28 },
      { id: 'turret', type: 'TURRET', c: 8, r: 9, name: 'NCPD TURRET', duration: 20, dmg: 26, rate: 4, range: 3.0, cost: 5, cooldown: 40 },
    ],
    roster: [
      { type: 'valentino', from: 1, weight: 5 }, { type: 'sixer', from: 3, weight: 2.5 },
      { type: 'truck', from: 5, weight: 1.2 }, { type: 'netrunner', from: 2, weight: 1.5 }, { type: 'drone', from: 4, weight: 1.5 },
    ],
    boss: 'warwagon',
  },
  {
    id: 'santo', num: 4, name: 'SANTO DOMINGO', sub: 'Arroyo · Rancho Coronado', color: '#39ff14', accent: '#ff8c1a',
    desc: 'Militech is field-testing mechs in the factory district. Two entrances, one exit. Arc Nodes earn their keep.',
    difficulty: 1.25, waves: 10, startEddies: 420, routeMode: 'all',
    routes: [
      [[-1,3],[3,3],[3,9],[8,9],[8,12],[4,12],[4,14]],
      [[9,3],[5,3],[5,9],[8,9],[8,12],[4,12],[4,14]],
    ],
    blocked: [[0,0],[8,0],[0,12],[0,13],[1,13],[8,13],[4,0],[4,1],[0,8]],
    accessPoints: [
      { id: 'trap', type: 'TRAP', c: 6, r: 10, name: 'COOLANT TANK', radius: 2.2, dmg: 300, cost: 5, cooldown: 26 },
      { id: 'door', type: 'DOOR', c: 8, r: 11, name: 'LOADING GATE', duration: 5, cost: 3, cooldown: 22 },
      { id: 'turret', type: 'TURRET', c: 1, r: 11, name: 'MILITECH TURRET', duration: 22, dmg: 34, rate: 4, range: 3.2, cost: 5, cooldown: 40 },
    ],
    roster: [
      { type: 'scav', from: 1, weight: 3 }, { type: 'drone', from: 1, weight: 3 }, { type: 'mech', from: 3, weight: 1.6 },
      { type: 'netrunner', from: 2, weight: 1.5 }, { type: 'sixer', from: 4, weight: 1.5 },
    ],
    boss: 'minotaur',
  },
  {
    id: 'pacifica', num: 5, name: 'PACIFICA', sub: 'Coastview · Grand Imperial Mall', color: '#b14cff', accent: '#00f0ff',
    desc: 'Voodoo Boys own the net here. Their netrunners will strip your towers offline unless you bring ICE.',
    difficulty: 1.0, waves: 10, startEddies: 480, routeMode: 'switch',
    routes: [
      [[4,-1],[4,4],[1,4],[1,10],[7,10],[7,14]],
      [[4,-1],[4,4],[7,4],[7,7],[2,7],[2,12],[7,12],[7,14]],
    ],
    blocked: [[0,0],[8,0],[0,13],[0,12],[8,13],[8,8],[0,2],[8,2]],
    accessPoints: [
      { id: 'reroute', type: 'REROUTE', c: 8, r: 1, name: 'MALL SECURITY', cost: 6, cooldown: 12 },
      { id: 'door', type: 'DOOR', c: 4, r: 2, name: 'CHECKPOINT', duration: 4.5, cost: 3, cooldown: 22 },
      { id: 'turret', type: 'TURRET', c: 5, r: 6, name: 'ROGUE TURRET', duration: 22, dmg: 40, rate: 4, range: 3.0, cost: 5, cooldown: 40 },
    ],
    roster: [
      { type: 'animal', from: 1, weight: 3 }, { type: 'netrunner', from: 2, weight: 2 }, { type: 'vdbrunner', from: 4, weight: 2 },
      { type: 'drone', from: 2, weight: 2 }, { type: 'scav', from: 1, weight: 3 },
    ],
    boss: 'placide',
  },
  {
    id: 'center', num: 6, name: 'CITY CENTER', sub: 'Corpo Plaza · Arasaka Tower', color: '#ff2a6d', accent: '#fcee0a',
    desc: 'Arasaka wants its tower back. Troopers, runners, mechs, and the one they call Smasher.',
    difficulty: 1.0, waves: 10, startEddies: 540, routeMode: 'all',
    routes: [
      [[-1,1],[4,1],[4,6],[1,6],[1,12],[4,12],[4,14]],
      [[9,1],[6,1],[6,6],[4,6],[1,6],[1,12],[4,12],[4,14]],
    ],
    blocked: [[0,13],[8,13],[8,12],[0,3],[8,3],[7,8],[8,8],[6,10],[7,10]],
    accessPoints: [
      { id: 'trap', type: 'TRAP', c: 2, r: 9, name: 'POWER RELAY', radius: 2.4, dmg: 450, cost: 5, cooldown: 26 },
      { id: 'door', type: 'DOOR', c: 1, r: 9, name: 'SECURITY DOOR', duration: 5, cost: 3, cooldown: 22 },
      { id: 'turret', type: 'TURRET', c: 7, r: 9, name: 'ARASAKA TURRET', duration: 24, dmg: 48, rate: 4.5, range: 3.4, cost: 5, cooldown: 40 },
    ],
    roster: [
      { type: 'trooper', from: 1, weight: 4 }, { type: 'akrunner', from: 2, weight: 2 }, { type: 'mech', from: 3, weight: 1.6 },
      { type: 'drone', from: 1, weight: 2 }, { type: 'ronin', from: 4, weight: 1.5 },
    ],
    boss: 'smasher',
  },
];

export function districtById(id) { return DISTRICTS.find(d => d.id === id); }
