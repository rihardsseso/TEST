// Papildu 2D simboli un 3D modeļi (tech). Pašu zīmēti; aizpilda aģents.
// draw[fam](ctx, w, d, it) — lokālās koord.: centrs (0,0), priekšpuse +y, aizmugure (pie sienas) −y; ctx.fillStyle/strokeStyle jau iestatīti.
// build[fam](it) → [[x, y, z, w, h, d, tone?, shape?, flag?], ...] — kastes cm (centrs; y uz augšu no grīdas).
// assign: { itemKey: fam } — kuriem ITEMS (catalog-data.js) lietot jauno simbolu; colors: { fam: '#hex' }.
//
// Tehniskie simboli (santehnika, ūdens, apkure, elektrība, apgaismojums, kondicionēšana, ventilācija,
// drošība, ēkas elementi). Lielākā daļa ģimeņu izvēlas variantu pēc priekšmeta atslēgas (it.kind),
// tāpēc vienai ģimenei var būt vairāki precīzi simboli (piem. rozete: TV / LAN / USB / 380 V …).
// Ģimenes 'socket', 'switch', 'water', 'riser', 'sensor', 'camera', 'grille', 'faucet', 'radiator', 'towel'
// saglabā savus nosaukumus, jo citur kods pēc tiem atpazīst punktus (isPoint) un demontāžas mērķus.
import { ITEMS } from './catalog-data.js';

const PI = Math.PI;
const TAU = PI * 2;

