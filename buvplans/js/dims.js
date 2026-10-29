// Automātiskie izmēri katrai sienas virsmai. Tie izriet tikai no sienām un ailēm,
// tāpēc nepazūd, ja telpas kontūrs nav noslēgts (piemēram, pēc sienas dzēšanas).
import { add, mul, sub, dot, cross, norm, dist, pointInPolygon, projectOnSegment, segmentIntersection } from './geometry.js';
import { wallDir, wallNormal, wallLength, wallPoint } from './model.js';

/** Vai stars no p virzienā dir trāpa kādā citā sienā. */
function rayHits(p, dir, walls, self) {
  const far = add(p, mul(dir, 1e5));
  return walls.some((o) => o !== self && segmentIntersection(p, far, o.a, o.b));
}

/** Vai sienas gals ir brīvs (tam nepieskaras neviena cita siena). */
function freeEnd(p, walls, self) {
  return !walls.some((o) => o !== self && projectOnSegment(p, o.a, o.b).dist < 0.5);
}

/** Stūra siena galā p (pieskaras un nav uz vienas taisnes) — atgriež, cik tālu sniedzas tās ārējā virsma. */
function cornerReach(p, d, walls, self) {
  let reach = 0;
  for (const o of walls) {
    if (o === self || (dist(o.a, p) > 0.5 && dist(o.b, p) > 0.5)) continue;
    const sin = Math.abs(cross(wallDir(o), d));
    if (sin > 0.2) reach = Math.max(reach, o.thickness / 2 / sin);
  }
  return reach;
}

/**
 * Izmēru dati katrai redzamajai sienas virsmai:
 * { wall, side, kind: 'inner' | 'outer', origin, dir, pieces: [[x0, …, x1], …] } —
 * `pieces` ir nepārtraukti virsmas posmi starp savienojumiem ar citām sienām, katrs sadalīts ailēs
 * (pozīcijas cm no sienas sākuma pa tās virzienu).
 */
export function wallFaceDims(floor, walls, openings = floor.openings) {
  const out = [];
  if (!walls.length) return out;
  const pts = walls.flatMap((w) => [w.a, w.b]);
  const center = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length };
  const inRoom = (p) => floor.rooms.some((r) => pointInPolygon(p, r.points));

  for (const w of walls) {
    const L = wallLength(w);
    if (L < 1) continue;
    const d = wallDir(w), n = wallNormal(w), t = w.thickness, mid = wallPoint(w, L / 2);
    const probe = (s) => add(mid, mul(n, s * (t / 2 + 6)));
    const room = { 1: inRoom(probe(1)), [-1]: inRoom(probe(-1)) };
    const hit = {};
    const hits = (s) => (hit[s] ??= rayHits(probe(s), mul(n, s), walls, w));
    const ops = openings.filter((o) => o.wallId === w.id);

    for (const s of [1, -1]) {
      // Iekšējā virsma skatās telpā vai pret citu sienu; ārējā — uz āru no ēkas.
      let kind;
      if (room[s]) kind = 'inner';
      else if (room[-s]) kind = 'outer';
      else if (hits(s)) kind = 'inner';
      else if (hits(-s)) kind = 'outer';
      else kind = dot(mul(n, s), sub(mid, center)) >= 0 ? 'outer' : 'inner';

      const nS = mul(n, s);
      const origin = add(w.a, mul(nS, t / 2));
      // Virsmas garums: brīvs gals sniedzas līdz sienas galam, ārējā virsma stūrī — līdz stūra sienas virsmai.
      const ext = (p) => (kind === 'outer' && cornerReach(p, d, walls, w)) || (freeEnd(p, walls, w) ? t / 2 : 0);
      let spans = [[-ext(w.a), L + ext(w.b)]];

      // Savienojumi ar sienām, kas šķērso šo virsmu, sadala to posmos.
      for (const o of walls) {
        if (o === w) continue;
        const da = dot(sub(o.a, origin), nS), db = dot(sub(o.b, origin), nS);
        if (Math.max(da, db) <= 0.5 || Math.min(da, db) > 0.5 || Math.abs(db - da) < 1e-9) continue;
        const sin = Math.abs(cross(wallDir(o), d));
        if (sin < 0.2) continue;
        const X = add(o.a, mul(sub(o.b, o.a), -da / (db - da)));
        const x = dot(sub(X, w.a), d);
        if (x < -t / 2 - 1 || x > L + t / 2 + 1) continue;
        const half = o.thickness / 2 / sin;
        spans = spans.flatMap(([a, b]) => [[a, Math.min(b, x - half)], [Math.max(a, x + half), b]]).filter(([a, b]) => b - a >= 2);
      }

      const pieces = spans.map(([a, b]) => {
        const marks = [a];
        for (const o of ops.slice().sort((p, q) => p.pos - q.pos)) {
          const o0 = o.pos - o.width / 2, o1 = o.pos + o.width / 2;
          if (o1 <= a + 0.5 || o0 >= b - 0.5) continue;
          if (o0 > a + 0.5) marks.push(o0);
          if (o1 < b - 0.5) marks.push(o1);
        }
        marks.push(b);
        return marks;
      });
      if (pieces.length) out.push({ wall: w, side: s, kind, origin, dir: d, normal: nS, pieces });
    }
  }
  return out;
}
