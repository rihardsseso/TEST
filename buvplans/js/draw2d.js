// Stāva zīmēšana uz canvas rasējuma stilā: tiek lietota gan redaktorā, gan albuma lapās.
import { polygonArea, polygonCentroid, interiorPoint, sub, norm, add, mul, cross, rotate, bounds, dist } from './geometry.js';
import { wallDir, wallNormal, wallPoint, wallLength, wallKind, roomTiling, tilePieces, windowCasements, cameraSector, cornerDistances, waterOutputs, WATER_OUTPUTS, LAYINGS } from './model.js';
import { drawItem2D, isPoint, finish, FLOOR_FINISHES, categoryOf, byKind, needsLabel } from './catalog.js';
import { layerMode, wallMode } from './stages.js';
import { fmt } from './calc.js';
import { wallFaceDims } from './dims.js';
import { wallMaterial, paintMaterial } from './walls.js';
import { LINE_TYPES, ZONE_TYPES, FINISHES } from './catalog-data.js';
import { unitName } from './units.js';

export const THEME = {
  bg: '#ffffff', grid: '#eef0f2', gridMajor: '#d9dde1', ink: '#222222', muted: '#555555', line: '#2b2b2b',
  hatch: '#6f6f6f', newFill: '#dcdcdc', demolish: '#d93025', accent: '#f08c00', accentSoft: 'rgba(240,140,0,0.16)',
  glass: '#ffffff', dim: '#333333', label: '#e0312b', itemStroke: '#3a3a3a', wire: '#d93025',
  font: '"Roboto", Arial, sans-serif', mono: '"Roboto", Arial, sans-serif',
};
export const readTheme = () => THEME;

/** Ko rādīt plānā (apakšējās joslas „Rādīt/slēpt elementus”). */
export const SHOW_DEFAULTS = {
  wallDims: true, extDims: true, userDims: true, itemDims: false, heights: false, roomNumbers: true, areas: true,
  furniture: true, outlets: true, finishing: true, water: true, linear: true, lighting: true, ac: true, wireLengths: false, comments: true,
};
const SHOW_LAYERS = { furniture: ['furniture', 'santeh'], outlets: ['sockets', 'light_connections'], water: ['waterplan'], lighting: ['light'], ac: ['conditioners', 'ventilation'] };

