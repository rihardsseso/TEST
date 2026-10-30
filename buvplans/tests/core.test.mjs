import { test } from 'node:test';
import assert from 'node:assert/strict';
import { polygonArea, insetPolygon, pointInPolygon, interiorPoint, segmentIntersection } from '../js/geometry.js';
import { newFloor, newProject, makeWall, makeOpening, moveJoint, clampOpening, segmentCovered, Store, snapshotWalls, followHosts } from '../js/model.js';
import { wallFaceDims } from '../js/dims.js';
import { findFaces, detectRooms, syncRooms, keepRoomsInSync } from '../js/rooms.js';
import { roomStats, floorStats, specification, statsCSV, wallMaterials } from '../js/calc.js';
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

test('sienu materiāli: laukums bez ailēm, apjoms un bloku skaits', () => {
  const f = newFloor();
  box(f, 0, 0, 400, 300, 30);
  for (const w of f.walls) w.material = 'gas';
  f.openings.push(makeOpening('window', f.walls[0].id, 200, { width: 100, height: 150, sill: 90 }));
  const [row] = wallMaterials(f);
  assert.equal(row.name, 'Gāzbetona bloki');
  assert.equal(row.length.toFixed(2), '14.00');
  const area = 14 * 2.7 - 1 * 1.5;
  assert.equal(row.area.toFixed(3), area.toFixed(3));
  assert.equal(row.volume.toFixed(3), (area * 0.3).toFixed(3));
  assert.equal(row.units, Math.ceil(area * (1e4 / (60 * 20)))); // 60×20 cm bloki
});

test('katalogs: katras lapas rīki atsaucas uz esošām grupām, priekšmetiem, līnijām, zonām un apdarēm', async () => {
  const { STAGES } = await import('../js/stages.js');
  const { GROUPS, ITEMS, LINE_TYPES, ZONE_TYPES, FINISHES } = await import('../js/catalog-data.js');
  assert.equal(STAGES.length, 24);
  const check = (spec, where) => {
    if (spec.t === 'item') assert.ok(ITEMS[spec.item], `${where}: nav priekšmeta ${spec.item}`);
    if (spec.t === 'line') assert.ok(LINE_TYPES[spec.line], `${where}: nav līnijas ${spec.line}`);
    if (spec.t === 'zone') assert.ok(ZONE_TYPES[spec.zone], `${where}: nav zonas ${spec.zone}`);
    if (spec.t === 'finish' && spec.target !== 'ceilingMolding') assert.ok(FINISHES[spec.target]?.[spec.value], `${where}: nav apdares ${spec.target}/${spec.value}`);
  };
  let tools = 0;
  for (const st of STAGES) {
    // Lapā „Telpas” kā oriģinālā ir tikai palīdzība — telpas nosauc, klikšķinot plānā
    if (st.id !== 'rooms') assert.ok(st.tools.length > 0, `${st.id}: nav rīku`);
    for (const spec of st.tools) {
      tools += 1;
      if (spec.t === 'group') {
        const g = GROUPS[spec.group];
        assert.ok(g, `${st.id}: nav grupas ${spec.group}`);
        for (const sec of g.sections) for (const it of sec.items) { tools += 1; check(it, `${st.id}/${spec.group}`); }
      } else check(spec, st.id);
    }
  }
  assert.ok(tools > 1000, `rīku kopā ${tools}`);
});

test('albums: plāna lapas tikai stadijām, kurās ir saturs', async () => {
  const { stageHasContent } = await import('../js/album.js');
  const { STAGES } = await import('../js/stages.js');
  const f = sampleProject().floors[0];
  const ids = STAGES.filter((s) => stageHasContent(f, s)).map((s) => s.id);
  for (const id of ['init', 'break_walls', 'create_walls', 'rooms', 'furniture', 'cables', 'floor']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('shield'));
  const empty = newFloor('Tukšs', 0, 270);
  assert.deepEqual(STAGES.filter((s) => stageHasContent(empty, s)).map((s) => s.id), ['init']);
});

test('vecie elektrības vadi tiek pārnesti uz līnijām; caurules un apdare ir aprēķinos', async () => {
  const { validateProject } = await import('../js/storage.js');
  const { lineSchedule, finishSchedule, zoneSchedule } = await import('../js/calc.js');
  const p = newProject('Vecs');
  p.floors[0].wires = [{ id: 'w1', points: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }] }];
  delete p.floors[0].lines;
  validateProject(p);
  const f = p.floors[0];
  assert.equal(f.lines.length, 1);
  assert.equal(f.lines[0].layer, 'cables');
  assert.equal(lineSchedule(f)[0].length, 5);
  const s = sampleProject().floors[0];
  assert.ok(lineSchedule(s).length >= 3);
  assert.ok(zoneSchedule(s).length >= 1);
  assert.ok(finishSchedule(s).some((r) => r.group === 'floor' && r.qty > 0));
});