// ---------- palīgfunkcijas ----------
const fs = (c) => { c.fill(); c.stroke(); };
const solid = (c) => { const f = c.fillStyle; c.fillStyle = c.strokeStyle; c.fill(); c.fillStyle = f; };
const R = (c, x, y, w, h) => { c.beginPath(); c.rect(x, y, w, h); fs(c); };
const Ro = (c, x, y, w, h) => { c.beginPath(); c.rect(x, y, w, h); c.stroke(); };
const rrPath = (c, x, y, w, h, r) => {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
};
const RR = (c, x, y, w, h, r) => { c.beginPath(); rrPath(c, x, y, w, h, r); fs(c); };
const RRo = (c, x, y, w, h, r) => { c.beginPath(); rrPath(c, x, y, w, h, r); c.stroke(); };
const C = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.01, r), 0, TAU); fs(c); };
const Co = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.01, r), 0, TAU); c.stroke(); };
const Cs = (c, x, y, r) => { c.beginPath(); c.arc(x, y, Math.max(0.01, r), 0, TAU); solid(c); };
const E = (c, x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); fs(c); };
const Eo = (c, x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, TAU); c.stroke(); };
const L = (c, ...p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); };
const poly = (c, pts, close = true) => { c.beginPath(); c.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); if (close) c.closePath(); };
const P = (c, pts) => { poly(c, pts); fs(c); };
const Ps = (c, pts) => { poly(c, pts); solid(c); c.stroke(); };
const dash = (c, a, b = a) => c.setLineDash?.([a, b]);
const nodash = (c) => c.setLineDash?.([]);
const thick = (c, k) => { c.lineWidth *= k; };
const accent = (c, color, fn) => { c.save(); c.strokeStyle = color; fn(); c.restore(); };
const has = (k, ...words) => words.some((s) => k.includes(s));
const text = (c, s, x, y, size, weight = 700) => {
  c.save(); c.fillStyle = c.strokeStyle; c.font = `${weight} ${Math.max(0.5, size)}px sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(s, x, y); c.restore();
};
const arrow = (c, x1, y1, x2, y2, s) => {
  L(c, x1, y1, x2, y2);
  const a = Math.atan2(y2 - y1, x2 - x1);
  poly(c, [x2, y2, x2 - s * Math.cos(a - 0.45), y2 - s * Math.sin(a - 0.45), x2 - s * Math.cos(a + 0.45), y2 - s * Math.sin(a + 0.45)]);
  solid(c); c.stroke();
};
const zig = (c, x1, x2, y, amp, n) => {
  c.beginPath(); c.moveTo(x1, y);
  for (let i = 1; i <= n; i++) c.lineTo(x1 + ((x2 - x1) * (i - 0.5)) / n, y + (i % 2 ? -amp : amp)), c.lineTo(x1 + ((x2 - x1) * i) / n, y);
  c.stroke();
};
/** Taisnstūris ar noapaļotiem tikai priekšējiem stūriem (izlietnes, pisuāri). */
const frontRound = (c, x, y, w, h, r) => {
  r = Math.max(0, Math.min(r, w / 2, h));
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r); c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r); c.closePath();
};
const kindOf = (it) => String(it?.kind || '');

// ---------- ūdens krāsas (konvencionālie akcenti) ----------
const HOT = '#d64541', COLD = '#2f7fd8', SEW = '#8a7560', GAS = '#d4a017', HEAT = '#e07b2a';

const draw = {};

// ======================= SANTEHNIKA =======================

/** Izlietnes trauks + krāns: kopīgā daļa. */
function bowl(c, cx, cy, rx, ry, tapY) {
  E(c, cx, cy, rx, ry);
  Co(c, cx, cy + ry * 0.15, Math.min(rx, ry) * 0.1); // noteka
  if (tapY != null) {
    L(c, cx, tapY, cx, cy - ry * 0.55);
    Cs(c, cx, tapY, Math.min(rx, ry) * 0.16);
  }
}

draw.tBasin = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  if (has(k, 'freestanding')) {
    E(c, 0, 0, w / 2, d / 2);
    bowl(c, 0, d * 0.06, w * 0.36, d * 0.33, -d * 0.4);
    return;
  }
  frontRound(c, -w / 2, -d / 2, w, d, m * 0.45); fs(c);
  if (has(k, 'pedestal')) { dash(c, m * 0.06); Eo(c, 0, d * 0.02, w * 0.14, d * 0.16); nodash(c); }
  if (has(k, 'over_washer')) {
    RR(c, -w * 0.42, -d * 0.2, w * 0.84, d * 0.58, m * 0.18);
    Co(c, 0, d * 0.12, m * 0.04);
    L(c, 0, -d * 0.4, 0, -d * 0.2); Cs(c, 0, -d * 0.4, m * 0.05);
    return;
  }
  if (has(k, 'double')) { for (const x of [-w * 0.23, w * 0.23]) bowl(c, x, d * 0.06, w * 0.18, d * 0.3, -d * 0.36); return; }
  bowl(c, 0, d * 0.08, w * 0.36, d * 0.32, -d * 0.36);
};

draw.tVanity = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  const console_ = has(k, 'console');
  if (console_) {
    RR(c, -w / 2, -d / 2, w, d, m * 0.06);
    if (has(k, 'floor')) for (const x of [-1, 1]) R(c, x * (w / 2 - m * 0.08) - m * 0.04, d / 2 - m * 0.16, m * 0.08, m * 0.08);
    else { L(c, -w * 0.3, -d / 2, -w * 0.3, -d / 2 + d * 0.18); L(c, w * 0.3, -d / 2, w * 0.3, -d / 2 + d * 0.18); }
  } else {
    R(c, -w / 2, -d / 2, w, d);
    L(c, -w / 2, d / 2 - d * 0.1, w / 2, d / 2 - d * 0.1); // durvju/atvilktņu plakne
    if (has(k, 'drawers')) for (const x of [-w * 0.2, w * 0.2]) L(c, x - w * 0.06, d / 2 - d * 0.05, x + w * 0.06, d / 2 - d * 0.05);
    if (has(k, 'wall_mounted')) { dash(c, m * 0.05); L(c, -w / 2 + m * 0.05, d / 2 - d * 0.05, w / 2 - m * 0.05, d / 2 - d * 0.05); nodash(c); }
  }
  const n = has(k, 'double') ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const cx = n === 1 ? 0 : (i ? 1 : -1) * w * 0.24;
    bowl(c, cx, d * 0.04, (w / n) * 0.3, d * 0.27, -d * 0.36);
  }
};

draw.tVanityWasher = (c, w, d) => {
  const m = Math.min(w, d);
  R(c, -w / 2, -d / 2, w, d);
  dash(c, m * 0.05); Co(c, 0, d * 0.05, m * 0.33); nodash(c);
  RR(c, -w * 0.4, -d * 0.36, w * 0.8, d * 0.42, m * 0.12);
  Co(c, 0, -d * 0.12, m * 0.035);
  Cs(c, 0, -d * 0.43, m * 0.04);
};

draw.tVessel = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  dash(c, m * 0.05); Ro(c, -w / 2, -d / 2, w, d); nodash(c); // virsma
  const r = m * 0.4;
  if (has(k, 'round')) { C(c, 0, d * 0.04, r); Co(c, 0, d * 0.04, r * 0.75); }
  else if (has(k, 'oval')) { E(c, 0, d * 0.04, w * 0.42, d * 0.34); Eo(c, 0, d * 0.04, w * 0.32, d * 0.25); }
  else if (has(k, 'teardrop')) {
    const top = -d * 0.36, bot = d * 0.42, rx = w * 0.34;
    c.beginPath(); c.moveTo(0, top); c.bezierCurveTo(rx * 0.6, top, rx, bot - d * 0.2, rx * 0.4, bot);
    c.quadraticCurveTo(0, bot + d * 0.04, -rx * 0.4, bot); c.bezierCurveTo(-rx, bot - d * 0.2, -rx * 0.6, top, 0, top); fs(c);
  } else { RR(c, -w * 0.4, -d * 0.3, w * 0.8, d * 0.68, m * 0.12); RRo(c, -w * 0.32, -d * 0.22, w * 0.64, d * 0.52, m * 0.1); }
  Co(c, 0, d * 0.1, m * 0.04);
  Cs(c, 0, -d * 0.42, m * 0.045);
};

draw.tCounterSink = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  R(c, -w / 2, -d / 2, w, d);
  const asym = has(k, 'asym');
  const bw = asym ? w * 0.42 : Math.min(w * 0.7, d * 1.2), cx = asym ? -w / 2 + w * 0.28 : 0;
  RR(c, cx - bw / 2, -d * 0.28, bw, d * 0.62, m * 0.18);
  Co(c, cx, d * 0.05, m * 0.04);
  L(c, cx, -d * 0.4, cx, -d * 0.28); Cs(c, cx, -d * 0.4, m * 0.045);
};

draw.tWasher = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  R(c, -w / 2, -d / 2, w, d);
  if (has(k, 'drying_cabinet')) {
    L(c, -w * 0.4, -d * 0.1, w * 0.4, -d * 0.1);
    for (const x of [-w * 0.25, 0, w * 0.25]) L(c, x - w * 0.1, d * 0.2, x, -d * 0.1, x + w * 0.1, d * 0.2);
    L(c, -w / 2, d * 0.38, w / 2, d * 0.38);
    return;
  }
  L(c, -w / 2, -d / 2 + d * 0.16, w / 2, -d / 2 + d * 0.16); // vadības panelis
  Co(c, w * 0.3, -d / 2 + d * 0.08, m * 0.035);
  if (has(k, 'top_load')) { RRo(c, -w * 0.32, -d * 0.22, w * 0.64, d * 0.6, m * 0.08); Co(c, 0, d * 0.08, m * 0.22); return; }
  const cy = d * 0.08, r = m * 0.3;
  C(c, 0, cy, r);
  if (has(k, 'dryer') && !has(k, 'stacked')) { for (const y of [-0.3, 0, 0.3]) zig(c, -r * 0.55, r * 0.55, cy + y * r, r * 0.08, 3); }
  else Co(c, 0, cy, r * 0.65);
  if (has(k, 'stacked')) { Ro(c, -w / 2 + m * 0.06, -d / 2 + m * 0.06, w - m * 0.12, d - m * 0.12); L(c, -w * 0.3, -d * 0.2, -w * 0.2, -d * 0.2); }
};

draw.tHeater = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  if (has(k, 'hand_dryer')) {
    RR(c, -w * 0.35, -d / 2, w * 0.7, d * 0.4, m * 0.1);
    L(c, -w * 0.2, -d * 0.1, w * 0.2, -d * 0.1);
    for (const x of [-w * 0.12, 0, w * 0.12]) arrow(c, x, -d * 0.02, x, d * 0.3, m * 0.06);
    return;
  }
  if (has(k, 'reverse_osmosis')) {
    R(c, -w / 2, -d * 0.2, w, d * 0.5);
    for (const x of [-w * 0.3, 0, w * 0.3]) C(c, x, d * 0.05, Math.min(w * 0.12, d * 0.2));
    L(c, -w / 2, -d / 2, -w / 2, -d * 0.2); L(c, w / 2, -d / 2, w / 2, -d * 0.2);
    return;
  }
  if (has(k, 'horizontal')) {
    RR(c, -w / 2, -d * 0.3, w, d * 0.6, d * 0.3);
    L(c, -w / 2 + d * 0.2, -d * 0.3, -w / 2 + d * 0.2, d * 0.3); L(c, w / 2 - d * 0.2, -d * 0.3, w / 2 - d * 0.2, d * 0.3);
    L(c, -w * 0.1, -d / 2, -w * 0.1, -d * 0.3); L(c, w * 0.1, -d / 2, w * 0.1, -d * 0.3);
    return;
  }
  if (has(k, 'tankless')) {
    RR(c, -w / 2, -d / 2, w, d, m * 0.08);
    if (has(k, 'gas')) {
      Co(c, 0, -d * 0.2, m * 0.16); // dūmvads
      c.beginPath(); c.moveTo(0, d * 0.4); c.bezierCurveTo(-w * 0.28, d * 0.3, -w * 0.05, d * 0.1, -w * 0.06, -d * 0.02);
      c.bezierCurveTo(w * 0.12, d * 0.12, w * 0.28, d * 0.28, 0, d * 0.4); solid(c); c.stroke();
    } else {
      zig(c, -w * 0.32, w * 0.32, 0, d * 0.16, 4);
      arrow(c, -w * 0.3, d * 0.3, w * 0.3, d * 0.3, m * 0.12);
    }
    return;
  }
  // cilindriska tvertne (boileris / filtra tvertne)
  const r = m / 2;
  C(c, 0, 0, r);
  Co(c, 0, 0, r * 0.72);
  if (has(k, 'storage_tank')) { Cs(c, 0, 0, r * 0.14); return; }
  L(c, -r * 0.3, -d / 2, -r * 0.3, -r * 0.6); L(c, r * 0.3, -d / 2, r * 0.3, -r * 0.6);
  zig(c, -r * 0.4, r * 0.4, r * 0.1, r * 0.12, 3);
  if (has(k, 'cylindrical')) L(c, -r, 0, -r * 0.72, 0), L(c, r, 0, r * 0.72, 0);
};

draw.tBath = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d), inset = m * 0.1;
  const jets = (pts) => { for (const [x, y] of pts) Cs(c, x, y, m * 0.025); };
  const whirl = has(k, 'whirlpool');
  if (has(k, 'freestanding')) {
    RR(c, -w / 2, -d / 2, w, d, m / 2);
    RRo(c, -w / 2 + inset, -d / 2 + inset, w - inset * 2, d - inset * 2, (m - inset * 2) / 2);
    Co(c, -w / 2 + inset + m * 0.22, 0, m * 0.05);
    if (has(k, 'legs')) for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Cs(c, x * (w / 2 - m * 0.2), y * (d / 2 - m * 0.06), m * 0.035);
    return;
  }
  if (has(k, 'corner')) {
    const ax = w * 0.42, ay = d * 0.42;
    c.beginPath(); c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.lineTo(w / 2, -d / 2 + ay);
    c.quadraticCurveTo(w / 2, d / 2, -w / 2 + ax, d / 2); c.lineTo(-w / 2, d / 2); c.closePath(); fs(c);
    const i = inset;
    c.beginPath(); c.moveTo(-w / 2 + i, -d / 2 + i); c.lineTo(w / 2 - i, -d / 2 + i); c.lineTo(w / 2 - i, -d / 2 + ay);
    c.quadraticCurveTo(w / 2 - i * 1.6, d / 2 - i * 1.6, -w / 2 + ax, d / 2 - i); c.lineTo(-w / 2 + i, d / 2 - i); c.closePath(); c.stroke();
    Co(c, -w / 2 + i + m * 0.14, -d / 2 + i + m * 0.14, m * 0.05);
    if (whirl) jets([[w * 0.2, -d / 2 + i * 1.6], [-w / 2 + i * 1.6, d * 0.2], [w * 0.2, d * 0.1], [-w * 0.05, d * 0.25]]);
    return;
  }
  if (has(k, 'offset')) {
    poly(c, [-w / 2, -d / 2, w / 2, -d / 2, w / 2, d / 2 - d * 0.45, w * 0.15, d / 2, -w / 2, d / 2]); fs(c);
    const i = inset;
    c.beginPath(); c.moveTo(-w / 2 + i, -d / 2 + i); c.lineTo(w / 2 - i, -d / 2 + i); c.lineTo(w / 2 - i, d / 2 - d * 0.5);
    c.quadraticCurveTo(w * 0.2, d / 2 - i, w * 0.05, d / 2 - i); c.lineTo(-w / 2 + i * 2, d / 2 - i); c.quadraticCurveTo(-w / 2 + i, d / 2 - i, -w / 2 + i, 0); c.closePath(); c.stroke();
    if (has(k, 'seat')) Ro(c, w / 2 - i - w * 0.14, -d / 2 + i, w * 0.14, d * 0.32);
    Co(c, -w / 2 + i + m * 0.18, 0, m * 0.05);
    return;
  }
  // taisnstūra vanna (akrila, čuguna, tērauda, nišas, masāžas, vanna-duša)
  if (has(k, 'cast_iron')) RR(c, -w / 2, -d / 2, w, d, m * 0.2); else R(c, -w / 2, -d / 2, w, d);
  c.beginPath();
  const x0 = -w / 2 + inset, x1 = w / 2 - inset, y0 = -d / 2 + inset, y1 = d / 2 - inset, hr = (y1 - y0) / 2;
  c.moveTo(x0 + m * 0.08, y0); c.lineTo(x1 - hr, y0); c.arc(x1 - hr, 0, hr, -PI / 2, PI / 2); c.lineTo(x0 + m * 0.08, y1);
  c.arcTo(x0, y1, x0, y1 - m * 0.08, m * 0.08); c.lineTo(x0, y0 + m * 0.08); c.arcTo(x0, y0, x0 + m * 0.08, y0, m * 0.08); c.stroke();
  Co(c, x0 + m * 0.16, 0, m * 0.05); // noteka
  Cs(c, -w / 2 + inset * 0.45, 0, m * 0.04); // krāns
  if (has(k, 'alcove')) { thick(c, 2.2); L(c, -w / 2, -d / 2, w / 2, -d / 2); L(c, -w / 2, -d / 2, -w / 2, d / 2); L(c, w / 2, -d / 2, w / 2, d / 2); thick(c, 1 / 2.2); }
  if (whirl) jets([[-w * 0.1, y0 + m * 0.06], [w * 0.15, y0 + m * 0.06], [-w * 0.1, y1 - m * 0.06], [w * 0.15, y1 - m * 0.06], [x1 - m * 0.08, 0]]);
  if (has(k, 'combo')) {
    thick(c, 2.4); L(c, -w / 2 + w * 0.05, d / 2, -w / 2 + w * 0.38, d / 2); thick(c, 1 / 2.4);
    Co(c, -w / 2 + m * 0.22, -d / 2 + m * 0.2, m * 0.08);
    for (let a = 0; a < 6; a++) Cs(c, -w / 2 + m * 0.22 + Math.cos(a) * m * 0.04, -d / 2 + m * 0.2 + Math.sin(a) * m * 0.04, m * 0.008);
  }
};

draw.tBathFaucet = (c, w, d, it) => {
  const k = kindOf(it), s = Math.min(24, w * 0.3, d * 0.6);
  dash(c, Math.min(w, d) * 0.05); RRo(c, -w / 2, -d / 2, w, d, Math.min(w, d) * 0.3); nodash(c); // vannas kontūra
  if (has(k, 'floor_mounted')) {
    C(c, -w / 2 + s * 0.9, 0, s * 0.3);
    L(c, -w / 2 + s * 0.9, 0, -w / 2 + s * 1.8, 0); Cs(c, -w / 2 + s * 1.8, 0, s * 0.1);
    return;
  }
  const y0 = -d / 2;
  RR(c, -s * 0.6, y0, s * 1.2, s * 0.35, s * 0.1);
  if (!has(k, 'deck')) { for (const x of [-s * 0.45, s * 0.45]) C(c, x, y0 + s * 0.17, s * 0.15); }
  const sl = has(k, 'short') ? s * 0.6 : s * 1.1;
  thick(c, 1.8); L(c, 0, y0 + s * 0.35, 0, y0 + s * 0.35 + sl); thick(c, 1 / 1.8);
  Cs(c, 0, y0 + s * 0.35 + sl, s * 0.1);
  if (has(k, 'deck')) { C(c, -s * 0.5, y0 + s * 0.6, s * 0.15); C(c, s * 0.5, y0 + s * 0.6, s * 0.15); }
};

/** Dušas forma: atgriež funkciju, kas izveido kontūru ar iekšēju atkāpi i. */
function showerShape(k, w, d) {
  if (has(k, 'quarter')) return (c, i) => { c.beginPath(); c.moveTo(-w / 2 + i, -d / 2 + i); c.lineTo(w / 2 - i * 1.4, -d / 2 + i); c.ellipse(-w / 2 + i, -d / 2 + i, Math.max(0.1, w - i * 2.4), Math.max(0.1, d - i * 2.4), 0, 0, PI / 2); c.closePath(); };
  if (has(k, 'neo_angle')) return (c, i) => poly(c, [-w / 2 + i, -d / 2 + i, w / 2 - i, -d / 2 + i, w / 2 - i, -d / 2 + d * 0.5, -w / 2 + w * 0.5, d / 2 - i, -w / 2 + i, d / 2 - i]);
  if (has(k, 'curved_rectangular', 'rounded_rectangular')) return (c, i) => { c.beginPath(); const r = Math.min(w, d) * 0.45; c.moveTo(-w / 2 + i, -d / 2 + i); c.lineTo(w / 2 - i, -d / 2 + i); c.lineTo(w / 2 - i, d / 2 - r); c.arcTo(w / 2 - i, d / 2 - i, w / 2 - r, d / 2 - i, Math.max(0.1, r - i)); c.lineTo(-w / 2 + i, d / 2 - i); c.closePath(); };
  if (has(k, 'curved')) return (c, i) => { c.beginPath(); const y0 = d / 2 - Math.min(d, w) * 0.4; c.moveTo(-w / 2 + i, -d / 2 + i); c.lineTo(w / 2 - i, -d / 2 + i); c.lineTo(w / 2 - i, y0); c.quadraticCurveTo(w / 2 - i, d / 2 - i, 0, d / 2 - i); c.quadraticCurveTo(-w / 2 + i, d / 2 - i, -w / 2 + i, y0); c.closePath(); };
  return (c, i) => { c.beginPath(); c.rect(-w / 2 + i, -d / 2 + i, w - i * 2, d - i * 2); };
}

draw.tShower = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d), shape = showerShape(k, w, d);
  const doorOnly = has(k, 'alcove', 'screen');
  const tray = has(k, 'base', 'pallet');
  const drainP = has(k, 'quarter', 'neo_angle') ? [-w / 2 + w * 0.32, -d / 2 + d * 0.32] : [0, 0];
  // paliktnis
  if (doorOnly) { dash(c, m * 0.04); shape(c, 0); c.stroke(); nodash(c); }
  else {
    shape(c, 0); fs(c);
    shape(c, m * 0.07); c.stroke();
    c.save(); c.lineWidth *= 0.6; shape(c, m * 0.07); c.clip();
    const corners = has(k, 'quarter', 'neo_angle') ? [[-w / 2, -d / 2], [w / 2 - m * 0.1, -d / 2], [-w / 2, d / 2 - m * 0.1]] : [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]];
    for (const [x, y] of corners) L(c, x * 0.86, y * 0.86, drainP[0], drainP[1]);
    c.restore();
    C(c, drainP[0], drainP[1], m * 0.06); Cs(c, drainP[0], drainP[1], m * 0.02);
  }
  if (tray) return;
  // stikls un durvis
  c.save(); thick(c, 2.4);
  if (has(k, 'screen')) {
    L(c, -w / 2, d / 2 - m * 0.04, w * 0.15, d / 2 - m * 0.04);
    c.restore();
    R(c, -w / 2, d / 2 - m * 0.08, m * 0.06, m * 0.08);
    return;
  }
  const quarter = has(k, 'quarter'), neo = has(k, 'neo_angle'), curved = has(k, 'curved');
  if (quarter) { c.beginPath(); c.ellipse(-w / 2, -d / 2, w, d, 0, 0, PI / 2); c.stroke(); }
  else if (neo) L(c, w / 2, -d / 2, w / 2, -d / 2 + d * 0.5, -w / 2 + w * 0.5, d / 2, -w / 2, d / 2);
  else if (curved && !has(k, 'alcove')) { shape(c, 0); c.stroke(); L(c, -w / 2, -d / 2, w / 2, -d / 2); }
  else if (has(k, 'alcove')) L(c, -w / 2, d / 2, w / 2, d / 2);
  else L(c, w / 2, -d / 2, w / 2, d / 2, -w / 2, d / 2);
  c.restore();
  // durvju zīme
  c.save(); c.lineWidth *= 1.2;
  if (has(k, 'sliding')) {
    if (quarter) { c.beginPath(); c.ellipse(-w / 2, -d / 2, w * 0.9, d * 0.9, 0, PI * 0.1, PI * 0.38); c.stroke(); }
    else { const y = d / 2 - m * 0.07; L(c, -w * 0.05, y, w * 0.4, y); arrow(c, w * 0.05, y - m * 0.08, -w * 0.2, y - m * 0.08, m * 0.05); }
  } else if (has(k, 'folding')) {
    zig(c, -w * 0.3, w * 0.3, d / 2 - m * 0.08, m * 0.06, 3);
  } else if (has(k, 'hinged', 'enclosure', 'steam')) {
    const dw = Math.min(w, d) * 0.45, hx = quarter || neo ? -w / 2 + w * 0.15 : -w * 0.2, hy = d / 2;
    dash(c, m * 0.04);
    c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx + dw, hy); c.arc(hx, hy, dw, 0, -PI / 2, true); c.lineTo(hx, hy); c.stroke();
    nodash(c);
  }
  c.restore();
  if (has(k, 'steam')) { Ro(c, -w / 2 + m * 0.07, -d / 2 + m * 0.07, w * 0.2, d - m * 0.14); for (const x of [-0.1, 0, 0.1]) zig(c, w * x - m * 0.01, w * x + m * 0.01, d * 0.3, m * 0.02, 1); }
};

draw.tShowerSeat = (c, w, d) => {
  const m = Math.min(w, d);
  RR(c, -w * 0.4, -d / 2, w * 0.8, d * 0.6, m * 0.1);
  thick(c, 1.8); L(c, -w * 0.4, -d / 2 + m * 0.04, w * 0.4, -d / 2 + m * 0.04); thick(c, 1 / 1.8);
  for (let x = -w * 0.3; x <= w * 0.31; x += w * 0.15) L(c, x, -d / 2 + d * 0.15, x, -d / 2 + d * 0.5);
};

draw.toilet = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  const wall = has(k, 'wall_hung');
  const tankD = wall ? d * 0.16 : d * 0.26;
  if (wall) {
    if (has(k, 'carrier')) R(c, -w / 2, -d / 2, w, tankD); else { dash(c, m * 0.06); Ro(c, -w / 2, -d / 2, w, tankD); nodash(c); }
    RR(c, -w * 0.18, -d / 2 + tankD * 0.25, w * 0.36, tankD * 0.5, tankD * 0.1); // skalošanas poga
  } else if (has(k, 'corner')) {
    P(c, [-w / 2, -d / 2, w / 2, -d / 2, w * 0.32, -d / 2 + tankD, -w * 0.32, -d / 2 + tankD]);
  } else if (has(k, 'impulse')) {
    R(c, -w * 0.3, -d / 2, w * 0.6, tankD * 0.45);
    Co(c, 0, -d / 2 + tankD * 0.22, m * 0.08);
  } else {
    RR(c, -w / 2, -d / 2, w, tankD, m * 0.06);
  }
  const top = -d / 2 + tankD, ry = (d / 2 - top) / 2, cy = top + ry;
  c.beginPath(); c.moveTo(-w * 0.32, top); c.lineTo(w * 0.32, top);
  c.bezierCurveTo(w * 0.5, top + ry * 0.4, w * 0.46, d / 2, 0, d / 2);
  c.bezierCurveTo(-w * 0.46, d / 2, -w * 0.5, top + ry * 0.4, -w * 0.32, top); c.closePath(); fs(c);
  Eo(c, 0, cy + ry * 0.12, w * 0.26, ry * 0.62);
};

draw.bidet = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d), back = d * 0.14;
  if (has(k, 'floor')) RR(c, -w * 0.4, -d / 2, w * 0.8, back, m * 0.05);
  else { dash(c, m * 0.06); Ro(c, -w / 2, -d / 2, w, back); nodash(c); }
  const top = -d / 2 + back, ry = (d / 2 - top) / 2, cy = top + ry;
  E(c, 0, cy, w * 0.44, ry);
  Eo(c, 0, cy + ry * 0.15, w * 0.28, ry * 0.6);
  Cs(c, 0, top + ry * 0.2, m * 0.05);
  Co(c, 0, cy + ry * 0.3, m * 0.04);
};

draw.urinal = (c, w, d) => {
  const m = Math.min(w, d);
  frontRound(c, -w / 2, -d / 2, w, d, m * 0.5); fs(c);
  c.beginPath(); frontRound(c, -w * 0.32, -d / 2 + d * 0.15, w * 0.64, d * 0.68, m * 0.32); c.stroke();
  Co(c, 0, d * 0.1, m * 0.06);
  Cs(c, 0, -d / 2 + d * 0.07, m * 0.05);
};

draw.drain = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  R(c, -w / 2, -d / 2, w, d);
  if (has(k, 'linear')) {
    RRo(c, -w / 2 + m * 0.2, -d * 0.18, w - m * 0.4, d * 0.36, d * 0.1);
    for (let x = -w / 2 + m * 0.6; x < w / 2 - m * 0.4; x += Math.max(m * 0.5, 1)) L(c, x, -d * 0.12, x, d * 0.12);
    return;
  }
  for (let x = -w / 2 + m * 0.4; x < w / 2 - m * 0.2; x += Math.max(m * 0.4, 1)) L(c, x, -d / 2 + m * 0.15, x, d / 2 - m * 0.15);
  C(c, 0, 0, m * 0.42); Cs(c, 0, 0, m * 0.12);
};

draw.faucet = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d), y0 = -d / 2;
  if (has(k, 'ceiling_mounted_showerhead')) {
    C(c, 0, 0, m * 0.48);
    for (const r of [0, m * 0.18, m * 0.32]) { const n = r ? Math.round(r / (m * 0.03)) : 1; for (let a = 0; a < n; a++) Cs(c, r * Math.cos((a * TAU) / n), r * Math.sin((a * TAU) / n), m * 0.035); }
    return;
  }
  if (has(k, 'bidet_spray')) {
    R(c, -w * 0.12, y0, w * 0.24, d * 0.18);
    c.beginPath(); c.moveTo(0, y0 + d * 0.18); c.bezierCurveTo(-w * 0.5, d * 0.1, w * 0.4, d * 0.2, w * 0.05, d * 0.25); c.stroke();
    E(c, 0, d * 0.32, w * 0.18, d * 0.14);
    if (has(k, 'thermostatic')) { C(c, -w * 0.32, y0 + d * 0.12, m * 0.14); L(c, -w * 0.32, y0 + d * 0.12, -w * 0.32, y0 + d * 0.02); }
    return;
  }
  if (has(k, 'shower_system', 'shower_set')) {
    const concealed = has(k, 'concealed');
    if (concealed) dash(c, m * 0.08);
    R(c, -w * 0.4, y0, w * 0.8, d * 0.16);
    nodash(c);
    thick(c, 1.6); L(c, -w * 0.25, y0 + d * 0.16, -w * 0.25, d * 0.15); thick(c, 1 / 1.6);
    C(c, -w * 0.25, d * 0.22, m * 0.26);
    for (let a = 0; a < 6; a++) Cs(c, -w * 0.25 + Math.cos((a * PI) / 3) * m * 0.13, d * 0.22 + Math.sin((a * PI) / 3) * m * 0.13, m * 0.03);
    C(c, w * 0.25, y0 + d * 0.3, m * 0.14); // jaucējs
    if (has(k, 'set')) { c.beginPath(); c.moveTo(w * 0.25, y0 + d * 0.44); c.quadraticCurveTo(w * 0.3, d * 0.4, w * 0.18, d * 0.45); c.stroke(); }
    return;
  }
  if (has(k, 'shower_faucet')) {
    RR(c, -w * 0.45, y0, w * 0.9, d * 0.24, m * 0.06);
    C(c, 0, y0 + d * 0.12, m * 0.2);
    thick(c, 1.6); L(c, 0, y0 + d * 0.12, 0, d * 0.25); thick(c, 1 / 1.6);
    arrow(c, -w * 0.3, d * 0.35, -w * 0.3, y0 + d * 0.3, m * 0.12);
    return;
  }
  // izlietnes / grīdas jaucējkrāns
  const floor = has(k, 'floor_mounted');
  const by = floor ? -d * 0.1 : (has(k, 'built_in') ? y0 + d * 0.08 : y0 + d * 0.3);
  if (has(k, 'built_in')) R(c, -w * 0.4, y0, w * 0.8, d * 0.16);
  C(c, 0, by, m * (floor ? 0.3 : 0.24));
  thick(c, 1.8); L(c, 0, by, 0, d * 0.38); thick(c, 1 / 1.8);
  Cs(c, 0, d * 0.38, m * 0.08);
  L(c, 0, by, w * 0.4, by - d * 0.1); // svira
};

draw.towel = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  const vertical = has(k, 'vertical');
  RR(c, -w / 2, -d * 0.2, w, d * 0.45, m * 0.15);
  const n = vertical ? 2 : Math.max(3, Math.round(w / 10));
  for (let i = 1; i < n; i++) { const x = -w / 2 + (w / n) * i; L(c, x, -d * 0.2, x, d * 0.25); }
  for (const x of [-w / 2 + m * 0.25, w / 2 - m * 0.25]) Cs(c, x, d * 0.02, m * 0.2);
  if (has(k, 'electric')) { L(c, w / 2 - m * 0.25, -d * 0.2, w / 2 - m * 0.25, -d / 2); zig(c, -w * 0.3, w * 0.3, d * 0.02, m * 0.12, 4); }
  else for (const x of [-w / 2 + m * 0.25, w / 2 - m * 0.25]) L(c, x, -d * 0.2, x, -d / 2);
  if (has(k, 'shelf')) Ro(c, -w / 2, d * 0.25, w, d * 0.25);
};

draw.tFlush = (c, w, d) => {
  const m = Math.min(w, d);
  RR(c, -w / 2, -d / 2, w, d, m * 0.12);
  RR(c, -w * 0.38, -d * 0.3, w * 0.48, d * 0.6, m * 0.12);
  RR(c, w * 0.16, -d * 0.3, w * 0.22, d * 0.6, m * 0.12);
};

draw.tShowerPanel = (c, w, d) => {
  const m = Math.min(w, d);
  RR(c, -w / 2, -d / 2, w, d, m * 0.12);
  C(c, -w * 0.32, 0, m * 0.32);
  for (const x of [-0.05, 0.12, 0.29]) Cs(c, w * x, 0, m * 0.08);
  C(c, w * 0.42, 0, m * 0.12);
};

draw.tHatch = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  R(c, -w / 2, -d / 2, w, d);
  const i = m * 0.15;
  Ro(c, -w / 2 + i, -d / 2 + i, w - i * 2, d - i * 2);
  if (has(k, 'tile')) { c.save(); c.lineWidth *= 0.6; for (let x = -w / 2 + w / 4; x < w / 2 - 0.1; x += w / 4) L(c, x, -d / 2 + i, x, d / 2 - i); L(c, -w / 2 + i, 0, w / 2 - i, 0); c.restore(); }
  else { dash(c, m * 0.12); L(c, -w / 2 + i, -d / 2 + i, w / 2 - i, d / 2 - i); L(c, w / 2 - i, -d / 2 + i, -w / 2 + i, d / 2 - i); nodash(c); }
  Cs(c, w / 2 - i * 2, 0, m * 0.07);
};

draw.tAcc = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d), y0 = -d / 2;
  if (has(k, 'towel_bar')) { for (const x of [-w * 0.42, w * 0.42]) R(c, x - m * 0.12, y0, m * 0.24, d * 0.45); thick(c, 2); L(c, -w * 0.42, y0 + d * 0.45, w * 0.42, y0 + d * 0.45); thick(c, 0.5); return; }
  if (has(k, 'towel_hooks')) { R(c, -w * 0.45, y0, w * 0.9, d * 0.22); for (const x of [-w * 0.28, 0, w * 0.28]) { L(c, x, y0 + d * 0.22, x, d * 0.3); Cs(c, x, d * 0.3, m * 0.08); } return; }
  if (has(k, 'towel_shelf')) { R(c, -w / 2, y0, w, d * 0.85); L(c, -w / 2, d * 0.15, w / 2, d * 0.15); for (const x of [-w * 0.35, w * 0.35]) L(c, x, y0, x, y0 + d * 0.4); return; }
  if (has(k, 'paper_holder')) { R(c, -w * 0.08, y0, w * 0.16, d * 0.2); L(c, -w * 0.25, y0 + d * 0.15, w * 0.25, y0 + d * 0.15); RR(c, -w * 0.3, y0 + d * 0.25, w * 0.6, d * 0.6, d * 0.25); L(c, -w * 0.3, y0 + d * 0.55, w * 0.3, y0 + d * 0.55); return; }
  if (has(k, 'toilet_brush')) {
    if (has(k, 'wall')) R(c, -w * 0.25, y0, w * 0.5, d * 0.2), L(c, 0, y0 + d * 0.2, 0, -d * 0.05);
    C(c, 0, d * 0.15, m * 0.38); Cs(c, 0, d * 0.15, m * 0.12);
    return;
  }
  if (has(k, 'dispenser')) {
    RR(c, -w / 2, y0, w, d * 0.9, m * 0.2);
    thick(c, 2); L(c, -w * 0.3, d * 0.3, w * 0.3, d * 0.3); thick(c, 0.5);
    if (has(k, 'paper')) Co(c, 0, -d * 0.1, m * 0.25); else for (const x of [-w * 0.2, 0, w * 0.2]) L(c, x, -d * 0.3, x, d * 0.1);
    return;
  }
  RR(c, -w / 2, -d / 2, w, d, m * 0.2);
};

draw.tBin = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  if (has(k, 'laundry')) {
    RR(c, -w * 0.45, -d * 0.4, w * 0.9, d * 0.8, m * 0.12);
    c.save(); c.lineWidth *= 0.6;
    for (let t = -0.8; t <= 0.81; t += 0.4) { L(c, -w * 0.4, d * 0.35 * t, w * 0.4, d * 0.35 * t); L(c, w * 0.4 * t, -d * 0.35, w * 0.4 * t, d * 0.35); }
    c.restore();
    return;
  }
  if (has(k, 'mop')) {
    RR(c, -w * 0.45, -d * 0.35, w * 0.9, d * 0.7, m * 0.15);
    Co(c, -w * 0.15, 0, m * 0.22); Ro(c, w * 0.12, -d * 0.22, w * 0.22, d * 0.44);
    thick(c, 1.8); L(c, -w * 0.15, 0, w * 0.48, -d * 0.48); thick(c, 1 / 1.8);
    return;
  }
  C(c, 0, 0, m * 0.42); Co(c, 0, 0, m * 0.34);
  Cs(c, 0, -m * 0.38, m * 0.05);
};

draw.tCab = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  if (has(k, 'mirror')) {
    R(c, -w / 2, -d / 2, w, d);
    thick(c, 2); L(c, -w / 2, d / 2, w / 2, d / 2); thick(c, 0.5);
    L(c, 0, -d / 2, 0, d / 2);
    return;
  }
  if (has(k, 'corner')) {
    const a = Math.min(w, d) * 0.55;
    poly(c, [-w / 2, -d / 2, w / 2, -d / 2, w / 2, -d / 2 + a, -w / 2 + a, d / 2, -w / 2, d / 2]); fs(c);
    L(c, w / 2 - m * 0.06, -d / 2 + a - m * 0.04, -w / 2 + a - m * 0.04, d / 2 - m * 0.06);
    L(c, -w / 2, -d / 2, w * 0.1, d * 0.1);
    return;
  }
  const overhead = has(k, 'wall_mounted', 'over_');
  if (overhead) dash(c, m * 0.08);
  R(c, -w / 2, -d / 2, w, d);
  if (has(k, 'open')) {
    nodash(c);
    for (const y of [-d * 0.17, d * 0.17]) L(c, -w / 2, y, w / 2, y);
    return;
  }
  L(c, -w / 2, d / 2 - m * 0.1, w / 2, d / 2 - m * 0.1);
  const n = Math.max(1, Math.round(w / 50));
  for (let i = 1; i < n; i++) { const x = -w / 2 + (w / n) * i; L(c, x, -d / 2, x, d / 2 - m * 0.1); }
  L(c, -w / 2, -d / 2, w / 2, d / 2 - m * 0.1);
  nodash(c);
};

// ======================= ŪDENSAPGĀDE =======================

const WATER_LETTER = { cold: 'A', hot: 'K', sewer: 'N' };
const WATER_COLOR = { cold: COLD, hot: HOT, sewer: SEW };
const LEGACY_WATER = { wcold: 'cold', whot: 'hot', sewer: 'sewer' };
const waterKind = (it) => { const k = kindOf(it); return ITEMS[k]?.water || it?.water || LEGACY_WATER[k] || ''; };

function waterDot(c, x, y, r, kind) {
  C(c, x, y, r);
  accent(c, WATER_COLOR[kind] || c.strokeStyle, () => { c.lineWidth *= 2; Co(c, x, y, r * 0.86); });
  c.save(); c.fillStyle = WATER_COLOR[kind] || c.strokeStyle;
  c.font = `700 ${r * 1.15}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(WATER_LETTER[kind] || '', x, y + r * 0.06); c.restore();
}

