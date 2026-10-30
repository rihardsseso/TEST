// 100 m² paraugtelpa ar visu stadiju elementiem un pilnais katalogs pa plānojuma variantiem.
// Viss tiek būvēts deterministiski (bez nejaušības), lai paraugs vienmēr izskatītos vienādi.
import { newProject, newFloor, makeWall, makeOpening, wallLength, wallNormal, wallPoint } from './model.js';
import { detectRooms } from './rooms.js';
import { projectOnSegment } from './geometry.js';
import { ITEMS, GROUPS, STAGE_DEFS } from './catalog-data.js';
import { byKind } from './catalog.js';

const N = 1000; // telpas tīrais iekšējais izmērs, cm (10 × 10 m)
const EXT = 30; // ārsienu biezums (gāzbetons)

/** Deterministisks identifikatoru ģenerators vienam projektam. */
function idGen(prefix) {
  let n = 0;
  return () => `${prefix}${(++n).toString(36)}`;
}

/** Visi atvērumu varianti (logi, durvis) no kataloga rīkiem. */
function openingSpecs() {
  const out = [];
  for (const g of ['windows', 'doors_and_openings']) {
    for (const s of GROUPS[g]?.sections || []) for (const it of s.items) if (it.t === 'opening') out.push(it);
  }
  return out;
}

function specOf(variant, leaves, type) {
  const s = openingSpecs().find((x) => x.variant === variant && (!leaves || x.leaves === leaves) && (!type || x.type === type));
  if (!s) throw new Error(`Nav atveruma varianta: ${variant}`);
  const { t, name, icon, ...rest } = s;
  return rest;
}

/** Konteksts objektu pievienošanai stāvam. */
function builder(f, nid, sizes = null) {
  const dims = (kind) => {
    const z = sizes?.[kind];
    const g = ITEMS[kind];
    return z ? { w: z[0], d: z[1], h: z[2], elev: z[3] } : { w: g.w, d: g.d, h: g.h, elev: g.elev };
  };
  const W = (x1, y1, x2, y2, t, extra = {}) => {
    const w = makeWall({ x: x1, y: y1 }, { x: x2, y: y2 }, t);
    Object.assign(w, { id: nid() }, extra);
    f.walls.push(w);
    return w;
  };
  /** Atvērums sienā: `from` – sākuma koordināte telpas asīs (x horizontālai, y vertikālai sienai). */
  const O = (wall, variant, from, width, opts = {}, leaves) => {
    const spec = specOf(variant, leaves, opts.type);
    const horiz = Math.abs(wall.a.y - wall.b.y) < 0.01;
    const c = from + width / 2;
    const pos = Math.abs(c - (horiz ? wall.a.x : wall.a.y));
    const o = makeOpening(spec.type, wall.id, pos, { ...spec, width, ...opts });
    if (o.variant === 'windoor' && !opts.windowWidth) {
      o.doorWidth = spec.doorWidth;
      o.windowWidth = width - spec.doorWidth;
    }
    o.id = nid();
    f.openings.push(o);
    return o;
  };
  const I = (kind, x, y, rot = 0, extra = {}) => {
    const g = ITEMS[kind];
    if (!g) throw new Error(`Nav kataloga elementa: ${kind}`);
    const def = byKind(kind);
    const it = { id: nid(), kind, name: g.name, x, y, ...dims(kind), rot, color: def?.color, layer: g.stage, ...extra };
    f.items.push(it);
    return it;
  };
  /**
   * Priekšmets pie sienas virsmas. face = [ass, koordināte, telpas puse]:
   * ['h', y, +1] – siena augšā, telpa zemāk; ['v', x, -1] – siena labajā pusē utt.
   * Aizmugure (lokālā −y) vienmēr pret sienu.
   */
  const A = (kind, face, s, extra = {}) => {
    const d = extra.d ?? dims(kind).d;
    const [axis, at, dir] = face;
    if (axis === 'h') return I(kind, s, at + (dir * d) / 2, dir > 0 ? 0 : 180, extra);
    return I(kind, at + (dir * d) / 2, s, dir > 0 ? 270 : 90, extra);
  };
  const line = (type, layer, points, extra = {}) => {
    const ln = { id: nid(), type, layer, points: points.map(([x, y]) => ({ x, y })), ...extra };
    f.lines.push(ln);
    return ln;
  };
  const zone = (type, layer, x0, y0, x1, y1, extra = {}) => {
    const z = { id: nid(), type, layer, points: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }], ...extra };
    f.zones.push(z);
    return z;
  };
  const label = (text, x, y, size = 14, extra = {}) => {
    const l = { id: nid(), x, y, text, size, ...extra };
    f.labels.push(l);
    return l;
  };
  return { W, O, I, A, line, zone, label };
}

