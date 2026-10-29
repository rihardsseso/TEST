// Telpu noteikšana no sienām: slēgtie sienu asu kontūri kļūst par telpām.
import {
  dist, segmentIntersection, projectOnSegment, signedArea, insetPolygon, polygonArea,
  pointInPolygon, interiorPoint,
} from './geometry.js';
import { uid } from './model.js';

// Nojaucamās sienas telpas neveido — telpas atbilst situācijai pēc remonta.
const liveWalls = (floor) => floor.walls.filter((w) => w.status !== 'demolish');

const key = (p) => `${Math.round(p.x * 2)}:${Math.round(p.y * 2)}`;

/** Sadala sienu asis krustpunktos un T savienojumos; atgriež grafa malas ar atsauci uz sienu. */
function splitWalls(walls) {
  const cuts = walls.map((w) => [0, 1]);
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i], b = walls[j];
      const x = segmentIntersection(a.a, a.b, b.a, b.b);
      if (x) {
        cuts[i].push(x.t);
        cuts[j].push(x.u);
        continue;
      }
      // Paralēlas / kolineāras sienas: galapunkti, kas guļ uz otras sienas.
      for (const [w, k, other] of [[a, i, b], [b, j, a]]) {
        for (const p of [other.a, other.b]) {
          const pr = projectOnSegment(p, w.a, w.b);
          if (pr.dist < 0.5) cuts[k].push(pr.t);
        }
      }
    }
  }
  const edges = [];
  walls.forEach((w, i) => {
    const ts = [...new Set(cuts[i].map((t) => Math.round(t * 1e6) / 1e6))].sort((x, y) => x - y);
    for (let k = 0; k + 1 < ts.length; k++) {
      const p = { x: w.a.x + (w.b.x - w.a.x) * ts[k], y: w.a.y + (w.b.y - w.a.y) * ts[k] };
      const q = { x: w.a.x + (w.b.x - w.a.x) * ts[k + 1], y: w.a.y + (w.b.y - w.a.y) * ts[k + 1] };
      if (dist(p, q) > 1) edges.push({ p, q, wall: w });
    }
  });
  return edges;
}

/** Atrod visus minimālos slēgtos kontūrus (plakna grafa skaldnes). */
export function findFaces(walls) {
  const edges = splitWalls(walls);
  const nodes = new Map();
  const node = (p) => {
    const k = key(p);
    if (!nodes.has(k)) nodes.set(k, { k, p, out: [] });
    return nodes.get(k);
  };
  const seen = new Set();
  for (const e of edges) {
    const u = node(e.p), v = node(e.q);
    if (u === v) continue;
    const ek = u.k < v.k ? `${u.k}|${v.k}` : `${v.k}|${u.k}`;
    if (seen.has(ek)) continue;
    seen.add(ek);
    u.out.push({ to: v, wall: e.wall });
    v.out.push({ to: u, wall: e.wall });
  }
  // Noņem strupceļus (sienas, kas neveido kontūru).
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes.values()) {
      if (n.out.length === 1) {
        const other = n.out[0].to;
        other.out = other.out.filter((h) => h.to !== n);
        n.out = [];
        changed = true;
      }
    }
  }
  for (const n of nodes.values()) {
    n.out.sort((a, b) => Math.atan2(a.to.p.y - n.p.y, a.to.p.x - n.p.x) - Math.atan2(b.to.p.y - n.p.y, b.to.p.x - n.p.x));
  }
  const used = new Set();
  const faces = [];
  for (const n of nodes.values()) {
    for (const h of n.out) {
      const hk = `${n.k}>${h.to.k}`;
      if (used.has(hk)) continue;
      const pts = [], wallsOf = [];
      let u = n, he = h, guard = 0;
      while (guard++ < 10000) {
        const k = `${u.k}>${he.to.k}`;
        if (used.has(k)) break;
        used.add(k);
        pts.push(u.p);
        wallsOf.push(he.wall);
        const v = he.to;
        // Nākamā mala: pirms atpakaļceļa malas leņķiskajā kārtībā (vistuvākais pagrieziens).
        const back = v.out.findIndex((x) => x.to === u);
        const next = v.out[(back - 1 + v.out.length) % v.out.length];
        u = v;
        he = next;
      }
      if (pts.length >= 3) faces.push({ pts, walls: wallsOf });
    }
  }
  // Iekšējās skaldnes ir ar vienu orientāciju; ārējās kontūras — ar pretējo.
  return faces
    .map((f) => ({ ...f, area: signedArea(f.pts) }))
    .filter((f) => f.area > 5000)
    .map((f) => ({ ...f, pts: simplify(f.pts, f.walls) }));
}

