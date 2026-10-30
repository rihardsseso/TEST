// Projekta datu modelis un stāvoklis ar atsaukšanu.
import { dist, sub, norm, add, mul, dot, cross, len, projectOnSegment, rotate, pointInPolygon, bounds } from './geometry.js';

export const uid = () => Math.random().toString(36).slice(2, 10);

export const DEFAULTS = {
  wallThickness: 15,
  wallHeight: 270,
  doorWidth: 90,
  doorHeight: 210,
  windowWidth: 140,
  windowHeight: 140,
  windowSill: 85,
};

export function newFloor(name = '1. stāvs', elevation = 0, height = DEFAULTS.wallHeight) {
  const id = uid();
  return {
    id,
    group: id,
    name,
    elevation,
    height,
    variant: false,
    walls: [],
    openings: [],
    rooms: [],
    items: [],
    dims: [],
    labels: [],
    lines: [],
    zones: [],
    background: null,
  };
}

export function newProject(name = 'Jauns projekts') {
  const now = new Date().toISOString();
  return {
    id: uid(),
    version: 1,
    name,
    author: '',
    address: '',
    status: 'draft',
    folder: '',
    created: now,
    updated: now,
    floors: [newFloor()],
  };
}

export function makeWall(a, b, thickness = DEFAULTS.wallThickness, height = DEFAULTS.wallHeight) {
  return { id: uid(), a: { ...a }, b: { ...b }, thickness, height, status: 'existing' };
}

export function makeOpening(type, wallId, pos, opts = {}) {
  const door = type === 'door';
  return {
    id: uid(),
    type,
    wallId,
    pos,
    width: door ? DEFAULTS.doorWidth : DEFAULTS.windowWidth,
    height: door ? DEFAULTS.doorHeight : DEFAULTS.windowHeight,
    sill: door ? 0 : DEFAULTS.windowSill,
    hinge: false,
    swing: false,
    ...opts,
  };
}

export const wallLength = (w) => dist(w.a, w.b);
export const wallKind = (w) => w.kind || (w.thickness >= 20 ? 'bearing' : 'partition');
export const wallDir = (w) => norm(sub(w.b, w.a));
export const wallNormal = (w) => {
  const d = wallDir(w);
  return { x: -d.y, y: d.x };
};
export const wallPoint = (w, pos) => add(w.a, mul(wallDir(w), pos));
export const wallAngle = (w) => (Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x) * 180) / Math.PI;

/** Atveruma pozīcija tiek turēta sienas robežās. */
export function clampOpening(o, w) {
  const L = wallLength(w);
  const half = o.width / 2;
  o.pos = L <= o.width ? L / 2 : Math.max(half, Math.min(L - half, o.pos));
}

export function openingsOf(floor, wall) {
  return floor.openings.filter((o) => o.wallId === wall.id);
}

/** Tuvākā siena punktam (ar attālumu un pozīciju gar sienu). */
export function nearestWall(floor, p, maxDist = Infinity) {
  let best = null;
  for (const w of floor.walls) {
    const pr = projectOnSegment(p, w.a, w.b);
    if (pr.dist <= maxDist && (!best || pr.dist < best.dist)) {
      best = { wall: w, dist: pr.dist, pos: pr.t * wallLength(w), point: pr.point };
    }
  }
  return best;
}

/** Vai nogrieznis a–b jau ir nosegts ar kādu esošu sienu (tas pats virziens, abi gali uz sienas). */
export function segmentCovered(floor, a, b, tol = 1) {
  return floor.walls.some((w) => {
    const pa = projectOnSegment(a, w.a, w.b);
    const pb = projectOnSegment(b, w.a, w.b);
    return pa.dist <= tol && pb.dist <= tol;
  });
}

const STATUS = { draft: 'Melnraksts', progress: 'Procesā', done: 'Pabeigts' };
export const statusLabel = (s) => STATUS[s] || STATUS.draft;
export const STATUSES = Object.entries(STATUS);

/** Projekta stāvoklis: aktīvais stāvs, atlase, atsaukšanas vēsture. */
export class Store extends EventTarget {
  constructor(project) {
    super();
    this.load(project);
  }

  load(project) {
    this.project = project;
    this.floorId = project.floors[0].id;
    this.selection = null;
    this.multi = [];
    this.undoStack = [];
    this.redoStack = [];
    this.emit('load');
  }