// Paraugtelpas priekšmetu izmēri [w, d, h, elev] — fiksēti, lai izkārtojums nemainītos, ja katalogs tiek precizēts.
const MAIN_SIZES = {
  '3_door_sliding_wardrobe': [180, 65, 240, 0],
  ac_unit_wire_out: [10, 6, 8, 30],
  acrylic_bathtub: [170, 75, 55, 0],
  armchair_module: [85, 85, 90, 0],
  audio_socket: [10, 6, 8, 30],
  base_cabinet_with_door: [60, 60, 90, 0],
  base_cabinet_with_drawers: [60, 60, 90, 0],
  base_cabinet_with_pull_out_trash_can: [60, 60, 90, 0],
  base_oven_cabinet: [60, 60, 85, 0],
  bidet: [38, 55, 40, 0],
  bimetallic_radiator: [80, 10, 60, 15],
  bookcase: [100, 35, 200, 0],
  coffee_maker: [40, 35, 40, 85],
  cold_hot_water_sewerage: [26, 8, 12, 60],
  cold_water_outlet: [10, 6, 8, 60],
  cold_water_sewerage: [26, 8, 12, 60],
  cold_water_supply_riser: [15, 15, 270, 0],
  corner_base_cabinet_with_2_drawers: [60, 60, 90, 0],
  dimmer: [10, 6, 8, 90],
  dining_chair: [45, 50, 90, 0],
  dishwasher: [60, 60, 85, 0],
  dome_camera: [12, 12, 10, 250],
  dome_range_hood: [60, 50, 60, 165],
  double_bed: [170, 210, 100, 0],
  double_gang_switch: [10, 6, 8, 90],
  electric_cooktop_4_burners: [60, 52, 5, 85],
  ficus_floor_standing: [50, 50, 140, 0],
  fire_sensor: [10, 10, 4, 260],
  floor_mounted_toilet: [38, 65, 80, 0],
  floor_socket: [10, 6, 8, 30],
  floor_standing_cabinet_with_two_doors: [60, 60, 90, 0],
  floor_standing_nightstand: [45, 40, 50, 0],
  flush_mount_chandelier_with_shades: [70, 70, 60, 200],
  flush_mount_light: [40, 40, 25, 230],
  flush_mounted_low_voltage_panel: [40, 12, 50, 140],
  glass_display_wall_cabinet: [60, 35, 70, 145],
  hdmi_socket: [10, 6, 8, 30],
  heavy_duty_380v_socket_three_phase: [10, 6, 8, 30],
  high_back_armchair: [85, 85, 90, 0],
  hot_cold_water: [26, 8, 12, 60],
  hot_water_outlet: [10, 6, 8, 60],
  hot_water_supply_riser: [15, 15, 270, 0],
  hydronic_towel_warmer: [50, 10, 80, 90],
  internet_socket: [10, 6, 8, 30],
  master_switch: [10, 6, 8, 90],
  motion_sensor: [10, 10, 4, 260],
  office_chair: [60, 60, 110, 0],
  office_desk: [140, 70, 75, 0],
  office_storage_cabinet: [100, 40, 180, 0],
  open_shelving_wall_cabinet: [60, 35, 70, 145],
  pendant_chandelier_with_shades: [70, 70, 60, 200],
  pendant_light: [40, 40, 25, 230],
  power_socket_group: [10, 6, 8, 30],
  recessed_spotlight: [12, 12, 5, 267],
  rectangular_coffee_table: [110, 60, 45, 0],
  rectangular_dining_table: [160, 90, 75, 0],
  round_dining_table: [110, 110, 75, 0],
  round_grille: [20, 20, 3, 260],
  sconce: [20, 12, 20, 180],
  sewer_outlet: [12, 8, 12, 40],
  sewer_riser: [15, 15, 270, 0],
  shower_drain: [70, 8, 2, 0],
  single_gang_switch: [10, 6, 8, 90],
  single_gang_two_way_switch: [10, 6, 8, 90],
  split_system_indoor_unit: [90, 22, 30, 230],
  square_shower_enclosure: [90, 90, 200, 0],
  standard_220v_socket: [10, 6, 8, 30],
  standard_kitchen_sink: [80, 50, 20, 85],
  standard_lamp: [40, 40, 170, 0],
  standard_refrigerator: [60, 65, 185, 0],
  steel_radiator: [80, 10, 60, 15],
  surface_mounted_panel: [40, 12, 50, 140],
  surface_mounted_track: [100, 8, 6, 265],
  telephone_socket: [10, 6, 8, 30],
  thermostat: [10, 6, 10, 120],
  three_gang_switch: [10, 6, 8, 90],
  three_seater_sofa: [220, 95, 85, 0],
  toilet_paper_holder: [30, 10, 10, 100],
  track_spotlight: [12, 12, 5, 267],
  trench_convector: [120, 25, 10, 0],
  tv_on_wall_mount: [130, 8, 75, 110],
  tv_socket: [10, 6, 8, 30],
  tv_stand: [160, 40, 50, 0],
  urinal: [35, 35, 60, 50],
  usb_socket: [10, 6, 8, 30],
  vertical_radiator: [45, 10, 180, 15],
  video_intercom: [18, 5, 25, 150],
  wall_cabinet_with_door: [60, 35, 70, 145],
  wall_hung_toilet_bowl: [36, 55, 40, 40],
  wall_mounted_cabinet_with_two_doors: [60, 35, 70, 145],
  wall_mounted_junction_box: [10, 6, 10, 240],
  wall_mounted_mirror_cabinet: [60, 4, 90, 100],
  wall_mounted_sink: [60, 45, 15, 80],
  waterproof_220v_power_socket: [10, 6, 8, 30],
  wishbone_chair: [45, 50, 90, 0],
};

