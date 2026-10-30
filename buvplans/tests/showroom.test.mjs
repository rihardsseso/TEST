import { test } from 'node:test';
import assert from 'node:assert/strict';
import { showroomProject, catalogPlan, layoutProblems, footprint, openingSpan } from '../js/showroom.js';
import { ITEMS, GROUPS } from '../js/catalog-data.js';
import { polygonArea, pointInPolygon } from '../js/geometry.js';
import { rebuildRooms } from '../js/rooms.js';
import { wallLength } from '../js/model.js';
import { categoryOf } from '../js/catalog.js';
import { validateProject } from '../js/storage.js';

const project = showroomProject();
const main = project.floors[0];
const variants = project.floors.slice(1);

test('paraugtelpa: viena telpa, tieši 100 m²', () => {
  assert.equal(main.variant, false);
  assert.equal(main.rooms.length, 1);
  assert.ok(Math.abs(polygonArea(main.rooms[0].points) / 1e4 - 100) <= 0.5, `laukums ${polygonArea(main.rooms[0].points) / 1e4}`);
  // Pārrēķinot no sienām (kā to dara redaktors), telpa paliek tā pati.
  const copy = JSON.parse(JSON.stringify(main));
  rebuildRooms(copy);
  assert.equal(copy.rooms.length, 1);
  assert.ok(Math.abs(polygonArea(copy.rooms[0].points) / 1e4 - 100) <= 0.5);
  const ext = main.walls.filter((w) => w.thickness === 30);
  assert.equal(ext.length, 4);
  assert.ok(ext.every((w) => w.material === 'gas'));
  assert.equal(main.height, 270);
});

test('paraugtelpā ir visi logu un durvju varianti', () => {
  const want = new Set();
  for (const g of ['windows', 'doors_and_openings']) {
    for (const s of GROUPS[g].sections) for (const o of s.items) if (o.t === 'opening') want.add(`${o.type}:${o.variant}`);
  }
  const have = new Set(main.openings.map((o) => `${o.type}:${o.variant}`));
  for (const k of want) assert.ok(have.has(k), `trūkst ${k}`);
});

test('paraugtelpā nav pārklāšanos, priekšmetu sienās un aizšķērsotu durvju', () => {
  assert.deepEqual(layoutProblems(main), []);
});

test('paraugtelpā ir visu galveno stadiju elementi, līnijas un zonas', () => {
  const stages = new Set(main.items.map((it) => categoryOf(it)));
  for (const s of ['init', 'radiators', 'furniture', 'santeh', 'waterplan', 'sockets', 'light_connections', 'light', 'cables', 'warm_floor', 'conditioners', 'ventilation', 'security']) {
    assert.ok(stages.has(s), `nav stadijas ${s}`);
  }
  const lineLayers = new Set(main.lines.map((l) => l.layer));
  for (const s of ['cables', 'waterplan']) assert.ok(lineLayers.has(s));
  assert.ok(main.zones.some((z) => z.layer === 'warm_floor'));
  assert.ok(main.zones.some((z) => z.layer === 'floor' && z.finish));
  assert.ok(main.rooms[0].floorFinish);
  for (const it of main.items) assert.ok(pointInPolygon(it, main.rooms[0].points), `ārpus telpas: ${it.kind}`);
});

test('katrs ITEMS elements kataloga variantos ir tieši vienreiz', () => {
  const count = new Map();
  for (const f of variants) for (const it of f.items) count.set(it.kind, (count.get(it.kind) || 0) + 1);
  for (const k of Object.keys(ITEMS)) assert.equal(count.get(k), 1, `${k}: ${count.get(k) || 0}×`);
  assert.equal([...count.keys()].filter((k) => !ITEMS[k]).length, 0);
  // Plāns ir tas pats, ko izmanto projekts
  const planned = catalogPlan().flatMap((p) => (p.sections || []).flatMap((s) => s.items));
  assert.equal(planned.length, Object.keys(ITEMS).length);
});

test('visu priekšmetu slānis ir to stadija', () => {
  for (const f of project.floors) {
    for (const it of f.items) assert.equal(it.layer, ITEMS[it.kind].stage, it.kind);
  }
});

test('kataloga varianti: varianta mehānika, virsraksts, kārtīgs režģis', () => {
  assert.ok(variants.length >= 10);
  for (const f of variants) {
    assert.equal(f.variant, true);
    assert.equal(f.group, main.id);
    assert.equal(f.name, main.name);
    assert.ok(f.labels.length >= 1, 'virsraksts');
    assert.equal(f.rooms.length, 1);
    assert.ok(polygonArea(f.rooms[0].points) / 1e4 >= 99);
    const rects = f.items.map(footprint);
    for (let i = 0; i < rects.length; i++) {
      assert.ok(pointInPolygon(f.items[i], f.rooms[0].points), f.items[i].kind);
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const ov = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0 && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0;
        assert.ok(!ov, `pārklājas ${f.items[i].kind} un ${f.items[j].kind}`);
      }
    }
  }
  const ids = project.floors.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('visiem atvērumiem ir derīga siena un tie ir sienas robežās', () => {
  for (const f of project.floors) {
    for (const o of f.openings) {
      const w = f.walls.find((x) => x.id === o.wallId);
      assert.ok(w, `nav sienas ${o.variant}`);
      const [a, b] = openingSpan(o);
      assert.ok(a >= 0 && b <= wallLength(w) + 1e-6, `${o.variant}: ${a}–${b} / ${wallLength(w)}`);
    }
    for (const o of f.openings) {
      for (const q of f.openings) {
        if (q === o || q.wallId !== o.wallId) continue;
        const [a0, a1] = openingSpan(o), [b0, b1] = openingSpan(q);
        assert.ok(Math.min(a1, b1) <= Math.max(a0, b0), `pārklājas ${o.variant} un ${q.variant}`);
      }
    }
  }
});

test('deterministisks un ātrs; projekts iztur validāciju', () => {
  const t0 = performance.now();
  const again = showroomProject();
  const ms = performance.now() - t0;
  assert.ok(ms < 300, `${ms} ms`);
  const strip = (p) => JSON.stringify({ ...p, id: 0, created: 0, updated: 0 });
  assert.equal(strip(again), strip(project));
  assert.doesNotThrow(() => validateProject(JSON.parse(JSON.stringify(again))));
});