draw.water = (c, w, d, it) => {
  const kind = waterKind(it), r = Math.min(w / 2, d * 0.6) * 0.95, cy = d / 2 - r;
  L(c, 0, -d / 2, 0, cy - r);
  waterDot(c, 0, cy, r, kind);
};

draw.waterGroup = (c, w, d, it) => {
  const k = kindOf(it);
  const kinds = [];
  if (has(k, 'cold')) kinds.push('cold');
  if (has(k, 'hot')) kinds.push('hot');
  if (has(k, 'sewer')) kinds.push('sewer');
  if (kinds.length === 0) kinds.push('cold', 'hot', 'sewer');
  const n = kinds.length, r = Math.min(w / n / 2, d * 0.6) * 0.95;
  L(c, -w / 2 + r, -d / 2, w / 2 - r, -d / 2);
  kinds.forEach((kind, i) => {
    const x = n === 1 ? 0 : -w / 2 + r + (i * (w - 2 * r)) / (n - 1);
    waterDot(c, x, 0, r, kind);
  });
};

draw.manifold = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  if (has(k, 'cabinet')) {
    if (has(k, 'internal')) dash(c, m * 0.25);
    R(c, -w / 2, -d / 2, w, d);
    nodash(c);
  }
  const heat = has(k, 'heating', 'cabinet');
  const y1 = -d * 0.18, y2 = d * 0.18, x0 = -w / 2 + m * 0.5, x1 = w / 2 - m * 0.3;
  const lines = [[y1, heat ? HEAT : COLD], [y2, heat ? COLD : HOT]];
  for (const [y, col] of lines) {
    accent(c, col, () => { c.lineWidth *= 2.2; L(c, x0, y, x1, y); });
  }
  const n = Math.max(2, Math.floor((x1 - x0) / 9));
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
    C(c, x, y1, Math.min(2.2, d * 0.12)); C(c, x, y2, Math.min(2.2, d * 0.12));
  }
  for (const [y] of lines) { C(c, -w / 2 + m * 0.25, y, Math.min(3, d * 0.16)); L(c, -w / 2 + m * 0.25 - 2, y - 2, -w / 2 + m * 0.25 + 2, y + 2); }
};