  get floor() {
    return this.project.floors.find((f) => f.id === this.floorId) || this.project.floors[0];
  }

  /** Saglabā momentuzņēmumu pirms izmaiņām (vilkšanai, kas maina modeli vairākos soļos). */
  checkpoint() {
    this.undoStack.push(JSON.stringify(this.project));
    if (this.undoStack.length > 150) this.undoStack.shift();
    this.redoStack = [];
  }

  commit(fn) {
    this.checkpoint();
    fn(this.floor, this.project);
    this.touch();
  }

  touch() {
    this.project.updated = new Date().toISOString();
    this.beforeEmit?.(this.floor);
    this.emit('change');
  }

  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(JSON.stringify(this.project));
    this.restore(this.undoStack.pop());
  }

  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(JSON.stringify(this.project));
    this.restore(this.redoStack.pop());
  }

  restore(json) {
    const floorId = this.floorId;
    this.project = JSON.parse(json);
    this.floorId = this.project.floors.some((f) => f.id === floorId) ? floorId : this.project.floors[0].id;
    this.selection = null;
    this.multi = [];
    this.touch();
  }

  select(sel) {
    this.selection = sel;
    this.multi = [];
    this.emit('select');
  }

  /** Vairāku priekšmetu atlase (Shift+klikšķis, rāmis, grupa). `primary` — objekts, kura īpašības rāda panelī. */
  selectMany(ids, primary = null) {
    const list = [...new Set(ids)];
    this.multi = list.length > 1 ? list : [];
    this.selection = primary || (list.length ? { kind: 'items', id: list[list.length - 1] } : null);
    this.emit('select');
  }

  /** Atlasītie priekšmeti (vairākatlase vai viens atlasītais priekšmets). */
  selectedItems() {
    const f = this.floor;
    if (this.multi.length) return f.items.filter((it) => this.multi.includes(it.id));
    const s = this.selection;
    return s?.kind === 'items' ? f.items.filter((it) => it.id === s.id) : [];
  }

  setFloor(id) {
    this.floorId = id;
    this.selection = null;
    this.multi = [];
    this.emit('floor');
  }

  /** Atlasītais objekts aktīvajā stāvā vai null. */
  selected() {
    const s = this.selection;
    if (!s) return null;
    const list = this.floor[s.kind];
    return list ? list.find((x) => x.id === s.id) || null : null;
  }

  deleteSelected() {
    const s = this.selection;
    if (this.multi.length) {
      const ids = new Set(this.multi);
      this.commit((f) => { f.items = f.items.filter((x) => !ids.has(x.id)); });
      this.select(null);
      return;
    }
    // Grīda izriet no sienām — to nevar izdzēst atsevišķi.
    if (!s || s.kind === 'rooms') return;
    this.commit((f) => {
      f[s.kind] = f[s.kind].filter((x) => x.id !== s.id);
      if (s.kind === 'walls') f.openings = f.openings.filter((o) => o.wallId !== s.id);
    });
    this.select(null);
  }

  emit(type) {
    this.dispatchEvent(new Event(type));
    if (type !== 'change') this.dispatchEvent(new Event('change'));
  }
}

/**
 * Pārvieto sienas galapunktu un līdzi velk citu sienu galus, kas tajā pašā vietā (savienojumi paliek).
 * `from` ir sākotnējais punkts, `to` jaunais.
 */
export function moveJoint(floor, from, to, tol = 0.5) {
  for (const w of floor.walls) {
    if (dist(w.a, from) <= tol) w.a = { ...to };
    if (dist(w.b, from) <= tol) w.b = { ...to };
  }
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (w) clampOpening(o, w);
  }
}

/** Sienu ģeometrijas momentuzņēmums pirms izmaiņām (followHosts vajadzībām). */
export function snapshotWalls(floor) {
  return new Map(floor.walls.map((w) => [w.id, { a: { ...w.a }, b: { ...w.b } }]));
}

/**
 * Pēc sienu (parasti ārsienu) garuma vai leņķa maiņas tām piestiprinātās iekšsienas (T savienojumi)
 * un ailes seko līdzi, saglabājot attālumu līdz tuvākajam sienas galam. Ja iekšsiena pārvietojas sāniski,
 * tā tiek pārbīdīta paralēli kopā ar tai pievienotajām sienām, nevis sašķiebta.
 */