test('slāņi: aktīvās lapas objekti rediģējami, citi fonā vai paslēpti', async () => {
  const { stageById, layerMode, wallMode } = await import('../js/stages.js');
  const furn = stageById('furniture'), init = stageById('init'), cables = stageById('cables');
  assert.equal(layerMode(furn, 'furniture'), 'active');
  assert.equal(layerMode(furn, 'sockets'), 'faded');
  assert.equal(layerMode(init, 'furniture'), 'hidden');
  assert.equal(layerMode(cables, 'sockets'), 'shown');
  assert.equal(wallMode(init, { status: 'new' }), 'hidden');
  assert.equal(wallMode(stageById('break_walls'), { status: 'demolish' }), 'demolish');
  assert.equal(wallMode(furn, { status: 'demolish' }), 'hidden');
  const custom = stageById('sheet_x', [{ id: 'sheet_x', name: 'Piezīmes' }]);
  assert.ok(custom.custom);
  assert.equal(layerMode(custom, 'sheet_x'), 'active');
});

test('grupas: grupēšana, kopija ar jaunu grupu, pagriešana un spoguļošana ap centru', async () => {
  const m = await import('../js/model.js');
  const f = newFloor();
  const a = { id: 'a', kind: 'sofa', x: 0, y: 0, w: 200, d: 90, h: 80, rot: 0 };
  const b = { id: 'b', kind: 'table', x: 200, y: 0, w: 100, d: 60, h: 75, rot: 0 };
  f.items.push(a, b);
  const g = m.groupItems([a, b]);
  assert.equal(m.groupMembers(f, a).length, 2);
  assert.ok(a.group === g && b.group === g);
  const copies = m.cloneItems([a, b]);
  assert.equal(copies[0].group, copies[1].group);
  assert.notEqual(copies[0].group, g);
  assert.notEqual(copies[0].id, 'a');
  m.rotateItems([a, b], 90);
  assert.deepEqual([a.x, a.y, b.x, b.y, a.rot], [100, -100, 100, 100, 90]);
  m.mirrorItems([a, b]);
  assert.equal(a.rot, 270);
  assert.ok(a.mirror && b.mirror);
  m.ungroupItems([a, b]);
  assert.equal(m.groupMembers(f, a).length, 1);
  // Vienam priekšmetam spoguļošana maina tikai simbolu
  m.mirrorItems([a]);
  assert.equal(a.mirror, false);
});

test('vairākatlase: dzēšana un kopējais saraksts', () => {
  const store = new Store(newProject());
  store.commit((f) => f.items.push({ id: 'x', kind: 'sofa', x: 0, y: 0, w: 10, d: 10, h: 10 }, { id: 'y', kind: 'sofa', x: 50, y: 0, w: 10, d: 10, h: 10 }, { id: 'z', kind: 'sofa', x: 90, y: 0, w: 10, d: 10, h: 10 }));
  store.selectMany(['x', 'y']);
  assert.deepEqual(store.selectedItems().map((i) => i.id), ['x', 'y']);
  store.deleteSelected();
  assert.deepEqual(store.floor.items.map((i) => i.id), ['z']);
  assert.equal(store.multi.length, 0);
});

test('bibliotēka: ieraksts glabā relatīvas pozīcijas un novieto grupu jaunā vietā', async () => {
  const m = await import('../js/model.js');
  const items = [{ id: '1', kind: 'sofa', name: 'Dīvāns', x: 100, y: 100, w: 200, d: 90, h: 80, group: 'g' }, { id: '2', kind: 'table', x: 300, y: 100, w: 100, d: 60, h: 75, group: 'g' }];
  const e = m.libraryEntry(items, 'Komplekts', 'furniture');
  assert.equal(e.items.length, 2);
  assert.deepEqual(e.items.map((i) => [i.dx, i.dy]), [[-100, 0], [100, 0]]);
  assert.ok(!('id' in e.items[0]) && !('group' in e.items[0]));
  const placed = m.itemsFromLibrary(e, { x: 1000, y: 500 }, 'furniture');
  assert.deepEqual(placed.map((i) => [i.x, i.y]), [[900, 500], [1100, 500]]);
  assert.equal(placed[0].group, placed[1].group);
  assert.ok(placed[0].group);
});