draw.riser = (c, w, d, it) => {
  const k = kindOf(it), r = Math.min(w, d) / 2;
  const col = has(k, 'hot') ? HOT : has(k, 'cold', 'ceiling_water') ? COLD : has(k, 'sewer') ? SEW : has(k, 'gas') ? GAS : has(k, 'heating') ? HEAT : null;
  if (has(k, 'heating')) {
    C(c, -r * 0.45, 0, r * 0.52); C(c, r * 0.45, 0, r * 0.52);
    accent(c, HEAT, () => { c.lineWidth *= 2; Co(c, -r * 0.45, 0, r * 0.4); });
    accent(c, COLD, () => { c.lineWidth *= 2; Co(c, r * 0.45, 0, r * 0.4); });
    return;
  }
  C(c, 0, 0, r);
  if (col) accent(c, col, () => { c.lineWidth *= 2.4; Co(c, 0, 0, r * 0.78); });
  if (has(k, 'sewer')) { Cs(c, 0, 0, r * 0.45); return; }
  if (has(k, 'gas')) { text(c, 'G', 0, r * 0.06, r * 1.1); return; }
  if (has(k, 'ceiling')) { arrow(c, 0, -r * 0.55, 0, r * 0.5, r * 0.35); return; }
  if (has(k, 'plumbing')) { L(c, -r * 0.55, -r * 0.55, r * 0.55, r * 0.55); L(c, r * 0.55, -r * 0.55, -r * 0.55, r * 0.55); return; }
  Cs(c, 0, 0, r * 0.22);
};

// ======================= APKURE =======================

draw.radiator = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  if (has(k, 'trench')) {
    R(c, -w / 2, -d / 2, w, d);
    Ro(c, -w / 2 + m * 0.12, -d / 2 + m * 0.12, w - m * 0.24, d - m * 0.24);
    for (let x = -w / 2 + m * 0.3; x < w / 2 - m * 0.2; x += Math.max(m * 0.25, 1.5)) L(c, x, -d / 2 + m * 0.12, x, d / 2 - m * 0.12);
    return;
  }
  if (has(k, 'floor_standing')) {
    R(c, -w / 2, -d / 2, w, d);
    for (let y = -d / 2 + d * 0.15; y < d / 2; y += d * 0.15) L(c, -w * 0.4, y, w * 0.4, y);
    Cs(c, w * 0.42, -d * 0.42, m * 0.04);
    return;
  }
  const valve = () => { C(c, -w / 2 + m * 0.4, 0, m * 0.36); Cs(c, -w / 2 + m * 0.4, 0, m * 0.12); };
  if (has(k, 'electric')) {
    RR(c, -w / 2, -d / 2, w, d, m * 0.2);
    zig(c, -w * 0.35, w * 0.35, 0, d * 0.22, 5);
    L(c, w / 2 - m * 0.4, -d / 2, w / 2 - m * 0.4, -d / 2 - m * 0.3);
    return;
  }
  if (has(k, 'tubular')) {
    R(c, -w / 2, -d / 2, w, d);
    for (let x = -w / 2 + d * 0.5; x < w / 2; x += Math.max(d * 0.6, 3)) { Co(c, x, -d * 0.18, d * 0.16); Co(c, x, d * 0.18, d * 0.16); }
    valve();
    return;
  }
  if (has(k, 'cast_iron')) {
    const n = Math.max(2, Math.round(w / 7)), sw = w / n;
    for (let i = 0; i < n; i++) RR(c, -w / 2 + sw * i, -d / 2, sw, d, Math.min(sw, d) * 0.45);
    valve();
    return;
  }
  if (has(k, 'vertical')) {
    R(c, -w / 2, -d / 2, w, d);
    for (let x = -w / 2 + w / 6; x < w / 2 - 0.1; x += w / 6) Cs(c, x, 0, m * 0.18);
    return;
  }
  if (has(k, 'bimetal')) {
    const n = Math.max(2, Math.round(w / 8)), sw = w / n;
    R(c, -w / 2, -d / 2, w, d);
    for (let i = 1; i < n; i++) L(c, -w / 2 + sw * i, -d / 2, -w / 2 + sw * i, d / 2);
    L(c, -w / 2, 0, w / 2, 0);
    valve();
    return;
  }
  // tērauda paneļu radiators
  R(c, -w / 2, -d / 2, w, d);
  for (const y of [-d * 0.18, d * 0.18]) L(c, -w / 2 + m * 0.2, y, w / 2 - m * 0.2, y);
  for (let x = -w / 2 + 6; x < w / 2 - 2; x += 6) L(c, x, -d * 0.18, x, d * 0.18);
  valve();
};

// ======================= ELEKTRĪBA =======================

/** Rozetes pamatsimbols: vads no sienas līdz pusapļa virsotnei, plakanā mala uz telpu. */
function socketGlyph(c, cx, w, d, { earth = true, fill = false } = {}) {
  const r = Math.min(w * 0.42, d * 0.62);
  const cy = d / 2 - r * 0.15, apex = cy - r;
  L(c, cx, -d / 2, cx, apex);
  c.beginPath(); c.arc(cx, cy, r, PI, 0); c.closePath();
  if (fill) { solid(c); c.stroke(); } else fs(c);
  if (earth) L(c, cx - r * 0.8, apex - r * 0.28, cx + r * 0.8, apex - r * 0.28);
  return { r, cy, apex };
}

const SOCKET_GLYPH = {
  standard_220v_socket: 'std', socket: 'std', power_socket_group: 'group', waterproof_220v_power_socket: 'ip',
  heavy_duty_220v_socket_single_phase: 'heavy1', heavy_duty_380v_socket_three_phase: 'heavy3',
  tv_socket: 'tv', socketTV: 'tv', internet_socket: 'lan', socketNet: 'lan', usb_socket: 'usb', hdmi_socket: 'hdmi',
  telephone_socket: 'tel', audio_socket: 'audio', floor_socket: 'floor', ceiling_socket: 'ceiling', socket2: 'double',
};

draw.socket = (c, w, d, it) => {
  const k = kindOf(it);
  const g = SOCKET_GLYPH[k] || 'std';
  const cnt = Math.max(1, Math.min(6, Math.round(it?.count || (g === 'group' ? 3 : g === 'double' ? 2 : 1))));
  if (cnt > 1 && ['std', 'group', 'double', 'ip', 'heavy1'].includes(g)) {
    const sw = w / cnt;
    for (let i = 0; i < cnt; i++) socketGlyph(c, -w / 2 + sw * (i + 0.5), sw * 1.15, d, { fill: g === 'ip' });
    L(c, -w / 2 + sw / 2, -d / 2, w / 2 - sw / 2, -d / 2);
    return;
  }
  if (g === 'floor' || g === 'ceiling') {
    const s = Math.min(w, d) * 0.95;
    if (g === 'floor') R(c, -s / 2, -s / 2, s, s); else C(c, 0, 0, s / 2);
    c.beginPath(); c.arc(0, s * 0.12, s * 0.32, PI, 0); c.closePath(); fs(c);
    L(c, -s * 0.3, s * 0.12 - s * 0.32, s * 0.3, s * 0.12 - s * 0.32);
    return;
  }
  const weak = ['tv', 'lan', 'usb', 'hdmi', 'tel', 'audio'].includes(g);
  const { r, cy } = socketGlyph(c, 0, w, d, { earth: !weak, fill: g === 'ip' || g === 'heavy1' || g === 'heavy3' });
  const gy = cy - r * 0.42, s = r * 0.42;
  if (g === 'heavy3') { for (const dx of [-1, 0, 1]) L(c, dx * r * 0.18 - r * 0.15, -d / 2 + r * 0.35, dx * r * 0.18 + r * 0.15, -d / 2 + r * 0.05); }
  if (g === 'heavy1') L(c, -r * 0.15, -d / 2 + r * 0.3, r * 0.15, -d / 2 + r * 0.05);
  if (g === 'ip') accent(c, c.fillStyle, () => { L(c, -r * 0.3, gy + s * 0.2, r * 0.3, gy + s * 0.2); });
  if (g === 'tv') { L(c, -s, gy - s * 0.3, s, gy - s * 0.3); L(c, 0, gy - s * 0.3, 0, gy + s * 0.6); }
  if (g === 'lan') { Ro(c, -s * 0.7, gy - s * 0.5, s * 1.4, s * 0.9); L(c, -s * 0.25, gy + s * 0.4, s * 0.25, gy + s * 0.4); }
  if (g === 'usb') { L(c, 0, gy + s * 0.7, 0, gy - s * 0.7); L(c, -s * 0.6, gy, -s * 0.6, gy - s * 0.3); L(c, s * 0.6, gy + s * 0.2, s * 0.6, gy - s * 0.3); L(c, -s * 0.6, gy, 0, gy + s * 0.4, s * 0.6, gy + s * 0.2); }
  if (g === 'hdmi') { poly(c, [-s * 0.8, gy - s * 0.4, s * 0.8, gy - s * 0.4, s * 0.5, gy + s * 0.4, -s * 0.5, gy + s * 0.4]); c.stroke(); }
  if (g === 'tel') { Cs(c, -s * 0.5, gy, s * 0.25); Cs(c, s * 0.5, gy, s * 0.25); L(c, -s * 0.5, gy, s * 0.5, gy); }
  if (g === 'audio') { Co(c, 0, gy, s * 0.6); Cs(c, 0, gy, s * 0.2); }
};

