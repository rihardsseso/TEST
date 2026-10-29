// Stāva zīmēšana uz canvas: tiek lietota gan redaktorā, gan albuma lapās.
import { polygonArea, interiorPoint, sub, norm, add, mul, cross, rotate, bounds } from './geometry.js';
import { wallDir, wallNormal, wallPoint, wallLength } from './model.js';
import { drawItem2D, byKind, finish, FLOOR_FINISHES } from './catalog.js';
import { fmt } from './calc.js';

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

export function readTheme(el = document.documentElement) {
  const cs = getComputedStyle(el);
  const v = (n) => cs.getPropertyValue(n).trim();
  return {
    bg: v('--plan-bg'), grid: v('--plan-grid'), gridMajor: v('--plan-grid-major'),
    wall: v('--plan-wall'), wallEdge: v('--plan-wall-edge'), ink: v('--plan-ink'), muted: v('--plan-muted'),
    accent: v('--accent'), accentSoft: v('--accent-soft'), glass: v('--plan-glass'), dim: v('--plan-dim'),
    itemStroke: v('--plan-item-stroke'), roomAlpha: parseFloat(v('--plan-room-alpha')) || 0.35,
    font: v('--font-ui') || 'sans-serif', mono: v('--font-mono') || 'monospace',
  };
}

/** Garuma formāts atbilstoši izvēlētajām mērvienībām. */
export function fmtLen(cm, units = 'cm') {
  if (units === 'mm') return String(Math.round(cm * 10));
  if (units === 'm') return fmt(cm / 100, 2);
  return String(Math.round(cm));
}

/** Elektrības simboli ekrānā nedrīkst kļūt nesaskatāmi mazi. */
export function itemDrawScale(it, scale) {
  const def = byKind(it.kind);
  if (!def?.electric) return 1;
  return Math.max(1, 22 / (Math.max(it.w, it.d) * scale));
}

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
 * Zīmē stāvu. `view` = { scale (px uz cm), ox, oy }, `opts` = { grid, dims, units, selection, hover, width, height }.
 */
export function drawFloor(ctx, floor, view, t, opts = {}) {
  const { scale, ox, oy } = view;
  const S = (p) => ({ x: p.x * scale + ox, y: p.y * scale + oy });
  const W = opts.width, H = opts.height;
  const sel = opts.selection, hov = opts.hover;
  const isSel = (kind, id) => sel && sel.kind === kind && sel.id === id;
  const isHov = (kind, id) => hov && hov.kind === kind && hov.id === id;

  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, W, H);

  // Fona attēls (skenēts plāns pārzīmēšanai)
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

  // Telpas
  for (const r of floor.rooms) {
    if (r.points.length < 3) continue;
    ctx.beginPath();
    r.points.forEach((p, i) => { const s = S(p); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); });
    ctx.closePath();
    ctx.globalAlpha = t.roomAlpha;
    ctx.fillStyle = finish(FLOOR_FINISHES, r.floorFinish).color;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (isSel('rooms', r.id) || isHov('rooms', r.id)) {
      ctx.fillStyle = t.accentSoft;
      ctx.fill();
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // Sienas: vispirms kontūras, tad pildījums — savienojumi saplūst.
  ctx.lineCap = 'square';
  for (const pass of [0, 1]) {
    for (const w of floor.walls) {
      const a = S(w.a), b = S(w.b);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = w.thickness * scale + (pass ? 0 : 2);
      ctx.strokeStyle = pass ? t.wall : t.wallEdge;
      ctx.stroke();
    }
  }
  for (const w of floor.walls) {
    if (!isSel('walls', w.id) && !isHov('walls', w.id)) continue;
    const a = S(w.a), b = S(w.b);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth = w.thickness * scale;
    ctx.strokeStyle = t.accent;
    ctx.globalAlpha = isSel('walls', w.id) ? 0.75 : 0.4;
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (isSel('walls', w.id)) for (const p of [a, b]) handle(ctx, p, t);
  }
  ctx.lineCap = 'butt';

  // Atveres
  for (const o of floor.openings) {
    const w = floor.walls.find((x) => x.id === o.wallId);
    if (w) drawOpening(ctx, o, w, view, t, isSel('openings', o.id) || isHov('openings', o.id));
  }

  // Priekšmeti
  for (const it of floor.items) {
    const p = S(it);
    const k = itemDrawScale(it, scale);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(((it.rot || 0) * Math.PI) / 180);
    ctx.scale(scale * k, scale * k);
    ctx.lineWidth = 1 / (scale * k);
    ctx.fillStyle = it.color || '#ddd';
    ctx.strokeStyle = t.itemStroke;
    ctx.lineJoin = 'round';
    drawItem2D(ctx, it);
    if (isSel('items', it.id) || isHov('items', it.id)) {
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 2 / (scale * k);
      ctx.strokeRect(-it.w / 2 - 2 / scale, -it.d / 2 - 2 / scale, it.w + 4 / scale, it.d + 4 / scale);
    }
    ctx.restore();
  }

  // Sienu garumi
  if (opts.dims) {
    ctx.font = `11px ${t.mono}`;
    ctx.fillStyle = t.dim;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const w of floor.walls) {
      const L = wallLength(w);
      if (L * scale < 36) continue;
      const mid = wallPoint(w, L / 2), n = wallNormal(w);
      const off = w.thickness / 2 + 9 / scale;
      const p = S(add(mid, mul(n, -off)));
      let ang = Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x);
      if (ang > Math.PI / 2 || ang <= -Math.PI / 2) ang += Math.PI;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.fillText(fmtLen(L, opts.units), 0, 0);
      ctx.restore();
    }
  }

  // Izmēru līnijas
  for (const d of floor.dims) drawDim(ctx, d, view, t, opts.units, isSel('dims', d.id) || isHov('dims', d.id));

  // Telpu nosaukumi un laukumi
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const r of floor.rooms) {
    if (r.points.length < 3) continue;
    const c = S(interiorPoint(r.points));
    const area = polygonArea(r.points) / 1e4;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = t.bg;
    ctx.font = `600 12px ${t.font}`;
    ctx.strokeText(r.name, c.x, c.y - 8);
    ctx.fillStyle = t.ink;
    ctx.fillText(r.name, c.x, c.y - 8);
    ctx.font = `11px ${t.mono}`;
    ctx.strokeText(`${fmt(area)} m²`, c.x, c.y + 8);
    ctx.fillStyle = t.muted;
    ctx.fillText(`${fmt(area)} m²`, c.x, c.y + 8);
  }

  // Teksta uzraksti
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
  let minor = [10, 50, 100, 500].find((s) => s * scale >= 9) || 1000;
  let major = minor < 100 ? 100 : minor * 10;
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