test('ekrāna diagonāle un kameras redzes lauks', async () => {
  const m = await import('../js/model.js');
  const s = m.tvSize(55);
  assert.equal(s.w, 121.8);
  assert.equal(s.h, 68.5);
  assert.equal(m.tvDiagonal(s.w), 55);
  const sec = m.cameraSector({ x: 10, y: 20, rot: 90, viewAngle: 60, viewRadius: 4 });
  assert.deepEqual(sec, { x: 10, y: 20, dir: 180, angle: 60, radius: 400 });
});

test('ūdens izvadi: noņemšana, secības maiņa, augstumi sienu skatā', async () => {
  const m = await import('../js/model.js');
  const it = { kind: 'cold_hot_water_sewerage' };
  assert.deepEqual(m.waterOutputs(it), ['cold', 'hot', 'sewer']);
  assert.ok(m.toggleWaterOutput(it, 'hot'));
  assert.deepEqual(m.waterOutputs(it), ['cold', 'sewer']);
  m.reverseWaterOutputs(it);
  assert.deepEqual(m.waterOutputs(it), ['sewer', 'cold']);
  assert.ok(m.toggleWaterOutput(it, 'hot'));
  assert.deepEqual(m.waterOutputs(it), ['sewer', 'cold', 'hot']);
  const two = { kind: 'hot_cold_water' };
  assert.deepEqual(m.waterOutputs(two), ['cold', 'hot']);
  assert.ok(m.toggleWaterOutput(two, 'cold'));
  assert.equal(m.toggleWaterOutput(two, 'hot'), false, 'pēdējais izvads paliek');
  const { waterPoints } = await import('../js/calc.js');
  assert.equal(waterPoints([{ kind: 'cold_hot_water_sewerage' }, { kind: 'cold_water_outlet' }]), 4);
});

test('izmērs: garuma iestatīšana un sadalīšana daļās', async () => {
  const m = await import('../js/model.js');
  const d = { id: 'd', a: { x: 0, y: 0 }, b: { x: 300, y: 0 }, offset: 10, color: '#ff0000' };
  m.setDimLength(d, 450);
  assert.deepEqual(d.b, { x: 450, y: 0 });
  const parts = m.splitDim(d, 3);
  assert.equal(parts.length, 3);
  assert.equal(parts[0].id, 'd');
  assert.deepEqual(parts.map((p) => [p.a.x, p.b.x]), [[0, 150], [150, 300], [300, 450]]);
  assert.ok(parts.every((p) => p.color === '#ff0000' && p.offset === 10));
});

test('grīdas segums: elementu skaits ar 10 % rezervi, ieklāšanas veidi bez spraugām', async () => {
  const m = await import('../js/model.js');
  assert.equal(m.tileCount(4e4, 60, 60, 0), Math.ceil((4e4 / 3600) * 1.1)); // 4 m² → 13
  assert.equal(m.tileCount(120000, 120, 20, 0), 55); // 12 m² / 0,24 m² = 50 + 10 %
  const room = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 200 }, { x: 0, y: 200 }];
  for (const [laying] of m.LAYINGS) {
    const pcs = m.tilePieces(room, { L: 60, W: 15, laying, angle: 30 });
    assert.ok(pcs.length > 20, laying);
    for (let i = 0; i < 300; i++) {
      const p = { x: 1 + ((i * 37) % 298), y: 1 + ((i * 53) % 198) };
      const c = pcs.filter((q) => pointInPolygon(p, q)).length;
      assert.equal(c, 1, `${laying}: punkts ${p.x},${p.y} pārklāts ${c} reizes`);
    }
  }
  assert.equal(m.tilePieces(room, { L: 1, W: 1, max: 1000 }), null, 'pārāk daudz elementu');
  const fd = { name: 'Lamināts', pattern: 'planks' };
  assert.deepEqual(m.roomTiling({ tileAngle: 45 }, fd), { L: 120, W: 20, grout: 0, angle: 45, laying: 'deck3' });
  assert.equal(m.floorTileDefaults({ name: 'Grīdas flīze 40×40', pattern: 'tiles' }).L, 40);
  assert.equal(m.roomTiling({}, { name: 'Linolejs', pattern: 'plain' }), null);
  const { roomTiles, finishSchedule } = await import('../js/calc.js');
  const f = newFloor();
  f.rooms.push({ id: 'r', name: 'Istaba', points: room, floorFinish: 'laminate', tileL: 100, tileW: 20 });
  assert.equal(roomTiles(f.rooms[0]).count, Math.ceil((60000 / 2000) * 1.1));
  assert.ok(finishSchedule(f).some((r) => r.group === 'floorPieces' && r.unit === 'gab.' && r.qty === 33));
});