export function followHosts(floor, before) {
  // Pārbīdītām sienām var būt savas piestiprinātās sienas — atkārto, līdz viss ir savās vietās.
  let prev = before;
  for (let i = 0; i < 6; i++) {
    const snap = snapshotWalls(floor);
    if (!followPass(floor, prev, i === 0)) break;
    prev = snap;
  }
}

function followPass(floor, before, userPass) {
  const moves = new Map();
  for (const h of floor.walls) {
    const old = before.get(h.id);
    if (!old || (dist(old.a, h.a) < 0.01 && dist(old.b, h.b) < 0.01)) continue;
    const oldL = dist(old.a, old.b), newL = wallLength(h);
    if (oldL < 1 || newL < 1) continue;
    const nd = wallDir(h);
    for (const o of floor.openings) {
      if (o.wallId === h.id && o.pos > oldL / 2) o.pos = newL - (oldL - o.pos);
    }
    for (const w of floor.walls) {
      if (w === h) continue;
      const ow = before.get(w.id);
      for (const end of ['a', 'b']) {
        // Pirmajā piegājienā lietotāja pārvietotos galus neaiztiek; vēlāk skatās pašreizējo stāvokli.
        if (userPass && ow && dist(w[end], ow[end]) > 0.01) continue;
        const p = w[end];
        const pr = projectOnSegment(p, old.a, old.b);
        if (pr.dist > 0.5) continue;
        const along = pr.t * oldL, fromB = oldL - along;
        if (along < 0.5 || fromB < 0.5) continue; // stūra savienojums — to pārvieto moveJoint
        // Lietotāja mainītai sienai saglabā attālumu līdz tuvākajam galam; līdzi pabīdītai — tikai projicē uz jauno līniju.
        const target = !userPass ? projectOnSegment(p, h.a, h.b).point
          : along <= fromB ? add(h.a, mul(nd, Math.min(along, newL))) : add(h.b, mul(nd, -Math.min(fromB, newL)));
        moves.set(`${Math.round(p.x * 10)}:${Math.round(p.y * 10)}`, [{ ...p }, target]);
      }
    }
  }
  const visited = new Set();
  let moved = false;
  for (const [from, to] of moves.values()) {
    if (dist(from, to) < 0.01) continue;
    shiftJoint(floor, from, to, visited);
    moved = true;
  }
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (w) clampOpening(o, w);
  }
  return moved;
}

const r2 = (p) => ({ x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 });

function shiftJoint(floor, from, to, visited) {
  to = r2(to);
  const key = (p) => `${Math.round(p.x * 10)}:${Math.round(p.y * 10)}`;
  if (visited.has(key(from)) || dist(from, to) < 0.01) return;
  // Gan sākuma, gan galamērķa punkts — lai pārbīde neatlēktu atpakaļ uz jau pārvietoto galu.
  visited.add(key(from));
  visited.add(key(to));
  const delta = sub(to, from);
  // Virziens jāņem pirms pārvietošanas, citādi sāniskā nobīde izskatītos kā sašķiebšanās.
  const attached = floor.walls
    .filter((w) => dist(w.a, from) < 0.5 || dist(w.b, from) < 0.5)
    .map((e) => {
      const other = dist(e.a, from) < 0.5 ? 'b' : 'a';
      return { e, other, d: norm(sub(e[other], from)) };
    });
  moveJoint(floor, from, to);
  for (const { e, other, d } of attached) {
    const perp = sub(delta, mul(d, dot(delta, d)));
    if (len(perp) < 0.01) continue;
    const q = { ...e[other] };
    if (canSlide(floor, q, perp)) shiftJoint(floor, q, add(q, perp), visited);
  }
}

/** Punktu var pabīdīt, ja tas nav nesošās sienas gals un slīd tikai gar paralēlām sienām. */
function canSlide(floor, q, v) {
  const vn = norm(v);
  for (const h of floor.walls) {
    const isEnd = dist(h.a, q) < 0.5 || dist(h.b, q) < 0.5;
    if (isEnd) {
      if (wallKind(h) === 'bearing') return false;
    } else if (projectOnSegment(q, h.a, h.b).dist < 0.5 && Math.abs(cross(wallDir(h), vn)) > 0.15) {
      return false;
    }
  }
  return true;
}


// ---------- priekšmetu grupas, spoguļošana, pagriešana ----------