const WIRE_GLYPH = {
  '220v_wire_outlet': 'power', lighting_wire_out: 'light', oven_connection_terminal: 'oven', cooktop_wire_out: 'cooktop',
  ac_unit_wire_out: 'ac', low_voltage_wire_out: 'weak', floor_wire_out: 'floor', ceiling_wire_out: 'ceiling',
};
draw.tWireOut = (c, w, d, it) => {
  const g = WIRE_GLYPH[kindOf(it)] || 'power';
  const r = Math.min(w * 0.38, d * 0.5), cy = d / 2 - r;
  if (g === 'weak') dash(c, r * 0.3);
  L(c, 0, -d / 2, 0, cy - r);
  nodash(c);
  if (g === 'floor' || g === 'ceiling') {
    C(c, 0, cy, r); Cs(c, 0, cy, r * 0.35);
    if (g === 'ceiling') { L(c, -r * 0.7, cy - r * 0.7, r * 0.7, cy + r * 0.7); }
    return;
  }
  if (g === 'light') { C(c, 0, cy, r); L(c, -r * 0.7, cy - r * 0.7, r * 0.7, cy + r * 0.7); L(c, r * 0.7, cy - r * 0.7, -r * 0.7, cy + r * 0.7); return; }
  if (g === 'oven' || g === 'cooktop') {
    R(c, -r, cy - r, r * 2, r * 2);
    if (g === 'oven') { Ro(c, -r * 0.6, cy - r * 0.3, r * 1.2, r * 0.9); L(c, -r * 0.6, cy - r * 0.55, r * 0.6, cy - r * 0.55); }
    else for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) Co(c, x * r * 0.45, cy + y * r * 0.45, r * 0.28);
    return;
  }
  if (g === 'ac') {
    R(c, -r, cy - r, r * 2, r * 2);
    for (let a = 0; a < 3; a++) { const t = (a * PI) / 3; L(c, -Math.cos(t) * r * 0.7, cy - Math.sin(t) * r * 0.7, Math.cos(t) * r * 0.7, cy + Math.sin(t) * r * 0.7); }
    return;
  }
  // 220 V / vājstrāvas vada izvads — bulta uz telpu
  arrow(c, 0, cy - r, 0, d / 2, r * 1.1);
  L(c, -r, cy - r, r, cy - r);
};

/** Slēdža simbols (IEC): aplis, roka uz telpu ar taustiņu atzīmēm; pārslēdzim — simetriska otra roka. */
function switchGlyph(c, w, d, { keys = 1, pass = false, cross = false, dimmer = false, master = false } = {}) {
  const m = Math.min(w, d), r = m * 0.2;
  const two = pass || cross;
  const cx = two ? 0 : -w * 0.18, cy = two ? 0 : -d * 0.12;
  const t = m * 0.24;
  const arm = (ex, ey) => {
    const ang = Math.atan2(ey - cy, ex - cx);
    const ux = Math.cos(ang), uy = Math.sin(ang);
    L(c, cx + ux * r, cy + uy * r, ex, ey);
    for (let i = 0; i < keys; i++) {
      const bx = ex - ux * t * 0.6 * i, by = ey - uy * t * 0.6 * i;
      L(c, bx, by, bx + uy * t, by - ux * t);
    }
  };
  arm(w * 0.42, d * 0.42);
  if (two) arm(-w * 0.42, -d * 0.42);
  if (cross) { arm(w * 0.42, -d * 0.42); arm(-w * 0.42, d * 0.42); }
  if (master) { c.beginPath(); c.arc(cx, cy, r, 0, TAU); solid(c); c.stroke(); } else C(c, cx, cy, r);
  if (dimmer) arrow(c, cx - r * 1.6, cy + r * 1.6, cx + r * 1.6, cy - r * 1.6, r * 0.7);
}

const SWITCH_OPTS = {
  single_gang_switch: {}, switch: {}, double_gang_switch: { keys: 2 }, switch2: { keys: 2 }, three_gang_switch: { keys: 3 }, dimmer: { dimmer: true },
  single_gang_two_way_switch: { pass: true }, switchPass: { pass: true }, double_gang_two_way_switch: { pass: true, keys: 2 },
  single_gang_intermediate_switch: { cross: true }, double_gang_intermediate_switch: { cross: true, keys: 2 }, master_switch: { master: true, keys: 2 },
};
draw.switch = (c, w, d, it) => switchGlyph(c, w, d, SWITCH_OPTS[kindOf(it)] || {});
draw.switch2 = (c, w, d) => switchGlyph(c, w, d, { keys: 2 });
draw.switchPass = (c, w, d) => switchGlyph(c, w, d, { pass: true });
draw.socket2 = (c, w, d, it) => draw.socket(c, w, d, { kind: 'socket2', count: it?.count || 2 });
draw.socketTV = (c, w, d) => draw.socket(c, w, d, { kind: 'tv_socket' });
draw.socketNet = (c, w, d) => draw.socket(c, w, d, { kind: 'internet_socket' });

draw.junction = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  if (has(k, 'equipotential')) {
    R(c, -w / 2, -d / 2, w, d);
    const y = -d * 0.05;
    L(c, 0, -d / 2, 0, y);
    L(c, -w * 0.3, y, w * 0.3, y); L(c, -w * 0.2, y + d * 0.17, w * 0.2, y + d * 0.17); L(c, -w * 0.1, y + d * 0.34, w * 0.1, y + d * 0.34);
    return;
  }
  const r = m / 2;
  C(c, 0, 0, r);
  Cs(c, 0, 0, r * 0.35);
  if (has(k, 'ceiling')) { L(c, -r, 0, -r * 0.55, 0); L(c, r, 0, r * 0.55, 0); L(c, 0, -r, 0, -r * 0.55); L(c, 0, r, 0, r * 0.55); }
  else L(c, 0, -d / 2, 0, -r);
};

draw.tLowCurrent = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  const wifi = (x, y, s) => { for (const f of [0.45, 0.8, 1.15]) { c.beginPath(); c.arc(x, y, s * f, -PI * 0.75, -PI * 0.25); c.stroke(); } Cs(c, x, y, s * 0.12); };
  if (has(k, 'ceiling')) { const r = Math.min(w, d * 3) / 2 * 0.9; C(c, 0, 0, r); wifi(0, r * 0.35, r * 0.6); return; }
  RR(c, -w / 2, -d / 2, w, d, m * 0.2);
  if (has(k, 'router')) {
    for (const x of [-w * 0.3, w * 0.3]) L(c, x, -d / 2, x, -d / 2 - m * 0.8);
    for (const x of [-w * 0.15, 0, w * 0.15]) Cs(c, x, 0, m * 0.1);
    return;
  }
  if (has(k, 'video')) { Ro(c, -w * 0.35, -d * 0.3, w * 0.4, d * 0.6); }
  else for (const x of [-w * 0.3, -w * 0.2, -w * 0.1]) for (const y of [-d * 0.15, d * 0.15]) Cs(c, x, y, m * 0.06);
  C(c, w * 0.28, 0, m * 0.18);
};

// ======================= APGAISMOJUMS =======================

const lampX = (c, x, y, r) => { C(c, x, y, r); L(c, x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7); L(c, x + r * 0.7, y - r * 0.7, x - r * 0.7, y + r * 0.7); };

draw.light = (c, w, d, it) => {
  const k = kindOf(it), r = Math.min(w, d) / 2;
  lampX(c, 0, 0, r);
  if (has(k, 'pendant')) { Co(c, 0, 0, r * 0.82); Cs(c, 0, 0, r * 0.14); }
};

draw.chandelier = (c, w, d, it) => {
  const k = kindOf(it), R0 = Math.min(w, d) / 2;
  if (has(k, 'linear')) {
    RR(c, -w * 0.48, -d * 0.1, w * 0.96, d * 0.2, d * 0.06);
    const n = 4;
    for (let i = 0; i < n; i++) { const x = -w * 0.36 + (w * 0.72 * i) / (n - 1); if (has(k, 'led')) L(c, x - w * 0.08, 0, x + w * 0.08, 0); else lampX(c, x, 0, Math.min(d * 0.16, w * 0.08)); }
    if (has(k, 'shades')) for (let i = 0; i < n; i++) { const x = -w * 0.36 + (w * 0.72 * i) / (n - 1); Co(c, x, 0, Math.min(d * 0.22, w * 0.1)); }
    return;
  }
  if (has(k, 'fan')) {
    for (let a = 0; a < 4; a++) { c.save(); c.rotate((a * PI) / 2 + PI / 4); RR(c, R0 * 0.2, -R0 * 0.1, R0 * 0.78, R0 * 0.2, R0 * 0.08); c.restore(); }
    lampX(c, 0, 0, R0 * 0.28);
    return;
  }
  if (has(k, 'led')) {
    C(c, 0, 0, R0 * 0.95); Co(c, 0, 0, R0 * 0.7); Co(c, 0, 0, R0 * 0.45);
    lampX(c, 0, 0, R0 * 0.2);
    return;
  }
  if (has(k, 'cascade', 'long')) {
    Co(c, 0, 0, R0 * 0.95);
    const n = 8;
    for (let a = 0; a < n; a++) Cs(c, Math.cos((a * TAU) / n) * R0 * 0.75, Math.sin((a * TAU) / n) * R0 * 0.75, R0 * 0.06);
    for (let a = 0; a < 5; a++) Cs(c, Math.cos((a * TAU) / 5) * R0 * 0.45, Math.sin((a * TAU) / 5) * R0 * 0.45, R0 * 0.06);
    lampX(c, 0, 0, R0 * 0.2);
    if (has(k, 'crystal')) for (let a = 0; a < 4; a++) { const t = (a * PI) / 2 + PI / 4; const x = Math.cos(t) * R0 * 0.6, y = Math.sin(t) * R0 * 0.6, s = R0 * 0.08; P(c, [x, y - s, x + s, y, x, y + s, x - s, y]); }
    return;
  }
  // klasiska lustra ar zariem
  const n = 6, arm = R0 * 0.62;
  for (let a = 0; a < n; a++) {
    const t = (a * TAU) / n, x = Math.cos(t) * arm, y = Math.sin(t) * arm;
    L(c, Math.cos(t) * R0 * 0.2, Math.sin(t) * R0 * 0.2, x, y);
    if (has(k, 'crystal')) { const s = R0 * 0.14; P(c, [x, y - s, x + s, y, x, y + s, x - s, y]); }
    else if (has(k, 'shades')) { C(c, x, y, R0 * 0.2); Cs(c, x, y, R0 * 0.05); }
    else C(c, x, y, R0 * 0.14);
  }
  lampX(c, 0, 0, R0 * 0.22);
};

