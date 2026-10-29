// Stāva zīmēšana uz canvas rasējuma stilā: tiek lietota gan redaktorā, gan albuma lapās.
import { polygonArea, interiorPoint, sub, norm, add, mul, cross, rotate, bounds, signedArea, projectOnSegment, pointInPolygon, dist, dot } from './geometry.js';
import { wallDir, wallNormal, wallPoint, wallLength, wallKind } from './model.js';
import { drawItem2D, isPoint, finish, FLOOR_FINISHES, categoryOf } from './catalog.js';
import { itemMode, wallMode } from './stages.js';
import { fmt } from './calc.js';
import { wallFaceDims } from './dims.js';

export const THEME = {
  bg: '#ffffff', grid: '#eef0f2', gridMajor: '#d9dde1', ink: '#222222', muted: '#555555', line: '#2b2b2b',
  hatch: '#6f6f6f', newFill: '#dcdcdc', demolish: '#d93025', accent: '#f08c00', accentSoft: 'rgba(240,140,0,0.16)',
  glass: '#ffffff', dim: '#333333', label: '#e0312b', itemStroke: '#3a3a3a', wire: '#d93025',
  font: '"Roboto", Arial, sans-serif', mono: '"Roboto", Arial, sans-serif',
};
export const readTheme = () => THEME;

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
function hatch(ctx, color, bg) {
  let map = patterns.get(ctx);
  if (!map) patterns.set(ctx, (map = new Map()));
  const k = color + bg;
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

/** Grīdas materiāla raksts (parkets, lamināts, flīzes u. c.) ar materiāla krāsu. */
function floorPattern(ctx, id) {
  let map = patterns.get(ctx);
  if (!map) patterns.set(ctx, (map = new Map()));
  const k = `floor:${id}`;
  if (map.has(k)) return map.get(k);
  const fin = finish(FLOOR_FINISHES, id);
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 24, 24);
  g.globalAlpha = 0.55;
  g.fillStyle = fin.color;
  g.fillRect(0, 0, 24, 24);
  g.globalAlpha = 0.5;
  g.strokeStyle = '#6b5a45';
  g.lineWidth = 0.7;
  g.beginPath();
  if (id === 'parquet') {
    // Eglīte
    for (let y = -24; y < 48; y += 8) {
      g.moveTo(0, y); g.lineTo(12, y + 12); g.lineTo(24, y);
    }
    g.moveTo(12, 0); g.lineTo(12, 24);
  } else if (id === 'laminate') {
    for (let y = 0; y < 24; y += 6) { g.moveTo(0, y + 0.5); g.lineTo(24, y + 0.5); }
    g.moveTo(6.5, 0); g.lineTo(6.5, 6); g.moveTo(18.5, 6); g.lineTo(18.5, 12); g.moveTo(10.5, 12); g.lineTo(10.5, 18); g.moveTo(2.5, 18); g.lineTo(2.5, 24);
  } else if (id === 'tile' || id === 'darktile') {
    g.strokeStyle = id === 'tile' ? '#8a9198' : '#3f4448';
    g.moveTo(0, 0.5); g.lineTo(24, 0.5); g.moveTo(0, 12.5); g.lineTo(24, 12.5);
    g.moveTo(0.5, 0); g.lineTo(0.5, 24); g.moveTo(12.5, 0); g.lineTo(12.5, 24);
  } else if (id === 'carpet') {
    g.fillStyle = '#56604f';
    for (let y = 2; y < 24; y += 4) for (let x = (y % 8) ? 2 : 4; x < 24; x += 4) g.fillRect(x, y, 1, 1);
  } else {
    g.fillStyle = '#6f6c66';
    for (const [x, y] of [[3, 4], [17, 2], [9, 11], [20, 15], [5, 19], [14, 21], [11, 6], [22, 9]]) g.fillRect(x, y, 1.2, 1.2);
  }
  g.stroke();
  const pat = ctx.createPattern(c, 'repeat');
  map.set(k, pat);
  return pat;
}

/** Garuma formāts atbilstoši izvēlētajām mērvienībām. */
export function fmtLen(cm, units = 'cm') {
  if (units === 'mm') return String(Math.round(cm * 10));
  if (units === 'm') return fmt(cm / 100, 2);
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
  return bounds(pts);
}

export function fitView(floor, width, height, pad = 40) {
  const b = floorBounds(floor) || { minX: 0, minY: 0, w: 1000, h: 800 };
  const scale = Math.min((width - pad * 2) / Math.max(b.w, 100), (height - pad * 2) / Math.max(b.h, 100));
  return { scale, ox: (width - b.w * scale) / 2 - b.minX * scale, oy: (height - b.h * scale) / 2 - b.minY * scale };
}

/**
 * Zīmē stāvu. `view` = { scale (px uz cm), ox, oy }, `opts` = { stage, grid, dims, units, selection, hover, width, height }.
 */