/** Visi priekšmeti, kas ir vienā grupā ar `it` (vai tikai pats priekšmets). */
export function groupMembers(floor, it) {
  return it?.group ? floor.items.filter((x) => x.group === it.group) : it ? [it] : [];
}

export function groupItems(items) {
  const g = uid();
  for (const it of items) it.group = g;
  return g;
}

export function ungroupItems(items) {
  for (const it of items) delete it.group;
}

/** Priekšmetu centru aptverošā taisnstūra centrs. */
export function itemsCenter(items) {
  const b = bounds(items.map((it) => ({ x: it.x, y: it.y })));
  return b ? { x: b.minX + b.w / 2, y: b.minY + b.h / 2 } : { x: 0, y: 0 };
}

const normDeg = (a) => ((a % 360) + 360) % 360;
const r1 = (v) => Math.round(v * 10) / 10;

/** Pagriež priekšmetus ap kopējo centru (vienu priekšmetu — ap savu centru). */
export function rotateItems(items, deg) {
  const c = itemsCenter(items);
  for (const it of items) {
    const p = add(c, rotate(sub(it, c), deg));
    it.x = r1(p.x);
    it.y = r1(p.y);
    it.rot = normDeg((it.rot || 0) + deg);
  }
}

/** Spoguļo priekšmetus pret vertikālu asi caur kopējo centru (vienam priekšmetam — tikai simbols). */
export function mirrorItems(items) {
  if (items.length === 1) {
    items[0].mirror = !items[0].mirror;
    return;
  }
  const c = itemsCenter(items);
  for (const it of items) {
    it.x = r1(2 * c.x - it.x);
    it.rot = normDeg(-(it.rot || 0));
    it.mirror = !it.mirror;
  }
}

/** Kopijas ar jauniem id (un jaunu grupas id, ja kopēta grupa). */
export function cloneItems(items, offset = { x: 20, y: 20 }) {
  const groups = new Map();
  return items.map((it) => {
    const c = { ...JSON.parse(JSON.stringify(it)), id: uid(), x: it.x + offset.x, y: it.y + offset.y };
    if (it.group) {
      if (!groups.has(it.group)) groups.set(it.group, uid());
      c.group = groups.get(it.group);
    }
    return c;
  });
}

/** Bibliotēkas ieraksts no priekšmetiem: pozīcijas relatīvi pret centru. */
export function libraryEntry(items, name, stage) {
  const c = itemsCenter(items);
  return {
    id: uid(), name, stage,
    items: items.map((it) => {
      const { id, x, y, group, status, ...rest } = JSON.parse(JSON.stringify(it));
      return { ...rest, dx: r1(x - c.x), dy: r1(y - c.y) };
    }),
  };
}

/** Priekšmeti no bibliotēkas ieraksta, novietoti punktā p (grupēti, ja vairāki). */
export function itemsFromLibrary(entry, p, layer) {
  const g = entry.items.length > 1 ? uid() : null;
  return entry.items.map(({ dx, dy, ...rest }) => ({ ...JSON.parse(JSON.stringify(rest)), id: uid(), x: r1(p.x + dx), y: r1(p.y + dy), layer: rest.layer || layer, ...(g ? { group: g } : {}) }));
}

// ---------- ekrāni un kameras ----------

/** 16:9 ekrāna platums un augstums (cm) pēc diagonāles collās. */
export function tvSize(inches) {
  const d = inches * 2.54, k = Math.hypot(16, 9);
  return { w: r1((d * 16) / k), h: r1((d * 9) / k) };
}
export const tvDiagonal = (w) => Math.round((w * Math.hypot(16, 9)) / 16 / 2.54);

/** Kameras redzes lauka sektors: virsotne, virziens (grādi) un rādiuss (cm). Skatās uz priekšmeta priekšu (+y). */
export function cameraSector(it) {
  const dir = normDeg((it.rot || 0) + 90);
  return { x: it.x, y: it.y, dir, angle: Math.max(5, Math.min(360, it.viewAngle ?? 90)), radius: Math.max(10, (it.viewRadius ?? 5) * 100) };
}