const imageCache = new Map();
export function cachedImage(src, onload) {
  if (!src) return null;
  let img = imageCache.get(src);
  if (!img) {
    img = new Image();
    img.onload = () => onload && onload();
    img.src = src;
    imageCache.set(src, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

const patterns = new WeakMap();
const patternMap = (ctx) => {
  let map = patterns.get(ctx);
  if (!map) patterns.set(ctx, (map = new Map()));
  return map;
};

function hatch(ctx, color, bg) {
  const map = patternMap(ctx), k = color + bg;
  if (!map.has(k)) {
    const c = document.createElement('canvas');
    c.width = c.height = 7;
    const g = c.getContext('2d');
    g.fillStyle = bg;
    g.fillRect(0, 0, 7, 7);
    g.strokeStyle = color;
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(-1, 8); g.lineTo(8, -1);
    g.moveTo(-1, 1); g.lineTo(1, -1);
    g.moveTo(6, 8); g.lineTo(8, 6);
    g.stroke();
    map.set(k, ctx.createPattern(c, 'repeat'));
  }
  return map.get(k);
}

/** Sienas materiāla šķērssvītrojums (gāzbetons — punkti, ķieģeļi — blīvas svītras u. c.). */
function materialPattern(ctx, mat) {
  const map = patternMap(ctx), k = `wall:${mat.id}`;
  if (!map.has(k)) {
    const c = document.createElement('canvas');
    c.width = c.height = 12;
    paintMaterial(c.getContext('2d'), mat, 12);
    map.set(k, ctx.createPattern(c, 'repeat'));
  }
  return map.get(k);
}

/** Virsmas raksts (grīdas segums, griesti, zonas) ar materiāla krāsu. */
export function surfacePattern(ctx, color, pattern, alpha = 0.6) {
  const map = patternMap(ctx), k = `surf:${color}:${pattern}:${alpha}`;
  if (map.has(k)) return map.get(k);
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 24, 24);
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillRect(0, 0, 24, 24);
  g.globalAlpha = 0.55;
  g.strokeStyle = '#5b4d3c';
  g.fillStyle = '#5b4d3c';
  g.lineWidth = 0.7;
  g.beginPath();
  switch (pattern) {
    case 'parquet':
      for (let y = -24; y < 48; y += 8) { g.moveTo(0, y); g.lineTo(12, y + 12); g.lineTo(24, y); }
      g.moveTo(12, 0); g.lineTo(12, 24);
      break;
    case 'planks': case 'deck':
      for (let y = 0; y < 24; y += 6) { g.moveTo(0, y + 0.5); g.lineTo(24, y + 0.5); }
      g.moveTo(6.5, 0); g.lineTo(6.5, 6); g.moveTo(18.5, 6); g.lineTo(18.5, 12); g.moveTo(10.5, 12); g.lineTo(10.5, 18); g.moveTo(2.5, 18); g.lineTo(2.5, 24);
      break;
    case 'tiles':
      g.strokeStyle = '#7d858c';
      g.moveTo(0, 0.5); g.lineTo(24, 0.5); g.moveTo(0, 12.5); g.lineTo(24, 12.5);
      g.moveTo(0.5, 0); g.lineTo(0.5, 24); g.moveTo(12.5, 0); g.lineTo(12.5, 24);
      break;
    case 'smalltiles':
      g.strokeStyle = '#7d858c';
      for (let i = 0; i < 24; i += 6) { g.moveTo(0, i + 0.5); g.lineTo(24, i + 0.5); g.moveTo(i + 0.5, 0); g.lineTo(i + 0.5, 24); }
      break;
    case 'hex':
      g.strokeStyle = '#7d858c';
      for (const [cx, cy] of [[6, 6], [18, 6], [0, 16], [12, 16], [24, 16]]) {
        for (let a = 0; a <= 6; a++) {
          const r = (a * Math.PI) / 3 + Math.PI / 6;
          const x = cx + Math.cos(r) * 6, y = cy + Math.sin(r) * 6;
          if (a) g.lineTo(x, y); else g.moveTo(x, y);
        }
      }
      break;
    case 'carpet':
      for (let y = 2; y < 24; y += 4) for (let x = (y % 8) ? 2 : 4; x < 24; x += 4) g.rect(x, y, 1, 1);
      g.fill();
      break;
    case 'cork': case 'stone':
      for (const [x, y] of [[3, 4], [17, 2], [9, 11], [20, 15], [5, 19], [14, 21], [11, 6], [22, 9], [7, 14], [16, 9]]) g.rect(x, y, 1.3, 1.3);
      g.fill();
      break;
    case 'wallpaper':
      for (let x = 4; x < 24; x += 8) { g.moveTo(x, 0); g.lineTo(x, 24); }
      break;
    case 'brick':
      for (let y = 0; y < 24; y += 6) { g.moveTo(0, y + 0.5); g.lineTo(24, y + 0.5); }
      for (let y = 0; y < 24; y += 6) { const o = (y / 6) % 2 ? 6 : 0; g.moveTo(o + 0.5, y); g.lineTo(o + 0.5, y + 6); g.moveTo(o + 12.5, y); g.lineTo(o + 12.5, y + 6); }
      break;
    case 'screed':
      g.moveTo(0, 24); g.lineTo(24, 0); g.moveTo(-12, 24); g.lineTo(12, 0); g.moveTo(12, 24); g.lineTo(36, 0);
      g.stroke();
      g.beginPath();
      for (const [x, y] of [[4, 4], [16, 8], [9, 18], [20, 20]]) g.rect(x, y, 1.4, 1.4);
      g.fill();
      break;
    case 'insulation':
      g.moveTo(0, 4); g.lineTo(6, 20); g.lineTo(12, 4); g.lineTo(18, 20); g.lineTo(24, 4);
      break;
    case 'snake':
      g.strokeStyle = '#c0392b';
      g.lineWidth = 1.2;
      g.moveTo(3, 0); g.lineTo(3, 24); g.moveTo(9, 0); g.lineTo(9, 24); g.moveTo(15, 0); g.lineTo(15, 24); g.moveTo(21, 0); g.lineTo(21, 24);
      break;
    case 'stripes':
      for (let x = 2; x < 24; x += 6) { g.rect(x, 0, 2, 24); }
      g.fill();
      break;
    case 'cross':
      g.moveTo(0, 0); g.lineTo(24, 24); g.moveTo(24, 0); g.lineTo(0, 24);
      break;
    default:
      break;
  }
  g.stroke();
  const pat = ctx.createPattern(c, 'repeat');
  map.set(k, pat);
  return pat;
}

const LEGACY_FLOOR_PATTERN = { parquet: 'parquet', laminate: 'planks', tile: 'tiles', darktile: 'tiles', carpet: 'carpet', concrete: 'stone' };
/** Apdares definīcija: { name, color, pattern }. */
export function finishDef(target, id) {
  if (!id) return null;
  const d = FINISHES[target]?.[id];
  if (d) return d;
  if (target === 'floor') {
    const f = FLOOR_FINISHES.find((x) => x.id === id);
    if (f) return { name: f.name, color: f.color, pattern: LEGACY_FLOOR_PATTERN[id] || 'plain' };
  }
  return null;
}

/** Garuma formāts atbilstoši izvēlētajām mērvienībām. */
export function fmtLen(cm, units = 'cm') {
  if (units === 'mm') return String(Math.round(cm * 10));
  if (units === 'm') return fmt(cm / 100, 2);
  if (units === 'in') return fmt(cm / 2.54, 1);
  return String(Math.round(cm));
}

/** Elektrības un ūdens punkti ekrānā nedrīkst kļūt nesaskatāmi mazi. */
export function itemDrawScale(it, scale) {
  if (!isPoint(it)) return 1;
  return Math.max(1, 18 / (Math.max(it.w, it.d) * scale));
}

export { wallKind };

export function floorBounds(floor) {
  const pts = [];
  for (const w of floor.walls) pts.push(w.a, w.b);
  for (const r of floor.rooms) pts.push(...r.points);
  for (const it of floor.items) pts.push({ x: it.x - it.w / 2, y: it.y - it.d / 2 }, { x: it.x + it.w / 2, y: it.y + it.d / 2 });
  for (const d of floor.dims) pts.push(d.a, d.b);
  for (const l of floor.lines || []) pts.push(...l.points);
  for (const z of floor.zones || []) pts.push(...z.points);
  return bounds(pts);
}

export function fitView(floor, width, height, pad = 40) {
  const b = floorBounds(floor) || { minX: 0, minY: 0, w: 1000, h: 800 };
  const scale = Math.min((width - pad * 2) / Math.max(b.w, 100), (height - pad * 2) / Math.max(b.h, 100));
  return { scale, ox: (width - b.w * scale) / 2 - b.minX * scale, oy: (height - b.h * scale) / 2 - b.minY * scale };
}

const WALL_COLORS = { grey: '#a3a3a3', black: '#2b2b2b' };

/** Novērošanas kamera (redzes lauks plānā). */
export const isCamera = (it) => {
  const def = byKind(it.kind);
  return def?.sym === 'camera' || (def?.stage === 'security' && /kamer/i.test(it.name || def?.name || ''));
};
/** Ekrāns (TV, monitors), kura platumu nosaka diagonāle. */
export const isScreen = (it) => {
  const def = byKind(it.kind);
  if (!def || def.electric || def.water || def.sym === 'tv') return false;
  return def.sym === 'tvWall' || /monitor|televizor|\bTV\b|ekrān/i.test(def.name);
};

/** Vai izmērs/komentārs redzams šajā lapā („Rādīt visās lapās”). */
export const onSheet = (o, stage) => o.allSheets !== false || !stage || (o.layer || 'init') === stage.id;

/** Grīdas seguma elementi (flīzes, dēļi) telpā ar šuvēm, pagriezienu un ieklāšanas veidu. */
function drawTiles(ctx, r, fd, S, scale) {
  const tl = roomTiling(r, fd);
  if (!tl || Math.min(tl.L, tl.W) * scale < 2.5) return false;
  const pieces = tilePieces(r.points, tl);
  if (!pieces) return false;
  ctx.save();
  pathPoly(ctx, r.points.map(S));
  ctx.clip();
  ctx.fillStyle = tl.grout > 0 ? '#a7abb0' : '#ffffff';
  ctx.fill();
  ctx.beginPath();
  for (const pc of pieces) {
    const q = pc.map(S);
    q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = fd.color;
  ctx.fill();
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = '#4a3f33';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();
  return true;
}

/** Ūdens izvadu grupa ar lietotāja izvēlētiem izvadiem un secību. */
function drawWaterGroup(ctx, it) {
  const outs = waterOutputs(it), n = outs.length, w = it.w, d = it.d;
  const r = Math.min(w / Math.max(n, 1), d) / 2;
  outs.forEach((k, i) => {
    const x = n === 1 ? 0 : -w / 2 + r + (i * (w - 2 * r)) / (n - 1);
    ctx.beginPath();
    ctx.arc(x, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.save();
    ctx.fillStyle = WATER_OUTPUTS[k].color;
    ctx.font = `600 ${r * 1.3}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(WATER_OUTPUTS[k].letter, x, r * 0.08);
    ctx.restore();
  });
}

/**
 * Zīmē stāvu. `view` = { scale (px uz cm), ox, oy }, `opts` = { stage, grid, dims, units, show, selection, hover, faceHover, width, height }.
 */
export function drawFloor(ctx, floor, view, t, opts = {}) {
  const { scale, ox, oy } = view;
  const S = (p) => ({ x: p.x * scale + ox, y: p.y * scale + oy });
  const W = opts.width, H = opts.height, stage = opts.stage || null;
  const show = { ...SHOW_DEFAULTS, ...(opts.show || {}) };
  const sel = opts.selection, hov = opts.hover;
  const isSel = (kind, id) => sel && sel.kind === kind && sel.id === id;
  const isHov = (kind, id) => hov && hov.kind === kind && hov.id === id;
  const hiddenByShow = (layer) => Object.entries(SHOW_LAYERS).some(([k, layers]) => !show[k] && layers.includes(layer) && layer !== stage?.id);

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);

  const bg = floor.background;
  if (bg && bg.visible !== false) {
    const img = cachedImage(bg.src, opts.onImage);
    if (img) {
      const wcm = bg.widthCm || 1000;
      const hcm = (wcm * img.naturalHeight) / img.naturalWidth;
      ctx.globalAlpha = bg.opacity ?? 0.5;
      const p = S({ x: bg.x || 0, y: bg.y || 0 });
      ctx.drawImage(img, p.x, p.y, wcm * scale, hcm * scale);
      ctx.globalAlpha = 1;
    }
  }
  if (opts.grid) drawGrid(ctx, view, W, H, t);

  const zones = (floor.zones || []).map((z) => ({ z, mode: layerMode(stage, z.layer || 'init') })).filter((x) => x.mode !== 'hidden');
  // Zemes gabals un terase — zem visa pārējā
  for (const { z, mode } of zones.filter((x) => x.z.type === 'plot' || x.z.type === 'terrace')) drawZone(ctx, z, mode, S, t, isSel('zones', z.id) || isHov('zones', z.id), opts.units);

  // Grīdas: kontūrs izriet no sienām; apdares stadijās redzams materiāls
  const fill = stage?.roomFill || (opts.floors ? 'floor' : null);
  for (const r of floor.rooms) {
    if (r.points.length < 3) continue;
    pathPoly(ctx, r.points.map(S));
    const fieldOf = { floor: 'floorFinish', ceiling: 'ceiling', screed: 'screed', waterFloor: 'waterFloor', plasterCeiling: 'plasterCeiling' };
    const fd = fill ? finishDef(fill, r[fieldOf[fill]]) : null;
    if (fd) {
      ctx.fillStyle = surfacePattern(ctx, fd.color, fd.pattern);
      ctx.fill();
      if (fill === 'floor' && drawTiles(ctx, r, fd, S, scale)) pathPoly(ctx, r.points.map(S));
    } else if (r.color && stage?.id === 'rooms') {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (isSel('rooms', r.id) || isHov('rooms', r.id)) {
      ctx.fillStyle = isSel('rooms', r.id) ? 'rgba(240,140,0,0.22)' : 'rgba(240,140,0,0.1)';
      ctx.fill();
    }
  }
  for (const { z, mode } of zones.filter((x) => x.z.type !== 'plot' && x.z.type !== 'terrace')) drawZone(ctx, z, mode, S, t, isSel('zones', z.id) || isHov('zones', z.id), opts.units);

  // Sienas: kontūras, tad pildījums (starpsienas, jaunās, nesošās, nojaucamās), lai savienojumi saplūst.
  const all = floor.walls.map((w) => ({ w, mode: wallMode(stage, w) })).filter((x) => x.mode !== 'hidden');
  const walls = all.filter((x) => x.w.kind !== 'virtual');
  const visibleIds = new Set(walls.map((x) => x.w.id));
  const seg = (w) => {
    const a = S(w.a), b = S(w.b);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  };
  // Telpu zonējuma līnijas (virtuālas sienas)
  for (const { w } of all.filter((x) => x.w.kind === 'virtual')) {
    seg(w);
    ctx.setLineDash([8, 5]);
    ctx.lineWidth = isSel('walls', w.id) || isHov('walls', w.id) ? 3 : 1.4;
    ctx.strokeStyle = isSel('walls', w.id) || isHov('walls', w.id) ? t.accent : '#7a7a7a';
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.lineCap = 'square';
  for (const { w, mode } of walls) {
    seg(w);
    ctx.lineWidth = w.thickness * scale + 1.6;
    ctx.strokeStyle = mode === 'demolish' ? t.demolish : t.line;
    ctx.stroke();
  }
  const order = { partition: 0, balcony: 0, new: 1, bearing: 2, demolish: 3 };
  const fillKind = ({ w, mode }) => (mode === 'demolish' ? 'demolish' : mode === 'new' ? 'new' : wallKind(w));
  for (const x of [...walls].sort((p, q) => (order[fillKind(p)] ?? 1) - (order[fillKind(q)] ?? 1))) {
    const k = fillKind(x);
    seg(x.w);
    ctx.lineWidth = Math.max(0.5, x.w.thickness * scale - 1.4);
    const mat = wallMaterial(x.w.material);
    ctx.strokeStyle = k === 'demolish' ? hatch(ctx, t.demolish, '#fff4f3') : WALL_COLORS[x.w.color] || (mat ? materialPattern(ctx, mat)
      : k === 'bearing' ? hatch(ctx, t.hatch, t.bg) : k === 'new' ? t.newFill : t.bg);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // Sienu virsmu apdare (krāsa, flīzes, izolācija, apmetums, hidroizolācija)
  const faceTarget = stage?.faces || (!stage && show.finishing ? 'wall' : null);
  for (const { w } of walls) {
    for (const side of ['p', 'n']) {
      const val = faceTarget && w.faces?.[side]?.[faceTarget];
      const hovered = opts.faceHover && opts.faceHover.id === w.id && opts.faceHover.side === side;
      if (!val && !hovered) continue;
      const fd = val ? FINISHES[faceTarget]?.[val] : null;
      const s = side === 'p' ? 1 : -1, n = wallNormal(w);
      const off = mul(n, s * (w.thickness / 2 + 3 / scale));
      const a = S(add(w.a, off)), b = S(add(w.b, off));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = faceTarget === 'insulation' ? 7 : 5;
      ctx.strokeStyle = hovered ? t.accent : fd?.color || '#999';
      ctx.globalAlpha = hovered && !val ? 0.6 : 0.95;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  for (const { w } of walls) {
    if (!isSel('walls', w.id) && !isHov('walls', w.id)) continue;
    seg(w);
    ctx.lineWidth = w.thickness * scale;
    ctx.strokeStyle = t.accent;
    ctx.globalAlpha = isSel('walls', w.id) ? 0.55 : 0.3;
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (isSel('walls', w.id)) for (const p of [S(w.a), S(w.b)]) handle(ctx, p, t);
  }

  // Ailes (jaunās nav redzamas esošajā situācijā; demontētās — sarkanas demontāžā, vēlāk tikai aile)
  const early = stage && (stage.id === 'init' || stage.id === 'break_walls');
  const openings = floor.openings.filter((o) => visibleIds.has(o.wallId) && !(early && o.status === 'new'));
  for (const o of openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    const demolished = o.status === 'demolish';
    const view2 = demolished && !early ? { ...o, variant: 'opening', type: 'door' } : o;
    drawOpening(ctx, view2, w, view, t, isSel('openings', o.id) || isHov('openings', o.id), false, demolished && stage?.id === 'break_walls');
  }

  // Izmēri gar sienām
  if (opts.dims && (!stage || stage.dims) && (show.wallDims || show.extDims)) {
    drawWallDims(ctx, floor, walls.map((x) => x.w), openings, view, t, opts.units, show);
  }

  // Līnijas: caurules, kabeļi, gaisa vadi, sijas, margas
  for (const ln of floor.lines || []) {
    const mode = layerMode(stage, ln.layer || 'init');
    if (mode === 'hidden' || ln.points.length < 2 || hiddenByShow(ln.layer)) continue;
    if (!show.linear && (ln.type === 'linear' || ln.type === 'led')) continue;
    drawLine(ctx, ln, mode, S, scale, t, isSel('lines', ln.id) || isHov('lines', ln.id), show.wireLengths, opts.units);
  }

  // Priekšmeti
  const items = floor.items.map((it) => ({ it, mode: layerMode(stage, categoryOf(it)) }))
    .filter((x) => x.mode !== 'hidden' && !hiddenByShow(categoryOf(x.it)) && !(x.it.status === 'demolish' && stage && !early));
  items.sort((a, b) => (a.mode === 'faded' ? 0 : 1) - (b.mode === 'faded' ? 0 : 1));
  // Kameru redzes lauki — zem priekšmetiem
  for (const { it, mode } of items) {
    if (!isCamera(it) || it.showFov === false) continue;
    const sc = cameraSector(it), c = S(sc), a0 = ((sc.dir - sc.angle / 2) * Math.PI) / 180, a1 = ((sc.dir + sc.angle / 2) * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.arc(c.x, c.y, sc.radius * scale, a0, a1);
    ctx.closePath();
    ctx.globalAlpha = mode === 'faded' ? 0.3 : 1;
    ctx.fillStyle = 'rgba(47,111,214,0.13)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(47,111,214,0.75)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  const multi = opts.multi || new Set();
  for (const { it, mode } of items) {
    const p = S(it);
    const k = itemDrawScale(it, scale);
    ctx.save();
    ctx.globalAlpha = mode === 'faded' ? 0.28 : 1;
    ctx.translate(p.x, p.y);
    ctx.rotate(((it.rot || 0) * Math.PI) / 180);
    if (it.kind === '__image') {
      const img = cachedImage(it.src, opts.onImage);
      if (img) ctx.drawImage(img, (-it.w / 2) * scale, (-it.d / 2) * scale, it.w * scale, it.d * scale);
      else ctx.strokeRect((-it.w / 2) * scale, (-it.d / 2) * scale, it.w * scale, it.d * scale);
    } else {
      ctx.scale(scale * k, scale * k);
      ctx.lineWidth = 1 / (scale * k);
      ctx.fillStyle = it.color || '#ddd';
      ctx.strokeStyle = t.itemStroke;
      ctx.lineJoin = 'round';
      if (it.mirror) ctx.scale(-1, 1);
      if (byKind(it.kind)?.sym === 'waterGroup') drawWaterGroup(ctx, it);
      else drawItem2D(ctx, it);
      if (it.mirror) ctx.scale(-1, 1);
      if (it.status === 'demolish') {
        ctx.strokeStyle = t.demolish;
        ctx.lineWidth = 2.5 / (scale * k);
        ctx.beginPath();
        ctx.moveTo(-it.w / 2, -it.d / 2); ctx.lineTo(it.w / 2, it.d / 2);
        ctx.moveTo(it.w / 2, -it.d / 2); ctx.lineTo(-it.w / 2, it.d / 2);
        ctx.stroke();
      }
    }
    ctx.restore();
    // Nosaukums vispārīgiem simboliem, izmēri un augstumi
    const sw = it.w * scale * k, sd = it.d * scale * k;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (it.kind !== '__image' && needsLabel(it) && Math.min(sw, sd) > 16 && sw > 40) {
      ctx.globalAlpha = mode === 'faded' ? 0.35 : 0.85;
      ctx.fillStyle = t.ink;
      ctx.font = `${Math.max(8, Math.min(11, sd * 0.3))}px ${t.font}`;
      const name = it.name || byKind(it.kind)?.name || '';
      fitText(ctx, name, p.x, p.y, Math.max(sw, sd) - 6);
      ctx.globalAlpha = 1;
    }
    let below = Math.max(sw, sd) / 2 + 8;
    if ((mode === 'active' && (show.itemDims || show.heights)) || it.showDims) {
      ctx.font = `9px ${t.font}`;
      ctx.fillStyle = t.dim;
      const dimsOn = (show.itemDims && mode === 'active') || it.showDims;
      const txt = [dimsOn && !isPoint(it) ? `${fmtLen(it.w, opts.units)}×${fmtLen(it.d, opts.units)}${it.showDims ? `×${fmtLen(it.h, opts.units)}` : ''}` : '', (show.heights || it.showDims) && it.elev ? `h=${fmtLen(it.elev, opts.units)}` : ''].filter(Boolean).join(' ');
      if (txt) {
        ctx.fillText(txt, p.x, p.y + below);
        below += 11;
      }
    }
    if ((it.vcount || 1) > 1 || (it.count || 1) > 1) {
      ctx.font = `600 9px ${t.font}`;
      ctx.fillStyle = t.accent;
      ctx.fillText([it.count > 1 ? `${it.count}×` : '', it.vcount > 1 ? `↕${it.vcount}` : ''].join(' ').trim(), p.x + sw / 2 + 10, p.y - sd / 2);
    }
    if (it.comment && show.comments && mode !== 'faded') {
      ctx.font = `italic 10px ${t.font}`;
      const m = ctx.measureText(it.comment);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(p.x - m.width / 2 - 3, p.y + below - 7, m.width + 6, 14);
      ctx.fillStyle = '#2f6fd6';
      ctx.fillText(it.comment, p.x, p.y + below);
    }
    if (it.showDist && mode !== 'faded') {
      const cd = cornerDistances(floor, it);
      if (cd) {
        for (const end of [cd.a, cd.b]) {
          if (dist(cd.q, end) < 1) continue;
          const dir = norm(sub(end, cd.q)), n = { x: -dir.y, y: dir.x };
          const side = Math.sign((it.x - cd.q.x) * n.x + (it.y - cd.q.y) * n.y) || 1;
          drawDim(ctx, { a: cd.q, b: end, offset: (side * 16) / scale, color: '#2f6fd6' }, view, t, opts.units, false);
        }
      }
    }
    if (isSel('items', it.id) || isHov('items', it.id) || multi.has(it.id)) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(((it.rot || 0) * Math.PI) / 180);
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(-sw / 2 - 2, -sd / 2 - 2, sw + 4, sd + 4);
      ctx.restore();
    }
  }

  if (show.userDims) for (const d of floor.dims) if (onSheet(d, stage)) drawDim(ctx, d, view, t, opts.units, isSel('dims', d.id) || isHov('dims', d.id));

  // Telpu nosaukumi, numuri un sarkanā augstuma/laukuma birka
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  floor.rooms.forEach((r, idx) => {
    if (r.points.length < 3) return;
    const c = S(interiorPoint(r.points));
    const area = polygonArea(r.points) / 1e4;
    if (stage?.roomNumbers && show.roomNumbers) {
      ctx.beginPath();
      ctx.arc(c.x, c.y - 36, 12, 0, Math.PI * 2);
      ctx.fillStyle = t.bg;
      ctx.fill();
      ctx.strokeStyle = t.ink;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = t.ink;
      ctx.font = `600 13px ${t.font}`;
      ctx.fillText(String(idx + 1), c.x, c.y - 35);
    }
    if (!show.areas) return;
    const h1 = `H=${fmtLen(r.height || floor.height, opts.units)}`, h2 = `S=${fmt(area)} m²`;
    ctx.font = `600 11px ${t.font}`;
    const nameW = ctx.measureText(r.name).width;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(c.x - nameW / 2 - 3, c.y - 22, nameW + 6, 14);
    ctx.fillStyle = t.ink;
    ctx.fillText(r.name, c.x, c.y - 15);
    ctx.font = `10px ${t.font}`;
    const bw = Math.max(ctx.measureText(h1).width, ctx.measureText(h2).width) + 10;
    ctx.fillStyle = t.bg;
    ctx.fillRect(c.x - bw / 2, c.y - 5, bw, 26);
    ctx.strokeStyle = t.label;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(c.x - bw / 2) + 0.5, Math.round(c.y - 5) + 0.5, Math.round(bw), 26);
    ctx.beginPath();
    ctx.moveTo(c.x - bw / 2, c.y + 8.5);
    ctx.lineTo(c.x + bw / 2, c.y + 8.5);
    ctx.stroke();
    ctx.fillStyle = t.label;
    ctx.fillText(h1, c.x, c.y + 2);
    ctx.fillText(h2, c.x, c.y + 15);
    // Stadijai atbilstošā apdare zem birkas
    const fieldOf = { floor: 'floorFinish', ceiling: 'ceiling', screed: 'screed', waterFloor: 'waterFloor', plasterCeiling: 'plasterCeiling' };
    const fd = stage?.roomFill ? finishDef(stage.roomFill, r[fieldOf[stage.roomFill]]) : null;
    if (fd) {
      ctx.font = `10px ${t.font}`;
      ctx.fillStyle = t.ink;
      ctx.fillText(fd.name + (stage.roomFill === 'screed' && r.screedLevel ? ` · ${fmtLen(r.screedLevel, opts.units)} ${unitName(opts.units)}` : ''), c.x, c.y + 32);
      if (stage.roomFill === 'floor') {
        const tl = roomTiling(r, fd);
        const extra = [r.tileDims !== false && tl ? `${fmtLen(tl.L, opts.units)}×${fmtLen(tl.W, opts.units)} · ${(LAYINGS.find((x) => x[0] === tl.laying) || [])[1] || ''}${tl.angle ? ` · ${Math.round(tl.angle)}°` : ''}` : '', r.floorRaise ? `pacēlums +${fmtLen(r.floorRaise, opts.units)} ${unitName(opts.units)}` : ''].filter(Boolean).join(' · ');
        if (extra) {
          ctx.font = `9px ${t.font}`;
          const m = ctx.measureText(extra);
          ctx.fillStyle = 'rgba(255,255,255,0.85)';
          ctx.fillRect(c.x - m.width / 2 - 3, c.y + 39, m.width + 6, 12);
          ctx.fillStyle = t.muted;
          ctx.fillText(extra, c.x, c.y + 45);
        }
      }
    }
  });

  if (show.comments) {
    for (const l of floor.labels) {
      if (!onSheet(l, stage)) continue;
      const p = S(l);
      ctx.font = `${l.size || 14}px ${t.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const m = ctx.measureText(l.text);
      if (l.frame) {
        ctx.fillStyle = t.bg;
        ctx.fillRect(p.x - m.width / 2 - 5, p.y - (l.size || 14) / 2 - 4, m.width + 10, (l.size || 14) + 8);
        ctx.strokeStyle = l.color || t.ink;
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x - m.width / 2 - 5, p.y - (l.size || 14) / 2 - 4, m.width + 10, (l.size || 14) + 8);
      }
      ctx.fillStyle = l.color || t.ink;
      ctx.fillText(l.text, p.x, p.y);
      if (isSel('labels', l.id) || isHov('labels', l.id)) {
        ctx.strokeStyle = t.accent;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(p.x - m.width / 2 - 4, p.y - (l.size || 14) / 2 - 4, m.width + 8, (l.size || 14) + 8);
      }
    }
  }
}

function fitText(ctx, text, x, y, maxW) {
  let s = text;
  while (s.length > 3 && ctx.measureText(s).width > maxW) s = s.slice(0, -2);
  if (s !== text) s = `${s.trimEnd()}…`;
  ctx.fillText(s, x, y);
}

function drawZone(ctx, z, mode, S, t, highlight, units) {
  const def = ZONE_TYPES[z.type] || ZONE_TYPES.figure;
  pathPoly(ctx, z.points.map(S));
  ctx.globalAlpha = mode === 'faded' ? 0.3 : 1;
  const fin = z.finish ? FINISHES.floor[z.finish] : null;
  ctx.fillStyle = fin ? surfacePattern(ctx, fin.color, fin.pattern) : def.pattern && def.pattern !== 'none' ? surfacePattern(ctx, def.fill, def.pattern, 0.8) : def.fill;
  ctx.fill();
  ctx.strokeStyle = highlight ? t.accent : def.stroke;
  ctx.lineWidth = highlight ? 2.5 : 1.3;
  if (def.dashed) ctx.setLineDash([8, 5]);
  ctx.stroke();
  ctx.setLineDash([]);
  const c = S(polygonCentroid(z.points));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `10px ${t.font}`;
  ctx.fillStyle = def.stroke;
  ctx.fillText(`${z.label || fin?.name || def.name} · ${fmt(polygonArea(z.points) / 1e4)} m²`, c.x, c.y);
  ctx.globalAlpha = 1;
}

function drawLine(ctx, ln, mode, S, scale, t, highlight, showLength, units) {
  const def = LINE_TYPES[ln.type] || LINE_TYPES.cable;
  const pts = ln.points.map(S);
  const path = () => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  };
  ctx.globalAlpha = mode === 'faded' ? 0.3 : 1;
  ctx.lineJoin = 'round';
  if (def.duct || ln.type === 'beam' || ln.type === 'curtain' || ln.type === 'railing') {
    const wpx = Math.max(3, (ln.width || def.width) * scale);
    path();
    ctx.lineWidth = wpx + 2;
    ctx.strokeStyle = highlight ? t.accent : def.color;
    ctx.setLineDash(def.dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
    path();
    ctx.lineWidth = Math.max(1, wpx - 1.5);
    ctx.strokeStyle = def.duct ? (ln.type === 'ductSupply' ? '#e3eefb' : '#efefef') : t.bg;
    ctx.stroke();
    if (def.duct) {
      // Plūsmas virziena bultiņa vidū
      const i = Math.floor((pts.length - 1) / 2), a = pts[i], b = pts[i + 1];
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d = norm(sub(b, a));
      ctx.beginPath();
      ctx.moveTo(m.x - d.x * 6 - d.y * 4, m.y - d.y * 6 + d.x * 4);
      ctx.lineTo(m.x + d.x * 6, m.y + d.y * 6);
      ctx.lineTo(m.x - d.x * 6 + d.y * 4, m.y - d.y * 6 - d.x * 4);
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else {
    path();
    ctx.lineWidth = highlight ? def.width + 2 : def.width;
    ctx.strokeStyle = highlight ? t.accent : ln.color || def.color;
    ctx.setLineDash(def.dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (showLength) {
    const L = ln.points.reduce((s, p, i) => (i ? s + dist(p, ln.points[i - 1]) : 0), 0);
    const a = pts[0];
    ctx.font = `10px ${t.font}`;
    ctx.fillStyle = def.color;
    ctx.textAlign = 'left';
    ctx.fillText(`${fmt(L / 100)} m`, a.x + 6, a.y - 8);
  }
  ctx.globalAlpha = 1;
}

function pathPoly(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

function handle(ctx, p, t) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = t.bg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = t.accent;
  ctx.stroke();
}

function drawGrid(ctx, view, W, H, t) {
  const { scale, ox, oy } = view;
  const minor = [10, 50, 100, 500].find((s) => s * scale >= 7) || 1000;
  const major = minor < 100 ? 100 : minor * 10;
  const x0 = -ox / scale, y0 = -oy / scale, x1 = (W - ox) / scale, y1 = (H - oy) / scale;
  for (const [step, color] of [[minor, t.grid], [major, t.gridMajor]]) {
    ctx.beginPath();
    for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) {
      const sx = Math.round(x * scale + ox) + 0.5;
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, H);
    }
    for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) {
      const sy = Math.round(y * scale + oy) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(W, sy);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/** Teksts gar līniju, vienmēr lasāms (nav otrādi). */
function textAlong(ctx, p, ang, text, knockout, t) {
  if (ang > Math.PI / 2 || ang <= -Math.PI / 2) ang += Math.PI;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(ang);
  if (knockout) {
    const w = ctx.measureText(text).width + 4;
    ctx.fillStyle = t.bg;
    ctx.fillRect(-w / 2, -6, w, 12);
  }
  ctx.fillStyle = t.dim;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Izmēri gar sienām: iekšējās virsmas — skaitļi telpas pusē, ārējās — izmēru ķēde ar atzīmēm. */
function drawWallDims(ctx, floor, walls, openings, view, t, units, show = SHOW_DEFAULTS) {
  const { scale, ox, oy } = view;
  const S = (p) => ({ x: p.x * scale + ox, y: p.y * scale + oy });
  const at = (f, x, off) => S(add(add(f.origin, mul(f.dir, x)), mul(f.normal, off / scale)));
  ctx.font = `9px ${t.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = t.dim;
  ctx.lineWidth = 0.8;
  for (const f of wallFaceDims(floor, walls, openings)) {
    if ((f.kind === 'outer' && !show.extDims) || (f.kind === 'inner' && !show.wallDims)) continue;
    const ang = Math.atan2(f.dir.y, f.dir.x);
    for (const marks of f.pieces) {
      if (f.kind === 'outer') {
        const a = at(f, marks[0], 22), b = at(f, marks[marks.length - 1], 22);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        const tick = rotate(norm(sub(b, a)), -45);
        for (const m of marks) {
          const q = at(f, m, 22);
          ctx.moveTo(q.x - tick.x * 3.5, q.y - tick.y * 3.5);
          ctx.lineTo(q.x + tick.x * 3.5, q.y + tick.y * 3.5);
        }
        for (const m of [marks[0], marks[marks.length - 1]]) {
          const q0 = at(f, m, 6), q1 = at(f, m, 25);
          ctx.moveTo(q0.x, q0.y);
          ctx.lineTo(q1.x, q1.y);
        }
        ctx.stroke();
      }
      for (let k = 0; k + 1 < marks.length; k++) {
        const len = marks[k + 1] - marks[k];
        if (len < 1 || len * scale < (f.kind === 'outer' ? 16 : 18)) continue;
        const midX = (marks[k] + marks[k + 1]) / 2;
        textAlong(ctx, at(f, midX, f.kind === 'outer' ? 22 : 8), ang, fmtLen(len, units), f.kind === 'outer', t);
      }
    }
  }
}

/** Aile ar visiem logu un durvju veidiem. `demolished` — sarkana atzīme demontāžas lapā. */
export function drawOpening(ctx, o, w, view, t, highlight, ghost = false, demolished = false) {
  const { scale, ox, oy } = view;
  const S = (p) => ({ x: p.x * scale + ox, y: p.y * scale + oy });
  const d = wallDir(w), n = wallNormal(w);
  const c = wallPoint(w, o.pos);
  const half = o.width / 2, th = w.thickness / 2;
  const P = (along, across) => S(add(add(c, mul(d, along)), mul(n, across)));
  const line = (p, q) => { ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); };
  const variant = o.variant || (o.type === 'door' ? 'single' : 'window');
  ctx.globalAlpha = ghost ? 0.75 : 1;
  ctx.beginPath();
  line(P(-half, 0), P(half, 0));
  ctx.lineWidth = w.thickness * scale + 0.5;
  ctx.strokeStyle = t.bg;
  ctx.stroke();
  const col = demolished ? t.demolish : highlight || ghost ? t.accent : t.line;
  ctx.strokeStyle = col;
  ctx.lineWidth = highlight ? 1.8 : 0.9;
  ctx.beginPath();
  line(P(-half, th), P(-half, -th));
  line(P(half, th), P(half, -th));
  ctx.stroke();
  const ss = o.swing ? -1 : 1;
  const hs = o.hinge ? 1 : -1;

  const windowPart = (x0, x1, mullions = 0) => {
    ctx.beginPath();
    line(P(x0, th), P(x1, th));
    line(P(x0, -th), P(x1, -th));
    line(P(x0, th * 0.18), P(x1, th * 0.18));
    line(P(x0, -th * 0.18), P(x1, -th * 0.18));
    for (let i = 1; i <= mullions; i++) {
      const x = x0 + ((x1 - x0) * i) / (mullions + 1);
      line(P(x, th), P(x, -th));
    }
    ctx.lineWidth = highlight ? 1.6 : 0.9;
    ctx.stroke();
  };
  const sill = (x0, x1) => {
    // Palodze: izvirzījums no sienas virsmas un pārkare aiz ailes malām
    const dep = o.sillDepth ?? 5, ov = o.sillOver ?? 3;
    ctx.beginPath();
    line(P(x0 - ov, ss * (th + dep)), P(x1 + ov, ss * (th + dep)));
    line(P(x0 - ov, ss * th), P(x0 - ov, ss * (th + dep)));
    line(P(x1 + ov, ss * th), P(x1 + ov, ss * (th + dep)));
    ctx.lineWidth = 0.7;
    ctx.stroke();
  };
  // Vērtnes, atvērtas par pacelšanas leņķi (rise angle) uz palodzes pusi
  const sashes = (x0, x1, n) => {
    const ang = o.riseAngle || 0;
    if (!ang) return;
    const sw = (x1 - x0) / n, a = (Math.min(ang, 180) * Math.PI) / 180;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const left = n === 1 ? !o.hinge : i < n / 2;
      const hx = left ? x0 + i * sw : x0 + (i + 1) * sw, dirx = left ? 1 : -1;
      line(P(hx, ss * th * 0.18), P(hx + dirx * sw * Math.cos(a), ss * (th * 0.18 + sw * Math.sin(a))));
    }
    ctx.lineWidth = highlight ? 1.6 : 1;
    ctx.stroke();
  };
  const leaf = (hingeAlong, width, dirAlong) => {
    // Viras durvju vērtne ar loku: eņģe pie hingeAlong, vērtne atveras uz `ss` pusi.
    const hingeP = add(add(c, mul(d, hingeAlong)), mul(n, ss * th));
    const leafDir = mul(n, ss), otherDir = mul(d, dirAlong);
    const hp = S(hingeP), lp = S(add(hingeP, mul(leafDir, width)));
    ctx.beginPath();
    ctx.moveTo(hp.x, hp.y);
    ctx.lineTo(lp.x, lp.y);
    ctx.lineWidth = highlight ? 2.4 : 1.6;
    ctx.stroke();
    const a1 = Math.atan2(leafDir.y, leafDir.x), a2 = Math.atan2(otherDir.y, otherDir.x);
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, width * scale, a1, a2, cross(leafDir, otherDir) < 0);
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const slidingLeaves = (count, offsetSide = ss) => {
    const lw = o.width / count;
    for (let i = 0; i < count; i++) {
      const x0 = -half + i * lw, across = offsetSide * (th + 3 + (i % 2) * 4);
      ctx.beginPath();
      line(P(x0 - (i ? 4 : 0), across), P(x0 + lw + (i < count - 1 ? 4 : 0), across));
      ctx.lineWidth = highlight ? 2.2 : 1.6;
      ctx.stroke();
    }
  };
  const zigzag = (x0, x1, folds) => {
    ctx.beginPath();
    const seg = (x1 - x0) / folds;
    for (let i = 0; i <= folds; i++) {
      const p = P(x0 + i * seg, ss * (th + (i % 2 ? seg * 0.45 : 0)));
      if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
    }
    ctx.lineWidth = highlight ? 2.2 : 1.4;
    ctx.stroke();
  };

  switch (variant) {
    case 'opening': break;
    case 'window': {
      const n = windowCasements(o);
      windowPart(-half, half, n - 1);
      sill(-half, half);
      sashes(-half, half, n);
      break;
    }
    case 'french': windowPart(-half, half, Math.max(1, Math.round(o.width / 80) - 1)); break;
    case 'frenchSliding': windowPart(-half, half); slidingLeaves(2); break;
    case 'french4': windowPart(-half, half, 3); break;
    case 'windoor': {
      const dw = o.doorWidth || 80, door0 = o.hinge ? half - dw : -half;
      const win0 = o.hinge ? -half : -half + dw;
      const nw = windowCasements(o, o.width - dw);
      windowPart(win0, win0 + (o.width - dw), nw - 1);
      sill(win0, win0 + (o.width - dw));
      sashes(win0, win0 + (o.width - dw), nw);
      ctx.beginPath();
      line(P(door0 + (o.hinge ? 0 : dw), th), P(door0 + (o.hinge ? 0 : dw), -th));
      ctx.stroke();
      leaf(o.hinge ? half : -half, dw, o.hinge ? -1 : 1);
      break;
    }
    case 'double': case 'pivot2': leaf(-half, half, 1); leaf(half, half, -1); break;
    case 'pivot': {
      ctx.beginPath();
      line(P(-half * 0.15, ss * th), P(half * 0.85, ss * (th + o.width * 0.75)));
      ctx.lineWidth = highlight ? 2.4 : 1.6;
      ctx.stroke();
      break;
    }
    case 'sliding': slidingLeaves(1); break;
    case 'sliding2': slidingLeaves(2); break;
    case 'stack': case 'slideSys': slidingLeaves(o.leaves || 2); break;
    case 'pocket': case 'pocket2': {
      ctx.beginPath();
      const count = variant === 'pocket2' ? 2 : 1;
      ctx.setLineDash([4, 3]);
      if (count === 1) line(P(hs * half, 0), P(hs * (half + o.width * 0.95), 0));
      else { line(P(-half, 0), P(-half - half * 0.95, 0)); line(P(half, 0), P(half + half * 0.95, 0)); }
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case 'bifold': zigzag(-half, half, 2); break;
    case 'bifold2': zigzag(-half, 0, 2); zigzag(0, half, 2); break;
    case 'accordion': zigzag(-half, half, Math.max(4, Math.round(o.width / 15))); break;
    case 'garage': {
      ctx.beginPath();
      ctx.setLineDash([10, 5]);
      line(P(-half, ss * (th + o.height * 0.3)), P(half, ss * (th + o.height * 0.3)));
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);
      break;
    }
    case 'glass': leaf(hs * half, o.width, -hs); break;
    default: leaf(hs * half, o.width, -hs);
  }
  if (o.type === 'door' && o.trims) {
    // Kārba ar apmalēm: apmales abās sienas pusēs
    const tw = 7, tt = 1.5;
    ctx.beginPath();
    for (const side of [1, -1]) {
      for (const [a0, a1] of [[-half - tw, -half], [half, half + tw]]) {
        line(P(a0, side * th), P(a0, side * (th + tt)));
        line(P(a0, side * (th + tt)), P(a1, side * (th + tt)));
      }
    }
    ctx.lineWidth = highlight ? 1.6 : 1;
    ctx.stroke();
  }
  if (o.type === 'door' && o.arched) {
    // Arkveida aile: virs griezuma plaknes — pārtraukta līnija
    ctx.beginPath();
    ctx.setLineDash([5, 3]);
    line(P(-half, th * 0.5), P(half, th * 0.5));
    line(P(-half, -th * 0.5), P(half, -th * 0.5));
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (demolished) {
    ctx.beginPath();
    line(P(-half, th), P(half, -th));
    line(P(-half, -th), P(half, th));
    ctx.strokeStyle = t.demolish;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

export function drawDim(ctx, dm, view, t, units, highlight) {
  const { scale, ox, oy } = view;
  const S = (p) => ({ x: p.x * scale + ox, y: p.y * scale + oy });
  const dir = norm(sub(dm.b, dm.a));
  const n = { x: -dir.y, y: dir.x };
  const off = dm.offset || 0;
  const A = S(dm.a), B = S(dm.b), A2 = S(add(dm.a, mul(n, off))), B2 = S(add(dm.b, mul(n, off)));
  ctx.strokeStyle = highlight ? t.accent : dm.color || t.dim;
  ctx.lineWidth = highlight ? 1.6 : 0.9;
  ctx.beginPath();
  const ext = (p, q) => {
    const v = norm(sub(q, p));
    ctx.moveTo(p.x + v.x * 3, p.y + v.y * 3);
    ctx.lineTo(q.x + v.x * 5, q.y + v.y * 5);
  };
  if (Math.abs(off) > 0.5) {
    ext(A, A2);
    ext(B, B2);
  }
  ctx.moveTo(A2.x, A2.y);
  ctx.lineTo(B2.x, B2.y);
  const sd = rotate(norm(sub(B2, A2)), -45);
  for (const p of [A2, B2]) {
    ctx.moveTo(p.x - sd.x * 4, p.y - sd.y * 4);
    ctx.lineTo(p.x + sd.x * 4, p.y + sd.y * 4);
  }
  ctx.stroke();
  ctx.font = `10px ${t.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  textAlong(ctx, { x: (A2.x + B2.x) / 2, y: (A2.y + B2.y) / 2 }, Math.atan2(B2.y - A2.y, B2.x - A2.x), fmtLen(dist(dm.a, dm.b), units), true, highlight ? { ...t, dim: t.accent } : { ...t, dim: dm.color || t.dim });
}

/** Uzzīmē stāvu attēlā (albumam / eksportam). */
export function renderFloorImage(floor, theme, { width = 1600, height = 1100, units = 'cm', dims = true, grid = false, stage = null, show } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const view = fitView(floor, width, height, 80);
  drawFloor(c.getContext('2d'), floor, view, theme, { width, height, units, dims, grid, stage, show });
  return c.toDataURL('image/png');
}

/** Vienkāršs vektora SVG eksports: sienas, telpas, ailes, priekšmetu kontūras, līnijas un izmēri. */
export function floorSVG(floor, { units = 'cm' } = {}) {
  const b = floorBounds(floor) || { minX: 0, minY: 0, w: 1000, h: 800 };
  const pad = 60, W = b.w + pad * 2, H = b.h + pad * 2;
  const X = (x) => (x - b.minX + pad).toFixed(1), Y = (y) => (y - b.minY + pad).toFixed(1);
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" width="${W.toFixed(0)}" height="${H.toFixed(0)}" font-family="Arial, sans-serif">`;
  s += `<rect width="100%" height="100%" fill="#fff"/>`;
  for (const r of floor.rooms) {
    const c = interiorPoint(r.points);
    s += `<polygon points="${r.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')}" fill="#fafafa" stroke="none"/>`;
    s += `<text x="${X(c.x)}" y="${Y(c.y)}" font-size="12" text-anchor="middle">${esc(r.name)} ${fmt(polygonArea(r.points) / 1e4)} m²</text>`;
  }
  for (const w of floor.walls) {
    if (w.status === 'demolish' || w.kind === 'virtual') continue;
    s += `<line x1="${X(w.a.x)}" y1="${Y(w.a.y)}" x2="${X(w.b.x)}" y2="${Y(w.b.y)}" stroke="#2b2b2b" stroke-width="${w.thickness}" stroke-linecap="square"/>`;
  }
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (!w) continue;
    const d = wallDir(w), c = wallPoint(w, o.pos), a = add(c, mul(d, -o.width / 2)), e = add(c, mul(d, o.width / 2));
    s += `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(e.x)}" y2="${Y(e.y)}" stroke="#fff" stroke-width="${w.thickness + 1}"/>`;
    s += `<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(e.x)}" y2="${Y(e.y)}" stroke="${o.type === 'window' ? '#5b8fc7' : '#8a6d3b'}" stroke-width="2"/>`;
  }
  for (const ln of floor.lines || []) {
    const def = LINE_TYPES[ln.type] || LINE_TYPES.cable;
    s += `<polyline points="${ln.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')}" fill="none" stroke="${def.color}" stroke-width="${def.duct ? ln.width || 12 : 2}" stroke-dasharray="${(def.dash || []).join(' ')}"/>`;
  }
  for (const it of floor.items) {
    if (it.kind === '__image') continue;
    s += `<g transform="translate(${X(it.x)} ${Y(it.y)}) rotate(${it.rot || 0})"><rect x="${-it.w / 2}" y="${-it.d / 2}" width="${it.w}" height="${it.d}" fill="${esc(it.color || '#ddd')}" fill-opacity="0.6" stroke="#3a3a3a"/>`;
    if (it.w > 40) s += `<text y="4" font-size="9" text-anchor="middle">${esc(it.name || '')}</text>`;
    s += `</g>`;
  }
  for (const dm of floor.dims) {
    s += `<line x1="${X(dm.a.x)}" y1="${Y(dm.a.y)}" x2="${X(dm.b.x)}" y2="${Y(dm.b.y)}" stroke="#333"/><text x="${X((dm.a.x + dm.b.x) / 2)}" y="${Y((dm.a.y + dm.b.y) / 2) - 4}" font-size="11" text-anchor="middle">${fmtLen(dist(dm.a, dm.b), units)}</text>`;
  }
  for (const l of floor.labels) s += `<text x="${X(l.x)}" y="${Y(l.y)}" font-size="${l.size || 14}" text-anchor="middle">${esc(l.text)}</text>`;
  return `${s}</svg>`;
}