draw.tSpot = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  const n = has(k, 'triple') ? 3 : has(k, 'double') ? 2 : 1;
  if (has(k, 'recessed_track')) {
    RR(c, -w / 2, -d * 0.2, w, d * 0.4, d * 0.1);
    for (const x of [-w * 0.28, 0, w * 0.28]) Cs(c, x, 0, d * 0.09);
    return;
  }
  if (has(k, 'panel')) {
    R(c, -w / 2, -d / 2, w, d);
    Ro(c, -w * 0.38, -d * 0.38, w * 0.76, d * 0.76);
    L(c, -w * 0.38, -d * 0.38, w * 0.38, d * 0.38); L(c, w * 0.38, -d * 0.38, -w * 0.38, d * 0.38);
    return;
  }
  if (has(k, 'track_spot', 'suspended_spot')) {
    const r = m * 0.34;
    if (has(k, 'track')) { thick(c, 1.8); L(c, -w / 2, -d * 0.3, w / 2, -d * 0.3); thick(c, 1 / 1.8); }
    else Cs(c, 0, -d * 0.36, m * 0.08);
    lampX(c, 0, d * 0.05, r);
    P(c, [-r * 0.5, d * 0.05 + r, r * 0.5, d * 0.05 + r, r * 0.9, d / 2, -r * 0.9, d / 2]);
    return;
  }
  const surface = has(k, 'surface');
  if (n > 1) RRo(c, -w / 2, -d * 0.3, w, d * 0.6, d * 0.15);
  const r = n === 1 ? m / 2 : Math.min(w / n / 2, d * 0.28);
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -w / 2 + (w / n) * (i + 0.5);
    lampX(c, x, 0, r * 0.95);
    if (surface) Co(c, x, 0, r * 0.55); else Cs(c, x, 0, r * 0.22);
  }
};

draw.track = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  const n = has(k, 'triple') ? 3 : has(k, 'double') ? 2 : has(k, 'single') ? 1 : 0;
  RR(c, -w / 2, -d * 0.18, w, d * 0.36, d * 0.1);
  L(c, -w / 2 + m * 0.3, 0, w / 2 - m * 0.3, 0);
  if (has(k, 'suspended')) for (const x of [-w * 0.38, w * 0.38]) { Cs(c, x, 0, d * 0.16); L(c, x - d * 0.3, 0, x + d * 0.3, 0); }
  if (has(k, 'surface')) for (const x of [-w / 2, w / 2]) L(c, x, -d * 0.35, x, d * 0.35);
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -w * 0.3 + (w * 0.6 * i) / (n - 1);
    lampX(c, x, d * 0.05, Math.min(d * 0.55, w * 0.08));
  }
};

draw.sconce = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  const y0 = -d / 2;
  if (has(k, 'corner')) {
    c.beginPath(); c.moveTo(-w / 2, y0); c.arc(-w / 2, y0, Math.min(w, d) * 0.95, 0, PI / 2); c.closePath(); fs(c);
    for (let a = 1; a < 4; a++) { const t = (a * PI) / 8; L(c, -w / 2 + Math.cos(t) * m * 0.35, y0 + Math.sin(t) * m * 0.35, -w / 2 + Math.cos(t) * m * 0.8, y0 + Math.sin(t) * m * 0.8); }
    return;
  }
  if (has(k, 'stick', 'picture')) {
    R(c, -w * 0.45, y0, w * 0.9, d * 0.28);
    L(c, -w * 0.35, y0 + d * 0.14, w * 0.35, y0 + d * 0.14);
    const yy = has(k, 'picture') ? d * 0.45 : d * 0.3;
    for (const x of [-w * 0.3, 0, w * 0.3]) L(c, x, y0 + d * 0.32, x * 1.3, yy);
    if (has(k, 'picture')) L(c, -w * 0.06, y0, 0, y0 + d * 0.28, w * 0.06, y0);
    return;
  }
  if (has(k, 'wall_spot', 'swivel')) {
    R(c, -w * 0.15, y0, w * 0.3, d * 0.15);
    L(c, 0, y0 + d * 0.15, 0, y0 + d * 0.38);
    const cy = has(k, 'swivel') ? d * 0.05 : d * 0.08, r = m * 0.28;
    c.save(); c.translate(0, cy); if (has(k, 'swivel')) c.rotate(-0.5);
    P(c, [-r * 0.6, -r * 0.6, r * 0.6, -r * 0.6, r, r * 1.2, -r, r * 1.2]);
    L(c, -r * 0.7, r * 0.2, r * 0.7, r * 0.2);
    c.restore();
    return;
  }
  const r = Math.min(w / 2, d * 0.95);
  c.beginPath(); c.arc(0, y0, r, 0, PI);
  if (has(k, 'lampshade')) { c.closePath(); fs(c); P(c, [-r * 0.6, y0 + r * 0.2, r * 0.6, y0 + r * 0.2, r * 0.85, y0 + r * 0.82, -r * 0.85, y0 + r * 0.82]); return; }
  c.closePath(); fs(c);
  L(c, -r * 0.62, y0 + r * 0.05, r * 0.62, y0 + r * 0.72); L(c, r * 0.62, y0 + r * 0.05, -r * 0.62, y0 + r * 0.72); // gaismas krusts
  if (has(k, 'led')) { thick(c, 2); L(c, -r * 0.8, y0 + r * 0.05, r * 0.8, y0 + r * 0.05); thick(c, 0.5); }
  if (has(k, 'sauna')) Ro(c, -r * 0.5, y0 + r * 0.15, r, r * 0.45);
  if (has(k, 'outdoor')) { thick(c, 2); L(c, -r, y0 + r * 0.95, r, y0 + r * 0.95); thick(c, 0.5); }
  if (has(k, 'floor_light')) { dash(c, r * 0.15); c.beginPath(); c.arc(0, y0, r * 1.15, 0, PI); c.stroke(); nodash(c); }
};

draw.tLinearLight = (c, w, d) => {
  const h = Math.min(d, Math.max(6, w * 0.12));
  R(c, -w / 2, -h / 2, w, h);
  L(c, -w / 2 + h * 0.5, 0, w / 2 - h * 0.5, 0);
  for (const x of [-w / 2 + h / 2, w / 2 - h / 2]) { L(c, x - h * 0.3, -h * 0.3, x + h * 0.3, h * 0.3); L(c, x + h * 0.3, -h * 0.3, x - h * 0.3, h * 0.3); }
};

draw.tCeilingPanel = (c, w, d) => {
  const m = Math.min(w, d);
  R(c, -w / 2, -d / 2, w, d);
  Ro(c, -w / 2 + m * 0.15, -d / 2 + m * 0.15, w - m * 0.3, d - m * 0.3);
  L(c, -w / 2, -d / 2, w / 2, d / 2); L(c, w / 2, -d / 2, -w / 2, d / 2);
};

// ======================= KONDICIONĒŠANA / VENTILĀCIJA =======================

const snow = (c, x, y, r) => { for (let a = 0; a < 3; a++) { const t = (a * PI) / 3 + PI / 2; L(c, x - Math.cos(t) * r, y - Math.sin(t) * r, x + Math.cos(t) * r, y + Math.sin(t) * r); } };

draw.acIndoor = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  if (has(k, 'air_curtain')) {
    RR(c, -w / 2, -d / 2, w, d * 0.5, m * 0.15);
    for (let x = -w * 0.4; x <= w * 0.41; x += w * 0.2) arrow(c, x, -d * 0.05, x, d * 0.45, m * 0.18);
    return;
  }
  if (has(k, 'ducted')) {
    dash(c, m * 0.15); R(c, -w / 2, -d / 2, w, d); nodash(c);
    for (const [x0, x1] of [[-w * 0.45, -w * 0.08], [w * 0.08, w * 0.45]]) { Ro(c, x0, d * 0.1, x1 - x0, d * 0.3); for (let x = x0 + 2; x < x1; x += 3) L(c, x, d * 0.1, x, d * 0.4); }
    snow(c, 0, -d * 0.15, m * 0.2);
    return;
  }
  RR(c, -w / 2, -d / 2, w, d, m * 0.3);
  L(c, -w * 0.42, d * 0.22, w * 0.42, d * 0.22);
  for (let x = -w * 0.36; x <= w * 0.36; x += w * 0.12) L(c, x, d * 0.22, x + m * 0.15, d / 2 - m * 0.06);
  snow(c, -w * 0.32, -d * 0.12, m * 0.18);
};

draw.tAcFloor = (c, w, d) => {
  const m = Math.min(w, d);
  RR(c, -w / 2, -d / 2, w, d, m * 0.15);
  for (let x = -w * 0.35; x <= w * 0.36; x += w * 0.1) L(c, x, d * 0.05, x, d * 0.42);
  snow(c, 0, -d * 0.2, m * 0.18);
};

draw.acCassette = (c, w, d) => {
  const m = Math.min(w, d);
  R(c, -w / 2, -d / 2, w, d);
  const s = m * 0.1, a = m * 0.36;
  R(c, -a, -d / 2 + s, a * 2, s * 0.8); R(c, -a, d / 2 - s * 1.8, a * 2, s * 0.8);
  R(c, -w / 2 + s, -a, s * 0.8, a * 2); R(c, w / 2 - s * 1.8, -a, s * 0.8, a * 2);
  Ro(c, -m * 0.22, -m * 0.22, m * 0.44, m * 0.44);
  snow(c, 0, 0, m * 0.15);
};

draw.acOutdoor = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  R(c, -w / 2, -d / 2, w, d);
  const fan = (x, r) => { C(c, x, 0, r); for (let a = 0; a < 3; a++) { const t = (a * TAU) / 3; c.beginPath(); c.moveTo(x, 0); c.quadraticCurveTo(x + Math.cos(t + 0.5) * r * 0.9, Math.sin(t + 0.5) * r * 0.9, x + Math.cos(t) * r * 0.85, Math.sin(t) * r * 0.85); c.stroke(); } Cs(c, x, 0, r * 0.15); };
  if (has(k, 'multi')) { fan(-w * 0.25, m * 0.4); fan(w * 0.15, m * 0.4); }
  else fan(-w * 0.12, m * 0.42);
  for (let x = w * 0.36; x < w / 2 - 1; x += Math.max(2, w * 0.04)) L(c, x, -d * 0.4, x, d * 0.4);
};

draw.tAcBasket = (c, w, d) => {
  R(c, -w / 2, -d / 2, w, d);
  c.save(); c.beginPath(); c.rect(-w / 2, -d / 2, w, d); c.clip(); c.lineWidth *= 0.6;
  const s = Math.max(w, d) / 8;
  for (let t = -w - d; t < w + d; t += s) { L(c, t - d, -d / 2 - d, t + d, d / 2 + d); L(c, t + d, -d / 2 - d, t - d, d / 2 + d); }
  c.restore();
};

draw.grille = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  if (has(k, 'round_grille')) { C(c, 0, 0, m / 2); for (const f of [0.75, 0.5, 0.25]) Co(c, 0, 0, m / 2 * f); return; }
  if (has(k, 'disc')) { C(c, 0, 0, m / 2); C(c, 0, 0, m * 0.3); arrow(c, m * 0.3, 0, m * 0.48, 0, m * 0.1); arrow(c, -m * 0.3, 0, -m * 0.48, 0, m * 0.1); return; }
  R(c, -w / 2, -d / 2, w, d);
  if (has(k, 'slot_diffuser')) { for (const y of [-d * 0.25, 0, d * 0.25]) RR(c, -w * 0.4, y - d * 0.06, w * 0.8, d * 0.12, d * 0.06); return; }
  if (has(k, 'slotted')) { for (let x = -w / 2 + w / 7; x < w / 2 - 0.1; x += w / 7) L(c, x, -d * 0.38, x, d * 0.38); return; }
  if (has(k, 'outlet')) { Ro(c, -w * 0.38, -d * 0.38, w * 0.76, d * 0.76); L(c, -w * 0.38, -d * 0.38, w * 0.38, d * 0.38); arrow(c, -w * 0.15, d * 0.15, w * 0.2, -d * 0.2, m * 0.15); return; }
  for (let y = -d / 2 + d / 6; y < d / 2 - 0.1; y += d / 6) L(c, -w * 0.4, y, w * 0.4, y);
};

draw.tFan = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  const blades = (cx, cy, r, n) => { for (let a = 0; a < n; a++) { c.save(); c.translate(cx, cy); c.rotate((a * TAU) / n); c.beginPath(); c.ellipse(r * 0.55, 0, r * 0.42, r * 0.16, 0.3, 0, TAU); fs(c); c.restore(); } C(c, cx, cy, r * 0.16); };
  if (has(k, 'duct')) {
    R(c, -w / 2, -d * 0.35, w, d * 0.7);
    Co(c, 0, 0, d * 0.32); blades(0, 0, d * 0.3, 4);
    arrow(c, -w * 0.45, 0, -w * 0.25, 0, d * 0.12);
    return;
  }
  if (has(k, 'ceiling')) { blades(0, 0, m / 2, 3); Co(c, 0, 0, m * 0.12); return; }
  if (has(k, 'wall')) {
    R(c, -w * 0.15, -d / 2, w * 0.3, d * 0.15);
    Co(c, 0, d * 0.05, Math.min(w / 2, d * 0.42)); blades(0, d * 0.05, Math.min(w / 2, d * 0.42), has(k, 'blade') ? 5 : 3);
    return;
  }
  Co(c, 0, 0, m / 2); blades(0, 0, m / 2, has(k, 'bladed') ? 5 : 3);
};

draw.shaft = (c, w, d) => {
  const m = Math.min(w, d);
  thick(c, 2); R(c, -w / 2, -d / 2, w, d); thick(c, 0.5);
  Ro(c, -w / 2 + m * 0.1, -d / 2 + m * 0.1, w - m * 0.2, d - m * 0.2);
  L(c, -w / 2 + m * 0.1, -d / 2 + m * 0.1, w / 2 - m * 0.1, d / 2 - m * 0.1);
  arrow(c, -w * 0.1, d * 0.1, w * 0.2, -d * 0.2, m * 0.14);
};