/** Pamatvariants: 10 × 10 m telpa ar zonām un visu stadiju elementiem. */
function buildMain(f, nid) {
  const { W, O, I, A, line, zone, label } = builder(f, nid, MAIN_SIZES);
  const e = EXT / 2;
  // Ārsienas pulksteņrādītāja virzienā — sienu normāle vērsta telpā, durvis veras uz iekšu.
  const gas = { material: 'gas' };
  const T = W(-e, -e, N + e, -e, EXT, gas);
  const R = W(N + e, -e, N + e, N + e, EXT, gas);
  const B = W(N + e, N + e, -e, N + e, EXT, gas);
  const L = W(-e, N + e, -e, -e, EXT, gas);
  // Zonējošās starpsienas (strupceļi, tāpēc telpa paliek viena — 100 m²).
  const part = { material: 'drywall', kind: 'partition' };
  const BW1 = W(325, -e, 325, 250, 10, part); // vannas istaba | kabinets
  const BW2 = W(-e, 335, 325, 335, 10, part); // vannas istaba | priekšnams
  const OS = W(325, 335, 540, 335, 10, part); // kabinets | priekšnams
  const HW = W(430, 335, 430, 560, 10, part); // priekšnams | ēdamzona
  const KW = W(625, -e, 625, 330, 10, part); // kabinets | virtuve
  const G1 = W(-e, 600, 330, 600, 10, part); // priekšnams | guļamistaba
  const BDW = W(410, N + e, 410, 700, 10, part); // guļamistaba | dzīvojamā zona
  const DL = W(N + e, 640, 420, 640, 10, part); // ēdamzona | dzīvojamā zona

  // Sienu virsmas (iekšējās koordinātās)
  const F = {
    T: ['h', 0, 1], B: ['h', N, -1], L: ['v', 0, 1], R: ['v', N, -1],
    BW1w: ['v', 320, -1], BW1e: ['v', 330, 1],
    BW2n: ['h', 330, -1], BW2s: ['h', 340, 1],
    KWw: ['v', 620, -1], KWe: ['v', 630, 1],
    HWw: ['v', 425, -1], HWe: ['v', 435, 1],
    G1n: ['h', 595, -1], G1s: ['h', 605, 1],
    BDWw: ['v', 405, -1], BDWe: ['v', 415, 1],
    DLn: ['h', 635, -1], DLs: ['h', 645, 1],
  };

  // ---------- Logi (visi varianti) ----------
  O(T, 'opening', 110, 100, { type: 'window', sill: 85 }); // aile bez loga — vannas istaba
  O(T, 'window', 405, 140); // kabinets
  O(B, 'windoor', 30, 210); // guļamistaba: balkona bloks
  O(B, 'french', 255, 140); // guļamistaba: franču logs (veramais)
  O(B, 'french4', 460, 300); // dzīvojamā zona
  O(R, 'frenchSliding', 660, 200); // dzīvojamā zona
  O(R, 'balcony', 215, 80); // virtuve: balkona durvis

  // ---------- Durvis (visi varianti) ----------
  O(R, 'pivot', 360, 100, { swing: false }); // ieejas durvis ēdamzonā
  O(R, 'bifold2', 470, 160); // ēdamzona → terase
  O(R, 'accordion', 875, 120); // dzīvojamā zona → terase
  O(B, 'stack', 790, 200, {}, 2); // dzīvojamā zona: paralēli bīdāma sistēma
  O(L, 'garage', 348, 240); // priekšnams: garāžas vārti
  O(BW2, 'pocket', 110, 80); // vannas istaba (iebīdāmās)
  O(BW2, 'sliding', 210, 90); // vannas istaba (bīdāmās)
  O(OS, 'single', 335, 80); // kabinets
  O(OS, 'glass', 445, 90); // kabinets (stikla)
  O(KW, 'pocket2', 85, 160); // kabinets ↔ virtuve
  O(HW, 'sliding2', 370, 160); // priekšnams ↔ ēdamzona
  O(G1, 'double', 150, 140); // priekšnams → guļamistaba
  O(BDW, 'bifold', 720, 90); // guļamistaba ↔ dzīvojamā zona
  O(DL, 'opening', 430, 90, { type: 'door' }); // aile ēdamzona ↔ dzīvojamā zona
  O(DL, 'pivot2', 545, 180); // ēdamzona ↔ dzīvojamā zona
  O(DL, 'slideSys', 750, 240, {}, 2); // bīdāma sistēma

  // ---------- Pamatplāns: inženierkomunikācijas, kolonna ----------
  I('cold_water_supply_riser', 312, 100);
  I('hot_water_supply_riser', 312, 116);
  I('sewer_riser', 296, 108, 0, { w: 15, d: 15 });
  I('fire_sensor', 200, 470);
  I('fire_sensor', 720, 820);

  // ---------- Vannas istaba (0–320 × 0–330) ----------
  A('acrylic_bathtub', F.T, 85);
  A('square_shower_enclosure', F.T, 275);
  A('hydronic_towel_warmer', F.T, 200);
  A('floor_mounted_toilet', F.L, 115);
  A('wall_hung_toilet_bowl', F.L, 170);
  A('bidet', F.L, 225);
  A('urinal', F.L, 287);
  A('wall_mounted_sink', F.BW1w, 160);
  A('wall_mounted_sink', F.BW1w, 225);
  A('wall_mounted_mirror_cabinet', F.BW1w, 160, { elev: 120 });
  I('shower_drain', 275, 60);
  A('toilet_paper_holder', F.L, 145);
  // Ūdens izvadi un kanalizācija
  A('cold_water_outlet', F.BW1w, 150);
  A('hot_water_outlet', F.BW1w, 170);
  A('cold_hot_water_sewerage', F.BW1w, 225, { elev: 55 });
  A('sewer_outlet', F.L, 85);
  A('cold_water_sewerage', F.L, 250);
  A('hot_cold_water', F.T, 130, { elev: 60 });
  A('waterproof_220v_power_socket', F.BW1w, 245, { elev: 110 });
  A('single_gang_switch', F.BW2s, 25);
  A('thermostat', F.BW2n, 75);
  I('flush_mount_light', 160, 200);
  I('round_grille', 140, 300);
  zone('heatCable', 'warm_floor', 75, 90, 265, 320, { pitch: 15, pattern: 'snake' });
  zone('floorZone', 'floor', 0, 0, 320, 330, { finish: 'floor_tile_40x40', allSheets: false });

  // ---------- Kabinets (330–620 × 0–330) ----------
  A('bimetallic_radiator', F.T, 475);
  I('office_desk', 475, 47);
  I('office_chair', 475, 130, 180);
  A('bookcase', F.BW1e, 160);
  A('office_storage_cabinet', F.KWw, 290, { w: 70, d: 40 });
  I('ficus_floor_standing', 370, 295);
  A('standard_220v_socket', F.T, 395);
  A('usb_socket', F.T, 560);
  A('internet_socket', F.BW1e, 90);
  A('double_gang_switch', F.BW1e, 235, { elev: 90 });
  I('surface_mounted_track', 475, 140);
  I('track_spotlight', 445, 140);
  I('track_spotlight', 505, 140);

  // ---------- Virtuve (630–1000 × 0–330) ----------
  A('standard_refrigerator', F.T, 660);
  A('base_cabinet_with_drawers', F.T, 720);
  A('base_cabinet_with_door', F.T, 780);
  A('standard_kitchen_sink', F.T, 780, { w: 60, d: 50 });
  A('dishwasher', F.T, 840);
  A('floor_standing_cabinet_with_two_doors', F.T, 900);
  A('corner_base_cabinet_with_2_drawers', F.T, 965, { w: 70 });
  A('base_oven_cabinet', F.R, 95);
  A('electric_cooktop_4_burners', F.R, 95, { w: 60, d: 52 });
  A('dome_range_hood', F.R, 95, { elev: 165 });
  A('base_cabinet_with_pull_out_trash_can', F.R, 155);
  A('wall_cabinet_with_door', F.T, 720);
  A('open_shelving_wall_cabinet', F.T, 780);
  A('wall_mounted_cabinet_with_two_doors', F.T, 840);
  A('glass_display_wall_cabinet', F.T, 900);
  A('coffee_maker', F.T, 900, { w: 30, d: 30, h: 35 });
  I('round_dining_table', 780, 225, 0, { w: 90, d: 90 });
  I('wishbone_chair', 780, 152, 0);
  I('wishbone_chair', 708, 225, 270);
  I('wishbone_chair', 852, 225, 90);
  A('heavy_duty_380v_socket_three_phase', F.R, 135, { elev: 20 });
  A('power_socket_group', F.T, 705, { elev: 110 });
  A('power_socket_group', F.T, 870, { elev: 110 });
  A('cold_water_outlet', F.T, 770, { elev: 45 });
  A('hot_water_outlet', F.T, 790, { elev: 45 });
  A('sewer_outlet', F.T, 780, { elev: 25 });
  I('recessed_spotlight', 690, 100);
  I('recessed_spotlight', 780, 100);
  I('recessed_spotlight', 870, 100);
  I('recessed_spotlight', 920, 220);

  // ---------- Priekšnams (0–410 × 340–595) ----------
  A('surface_mounted_panel', F.G1n, 110);
  A('flush_mounted_low_voltage_panel', F.G1s, 60, { elev: 150 });
  A('video_intercom', F.HWw, 545, { elev: 140 });
  A('vertical_radiator', F.G1n, 225);
  A('master_switch', F.HWw, 355, { elev: 90 });
  A('dimmer', F.G1n, 310);
  I('pendant_light', 200, 470);
  I('motion_sensor', 380, 370);
  A('wall_mounted_junction_box', F.G1n, 175, { elev: 240 });

  // ---------- Guļamistaba (0–405 × 605–1000) ----------
  A('double_bed', F.L, 775);
  A('floor_standing_nightstand', F.L, 662);
  A('floor_standing_nightstand', F.L, 888);
  A('3_door_sliding_wardrobe', F.BDWw, 905);
  A('steel_radiator', F.B, 95);
  A('sconce', F.L, 662, { elev: 160 });
  A('sconce', F.L, 888, { elev: 160 });
  A('standard_220v_socket', F.L, 632);
  A('standard_220v_socket', F.L, 918);
  A('single_gang_two_way_switch', F.G1s, 305);
  A('telephone_socket', F.BDWw, 715);
  I('flush_mount_chandelier_with_shades', 205, 775);

  // ---------- Ēdamzona (420–1000 × 340–635) ----------
  I('rectangular_dining_table', 720, 440, 0, { w: 160, d: 90 });
  for (const x of [680, 760]) {
    I('dining_chair', x, 368, 0);
    I('dining_chair', x, 512, 180);
  }
  I('dining_chair', 613, 440, 270);
  I('dining_chair', 827, 440, 90);
  A('standard_220v_socket', F.HWe, 352);
  A('three_gang_switch', F.HWe, 545, { elev: 90 });
  I('pendant_chandelier_with_shades', 720, 440);
  I('dome_camera', 980, 360);

  // ---------- Dzīvojamā zona (420–1000 × 645–1000) ----------
  A('tv_stand', F.BDWe, 910);
  A('tv_on_wall_mount', F.BDWe, 910);
  A('split_system_indoor_unit', F.BDWe, 860);
  A('ac_unit_wire_out', F.BDWe, 800, { elev: 230 });
  A('tv_socket', F.BDWe, 830, { elev: 60 });
  A('hdmi_socket', F.BDWe, 990, { elev: 60 });
  A('audio_socket', F.BDWe, 820);
  I('three_seater_sofa', 715, 860, 90);
  I('rectangular_coffee_table', 565, 860, 90, { w: 110, d: 60 });
  I('armchair_module', 505, 715, 0);
  I('high_back_armchair', 615, 715, 0);
  I('standard_lamp', 800, 700);
  A('trench_convector', F.B, 610, { d: 25 });
  I('floor_socket', 630, 860, 0, { elev: 0 });
  I('flush_mount_light', 650, 820);
  I('recessed_spotlight', 900, 740);
  I('recessed_spotlight', 900, 920);
  A('wall_mounted_junction_box', F.DLs, 980, { elev: 240 });

  // Elektroinstalācija (kabeļi no sadalnes)
  const cable = (pts, lbl = 'Kabelis 3 × 2,5') => line('cable', 'cables', pts, { label: lbl });
  cable([[110, 589], [110, 560], [25, 560], [25, 343]], 'Kabelis 3 × 1,5');
  cable([[110, 589], [110, 625], [3, 625], [3, 632]]);
  cable([[110, 589], [175, 589]]);
  cable([[175, 589], [175, 470], [200, 470]], 'Kabelis 3 × 1,5');
  cable([[175, 589], [175, 565], [438, 565], [438, 352]]);
  line('lowcable', 'cables', [[60, 611], [60, 630], [380, 630], [380, 700], [418, 700], [418, 830]], { label: 'TV kabelis' });
  // Ūdensapgāde no stāvvadiem
  line('cold', 'waterplan', [[312, 100], [312, 150], [317, 150]]);
  line('hot', 'waterplan', [[312, 116], [306, 116], [306, 170], [317, 170]]);
  line('sewer', 'waterplan', [[296, 108], [290, 108], [290, 225], [317, 225]]);
  line('cold', 'waterplan', [[312, 100], [312, 8], [770, 8], [770, 3]]);
  line('hot', 'waterplan', [[306, 116], [298, 116], [298, 14], [790, 14], [790, 3]]);
  // Ventilācija un kondicionēšana
  line('ductExhaust', 'ventilation', [[140, 300], [140, 320], [600, 320], [600, 30], [960, 30], [975, 95]], { width: 12, height: 6 });
  line('drain', 'conditioners', [[420, 860], [440, 860], [440, 995]]);
  // Siltā grīda dzīvojamā zonā (ūdens)
  zone('heatWater', 'warm_floor', 440, 660, 640, 980, { pitch: 20, pattern: 'snake' });
  // Grīdas zonējums
  zone('floorZone', 'floor', 630, 0, N, 330, { finish: 'wood_effect_porcelain_tile', allSheets: false });
  zone('floorZone', 'floor', 0, 340, 425, 595, { finish: 'marble_effect_porcelain_tile', allSheets: false });
  // Griestu zona virs ēdamgalda
  zone('ceiling2', 'ceiling', 600, 370, 840, 510);

  label('Vannas istaba', 160, 255, 12);
  label('Kabinets', 475, 245, 12);
  label('Virtuve', 870, 300, 12);
  label('Priekšnams', 200, 400, 12);
  label('Guļamistaba', 250, 655, 12);
  label('Ēdamzona', 720, 600, 12);
  label('Dzīvojamā zona', 870, 680, 12);

  detectRooms(f);
  for (const r of f.rooms) {
    r.id = nid();
    Object.assign(r, { name: 'Paraugtelpa', floorFinish: 'parquet_board', baseboard: 'mdf_baseboard', wallFinish: 'paint', ceiling: 'stretch_ceiling_pvc' });
  }
}