test('elektrības punkti: vertikālā grupa skaitās, augstums no palodzes, attālumi līdz stūriem', async () => {
  const m = await import('../js/model.js');
  const { countPoints } = await import('../js/calc.js');
  assert.equal(countPoints([{ kind: 'socket', vcount: 3 }, { kind: 'socket', count: 2 }, { kind: 'switch' }], 'socket'), 5);
  const f = newFloor();
  box(f, 0, 0, 400, 300, 20);
  detectRooms(f);
  f.openings.push(makeOpening('window', f.walls[0].id, 200, { width: 120, sill: 90 }));
  const near = m.nearestWindow(f, { x: 260, y: 20 });
  assert.equal(near.opening.sill, 90);
  assert.equal(m.windowSillHeight(near.opening), 90);
  assert.equal(m.nearestWindow(f, { x: 200, y: 280 }, 100), null);
  const cd = m.cornerDistances(f, { x: 100, y: 15 });
  assert.equal(Math.round(cd.da + cd.db), 380);
  assert.deepEqual([Math.round(Math.min(cd.da, cd.db)), Math.round(Math.max(cd.da, cd.db))], [90, 290]);
});

test('sienu posmu apvienošana un līnijas sadalīšana', async () => {
  const m = await import('../js/model.js');
  const f = newFloor();
  const w1 = makeWall({ x: 0, y: 0 }, { x: 200, y: 0 }, 20), w2 = makeWall({ x: 200, y: 0 }, { x: 500, y: 0 }, 20);
  f.walls.push(w1, w2);
  f.openings.push(makeOpening('door', w2.id, 100));
  assert.ok(m.mergeWall(f, w1));
  assert.equal(f.walls.length, 1);
  assert.deepEqual([w1.a, w1.b], [{ x: 0, y: 0 }, { x: 500, y: 0 }]);
  assert.equal(f.openings[0].wallId, w1.id);
  assert.equal(Math.round(f.openings[0].pos), 300);
  const [l1, l2] = m.splitLine({ id: 'l', type: 'cable', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] });
  assert.deepEqual(l1.points.at(-1), { x: 100, y: 0 });
  assert.deepEqual(l2.points[0], { x: 100, y: 0 });
  assert.notEqual(l1.id, l2.id);
});

test('sienu skati: vērtnes, balkona durvju konfigurācija, arka, vertikālā grupa un ūdens caurules', () => {
  const f = newFloor();
  box(f, 0, 0, 500, 400, 20);
  detectRooms(f);
  f.openings.push(makeOpening('window', f.walls[0].id, 150, { width: 150, casements: 3, sillThick: 4, sillOver: 5 }));
  f.openings.push(makeOpening('door', f.walls[0].id, 380, { variant: 'balcony', config: 'sandwich', mullion: 100 }));
  f.openings.push(makeOpening('door', f.walls[2].id, 250, { arched: true, trims: true }));
  f.items.push({ id: 's', kind: 'socket', x: 100, y: 390 - 10, w: 8, d: 6, h: 8, elev: 30, rot: 0, vcount: 3 });
  f.items.push({ id: 'w', kind: 'cold_hot_water_sewerage', x: 300, y: 380, w: 26, d: 8, h: 12, elev: 60, rot: 0, pipeH: 70, sewerH: 45 });
  const els = roomElevations(f, f.rooms[0]);
  const all = els.flatMap((e) => e.openings);
  const win = all.find((o) => o.type === 'window');
  assert.equal(win.casements, 3);
  assert.equal(all.find((o) => o.variant === 'balcony').config, 'sandwich');
  const svg = els.map((e) => elevationSVG(e)).join('');
  assert.ok(svg.includes('stroke-width="3"'), 'imposte');
  assert.ok(svg.includes(' Q'), 'arka');
  const items = els.flatMap((e) => e.items);
  assert.equal(items.find((i) => i.vcount === 3).vcount, 3);
  const water = items.find((i) => i.pipes);
  assert.deepEqual(water.pipes.map((p) => [p.k, p.y]), [['cold', 70], ['hot', 70], ['sewer', 45]]);
  assert.ok(svg.includes('h=45'));
});
