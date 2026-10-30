// Automātiskie sienu skati (attīstījumi): katra telpas siena, skatoties no telpas iekšpuses.
import { sub, norm, dot, dist, add, mul, signedArea, rectCorners, projectOnSegment } from './geometry.js';
import { wallPoint, wallDir, windowCasements, waterOutputs, WATER_OUTPUTS } from './model.js';
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
      // Ailes daļas sienas virzienā (s) → skata x: x + sgn·s
      const sgn = dot(wallDir(w), right) >= 0 ? 1 : -1;
      const op = { type: o.type, variant: o.variant || (o.type === 'door' ? 'single' : 'window'), x0: x - o.width / 2, x1: x + o.width / 2, y0: o.sill, y1: Math.min(H, o.sill + o.height), width: o.width, height: o.height, sill: o.sill,
        casements: windowCasements(o), sillThick: o.sillThick ?? 2, sillOver: o.sillOver ?? 3, arched: !!o.arched, trims: !!o.trims, config: o.config, mullion: o.mullion ?? 90 };
      if (op.variant === 'windoor') {
        const half = o.width / 2, dw = o.doorWidth || 80;
        const door0 = o.hinge ? half - dw : -half, win0 = o.hinge ? -half : -half + dw, ww = o.width - dw;
        const span = (a, b) => [Math.min(x + sgn * a, x + sgn * b), Math.max(x + sgn * a, x + sgn * b)];
        const [dx0, dx1] = span(door0, door0 + dw), [wx0, wx1] = span(win0, win0 + ww);
        const wsill = o.windowSill ?? 85;
        op.parts = [
          { type: 'door', variant: 'balcony', x0: dx0, x1: dx1, y0: 0, y1: Math.min(H, o.height), config: o.config || 'glassTop', mullion: o.mullion ?? 90, width: dw, height: o.height },
          { type: 'window', x0: wx0, x1: wx1, y0: wsill, y1: Math.min(H, wsill + (o.windowHeight ?? 140)), casements: windowCasements(o, ww), sillThick: op.sillThick, sillOver: op.sillOver, width: ww, height: o.windowHeight ?? 140, sill: wsill },
        ];
        op.y0 = 0;
        op.y1 = Math.max(...op.parts.map((q) => q.y1));
      }
      openings.push(op);
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
      const n = Math.max(1, Math.round(it.vcount || 1)), pitch = Math.max(it.h, 7.1);
      const row = { name: it.name || def?.name, x0, x1, y0: it.elev || 0, y1: (it.elev || 0) + (n > 1 ? pitch * (n - 1) + it.h : it.h), color: it.color, electric: def?.electric || def?.water, depth: dp, vcount: n, pitch, h: it.h };
      if (def?.water || def?.sym === 'waterGroup') {
        const outs = def.sym === 'waterGroup' ? waterOutputs(it) : [def.water];
        row.pipes = outs.map((k) => ({ k, y: k === 'sewer' ? it.sewerH ?? (it.elev || 0) : it.pipeH ?? (it.elev || 0) }));
      }
      items.push(row);
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
  const f = (v) => (units === 'mm' ? Math.round(v * 10) : units === 'm' ? (v / 100).toFixed(2) : units === 'in' ? (v / 2.54).toFixed(1) : Math.round(v));
  const Y = (y) => pad + H - y * k;
  const fs = Math.round(Math.max(11, Math.min(18, vw / 34)));
  let s = `<svg class="elev-svg" viewBox="0 0 ${vw} ${vh}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Sienas skats ${el.label}" style="--fs:${fs}px">`;
  s += `<rect x="${pad}" y="${pad}" width="${W}" height="${H}" fill="var(--elev-wall)" stroke="var(--elev-ink)" stroke-width="2"/>`;
  s += `<line x1="${pad - 20}" y1="${Y(0)}" x2="${pad + W + 20}" y2="${Y(0)}" stroke="var(--elev-ink)" stroke-width="3"/>`;
  const windowSvg = (o) => {
    const x = pad + o.x0 * k, w = (o.x1 - o.x0) * k, y = Y(o.y1), h = (o.y1 - o.y0) * k;
    let r = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--elev-glass)" stroke="var(--elev-ink)" stroke-width="1.5"/>`;
    const n = o.casements || 1, sw = w / n;
    for (let i = 0; i < n; i++) {
      const sx = x + i * sw;
      if (i) r += `<line x1="${sx}" y1="${y}" x2="${sx}" y2="${y + h}" stroke="var(--elev-ink)" stroke-width="1.2"/>`;
      // Atvēršanas zīme: virsotne pret eņģu pusi
      const hingeLeft = n === 1 || i < n / 2;
      const hx = hingeLeft ? sx : sx + sw, tip = hingeLeft ? sx + sw : sx;
      r += `<polyline points="${tip},${y} ${hx},${y + h / 2} ${tip},${y + h}" fill="none" stroke="var(--elev-ink)" stroke-width="0.8" stroke-dasharray="6 4"/>`;
    }
    if (o.sill > 0) {
      const ov = (o.sillOver ?? 3) * k, st = Math.max(1, (o.sillThick ?? 2) * k);
      r += `<rect x="${x - ov}" y="${Y(o.y0)}" width="${w + 2 * ov}" height="${st}" fill="var(--elev-bg)" stroke="var(--elev-ink)" stroke-width="1"/>`;
    }
    return r;
  };
  const doorSvg = (o) => {
    const x = pad + o.x0 * k, w = (o.x1 - o.x0) * k, y = Y(o.y1), h = (o.y1 - o.y0) * k;
    let r = '';
    if (o.trims) {
      const tw = 7 * k;
      r += `<path d="M${x - tw} ${Y(o.y0)} V${y - tw} H${x + w + tw} V${Y(o.y0)}" fill="none" stroke="var(--elev-ink)" stroke-width="1"/>`;
    }
    if (o.arched) {
      const rise = Math.min(w / 2, h * 0.4);
      r += `<path d="M${x} ${Y(o.y0)} V${y + rise} Q${x} ${y} ${x + w / 2} ${y} Q${x + w} ${y} ${x + w} ${y + rise} V${Y(o.y0)} Z" fill="var(--elev-bg)" stroke="var(--elev-ink)" stroke-width="1.5"/>`;
      return r;
    }
    if (o.variant === 'balcony' || o.parts === undefined && o.config) {
      // Balkona durvis: stikls / sendviča panelis ar vai bez šķērsrāmja (impostes)
      const cfg = o.config || 'glassTop', my = Y(o.y0 + Math.min(o.mullion ?? 90, o.y1 - o.y0 - 10));
      const glass = 'var(--elev-glass)', panel = 'var(--elev-door)';
      const top = cfg === 'solidSandwich' || cfg === 'sandwich' ? panel : glass;
      const bottom = cfg === 'glassAll' || cfg === 'glass' ? glass : panel;
      const hasMullion = !['glass', 'solidSandwich'].includes(cfg);
      r += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${hasMullion ? top : cfg === 'glass' ? glass : panel}" stroke="var(--elev-ink)" stroke-width="1.5"/>`;
      if (hasMullion) {
        r += `<rect x="${x}" y="${my}" width="${w}" height="${Y(o.y0) - my}" fill="${bottom}" stroke="var(--elev-ink)" stroke-width="1.5"/>`;
        r += `<line x1="${x}" y1="${my}" x2="${x + w}" y2="${my}" stroke="var(--elev-ink)" stroke-width="3"/>`;
      }
      if (bottom === panel || !hasMullion && cfg === 'solidSandwich') r += `<rect x="${x + 6}" y="${(hasMullion ? my : y) + 6}" width="${Math.max(0, w - 12)}" height="${Math.max(0, Y(o.y0) - (hasMullion ? my : y) - 12)}" fill="none" stroke="var(--elev-ink)" stroke-width="0.6"/>`;
      r += `<circle cx="${x + w - 8}" cy="${Y(100)}" r="3" fill="var(--elev-ink)"/>`;
      return r;
    }
    r += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--elev-door)" stroke="var(--elev-ink)" stroke-width="1.5"/>`;
    r += `<circle cx="${x + w - 10}" cy="${Y(100)}" r="3" fill="var(--elev-ink)"/>`;
    return r;
  };
  for (const o of el.openings) {
    const x = pad + o.x0 * k, w = (o.x1 - o.x0) * k, y = Y(o.y1);
    if (o.parts) for (const q of o.parts) s += q.type === 'window' ? windowSvg(q) : doorSvg(q);
    else if (o.type === 'window' && o.variant !== 'opening') s += windowSvg(o);
    else if (o.type === 'window') s += `<rect x="${x}" y="${y}" width="${w}" height="${(o.y1 - o.y0) * k}" fill="var(--elev-bg)" stroke="var(--elev-ink)" stroke-width="1.5"/>`;
    else s += doorSvg(o);
    s += `<text x="${x + w / 2}" y="${y - 6 - (o.trims ? 7 : 0)}" class="elev-t" text-anchor="middle">${f(o.width)}×${f(o.height)}${o.sill ? ` (h=${f(o.sill)})` : ''}</text>`;
  }
  for (const it of el.items) {
    const x = pad + it.x0 * k, w = (it.x1 - it.x0) * k, y = Y(it.y1), h = (it.y1 - it.y0) * k;
    if (it.pipes) {
      it.pipes.forEach((pp, i) => {
        const cx = it.pipes.length === 1 ? x + w / 2 : x + (w * (i + 0.5)) / it.pipes.length, cy = Y(pp.y);
        s += `<circle cx="${cx}" cy="${cy}" r="${Math.max(3, Math.min(6, w / (2 * it.pipes.length)))}" fill="var(--elev-bg)" stroke="${WATER_OUTPUTS[pp.k]?.color || 'var(--accent)'}" stroke-width="1.8"/>`;
        s += `<text x="${cx}" y="${cy - 9 - (i % 2) * 12}" class="elev-t elev-acc" text-anchor="middle">${WATER_OUTPUTS[pp.k]?.letter || ''} h=${f(pp.y)}</text>`;
      });
    } else if (it.electric) {
      const n = it.vcount || 1;
      for (let i = 0; i < n; i++) s += `<rect x="${x}" y="${Y(it.y0 + i * it.pitch + it.h)}" width="${w}" height="${Math.max(it.h * k, 6)}" fill="var(--elev-bg)" stroke="var(--accent)" stroke-width="1.5"/>`;
      s += `<text x="${x + w / 2}" y="${y - 4}" class="elev-t elev-acc" text-anchor="middle">h=${f(it.y0)}${n > 1 ? ` ×${n}` : ''}</text>`;
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