// ---------- Pilnais katalogs ----------

/**
 * Kataloga varianti stadiju secībā; katrs ITEMS elements nonāk tieši vienā variantā (pirmajā grupā,
 * kurā tas parādās). Mēbeļu grupas — katra savā variantā, pārējās stadijas — viens variants ar sadaļām
 * pa grupām; stadijas ar dažiem elementiem apvienotas vienā kopīgā variantā. Logi un durvis — atsevišķi.
 */
export function catalogPlan() {
  const assigned = new Set();
  const seenGroups = new Set();
  const plans = [];
  const small = [];
  const take = (k) => (ITEMS[k] && !assigned.has(k) ? (assigned.add(k), true) : false);
  let openings = null;
  for (const st of STAGE_DEFS) {
    const stageSections = [];
    const direct = [];
    for (const t of st.tools) {
      if (t.t === 'group' && GROUPS[t.group] && !seenGroups.has(t.group)) {
        seenGroups.add(t.group);
        const g = GROUPS[t.group];
        const ops = g.sections.flatMap((s) => s.items.filter((x) => x.t === 'opening'));
        if (ops.length) {
          openings = openings || { id: 'openings', stage: st.id, title: `${st.name} › Logi un durvis`, openings: [] };
          openings.openings.push(...ops);
        }
        const sections = g.sections
          .map((s) => ({ name: s.name, items: s.items.filter((x) => x.t === 'item' && take(x.item)).map((x) => x.item) }))
          .filter((s) => s.items.length);
        if (!sections.length) continue;
        if (st.id === 'furniture') {
          plans.push({ id: t.group, stage: st.id, title: `${st.name} › ${g.name}`, sections });
        } else {
          for (const s of sections) stageSections.push({ name: s.name ? `${g.name} › ${s.name}` : g.name, items: s.items });
        }
      } else if (t.t === 'item' && take(t.item)) direct.push(t.item);
    }
    if (direct.length) stageSections.push({ name: stageSections.length ? 'Citi rīki' : '', items: direct });
    if (!stageSections.length) continue;
    const count = stageSections.reduce((n, s) => n + s.items.length, 0);
    if (count < 10) small.push(...stageSections.map((s) => ({ name: s.name ? `${st.name} › ${s.name}` : st.name, items: s.items })));
    else plans.push({ id: st.id, stage: st.id, title: st.name, sections: stageSections });
  }
  const rest = Object.keys(ITEMS).filter((k) => !assigned.has(k));
  if (rest.length) small.push({ name: 'Citi', items: rest });
  if (small.length) plans.push({ id: 'misc', stage: 'waterplan', title: 'Inženiertīkli un citi rīki', sections: small });
  if (openings) plans.unshift(openings);
  return plans;
}