/** Apvieno secīgas malas, kas ir uz vienas taisnes un pieder vienāda biezuma sienām. */
function simplify(pts, walls) {
  const n = pts.length;
  const keepPts = [], keepWalls = [];
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n], cur = pts[i], next = pts[(i + 1) % n];
    const cr = (cur.x - prev.x) * (next.y - cur.y) - (cur.y - prev.y) * (next.x - cur.x);
    const wPrev = walls[(i - 1 + n) % n], wCur = walls[i];
    const straight = Math.abs(cr) < 1e-3 * dist(prev, cur) * dist(cur, next);
    if (straight && wPrev.thickness === wCur.thickness) continue;
    keepPts.push(cur);
    keepWalls.push(wCur);
  }
  return keepPts.length >= 3 ? keepPts.map((p, i) => ({ ...p, wall: keepWalls[i] })) : pts;
}

/** Telpas tīrais (iekšējais) kontūrs no sienu ass kontūra. */
export function netOutline(face) {
  const offsets = face.pts.map((p, i) => (p.wall || face.walls[i]).thickness / 2);
  return insetPolygon(face.pts, offsets).map((p) => ({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 }));
}

/**
 * Pēc sienu pārvietošanas pielāgo esošo telpu kontūrus jaunajiem sienu kontūriem.
 * Telpa paliek tā pati (nosaukums, apdare), mainās tikai tās forma.
 */
export function syncRooms(floor) {
  const outlines = findFaces(liveWalls(floor)).map(netOutline);
  for (const r of floor.rooms) {
    const p = interiorPoint(r.points);
    const match = outlines.find((o) => pointInPolygon(p, o));
    if (match) r.points = match;
  }
}

/**
 * Pārrēķina visas telpas pēc pašreizējām sienām: esošās telpas saglabā nosaukumu un apdari,
 * telpas bez kontūra tiek noņemtas, jauniem kontūriem tiek izveidotas jaunas telpas.
 */
export function rebuildRooms(floor) {
  const outlines = findFaces(liveWalls(floor)).map(netOutline).filter((o) => polygonArea(o) >= 5000);
  const used = new Set();
  const next = [];
  let created = 0;
  for (const o of outlines) {
    // Telpa paliek tā pati (nosaukums, materiāls), ja kontūri pārklājas — arī tad, ja siena pārvietota tālu.
    const inner = interiorPoint(o);
    const old = floor.rooms.find((r) => !used.has(r.id) && pointInPolygon(interiorPoint(r.points), o))
      || floor.rooms.find((r) => !used.has(r.id) && pointInPolygon(inner, r.points));
    if (old) {
      used.add(old.id);
      next.push({ ...old, points: o });
    } else {
      created += 1;
      next.push({ id: uid(), name: `Telpa ${floor.rooms.length + created}`, points: o, floorFinish: 'parquet', wallFinish: 'paint' });
    }
  }
  const removed = floor.rooms.length - used.size;
  floor.rooms = next;
  return { created, removed };
}

const signature = (floor) => liveWalls(floor).map((w) => `${w.a.x},${w.a.y},${w.b.x},${w.b.y},${w.thickness}`).join(';');

/**
 * Grīdas (telpas) nav patstāvīgi objekti: to kontūrs vienmēr izriet no sienām.
 * Pēc katras izmaiņas, kas skar sienas, telpas tiek pārrēķinātas, saglabājot to iestatījumus.
 */
export function keepRoomsInSync(store) {
  const seen = new Map();
  store.beforeEmit = (floor) => {
    const sig = signature(floor);
    if (seen.get(floor.id) === sig) return;
    seen.set(floor.id, sig);
    rebuildRooms(floor);
  };
}

/**
 * Izveido telpas visiem slēgtajiem kontūriem, kuriem vēl nav telpas.
 * Atgriež jaunizveidoto telpu sarakstu.
 */
export function detectRooms(floor) {
  const created = [];
  let n = floor.rooms.length;
  for (const face of findFaces(liveWalls(floor))) {
    const outline = netOutline(face);
    if (polygonArea(outline) < 5000) continue;
    const inner = interiorPoint(outline);
    const exists = floor.rooms.some((r) => pointInPolygon(inner, r.points) || pointInPolygon(interiorPoint(r.points), outline));
    if (exists) continue;
    n += 1;
    const room = { id: uid(), name: `Telpa ${n}`, points: outline, floorFinish: 'parquet', wallFinish: 'paint' };
    floor.rooms.push(room);
    created.push(room);
  }
  return created;
}
