// Enemy definitions. speed in cells/sec, armor is flat damage reduction per hit.
// tags: organic | mech | drone | runner | boss. hacker: enemy netrunner behaviour.
export const ENEMIES = {
  scav:      { name: 'Scav',            hp: 60,   speed: 1.1,  armor: 0, reward: 8,  size: 0.26, shape: 'tri',  color: '#ff3b3b', tags: ['organic'], pts: 1 },
  maelstrom: { name: 'Maelstrom Ganger',hp: 140,  speed: 0.85, armor: 3, reward: 14, size: 0.3,  shape: 'sq',   color: '#ff2a6d', tags: ['organic'], pts: 2 },
  drone:     { name: 'Recon Drone',     hp: 45,   speed: 2.0,  armor: 0, reward: 9,  size: 0.2,  shape: 'ring', color: '#00f0ff', tags: ['drone','mech'], pts: 1.5 },
  netrunner: { name: 'Netrunner',       hp: 115,  speed: 0.9,  armor: 0, reward: 22, size: 0.27, shape: 'run',  color: '#b14cff', tags: ['organic','runner'], pts: 3,
               hacker: { range: 2.8, time: 2.8, disable: 10 } },
  tyger:     { name: 'Tyger Claw',      hp: 85,   speed: 1.6,  armor: 1, reward: 11, size: 0.26, shape: 'dia',  color: '#fcee0a', tags: ['organic'], pts: 1.6 },
  ronin:     { name: 'Cyber-Ronin',     hp: 220,  speed: 1.35, armor: 5, reward: 24, size: 0.3,  shape: 'dia',  color: '#ff8c1a', tags: ['organic'], pts: 3.2 },
  valentino: { name: 'Valentino',       hp: 110,  speed: 1.2,  armor: 1, reward: 12, size: 0.27, shape: 'tri',  color: '#fcee0a', tags: ['organic'], pts: 1.6 },
  sixer:     { name: '6th Street Heavy',hp: 320,  speed: 0.7,  armor: 8, reward: 30, size: 0.34, shape: 'sq',   color: '#ff8c1a', tags: ['organic'], pts: 4 },
  truck:     { name: 'Gang Truck',      hp: 520,  speed: 1.5,  armor: 10, reward: 45, size: 0.4, shape: 'rect', color: '#ff8c1a', tags: ['mech'], pts: 6 },
  mech:      { name: 'Militech Mech',   hp: 700,  speed: 0.55, armor: 14, reward: 60, size: 0.42, shape: 'hex', color: '#8a8aa8', tags: ['mech'], pts: 8 },
  animal:    { name: 'Animals Brute',   hp: 420,  speed: 1.0,  armor: 4, reward: 34, size: 0.36, shape: 'pent', color: '#39ff14', tags: ['organic'], pts: 4.5 },
  vdbrunner: { name: 'VDB Netrunner',   hp: 180,  speed: 1.0,  armor: 2, reward: 36, size: 0.29, shape: 'run',  color: '#b14cff', tags: ['organic','runner'], pts: 5,
               hacker: { range: 3.0, time: 2.2, disable: 12 } },
  trooper:   { name: 'Arasaka Trooper', hp: 260,  speed: 1.15, armor: 6, reward: 26, size: 0.3,  shape: 'sq',   color: '#ff2a6d', tags: ['organic'], pts: 3.5 },
  akrunner:  { name: 'Arasaka Runner',  hp: 260,  speed: 1.05, armor: 4, reward: 44, size: 0.3,  shape: 'run',  color: '#ff2a6d', tags: ['organic','runner'], pts: 6,
               hacker: { range: 3.2, time: 2.0, disable: 14 } },
  // Elite: a netrunner ridden by something from past the Blackwall. Its hacks pierce ICE Deck firewalls.
  husk:      { name: 'Blackwall Husk',  hp: 320,  speed: 0.8,  armor: 4, reward: 60, size: 0.31, shape: 'run',  color: '#f4f4ff', tags: ['organic','runner','elite'], pts: 8,
               hacker: { range: 3.4, time: 2.4, disable: 12, pierce: true } },
  // Bosses
  royce:    { name: 'ROYCE',            hp: 2600,  speed: 0.6,  armor: 10, reward: 300, size: 0.5, shape: 'sq',   color: '#ff2a6d', tags: ['organic','boss'], boss: true, title: 'Maelstrom Warlord' },
  oni:      { name: 'ONI',              hp: 2400,  speed: 1.3,  armor: 8,  reward: 320, size: 0.46, shape: 'dia', color: '#fcee0a', tags: ['organic','boss'], boss: true, title: 'Tyger Claw Blademaster' },
  warwagon: { name: 'WAR WAGON',        hp: 4200,  speed: 0.9,  armor: 18, reward: 380, size: 0.56, shape: 'rect', color: '#ff8c1a', tags: ['mech','boss'], boss: true, title: '6th Street Armored Truck' },
  minotaur: { name: 'MINOTAUR',         hp: 6500,  speed: 0.45, armor: 24, reward: 450, size: 0.6, shape: 'hex',  color: '#8a8aa8', tags: ['mech','boss'], boss: true, title: 'Militech Heavy Mech' },
  placide:  { name: 'PLACIDE',          hp: 4800,  speed: 0.75, armor: 10, reward: 500, size: 0.5, shape: 'run',  color: '#b14cff', tags: ['organic','runner','boss'], boss: true, title: 'Voodoo Boys Netrunner',
              hacker: { range: 3.6, time: 1.6, disable: 12, multi: 2 } },
  smasher:  { name: 'SMASHER',          hp: 12000, speed: 0.6,  armor: 26, reward: 1000, size: 0.62, shape: 'hex', color: '#ff2a6d', tags: ['mech','boss'], boss: true, title: 'Arasaka Full-Borg', regen: 12 },
};