const GAP = 40, MARGIN = 60, WALL = 20;
// Uzraksti ir ekrāna pikseļos, tāpēc lielās telpās tiem vajag vairāk vietas (cm uz pikseli, ietilpinot ekrānā).
const pxScale = (width) => Math.max(1, width / 1250);

function boxWalls(W, f, w, h) {
  const e = WALL / 2;
  const T = W(-e, -e, w + e, -e, WALL, { material: 'gas' });
  const R = W(w + e, -e, w + e, h + e, WALL, { material: 'gas' });
  const B = W(w + e, h + e, -e, h + e, WALL, { material: 'gas' });
  const L = W(-e, h + e, -e, -e, WALL, { material: 'gas' });
  return { T, R, B, L };
}

/** Vienas sadaļas bloks: elementi rindās noteiktā platumā, virsraksts augšā. */
function sectionBlock(sec, maxWidth, titled, sc) {
  const keys = sec.items;
  const area = keys.reduce((s, k) => s + (ITEMS[k].w + GAP) * (ITEMS[k].d + GAP), 0);
  const widest = keys.reduce((m, k) => Math.max(m, ITEMS[k].w), 0);
  const minW = titled ? (sec.name.length * 7 + 20) * sc : 0;
  const bw = titled ? Math.min(maxWidth, Math.max(widest, Math.ceil(Math.sqrt(area * 1.6)), minW)) : maxWidth;
  const items = [];
  let x = 0, y = titled ? 26 * sc + 14 : 0, rowH = 0, used = 0;
  for (const k of keys) {
    const g = ITEMS[k];
    if (x > 0 && x + g.w > bw) {
      y += rowH + GAP;
      x = 0;
      rowH = 0;
    }
    items.push({ k, x: x + g.w / 2, y: y + g.d / 2 });
    x += g.w + GAP;
    used = Math.max(used, x - GAP);
    rowH = Math.max(rowH, g.d);
  }
  return { items, w: Math.max(used, minW), h: y + rowH, name: titled ? sec.name : '' };
}

