// Plaknes ģeometrija. Visas koordinātas ir centimetros, y ass vērsta uz leju (kā ekrānā).

export const EPS = 1e-6;

export const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const mul = (a, k) => ({ x: a.x * k, y: a.y * k });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = (a) => Math.hypot(a.x, a.y);
export const norm = (a) => {
  const l = len(a);
  return l < EPS ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const rotate = (p, deg) => {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
};

/** Parakstītais laukums (cm²). Pozitīvs, ja punkti iet pulksteņrādītāja virzienā ekrāna koordinātās. */
export function signedArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export const polygonArea = (pts) => Math.abs(signedArea(pts));

export function polygonPerimeter(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) s += dist(pts[i], pts[(i + 1) % pts.length]);
  return s;
}

export function polygonCentroid(pts) {
  const A = signedArea(pts);
  if (Math.abs(A) < EPS) {
    const n = pts.length || 1;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
  }
  let cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const f = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * f;
    cy += (a.y + b.y) * f;
  }
  return { x: cx / (6 * A), y: cy / (6 * A) };
}

/** Punkts, kas garantēti atrodas daudzstūra iekšpusē (etiķetēm ieliektām telpām). */
export function interiorPoint(pts) {
  const c = polygonCentroid(pts);
  if (pointInPolygon(c, pts)) return c;
  const ys = pts.map((p) => p.y).sort((a, b) => a - b);
  let best = c, bestW = -1;
  for (let i = 0; i < ys.length - 1; i++) {
    const y = (ys[i] + ys[i + 1]) / 2;
    const xs = [];
    for (let j = 0; j < pts.length; j++) {
      const a = pts[j], b = pts[(j + 1) % pts.length];
      if ((a.y > y) !== (b.y > y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      if (xs[k + 1] - xs[k] > bestW) {
        bestW = xs[k + 1] - xs[k];
        best = { x: (xs[k] + xs[k + 1]) / 2, y };
      }
    }
  }
  return best;
}

export function pointInPolygon(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Punkta projekcija uz nogriezni: t ∈ [0,1], projekcijas punkts un attālums. */
export function projectOnSegment(p, a, b) {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  let t = l2 < EPS ? 0 : dot(sub(p, a), ab) / l2;
  t = Math.max(0, Math.min(1, t));
  const q = lerp(a, b, t);
  return { t, point: q, dist: dist(p, q) };
}

/** Divu nogriežņu krustpunkts (ieskaitot galapunktus) vai null. */
export function segmentIntersection(a, b, c, d) {
  const r = sub(b, a), s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < EPS) return null;
  const t = cross(sub(c, a), s) / den;
  const u = cross(sub(c, a), r) / den;
  const tol = 1e-9;
  if (t < -tol || t > 1 + tol || u < -tol || u > 1 + tol) return null;
  return { point: lerp(a, b, t), t, u };
}

/** Divu bezgalīgu taišņu krustpunkts (p + t·r un q + u·s) vai null, ja paralēlas. */
export function lineIntersection(p, r, q, s) {
  const den = cross(r, s);
  if (Math.abs(den) < EPS) return null;
  const t = cross(sub(q, p), s) / den;
  return add(p, mul(r, t));
}

/**
 * Nobīda daudzstūra malas uz iekšu. `offsets[i]` ir malas i (no pts[i] uz pts[i+1]) nobīde cm.
 * Paredzēts vienkāršiem daudzstūriem (telpu tīrajam laukumam no sienu asīm).
 */
export function insetPolygon(pts, offsets) {
  const n = pts.length;
  const sign = signedArea(pts) > 0 ? 1 : -1; // pulksteņrādītāja virzienā (y uz leju) iekšpuse ir pa labi
  const lines = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const d = norm(sub(b, a));
    const inward = mul({ x: -d.y, y: d.x }, sign);
    const o = typeof offsets === 'number' ? offsets : offsets[i];
    lines.push({ p: add(a, mul(inward, o)), d });
  }
  const out = [];
  for (let i = 0; i < n; i++) {
    const prev = lines[(i - 1 + n) % n], cur = lines[i];
    const q = lineIntersection(prev.p, prev.d, cur.p, cur.d);
    out.push(q || cur.p);
  }
  return out;
}

export const round = (v, step) => Math.round(v / step) * step;

export function bounds(points) {
  if (!points.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Taisnstūra (centrs, platums, dziļums, pagrieziens) stūri. */
export function rectCorners(cx, cy, w, d, rot) {
  return [
    { x: -w / 2, y: -d / 2 },
    { x: w / 2, y: -d / 2 },
    { x: w / 2, y: d / 2 },
    { x: -w / 2, y: d / 2 },
  ].map((p) => add(rotate(p, rot), { x: cx, y: cy }));
}
