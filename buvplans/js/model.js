// Projekta datu modelis un stāvoklis ar atsaukšanu.
import { dist, sub, norm, add, mul, dot, cross, len, projectOnSegment } from './geometry.js';

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
    wires: [],
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
    this.touch();
  }

  select(sel) {
    this.selection = sel;
    this.emit('select');
  }

  setFloor(id) {
    this.floorId = id;
    this.selection = null;
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
