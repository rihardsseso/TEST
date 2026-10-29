// Apjomu un izmēru aprēķini: laukumi, perimetri, sienu apjomi, grīdlīstes, specifikācija.
import { polygonArea, polygonPerimeter, pointInPolygon, add, mul } from './geometry.js';
import { wallLength, wallPoint, wallNormal } from './model.js';
import { byKind, finish, FLOOR_FINISHES, WALL_FINISHES } from './catalog.js';
import { wallMaterial, unitsPerM2 } from './walls.js';

const m2 = (cm2) => cm2 / 1e4;
const m = (cm) => cm / 100;

/** Atveri, kas robežojas ar telpu (pārbauda punktu abās sienas pusēs). */
export function roomOpenings(floor, room) {
  const res = [];
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (!w || w.status === 'demolish') continue;
    const c = wallPoint(w, o.pos), n = wallNormal(w), off = w.thickness / 2 + 2;
    if (pointInPolygon(add(c, mul(n, off)), room.points) || pointInPolygon(add(c, mul(n, -off)), room.points)) res.push(o);
  }
  return res;
}

export function roomStats(floor, room) {
  const height = room.height || floor.height;
  const area = polygonArea(room.points);
  const perimeter = polygonPerimeter(room.points);
  const ops = roomOpenings(floor, room);
  const opArea = ops.reduce((s, o) => s + o.width * o.height, 0);
  const doorW = ops.filter((o) => o.type === 'door').reduce((s, o) => s + o.width, 0);
  const sills = ops.filter((o) => o.type === 'window').reduce((s, o) => s + o.width, 0);
  const items = floor.items.filter((it) => pointInPolygon(it, room.points));
  return {
    id: room.id,
    name: room.name,
    area: m2(area),
    perimeter: m(perimeter),
    height: m(height),
    volume: m2(area) * m(height),
    wallGross: m(perimeter) * m(height),
    wallNet: m(perimeter) * m(height) - m2(opArea),
    ceiling: m2(area),
    baseboard: m(perimeter - doorW),
    windowSills: m(sills),
    doors: ops.filter((o) => o.type === 'door').length,
    windows: ops.filter((o) => o.type === 'window').length,
    sockets: items.filter((it) => byKind(it.kind)?.electric === 'socket').length,
    switches: items.filter((it) => byKind(it.kind)?.electric === 'switch').length,
    lights: items.filter((it) => byKind(it.kind)?.electric === 'light').length,
    floorFinish: finish(FLOOR_FINISHES, room.floorFinish).name,
    wallFinish: finish(WALL_FINISHES, room.wallFinish).name,
  };
}

export function floorStats(floor) {
  const rooms = floor.rooms.map((r) => roomStats(floor, r));
  let wallLen = 0, wallVol = 0, demLen = 0, demVol = 0, newLen = 0, newArea = 0;
  for (const w of floor.walls) {
    if (w.status === 'demolish') {
      demLen += wallLength(w);
      demVol += wallLength(w) * w.height * w.thickness;
      continue;
    }
    if (w.status === 'new') {
      newLen += wallLength(w);
      newArea += wallLength(w) * w.height;
    }
    const L = wallLength(w);
    wallLen += L;
    const ops = floor.openings.filter((o) => o.wallId === w.id);
    const opA = ops.reduce((s, o) => s + o.width * Math.min(o.height, w.height - o.sill), 0);
    wallVol += (L * w.height - opA) * w.thickness;
  }
  const sum = (k) => rooms.reduce((s, r) => s + r[k], 0);
  return {
    rooms,
    totals: {
      area: sum('area'),
      volume: sum('volume'),
      wallNet: sum('wallNet'),
      baseboard: sum('baseboard'),
      ceiling: sum('ceiling'),
      wallLength: m(wallLen),
      wallVolume: wallVol / 1e6,
      doors: floor.openings.filter((o) => o.type === 'door').length,
      windows: floor.openings.filter((o) => o.type === 'window').length,
      windowArea: m2(floor.openings.filter((o) => o.type === 'window').reduce((s, o) => s + o.width * o.height, 0)),
      sockets: floor.items.filter((it) => byKind(it.kind)?.electric === 'socket').length,
      switches: floor.items.filter((it) => byKind(it.kind)?.electric === 'switch').length,
      lights: floor.items.filter((it) => byKind(it.kind)?.electric === 'light').length,
      weak: floor.items.filter((it) => byKind(it.kind)?.electric === 'weak').length,
      water: floor.items.filter((it) => byKind(it.kind)?.water).length,
      demolishLength: m(demLen),
      demolishVolume: demVol / 1e6,
      newLength: m(newLen),
      newArea: m2(newArea),
      wireLength: m((floor.wires || []).reduce((s, wr) => s + wr.points.reduce((q, p, i) => (i ? q + Math.hypot(p.x - wr.points[i - 1].x, p.y - wr.points[i - 1].y) : 0), 0), 0)),
    },
  };
}