// ---------- ūdens izvadi ----------
const WATER_GROUP_DEFAULT = {
  hot_cold_water: ['cold', 'hot'], cold_water_sewerage: ['cold', 'sewer'], cold_hot_water_sewerage: ['cold', 'hot', 'sewer'], hot_water_sewerage: ['hot', 'sewer'],
};
export const WATER_OUTPUTS = { cold: { letter: 'A', name: 'Aukstais ūdens', color: '#2f6fd6' }, hot: { letter: 'K', name: 'Karstais ūdens', color: '#d93025' }, sewer: { letter: 'N', name: 'Kanalizācija', color: '#6b6b6b' } };

/** Izvadu grupas secība (visi trīs veidi; noņemtie atzīmēti `off`). */
export function waterOrder(it) {
  const base = it.order || WATER_GROUP_DEFAULT[it.kind] || ['cold', 'hot', 'sewer'];
  return [...base, ...['cold', 'hot', 'sewer'].filter((k) => !base.includes(k))];
}
/** Redzamie izvadi secībā. */
export function waterOutputs(it) {
  const defaults = WATER_GROUP_DEFAULT[it.kind] || ['cold', 'hot', 'sewer'];
  const off = it.off || ['cold', 'hot', 'sewer'].filter((k) => !defaults.includes(k));
  return waterOrder(it).filter((k) => !off.includes(k));
}
/** Ieslēdz/izslēdz vienu izvadu (vismaz viens paliek). */
export function toggleWaterOutput(it, key) {
  const vis = waterOutputs(it);
  const off = ['cold', 'hot', 'sewer'].filter((k) => !vis.includes(k));
  if (vis.includes(key)) {
    if (vis.length <= 1) return false;
    off.push(key);
  } else off.splice(off.indexOf(key), 1);
  it.order = waterOrder(it);
  it.off = off;
  return true;
}
/** Maina redzamo izvadu secību uz pretējo. */
export function reverseWaterOutputs(it) {
  const vis = waterOutputs(it), hidden = waterOrder(it).filter((k) => !vis.includes(k));
  it.order = [...vis.reverse(), ...hidden];
  it.off = hidden;
}

// ---------- izmēri (lineāls) ----------
export function setDimLength(dm, L) {
  const d = norm(sub(dm.b, dm.a));
  if (!d.x && !d.y) return;
  dm.b = add(dm.a, mul(d, Math.max(1, L)));
}
/** Sadala izmēru `n` vienādās daļās (izmēru ķēde). */
export function splitDim(dm, n) {
  n = Math.max(2, Math.min(50, Math.round(n)));
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = add(dm.a, mul(sub(dm.b, dm.a), i / n)), b = add(dm.a, mul(sub(dm.b, dm.a), (i + 1) / n));
    out.push({ ...JSON.parse(JSON.stringify(dm)), id: i ? uid() : dm.id, a, b });
  }
  return out;
}

// ---------- tuvākais logs un attālumi līdz stūriem ----------
export function nearestWindow(floor, p, maxDist = 250) {
  let best = null;
  for (const o of floor.openings) {
    if (o.type !== 'window' || o.variant === 'opening') continue;
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (!w) continue;
    const d = wallDir(w), c = wallPoint(w, o.pos);
    const pr = projectOnSegment(p, add(c, mul(d, -o.width / 2)), add(c, mul(d, o.width / 2)));
    if (pr.dist <= maxDist && (!best || pr.dist < best.dist)) best = { opening: o, dist: pr.dist };
  }
  return best;
}
/** Loga palodzes augstums (balkona blokam — loga daļas apakša). */
export const windowSillHeight = (o) => (o.variant === 'windoor' ? o.windowSill ?? 85 : o.sill);

/**
 * Attālumi no punkta līdz tuvākās telpas malas (sienas virsmas) abiem stūriem.
 * Atgriež { q (projekcija uz malas), a, b (stūri), da, db } vai null.
 */
export function cornerDistances(floor, p, maxDist = 60) {
  let best = null;
  const consider = (a, b) => {
    const pr = projectOnSegment(p, a, b);
    if (pr.dist <= maxDist && (!best || pr.dist < best.dist)) best = { q: pr.point, a: { ...a }, b: { ...b }, dist: pr.dist };
  };
  const rooms = floor.rooms.filter((r) => r.points.length >= 3 && pointInPolygon(p, r.points));
  for (const r of rooms.length ? rooms : floor.rooms) r.points.forEach((a, i) => consider(a, r.points[(i + 1) % r.points.length]));
  if (!best) for (const w of floor.walls) if (w.kind !== 'virtual') consider(w.a, w.b);
  if (!best) return null;
  return { ...best, da: dist(best.q, best.a), db: dist(best.q, best.b) };
}