export function drawFloor(ctx, floor, view, t, opts = {}) {
  const { scale, ox, oy } = view;
  const S = (p) => ({ x: p.x * scale + ox, y: p.y * scale + oy });
  const W = opts.width, H = opts.height, stage = opts.stage || null;
  const sel = opts.selection, hov = opts.hover;
  const isSel = (kind, id) => sel && sel.kind === kind && sel.id === id;
  const isHov = (kind, id) => hov && hov.kind === kind && hov.id === id;

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

  // Grīdas: kontūrs izriet no sienām, stadijā „Telpas” redzams materiāls
  for (const r of floor.rooms) {
    if (r.points.length < 3) continue;
    pathPoly(ctx, r.points.map(S));
    if (stage?.roomFill || opts.floors) {
      ctx.fillStyle = floorPattern(ctx, r.floorFinish);
      ctx.fill();
    }
    if (isSel('rooms', r.id) || isHov('rooms', r.id)) {
      ctx.fillStyle = isSel('rooms', r.id) ? 'rgba(240,140,0,0.22)' : 'rgba(240,140,0,0.1)';
      ctx.fill();
    }
  }

  // Sienas: kontūras, tad pildījums (starpsienas, jaunās, nesošās, nojaucamās), lai savienojumi saplūst.
  const walls = floor.walls.map((w) => ({ w, mode: wallMode(stage, w) })).filter((x) => x.mode !== 'hidden');
  const visibleIds = new Set(walls.map((x) => x.w.id));
  const seg = (w) => {
    const a = S(w.a), b = S(w.b);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  };
  ctx.lineCap = 'square';
  for (const { w, mode } of walls) {
    seg(w);
    ctx.lineWidth = w.thickness * scale + 1.6;
    ctx.strokeStyle = mode === 'demolish' ? t.demolish : t.line;
    ctx.stroke();
  }
  const order = { partition: 0, new: 1, bearing: 2, demolish: 3 };
  const fillKind = ({ w, mode }) => (mode === 'demolish' ? 'demolish' : mode === 'new' ? 'new' : wallKind(w));
  for (const x of [...walls].sort((p, q) => order[fillKind(p)] - order[fillKind(q)])) {
    const k = fillKind(x);
    seg(x.w);
    ctx.lineWidth = Math.max(0.5, x.w.thickness * scale - 1.4);
    ctx.strokeStyle = k === 'bearing' ? hatch(ctx, t.hatch, t.bg) : k === 'demolish' ? hatch(ctx, t.demolish, '#fff4f3') : k === 'new' ? t.newFill : t.bg;
    ctx.stroke();
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
  ctx.lineCap = 'butt';

  // Ailes
  const openings = floor.openings.filter((o) => visibleIds.has(o.wallId));
  for (const o of openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    drawOpening(ctx, o, w, view, t, isSel('openings', o.id) || isHov('openings', o.id));
  }

  // Izmēri gar sienām
  if (opts.dims && (!stage || stage.dims)) {
    drawWallDims(ctx, floor, walls.map((x) => x.w), openings, view, t, opts.units);
  }

  // Priekšmeti
  const items = floor.items.map((it) => ({ it, mode: itemMode(stage, categoryOf(it)) })).filter((x) => x.mode !== 'hidden');
  items.sort((a, b) => (a.mode === 'faded' ? 0 : 1) - (b.mode === 'faded' ? 0 : 1));
  for (const { it, mode } of items) {
    const p = S(it);
    const k = itemDrawScale(it, scale);
    ctx.save();
    ctx.globalAlpha = mode === 'faded' ? 0.28 : 1;
    ctx.translate(p.x, p.y);
    ctx.rotate(((it.rot || 0) * Math.PI) / 180);
    ctx.scale(scale * k, scale * k);
    ctx.lineWidth = 1 / (scale * k);
    ctx.fillStyle = it.color || '#ddd';
    ctx.strokeStyle = t.itemStroke;
    ctx.lineJoin = 'round';
    drawItem2D(ctx, it);
    if (isSel('items', it.id) || isHov('items', it.id)) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 2 / (scale * k);
      ctx.strokeRect(-it.w / 2 - 2 / scale, -it.d / 2 - 2 / scale, it.w + 4 / scale, it.d + 4 / scale);
    }
    ctx.restore();
  }

  // Elektroinstalācijas vadi
  const wireMode = stage ? stage.wires : 'edit';
  if (wireMode && floor.wires?.length) {
    for (const wr of floor.wires) {
      if (wr.points.length < 2) continue;
      ctx.beginPath();
      wr.points.map(S).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      const on = isSel('wires', wr.id) || isHov('wires', wr.id);
      ctx.globalAlpha = wireMode === 'faded' ? 0.35 : 1;
      ctx.strokeStyle = on ? t.accent : wr.color || t.wire;
      ctx.lineWidth = on ? 3 : 1.6;
      ctx.setLineDash([7, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
  }

  for (const d of floor.dims) drawDim(ctx, d, view, t, opts.units, isSel('dims', d.id) || isHov('dims', d.id));

  // Telpu nosaukumi un sarkanā augstuma/laukuma birka
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const r of floor.rooms) {
    if (r.points.length < 3) continue;
    const c = S(interiorPoint(r.points));
    const area = polygonArea(r.points) / 1e4;
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
  }

  for (const l of floor.labels) {
    const p = S(l);
    ctx.font = `${l.size || 14}px ${t.font}`;
    ctx.fillStyle = t.ink;
    ctx.fillText(l.text, p.x, p.y);
    if (isSel('labels', l.id) || isHov('labels', l.id)) {
      const m = ctx.measureText(l.text);
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(p.x - m.width / 2 - 4, p.y - (l.size || 14) / 2 - 4, m.width + 8, (l.size || 14) + 8);
    }
  }
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
function drawWallDims(ctx, floor, walls, openings, view, t, units) {
  const { scale, ox, oy } = view;
  const S = (p) => ({ x: p.x * scale + ox, y: p.y * scale + oy });
  const at = (f, x, off) => S(add(add(f.origin, mul(f.dir, x)), mul(f.normal, off / scale)));
  ctx.font = `9px ${t.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = t.dim;
  ctx.lineWidth = 0.8;
  for (const f of wallFaceDims(floor, walls, openings)) {
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

export function drawOpening(ctx, o, w, view, t, highlight, ghost = false) {
  const { scale, ox, oy } = view;
  const S = (p) => ({ x: p.x * scale + ox, y: p.y * scale + oy });
  const d = wallDir(w), n = wallNormal(w);
  const c = wallPoint(w, o.pos);
  const half = o.width / 2, th = w.thickness / 2;
  const P = (along, across) => S(add(add(c, mul(d, along)), mul(n, across)));
  const line = (p, q) => { ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); };
  ctx.globalAlpha = ghost ? 0.75 : 1;
  const a = P(-half, 0), b = P(half, 0);
  ctx.beginPath();
  line(a, b);
  ctx.lineWidth = w.thickness * scale + 0.5;
  ctx.strokeStyle = t.bg;
  ctx.stroke();
  const col = highlight || ghost ? t.accent : t.line;
  ctx.strokeStyle = col;
  ctx.lineWidth = highlight ? 1.8 : 0.9;
  ctx.beginPath();
  line(P(-half, th), P(-half, -th));
  line(P(half, th), P(half, -th));
  if (o.type === 'window') {
    // Rāmis abās virsmās un stikls vidū
    line(P(-half, th), P(half, th));
    line(P(-half, -th), P(half, -th));
    line(P(-half, th * 0.18), P(half, th * 0.18));
    line(P(-half, -th * 0.18), P(half, -th * 0.18));
    ctx.stroke();
    // Palodze telpas pusē
    const sideS = o.swing ? -1 : 1;
    ctx.beginPath();
    line(P(-half - 3, sideS * (th + 5)), P(half + 3, sideS * (th + 5)));
    line(P(-half - 3, sideS * th), P(-half - 3, sideS * (th + 5)));
    line(P(half + 3, sideS * th), P(half + 3, sideS * (th + 5)));
    ctx.lineWidth = 0.7;
    ctx.stroke();
  } else {
    ctx.stroke();
    const hs = o.hinge ? 1 : -1;
    const ss = o.swing ? -1 : 1;
    const hingeP = add(add(c, mul(d, hs * half)), mul(n, ss * th));
    const leafDir = mul(n, ss), otherDir = mul(d, -hs);
    const hp = S(hingeP), lp = S(add(hingeP, mul(leafDir, o.width)));
    ctx.beginPath();
    ctx.moveTo(hp.x, hp.y);
    ctx.lineTo(lp.x, lp.y);
    ctx.lineWidth = highlight ? 2.4 : 1.6;
    ctx.stroke();
    const a1 = Math.atan2(leafDir.y, leafDir.x), a2 = Math.atan2(otherDir.y, otherDir.x);
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, o.width * scale, a1, a2, cross(leafDir, otherDir) < 0);
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
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
  ctx.strokeStyle = highlight ? t.accent : t.dim;
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
  textAlong(ctx, { x: (A2.x + B2.x) / 2, y: (A2.y + B2.y) / 2 }, Math.atan2(B2.y - A2.y, B2.x - A2.x), fmtLen(dist(dm.a, dm.b), units), true, highlight ? { ...t, dim: t.accent } : t);
}

/** Uzzīmē stāvu attēlā (albumam / eksportam). */
export function renderFloorImage(floor, theme, { width = 1600, height = 1100, units = 'cm', dims = true, grid = false, stage = null } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const view = fitView(floor, width, height, 80);
  drawFloor(c.getContext('2d'), floor, view, theme, { width, height, units, dims, grid, stage });
  return c.toDataURL('image/png');
}
