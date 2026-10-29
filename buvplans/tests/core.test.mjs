import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polygonArea, insetPolygon, pointInPolygon, interiorPoint, segmentIntersection } from '../js/geometry.js';
import { newFloor, newProject, makeWall, makeOpening, moveJoint, clampOpening, segmentCovered, Store, snapshotWalls, followHosts } from '../js/model.js';
import { wallFaceDims } from '../js/dims.js';
import { findFaces, detectRooms, syncRooms, keepRoomsInSync } from '../js/rooms.js';
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

test('grīda seko sienām: pārvietojot vai dzēšot sienu, telpa mainās, iestatījumi paliek', () => {
  const store = new Store(newProject());
  keepRoomsInSync(store);
  store.commit((f) => box(f, 0, 0, 400, 300, 20));
  assert.equal(store.floor.rooms.length, 1);
  store.commit((f) => Object.assign(f.rooms[0], { name: 'Virtuve', floorFinish: 'tile' }));
  const before = polygonArea(store.floor.rooms[0].points);
  store.commit((f) => moveJoint(f, { x: 400, y: 0 }, { x: 600, y: 0 }));
  store.commit((f) => moveJoint(f, { x: 400, y: 300 }, { x: 600, y: 300 }));
  const room = store.floor.rooms[0];
  assert.equal(room.name, 'Virtuve');
  assert.equal(room.floorFinish, 'tile');
  assert.equal(Math.round(polygonArea(room.points) / 1e4 * 100) / 100, 5.8 * 2.8);
  assert.ok(polygonArea(room.points) > before);
  // Starpsiena sadala grīdu divās telpās; pirmā saglabā iestatījumus.
  store.commit((f) => f.walls.push(makeWall({ x: 300, y: 0 }, { x: 300, y: 300 }, 10)));
  assert.equal(store.floor.rooms.length, 2);
  assert.ok(store.floor.rooms.some((r) => r.name === 'Virtuve'));
  // Atverot kontūru, grīdas vairs nav.
  store.commit((f) => { f.walls = f.walls.filter((w) => !(w.a.x === 0 && w.b.x === 0)); });
  assert.ok(store.floor.rooms.every((r) => r.points.every((p) => p.x > 100)));
  // Atsaukšana atjauno sienas un grīdu.
  store.undo();
  assert.equal(store.floor.rooms.length, 2);
});

test('izmēri nepazūd, ja izdzēš sienu un telpa vairs nav noslēgta', () => {
  const store = new Store(newProject());
  keepRoomsInSync(store);
  store.commit((f) => box(f, 0, 0, 400, 300, 20));
  const faces = () => wallFaceDims(store.floor, store.floor.walls);
  const innerOf = (pred) => faces().filter((x) => x.kind === 'inner' && pred(x.wall)).map((x) => x.pieces.map((m) => Math.round(m[m.length - 1] - m[0])));
  const isTop = (w) => w.a.y === 0 && w.b.y === 0;
  assert.deepEqual(innerOf(isTop), [[380]]);
  // Izdzēš labo sienu: telpas vairs nav, bet augšējai un kreisajai sienai izmēri paliek.
  store.commit((f) => { f.walls = f.walls.filter((w) => !(w.a.x === 400 && w.b.x === 400)); });
  assert.equal(store.floor.rooms.length, 0);
  assert.deepEqual(innerOf(isTop), [[400]]); // no kreisās sienas virsmas līdz brīvajam galam
  assert.deepEqual(innerOf((w) => w.a.x === 0 && w.b.x === 0), [[280]]);
  const outerTop = faces().find((x) => x.kind === 'outer' && isTop(x.wall));
  assert.equal(Math.round(outerTop.pieces[0].at(-1) - outerTop.pieces[0][0]), 420);
});

test('mainot ārsienas garumu, iekšsienas seko līdzi un saglabā attālumu līdz tuvākajam stūrim', () => {
  const f = newFloor();
  box(f, 0, 0, 600, 400, 25);
  const near = makeWall({ x: 150, y: 0 }, { x: 150, y: 400 }, 10); // tuvāk kreisajam stūrim
  const far = makeWall({ x: 450, y: 0 }, { x: 450, y: 400 }, 10); // tuvāk labajam stūrim
  f.walls.push(near, far);
  const win = makeOpening('window', f.walls[0].id, 500, { width: 100 }); // augšējā sienā, 100 cm no labā stūra
  f.openings.push(win);
  for (const [from, to] of [[{ x: 600, y: 0 }, { x: 800, y: 0 }], [{ x: 600, y: 400 }, { x: 800, y: 400 }]]) {
    const before = snapshotWalls(f);
    moveJoint(f, from, to);
    followHosts(f, before);
  }
  assert.deepEqual([near.a, near.b], [{ x: 150, y: 0 }, { x: 150, y: 400 }]);
  // Tālākā siena pārbīdās paralēli (paliek vertikāla) un ir 150 cm no labā stūra.
  assert.deepEqual([far.a, far.b].map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) })), [{ x: 650, y: 0 }, { x: 650, y: 400 }]);
  assert.equal(Math.round(win.pos), 700);
  // Ārsienas paplašināšana uz augšu: iekšsienas pagarinās līdzi, x nemainās.
  const before = snapshotWalls(f);
  moveJoint(f, { x: 0, y: 0 }, { x: 0, y: -100 });
  moveJoint(f, { x: 800, y: 0 }, { x: 800, y: -100 });
  followHosts(f, before);
  assert.deepEqual(near.a, { x: 150, y: -100 });
  assert.equal(Math.round(far.a.y), -100);
});