/** Sienu apjomi pa materiāliem un biezumiem (pēc remonta, bez nojaucamajām sienām). */
export function wallMaterials(floor) {
  const map = new Map();
  for (const w of floor.walls) {
    if (w.status === 'demolish') continue;
    const mat = wallMaterial(w.material);
    const k = `${w.material || ''}|${w.thickness}`;
    if (!map.has(k)) map.set(k, { name: mat?.name || 'Materiāls nav norādīts', thickness: w.thickness, length: 0, area: 0, volume: 0, units: null, perM2: unitsPerM2(mat, w.thickness) });
    const row = map.get(k);
    const L = wallLength(w);
    const opA = floor.openings.filter((o) => o.wallId === w.id).reduce((s, o) => s + o.width * Math.max(0, Math.min(o.height, w.height - o.sill)), 0);
    const area = m2(L * w.height - opA);
    row.length += m(L);
    row.area += area;
    row.volume += area * m(w.thickness);
  }
  for (const row of map.values()) if (row.perM2) row.units = Math.ceil(row.area * row.perM2);
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'lv') || b.thickness - a.thickness);
}

/** Specifikācija: vienādu priekšmetu skaits ar izmēriem. */
export function specification(floor) {
  const map = new Map();
  for (const it of floor.items) {
    const name = it.name || byKind(it.kind)?.name || it.kind;
    const k = `${name}|${it.w}|${it.d}|${it.h}`;
    if (!map.has(k)) map.set(k, { name, w: it.w, d: it.d, h: it.h, count: 0 });
    map.get(k).count += 1;
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'lv'));
}

export function openingSchedule(floor) {
  return floor.openings
    .map((o) => ({ type: o.type === 'door' ? 'Durvis' : 'Logs', width: o.width, height: o.height, sill: o.sill }))
    .sort((a, b) => a.type.localeCompare(b.type, 'lv') || b.width - a.width);
}

export const fmt = (v, d = 2) => (Number.isFinite(v) ? v.toLocaleString('lv-LV', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');

/** CSV ar visiem telpu aprēķiniem (semikols kā atdalītājs, ērti Excel/LibreOffice ar lv lokalizāciju). */
export function statsCSV(project) {
  const head = ['Stāvs', 'Telpa', 'Laukums m²', 'Perimetrs m', 'Augstums m', 'Tilpums m³', 'Sienu laukums m²', 'Grīdlīste m', 'Durvis', 'Logi', 'Rozetes', 'Slēdži', 'Gaismekļi', 'Grīda', 'Sienas'];
  const rows = [head];
  for (const f of project.floors) {
    for (const r of floorStats(f).rooms) {
      rows.push([f.name, r.name, fmt(r.area), fmt(r.perimeter), fmt(r.height), fmt(r.volume), fmt(r.wallNet), fmt(r.baseboard), r.doors, r.windows, r.sockets, r.switches, r.lights, r.floorFinish, r.wallFinish]);
    }
  }
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
}