function packGrid(plan, width, hole) {
  const items = [], labels = [];
  const titled = plan.sections.length > 1;
  const sc = pxScale(width);
  const blocks = plan.sections.map((s) => sectionBlock(s, width - 2 * MARGIN, titled && !!s.name, sc));
  let x = MARGIN, y = 60 * sc + 50, rowH = 0;
  const BG = 80; // atstarpe starp sadaļām
  const blocked = (x0, y0, w, d) => hole && x0 < hole.x1 && x0 + w > hole.x0 && y0 < hole.y1 && y0 + d > hole.y0;
  for (const b of blocks) {
    for (let guard = 0; guard < 50; guard++) {
      if (x > MARGIN && x + b.w > width - MARGIN) {
        y += rowH + BG;
        x = MARGIN;
        rowH = 0;
      }
      if (!blocked(x, y, b.w, b.h)) break;
      x = Math.max(x + 10, hole.x1 + GAP);
    }
    if (b.name) labels.push({ text: b.name, x: x + b.w / 2, y: y + 9 * sc });
    for (const it of b.items) items.push({ k: it.k, x: x + it.x, y: y + it.y });
    x += b.w + BG;
    rowH = Math.max(rowH, b.h);
  }
  y += rowH;
  return { items, labels, height: Math.max(N, Math.ceil((y + MARGIN) / 50) * 50) };
}

/** Elementi kārtīgā režģī pa sadaļām; telpa pielāgojas saturam (vismaz 10 × 10 m, guļus formātā). */
function buildItemsVariant(f, nid, plan) {
  const { W, I, label } = builder(f, nid);
  const keys = plan.sections.flatMap((s) => s.items);
  const area = keys.reduce((s, k) => s + (ITEMS[k].w + GAP) * (ITEMS[k].d + GAP), 0);
  const maxW = keys.reduce((m, k) => Math.max(m, ITEMS[k].w), 0);
  let width = Math.max(N, maxW + 2 * MARGIN, Math.ceil(Math.sqrt(area * 1.2) / 100) * 100);
  let res;
  for (;;) {
    // Brīvā vieta centrā atkarīga no augstuma — dažas iterācijas, līdz tas nostabilizējas.
    // Augstums aug monotoni, līdz saturs ietilpst ar brīvo vietu tieši telpas centrā.
    let height = N;
    for (let i = 0; i < 20; i++) {
      const sc = pxScale(width);
      const hole = { x0: width / 2 - 140 * sc, x1: width / 2 + 140 * sc, y0: height / 2 - 25 * sc, y1: height / 2 + 45 * sc };
      res = packGrid(plan, width, hole);
      if (res.height <= height) break;
      height = res.height;
    }
    res.height = height;
    if (res.height <= Math.max(N, width * 0.72) || width > 6000) break;
    width += 100;
  }
  for (const it of res.items) I(it.k, it.x, it.y, 0);
  for (const l of res.labels) label(l.text, l.x, l.y, 13);
  boxWalls(W, f, width, res.height);
  label(`${plan.title} (${keys.length})`, width / 2, 30 * pxScale(width) + 10, 20);
}

