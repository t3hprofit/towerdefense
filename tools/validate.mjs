import { DISTRICTS } from '../src/data/districts.js';
import { buildRoute, distToCell } from '../src/game/path.js';
import { ENEMIES } from '../src/data/enemies.js';
import { generateWave, describeWave } from '../src/game/waves.js';
let bad = 0;
for (const d of DISTRICTS) {
  const routes = d.routes.map(w => buildRoute(w, 9, 14));
  const path = new Set(); routes.forEach(r => r.cells.forEach(k => path.add(k)));
  for (const [c, r] of d.blocked) if (path.has(c + ',' + r)) { console.log(d.id, 'blocked on path', c, r); bad++; }
  for (const ap of d.accessPoints) {
    const on = path.has(ap.c + ',' + ap.r);
    if (ap.type === 'DOOR' && !on) { console.log(d.id, 'door off path', ap.id); bad++; }
    if (ap.type !== 'DOOR' && on) { console.log(d.id, 'ap on path', ap.id); bad++; }
    if (ap.type === 'DOOR') console.log(d.id, ap.id, 'doorDist', routes.map(rt => distToCell(rt, ap.c, ap.r)));
  }
  for (const e of d.roster) if (!ENEMIES[e.type]) { console.log('unknown enemy', e.type); bad++; }
  if (!ENEMIES[d.boss]) { console.log('unknown boss', d.boss); bad++; }
  const buildable = 9 * 14 - path.size - d.blocked.length - d.accessPoints.length;
  console.log(d.id, 'routes', routes.map(r => r.length.toFixed(1)), 'pathCells', path.size, 'buildable', buildable);
  for (let w = 1; w <= d.waves; w++) { const wv = generateWave(d, w); console.log('  w' + w, describeWave(wv), '| hp×' + wv.groups[0].hpMult.toFixed(2)); }
}
console.log(bad ? 'VALIDATION FAILED ' + bad : 'VALIDATION OK');