// ======================= DROŠĪBA =======================

draw.sensor = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d), r = m / 2;
  if (has(k, 'thermostat')) {
    RR(c, -w / 2, -d / 2, w, d, m * 0.15);
    Co(c, 0, 0, m * 0.32);
    L(c, 0, 0, m * 0.2, -m * 0.2);
    Cs(c, 0, 0, m * 0.08);
    return;
  }
  if (has(k, 'motion')) {
    c.beginPath(); c.moveTo(0, -d / 2); c.arc(0, -d / 2, d * 0.95, PI * 0.2, PI * 0.8); c.closePath(); fs(c);
    for (const f of [0.45, 0.7]) { c.beginPath(); c.arc(0, -d / 2, d * f, PI * 0.28, PI * 0.72); c.stroke(); }
    return;
  }
  C(c, 0, 0, r);
  if (has(k, 'light')) {
    Co(c, 0, 0, r * 0.32);
    for (let a = 0; a < 8; a++) { const t = (a * TAU) / 8; L(c, Math.cos(t) * r * 0.45, Math.sin(t) * r * 0.45, Math.cos(t) * r * 0.75, Math.sin(t) * r * 0.75); }
    return;
  }
  if (has(k, 'leak')) {
    accent(c, COLD, () => { c.beginPath(); c.moveTo(0, -r * 0.65); c.bezierCurveTo(r * 0.55, -r * 0.05, r * 0.45, r * 0.55, 0, r * 0.55); c.bezierCurveTo(-r * 0.45, r * 0.55, -r * 0.55, -r * 0.05, 0, -r * 0.65); c.save(); c.fillStyle = COLD; c.fill(); c.restore(); c.stroke(); });
    return;
  }
  if (has(k, 'fire', 'smoke')) {
    for (let i = 0; i < 3; i++) { const x = (i - 1) * r * 0.38; c.beginPath(); c.moveTo(x, r * 0.55); c.bezierCurveTo(x - r * 0.25, r * 0.2, x + r * 0.25, -r * 0.1, x, -r * 0.55); c.stroke(); }
    return;
  }
  Cs(c, 0, 0, r * 0.3);
};

draw.camera = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d), r = m / 2;
  if (has(k, 'bullet')) {
    R(c, -w * 0.12, -d / 2, w * 0.24, d * 0.2);
    RR(c, -w * 0.22, -d * 0.3, w * 0.44, d * 0.62, m * 0.08);
    P(c, [-w * 0.18, d * 0.32, w * 0.18, d * 0.32, w * 0.42, d / 2, -w * 0.42, d / 2]);
    return;
  }
  C(c, 0, 0, r);
  if (has(k, 'dome')) { Co(c, 0, 0, r * 0.62); Cs(c, 0, r * 0.15, r * 0.2); return; }
  if (has(k, 'ptz')) {
    Cs(c, 0, 0, r * 0.25);
    for (const t of [0, PI / 2, PI, -PI / 2]) arrow(c, Math.cos(t) * r * 0.4, Math.sin(t) * r * 0.4, Math.cos(t) * r * 0.85, Math.sin(t) * r * 0.85, r * 0.22);
    return;
  }
  Co(c, 0, 0, r * 0.45); Cs(c, 0, 0, r * 0.18);
  P(c, [-r * 0.3, r * 0.5, r * 0.3, r * 0.5, r * 0.6, r * 0.95, -r * 0.6, r * 0.95]);
};

draw.tExtinguisher = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d), r = m / 2;
  if (has(k, 'cabinet')) {
    R(c, -w / 2, -d / 2, w, d);
    L(c, -w / 2, d / 2 - m * 0.1, w / 2, d / 2 - m * 0.1);
  }
  const rr = has(k, 'cabinet') ? r * 0.6 : has(k, 'industrial') ? r * 0.95 : r * 0.8;
  accent(c, '#d23b2f', () => {
    c.save(); c.fillStyle = '#d23b2f'; c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.fill(); c.restore();
    c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.stroke();
  });
  C(c, 0, 0, rr * 0.35);
  thick(c, 1.6); L(c, rr * 0.3, -rr * 0.2, rr * 1.1, -rr * 0.7); thick(c, 1 / 1.6);
  if (has(k, 'stand')) { L(c, -r, r * 0.95, r, r * 0.95); L(c, -r * 0.8, r * 0.95, -r * 0.8, rr); L(c, r * 0.8, r * 0.95, r * 0.8, rr); }
  if (has(k, 'industrial')) { Co(c, 0, 0, rr * 1.05); }
};

draw.tFireCab = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  R(c, -w / 2, -d / 2, w, d);
  L(c, -w / 2, d / 2 - m * 0.12, w / 2, d / 2 - m * 0.12);
  accent(c, '#d23b2f', () => { c.lineWidth *= 1.8; Co(c, has(k, 'horizontal') ? -w * 0.2 : 0, -d * 0.06, m * 0.3); Co(c, has(k, 'horizontal') ? -w * 0.2 : 0, -d * 0.06, m * 0.12); });
  if (has(k, 'horizontal')) Ro(c, w * 0.08, -d * 0.32, w * 0.3, d * 0.5);
};

draw.tAlarm = (c, w, d, it) => {
  const k = kindOf(it), m = Math.min(w, d);
  RR(c, -w / 2, -d / 2, w, d, m * 0.12);
  if (has(k, 'leak')) {
    accent(c, COLD, () => { const x = -w * 0.25, r = m * 0.3; c.beginPath(); c.moveTo(x, -r); c.bezierCurveTo(x + r * 0.8, 0, x + r * 0.6, r, x, r); c.bezierCurveTo(x - r * 0.6, r, x - r * 0.8, 0, x, -r); c.stroke(); });
    P(c, [w * 0.08, -d * 0.25, w * 0.4, d * 0.25, w * 0.4, -d * 0.25, w * 0.08, d * 0.25]);
    return;
  }
  Ro(c, -w * 0.42, -d * 0.3, w * 0.36, d * 0.6);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) Cs(c, w * 0.08 + i * w * 0.12, -d * 0.15 + j * d * 0.3, m * 0.07);
};

// ======================= ĒKAS ELEMENTI =======================

draw.tGasMeter = (c, w, d) => {
  const m = Math.min(w, d);
  RR(c, -w / 2, -d / 2, w, d, m * 0.1);
  Co(c, -w * 0.15, 0, m * 0.3);
  L(c, -w * 0.15, 0, -w * 0.15 + m * 0.2, -m * 0.12);
  accent(c, GAS, () => { c.lineWidth *= 2; L(c, w * 0.22, -d / 2, w * 0.22, d / 2); L(c, w * 0.38, -d / 2, w * 0.38, d / 2); });
};

draw.tColumn = (c, w, d) => {
  R(c, -w / 2, -d / 2, w, d);
  c.save(); c.beginPath(); c.rect(-w / 2, -d / 2, w, d); c.clip();
  c.lineWidth *= 0.6;
  const s = Math.max(4, Math.min(w, d) / 5);
  for (let t = -w - d; t < w + d; t += s) L(c, t - d, d / 2, t + d, -d / 2);
  c.restore();
};

draw.tCeilingSupport = (c, w, d) => {
  const m = Math.min(w, d);
  dash(c, m * 0.05); Ro(c, -w / 2, -d / 2, w, d); nodash(c);
  L(c, -w / 2, 0, w / 2, 0); L(c, 0, -d / 2, 0, d / 2);
  for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const px = x * (w / 2 - m * 0.08), py = y * (d / 2 - m * 0.08); C(c, px, py, m * 0.05); L(c, px - m * 0.04, py, px + m * 0.04, py); }
};

draw.elevator = (c, w, d) => {
  const m = Math.min(w, d);
  thick(c, 2); R(c, -w / 2, -d / 2, w, d); thick(c, 0.5);
  Ro(c, -w / 2 + m * 0.08, -d / 2 + m * 0.08, w - m * 0.16, d - m * 0.24);
  L(c, -w / 2 + m * 0.08, -d / 2 + m * 0.08, w / 2 - m * 0.08, d / 2 - m * 0.16);
  L(c, w / 2 - m * 0.08, -d / 2 + m * 0.08, -w / 2 + m * 0.08, d / 2 - m * 0.16);
  thick(c, 2); L(c, -w * 0.3, d / 2 - m * 0.04, w * 0.3, d / 2 - m * 0.04); thick(c, 0.5);
};

draw.tEscalator = (c, w, d) => {
  R(c, -w / 2, -d / 2, w, d);
  const rail = w * 0.12;
  L(c, -w / 2 + rail, -d / 2, -w / 2 + rail, d / 2); L(c, w / 2 - rail, -d / 2, w / 2 - rail, d / 2);
  const n = Math.max(3, Math.round(d / 40));
  for (let i = 1; i < n; i++) { const y = -d / 2 + (d / n) * i; L(c, -w / 2 + rail, y, w / 2 - rail, y); }
  arrow(c, 0, d / 2 - d * 0.1, 0, -d / 2 + d * 0.1, Math.min(w, d) * 0.12);
};

draw.tAtticStairs = (c, w, d) => {
  const m = Math.min(w, d);
  dash(c, m * 0.06); Ro(c, -w / 2, -d / 2, w, d); nodash(c); // lūka griestos
  R(c, -w * 0.35, -d / 2, w * 0.7, d);
  const n = Math.max(3, Math.round(d / 25));
  for (let i = 1; i < n; i++) { const y = -d / 2 + (d / n) * i; L(c, -w * 0.35, y, w * 0.35, y); }
  arrow(c, 0, d / 2 - d * 0.08, 0, -d / 2 + d * 0.12, m * 0.15);
};

draw.tStepLadder = (c, w, d) => {
  P(c, [-w * 0.45, -d / 2, w * 0.45, -d / 2, w / 2, d / 2, -w / 2, d / 2]);
  for (let y = -d / 2 + d * 0.2; y < d / 2 - 1; y += d * 0.2) L(c, -w * 0.47, y, w * 0.47, y);
  L(c, -w * 0.45, -d / 2, w * 0.45, -d / 2);
};

draw.tCurvedStairs = (c, w, d) => {
  const r1 = Math.min(w, d * 2) / 2 * 0.98, r0 = r1 * 0.3, cy = Math.min(d / 2, r1 / 2);
  c.beginPath(); c.arc(0, cy, r1, PI, TAU); c.arc(0, cy, r0, TAU, PI, true); c.closePath(); fs(c);
  const n = 9;
  for (let i = 1; i < n; i++) { const t = PI + (PI * i) / n; L(c, Math.cos(t) * r0, cy + Math.sin(t) * r0, Math.cos(t) * r1, cy + Math.sin(t) * r1); }
  c.beginPath(); c.arc(0, cy, (r0 + r1) / 2, PI * 1.08, PI * 1.9); c.stroke();
  const t = PI * 1.9, rm = (r0 + r1) / 2, s = (r1 - r0) * 0.3;
  const x = Math.cos(t) * rm, y = cy + Math.sin(t) * rm;
  P(c, [x + s * 0.4, y + s, x - s * 0.7, y - s * 0.2, x + s * 0.9, y - s * 0.4]);
};

draw.tStairsFlight = (c, w, d, it) => {
  const k = kindOf(it);
  const m = Math.min(w, d);
  R(c, -w / 2, -d / 2, w, d);
  const n = Math.max(2, Math.round(d / 28));
  const trap = has(k, 'trapezoidal');
  for (let i = 1; i < n; i++) {
    const y = -d / 2 + (d / n) * i;
    if (trap) L(c, -w / 2, y, w / 2, y - (d / n) * 0.5 * (1 - i / n));
    else L(c, -w / 2, y, w / 2, y);
  }
  if (has(k, 'cantilever')) { thick(c, 2.4); L(c, -w / 2, -d / 2, -w / 2, d / 2); thick(c, 1 / 2.4); }
  if (has(k, 'porch', 'descent')) { dash(c, m * 0.05); L(c, -w / 2 + m * 0.06, -d / 2, -w / 2 + m * 0.06, d / 2); L(c, w / 2 - m * 0.06, -d / 2, w / 2 - m * 0.06, d / 2); nodash(c); }
  const down = has(k, 'descent');
  const yA = down ? -d / 2 + 12 : d / 2 - 12, yB = down ? d / 2 - 10 : -d / 2 + 10;
  Cs(c, 0, yA, Math.min(3, w * 0.04));
  arrow(c, 0, yA, 0, yB, Math.min(10, w * 0.12));
};

draw.tStairsThree = (c, w, d) => {
  R(c, -w / 2, -d / 2, w, d);
  const land = Math.min(w, d) * 0.9;
  // trīs laidi: augšā pa kreisi, laukums, pa labi uz leju
  L(c, -w / 2, -d / 2 + land * 0.45, w / 2, -d / 2 + land * 0.45);
  L(c, 0, -d / 2 + land * 0.45, 0, d / 2);
  for (let y = -d / 2 + land * 0.45 + 28; y < d / 2; y += 28) L(c, -w / 2, y, w / 2, y);
  arrow(c, -w / 4, d / 2 - 10, -w / 4, -d / 2 + land * 0.2, Math.min(10, w * 0.1));
  L(c, -w / 4, -d / 2 + land * 0.2, w / 4, -d / 2 + land * 0.2);
  arrow(c, w / 4, -d / 2 + land * 0.2, w / 4, d / 2 - 10, Math.min(10, w * 0.1));
};