/** Logu un durvju varianti gar telpas sienām. */
function buildOpeningsVariant(f, nid, plan) {
  const { W, label } = builder(f, nid);
  const specs = plan.openings;
  const ext = (o) => (o.variant === 'pocket' || o.variant === 'pocket2' ? o.width * 1.95 : o.width);
  // Izmēģina izvietojumu gar četrām sienām; telpu palielina, līdz viss ietilpst.
  const pack = (width, height) => {
    const lens = [width, height, width, height];
    const out = [];
    let side = 0, pos = 150;
    for (const sp of specs) {
      const w = ext(sp);
      while (side < 4 && pos + w > lens[side] - 150) {
        side += 1;
        pos = 150;
      }
      if (side > 3) return null;
      out.push({ sp, side, pos });
      pos += w + GAP;
    }
    return out;
  };
  let width = N, height = N, placed = pack(width, height);
  while (!placed) {
    width += 100;
    height = Math.max(N, Math.round(width / 2 / 100) * 100);
    placed = pack(width, height);
  }
  const walls = boxWalls(W, f, width, height);
  const sides = [walls.T, walls.R, walls.B, walls.L];
  let idx = 0;
  for (const { sp, side, pos } of placed) {
    const wall = sides[side];
    const { t, name, icon, ...rest } = sp;
    // Iebīdāmo durvju kabata ir sienā pa kreisi (hinge: false) vai abās pusēs.
    const lead = sp.variant === 'pocket' ? sp.width * 0.95 : sp.variant === 'pocket2' ? sp.width * 0.475 : 0;
    const o = makeOpening(rest.type, wall.id, WALL / 2 + pos + lead + sp.width / 2, rest);
    o.id = nid();
    f.openings.push(o);
    // Nosaukums telpā pie atvēruma
    const c = wallPoint(wall, o.pos), n = wallNormal(wall);
    const sc = pxScale(width);
    const off = (side % 2 ? 40 + name.length * 3 * sc : (60 + (idx % 2) * 26) * sc) + (sp.variant === 'garage' ? 70 : 0);
    label(name, Math.round(c.x + n.x * off), Math.round(c.y + n.y * off), 11);
    idx += 1;
  }
  label(`${plan.title} (${specs.length})`, width / 2, height / 2 - 80, 20);
}

function variantFloor(main, nid) {
  const f = newFloor(main.name, main.elevation, main.height);
  Object.assign(f, { id: nid(), group: main.id, variant: true });
  return f;
}

export function showroomProject() {
  const p = newProject('100 m² paraugtelpa');
  p.address = 'Paraugu iela 1, Rīga';
  p.status = 'progress';
  const nid = idGen('s');
  const main = p.floors[0];
  main.id = nid();
  main.group = main.id;
  buildMain(main, nid);
  for (const plan of catalogPlan()) {
    const f = variantFloor(main, nid);
    if (plan.openings) buildOpeningsVariant(f, nid, plan);
    else buildItemsVariant(f, nid, plan);
    detectRooms(f);
    for (const r of f.rooms) {
      r.id = nid();
      Object.assign(r, { name: plan.title.split(' › ').pop(), floorFinish: 'concrete' });
    }
    f.catalog = plan.id;
    p.floors.push(f);
  }
  return p;
}

// ---------- Izkārtojuma pārbaude (testiem un izstrādei) ----------

const ROT_SWAP = (it) => Math.round(((it.rot || 0) % 180 + 180) % 180) === 90;

/** Priekšmeta aizņemtais taisnstūris plānā (pagriezieni pa 90°). */
export function footprint(it) {
  const swap = ROT_SWAP(it);
  const w = swap ? it.d : it.w, d = swap ? it.w : it.d;
  return { x0: it.x - w / 2, y0: it.y - d / 2, x1: it.x + w / 2, y1: it.y + d / 2 };
}

const overlap1 = (a0, a1, b0, b1) => Math.min(a1, b1) - Math.max(a0, b0);

function wallRect(w) {
  const h = w.thickness / 2;
  return { x0: Math.min(w.a.x, w.b.x) - h, y0: Math.min(w.a.y, w.b.y) - h, x1: Math.max(w.a.x, w.b.x) + h, y1: Math.max(w.a.y, w.b.y) + h };
}

// Cik dziļi durvju vērtne ieiet telpā (aptuveni, pēc zīmējuma).
function swingDepth(o) {
  switch (o.variant) {
    case 'opening': case 'pocket': case 'pocket2': case 'window': case 'french': case 'french4': return 0;
    case 'sliding': case 'sliding2': case 'stack': case 'slideSys': case 'frenchSliding': return 14;
    case 'double': case 'pivot2': return o.width / 2;
    case 'pivot': return o.width * 0.75;
    case 'bifold': return o.width * 0.25;
    case 'bifold2': return o.width * 0.12;
    case 'accordion': return 10;
    case 'garage': return o.height * 0.3;
    default: return o.type === 'door' ? o.width : 0;
  }
}

