// Automātiskie sienu skati (attīstījumi): katra telpas siena, skatoties no telpas iekšpuses.
import { sub, norm, dot, dist, add, mul, signedArea, rectCorners, projectOnSegment } from './geometry.js';
import { wallPoint } from './model.js';
import { byKind } from './catalog.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Atgriež telpas sienu skatu datus: katrai malai — garums, atveri un priekšmeti skatītāja koordinātās. */
export function roomElevations(floor, room) {
  const pts = room.points;
  const H = room.height || floor.height;
  const cw = signedArea(pts) > 0;
  const res = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const L = dist(a, b);
    if (L < 20) continue;
    const dir = norm(sub(b, a));
    const inward = cw ? { x: -dir.y, y: dir.x } : { x: dir.y, y: -dir.x };
    // Skatītājs stāv telpā un skatās pret sienu (virziens –inward); viņa labā roka:
    const look = mul(inward, -1);
    const right = { x: -look.y, y: look.x };
    const origin = dot(a, right) < dot(b, right) ? a : b;
    const X = (p) => dot(sub(p, origin), right);
    const depth = (p) => dot(sub(p, a), inward);

    const openings = [];
    for (const o of floor.openings) {
      const w = floor.walls.find((x) => x.id === o.wallId);
      if (!w) continue;
      const c = wallPoint(w, o.pos);
      const pr = projectOnSegment(c, a, b);
      if (pr.dist > w.thickness / 2 + 3) continue;
      const x = X(c);
      if (x < -1 || x > L + 1) continue;
      openings.push({ type: o.type, x0: x - o.width / 2, x1: x + o.width / 2, y0: o.sill, y1: Math.min(H, o.sill + o.height), width: o.width, height: o.height, sill: o.sill });
    }
    const items = [];
    for (const it of floor.items) {
      const dp = depth(it);
      if (dp < 0 || dp > it.d / 2 + Math.max(it.w, it.d) / 2 + 20) continue;
      const corners = rectCorners(it.x, it.y, it.w, it.d, it.rot || 0);
      const xs = corners.map(X);
      const x0 = Math.max(0, Math.min(...xs)), x1 = Math.min(L, Math.max(...xs));
      if (x1 - x0 < 1) continue;
      // Priekšmetam jāatrodas pie šīs sienas — tā tuvākā mala nedrīkst būt tālu.
      if (Math.min(...corners.map(depth)) > 25) continue;
      const def = byKind(it.kind);
      items.push({ name: it.name || def?.name, x0, x1, y0: it.elev || 0, y1: (it.elev || 0) + it.h, color: it.color, electric: def?.electric, depth: dp });
    }
    items.sort((p, q) => q.depth - p.depth);
    res.push({ index: i, label: String.fromCharCode(65 + (res.length % 26)), length: L, height: H, openings, items, mid: add(a, mul(sub(b, a), 0.5)), inward });
  }
  return res;
}

/** SVG zīmējums vienam sienas skatam. Krāsas nāk no CSS mainīgajiem, tāpēc der abām tēmām un drukai. */
export function elevationSVG(el, units = 'cm') {
  const pad = 46, k = 1;
  const W = el.length * k, H = el.height * k;
  const vw = W + pad * 2, vh = H + pad * 2;
  const f = (v) => (units === 'mm' ? Math.round(v * 10) : units === 'm' ? (v / 100).toFixed(2) : Math.round(v));
  const Y = (y) => pad + H - y * k;
  const fs = Math.round(Math.max(11, Math.min(18, vw / 34)));
  let s = `<svg class="elev-svg" viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sienas skats ${el.label}" style="--fs:${fs}px">`;
  s += `<rect x="${pad}" y="${pad}" width="${W}" height="${H}" fill="var(--elev-wall)" stroke="var(--elev-ink)" stroke-width="2"/>`;
  s += `<line x1="${pad - 20}" y1="${Y(0)}" x2="${pad + W + 20}" y2="${Y(0)}" stroke="var(--elev-ink)" stroke-width="3"/>`;
  for (const o of el.openings) {
    const x = pad + o.x0 * k, w = (o.x1 - o.x0) * k, y = Y(o.y1), h = (o.y1 - o.y0) * k;
    if (o.type === 'window') {
      s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--elev-glass)" stroke="var(--elev-ink)" stroke-width="1.5"/>`;
      s += `<line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="var(--elev-ink)" stroke-width="1"/>`;
      s += `<polyline points="${x},${y} ${x + w / 2},${y + h / 2} ${x},${y + h}" fill="none" stroke="var(--elev-ink)" stroke-width="0.8" stroke-dasharray="6 4"/>`;
    } else {
      s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--elev-door)" stroke="var(--elev-ink)" stroke-width="1.5"/>`;
      s += `<circle cx="${x + w - 10}" cy="${Y(100)}" r="3" fill="var(--elev-ink)"/>`;
    }
    s += `<text x="${x + w / 2}" y="${y - 6}" class="elev-t" text-anchor="middle">${f(o.width)}×${f(o.height)}${o.sill ? ` (h=${f(o.sill)})` : ''}</text>`;
  }
  for (const it of el.items) {
    const x = pad + it.x0 * k, w = (it.x1 - it.x0) * k, y = Y(it.y1), h = (it.y1 - it.y0) * k;
    if (it.electric) {
      s += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(h, 6)}" fill="var(--elev-bg)" stroke="var(--accent)" stroke-width="1.5"/>`;
      s += `<text x="${x + w / 2}" y="${y - 4}" class="elev-t elev-acc" text-anchor="middle">h=${f(it.y0)}</text>`;
    } else {
      s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${esc(it.color)}" fill-opacity="0.55" stroke="var(--elev-ink)" stroke-width="1"/>`;
      if (w > 50 && h > 18) s += `<text x="${x + w / 2}" y="${y + h / 2 + 4}" class="elev-t" text-anchor="middle">${esc(it.name)}</text>`;
    }
  }
  // Izmēri
  s += `<g stroke="var(--elev-dim)" stroke-width="1">`;
  s += `<line x1="${pad}" y1="${pad + H + 22}" x2="${pad + W}" y2="${pad + H + 22}"/>`;
  s += `<line x1="${pad}" y1="${pad + H + 14}" x2="${pad}" y2="${pad + H + 30}"/><line x1="${pad + W}" y1="${pad + H + 14}" x2="${pad + W}" y2="${pad + H + 30}"/>`;
  s += `<line x1="${pad - 22}" y1="${pad}" x2="${pad - 22}" y2="${pad + H}"/>`;
  s += `<line x1="${pad - 30}" y1="${pad}" x2="${pad - 14}" y2="${pad}"/><line x1="${pad - 30}" y1="${pad + H}" x2="${pad - 14}" y2="${pad + H}"/>`;
  s += `</g>`;
  s += `<text x="${pad + W / 2}" y="${pad + H + 40}" class="elev-t elev-dim" text-anchor="middle">${f(el.length)}</text>`;
  s += `<text x="${pad - 28}" y="${pad + H / 2}" class="elev-t elev-dim" text-anchor="middle" transform="rotate(-90 ${pad - 28} ${pad + H / 2})">${f(el.height)}</text>`;
  s += `</svg>`;
  return s;
}


