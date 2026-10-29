import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polygonArea, insetPolygon, pointInPolygon, interiorPoint, segmentIntersection } from '../js/geometry.js';
import { newFloor, makeWall, makeOpening, moveJoint, clampOpening, segmentCovered } from '../js/model.js';
import { findFaces, detectRooms, syncRooms } from '../js/rooms.js';
import { roomStats, floorStats, specification, statsCSV } from '../js/calc.js';
import { roomElevations, elevationSVG } from '../js/elevations.js';
import { sampleProject } from '../js/sample.js';

const box = (f, x0, y0, x1, y1, t = 20) => {
  const pts = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % 4];
    f.walls.push(makeWall({ x: ax, y: ay }, { x: bx, y: by }, t));
  }
};

test('laukums un iekšējā kontūra', () => {
  const sq = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }];
  assert.equal(polygonArea(sq), 120000);
  const inner = insetPolygon(sq, 10);
  assert.equal(Math.round(polygonArea(inner)), 380 * 280);
  // Pretējā virzienā apgāztam daudzstūrim arī jāsaraujas uz iekšu.
  assert.equal(Math.round(polygonArea(insetPolygon([...sq].reverse(), 10))), 380 * 280);
});

test('ieliekta telpa: etiķetes punkts ir iekšpusē', () => {
  const L = [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 100 }, { x: 100, y: 100 }, { x: 100, y: 600 }, { x: 0, y: 600 }];
  assert.ok(pointInPolygon(interiorPoint(L), L));
});

test('nogriežņu krustpunkts', () => {
  const x = segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: -5 }, { x: 5, y: 5 });
  assert.deepEqual(x.point, { x: 5, y: 0 });
  assert.equal(segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 1 }, { x: 10, y: 1 }), null);
});

test('telpu noteikšana ar T un krustojuma savienojumiem un strupceļu', () => {
  const f = newFloor();
  box(f, 0, 0, 900, 700, 30);
  f.walls.push(makeWall({ x: 500, y: 0 }, { x: 500, y: 700 }, 12));
  f.walls.push(makeWall({ x: 0, y: 420 }, { x: 900, y: 420 }, 12));
  f.walls.push(makeWall({ x: 100, y: 100 }, { x: 200, y: 200 }, 12)); // brīvi stāvoša siena
  assert.equal(findFaces(f.walls).length, 4);
  const created = detectRooms(f);
  assert.equal(created.length, 4);
  const areas = f.rooms.map((r) => Math.round(polygonArea(r.points) / 100) / 100).sort((a, b) => a - b);
  // Tīrie laukumi: (500-15-6)×(420-15-6) = 4,79×3,99 utt.
  assert.deepEqual(areas, [9.82, 12.41, 15.12, 19.11]);
  assert.equal(detectRooms(f).length, 0, 'atkārtoti telpas netiek dublētas');
});

test('sienas stūra pārvietošana velk līdzi savienotās sienas un telpu', () => {
  const f = newFloor();
  box(f, 0, 0, 400, 300, 20);
  detectRooms(f);
  const before = polygonArea(f.rooms[0].points);
  moveJoint(f, { x: 400, y: 0 }, { x: 500, y: 0 });
  const touching = f.walls.filter((w) => (w.a.x === 500 && w.a.y === 0) || (w.b.x === 500 && w.b.y === 0));
  assert.equal(touching.length, 2);
  syncRooms(f);
  assert.ok(polygonArea(f.rooms[0].points) > before);
});

test('atvere paliek sienas robežās un nosegtās malas netiek dublētas', () => {
  const f = newFloor();
  const w = makeWall({ x: 0, y: 0 }, { x: 300, y: 0 });
  f.walls.push(w);
  const o = makeOpening('door', w.id, 10);
  clampOpening(o, w);
  assert.equal(o.pos, 45);
  assert.ok(segmentCovered(f, { x: 50, y: 0 }, { x: 250, y: 0 }));
  assert.ok(!segmentCovered(f, { x: 50, y: 0 }, { x: 350, y: 0 }));
});

test('telpas aprēķini: grīdlīste bez durvīm, sienas bez ailēm', () => {
  const f = newFloor();
  box(f, 0, 0, 420, 320, 20);
  detectRooms(f);
  f.openings.push(makeOpening('door', f.walls[2].id, 200, { width: 90 }));
  f.openings.push(makeOpening('window', f.walls[0].id, 200, { width: 150, height: 140 }));
  const s = roomStats(f, f.rooms[0]);
  assert.equal(s.area.toFixed(2), '12.00'); // 4,00 × 3,00
  assert.equal(s.perimeter.toFixed(2), '14.00');
  assert.equal(s.baseboard.toFixed(2), '13.10');
  assert.equal(s.wallNet.toFixed(4), (14 * 2.7 - 0.9 * 2.1 - 1.5 * 1.4).toFixed(4));
  assert.equal(s.doors, 1);
  assert.equal(s.windows, 1);
});

test('parauga projekts: 5 telpas, ~56 m², specifikācija un CSV', () => {
  const p = sampleProject();
  const f = p.floors[0];
  assert.equal(f.rooms.length, 5);
  assert.ok(f.rooms.every((r) => !r.name.startsWith('Telpa')), 'visām telpām ir nosaukumi');
  const st = floorStats(f);
  assert.ok(st.totals.area > 55 && st.totals.area < 58, `platība ${st.totals.area}`);
  assert.equal(st.totals.doors, 5);
  assert.equal(st.totals.windows, 4);
  const chairs = specification(f).find((s) => s.name === 'Krēsls' && s.w === 45);
  assert.equal(chairs.count, 6);
  const csv = statsCSV(p).split('\n');
  assert.equal(csv.length, 6);
  assert.ok(csv[1].includes('Dzīvojamā istaba'));
});

test('sienu skati: katrai telpas sienai ir skats ar ailēm', () => {
  const p = sampleProject();
  const f = p.floors[0];
  const living = f.rooms.find((r) => r.name === 'Dzīvojamā istaba');
  const els = roomElevations(f, living);
  assert.equal(els.length, 4);
  const totalOpenings = els.reduce((s, e) => s + e.openings.length, 0);
  assert.equal(totalOpenings, 4); // 2 logi + 2 durvis
  for (const e of els) {
    for (const o of e.openings) assert.ok(o.x0 >= -1 && o.x1 <= e.length + 1);
  }
  const svg = elevationSVG(els[0]);
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
});