/** Vai priekšmeta aizmugure (lokālā −y puse) pieskaras sienai. */
export function backOnWall(floor, it) {
  const rad = ((it.rot || 0) * Math.PI) / 180;
  const back = { x: it.x + Math.sin(rad) * (it.d / 2 + 1), y: it.y - Math.cos(rad) * (it.d / 2 + 1) };
  return floor.walls.some((w) => {
    const r = wallRect(w);
    return back.x >= r.x0 - 0.5 && back.x <= r.x1 + 0.5 && back.y >= r.y0 - 0.5 && back.y <= r.y1 + 0.5;
  });
}

/** Atvēruma aizņemtais posms gar sienu (ar iebīdāmo durvju kabatām). */
export function openingSpan(o) {
  const half = o.width / 2;
  let a = o.pos - half, b = o.pos + half;
  if (o.variant === 'pocket') {
    if (o.hinge) b += o.width * 0.95; else a -= o.width * 0.95;
  } else if (o.variant === 'pocket2') {
    a -= half * 0.95;
    b += half * 0.95;
  }
  return [a, b];
}

/**
 * Atgriež izkārtojuma problēmas: pārklājošies priekšmeti, priekšmeti sienās, sienas elementi,
 * kas nepieskaras sienai, atvērumi ārpus sienas vai pāri savienojumiem, durvju vēršanās zonā priekšmeti.
 */
export function layoutProblems(floor) {
  const out = [];
  const items = floor.items;
  const rects = items.map(footprint);
  const inWall = items.map((it) => it.d <= 8 && Math.max(it.w, it.d) <= 30 && backOnWall(floor, it));
  for (let i = 0; i < items.length; i++) {
    const a = items[i], ra = rects[i];
    for (let j = i + 1; j < items.length; j++) {
      const b = items[j], rb = rects[j];
      if (overlap1(ra.x0, ra.x1, rb.x0, rb.x1) <= 0.5 || overlap1(ra.y0, ra.y1, rb.y0, rb.y1) <= 0.5) continue;
      // Iebūvētās daļas (izlietne virsmā, plīts uz skapja) drīkst iegrimt līdz 6 cm.
      if (overlap1(a.elev, a.elev + a.h, b.elev, b.elev + b.h) <= 6) continue;
      // Zemapmetuma izvadi un rozetes ir sienā — tās drīkst būt aiz skapja, bet ne cita uz citas.
      if (inWall[i] !== inWall[j]) continue;
      out.push(`pārklājas: ${a.kind} un ${b.kind}`);
    }
    for (const w of floor.walls) {
      const r = wallRect(w);
      if (overlap1(ra.x0, ra.x1, r.x0, r.x1) > 0.5 && overlap1(ra.y0, ra.y1, r.y0, r.y1) > 0.5) out.push(`sienā: ${a.kind}`);
    }
    // Plāni sienas elementi (rozetes, radiatori, sienas lampas) jānovieto pie sienas ar aizmuguri pret to.
    const thin = a.d <= 15 && a.elev > 0 && a.elev < 230 && Math.max(a.w, a.d) < 200;
    if (thin) {
      if (!backOnWall(floor, a)) out.push(`nav pie sienas: ${a.kind} (${a.x}, ${a.y}, rot ${a.rot})`);
    }
  }
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (!w) {
      out.push(`atvērumam nav sienas: ${o.variant}`);
      continue;
    }
    const L = wallLength(w);
    const [s0, s1] = openingSpan(o);
    if (s0 < 0 || s1 > L) out.push(`ārpus sienas: ${o.variant}`);
    for (const x of floor.walls) {
      if (x === w) continue;
      for (const p of [x.a, x.b]) {
        const pr = projectOnSegment(p, w.a, w.b);
        if (pr.dist > w.thickness / 2 + 1) continue;
        const along = pr.t * L, half = x.thickness / 2;
        if (along + half > s0 && along - half < s1) out.push(`atvērums pāri savienojumam: ${o.variant}`);
      }
    }
    for (const q of floor.openings) {
      if (q === o || q.wallId !== o.wallId || q.id < o.id) continue;
      const [t0, t1] = openingSpan(q);
      if (overlap1(s0, s1, t0, t1) > 0) out.push(`atvērumi pārklājas: ${o.variant} un ${q.variant}`);
    }
    // Durvju vērtnes zona nedrīkst būt aizņemta ar priekšmetiem.
    let depth = swingDepth(o), a0 = o.pos - o.width / 2, a1 = o.pos + o.width / 2;
    if (o.variant === 'windoor') {
      depth = o.doorWidth || 80;
      const dw = o.doorWidth || 80;
      if (o.hinge) a0 = a1 - dw; else a1 = a0 + dw;
    }
    if (depth > 0) {
      const n = wallNormal(w), ss = o.swing ? -1 : 1;
      const pts = [];
      for (const al of [a0, a1]) for (const ac of [w.thickness / 2, w.thickness / 2 + depth]) {
        const p = wallPoint(w, al);
        pts.push({ x: p.x + n.x * ss * ac, y: p.y + n.y * ss * ac });
      }
      const box = { x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)), y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)) };
      items.forEach((it, i) => {
        const r = rects[i];
        if (it.elev >= 200) return;
        if (overlap1(r.x0, r.x1, box.x0, box.x1) > 0.5 && overlap1(r.y0, r.y1, box.y0, box.y1) > 0.5) out.push(`durvju zonā: ${it.kind} (${o.variant})`);
      });
    }
  }
  return out;
}