// ---------- sienu un līniju posmi ----------
/** Apvieno sienu ar kolineāru kaimiņu, ja savienojumā nav citu sienu. Atgriež true, ja izdevās. */
export function mergeWall(floor, w) {
  for (const end of ['a', 'b']) {
    const p = w[end];
    const at = floor.walls.filter((x) => x !== w && x.kind !== 'virtual' && (dist(x.a, p) < 0.5 || dist(x.b, p) < 0.5));
    if (at.length !== 1) continue;
    const o = at[0];
    if (Math.abs(cross(wallDir(w), wallDir(o))) > 0.01 || Math.abs(o.thickness - w.thickness) > 0.01) continue;
    const far = dist(o.a, p) < 0.5 ? o.b : o.a;
    const L0 = wallLength(w);
    const newA = end === 'a' ? { ...far } : { ...w.a }, newB = end === 'b' ? { ...far } : { ...w.b };
    const dirN = norm(sub(newB, newA));
    // Ailes paliek savās vietās: pārrēķina pozīcijas pret jauno sienas sākumu.
    for (const op of floor.openings) {
      if (op.wallId !== w.id && op.wallId !== o.id) continue;
      const host = op.wallId === w.id ? w : o;
      const c = wallPoint(host, op.pos);
      op.wallId = w.id;
      op.pos = dot(sub(c, newA), dirN);
    }
    w.a = newA;
    w.b = newB;
    floor.walls = floor.walls.filter((x) => x !== o);
    return wallLength(w) > L0;
  }
  return false;
}

/** Sadala lauztu līniju divās daļās garuma vidū. */
export function splitLine(ln) {
  const pts = ln.points;
  const total = pts.reduce((s, p, i) => (i ? s + dist(p, pts[i - 1]) : 0), 0);
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const L = dist(pts[i - 1], pts[i]);
    if (acc + L >= total / 2) {
      const m = add(pts[i - 1], mul(sub(pts[i], pts[i - 1]), (total / 2 - acc) / (L || 1)));
      const r = (q) => ({ x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10 });
      const first = { ...JSON.parse(JSON.stringify(ln)), points: [...pts.slice(0, i), r(m)] };
      const second = { ...JSON.parse(JSON.stringify(ln)), id: uid(), points: [r(m), ...pts.slice(i)] };
      return [first, second];
    }
    acc += L;
  }
  return [ln];
}

// ---------- grīdas seguma ieklāšana ----------
export const LAYINGS = [['straight', 'Taisna'], ['deck2', 'Ar nobīdi 1/2'], ['deck3', 'Ar nobīdi 1/3'], ['deck4', 'Ar nobīdi 1/4'], ['chaotic', 'Haotiska'], ['french', 'Franču eglīte'], ['english', 'Angļu eglīte']];

/** Seguma elementa noklusējuma izmēri pēc apdares (null — ruļļa/lējuma segumam). */
export function floorTileDefaults(fd) {
  if (!fd) return null;
  const m = /(\d+)\s*[×x]\s*(\d+)/.exec(fd.name || '');
  if (m) return { L: +m[1], W: +m[2], grout: 0.2, laying: 'straight' };
  switch (fd.pattern) {
    case 'planks': case 'deck': return { L: 120, W: 20, grout: 0, laying: 'deck3' };
    case 'parquet': return { L: 60, W: 10, grout: 0, laying: 'english' };
    case 'tiles': return { L: 60, W: 60, grout: 0.2, laying: 'straight' };
    case 'smalltiles': return { L: 15, W: 15, grout: 0.2, laying: 'straight' };
    default: return null;
  }
}

/** Elementu skaits laukumam (cm²) ar rezervi (noklusējumā 10 %). */
export function tileCount(areaCm2, L, W, grout = 0, reserve = 0.1) {
  if (!(L > 0 && W > 0) || !(areaCm2 > 0)) return 0;
  return Math.ceil(((areaCm2 / ((L + grout) * (W + grout))) * (1 + reserve)) - 1e-9);
}