// ======================= PIEŠĶIRŠANA =======================

const assign = {};
const A = (fam, keys) => { for (const k of keys.split(/\s+/).filter(Boolean)) assign[k] = fam; };

// santehnika
A('tVanity', `floor_mounted_vanity_sink wall_mounted_vanity_unit_with_sink double_floor_mounted_vanity_unit double_wall_mounted_vanity_unit
  floor_mounted_console_with_sink wall_mounted_console_with_sink wall_mounted_vanity_cabinet floor_standing_vanity_cabinet
  wall_mounted_vanity_base floor_standing_vanity_base vanity_cabinet_with_drawers`);
A('tVanityWasher', 'floor_standing_vanity_unit_with_sink_for_washing wall_mounted_vanity_unit_with_sink_for_washing_m');
A('tBasin', 'wall_mounted_sink double_wall_mounted_sink compact_sink over_washer_sink pedestal_sink freestanding_sink semi_recessed_sink basin');
A('tVessel', 'rectangular_vessel_sink round_vessel_sink oval_vessel_sink teardrop_vessel_sink');
A('tCounterSink', 'sink_with_countertop asymmetrical_countertop_sink drop_in_sink');
A('tCab', `floor_standing_linen_cabinet wall_mounted_linen_cabinet open_linen_cabinet corner_linen_cabinet over_washer_linen_cabinet
  wall_mounted_mirror_cabinet compact_toilet_cabinet open_shelving_unit over_the_toilet_cabinet`);
A('tWasher', 'top_load_washing_machine compact_washing_machine clothes_dryer stacked_dryer drying_cabinet');
A('tHeater', `tankless_water_heater storage_water_heater cylindrical_storage_water_heater horizontal_water_heater hand_dryer
  reverse_osmosis_filter storage_tank_for_filter tankless_gas_water_heater`);
A('tBath', `acrylic_bathtub cast_iron_bathtub steel_bathtub whirlpool_bathtub corner_bathtub corner_whirlpool_bathtub offset_bathtub
  offset_bathtub_with_seat alcove_bathtub freestanding_bathtub freestanding_bathtub_with_legs tub_and_shower_combo bath170`);
A('tBathFaucet', 'bathtub_faucet_with_spout short_spout_bathtub_faucet deck_mounted_bathtub_faucet floor_mounted_bathtub_faucet');
A('tShower', `glass_shower_screen square_shower_enclosure rectangular_shower_enclosure curved_rectangular_shower_enclosure curved_shower_enclosure
  quarter_circle_shower_enclosure steam_shower_enclosure square_shower_base rectangular_shower_base curved_rectangular_shower_base curved_shower_base
  quarter_circle_shower_base neo_angle_shower_base square_pallet rectangular_pallet rounded_rectangular_pallet square_hinged square_sliding
  rectangular_sliding rectangular_hinged curved_rectangular_hinged curved_rectangular_sliding curved_sliding quarter_circle_sliding neo_angle_hinged
  alcove_sliding_shower_door alcove_hinged_shower_door alcove_folding_shower_door shower_screen`);
A('tShowerSeat', 'shower_seat');
A('tFlush', 'toilet_flush_panel');
A('tShowerPanel', 'shower_panel');
A('faucet', 'thermostatic_bidet_spray');
A('tHatch', 'access_panel tile_in_access_panel');
A('tAcc', 'towel_shelf towel_hooks towel_bar toilet_paper_holder toilet_brush wall_mounted_toilet_brush toilet_paper_dispenser towel_dispenser');
A('tBin', 'laundry_basket bathroom_wastebasket mop_with_bucket');
// apkure
A('radiator', 'floor_standing_onvector');
A('sensor', 'thermostat');
// elektrība
A('tWireOut', '220v_wire_outlet lighting_wire_out oven_connection_terminal cooktop_wire_out ac_unit_wire_out low_voltage_wire_out floor_wire_out ceiling_wire_out');
A('tLowCurrent', 'intercom video_intercom wi_fi_router ceiling_wi_fi_router');
// apgaismojums
A('chandelier', 'led_flush_mount_handelier');
A('tSpot', `recessed_spotlight double_recessed_light triple_recessed_light surface_mounted_light double_surface_mounted_light triple_surface_mounted_light
  recessed_track track_spotlight suspended_spotlight panel_light`);
A('tLinearLight', 'linear_light');
A('tCeilingPanel', 'armstrong_ceiling_panel');
// klimats
A('tAcFloor', 'floor_standing_air_conditioner');
A('tAcBasket', 'basket_for_an_air_conditioner');
A('tFan', 'ceiling_fan wall_fan duct_fan bladed_fan wall_mounted_blade_fan');
// drošība
A('tExtinguisher', 'freestanding_fire_extinguisher fire_extinguisher_on_a_stand industrial_fire_extinguisher fire_extinguisher_cabinet');
A('tFireCab', 'vertical_fire_cabinet horizontal_fire_cabinet small_fire_cabinet');
A('tAlarm', 'leak_control_panel alarm_panel');
// ēka
A('tGasMeter', 'gas_meter');
A('tColumn', 'support_post');
A('tCeilingSupport', 'ceiling_embedded_support');
A('tEscalator', 'escalator');
A('tAtticStairs', 'folding_attic_stairs');
A('tStepLadder', 'step_ladder');
A('tCurvedStairs', 'curved_stairs');
A('tStairsFlight', 'straight_flight_stairs straight_cantilever_stairs trapezoidal_stairs descent_stairs porch_stairs');
A('tStairsThree', 'three_flight_stairs');
// Drošībai: piesaistām tikai atslēgas, kas tiešām eksistē (vecā kataloga atslēgas apstrādā catalog.js pats).
for (const k of Object.keys(assign)) if (!ITEMS[k]) delete assign[k];

// ======================= 3D =======================

const build = {
  tBath: (it) => [[0, it.h / 2, 0, it.w, it.h, it.d, 'white']],
  tVanity: (it) => [[0, (it.h - 4) / 2, 0, it.w, it.h - 4, it.d], [0, it.h - 2, 0, it.w, 4, it.d, 'white']],
  tVanityWasher: (it) => [[0, (it.h - 4) / 2, 0, it.w, it.h - 4, it.d], [0, it.h - 2, 0, it.w, 4, it.d, 'white']],
  tBasin: (it) => [[0, it.h - 8, 0, it.w, 16, it.d, 'white'], ...(String(it.kind).includes('pedestal') ? [[0, (it.h - 16) / 2, 0, 16, it.h - 16, 16, 'white', 'cyl']] : [])],
  tVessel: (it) => [[0, it.h - 7, 0, Math.min(it.w, it.d) * 0.8, 14, Math.min(it.w, it.d) * 0.8, 'white', 'cyl']],
  tCounterSink: (it) => [[0, it.h - 2, 0, it.w, 4, it.d, 'white']],
  toilet: (it) => {
    const wall = String(it.kind).includes('wall_hung');
    const base = wall ? 25 : 0;
    return [[0, base + 20, it.d * 0.08, it.w * 0.8, 40, it.d * 0.75, 'white', 'cyl'], [0, wall ? 55 : 60, -it.d / 2 + it.d * 0.1, it.w, wall ? 110 : 40, it.d * 0.2, 'white']];
  },
  bidet: (it) => [[0, 20, it.d * 0.06, it.w * 0.85, 40, it.d * 0.85, 'white', 'cyl']],
  urinal: (it) => [[0, it.h / 2 + 40, 0, it.w, it.h, it.d, 'white']],
  tShower: (it) => {
    const k = String(it.kind);
    const parts = [[0, 4, 0, it.w, 8, it.d, 'white']];
    if (!/base|pallet/.test(k)) {
      parts.push([0, it.h / 2, it.d / 2 - 1, it.w, it.h, 1]);
      if (!/alcove|screen/.test(k)) parts.push([it.w / 2 - 1, it.h / 2, 0, 1, it.h, it.d]);
    }
    return parts;
  },
  tWasher: (it) => [[0, it.h / 2, 0, it.w, it.h, it.d, 'white'], [0, it.h * 0.45, it.d / 2, it.w * 0.55, it.w * 0.55, 1, 'dark', 'cyl']],
  tHeater: (it) => (/storage|cylindrical|tank/.test(String(it.kind)) && !/horizontal/.test(String(it.kind)) ? [[0, it.h / 2, 0, Math.min(it.w, it.d), it.h, Math.min(it.w, it.d), 'white', 'cyl']] : [[0, it.h / 2, 0, it.w, it.h, it.d, 'white']]),
  tSpot: (it) => [[0, 0, 0, Math.min(it.w, it.d), 3, Math.min(it.w, it.d), 'white', 'cyl', 'light']],
  tLinearLight: (it) => [[0, 0, 0, it.w, 4, Math.min(it.d, 8), 'white', null, 'light']],
  tCeilingPanel: (it) => [[0, 0, 0, it.w, 3, it.d, 'white', null, 'light']],
  track: (it) => [[0, it.h - 2, 0, it.w, 4, 4, 'dark'], [-it.w * 0.3, it.h - 8, 0, 6, 8, 6, 'white', 'cyl', 'light'], [it.w * 0.3, it.h - 8, 0, 6, 8, 6, 'white', 'cyl', 'light']],
  tFan: (it) => [[0, it.h / 2, 0, Math.min(it.w, it.d * 2), 3, Math.min(it.w, it.d * 2), null, 'cyl'], [0, it.h / 2, 0, 10, it.h, 10, 'dark', 'cyl']],
  tExtinguisher: (it) => [[0, it.h / 2, 0, Math.min(it.w, it.d) * 0.8, it.h, Math.min(it.w, it.d) * 0.8, null, 'cyl']],
  tColumn: (it) => [[0, it.h / 2, 0, it.w, it.h, it.d]],
  tAcFloor: (it) => [[0, it.h / 2, 0, it.w, it.h, it.d, 'white']],
  acIndoor: (it) => [[0, it.h / 2, 0, it.w, it.h, it.d, 'white']],
  tEscalator: (it) => build.tStairsFlight(it),
  tStairsFlight: (it) => {
    const n = Math.max(2, Math.round(it.d / 28)), sd = it.d / n, sh = it.h / n;
    return Array.from({ length: n }, (_, i) => [0, sh * (i + 0.5), it.d / 2 - sd * (i + 0.5), it.w, sh, sd]);
  },
};
for (const fam of ['tWireOut', 'tLowCurrent', 'tAlarm', 'tFlush', 'tShowerPanel', 'tHatch', 'tGasMeter']) build[fam] = (it) => [[0, it.h / 2, 0, it.w, it.h, it.d]];

const colors = {
  tVanity: '#ece6dc', tVanityWasher: '#ece6dc', tBasin: '#f4f6f8', tVessel: '#f4f6f8', tCounterSink: '#e9e6df', tCab: '#e7e1d6',
  tWasher: '#eef0f2', tHeater: '#f0f0f0', tBath: '#f4f6f8', tBathFaucet: '#c9ced3', tShower: '#d8e9f3', tShowerSeat: '#c9a477',
  tFlush: '#e6e8ea', tShowerPanel: '#d0d4d8', tHatch: '#e4e4e4', tAcc: '#c9ced3', tBin: '#d9d4cb',
  tWireOut: '#ffffff', tLowCurrent: '#f4f4f4', tSpot: '#fff3c4', tLinearLight: '#fff3c4', tCeilingPanel: '#fff8dc',
  tAcFloor: '#f4f6f8', tAcBasket: '#cfd3d8', tFan: '#e3e6e9', tExtinguisher: '#ffffff', tFireCab: '#f2d6d3', tAlarm: '#f4f4f4',
  tGasMeter: '#f3e7b5', tColumn: '#c8c8c8', tCeilingSupport: '#e0e0e0', tEscalator: '#c8c8c8', tAtticStairs: '#c49a6c', tStepLadder: '#c9ced3',
  tCurvedStairs: '#c49a6c', tStairsFlight: '#c49a6c', tStairsThree: '#c49a6c',
};

// Drošības apvalks: neviens simbols nedrīkst izmest kļūdu vai atstāt mainītu konteksta stāvokli.
const safe = (fn) => (c, w, d, it) => {
  if (!(w > 0) || !(d > 0)) return;
  c.save();
  try { fn(c, w, d, it); } catch (e) { globalThis.__symTechErrors?.push?.([it?.kind, String(e)]); } finally { c.restore(); }
};
const safeBuild = (fn) => (it) => { try { const r = fn(it); return Array.isArray(r) ? r : [[0, it.h / 2, 0, it.w, it.h, it.d]]; } catch { return [[0, it.h / 2, 0, it.w, it.h, it.d]]; } };
const drawOut = {};
for (const [k, fn] of Object.entries(draw)) drawOut[k] = safe(fn);
const buildOut = {};
for (const [k, fn] of Object.entries(build)) buildOut[k] = safeBuild(fn);

export { drawOut as draw, buildOut as build, assign, colors };
