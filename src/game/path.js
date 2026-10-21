// Expands waypoint routes into walkable polylines with cumulative distances and occupied cells.
export function buildRoute(waypoints, cols, rows) {
  const pts = waypoints.map(([c, r]) => ({ x: c + 0.5, y: r + 0.5 }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  const cells = new Set();
  const cellList = [];
  for (let i = 1; i < waypoints.length; i++) {
    let [c0, r0] = waypoints[i - 1]; const [c1, r1] = waypoints[i];
    const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
    while (true) {
      if (c0 >= 0 && c0 < cols && r0 >= 0 && r0 < rows) {
        const k = c0 + ',' + r0; if (!cells.has(k)) { cells.add(k); cellList.push([c0, r0]); }
      }
      if (c0 === c1 && r0 === r1) break;
      c0 += dc; r0 += dr;
    }
  }
  return { pts, cum, length: cum[cum.length - 1], cells, cellList };
}

export function posAt(route, dist) {
  const { pts, cum } = route;
  if (dist <= 0) return { x: pts[0].x, y: pts[0].y, ang: angleOf(pts[0], pts[1]) };
  for (let i = 1; i < pts.length; i++) {
    if (dist <= cum[i]) {
      const seg = cum[i] - cum[i - 1]; const t = seg > 0 ? (dist - cum[i - 1]) / seg : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t, ang: angleOf(pts[i - 1], pts[i]) };
    }
  }
  const n = pts.length - 1;
  return { x: pts[n].x, y: pts[n].y, ang: angleOf(pts[n - 1], pts[n]) };
}
function angleOf(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }

// Distance along the route at which the centre of cell (c,r) is reached, or null if the route misses it.
export function distToCell(route, c, r) {
  const tx = c + 0.5, ty = r + 0.5; const { pts, cum } = route;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const minx = Math.min(a.x, b.x) - 1e-6, maxx = Math.max(a.x, b.x) + 1e-6;
    const miny = Math.min(a.y, b.y) - 1e-6, maxy = Math.max(a.y, b.y) + 1e-6;
    if (tx >= minx && tx <= maxx && ty >= miny && ty <= maxy) {
      return cum[i - 1] + Math.hypot(tx - a.x, ty - a.y);
    }
  }
  return null;
}