const hash01 = (j) => {
  const x = Math.sin(j * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * Seguma elementi (daudzstūri pasaules koordinātās), kas nosedz daudzstūri `points`.
 * opts: { L, W, grout, angle (grādi), laying }. Atgriež null, ja elementu būtu pārāk daudz.
 */
export function tilePieces(points, { L, W, grout = 0, angle = 0, laying = 'straight', max = 9000 } = {}) {
  if (!(L > 0 && W > 0) || points.length < 3) return [];
  const anchor = points[0];
  const loc = points.map((p) => rotate(sub(p, anchor), -angle));
  const b = bounds(loc);
  const pad = Math.max(L, W) * 1.5;
  const x0 = b.minX - pad, x1 = b.minX + b.w + pad, y0 = b.minY - pad, y1 = b.minY + b.h + pad;
  const est = ((x1 - x0) * (y1 - y0)) / ((L + grout) * (W + grout));
  if (est > max) return null;
  const out = [];
  const toW = (q) => add(anchor, rotate(q, angle));
  const rect = (x, y, w, h) => out.push([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }].map(toW));
  const Lp = L + grout, Wp = W + grout;
  if (laying === 'english') {
    // Klasiskā eglīte: horizontālu un vertikālu dēlīšu „kāpnes”, joslas atkārtojas ar nobīdi (L, −L).
    const inv = (x, y) => ({ i: (x + y) / (2 * Wp), m: (x - y) / (2 * Lp) });
    const cs = [inv(x0, y0), inv(x1, y0), inv(x0, y1), inv(x1, y1)];
    const iMin = Math.floor(Math.min(...cs.map((c) => c.i))) - 2, iMax = Math.ceil(Math.max(...cs.map((c) => c.i))) + 2;
    const mMin = Math.floor(Math.min(...cs.map((c) => c.m))) - 2, mMax = Math.ceil(Math.max(...cs.map((c) => c.m))) + 2;
    for (let m = mMin; m <= mMax; m++) {
      for (let i = iMin; i <= iMax; i++) {
        const ox = i * Wp + m * Lp, oy = i * Wp - m * Lp;
        if (ox > x1 + Lp || ox < x0 - 2 * Lp || oy > y1 + Lp || oy < y0 - 2 * Lp) continue;
        rect(ox, oy, L, W);
        rect(ox + Lp, oy + Wp - Lp, W, L);
      }
    }
    return out;
  }
  if (laying === 'french') {
    // Franču eglīte: slīpi nogriezti elementi kolonnās ar mainīgu slīpumu (V raksts).
    const cw = L / Math.SQRT2, cwp = Lp / Math.SQRT2, P = Wp * Math.SQRT2, h = W * Math.SQRT2;
    for (let k = Math.floor(x0 / cwp); k * cwp < x1; k++) {
      const xa = k * cwp, s = k % 2 ? -1 : 1;
      for (let n = Math.floor((y0 - cw) / P) - 1; n * P < y1 + cw; n++) {
        const ya = n * P;
        out.push([{ x: xa, y: ya }, { x: xa + cw, y: ya + s * cw }, { x: xa + cw, y: ya + s * cw + h }, { x: xa, y: ya + h }].map(toW));
      }
    }
    return out;
  }
  const step = { deck2: 1 / 2, deck3: 1 / 3, deck4: 1 / 4 }[laying];
  for (let j = Math.floor(y0 / Wp); j * Wp < y1; j++) {
    const off = laying === 'chaotic' ? hash01(j) * Lp : step ? ((((j % Math.round(1 / step)) + Math.round(1 / step)) % Math.round(1 / step)) * step) * Lp : 0;
    for (let i = Math.floor((x0 - off) / Lp) - 1; i * Lp + off < x1; i++) rect(i * Lp + off, j * Wp, L, W);
  }
  return out;
}

/** Telpas grīdas seguma ieklāšanas parametri (null — segums nav no elementiem). */
export function roomTiling(room, fd) {
  const d = floorTileDefaults(fd);
  if (!d) return null;
  return { L: room.tileL ?? d.L, W: room.tileW ?? d.W, grout: room.grout ?? d.grout, angle: room.tileAngle || 0, laying: room.laying || d.laying };
}

/** Loga vērtņu skaits (noklusējumā pēc platuma). */
export const windowCasements = (o, width = o.width) => Math.max(1, Math.round(o.casements ?? (width >= 100 ? 2 : 1)));

/** Elektrības punkta skaits: horizontālais bloks × vertikālā grupa. */
export const pointQty = (it) => Math.max(1, Math.round(it.count || 1)) * Math.max(1, Math.round(it.vcount || 1));