export function drawOpening(ctx, o, w, view, t, highlight, ghost = false) {
  const { scale, ox, oy } = view;
  const S = (p) => ({ x: p.x * scale + ox, y: p.y * scale + oy });
  const d = wallDir(w), n = wallNormal(w);
  const c = wallPoint(w, o.pos);
  const half = o.width / 2, th = w.thickness / 2;
  const a = S(add(c, mul(d, -half))), b = S(add(c, mul(d, half)));
  ctx.globalAlpha = ghost ? 0.7 : 1;
  // Izgriezums sienā
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineWidth = w.thickness * scale + 3;
  ctx.strokeStyle = t.bg;
  ctx.stroke();
  // Aiļu malas
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = t.wallEdge;
  for (const s of [-half, half]) {
    const p1 = S(add(add(c, mul(d, s)), mul(n, th))), p2 = S(add(add(c, mul(d, s)), mul(n, -th)));
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }
  const col = highlight || ghost ? t.accent : t.ink;
  if (o.type === 'window') {
    const corners = [add(add(c, mul(d, -half)), mul(n, th)), add(add(c, mul(d, half)), mul(n, th)), add(add(c, mul(d, half)), mul(n, -th)), add(add(c, mul(d, -half)), mul(n, -th))].map(S);
    ctx.beginPath();
    corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = t.glass;
    ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = highlight ? 2 : 1.2;
    ctx.stroke();
    for (const k of [-0.15, 0.15]) {
      const p1 = S(add(add(c, mul(d, -half)), mul(n, th * k * 2))), p2 = S(add(add(c, mul(d, half)), mul(n, th * k * 2)));
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  } else {
    const hs = o.hinge ? 1 : -1; // eņģu puse gar sienu
    const ss = o.swing ? -1 : 1; // virināšanas puse
    const hingeP = add(add(c, mul(d, hs * half)), mul(n, ss * th));
    const leafDir = mul(n, ss);
    const otherDir = mul(d, -hs);
    const hp = S(hingeP), lp = S(add(hingeP, mul(leafDir, o.width)));
    ctx.beginPath();
    ctx.moveTo(hp.x, hp.y);
    ctx.lineTo(lp.x, lp.y);
    ctx.strokeStyle = col;
    ctx.lineWidth = highlight ? 2.5 : 2;
    ctx.stroke();
    const a1 = Math.atan2(leafDir.y, leafDir.x), a2 = Math.atan2(otherDir.y, otherDir.x);
    ctx.beginPath();
    ctx.arc(hp.x, hp.y, o.width * scale, a1, a2, cross(leafDir, otherDir) < 0);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
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
  const a2 = add(dm.a, mul(n, off)), b2 = add(dm.b, mul(n, off));
  const A = S(dm.a), B = S(dm.b), A2 = S(a2), B2 = S(b2);
  ctx.strokeStyle = highlight ? t.accent : t.dim;
  ctx.fillStyle = highlight ? t.accent : t.dim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const ext = (p, q) => {
    const v = norm(sub(q, p));
    ctx.moveTo(p.x + v.x * 3, p.y + v.y * 3);
    ctx.lineTo(q.x + v.x * 6, q.y + v.y * 6);
  };
  if (Math.abs(off) > 0.5) {
    ext(A, A2);
    ext(B, B2);
  }
  ctx.moveTo(A2.x, A2.y);
  ctx.lineTo(B2.x, B2.y);
  // Arhitektūras slīpās atzīmes
  const sd = rotate(norm(sub(B2, A2)), -45);
  for (const p of [A2, B2]) {
    ctx.moveTo(p.x - sd.x * 5, p.y - sd.y * 5);
    ctx.lineTo(p.x + sd.x * 5, p.y + sd.y * 5);
  }
  ctx.stroke();
  const L = Math.hypot(dm.b.x - dm.a.x, dm.b.y - dm.a.y);
  const mid = { x: (A2.x + B2.x) / 2, y: (A2.y + B2.y) / 2 };
  let ang = Math.atan2(B2.y - A2.y, B2.x - A2.x);
  if (ang > Math.PI / 2 || ang <= -Math.PI / 2) ang += Math.PI;
  ctx.save();
  ctx.translate(mid.x, mid.y);
  ctx.rotate(ang);
  ctx.font = `11px ${t.mono}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(fmtLen(L, units), 0, -3);
  ctx.restore();
}

/** Uzzīmē stāvu attēlā (albumam / eksportam). */
export function renderFloorImage(floor, theme, { width = 1600, height = 1100, units = 'cm', dims = true, grid = false } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const view = fitView(floor, width, height, 70);
  drawFloor(c.getContext('2d'), floor, view, theme, { width, height, units, dims, grid });
  return c.toDataURL('image/png');
}
