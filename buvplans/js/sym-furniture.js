// Papildu 2D simboli un 3D modeļi (furniture). Pašu zīmēti; aizpilda aģents.
// draw[fam](ctx, w, d, it) — lokālās koord.: centrs (0,0), priekšpuse +y, aizmugure (pie sienas) −y; ctx.fillStyle/strokeStyle jau iestatīti.
// build[fam](it) → [[x, y, z, w, h, d, tone?, shape?, flag?], ...] — kastes cm (centrs; y uz augšu no grīdas).
// assign: { itemKey: fam } — kuriem ITEMS (catalog-data.js) lietot jauno simbolu; colors: { fam: '#hex' }.
//
// Visi simboli ir zīmēti no jauna kā vienkārši plāna (skats no augšas) piktogrammas. Krāsas nemaina —
// tikai ctx.globalAlpha (mīkstas detaļas) un ēnojums ar līnijas krāsu (tone), lai darbotos arī mono ikonās.

const PI = Math.PI, TAU = PI * 2;
const cl = (v, a, b) => Math.max(a, Math.min(b, v));
const pos = (v) => (v > 0 ? v : 0);
const K = (it) => String((it && it.kind) || '');
const has = (it, ...s) => { const k = K(it); return s.some((x) => k.includes(x)); };
const up = (it) => ((it && it.elev) || 0) > 60;

// ---------- Zīmēšanas palīgi ----------
const R = (c, x, y, w, h) => { c.beginPath(); c.rect(x, y, w, h); c.fill(); c.stroke(); };
const RR = (c, x, y, w, h, r) => {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, Array.isArray(r) ? r.map((v) => cl(v, 0, Math.min(Math.abs(w), Math.abs(h)) / 2)) : cl(r || 0, 0, Math.min(Math.abs(w), Math.abs(h)) / 2));
  else c.rect(x, y, w, h);
  c.fill(); c.stroke();
};
const C = (c, x, y, r) => { c.beginPath(); c.arc(x, y, pos(r), 0, TAU); c.fill(); c.stroke(); };
const CS = (c, x, y, r) => { c.beginPath(); c.arc(x, y, pos(r), 0, TAU); c.stroke(); };
const E = (c, x, y, rx, ry, rot = 0) => { c.beginPath(); c.ellipse(x, y, pos(rx), pos(ry), rot, 0, TAU); c.fill(); c.stroke(); };
const ES = (c, x, y, rx, ry, a0 = 0, a1 = TAU) => { c.beginPath(); c.ellipse(x, y, pos(rx), pos(ry), 0, a0, a1); c.stroke(); };
const L = (c, ...p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); };
const P = (c, ...p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.closePath(); c.fill(); c.stroke(); };
const soft = (c, fn, a = 0.5) => { c.save(); c.globalAlpha *= a; fn(); c.restore(); };
const tone = (c, a, fn) => { c.save(); c.globalAlpha *= a; c.fillStyle = c.strokeStyle; fn(); c.restore(); };
const dash = (c, u, fn) => { c.save(); c.setLineDash?.([u, u * 0.7]); fn(); c.restore(); };
const du = (w, d) => cl(Math.min(w, d) * 0.07, 1.2, 5);
// Elipses josla (loks ar biezumu t) starp leņķiem a0..a1.
const eband = (c, cx, cy, rx, ry, t, a0, a1) => {
  c.beginPath();
  c.ellipse(cx, cy, pos(rx), pos(ry), 0, a0, a1);
  c.ellipse(cx, cy, pos(rx - t), pos(ry - t), 0, a1, a0, true);
  c.closePath(); c.fill(); c.stroke();
};
// Galvenā kontūra; virs grīdas piekārtiem priekšmetiem — raustīta (plāna konvencija).
const body = (c, w, d, it, r = 0) => {
  if (up(it)) dash(c, du(w, d), () => RR(c, -w / 2, -d / 2, w, d, r));
  else RR(c, -w / 2, -d / 2, w, d, r);
};
// Garā ass pa x (ja d > w — pagriež par 90°).
const alongX = (c, w, d, fn) => { if (d > w) { c.save(); c.rotate(PI / 2); fn(d, w); c.restore(); } else fn(w, d); };
const alongY = (c, w, d, fn) => { if (w > d) { c.save(); c.rotate(-PI / 2); fn(d, w); c.restore(); } else fn(w, d); };
// Spilvenu rinda taisnstūrī.
const cushions = (c, x, y, W, H, r) => {
  if (W <= 1 || H <= 1) return;
  const along = W >= H, len = along ? W : H, n = cl(Math.round(len / 65), 1, 6), s = len / n, g = cl(Math.min(W, H) * 0.03, 0.3, 1.5);
  for (let i = 0; i < n; i++) {
    if (along) RR(c, x + i * s + g, y + g, s - 2 * g, H - 2 * g, r);
    else RR(c, x + g, y + i * s + g, W - 2 * g, s - 2 * g, r);
  }
};
const flake = (c, x, y, r) => {
  for (let i = 0; i < 3; i++) {
    const a = (i * PI) / 3, dx = Math.cos(a) * r, dy = Math.sin(a) * r;
    L(c, x - dx, y - dy, x + dx, y + dy);
  }
};
const casters = (c, w, d, r) => { for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(c, sx * (w / 2 - r * 1.2), sy * (d / 2 - r * 1.2), r); };
const tripod = (c, rr) => { for (let i = 0; i < 3; i++) { const a = PI / 2 + (i * TAU) / 3; L(c, 0, 0, Math.cos(a) * rr, Math.sin(a) * rr); } };
const star = (c, rr, n = 5, cr = 0) => {
  for (let i = 0; i < n; i++) {
    const a = -PI / 2 + (i * TAU) / n + PI / n, x = Math.cos(a) * rr, y = Math.sin(a) * rr;
    L(c, 0, 0, x, y);
    if (cr) C(c, x, y, cr);
  }
};
const handle = (c, x, y, hw, t) => RR(c, x - hw / 2, y - t / 2, hw, t, t / 2);
const grid = (c, x, y, W, H, nx, ny) => {
  for (let i = 1; i < nx; i++) L(c, x + (W * i) / nx, y, x + (W * i) / nx, y + H);
  for (let j = 1; j < ny; j++) L(c, x, y + (H * j) / ny, x + W, y + (H * j) / ny);
};
const plate = (c, x, y, r) => { C(c, x, y, r); soft(c, () => CS(c, x, y, r * 0.62)); };
const chairG = (c, x, y, cw, cd) => {
  const b = cd * 0.2;
  RR(c, x - cw / 2, y - cd / 2 + b * 0.5, cw, cd - b * 0.5, cw * 0.15);
  RR(c, x - cw / 2, y - cd / 2, cw, b, b / 2);
};
const books = (c, x, y, W, H) => {
  soft(c, () => {
    let px = x + W * 0.04, i = 0;
    while (px < x + W * 0.94) {
      const bw = cl(W * (0.035 + ((i * 7) % 5) * 0.008), 0.6, 4), bh = H * (0.55 + ((i * 3) % 4) * 0.1);
      R(c, px, y + H - bh, Math.min(bw, x + W * 0.96 - px), bh);
      px += bw + (i % 6 === 5 ? W * 0.06 : 0); i++;
      if (i > 60) break;
    }
  }, 0.55);
};
const flame = (c, x, y, s) => {
  c.beginPath(); c.moveTo(x, y - s); c.quadraticCurveTo(x + s * 0.75, y + s * 0.2, x, y + s * 0.6); c.quadraticCurveTo(x - s * 0.75, y + s * 0.2, x, y - s); c.closePath();
  c.fill(); c.stroke();
};
const wheel = (c, x, y, ww, wh) => tone(c, 0.7, () => RR(c, x - ww / 2, y - wh / 2, ww, wh, Math.min(ww, wh) * 0.3));

// ---------- Simboli ----------
const D = {
  // ===== Sēdmēbeles =====
  sofa(c, w, d, it) {
    const m = Math.min(w, d), r = cl(m * 0.08, 1, 8);
    const armless = has(it, 'armless', 'bench_sofa', 'lobby', 'pallet');
    const hi = has(it, 'high_back', 'privacy', 'screen');
    const a = armless ? 0 : cl(w * 0.09, 2, Math.min(20, w * 0.22));
    const b = cl(d * (hi ? 0.3 : 0.22), 2, hi ? 32 : 24);
    RR(c, -w / 2, -d / 2, w, d, r);
    RR(c, -w / 2, -d / 2, w, b, r);
    if (a) { RR(c, -w / 2, -d / 2, a, d, r); RR(c, w / 2 - a, -d / 2, a, d, r); }
    cushions(c, -w / 2 + a, -d / 2 + b, w - 2 * a, d - b, r);
    if (hi) tone(c, 0.25, () => R(c, -w / 2, -d / 2, w, b * 0.35));
  },
  sofaCurve(c, w, d, it) {
    if (has(it, 'round_modular', 'oval_modular', 'round_lobby')) {
      const rx = w / 2, ry = d / 2, s = Math.min(rx, ry) * 0.5;
      E(c, 0, 0, rx, ry);
      tone(c, 0.25, () => E(c, 0, 0, rx - s, ry - s));
      E(c, 0, 0, rx - s - Math.min(rx, ry) * 0.12, ry - s - Math.min(rx, ry) * 0.12);
      const n = cl(Math.round((PI * (rx + ry)) / 70), 3, 10);
      for (let i = 0; i < n; i++) { const a = (i * TAU) / n; L(c, Math.cos(a) * (rx - s), Math.sin(a) * (ry - s), Math.cos(a) * rx, Math.sin(a) * ry); }
      return;
    }
    const cy = d / 2, rx = w / 2, ry = d, mm = Math.min(rx, ry);
    const s = cl(mm * 0.7, 3, 80), b = cl(s * 0.28, 1.5, 20);
    eband(c, 0, cy, rx, ry, s, PI, TAU);
    eband(c, 0, cy, rx, ry, b, PI, TAU);
    const len = PI * Math.sqrt(((rx - s / 2) ** 2 + (ry - s / 2) ** 2) / 2), n = cl(Math.round(len / 70), 2, 7);
    for (let i = 1; i < n; i++) {
      const t = PI + (i * PI) / n, ct = Math.cos(t), st = Math.sin(t);
      L(c, ct * (rx - b), cy + st * (ry - b), ct * (rx - s), cy + st * (ry - s));
    }
  },
  cornerSofa(c, w, d, it) {
    const m = Math.min(w, d), a = Math.min(m * 0.55, 100), b = cl(a * 0.24, 2, 22), r = cl(m * 0.04, 1, 6);
    const chaise = has(it, 'chaise');
    const noArm = has(it, 'corner_module', 'kitchen') || (chaise && !has(it, 'armrest'));
    const ar = noArm ? 0 : cl(a * 0.2, 2, 18);
    if (chaise) {
      P(c, -w / 2, -d / 2, w / 2, -d / 2, w / 2, d / 2, w / 2 - a, d / 2, w / 2 - a, -d / 2 + a, -w / 2, -d / 2 + a);
      R(c, -w / 2, -d / 2, w, b);
      if (ar) R(c, -w / 2, -d / 2, ar, a);
      cushions(c, -w / 2 + ar, -d / 2 + b, w - a - ar, a - b, r);
      RR(c, w / 2 - a + 1, -d / 2 + b + 1, a - 2, d - b - 2, r);
      soft(c, () => L(c, w / 2 - a + 2, -d / 2 + a, w / 2 - 2, -d / 2 + a));
      return;
    }
    P(c, -w / 2, -d / 2, w / 2, -d / 2, w / 2, -d / 2 + a, -w / 2 + a, -d / 2 + a, -w / 2 + a, d / 2, -w / 2, d / 2);
    R(c, -w / 2, -d / 2, w, b);
    R(c, -w / 2, -d / 2, b, d);
    if (ar) { R(c, w / 2 - ar, -d / 2, ar, a); R(c, -w / 2, d / 2 - ar, a, ar); }
    RR(c, -w / 2 + b + 1, -d / 2 + b + 1, a - b - 2, a - b - 2, r);
    cushions(c, -w / 2 + a, -d / 2 + b, w - a - ar, a - b, r);
    cushions(c, -w / 2 + b, -d / 2 + a, a - b, d - a - ar, r);
  },
  armchair(c, w, d, it) {
    const m = Math.min(w, d), r = cl(m * 0.14, 1, 12);
    const armless = has(it, 'armless', 'chaise_armchair');
    const hi = has(it, 'high_back', 'privacy', 'wing');
    let H = d;
    if (has(it, 'with_ottoman')) {
      H = d * 0.64;
      RR(c, -w * 0.34, -d / 2 + H + d * 0.05, w * 0.68, d - H - d * 0.05, r * 0.6);
      tone(c, 0.6, () => C(c, 0, -d / 2 + H + d * 0.05 + (d - H - d * 0.05) / 2, m * 0.02));
    }
    const a = armless ? 0 : cl(w * (hi ? 0.2 : 0.16), 1.5, 20), b = cl(H * (hi ? 0.3 : 0.24), 1.5, 30);
    RR(c, -w / 2, -d / 2, w, H, r);
    RR(c, -w / 2, -d / 2, w, b, r);
    if (a) { RR(c, -w / 2, -d / 2, a, H, r); RR(c, w / 2 - a, -d / 2, a, H, r); }
    const g = cl(m * 0.03, 0.3, 2);
    RR(c, -w / 2 + a + g, -d / 2 + b + g, w - 2 * a - 2 * g, H - b - 2 * g, r * 0.6);
    if (has(it, 'recliner', 'sleeper', 'massage', 'chaise')) dash(c, du(w, d), () => L(c, -w / 2 + a + g * 2, -d / 2 + H * 0.78, w / 2 - a - g * 2, -d / 2 + H * 0.78));
  },
  eggChair(c, w, d, it) {
    if (has(it, 'bean_bag')) {
      E(c, 0, 0, w / 2, d / 2);
      E(c, w * 0.04, d * 0.12, w * 0.3, d * 0.27);
      soft(c, () => { L(c, -w * 0.38, -d * 0.2, -w * 0.18, -d * 0.05); L(c, w * 0.32, -d * 0.28, w * 0.2, -d * 0.1); });
      return;
    }
    const t = has(it, 'privacy', 'high_back', 'oversized') ? 0.2 : 0.13;
    E(c, 0, 0, w / 2, d / 2);
    E(c, 0, d * t * 0.6, w * (0.5 - t), d * (0.5 - t * 0.8));
    soft(c, () => E(c, 0, d * t * 0.9, w * (0.36 - t * 0.5), d * (0.34 - t * 0.5)));
    if (has(it, 'hanging', 'hammock')) tone(c, 0.7, () => C(c, 0, -d / 2 + d * 0.06, Math.min(w, d) * 0.04));
  },
  rockingChair(c, w, d, it) {
    const rw = cl(w * 0.05, 0.6, 3);
    RR(c, -w / 2, -d / 2, rw, d, rw / 2);
    RR(c, w / 2 - rw, -d / 2, rw, d, rw / 2);
    c.save(); c.translate(0, -d * 0.03);
    D.armchair(c, w * 0.84, d * 0.8, null);
    c.restore();
  },
  lounger(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      RR(c, -W / 2, -H / 2, W, H, m * 0.18);
      const hx = -W / 2 + W * 0.34;
      tone(c, 0.15, () => RR(c, -W / 2, -H / 2, W * 0.34, H, m * 0.18));
      L(c, hx, -H / 2, hx, H / 2);
      RR(c, -W / 2 + W * 0.04, -H * 0.32, W * 0.1, H * 0.64, m * 0.1);
      soft(c, () => { const n = cl(Math.round((W * 0.62) / 9), 2, 14); for (let i = 1; i < n; i++) { const x = hx + (i * (W / 2 - hx)) / n; L(c, x, -H / 2 + 1, x, H / 2 - 1); } });
    });
  },
  chair(c, w, d, it) {
    const m = Math.min(w, d), b = cl(d * 0.16, 1, 9), r = cl(m * 0.14, 0.6, 7);
    if (has(it, 'bentwood', 'wishbone', 'guitarist')) {
      const rr = Math.min(w * 0.47, d * 0.44);
      C(c, 0, d / 2 - rr - d * 0.02, rr);
      eband(c, 0, d / 2 - rr - d * 0.02, rr * 1.06, rr * 1.06, cl(rr * 0.2, 1, 5), PI * 1.08, PI * 1.92);
      soft(c, () => CS(c, 0, d / 2 - rr - d * 0.02, rr * 0.7));
      return;
    }
    let H = d;
    if (has(it, 'highchair')) H = d * 0.75;
    RR(c, -w / 2 + w * 0.04, -d / 2 + b * 0.5, w * 0.92, H - b * 0.5, r);
    RR(c, -w / 2, -d / 2, w, b, b / 2);
    soft(c, () => RR(c, -w * 0.34, -d / 2 + b * 1.4, w * 0.68, H - b * 2, r));
    if (has(it, 'highchair')) {
      RR(c, -w * 0.46, -d / 2 + H - d * 0.02, w * 0.92, d - H + d * 0.02, r);
      soft(c, () => { for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(c, sx * w * 0.44, sy * d * 0.45, m * 0.04); });
    }
  },
  officeChair(c, w, d, it) {
    const m = Math.min(w, d);
    soft(c, () => star(c, m * 0.45, 5, m * 0.045));
    RR(c, -w * 0.33, -d * 0.24, w * 0.66, d * 0.62, m * 0.14);
    const wide = has(it, 'gaming', 'executive');
    RR(c, -w * (wide ? 0.4 : 0.34), -d / 2 + d * 0.02, w * (wide ? 0.8 : 0.68), d * 0.17, d * 0.08);
    if (!has(it, 'student', 'conference')) { RR(c, -w * 0.44, -d * 0.18, w * 0.09, d * 0.4, w * 0.04); RR(c, w * 0.35, -d * 0.18, w * 0.09, d * 0.4, w * 0.04); }
    soft(c, () => RR(c, -w * 0.24, -d * 0.12, w * 0.48, d * 0.42, m * 0.1));
  },
  stool(c, w, d, it) {
    const m = Math.min(w, d), r = m / 2;
    if (has(it, 'sauna')) {
      RR(c, -w / 2, -d / 2, w, d, m * 0.08);
      soft(c, () => { for (let i = 1; i < 4; i++) L(c, -w / 2 + 1, -d / 2 + (d * i) / 4, w / 2 - 1, -d / 2 + (d * i) / 4); });
      return;
    }
    const caster = has(it, 'stylist', 'tattoo', 'dentist', 'adjustable');
    if (caster) soft(c, () => star(c, r * 0.9, 5, r * 0.09));
    else soft(c, () => CS(c, 0, 0, r * 0.95));
    C(c, 0, 0, r * (caster ? 0.62 : 0.76));
    soft(c, () => CS(c, 0, 0, r * 0.45));
    if (has(it, 'swivel', 'counter_stool', 'dentist') && !has(it, 'backless')) eband(c, 0, 0, r, r, r * 0.2, PI * 1.12, PI * 1.88);
  },
  pouf(c, w, d, it) {
    const m = Math.min(w, d), r = m * 0.22;
    if (has(it, 'round')) E(c, 0, 0, w / 2, d / 2);
    else if (has(it, 'triangular')) P(c, -w / 2, d / 2, w / 2, d / 2, 0, -d / 2);
    else if (has(it, 'corner_pouf')) { c.beginPath(); c.moveTo(-w / 2, -d / 2); c.ellipse(-w / 2, -d / 2, w, d, 0, 0, PI / 2); c.closePath(); c.fill(); c.stroke(); }
    else if (has(it, 'shark')) { E(c, 0, 0, w / 2, d * 0.38); tone(c, 0.4, () => P(c, -w * 0.1, -d * 0.05, w * 0.15, -d * 0.05, 0, -d / 2)); return; }
    else RR(c, -w / 2, -d / 2, w, d, has(it, 'cube', 'large', 'coffee') ? r * 0.35 : r);
    if (has(it, 'with_arms', 'roman')) { RR(c, -w / 2, -d / 2, w * 0.14, d, r * 0.5); RR(c, w / 2 - w * 0.14, -d / 2, w * 0.14, d, r * 0.5); }
    if (has(it, 'triangular', 'corner_pouf')) return;
    soft(c, () => { L(c, -w * 0.22, 0, 0, -d * 0.22, w * 0.22, 0, 0, d * 0.22, -w * 0.22, 0); });
    tone(c, 0.7, () => { for (const [x, y] of [[-0.22, 0], [0.22, 0], [0, -0.22], [0, 0.22]]) C(c, x * w, y * d, m * 0.025); });
  },
  benchPadded(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      RR(c, -W / 2, -H / 2, W, H, m * 0.18);
      soft(c, () => RR(c, -W / 2 + m * 0.08, -H / 2 + m * 0.08, W - m * 0.16, H - m * 0.16, m * 0.14));
      const n = cl(Math.round(W / 30), 1, 10);
      tone(c, 0.7, () => { for (let i = 0; i < n; i++) C(c, -W / 2 + ((i + 0.5) * W) / n, 0, m * 0.035); });
    });
  },
  bench(c, w, d, it) {
    if (has(it, 'half_round')) {
      const s = cl(Math.min(w / 2, d) * 0.45, 3, 45);
      eband(c, 0, d / 2, w / 2, d, s, PI, TAU);
      soft(c, () => { for (let i = 1; i < 6; i++) { const t = PI + (i * PI) / 6; L(c, Math.cos(t) * w / 2, d / 2 + Math.sin(t) * d, Math.cos(t) * (w / 2 - s), d / 2 + Math.sin(t) * (d - s)); } });
      return;
    }
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      RR(c, -W / 2, -H / 2, W, H, has(it, 'rounded_end') ? H / 2 : cl(m * 0.06, 0.4, 2));
      if (has(it, 'storage', 'drawers')) {
        L(c, -W / 2, H / 2 - H * 0.12, W / 2, H / 2 - H * 0.12);
        const n = cl(Math.round(W / 45), 1, 6);
        for (let i = 0; i < n; i++) handle(c, -W / 2 + ((i + 0.5) * W) / n, H / 2 - H * 0.06, cl(W / n * 0.3, 2, 12), cl(H * 0.04, 0.5, 1.6));
        for (let i = 1; i < n; i++) L(c, -W / 2 + (i * W) / n, H / 2 - H * 0.12, -W / 2 + (i * W) / n, H / 2);
        return;
      }
      const n = cl(Math.round(H / 9), 2, 9);
      soft(c, () => { for (let i = 1; i < n; i++) L(c, -W / 2 + 1, -H / 2 + (i * H) / n, W / 2 - 1, -H / 2 + (i * H) / n); }, 0.6);
      if (has(it, 'arms')) { tone(c, 0.35, () => { R(c, -W / 2, -H / 2, W * 0.06, H); R(c, W / 2 - W * 0.06, -H / 2, W * 0.06, H); }); }
      if (has(it, 'built_in_table')) { const tw = Math.min(H * 1.1, W * 0.3); R(c, W / 2 - tw, -H / 2, tw, H); soft(c, () => C(c, W / 2 - tw / 2, 0, H * 0.2)); }
    });
  },
  seatRow(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const n = cl(Math.round(W / 55), 1, 8), s = W / n;
      soft(c, () => L(c, -W / 2, 0, W / 2, 0));
      for (let i = 0; i < n; i++) chairG(c, -W / 2 + (i + 0.5) * s, 0, s * 0.88, H);
    });
  },
  hammock(c, w, d) {
    alongX(c, w, d, (W, H) => {
      L(c, -W / 2, 0, -W * 0.36, -H * 0.3); L(c, -W / 2, 0, -W * 0.36, H * 0.3);
      L(c, W / 2, 0, W * 0.36, -H * 0.3); L(c, W / 2, 0, W * 0.36, H * 0.3);
      E(c, 0, 0, W * 0.38, H * 0.42);
      soft(c, () => { for (let i = -2; i <= 2; i++) L(c, -W * 0.3, (i * H) / 7, W * 0.3, (i * H) / 7); });
    });
  },

  // ===== Gultas =====
  bedF(c, w, d, it) { bedCore(c, w, d, it, true); },
  bunk(c, w, d, it) {
    bedCore(c, w, d, it, true);
    soft(c, () => dash(c, du(w, d) * 1.4, () => { L(c, -w / 2, -d / 2, w / 2, d / 2); L(c, w / 2, -d / 2, -w / 2, d / 2); }), 0.7);
    const lw = cl(w * 0.12, 2, 12), y0 = d * 0.02, len = d * 0.4;
    R(c, w / 2 - lw, y0, lw, len);
    const n = cl(Math.round(len / 25), 2, 8);
    for (let i = 1; i < n; i++) L(c, w / 2 - lw, y0 + (i * len) / n, w / 2, y0 + (i * len) / n);
  },
  roundBed(c, w, d, it) {
    E(c, 0, 0, w / 2, d / 2);
    const m = Math.min(w, d);
    eband(c, 0, 0, w / 2, d / 2, m * 0.1, PI * 1.02, PI * 1.98);
    soft(c, () => ES(c, 0, 0, w * 0.4, d * 0.4));
    RR(c, -w * 0.28, -d * 0.34, w * 0.25, d * 0.12, m * 0.05);
    RR(c, w * 0.03, -d * 0.34, w * 0.25, d * 0.12, m * 0.05);
    if (has(it, 'curtain')) dash(c, du(w, d), () => ES(c, 0, 0, w * 0.48, d * 0.48, 0.1, PI - 0.1));
  },
  crib(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'bassinet', 'cradle')) {
      E(c, 0, 0, w / 2, d / 2);
      tone(c, 0.3, () => eband(c, 0, 0, w / 2, d / 2, m * 0.3, PI, TAU));
      soft(c, () => ES(c, 0, d * 0.05, w * 0.36, d * 0.38));
      if (has(it, 'stroller')) { for (const sx of [-1, 1]) for (const sy of [-1, 1]) wheel(c, sx * w * 0.44, sy * d * 0.35, m * 0.1, m * 0.22); }
      return;
    }
    const t = cl(m * 0.07, 1, 5);
    R(c, -w / 2, -d / 2, w, d);
    R(c, -w / 2 + t, -d / 2 + t, w - 2 * t, d - 2 * t);
    soft(c, () => {
      for (let x = -w / 2 + 5; x < w / 2 - 2; x += 6) { L(c, x, -d / 2, x, -d / 2 + t); L(c, x, d / 2 - t, x, d / 2); }
      for (let y = -d / 2 + 5; y < d / 2 - 2; y += 6) { L(c, -w / 2, y, -w / 2 + t, y); L(c, w / 2 - t, y, w / 2, y); }
    });
    RR(c, -w * 0.25, -d / 2 + t * 1.6, w * 0.5, d * 0.14, m * 0.05);
    soft(c, () => R(c, -w / 2 + t * 1.5, d * 0.02, w - t * 3, d / 2 - t * 2.2), 0.7);
  },
  hospitalBed(c, w, d, it) {
    alongY(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      RR(c, -W / 2, -H / 2, W, H, m * 0.04);
      tone(c, 0.35, () => { R(c, -W / 2, -H / 2, W, H * 0.04); if (!has(it, 'stretcher')) R(c, -W / 2, H / 2 - H * 0.04, W, H * 0.04); });
      soft(c, () => RR(c, -W / 2 + W * 0.08, -H / 2 + H * 0.05, W * 0.84, H * 0.9, m * 0.04));
      L(c, -W / 2 + W * 0.08, -H / 2 + H * 0.34, W / 2 - W * 0.08, -H / 2 + H * 0.34);
      RR(c, -W * 0.3, -H / 2 + H * 0.07, W * 0.6, H * 0.12, m * 0.05);
      const rw = cl(W * 0.05, 0.6, 3);
      for (const sx of [-1, 1]) { RR(c, sx * (W / 2 - rw / 2) - rw / 2, -H / 2 + H * 0.12, rw, H * 0.3, rw / 2); RR(c, sx * (W / 2 - rw / 2) - rw / 2, -H / 2 + H * 0.5, rw, H * 0.3, rw / 2); }
      tone(c, 0.6, () => casters(c, W * 0.86, H, m * 0.04));
    });
  },
  tanningBed(c, w, d, it) {
    if (has(it, 'vertical')) {
      const m = Math.min(w, d);
      RR(c, -w / 2, -d / 2, w, d, m * 0.1);
      C(c, 0, 0, m * 0.42);
      soft(c, () => { for (let i = 0; i < 16; i++) { const a = (i * TAU) / 16; L(c, Math.cos(a) * m * 0.34, Math.sin(a) * m * 0.34, Math.cos(a) * m * 0.42, Math.sin(a) * m * 0.42); } });
      tone(c, 0.25, () => P(c, -m * 0.2, d / 2, m * 0.2, d / 2, m * 0.12, m * 0.38, -m * 0.12, m * 0.38));
      return;
    }
    alongX(c, w, d, (W, H) => {
      RR(c, -W / 2, -H / 2, W, H, H * 0.42);
      RR(c, -W / 2 + H * 0.08, -H / 2 + H * 0.08, W - H * 0.16, H * 0.84, H * 0.36);
      soft(c, () => { for (let i = -3; i <= 3; i++) L(c, -W * 0.36, (i * H) / 9, W * 0.4, (i * H) / 9); });
      RR(c, -W / 2 + H * 0.14, -H * 0.2, W * 0.06, H * 0.4, H * 0.05);
    });
  },
  petBed(c, w, d) {
    E(c, 0, 0, w / 2, d / 2);
    tone(c, 0.15, () => E(c, 0, d * 0.05, w * 0.36, d * 0.34));
    soft(c, () => { for (const [x, y] of [[-0.08, 0.02], [0.08, 0.02], [-0.14, -0.1], [0, -0.14], [0.14, -0.1]]) C(c, x * w, y * d, Math.min(w, d) * 0.035); });
  },
  examTable(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      if (has(it, 'operating')) {
        tone(c, 0.2, () => { R(c, -W * 0.12, -H / 2, W * 0.08, H); });
        RR(c, -W / 2, -H * 0.3, W, H * 0.6, m * 0.08);
        for (const f of [-0.28, 0.1]) L(c, W * f, -H * 0.3, W * f, H * 0.3);
        RR(c, -W / 2 + W * 0.02, -H * 0.2, W * 0.1, H * 0.4, m * 0.08);
        return;
      }
      if (has(it, 'veterinary')) {
        R(c, -W / 2, -H / 2, W, H);
        soft(c, () => { for (let i = 1; i < 6; i++) L(c, -W / 2 + (i * W) / 6, -H * 0.4, -W / 2 + (i * W) / 6, H * 0.4); });
        C(c, 0, 0, m * 0.05);
        if (has(it, 'grooming')) { C(c, -W / 2 + m * 0.12, -H / 2 + m * 0.12, m * 0.07); L(c, -W / 2 + m * 0.12, -H / 2 + m * 0.12, -W / 2 + m * 0.4, -H / 2 + m * 0.3); }
        return;
      }
      RR(c, -W / 2, -H / 2, W, H, m * 0.06);
      L(c, -W / 2 + W * 0.3, -H / 2, -W / 2 + W * 0.3, H / 2);
      tone(c, 0.25, () => R(c, -W / 2, -H * 0.45, W * 0.04, H * 0.9));
      soft(c, () => RR(c, -W / 2 + W * 0.06, -H * 0.28, W * 0.12, H * 0.56, m * 0.1));
    });
  },
  massageTable(c, w, d) {
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      RR(c, -W / 2 + W * 0.12, -H / 2, W * 0.88, H, m * 0.22);
      E(c, -W / 2 + W * 0.07, 0, W * 0.07, H * 0.32);
      tone(c, 0.45, () => E(c, -W / 2 + W * 0.07, 0, W * 0.03, H * 0.14));
      soft(c, () => RR(c, -W / 2 + W * 0.16, -H / 2 + m * 0.08, W * 0.8, H - m * 0.16, m * 0.16));
    });
  },
  dentalChair(c, w, d, it) {
    const m = Math.min(w, d), dental = has(it, 'dental');
    const bw = w * (dental ? 0.46 : 0.62), x0 = dental ? -w * 0.08 : 0;
    soft(c, () => RR(c, x0 - bw * 0.45, -d * 0.2, bw * 0.9, d * 0.5, m * 0.05));
    RR(c, x0 - bw * 0.22, -d / 2, bw * 0.44, d * 0.1, m * 0.04);
    RR(c, x0 - bw / 2, -d / 2 + d * 0.1, bw, d * 0.36, m * 0.08);
    RR(c, x0 - bw / 2, -d / 2 + d * 0.46, bw, d * 0.22, m * 0.06);
    P(c, x0 - bw * 0.42, -d / 2 + d * 0.68, x0 + bw * 0.42, -d / 2 + d * 0.68, x0 + bw * 0.3, d / 2, x0 - bw * 0.3, d / 2);
    if (has(it, 'gynecology')) { for (const sx of [-1, 1]) E(c, sx * w * 0.36, d * 0.36, w * 0.1, d * 0.12); }
    if (dental) {
      C(c, -w / 2 + w * 0.08, -d * 0.12, m * 0.07);
      L(c, w * 0.18, -d * 0.18, w * 0.36, d * 0.05);
      RR(c, w * 0.24, d * 0.05, w * 0.24, d * 0.18, m * 0.03);
      tone(c, 0.4, () => C(c, w * 0.18, -d * 0.18, m * 0.04));
    } else {
      RR(c, -w / 2, -d / 2 + d * 0.16, w * 0.15, d * 0.3, m * 0.05);
      RR(c, w / 2 - w * 0.15, -d / 2 + d * 0.16, w * 0.15, d * 0.3, m * 0.05);
    }
  },
  salonChair(c, w, d, it) {
    const m = Math.min(w, d), ped = has(it, 'pedicure', 'spa_chair');
    const H = ped ? d * 0.64 : d;
    if (ped) {
      RR(c, -w * 0.36, -d / 2 + H + d * 0.04, w * 0.72, d - H - d * 0.04, m * 0.06);
      soft(c, () => E(c, 0, -d / 2 + H + d * 0.04 + (d - H - d * 0.04) / 2, w * 0.24, (d - H) * 0.3));
    } else soft(c, () => C(c, 0, 0, m * 0.46));
    c.save(); c.translate(0, -(d - H) / 2);
    D.armchair(c, w * (ped ? 1 : 0.84), H * (ped ? 1 : 0.84), null);
    tone(c, 0.35, () => RR(c, -w * 0.15, -H / 2 * 0.84, w * 0.3, H * 0.08, m * 0.04));
    c.restore();
  },
  dryerStand(c, w, d, it) {
    const m = Math.min(w, d);
    soft(c, () => star(c, m * 0.42, 5, m * 0.04));
    if (has(it, 'climazon')) {
      eband(c, 0, 0, m * 0.46, m * 0.46, m * 0.12, PI * 0.9, PI * 2.1);
      soft(c, () => { for (let i = 0; i < 5; i++) { const a = PI * 0.95 + (i * PI * 1.1) / 4; C(c, Math.cos(a) * m * 0.4, Math.sin(a) * m * 0.4, m * 0.04); } });
      tone(c, 0.6, () => C(c, 0, 0, m * 0.06));
      return;
    }
    E(c, 0, -d * 0.08, m * 0.38, m * 0.34);
    soft(c, () => ES(c, 0, -d * 0.08, m * 0.26, m * 0.22));
    L(c, 0, m * 0.26, 0, d * 0.42);
  },
  shampooUnit(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w * 0.42, -d / 2, w * 0.84, d * 0.36, m * 0.08);
    E(c, 0, -d / 2 + d * 0.2, w * 0.28, d * 0.12);
    tone(c, 0.6, () => C(c, 0, -d / 2 + d * 0.05, m * 0.025));
    c.save(); c.translate(0, d * 0.18);
    D.armchair(c, w * 0.9, d * 0.62, null);
    c.restore();
  },

  // ===== Galdi =====
  diningTable(c, w, d, it) {
    const m = Math.min(w, d), r = cl(m * 0.11, 2.5, 11);
    if (has(it, 'triangular')) {
      P(c, -w / 2, d / 2, w / 2, d / 2, 0, -d / 2);
      if (m > 50) { plate(c, 0, d / 2 - r * 1.6, r); plate(c, -w * 0.2, 0, r); plate(c, w * 0.2, 0, r); }
      return;
    }
    if (has(it, 'live_edge', 'slab')) {
      c.beginPath(); c.moveTo(-w / 2, -d / 2 + d * 0.06);
      c.bezierCurveTo(-w / 4, -d / 2 - d * 0.02, w / 6, -d / 2 + d * 0.1, w / 2, -d / 2 + d * 0.03);
      c.lineTo(w / 2, d / 2 - d * 0.08);
      c.bezierCurveTo(w / 5, d / 2 + d * 0.01, -w / 5, d / 2 - d * 0.1, -w / 2, d / 2 - d * 0.02);
      c.closePath(); c.fill(); c.stroke();
      soft(c, () => { L(c, -w * 0.4, -d * 0.1, w * 0.3, -d * 0.05); L(c, -w * 0.3, d * 0.12, w * 0.42, d * 0.08); });
      return;
    }
    if (has(it, 'semi_circular')) {
      c.beginPath(); c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.ellipse(0, -d / 2, w / 2, d, 0, 0, PI); c.closePath(); c.fill(); c.stroke();
      if (m > 50) for (let i = 1; i < 6; i++) { const t = (i * PI) / 6; plate(c, Math.cos(t) * (w / 2 - r * 1.8), -d / 2 + Math.sin(t) * (d - r * 1.8), r); }
      return;
    }
    RR(c, -w / 2, -d / 2, w, d, has(it, 'rounded') ? m * 0.2 : cl(m * 0.02, 0, 2));
    if (has(it, 'gateleg')) dash(c, du(w, d), () => { L(c, -w * 0.27, -d / 2, -w * 0.27, d / 2); L(c, w * 0.27, -d / 2, w * 0.27, d / 2); });
    if (m < 45) return;
    alongX(c, w, d, (W, H) => {
      const n = Math.max(1, Math.floor(W / 62)), s = W / n;
      for (let i = 0; i < n; i++) for (const sy of [-1, 1]) plate(c, -W / 2 + (i + 0.5) * s, sy * (H / 2 - r * 1.6), r);
      if (H >= 75 && W >= 150) for (const sx of [-1, 1]) plate(c, sx * (W / 2 - r * 1.6), 0, r);
    });
  },
  roundDining(c, w, d, it) {
    const m = Math.min(w, d), r = cl(m * 0.1, 2.5, 11);
    if (has(it, 'half_round')) {
      c.beginPath(); c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.ellipse(0, -d / 2, w / 2, d, 0, 0, PI); c.closePath(); c.fill(); c.stroke();
      if (m > 50) for (let i = 1; i < 4; i++) { const t = (i * PI) / 4; plate(c, Math.cos(t) * (w / 2 - r * 1.7), -d / 2 + Math.sin(t) * (d - r * 1.7), r); }
      return;
    }
    E(c, 0, 0, w / 2, d / 2);
    soft(c, () => ES(c, 0, 0, w / 2 - m * 0.04, d / 2 - m * 0.04));
    if (m < 45) return;
    const n = cl(Math.round((PI * (w + d)) / 2 / 62), 2, 12);
    for (let i = 0; i < n; i++) { const a = -PI / 2 + (i * TAU) / n; plate(c, Math.cos(a) * (w / 2 - r * 1.7), Math.sin(a) * (d / 2 - r * 1.7), r); }
  },
  roundTable(c, w, d) {
    const m = Math.min(w, d);
    E(c, 0, 0, w / 2, d / 2);
    soft(c, () => { ES(c, 0, 0, w / 2 - m * 0.06, d / 2 - m * 0.06); dash(c, du(w, d), () => CS(c, 0, 0, m * 0.18)); });
  },
  coffeeTable(c, w, d, it) {
    const m = Math.min(w, d);
    let shape;
    if (has(it, 'hexagonal')) shape = () => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * w / 2, Math.sin(a) * d / 2); } c.closePath(); };
    else if (has(it, 'round', 'oval')) shape = () => { c.beginPath(); c.ellipse(0, 0, w / 2, d / 2, 0, 0, TAU); };
    else if (has(it, 'double')) {
      E(c, -w * 0.17, -d * 0.04, Math.min(w * 0.33, d * 0.46), Math.min(w * 0.33, d * 0.46));
      E(c, w * 0.26, d * 0.16, Math.min(w * 0.24, d * 0.34), Math.min(w * 0.24, d * 0.34));
      soft(c, () => { CS(c, -w * 0.17, -d * 0.04, Math.min(w * 0.33, d * 0.46) * 0.8); });
      return;
    } else if (has(it, 'slab', 'bear')) shape = () => { c.beginPath(); c.roundRect ? c.roundRect(-w / 2, -d / 2, w, d, m * 0.4) : c.rect(-w / 2, -d / 2, w, d); };
    else shape = () => { c.beginPath(); c.rect(-w / 2, -d / 2, w, d); };
    shape(); c.fill(); c.stroke();
    soft(c, () => { c.save(); c.scale(0.8, 0.72); shape(); c.restore(); c.stroke(); });
    soft(c, () => { L(c, -w * 0.28, d * 0.12, -w * 0.16, -d * 0.12); L(c, -w * 0.2, d * 0.14, -w * 0.1, -d * 0.04); });
    tone(c, 0.18, () => RR(c, w * 0.05, -d * 0.16, w * 0.2, d * 0.3, m * 0.03));
    if (has(it, 'convertible')) dash(c, du(w, d), () => L(c, -w / 2, 0, w / 2, 0));
  },
  plankTable(c, w, d) {
    alongX(c, w, d, (W, H) => {
      R(c, -W / 2, -H / 2, W, H);
      const n = cl(Math.round(H / 12), 2, 8);
      soft(c, () => { for (let i = 1; i < n; i++) L(c, -W / 2, -H / 2 + (i * H) / n, W / 2, -H / 2 + (i * H) / n); });
    });
  },
  nightstand(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'round')) { E(c, 0, 0, w / 2, d / 2); }
    else {
      body(c, w, d, it, m * 0.06);
      L(c, -w / 2, d / 2 - d * 0.1, w / 2, d / 2 - d * 0.1);
      handle(c, 0, d / 2 - d * 0.05, w * 0.3, cl(d * 0.04, 0.4, 1.4));
    }
    C(c, 0, -d * 0.06, m * 0.24);
    soft(c, () => { const q = m * 0.17; L(c, -q, -d * 0.06 - q, q, -d * 0.06 + q); L(c, q, -d * 0.06 - q, -q, -d * 0.06 + q); });
  },
  consoleTable(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'semicircular')) { c.beginPath(); c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.ellipse(0, -d / 2, w / 2, d, 0, 0, PI); c.closePath(); c.fill(); c.stroke(); }
    else if (has(it, 'corner')) { c.beginPath(); c.moveTo(-w / 2, -d / 2); c.ellipse(-w / 2, -d / 2, w, d, 0, 0, PI / 2); c.closePath(); c.fill(); c.stroke(); C(c, -w * 0.2, -d * 0.2, m * 0.14); return; }
    else body(c, w, d, it, cl(m * 0.08, 0, 3));
    soft(c, () => L(c, -w / 2 + m * 0.12, -d / 2 + d * 0.12, w / 2 - m * 0.12, -d / 2 + d * 0.12));
    C(c, -w * 0.3, -d * 0.08, Math.min(d * 0.28, w * 0.09));
    tone(c, 0.2, () => RR(c, w * 0.1, -d * 0.3, Math.min(w * 0.22, 30), d * 0.5, 1));
  },
  desk(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'trapezoid')) P(c, -w / 2, d / 2, w / 2, d / 2, w * 0.3, -d / 2, -w * 0.3, -d / 2);
    else body(c, w, d, it, cl(m * 0.03, 0, 3));
    let yb = -d / 2;
    if (has(it, 'secretary', 'bureau')) {
      R(c, -w / 2, -d / 2, w, d * 0.32);
      soft(c, () => { const n = cl(Math.round(w / 15), 2, 10); for (let i = 1; i < n; i++) L(c, -w / 2 + (i * w) / n, -d / 2, -w / 2 + (i * w) / n, -d / 2 + d * 0.32); });
      yb = -d / 2 + d * 0.32;
    }
    if (has(it, 'drawers')) dash(c, du(w, d), () => R(c, w / 2 - w * 0.3, -d / 2 + d * 0.06, w * 0.27, d * 0.88));
    if (has(it, 'standing')) dash(c, du(w, d), () => { L(c, -w * 0.4, -d * 0.4, -w * 0.4, d * 0.4); L(c, w * 0.4, -d * 0.4, w * 0.4, d * 0.4); });
    if (has(it, 'school', 'kid')) {
      soft(c, () => L(c, -w * 0.4, -d / 2 + d * 0.12, w * 0.4, -d / 2 + d * 0.12));
      tone(c, 0.18, () => RR(c, -w * 0.18, -d * 0.1, w * 0.22, d * 0.36, 1));
      soft(c, () => RR(c, w * 0.08, -d * 0.04, w * 0.06, d * 0.3, 0.5));
      return;
    }
    const mw = cl(w * 0.4, 6, 80), mh = cl(d * 0.07, 1, 4.5), my = yb + d * 0.12;
    if (has(it, 'gaming')) tone(c, 0.55, () => eband(c, 0, my + mw * 0.35, mw * 0.62, mw * 0.35, mh, PI * 1.2, PI * 1.8));
    else tone(c, 0.55, () => RR(c, -mw / 2, my, mw, mh, mh / 2));
    soft(c, () => RR(c, -mw * 0.12, my - d * 0.05, mw * 0.24, d * 0.05, 1));
    const kw = cl(w * 0.32, 4, 46), kh = cl(d * 0.14, 1.5, 16);
    RR(c, -kw / 2, d * 0.1, kw, kh, kh * 0.15);
    soft(c, () => grid(c, -kw / 2, d * 0.1, kw, kh, 8, 3));
    E(c, kw / 2 + cl(w * 0.07, 2, 10), d * 0.1 + kh / 2, cl(m * 0.04, 0.8, 3), cl(m * 0.06, 1.2, 5));
  },
  computerSet(c, w, d) {
    const m = Math.min(w, d), mw = w * 0.5;
    tone(c, 0.55, () => RR(c, -mw / 2, -d / 2 + d * 0.1, mw, d * 0.08, d * 0.04));
    soft(c, () => RR(c, -w * 0.08, -d / 2, w * 0.16, d * 0.12, 1));
    RR(c, -w * 0.22, d * 0.06, w * 0.44, d * 0.2, 1);
    soft(c, () => grid(c, -w * 0.22, d * 0.06, w * 0.44, d * 0.2, 10, 3));
    E(c, w * 0.3, d * 0.16, m * 0.04, m * 0.07);
    R(c, w / 2 - w * 0.14, -d / 2 + d * 0.05, w * 0.12, d * 0.6);
    soft(c, () => C(c, w / 2 - w * 0.08, -d / 2 + d * 0.15, m * 0.03));
  },
  deskL(c, w, d, it) {
    const a = Math.min(w, d) * 0.45;
    P(c, -w / 2, -d / 2, w / 2, -d / 2, w / 2, -d / 2 + a, -w / 2 + a, -d / 2 + a, -w / 2 + a, d / 2, -w / 2, d / 2);
    if (has(it, 'shelves')) soft(c, () => { R(c, -w / 2, -d / 2, w, a * 0.25); }, 0.7);
    if (has(it, 'reception', 'semi_circular')) { tone(c, 0.22, () => { R(c, -w / 2 + a * 0.72, -d / 2 + a * 0.72, w - a * 0.72, a * 0.28); R(c, -w / 2 + a * 0.72, -d / 2 + a, a * 0.28, d - a); }); }
    c.save(); c.translate(-w / 2 + a * 0.62, -d / 2 + a * 0.62); c.rotate(-PI / 4);
    tone(c, 0.55, () => RR(c, -a * 0.32, -a * 0.3, a * 0.64, a * 0.07, a * 0.03));
    RR(c, -a * 0.24, a * 0.0, a * 0.48, a * 0.16, 1);
    c.restore();
  },
  deskCurved(c, w, d, it) {
    let cx, cy, rx, ry, a0, a1, s;
    if (has(it, 'corner')) { cx = -w / 2; cy = -d / 2; rx = w; ry = d; a0 = 0; a1 = PI / 2; s = Math.min(w, d) * 0.5; }
    else { cx = 0; cy = -d / 2; rx = w / 2; ry = d; a0 = 0; a1 = PI; s = cl(Math.min(rx, ry) * 0.55, 3, 80); }
    eband(c, cx, cy, rx, ry, s, a0, a1);
    if (has(it, 'reception', 'bar')) tone(c, 0.22, () => eband(c, cx, cy, rx, ry, s * 0.32, a0, a1));
    if (has(it, 'bar')) dash(c, du(w, d), () => ES(c, cx, cy, rx - s * 0.12, ry - s * 0.12, a0, a1));
    if (has(it, 'executive')) { const t = (a0 + a1) / 2; c.save(); c.translate(cx + Math.cos(t) * (rx - s * 0.55), cy + Math.sin(t) * (ry - s * 0.55)); c.rotate(t - PI / 2); tone(c, 0.55, () => RR(c, -s * 0.5, -s * 0.05, s, s * 0.1, s * 0.05)); c.restore(); }
  },
  reception(c, w, d, it) {
    const m = Math.min(w, d);
    R(c, -w / 2, -d / 2, w, d);
    tone(c, 0.22, () => R(c, -w / 2, d / 2 - d * 0.28, w, d * 0.28));
    const mw = cl(w * 0.3, 6, 55);
    tone(c, 0.55, () => RR(c, -mw / 2, -d * 0.06, mw, cl(d * 0.06, 1, 4), 1));
    soft(c, () => RR(c, -w * 0.12, -d * 0.4, w * 0.24, d * 0.18, m * 0.04));
  },
  island(c, w, d, it) {
    const m = Math.min(w, d), ov = d * 0.3;
    const n = has(it, '3_seats') ? 3 : has(it, '2_seats') ? 2 : 0;
    if (has(it, 'corner', 'l_shaped')) {
      const a = m * 0.55;
      P(c, -w / 2, -d / 2, w / 2, -d / 2, w / 2, -d / 2 + a, -w / 2 + a, -d / 2 + a, -w / 2 + a, d / 2, -w / 2, d / 2);
      dash(c, du(w, d), () => L(c, w / 2, -d / 2 + a * 0.6, -w / 2 + a * 0.6, -d / 2 + a * 0.6, -w / 2 + a * 0.6, d / 2));
      return;
    }
    R(c, -w / 2, -d / 2, w, d);
    const yf = d / 2 - (n ? ov : 0);
    if (n) dash(c, du(w, d), () => L(c, -w / 2 + 2, yf, w / 2 - 2, yf));
    soft(c, () => {
      const k = cl(Math.round(w / 60), 1, 6);
      for (let i = 1; i < k; i++) L(c, -w / 2 + (i * w) / k, -d / 2, -w / 2 + (i * w) / k, yf);
      if (has(it, 'open')) for (let j = 1; j < 3; j++) L(c, -w / 2, -d / 2 + ((yf + d / 2) * j) / 3, w / 2, -d / 2 + ((yf + d / 2) * j) / 3);
    });
    if (n) { const rr = Math.min(ov * 0.36, w / (n * 2.6)); soft(c, () => { for (let i = 0; i < n; i++) C(c, -w / 2 + ((i + 0.5) * w) / n, d / 2 - ov / 2, rr); }, 0.6); }
  },
  barCounter(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'divider')) {
      alongX(c, w, d, (W, H) => { R(c, -W / 2, -H / 2, W, H); soft(c, () => { for (let x = -W / 2 + 6; x < W / 2 - 3; x += 9) C(c, x, 0, Math.min(H * 0.3, 3)); }); });
      return;
    }
    if (has(it, 'corner')) {
      const a = m * 0.6;
      if (has(it, 'rounded')) { eband(c, w / 2, d / 2, w, d, a, PI, PI * 1.5); tone(c, 0.2, () => eband(c, w / 2, d / 2, w - a * 0.62, d - a * 0.62, a * 0.38, PI, PI * 1.5)); return; }
      else { c.beginPath(); c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.lineTo(w / 2, -d / 2 + a); c.lineTo(-w / 2 + a, -d / 2 + a); c.lineTo(-w / 2 + a, d / 2); c.lineTo(-w / 2, d / 2); c.closePath(); }
      c.fill(); c.stroke();
      tone(c, 0.2, () => { { R(c, -w / 2 + a * 0.62, -d / 2 + a * 0.62, w - a * 0.62, a * 0.38); R(c, -w / 2 + a * 0.62, -d / 2 + a, a * 0.38, d - a); } });
      return;
    }
    R(c, -w / 2, -d / 2, w, d);
    tone(c, 0.2, () => R(c, -w / 2, d / 2 - d * 0.32, w, d * 0.32));
    dash(c, du(w, d), () => L(c, -w / 2 + 2, d / 2 - d * 0.06, w / 2 - 2, d / 2 - d * 0.06));
    if (has(it, 'warefall', 'waterfall')) tone(c, 0.45, () => { R(c, -w / 2, -d / 2, m * 0.06, d); R(c, w / 2 - m * 0.06, -d / 2, m * 0.06, d); });
    soft(c, () => { RR(c, -w * 0.3, -d * 0.36, w * 0.2, d * 0.28, 2); for (let i = 0; i < 4; i++) C(c, w * 0.08 + i * cl(w * 0.07, 2, 8), -d * 0.22, cl(m * 0.05, 0.8, 3.5)); });
  },
  pingPong(c, w, d) {
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      R(c, -W / 2, -H / 2, W, H);
      soft(c, () => { R(c, -W / 2 + m * 0.03, -H / 2 + m * 0.03, W - m * 0.06, H - m * 0.06); L(c, -W / 2, 0, W / 2, 0); });
      tone(c, 0.6, () => R(c, -m * 0.012, -H / 2 - 0.5, m * 0.024, H + 1));
    });
  },
  poolTable(c, w, d) {
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H), rail = cl(m * 0.07, 1, 12);
      RR(c, -W / 2, -H / 2, W, H, rail * 0.6);
      R(c, -W / 2 + rail, -H / 2 + rail, W - 2 * rail, H - 2 * rail);
      tone(c, 0.7, () => { for (const [x, y] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) C(c, x * (W / 2 - rail), y * (H / 2 - rail), rail * 0.55); });
      soft(c, () => { L(c, -W / 4, -H / 2 + rail, -W / 4, H / 2 - rail); C(c, W / 4, 0, m * 0.015); });
    });
  },
  foosball(c, w, d) {
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      RR(c, -W / 2 + W * 0.04, -H / 2 + H * 0.12, W * 0.92, H * 0.76, m * 0.04);
      soft(c, () => { L(c, 0, -H / 2 + H * 0.12, 0, H / 2 - H * 0.12); CS(c, 0, 0, H * 0.12); });
      for (let i = 0; i < 8; i++) {
        const x = -W / 2 + W * 0.1 + (i * W * 0.8) / 7;
        L(c, x, -H / 2, x, H / 2);
        tone(c, 0.7, () => { RR(c, x - W * 0.012, H / 2 - H * 0.08, W * 0.024, H * 0.08, 0.5); for (const f of [-0.2, 0, 0.2]) R(c, x - W * 0.008, f * H - H * 0.02, W * 0.016, H * 0.04); });
      }
    });
  },
  airHockey(c, w, d) {
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      RR(c, -W / 2, -H / 2, W, H, m * 0.12);
      soft(c, () => { RR(c, -W / 2 + m * 0.05, -H / 2 + m * 0.05, W - m * 0.1, H - m * 0.1, m * 0.1); L(c, 0, -H / 2, 0, H / 2); CS(c, 0, 0, H * 0.16); });
      tone(c, 0.5, () => { R(c, -W / 2, -H * 0.15, m * 0.04, H * 0.3); R(c, W / 2 - m * 0.04, -H * 0.15, m * 0.04, H * 0.3); });
      C(c, -W * 0.3, 0, m * 0.08); C(c, W * 0.3, 0, m * 0.08);
    });
  },
  chessTable(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.04);
    const s = m * 0.76, q = s / 8;
    R(c, -s / 2, -s / 2, s, s);
    tone(c, 0.45, () => { c.beginPath(); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) if ((i + j) % 2) c.rect(-s / 2 + i * q, -s / 2 + j * q, q, q); c.fill(); });
  },

  // ===== Skapji un uzglabāšana =====
  wardrobe(c, w, d, it) {
    const m = Math.min(w, d), t = cl(d * 0.07, 0.8, 4), fy = d / 2 - t;
    body(c, w, d, it);
    const nm = K(it).match(/(\d)_door/);
    const n = has(it, 'single') ? 1 : has(it, 'double') ? 2 : nm ? +nm[1] : cl(Math.round(w / 50), 1, 8);
    if (has(it, 'open')) dash(c, du(w, d), () => L(c, -w / 2, fy, w / 2, fy));
    else if (has(it, 'sliding')) {
      const k = Math.max(2, n), s = w / k;
      for (let i = 0; i < k; i++) R(c, -w / 2 + i * s, i % 2 ? fy - t : fy, s, t);
    } else if (has(it, 'folding')) {
      c.beginPath(); c.moveTo(-w / 2, fy); const k = Math.max(4, n * 2); for (let i = 1; i <= k; i++) c.lineTo(-w / 2 + (i * w) / k, i % 2 ? fy + t : fy); c.stroke();
    } else {
      L(c, -w / 2, fy, w / 2, fy);
      for (let i = 1; i < n; i++) L(c, -w / 2 + (i * w) / n, fy, -w / 2 + (i * w) / n, d / 2);
      for (let i = 0; i < n; i++) { const x = -w / 2 + ((i + (i % 2 ? 0.15 : 0.85)) * w) / n; handle(c, n === 1 ? w * 0.35 : x, d / 2 + 0.01 - t / 2, cl(t * 0.5, 0.4, 1.4), t * 0.6); }
    }
    if (d < 25) return;
    const yr = -d / 2 + (fy + d / 2) * 0.48;
    if (has(it, 'shelves', 'shoe') && !has(it, 'hanging')) {
      soft(c, () => { const k = cl(Math.round(w / 28), 1, 10); for (let i = 0; i < k; i++) RR(c, -w / 2 + ((i + 0.12) * w) / k, -d * 0.28, (w / k) * 0.76, d * 0.4, 1); });
      return;
    }
    soft(c, () => {
      dash(c, du(w, d) * 1.2, () => L(c, -w / 2 + 2, yr, w / 2 - 2, yr));
      const hs = cl(m * 0.12, 3, 8), hl = cl((fy + d / 2) * 0.32, 2, 22);
      for (let x = -w / 2 + hs; x < w / 2 - hs * 0.5; x += hs) L(c, x - hl * 0.25, yr - hl / 2, x + hl * 0.25, yr + hl / 2);
    }, 0.6);
  },
  slidingDoors(c, w, d, it) {
    const nm = K(it).match(/(\d)_door/), n = nm ? +nm[1] : 2;
    alongX(c, w, d, (W, H) => {
      const s = W / n, t = Math.min(H / 2, 4);
      soft(c, () => L(c, -W / 2, -t, W / 2, -t, W / 2, t, -W / 2, t, -W / 2, -t), 0.4);
      for (let i = 0; i < n; i++) R(c, -W / 2 + i * s - (i ? s * 0.06 : 0), i % 2 ? -t : 0, s + (i ? s * 0.06 : 0), t);
    });
  },
  cabinet(c, w, d, it) {
    const m = Math.min(w, d), t = cl(d * 0.07, 0.8, 4), fy = d / 2 - t;
    body(c, w, d, it, cl(m * 0.03, 0, 2));
    L(c, -w / 2, fy, w / 2, fy);
    const drawers = has(it, 'drawer', 'dresser', 'credenza', 'file');
    const n = has(it, 'single') ? 1 : has(it, 'double', 'two_doors') ? 2 : cl(Math.round(w / 45), 1, 8);
    for (let i = 1; i < n; i++) L(c, -w / 2 + (i * w) / n, fy, -w / 2 + (i * w) / n, d / 2);
    for (let i = 0; i < n; i++) {
      const x = drawers ? -w / 2 + ((i + 0.5) * w) / n : -w / 2 + ((i + (i % 2 ? 0.12 : 0.88)) * w) / n;
      handle(c, n === 1 && !drawers ? w * 0.36 : x, d / 2 - t / 2, drawers ? cl((w / n) * 0.35, 1, 14) : cl(t * 0.6, 0.4, 1.4), t * 0.55);
    }
    if (has(it, 'glass', 'display', 'hutch', 'medical')) soft(c, () => dash(c, du(w, d), () => R(c, -w / 2 + m * 0.1, -d / 2 + m * 0.1, w - m * 0.2, fy + d / 2 - m * 0.2)));
    else if (has(it, 'mirror')) { soft(c, () => { for (let x = -w / 2 + 4; x < w / 2; x += 9) L(c, x, fy - t * 0.2, x + t, fy - t * 1.4); }); }
    else if (has(it, 'aquarium')) { const aw = w * 0.9; R(c, -aw / 2, -d * 0.4, aw, d * 0.7); soft(c, () => fish(c, 0, -d * 0.05, Math.min(aw, d) * 0.2)); }
  },
  cornerUnit(c, w, d, it) {
    const m = Math.min(w, d), a = cl(m * 0.66, 2, 62);
    c.beginPath();
    if (has(it, 'diagonal')) { c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.lineTo(w / 2, -d / 2 + a); c.lineTo(-w / 2 + a, d / 2); c.lineTo(-w / 2, d / 2); }
    else if (has(it, 'rounded', 'curved', 'triangular')) {
      if (has(it, 'triangular')) { c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.lineTo(-w / 2, d / 2); }
      else { c.moveTo(-w / 2, -d / 2); c.ellipse(-w / 2, -d / 2, w, d, 0, 0, PI / 2); }
    } else if (has(it, 'concave')) { c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.lineTo(w / 2, -d / 2 + a * 0.5); c.ellipse(w / 2, d / 2, w - a * 0.5, d - a * 0.5, 0, PI * 1.5, PI, true); c.lineTo(-w / 2, d / 2); }
    else { c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.lineTo(w / 2, -d / 2 + a); c.lineTo(-w / 2 + a, -d / 2 + a); c.lineTo(-w / 2 + a, d / 2); c.lineTo(-w / 2, d / 2); }
    c.closePath();
    if (up(it) || /^wall_(corner|blind|diagonal|rounded)/.test(K(it))) { c.save(); c.setLineDash?.([du(w, d), du(w, d) * 0.7]); c.fill(); c.stroke(); c.restore(); } else { c.fill(); c.stroke(); }
    if (has(it, 'shelving', 'open')) soft(c, () => { ES(c, -w / 2, -d / 2, w * 0.66, d * 0.66, 0, PI / 2); ES(c, -w / 2, -d / 2, w * 0.33, d * 0.33, 0, PI / 2); });
    else soft(c, () => L(c, -w / 2, -d / 2, -w / 2 + a * 0.9, -d / 2 + a * 0.9));
  },
  kitchenBase(c, w, d, it) {
    const m = Math.min(w, d), t = cl(d * 0.06, 0.8, 3.5), fy = d / 2 - t;
    if (has(it, 'rounded', 'end_')) {
      const rr = Math.min(w, d) * 0.9;
      const draw = () => RR(c, -w / 2, -d / 2, w, d, [0, 0, rr, 0]);
      if (up(it)) dash(c, du(w, d), draw); else draw();
    } else body(c, w, d, it);
    const open = has(it, 'open', 'rack');
    if (open) {
      soft(c, () => { if (has(it, 'wine', 'bottle')) { for (let x = -w / 2 + 6; x < w / 2 - 3; x += 9) for (let y = -d / 2 + 6; y < d / 2 - 3; y += 9) CS(c, x, y, 3.2); } else { L(c, -w / 2 + 2, -d * 0.1, w / 2 - 2, -d * 0.1); L(c, -w / 2 + 2, d * 0.15, w / 2 - 2, d * 0.15); } });
      dash(c, du(w, d), () => L(c, -w / 2, fy, w / 2, fy));
      return;
    }
    L(c, -w / 2, fy, w / 2, fy);
    const drawers = has(it, 'drawer');
    const n = has(it, 'two_doors') || (w > 70 && !drawers) ? Math.max(2, Math.round(w / 50)) : 1;
    for (let i = 1; i < n; i++) L(c, -w / 2 + (i * w) / n, fy, -w / 2 + (i * w) / n, d / 2);
    for (let i = 0; i < n; i++) {
      const x = drawers ? -w / 2 + ((i + 0.5) * w) / n : -w / 2 + ((i + (i % 2 ? 0.12 : 0.88)) * w) / n;
      handle(c, x, d / 2 - t / 2, drawers ? cl((w / n) * 0.4, 1, 16) : cl(t * 0.6, 0.4, 1.4), t * 0.55);
    }
    if (has(it, 'microwave')) { R(c, -w * 0.38, -d * 0.18, w * 0.76, d * 0.5); soft(c, () => dash(c, du(w, d), () => CS(c, -w * 0.06, d * 0.07, Math.min(w, d) * 0.18))); }
    else if (has(it, 'trash')) soft(c, () => dash(c, du(w, d), () => { CS(c, -w * 0.2, 0, m * 0.18); CS(c, w * 0.2, 0, m * 0.18); }));
    else if (has(it, 'wine', 'bottle')) soft(c, () => { for (let x = -w / 2 + 6; x < w / 2 - 3; x += 9) for (let y = -d / 2 + 6; y < fy - 3; y += 9) CS(c, x, y, 3.2); });
    else if (has(it, 'glass', 'display')) soft(c, () => dash(c, du(w, d), () => R(c, -w / 2 + m * 0.1, -d / 2 + m * 0.1, w - m * 0.2, fy + d / 2 - m * 0.2)));
  },
  worktop(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    soft(c, () => { L(c, -w / 2, d / 2 - cl(d * 0.06, 0.6, 3), w / 2, d / 2 - cl(d * 0.06, 0.6, 3)); for (let i = 0; i < 5; i++) L(c, -w / 2 + w * (0.1 + i * 0.2), -d * 0.3 + (i % 2) * d * 0.2, -w / 2 + w * (0.18 + i * 0.2), -d * 0.2 + (i % 2) * d * 0.2); });
  },
  frontPanel(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      R(c, -W / 2, -H / 2, W, H);
      if (has(it, 'drawer', 'door')) handle(c, has(it, 'door') ? W * 0.36 : 0, H / 2 + 0.6, has(it, 'door') ? 1.2 : W * 0.3, 1.2);
    });
  },
  tallCabinet(c, w, d, it) {
    const m = Math.min(w, d), t = cl(d * 0.06, 0.8, 3.5), fy = d / 2 - t;
    body(c, w, d, it);
    L(c, -w / 2, fy, w / 2, fy);
    const double = has(it, 'double');
    if (double) L(c, 0, fy, 0, d / 2);
    handle(c, double ? -w * 0.06 : w * 0.38, d / 2 - t / 2, cl(t * 0.6, 0.4, 1.4), t * 0.55);
    if (double) handle(c, w * 0.06, d / 2 - t / 2, cl(t * 0.6, 0.4, 1.4), t * 0.55);
    soft(c, () => { L(c, -w / 2, -d / 2, w / 2, fy); L(c, w / 2, -d / 2, -w / 2, fy); }, 0.35);
    const cy = (fy - d / 2) / 2, r = m * 0.26;
    if (has(it, 'refrigerator')) { C(c, 0, cy, r); flake(c, 0, cy, r * 0.7); }
    else if (has(it, 'oven', 'microwave')) { RR(c, -w * 0.32, cy - r * 0.6, w * 0.64, r * 1.2, r * 0.2); soft(c, () => R(c, -w * 0.24, cy - r * 0.35, w * 0.48, r * 0.7)); }
    else if (has(it, 'coffee')) { C(c, 0, cy, r * 0.7); RR(c, r * 0.6, cy - r * 0.25, r * 0.4, r * 0.5, r * 0.2); }
    else if (has(it, 'bottle')) soft(c, () => { for (let x = -w / 2 + 6; x < w / 2 - 3; x += 9) for (let y = -d / 2 + 6; y < fy - 3; y += 9) CS(c, x, y, 3.2); });
    else if (has(it, 'display', 'glass')) soft(c, () => dash(c, du(w, d), () => R(c, -w / 2 + m * 0.1, -d / 2 + m * 0.1, w - m * 0.2, fy + d / 2 - m * 0.2)));
  },
  shelfUnit(c, w, d, it) {
    const m = Math.min(w, d);
    body(c, w, d, it);
    alongX(c, w, d, (W, H) => {
      const n = has(it, 'kallax_4') ? 2 : has(it, 'kallax_5') ? 5 : cl(Math.round(W / 38), 1, 12);
      for (let i = 1; i < n; i++) L(c, -W / 2 + (i * W) / n, -H / 2, -W / 2 + (i * W) / n, H / 2);
      if (has(it, 'zigzag', 'diagonal', 'tree', 'tetra', 'decorative')) soft(c, () => { c.beginPath(); c.moveTo(-W / 2, H / 2); for (let i = 1; i <= n * 2; i++) c.lineTo(-W / 2 + (i * W) / (n * 2), i % 2 ? -H / 2 : H / 2); c.stroke(); });
      if (H > 18 && !has(it, 'helmet', 'cue', 'guitar')) for (let i = 0; i < n; i++) books(c, -W / 2 + (i * W) / n + 1, -H / 2 + H * 0.12, W / n - 2, H * 0.72);
    });
    if (has(it, 'loft')) soft(c, () => { for (const sx of [-1, 1]) for (const sy of [-1, 1]) R(c, sx * (w / 2 - m * 0.06) - m * 0.04, sy * (d / 2 - m * 0.06) - m * 0.04, m * 0.08, m * 0.08); });
  },
  mediaWall(c, w, d, it) {
    const m = Math.min(w, d), t = cl(d * 0.07, 0.8, 4), fy = d / 2 - t;
    body(c, w, d, it);
    const mid = w * 0.42;
    L(c, -w / 2, fy, -mid / 2, fy); L(c, mid / 2, fy, w / 2, fy);
    L(c, -mid / 2, -d / 2, -mid / 2, d / 2); L(c, mid / 2, -d / 2, mid / 2, d / 2);
    tone(c, 0.65, () => RR(c, -mid * 0.44, -d / 2 + d * 0.15, mid * 0.88, cl(d * 0.1, 1, 5), 1));
    const side = (x0, x1) => { const k = cl(Math.round((x1 - x0) / 45), 1, 4); for (let i = 1; i < k; i++) L(c, x0 + ((x1 - x0) * i) / k, fy, x0 + ((x1 - x0) * i) / k, d / 2); };
    side(-w / 2, -mid / 2); side(mid / 2, w / 2);
    if (has(it, 'open')) { books(c, -w / 2 + 2, -d / 2 + d * 0.12, w / 2 - mid / 2 - 4, d * 0.6); books(c, mid / 2 + 2, -d / 2 + d * 0.12, w / 2 - mid / 2 - 4, d * 0.6); }
  },
  tv(c, w, d, it) {
    const m = Math.min(w, d), t = cl(d * 0.08, 0.8, 4), fy = d / 2 - t;
    if (has(it, 'corner')) P(c, -w / 2, -d / 2, w / 2, -d / 2, w / 2, d * 0.1, w * 0.3, d / 2, -w * 0.3, d / 2, -w / 2, d * 0.1);
    else body(c, w, d, it, cl(m * 0.04, 0, 2));
    if (!has(it, 'corner')) { L(c, -w / 2, fy, w / 2, fy); const n = cl(Math.round(w / 45), 1, 6); for (let i = 1; i < n; i++) L(c, -w / 2 + (i * w) / n, fy, -w / 2 + (i * w) / n, d / 2); }
    const tw = w * 0.66, th = cl(d * 0.1, 1, 5);
    tone(c, 0.7, () => RR(c, -tw / 2, -d * 0.12, tw, th, th / 2));
    soft(c, () => RR(c, -tw * 0.14, -d * 0.12 - th * 0.4, tw * 0.28, th * 2.4, 1));
  },
  tvWall(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      tone(c, 0.75, () => RR(c, -W / 2, -H / 2, W, H, Math.min(H, W) * 0.3));
      soft(c, () => L(c, -W / 2 + H, H * 0.25, W / 2 - H, H * 0.25));
      if (has(it, 'stand', 'mobile')) soft(c, () => { L(c, -W * 0.25, 0, -W * 0.3, H / 2); L(c, W * 0.25, 0, W * 0.3, H / 2); });
    });
  },
  projectorScreen(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      RR(c, -W / 2, -H / 2, W, H, H * 0.45);
      tone(c, 0.5, () => { R(c, -W / 2, -H / 2, H * 0.6, H); R(c, W / 2 - H * 0.6, -H / 2, H * 0.6, H); });
      if (has(it, 'tripod')) soft(c, () => { L(c, 0, 0, -W * 0.08, H / 2); L(c, 0, 0, W * 0.08, H / 2); });
    });
  },
  wineRack(c, w, d, it) {
    body(c, w, d, it);
    soft(c, () => { const s = cl(Math.min(w, d) * 0.22, 3, 9); for (let x = -w / 2 + s * 0.7; x < w / 2 - s * 0.3; x += s) for (let y = -d / 2 + s * 0.7; y < d / 2 - s * 0.3; y += s) CS(c, x, y, s * 0.36); }, 0.7);
  },
  shoeRack(c, w, d, it) {
    body(c, w, d, it);
    const open = has(it, 'open', 'bench');
    if (!open) { const t = cl(d * 0.08, 0.8, 4); L(c, -w / 2, d / 2 - t, w / 2, d / 2 - t); const n = cl(Math.round(w / 45), 1, 6); for (let i = 1; i < n; i++) L(c, -w / 2 + (i * w) / n, d / 2 - t, -w / 2 + (i * w) / n, d / 2); }
    soft(c, () => { const n = cl(Math.round(w / 22), 1, 12), s = w / n, sw = Math.min(s * 0.2, 5); for (let i = 0; i < n; i++) { const x = -w / 2 + (i + 0.5) * s; E(c, x - sw * 1.2, 0, sw, d * 0.3); E(c, x + sw * 1.2, 0, sw, d * 0.3); } }, 0.6);
    if (has(it, 'bench')) tone(c, 0.18, () => RR(c, -w / 2 + 2, -d / 2 + 2, w - 4, d * 0.25, 2));
  },
  coatRack(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'freestanding', 'valet')) {
      if (has(it, 'valet')) { RR(c, -w * 0.4, -d * 0.1, w * 0.8, d * 0.2, d * 0.1); L(c, 0, -d * 0.4, 0, d * 0.4); C(c, 0, 0, m * 0.06); return; }
      C(c, 0, 0, m * 0.18);
      for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; L(c, Math.cos(a) * m * 0.18, Math.sin(a) * m * 0.18, Math.cos(a) * m * 0.46, Math.sin(a) * m * 0.46); C(c, Math.cos(a) * m * 0.46, Math.sin(a) * m * 0.46, m * 0.03); }
      return;
    }
    alongX(c, w, d, (W, H) => {
      RR(c, -W / 2, -H / 2, W, has(it, 'shelf', 'hallway') ? H : H * 0.3, 1);
      const n = cl(Math.round(W / 15), 1, 12);
      for (let i = 0; i < n; i++) { const x = -W / 2 + ((i + 0.5) * W) / n; L(c, x, -H / 2 + H * 0.3, x, H * 0.2); C(c, x, H * 0.2, Math.min(W / n * 0.18, H * 0.08)); }
      if (has(it, 'hallway')) soft(c, () => dash(c, du(W, H), () => R(c, -W / 2 + 2, H * 0.2, W - 4, H * 0.25)));
    });
  },
  chest(c, w, d, it) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.05);
    soft(c, () => RR(c, -w / 2 + m * 0.08, -d / 2 + m * 0.08, w - m * 0.16, d - m * 0.16, m * 0.04));
    tone(c, 0.5, () => { R(c, -w / 2 + w * 0.15, -d / 2, w * 0.05, d); R(c, w / 2 - w * 0.2, -d / 2, w * 0.05, d); });
    RR(c, -w * 0.06, d / 2 - m * 0.12, w * 0.12, m * 0.1, 0.5);
  },
  locker(c, w, d, it) {
    body(c, w, d, it);
    const t = cl(d * 0.07, 0.8, 3.5), fy = d / 2 - t, n = cl(Math.round(w / 35), 1, 10);
    L(c, -w / 2, fy, w / 2, fy);
    for (let i = 1; i < n; i++) L(c, -w / 2 + (i * w) / n, -d / 2, -w / 2 + (i * w) / n, d / 2);
    for (let i = 0; i < n; i++) { handle(c, -w / 2 + ((i + 0.8) * w) / n, d / 2 - t / 2, cl(t * 0.6, 0.4, 1.4), t * 0.55); soft(c, () => { for (let k = 0; k < 3; k++) L(c, -w / 2 + ((i + 0.25) * w) / n, -d * 0.3 + k * d * 0.12, -w / 2 + ((i + 0.6) * w) / n, -d * 0.3 + k * d * 0.12); }); }
  },
  safe(c, w, d, it) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.04);
    R(c, -w / 2 + m * 0.1, -d / 2 + m * 0.1, w - m * 0.2, d - m * 0.2);
    C(c, 0, 0, m * 0.15);
    soft(c, () => { for (let i = 0; i < 8; i++) { const a = (i * TAU) / 8; L(c, Math.cos(a) * m * 0.15, Math.sin(a) * m * 0.15, Math.cos(a) * m * 0.2, Math.sin(a) * m * 0.2); } });
    tone(c, 0.6, () => RR(c, w * 0.22, -d * 0.06, m * 0.06, d * 0.12, 0.5));
  },
  displayCase(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'corner')) { D.cornerUnit(c, w, d, it); tone(c, 0.15, () => { c.beginPath(); c.ellipse(-w / 2, -d / 2, w * 0.95, d * 0.95, 0, 0, PI / 2); c.ellipse(-w / 2, -d / 2, w * 0.7, d * 0.7, 0, PI / 2, 0, true); c.closePath(); c.fill(); }); return; }
    body(c, w, d, it, cl(m * 0.03, 0, 2));
    const gb = cl(d * 0.32, 1.5, 30);
    tone(c, 0.12, () => R(c, -w / 2, d / 2 - gb, w, gb));
    if (has(it, 'deli', 'bakery', 'module', 'counter')) soft(c, () => { c.beginPath(); c.moveTo(-w / 2, d / 2 - gb); c.quadraticCurveTo(-w / 2 + 2, d / 2, -w / 2 + gb, d / 2); c.stroke(); L(c, -w / 2 + gb, d / 2, w / 2, d / 2); });
    soft(c, () => dash(c, du(w, d), () => { L(c, -w / 2 + 2, d / 2 - gb, w / 2 - 2, d / 2 - gb); L(c, -w / 2 + 2, -d * 0.1, w / 2 - 2, -d * 0.1); }));
    soft(c, () => { const n = cl(Math.round(w / 18), 1, 14); for (let i = 0; i < n; i++) RR(c, -w / 2 + ((i + 0.15) * w) / n, -d * 0.08, (w / n) * 0.7, Math.max(1, d / 2 - gb - (-d * 0.08) - 2), 1); }, 0.45);
  },
  retailShelf(c, w, d, it) {
    const m = Math.min(w, d);
    body(c, w, d, it);
    const island = has(it, 'island', 'warehouse', 'double') || d > 70;
    alongX(c, w, d, (W, H) => {
      const n = cl(Math.round(W / 90), 1, 10);
      for (let i = 1; i < n; i++) L(c, -W / 2 + (i * W) / n, -H / 2, -W / 2 + (i * W) / n, H / 2);
      if (island) L(c, -W / 2, 0, W / 2, 0);
      const row = (y0, h) => soft(c, () => { const k = cl(Math.round(W / 12), 2, 60), s = W / k; for (let i = 0; i < k; i++) R(c, -W / 2 + i * s + s * 0.12, y0, s * 0.76, h * (0.6 + ((i * 5) % 3) * 0.15)); }, 0.5);
      if (has(it, 'produce', 'inclined', 'bin')) soft(c, () => { const k = cl(Math.round(W / 40), 1, 10); for (let i = 0; i < k; i++) { const x = -W / 2 + ((i + 0.5) * W) / k; RR(c, x - W / k * 0.42, -H * 0.4, W / k * 0.84, H * 0.8, 1); for (let j = 0; j < 3; j++) C(c, x - W / k * 0.2 + j * W / k * 0.2, 0, Math.min(W / k, H) * 0.08); } });
      else if (island) { row(-H / 2 + 1, H / 2 - 2.5); row(1.5, H / 2 - 2.5); }
      else row(-H / 2 + H * 0.15, H * 0.75);
    });
  },
  breadRack(c, w, d, it) {
    body(c, w, d, it);
    soft(c, () => {
      const n = cl(Math.round(w / 30), 1, 10);
      for (let i = 0; i < n; i++) { const x = -w / 2 + ((i + 0.5) * w) / n; for (let j = 0; j < 2; j++) E(c, x, -d * 0.18 + j * d * 0.38, (w / n) * 0.36, d * 0.14); }
      if (has(it, 'angled')) for (let i = 1; i < 4; i++) L(c, -w / 2, -d / 2 + (i * d) / 4, w / 2, -d / 2 + (i * d) / 4);
    }, 0.6);
  },
  palletRack(c, w, d) {
    alongX(c, w, d, (W, H) => {
      R(c, -W / 2, -H / 2, W, H);
      const n = cl(Math.round(W / 130), 1, 8), p = cl(Math.min(W, H) * 0.06, 1, 6);
      for (let i = 0; i <= n; i++) { const x = -W / 2 + (i * W) / n; tone(c, 0.6, () => { R(c, x - p / 2, -H / 2, p, p); R(c, x - p / 2, H / 2 - p, p, p); }); }
      soft(c, () => dash(c, du(W, H), () => { for (let i = 0; i < n; i++) for (let k = 0; k < 2; k++) R(c, -W / 2 + (i * W) / n + p + k * ((W / n - 2 * p) / 2), -H / 2 + p * 1.5, (W / n - 2 * p) / 2 - p * 0.4, H - p * 3); }));
    });
  },
  panRack(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    soft(c, () => { const n = cl(Math.round(w / 6), 3, 20); for (let i = 1; i < n; i++) L(c, -w / 2 + (i * w) / n, -d / 2 + 2, -w / 2 + (i * w) / n, d / 2 - 2); });
    tone(c, 0.6, () => casters(c, w, d, Math.min(w, d) * 0.06));
  },
  toolCabinet(c, w, d, it) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.03);
    const t = cl(d * 0.08, 0.8, 4);
    L(c, -w / 2, d / 2 - t, w / 2, d / 2 - t);
    soft(c, () => { const n = cl(Math.round(w / 40), 1, 4); for (let i = 0; i < n; i++) handle(c, -w / 2 + ((i + 0.5) * w) / n, d / 2 - t / 2, (w / n) * 0.6, t * 0.5); });
    if (has(it, 'rolling')) { tone(c, 0.6, () => casters(c, w, d, m * 0.06)); L(c, -w / 2 + m * 0.1, -d / 2 + 1, w / 2 - m * 0.1, -d / 2 + 1); }
    else soft(c, () => { L(c, -w / 2, -d / 2, w / 2, d / 2 - t); L(c, w / 2, -d / 2, -w / 2, d / 2 - t); }, 0.4);
  },
  headboard(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const wing = has(it, 'winged');
      RR(c, -W / 2, -H / 2, W, H, has(it, 'soft', 'winged') ? H * 0.4 : 0.5);
      if (wing) { RR(c, -W / 2, -H / 2, W * 0.08, H * 2.2 > H ? H : H, H * 0.4); RR(c, W / 2 - W * 0.08, -H / 2, W * 0.08, H, H * 0.4); }
      if (has(it, 'wooden')) soft(c, () => { const n = cl(Math.round(W / 18), 2, 14); for (let i = 1; i < n; i++) L(c, -W / 2 + (i * W) / n, -H / 2, -W / 2 + (i * W) / n, H / 2); });
      else if (has(it, 'shelf')) soft(c, () => L(c, -W / 2, 0, W / 2, 0));
      else tone(c, 0.6, () => { const n = cl(Math.round(W / 20), 2, 16); for (let i = 0; i < n; i++) C(c, -W / 2 + ((i + 0.5) * W) / n, 0, Math.min(H * 0.12, 1.2)); });
    });
  },
  wallPanel(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      body(c, W, H, it, H * 0.3);
      if (has(it, 'water')) { soft(c, () => { c.beginPath(); c.moveTo(-W / 2, 0); for (let x = -W / 2; x < W / 2; x += 8) c.quadraticCurveTo(x + 2, -H * 0.3, x + 4, 0), c.quadraticCurveTo(x + 6, H * 0.3, x + 8, 0); c.stroke(); }); return; }
      const n = cl(Math.round(W / (has(it, 'vertical') ? 20 : 30)), 1, 30);
      for (let i = 1; i < n; i++) L(c, -W / 2 + (i * W) / n, -H / 2, -W / 2 + (i * W) / n, H / 2);
    });
  },
  radCover(c, w, d, it) {
    body(c, w, d, it);
    soft(c, () => { for (let x = -w / 2 + 4; x < w / 2 - 2; x += 4) L(c, x, -d / 2 + d * 0.2, x, d / 2 - d * 0.2); });
    if (has(it, 'storage')) L(c, -w / 2, -d / 2 + d * 0.15, w / 2, -d / 2 + d * 0.15);
  },
  mirrorF(c, w, d, it) {
    alongX(c, w, d, (W, H0) => {
      const H = Math.min(H0, 6);
      c.save(); c.translate(0, -(H0 - H) / 2);
      if (H0 > H) soft(c, () => dash(c, du(W, H0), () => { L(c, -W / 2, H / 2, -W / 2 + W * 0.1, H0 - H / 2); L(c, W / 2, H / 2, W / 2 - W * 0.1, H0 - H / 2); }), 0.4);
      const shape = () => {
        if (has(it, 'round', 'oval', 'half_moon', 'arched')) RR(c, -W / 2, -H / 2, W, H, H / 2);
        else R(c, -W / 2, -H / 2, W, H);
      };
      if (up(it)) dash(c, du(W, H) * 2, shape); else shape();
      soft(c, () => { for (let x = -W / 2 + W * 0.15; x < W / 2 - H * 1.2 - 1; x += Math.max(W * 0.2, 6)) L(c, x, H / 2, x + H * 1.2, -H / 2); });
      if (has(it, 'backlit')) tone(c, 0.3, () => R(c, -W / 2, -H / 2, W, H * 0.3));
      c.restore();
    });
  },

  // ===== Virtuves tehnika =====
  stove(c, w, d, it) {
    const k = K(it), nm = k.match(/(\d)_burner/);
    const n = nm ? +nm[1] : has(it, 'double', 'portable', 'kids') ? 2 : 4;
    const range = has(it, 'range') || !has(it, 'cooktop', 'desktop');
    const kb = range ? cl(d * 0.13, 1.5, 9) : 0;
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, cl(m * 0.03, 0, 2));
    if (range) {
      L(c, -w / 2, d / 2 - kb, w / 2, d / 2 - kb);
      for (let i = 0; i < Math.min(n + 1, 7); i++) C(c, -w / 2 + ((i + 0.5) * w) / Math.min(n + 1, 7), d / 2 - kb / 2, kb * 0.25);
    }
    const aw = w * 0.9, ah = d - kb - d * 0.08, ay = -d / 2 + d * 0.04 + ah / 2;
    const L1 = { 1: [[0, 0, 1.2]], 2: [[-0.5, 0, 1], [0.5, 0, 1]], 3: [[-0.5, -0.5, 0.85], [-0.5, 0.5, 0.85], [0.5, 0, 1.15]], 4: [[-0.5, -0.5, 1], [0.5, -0.5, 0.85], [-0.5, 0.5, 0.85], [0.5, 0.5, 1]], 5: [[-0.66, -0.5, 0.8], [0.66, -0.5, 0.8], [-0.66, 0.5, 0.8], [0.66, 0.5, 0.8], [0, 0, 1.05]], 6: [[-0.66, -0.5, 0.85], [0, -0.5, 0.85], [0.66, -0.5, 0.85], [-0.66, 0.5, 0.85], [0, 0.5, 0.85], [0.66, 0.5, 0.85]] }[cl(n, 1, 6)];
    const cols = n >= 5 ? 3 : 2, br = Math.min(aw / (cols * 2), ah / 4) * 0.85;
    const gas = has(it, 'gas') || (!has(it, 'electric', 'induction') && range);
    for (const [u, v, s] of L1) {
      const x = (u * aw) / 2, y = ay + (v * ah) / 2, r = br * s;
      if (gas) { C(c, x, y, r); soft(c, () => { CS(c, x, y, r * 0.55); L(c, x - r * 1.15, y, x + r * 1.15, y); L(c, x, y - r * 1.15, x, y + r * 1.15); }); tone(c, 0.5, () => C(c, x, y, r * 0.25)); }
      else if (has(it, 'induction')) { soft(c, () => CS(c, x, y, r)); dash(c, r * 0.3, () => CS(c, x, y, r * 0.7)); }
      else { C(c, x, y, r); soft(c, () => { CS(c, x, y, r * 0.7); CS(c, x, y, r * 0.4); }); }
    }
  },
  oven(c, w, d, it) {
    const m = Math.min(w, d), t = cl(d * 0.1, 1, 6);
    RR(c, -w / 2, -d / 2, w, d, cl(m * 0.03, 0, 2));
    R(c, -w / 2, d / 2 - t, w, t);
    handle(c, 0, d / 2 - t * 0.35, w * 0.6, t * 0.3);
    if (has(it, 'microwave')) {
      dash(c, du(w, d), () => CS(c, -w * 0.1, -t / 2, Math.min(w * 0.3, (d - t) * 0.38)));
      soft(c, () => { R(c, w * 0.28, -d / 2 + d * 0.1, w * 0.16, d * 0.6); grid(c, w * 0.28, -d / 2 + d * 0.1, w * 0.16, d * 0.6, 2, 4); });
      return;
    }
    if (has(it, 'convection', 'combi', 'rotisserie')) {
      const r = Math.min(w, d - t) * 0.28;
      C(c, 0, -t / 2, r);
      soft(c, () => { for (let i = 0; i < 4; i++) { const a = (i * PI) / 2 + 0.4; L(c, 0, -t / 2, Math.cos(a) * r * 0.9, -t / 2 + Math.sin(a) * r * 0.9); } });
      return;
    }
    if (has(it, 'conveyor')) { soft(c, () => { for (let x = -w / 2 + 3; x < w / 2; x += 3) L(c, x, -d * 0.3, x, d * 0.15); }); tone(c, 0.2, () => R(c, -w * 0.3, -d * 0.4, w * 0.6, d * 0.65)); return; }
    soft(c, () => { RR(c, -w * 0.36, -d * 0.36, w * 0.72, d * 0.6, 2); for (let x = -w * 0.3; x < w * 0.32; x += Math.max(w * 0.08, 2)) L(c, x, -d / 2 + d * 0.04, x + w * 0.04, -d / 2 + d * 0.04); });
  },
  fridge(c, w, d, it) {
    const m = Math.min(w, d), t = cl(d * 0.08, 1, 5);
    RR(c, -w / 2, -d / 2, w, d, cl(m * 0.04, 0, 3));
    if (has(it, 'chest', 'ice_cream', 'level', 'island')) {
      const n = has(it, 'island', 'level') ? 2 : 1;
      for (let i = 0; i < n; i++) { const x0 = -w / 2 + (i * w) / n; R(c, x0 + m * 0.05, -d / 2 + m * 0.05, w / n - m * 0.1, d - m * 0.1); }
      soft(c, () => flake(c, 0, 0, m * 0.2));
      return;
    }
    L(c, -w / 2, d / 2 - t, w / 2, d / 2 - t);
    const dbl = has(it, '2_door', 'double');
    if (dbl) L(c, 0, d / 2 - t, 0, d / 2);
    tone(c, 0.6, () => { if (dbl) { R(c, -w * 0.08, d / 2 - t * 0.7, w * 0.04, t * 0.5); R(c, w * 0.04, d / 2 - t * 0.7, w * 0.04, t * 0.5); } else R(c, w * 0.3, d / 2 - t * 0.7, w * 0.14, t * 0.5); });
    const cy = -t / 2;
    if (has(it, 'wine')) { soft(c, () => { const s = cl(m * 0.2, 3, 9); for (let x = -w / 2 + s * 0.8; x < w / 2 - s * 0.4; x += s) for (let y = -d / 2 + s * 0.8; y < d / 2 - t - s * 0.4; y += s) CS(c, x, y, s * 0.36); }); return; }
    if (has(it, 'glass')) soft(c, () => dash(c, du(w, d), () => R(c, -w / 2 + m * 0.08, -d / 2 + m * 0.08, w - m * 0.16, d - t - m * 0.16)));
    if (has(it, 'table', 'prep')) { const n = cl(Math.round(w / 60), 1, 4); for (let i = 1; i < n; i++) L(c, -w / 2 + (i * w) / n, d / 2 - t, -w / 2 + (i * w) / n, d / 2); }
    soft(c, () => flake(c, 0, cy, m * (has(it, 'freezer') ? 0.3 : 0.22)), 0.8);
  },
  dishwasher(c, w, d, it) {
    const m = Math.min(w, d), t = cl(d * 0.08, 1, 5);
    if (has(it, 'conveyor')) {
      alongX(c, w, d, (W, H) => { R(c, -W / 2, -H / 2, W, H); R(c, -W * 0.2, -H / 2, W * 0.4, H); soft(c, () => { for (let x = -W / 2 + 3; x < W / 2; x += 4) if (Math.abs(x) > W * 0.2) L(c, x, -H * 0.4, x, H * 0.4); }); });
      return;
    }
    RR(c, -w / 2, -d / 2, w, d, cl(m * 0.03, 0, 2));
    if (has(it, 'hood_type')) { dash(c, du(w, d), () => R(c, -w * 0.4, -d * 0.4, w * 0.8, d * 0.8)); handle(c, 0, d / 2 - t, w * 0.5, t * 0.4); return; }
    R(c, -w / 2, d / 2 - t, w, t);
    handle(c, 0, d / 2 - t * 0.35, w * 0.5, t * 0.3);
    soft(c, () => { dash(c, du(w, d), () => grid(c, -w * 0.4, -d * 0.42, w * 0.8, d * 0.72, 5, 4)); });
    const cy = -t / 2 - d * 0.04;
    L(c, -w * 0.32, cy + d * 0.05, w * 0.32, cy - d * 0.05);
    C(c, 0, cy, m * 0.06);
  },
  washerF(c, w, d, it) {
    const m = Math.min(w, d), p = cl(d * 0.15, 1.5, 10);
    RR(c, -w / 2, -d / 2, w, d, cl(m * 0.04, 0, 3));
    L(c, -w / 2, -d / 2 + p, w / 2, -d / 2 + p);
    C(c, w * 0.3, -d / 2 + p / 2, p * 0.28);
    soft(c, () => R(c, -w * 0.4, -d / 2 + p * 0.25, w * 0.2, p * 0.5));
    C(c, 0, p / 2, Math.min(w, d - p) * 0.34);
    soft(c, () => CS(c, 0, p / 2, Math.min(w, d - p) * 0.24));
  },
  kSink(c, w, d, it) {
    const m = Math.min(w, d);
    R(c, -w / 2, -d / 2, w, d);
    const by = d * 0.06, bh = d * 0.62;
    const bowl = (x, bw) => { RR(c, x - bw / 2, by - bh / 2, bw, bh, Math.min(bw, bh) * 0.18); tone(c, 0.5, () => C(c, x, by, Math.min(bw, bh) * 0.06)); };
    let tapX = 0;
    if (has(it, 'double')) { const bw = w * 0.38; bowl(-w * 0.21, bw); bowl(w * 0.21, bw); tapX = 0; }
    else if (has(it, 'round')) { C(c, 0, by, Math.min(w * 0.36, bh * 0.55)); tone(c, 0.5, () => C(c, 0, by, m * 0.04)); }
    else if (has(it, 'drainboard')) { bowl(-w * 0.2, w * 0.44); tapX = -w * 0.2; soft(c, () => { for (let i = 0; i < 6; i++) L(c, w * 0.06 + i * w * 0.065, by - bh * 0.4, w * 0.06 + i * w * 0.065, by + bh * 0.4); }); }
    else if (has(it, 'corner')) { c.save(); c.rotate(-PI / 4); RR(c, -m * 0.28, -m * 0.28, m * 0.56, m * 0.56, m * 0.1); c.restore(); tapX = -w * 0.3; }
    else bowl(0, w * 0.6);
    if (has(it, 'drop_in')) soft(c, () => RR(c, -w / 2 + m * 0.06, -d / 2 + m * 0.06, w - m * 0.12, d - m * 0.12, m * 0.08));
    C(c, tapX, -d / 2 + d * 0.1, cl(m * 0.05, 1, 3));
    L(c, tapX, -d / 2 + d * 0.1, tapX, by - bh * 0.25);
  },
  hood(c, w, d, it) {
    const m = Math.min(w, d), u = du(w, d);
    if (has(it, 'round')) { dash(c, u, () => E(c, 0, 0, w / 2, d / 2)); CS(c, 0, 0, m * 0.2); return; }
    if (has(it, 'corner')) { dash(c, u, () => P(c, -w / 2, -d / 2, w / 2, -d / 2, w / 2, 0, 0, d / 2, -w / 2, d / 2)); R(c, -w / 2 + 1, -d / 2 + 1, m * 0.3, m * 0.3); return; }
    dash(c, u, () => R(c, -w / 2, -d / 2, w, d));
    if (!has(it, 'built_in', 'flat')) R(c, -m * 0.18, -d / 2, m * 0.36, m * 0.3);
    soft(c, () => { for (let x = -w * 0.4; x <= w * 0.41; x += w * 0.1) L(c, x, d * 0.05, x, d * 0.38); });
  },
  kettle(c, w, d) {
    const m = Math.min(w, d), r = m * 0.34;
    soft(c, () => C(c, 0, 0, m * 0.45));
    P(c, r * 0.8, -r * 0.25, w / 2 - m * 0.04, -r * 0.05, r * 0.8, r * 0.25);
    eband(c, -r * 0.2, 0, r * 1.25, r * 0.8, r * 0.18, PI * 0.6, PI * 1.4);
    C(c, 0, 0, r);
    soft(c, () => CS(c, 0, 0, r * 0.5));
  },
  toaster(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w * 0.44, -d * 0.36, w * 0.88, d * 0.72, m * 0.18);
    tone(c, 0.5, () => { RR(c, -w * 0.3, -d * 0.2, w * 0.6, d * 0.1, d * 0.05); RR(c, -w * 0.3, d * 0.1, w * 0.6, d * 0.1, d * 0.05); });
    R(c, w * 0.42, -d * 0.08, w * 0.06, d * 0.16);
  },
  coffeeMaker(c, w, d, it) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d * 0.62, m * 0.08);
    RR(c, -w * 0.4, -d / 2 + d * 0.62, w * 0.8, d * 0.38, m * 0.06);
    C(c, 0, -d / 2 + d * 0.8, m * 0.14);
    soft(c, () => { R(c, -w * 0.38, -d / 2 + d * 0.06, w * 0.3, d * 0.4); C(c, w * 0.22, -d * 0.12, m * 0.06); });
  },
  jarAppliance(c, w, d, it) {
    const m = Math.min(w, d);
    RR(c, -w * 0.42, -d * 0.42, w * 0.84, d * 0.84, m * 0.15);
    const mixer = has(it, 'mixer');
    C(c, 0, mixer ? d * 0.08 : 0, m * (mixer ? 0.3 : 0.28));
    soft(c, () => CS(c, 0, mixer ? d * 0.08 : 0, m * 0.18));
    if (mixer) RR(c, -w * 0.12, -d * 0.44, w * 0.24, d * 0.56, m * 0.1);
    if (has(it, 'grinder', 'juicer', 'processor')) { C(c, w * 0.22, -d * 0.22, m * 0.1); }
    tone(c, 0.6, () => C(c, w * 0.3, d * 0.3, m * 0.04));
  },
  cookerPot(c, w, d, it) {
    const m = Math.min(w, d), r = m * 0.36;
    R(c, -r * 1.3, -r * 0.18, r * 2.6, r * 0.36);
    C(c, 0, 0, r);
    soft(c, () => { CS(c, 0, 0, r * 0.75); CS(c, 0, 0, r * 0.12); });
    if (has(it, 'still')) { L(c, r, 0, w * 0.35, 0); for (let i = 0; i < 3; i++) CS(c, w * 0.38, 0, m * (0.04 + i * 0.03)); }
    if (has(it, 'steam_kettle')) { L(c, 0, r, 0, d * 0.48); }
  },
  waffle(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w * 0.42, -d * 0.4, w * 0.84, d * 0.66, m * 0.16);
    soft(c, () => grid(c, -w * 0.32, -d * 0.3, w * 0.64, d * 0.46, 5, 4));
    RR(c, -w * 0.08, d * 0.26, w * 0.16, d * 0.22, m * 0.04);
  },
  breadMaker(c, w, d, it) {
    const m = Math.min(w, d);
    RR(c, -w * 0.45, -d * 0.45, w * 0.9, d * 0.9, m * 0.14);
    RR(c, -w * 0.3, -d * 0.3, w * 0.6, d * 0.42, m * 0.06);
    soft(c, () => { R(c, -w * 0.22, d * 0.2, w * 0.3, d * 0.12); C(c, w * 0.22, d * 0.26, m * 0.05); });
  },
  grill(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'charcoal')) {
      const r = m * 0.46;
      C(c, 0, 0, r);
      soft(c, () => { for (let y = -r * 0.8; y <= r * 0.81; y += r * 0.2) { const hw = Math.sqrt(Math.max(0, r * r * 0.9 - y * y)); L(c, -hw, y, hw, y); } });
      tone(c, 0.5, () => RR(c, -r * 0.3, -r * 1.08, r * 0.6, r * 0.12, 1));
      return;
    }
    RR(c, -w / 2, -d / 2, w, d, cl(m * 0.04, 0, 3));
    const kb = cl(d * 0.12, 1.5, 8);
    L(c, -w / 2, d / 2 - kb, w / 2, d / 2 - kb);
    for (let i = 0; i < 3; i++) C(c, -w * 0.3 + i * w * 0.3, d / 2 - kb / 2, kb * 0.25);
    const ax = -w / 2 + m * 0.08, aw = w - m * 0.16, ay = -d / 2 + m * 0.08, ah = d - kb - m * 0.14;
    R(c, ax, ay, aw, ah);
    if (has(it, 'griddle')) tone(c, 0.12, () => R(c, ax, ay, aw, ah));
    else soft(c, () => { for (let x = ax + 2.5; x < ax + aw - 1; x += Math.max(aw / 14, 2)) L(c, x, ay, x, ay + ah); });
  },
  fryer(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, cl(m * 0.03, 0, 2));
    for (const sx of [-1, 1]) {
      R(c, sx * w * 0.23 - w * 0.19, -d * 0.4, w * 0.38, d * 0.56);
      soft(c, () => grid(c, sx * w * 0.23 - w * 0.19, -d * 0.4, w * 0.38, d * 0.56, 4, 5));
      L(c, sx * w * 0.23, d * 0.16, sx * w * 0.23, d * 0.4);
    }
  },
  pizzaOven(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'tandoor')) { C(c, 0, 0, m * 0.48); tone(c, 0.35, () => C(c, 0, 0, m * 0.24)); soft(c, () => CS(c, 0, 0, m * 0.36)); return; }
    if (has(it, 'gyro', 'broiler')) {
      RR(c, -w / 2, -d / 2, w, d, m * 0.05);
      tone(c, 0.2, () => R(c, -w * 0.4, -d * 0.4, w * 0.8, d * 0.3));
      E(c, 0, d * 0.05, m * 0.2, m * 0.2);
      soft(c, () => { CS(c, 0, d * 0.05, m * 0.1); R(c, -w * 0.3, d * 0.3, w * 0.6, d * 0.12); });
      return;
    }
    R(c, -w / 2, -d / 2, w, d);
    E(c, 0, -d * 0.04, w * 0.44, d * 0.42);
    tone(c, 0.35, () => eband(c, 0, -d * 0.04, w * 0.44, d * 0.42, Math.min(w, d) * 0.06, PI * 0.25, PI * 0.75));
    soft(c, () => { flame(c, 0, -d * 0.06, m * 0.14); C(c, 0, -d * 0.3, m * 0.08); });
  },
  woodStove(c, w, d, it) {
    const m = Math.min(w, d), remote = has(it, 'remote');
    const H = remote ? d * 0.7 : d, y0 = remote ? -d / 2 + d * 0.3 : -d / 2;
    if (remote) { R(c, -w * 0.18, -d / 2, w * 0.36, d * 0.32); tone(c, 0.3, () => R(c, -w * 0.12, -d / 2, w * 0.24, d * 0.1)); }
    if (has(it, 'cylindrical')) E(c, 0, y0 + H / 2, w / 2, H / 2);
    else RR(c, -w / 2, y0, w, H, m * 0.06);
    tone(c, 0.35, () => RR(c, -w * 0.3, y0 + H * 0.72, w * 0.6, H * 0.2, m * 0.03));
    C(c, 0, y0 + H * 0.35, m * 0.15);
    soft(c, () => CS(c, 0, y0 + H * 0.35, m * 0.09));
    flame(c, 0, y0 + H * 0.82, m * 0.08);
  },
  stoveGuard(c, w, d) {
    const m = Math.min(w, d), t = cl(m * 0.08, 1, 6);
    R(c, -w / 2, -d / 2, w, d);
    tone(c, 0.12, () => R(c, -w / 2 + t, -d / 2 + t, w - 2 * t, d - 2 * t));
    soft(c, () => {
      for (let x = -w / 2 + 3; x < w / 2; x += 4) { L(c, x, -d / 2, x, -d / 2 + t); L(c, x, d / 2 - t, x, d / 2); }
      for (let y = -d / 2 + 3; y < d / 2; y += 4) { L(c, -w / 2, y, -w / 2 + t, y); L(c, w / 2 - t, y, w / 2, y); }
    });
    soft(c, () => { for (let i = 0; i < 9; i++) C(c, -w * 0.2 + (i % 3) * w * 0.2, -d * 0.2 + Math.floor(i / 3) * d * 0.2, m * 0.06); });
  },
  buffetStation(c, w, d, it) {
    const m = Math.min(w, d);
    alongX(c, w, d, (W, H) => {
      R(c, -W / 2, -H / 2, W, H);
      dash(c, du(W, H), () => L(c, -W / 2 + 2, H / 2 - H * 0.12, W / 2 - 2, H / 2 - H * 0.12));
      if (has(it, 'coffee', 'juice', 'cutlery')) {
        const n = cl(Math.round(W / 35), 2, 8);
        for (let i = 0; i < n; i++) { const x = -W / 2 + ((i + 0.5) * W) / n; if (has(it, 'cutlery')) RR(c, x - W / n * 0.35, -H * 0.3, W / n * 0.7, H * 0.4, 1); else { C(c, x, -H * 0.08, Math.min(W / n, H) * 0.22); soft(c, () => CS(c, x, -H * 0.08, Math.min(W / n, H) * 0.12)); } }
        return;
      }
      if (has(it, 'soup')) { const n = cl(Math.round(W / 40), 1, 6); for (let i = 0; i < n; i++) { const x = -W / 2 + ((i + 0.5) * W) / n; C(c, x, -H * 0.06, Math.min(W / n, H) * 0.3); soft(c, () => L(c, x, -H * 0.06, x + Math.min(W / n, H) * 0.3, -H * 0.4)); } return; }
      const n = cl(Math.round(W / 33), 1, 10);
      for (let i = 0; i < n; i++) RR(c, -W / 2 + (i + 0.08) * (W / n), -H * 0.36, (W / n) * 0.84, H * 0.56, 1);
    });
  },
  prepTable(c, w, d, it) {
    const m = Math.min(w, d);
    R(c, -w / 2, -d / 2, w, d);
    tone(c, 0.3, () => R(c, -w / 2, -d / 2, w, cl(d * 0.06, 0.8, 4)));
    soft(c, () => dash(c, du(w, d), () => R(c, -w / 2 + m * 0.08, -d / 2 + m * 0.12, w - m * 0.16, d - m * 0.2)));
    if (has(it, 'refrigerated')) { tone(c, 0.12, () => R(c, -w * 0.45, -d * 0.4, w * 0.9, d * 0.28)); soft(c, () => grid(c, -w * 0.45, -d * 0.4, w * 0.9, d * 0.28, cl(Math.round(w / 18), 2, 12), 1)); }
    if (has(it, 'stainless', 'steel')) soft(c, () => { L(c, -w * 0.3, d * 0.1, w * 0.3, -d * 0.1); L(c, -w * 0.1, d * 0.25, w * 0.4, d * 0.05); });
  },
  espresso(c, w, d) {
    const m = Math.min(w, d);
    alongX(c, w, d, (W, H) => {
      RR(c, -W / 2, -H / 2, W, H * 0.7, m * 0.05);
      tone(c, 0.12, () => R(c, -W / 2, H / 2 - H * 0.3, W, H * 0.3));
      R(c, -W / 2, H / 2 - H * 0.3, W, H * 0.3);
      const n = cl(Math.round(W / 30), 1, 4);
      for (let i = 0; i < n; i++) { const x = -W / 2 + ((i + 0.5) * W) / n; C(c, x, H * 0.05, H * 0.09); soft(c, () => { L(c, x, H * 0.05, x, H * 0.28); C(c, x, H * 0.36, H * 0.07); }); }
      soft(c, () => { C(c, -W * 0.45, -H * 0.25, H * 0.05); C(c, W * 0.45, -H * 0.25, H * 0.05); });
    });
  },
  iceMaker(c, w, d, it) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.06);
    R(c, -w * 0.38, -d * 0.1, w * 0.76, d * 0.5);
    soft(c, () => { for (let i = 0; i < 6; i++) RR(c, -w * 0.3 + (i % 3) * w * 0.22, d * 0.02 + Math.floor(i / 3) * d * 0.18, w * 0.14, d * 0.12, 1); });
    soft(c, () => R(c, -w * 0.38, -d * 0.4, w * 0.76, d * 0.2));
  },
  slicer(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.06);
    C(c, -w * 0.12, -d * 0.05, m * 0.32);
    soft(c, () => CS(c, -w * 0.12, -d * 0.05, m * 0.08));
    RR(c, w * 0.12, -d * 0.3, w * 0.3, d * 0.55, m * 0.04);
  },

  // ===== Elektronika =====
  speaker(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'subwoofer')) { RR(c, -w / 2, -d / 2, w, d, m * 0.08); C(c, 0, 0, m * 0.36); soft(c, () => CS(c, 0, 0, m * 0.14)); return; }
    if (has(it, 'smart')) { C(c, 0, 0, m * 0.46); soft(c, () => { CS(c, 0, 0, m * 0.3); for (let i = 0; i < 6; i++) C(c, Math.cos((i * TAU) / 6) * m * 0.38, Math.sin((i * TAU) / 6) * m * 0.38, m * 0.02); }); return; }
    if (has(it, 'stack')) { RR(c, -w / 2, -d * 0.1, w, d * 0.6, m * 0.04); RR(c, -w * 0.45, -d / 2, w * 0.9, d * 0.36, m * 0.04); soft(c, () => { for (let i = 0; i < 5; i++) C(c, -w * 0.3 + i * w * 0.15, -d * 0.32, m * 0.04); }); P(c, -w * 0.35, d * 0.35, w * 0.35, d * 0.35, w * 0.45, d / 2, -w * 0.45, d / 2); return; }
    const by = d * 0.12;
    RR(c, -w * 0.36, -d / 2, w * 0.72, d * 0.62, m * 0.06);
    P(c, -w * 0.28, by, w * 0.28, by, w / 2, d / 2, -w / 2, d / 2);
    if (has(it, 'center', 'stage')) soft(c, () => { C(c, -w * 0.15, -d * 0.2, m * 0.08); C(c, w * 0.15, -d * 0.2, m * 0.08); });
  },
  soundbar(c, w, d) {
    alongX(c, w, d, (W, H) => {
      RR(c, -W / 2, -H / 2, W, H, H * 0.45);
      soft(c, () => { for (let x = -W / 2 + H; x < W / 2 - H * 0.6; x += Math.max(H * 0.8, 2)) C(c, x, 0, H * 0.12); });
    });
  },
  avBox(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'xbox', 'playstation')) {
      RR(c, -w * 0.45, -d / 2, w * 0.9, d * 0.55, m * 0.05);
      soft(c, () => { for (let x = -w * 0.35; x < w * 0.36; x += w * 0.08) L(c, x, -d / 2 + d * 0.08, x, -d / 2 + d * 0.3); });
      RR(c, -w * 0.25, d * 0.15, w * 0.5, d * 0.3, d * 0.14);
      soft(c, () => { C(c, -w * 0.13, d * 0.3, m * 0.05); C(c, w * 0.13, d * 0.3, m * 0.05); });
      return;
    }
    RR(c, -w / 2, -d / 2, w, d, m * 0.04);
    L(c, -w / 2, d / 2 - d * 0.12, w / 2, d / 2 - d * 0.12);
    if (has(it, 'receiver')) { C(c, -w * 0.3, d * 0.2, m * 0.1); C(c, w * 0.3, d * 0.2, m * 0.14); }
    else if (has(it, 'server')) soft(c, () => { for (let i = 1; i < 8; i++) L(c, -w * 0.4, -d / 2 + (i * d) / 8, w * 0.4, -d / 2 + (i * d) / 8); });
    else { tone(c, 0.6, () => R(c, -w * 0.3, d * 0.22, w * 0.4, d * 0.04)); soft(c, () => C(c, w * 0.32, d * 0.24, m * 0.04)); }
  },
  turntable(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.05);
    const cx = -w * 0.12, r = Math.min(w * 0.34, d * 0.42);
    C(c, cx, 0, r);
    soft(c, () => { CS(c, cx, 0, r * 0.72); CS(c, cx, 0, r * 0.4); });
    tone(c, 0.6, () => C(c, cx, 0, r * 0.08));
    C(c, w * 0.36, -d * 0.3, m * 0.06);
    L(c, w * 0.36, -d * 0.3, w * 0.32, d * 0.15, cx + r * 0.6, d * 0.12);
  },
  laptop(c, w, d) {
    const m = Math.min(w, d);
    tone(c, 0.55, () => RR(c, -w * 0.45, -d / 2, w * 0.9, d * 0.1, d * 0.04));
    RR(c, -w * 0.45, -d / 2 + d * 0.12, w * 0.9, d * 0.82, m * 0.05);
    soft(c, () => grid(c, -w * 0.38, -d / 2 + d * 0.2, w * 0.76, d * 0.38, 12, 4));
    R(c, -w * 0.14, d * 0.15, w * 0.28, d * 0.24);
  },
  monitor(c, w, d) {
    tone(c, 0.6, () => { c.beginPath(); c.ellipse(0, d * 0.9, w * 0.5, d * 1.1, 0, PI * 1.25, PI * 1.75); c.ellipse(0, d * 0.9, w * 0.5, d * 0.92, 0, PI * 1.75, PI * 1.25, true); c.closePath(); c.fill(); c.stroke(); });
    E(c, 0, d * 0.25, w * 0.15, d * 0.18);
    L(c, 0, -d * 0.12, 0, d * 0.12);
  },
  printer(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, '3d')) { RR(c, -w / 2, -d / 2, w, d, m * 0.04); R(c, -w * 0.36, -d * 0.36, w * 0.72, d * 0.72); soft(c, () => { L(c, -w * 0.4, -d * 0.05, w * 0.4, -d * 0.05); }); C(c, w * 0.05, -d * 0.05, m * 0.06); return; }
    RR(c, -w / 2, -d * 0.4, w, d * 0.8, m * 0.06);
    tone(c, 0.15, () => R(c, -w * 0.32, d * 0.4, w * 0.64, d * 0.1));
    R(c, -w * 0.32, d * 0.4, w * 0.64, d * 0.1);
    soft(c, () => { L(c, -w / 2, -d * 0.1, w / 2, -d * 0.1); R(c, w * 0.2, -d * 0.35, w * 0.22, d * 0.18); });
  },
  phone(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'speakerphone')) { P(c, 0, -d * 0.46, w * 0.46, d * 0.36, -w * 0.46, d * 0.36); tone(c, 0.6, () => { C(c, 0, -d * 0.2, m * 0.05); C(c, w * 0.22, d * 0.2, m * 0.05); C(c, -w * 0.22, d * 0.2, m * 0.05); }); return; }
    if (has(it, 'shredder')) { RR(c, -w / 2, -d / 2, w, d, m * 0.06); tone(c, 0.6, () => R(c, -w * 0.38, -d * 0.2, w * 0.76, d * 0.06)); soft(c, () => R(c, -w * 0.38, d * 0.02, w * 0.76, d * 0.36)); return; }
    RR(c, -w * 0.42, -d * 0.4, w * 0.84, d * 0.8, m * 0.1);
    RR(c, -w * 0.36, -d * 0.34, w * 0.22, d * 0.68, m * 0.08);
    soft(c, () => { for (let i = 0; i < 12; i++) C(c, w * 0.02 + (i % 3) * w * 0.12, -d * 0.24 + Math.floor(i / 3) * d * 0.15, m * 0.03); });
  },
  projector(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.12);
    C(c, w * 0.22, d * 0.14, m * 0.2);
    soft(c, () => { CS(c, w * 0.22, d * 0.14, m * 0.1); for (let x = -w * 0.38; x < -w * 0.05; x += w * 0.06) L(c, x, -d * 0.3, x, d * 0.3); });
  },

  // ===== Mājsaimniecība =====
  vacuum(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'robot')) { C(c, 0, 0, m * 0.46); eband(c, 0, 0, m * 0.46, m * 0.46, m * 0.08, PI * 1.15, PI * 1.85); soft(c, () => { CS(c, 0, m * 0.1, m * 0.12); C(c, 0, -m * 0.18, m * 0.04); }); return; }
    if (has(it, 'upright')) { RR(c, -w * 0.4, d * 0.2, w * 0.8, d * 0.24, m * 0.06); RR(c, -w * 0.15, -d * 0.3, w * 0.3, d * 0.5, m * 0.1); L(c, 0, -d * 0.3, 0, -d * 0.46); L(c, -w * 0.1, -d * 0.46, w * 0.1, -d * 0.46); return; }
    E(c, -w * 0.15, -d * 0.1, w * 0.28, d * 0.3);
    soft(c, () => { c.beginPath(); c.moveTo(w * 0.1, -d * 0.1); c.quadraticCurveTo(w * 0.4, -d * 0.3, w * 0.3, d * 0.2); c.stroke(); });
    RR(c, w * 0.12, d * 0.24, w * 0.36, d * 0.14, m * 0.04);
  },
  ironingBoard(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      c.beginPath(); c.moveTo(-W / 2 + H * 0.2, -H / 2); c.lineTo(W * 0.25, -H / 2); c.quadraticCurveTo(W / 2, -H / 2, W / 2, 0); c.quadraticCurveTo(W / 2, H / 2, W * 0.25, H / 2); c.lineTo(-W / 2 + H * 0.2, H / 2); c.quadraticCurveTo(-W / 2, H / 2, -W / 2, 0); c.quadraticCurveTo(-W / 2, -H / 2, -W / 2 + H * 0.2, -H / 2); c.closePath(); c.fill(); c.stroke();
      soft(c, () => { dash(c, du(W, H), () => { L(c, -W * 0.3, -H / 2, W * 0.2, H / 2); L(c, W * 0.2, -H / 2, -W * 0.3, H / 2); }); });
      tone(c, 0.3, () => R(c, -W / 2 + H * 0.15, -H * 0.3, W * 0.1, H * 0.6));
    });
  },
  garmentSteamer(c, w, d) {
    const m = Math.min(w, d);
    C(c, 0, d * 0.15, m * 0.28);
    soft(c, () => CS(c, 0, d * 0.15, m * 0.16));
    RR(c, -w * 0.42, -d * 0.3, w * 0.84, d * 0.1, d * 0.05);
    L(c, 0, -d * 0.2, 0, d * 0.15 - m * 0.28);
  },
  dryingRack(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const wall = has(it, 'wall');
      if (wall) dash(c, du(W, H), () => R(c, -W / 2, -H / 2, W, H)); else R(c, -W / 2, -H / 2, W, H);
      soft(c, () => { const n = cl(Math.round(H / 4), 3, 20); for (let i = 1; i < n; i++) L(c, -W / 2, -H / 2 + (i * H) / n, W / 2, -H / 2 + (i * H) / n); });
      if (!wall) { L(c, -W * 0.25, -H / 2, -W * 0.25, H / 2); L(c, W * 0.25, -H / 2, W * 0.25, H / 2); }
    });
  },
  purifier(c, w, d, it) {
    const m = Math.min(w, d);
    if (up(it)) dash(c, du(w, d), () => RR(c, -w / 2, -d / 2, w, d, m * 0.2)); else RR(c, -w / 2, -d / 2, w, d, m * 0.2);
    C(c, 0, 0, m * 0.32);
    soft(c, () => { CS(c, 0, 0, m * 0.22); CS(c, 0, 0, m * 0.12); });
    if (has(it, 'humidifier')) tone(c, 0.4, () => C(c, 0, 0, m * 0.06));
  },
  sewingMachine(c, w, d) {
    const m = Math.min(w, d);
    R(c, -w / 2, -d / 2, w, d);
    const sw = w * 0.5, sd = d * 0.32;
    P(c, -sw / 2, -sd / 2, sw / 2, -sd / 2, sw / 2, sd / 2, sw * 0.3, sd / 2, sw * 0.3, 0, -sw / 2, 0);
    soft(c, () => { R(c, -sw / 2, -sd / 2, sw, sd); C(c, sw * 0.4, -sd * 0.6, m * 0.03); });
    soft(c, () => C(c, 0, d * 0.32, m * 0.14));
  },
  heater(c, w, d, it) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.1);
    if (has(it, 'industrial')) { C(c, 0, 0, m * 0.38); for (let i = 0; i < 4; i++) { c.save(); c.rotate((i * PI) / 2); E(c, m * 0.18, 0, m * 0.15, m * 0.06); c.restore(); } return; }
    soft(c, () => { for (let x = -w / 2 + 4; x < w / 2 - 2; x += 4) L(c, x, -d * 0.35, x, d * 0.35); });
    C(c, w * 0.38, d * 0.3, m * 0.07);
  },

  // ===== Dekors =====
  plant(c, w, d, it) {
    const m = Math.min(w, d);
    if (w > d * 1.8 || d > w * 1.8) {
      alongX(c, w, d, (W, H) => {
        RR(c, -W / 2, -H / 2, W, H, H * 0.2);
        const n = cl(Math.round(W / (H * 0.9)), 1, 20), s = W / n;
        for (let i = 0; i < n; i++) leaves(c, -W / 2 + (i + 0.5) * s, 0, Math.min(s, H) * 0.5, 5);
      });
      return;
    }
    const r = m / 2;
    soft(c, () => C(c, 0, 0, r * 0.45));
    if (has(it, 'cactus')) { C(c, 0, 0, r * 0.38); C(c, r * 0.36, -r * 0.2, r * 0.16); C(c, -r * 0.32, r * 0.18, r * 0.14); soft(c, () => { for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; L(c, Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38, Math.cos(a) * r * 0.48, Math.sin(a) * r * 0.48); } }); return; }
    if (has(it, 'bonsai')) { E(c, -r * 0.3, -r * 0.2, r * 0.35, r * 0.22); E(c, r * 0.3, r * 0.05, r * 0.32, r * 0.2); E(c, -r * 0.05, r * 0.32, r * 0.28, r * 0.16); return; }
    const narrow = has(it, 'bamboo', 'yucca', 'dypsis', 'dragon', 'strelitzia');
    leaves(c, 0, 0, r, narrow ? 9 : 7, narrow);
    if (has(it, 'citrus')) tone(c, 0.5, () => { for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5 + 0.4; C(c, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.08); } });
  },
  xmasTree(c, w, d) {
    const r = Math.min(w, d) / 2;
    for (const [k, rot] of [[1, 0], [0.72, PI / 8], [0.46, 0]]) {
      c.beginPath();
      for (let i = 0; i < 16; i++) { const a = rot + (i * TAU) / 16, rr = r * k * (i % 2 ? 0.8 : 1); c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); }
      c.closePath(); c.fill(); c.stroke();
    }
    tone(c, 0.7, () => { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -PI / 2 + (i * PI) / 5, rr = r * (i % 2 ? 0.07 : 0.17); c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill(); });
  },
  blinds(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      if (has(it, 'roller')) { RR(c, -W / 2, -H * 0.3, W, H * 0.6, H * 0.3); tone(c, 0.5, () => { R(c, -W / 2, -H / 2, H * 0.5, H); R(c, W / 2 - H * 0.5, -H / 2, H * 0.5, H); }); return; }
      if (has(it, 'roman')) { c.beginPath(); c.moveTo(-W / 2, 0); const n = cl(Math.round(W / 12), 2, 40); for (let i = 1; i <= n; i++) c.lineTo(-W / 2 + (i * W) / n, i % 2 ? -H * 0.4 : H * 0.4); c.stroke(); R(c, -W / 2, -H / 2, W, H * 0.15); return; }
      if (has(it, 'japanese')) { const n = has(it, '6_panels') ? 6 : 4, s = W / n; for (let i = 0; i < n; i++) R(c, -W / 2 + i * s - (i ? s * 0.08 : 0), -H / 2 + (i % 3) * (H / 3), s * 1.08, H / 3); return; }
      R(c, -W / 2, -H / 2, W, H * 0.2);
      if (has(it, 'vertical')) soft(c, () => { for (let x = -W / 2 + 4; x < W / 2; x += 7) L(c, x - 2.5, H * 0.45, x + 2.5, -H * 0.15); }, 0.8);
      else soft(c, () => { L(c, -W / 2, H * 0.2, W / 2, H * 0.2); for (let x = -W / 2 + 2; x < W / 2; x += 3) L(c, x, -H * 0.3, x, H * 0.45); });
    });
  },
  clock(c, w, d) {
    const r = Math.min(w, d) / 2;
    C(c, 0, 0, r);
    soft(c, () => { for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; L(c, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, Math.cos(a) * r * 0.92, Math.sin(a) * r * 0.92); } });
    L(c, 0, 0, 0, -r * 0.6); L(c, 0, 0, r * 0.4, r * 0.15);
  },
  aquarium(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'round')) { C(c, 0, 0, m * 0.46); soft(c, () => CS(c, 0, 0, m * 0.38)); fish(c, 0, 0, m * 0.18); return; }
    if (has(it, 'table')) { RR(c, -w / 2, -d / 2, w, d, m * 0.04); }
    R(c, -w / 2 + m * 0.05, -d / 2 + m * 0.05, w - m * 0.1, d - m * 0.1);
    soft(c, () => R(c, -w / 2 + m * 0.1, -d / 2 + m * 0.1, w - m * 0.2, d - m * 0.2));
    if (has(it, 'terrarium')) { soft(c, () => { C(c, -w * 0.2, d * 0.1, m * 0.12); C(c, w * 0.05, d * 0.15, m * 0.08); leaves(c, w * 0.22, -d * 0.1, m * 0.2, 5); }); return; }
    fish(c, -w * 0.12, -d * 0.05, m * 0.16);
    fish(c, w * 0.18, d * 0.12, m * 0.11);
  },
  cage(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'round')) { C(c, 0, 0, m * 0.46); soft(c, () => { for (let i = 0; i < 16; i++) { const a = (i * TAU) / 16; L(c, Math.cos(a) * m * 0.1, Math.sin(a) * m * 0.1, Math.cos(a) * m * 0.46, Math.sin(a) * m * 0.46); } }); C(c, 0, 0, m * 0.1); return; }
    RR(c, -w / 2, -d / 2, w, d, m * 0.04);
    soft(c, () => { const s = cl(m * 0.12, 2, 5); for (let x = -w / 2 + s; x < w / 2; x += s) L(c, x, -d / 2, x, d / 2); });
    L(c, -w * 0.3, -d * 0.1, w * 0.3, -d * 0.1);
    if (has(it, 'rodent', 'hospital')) tone(c, 0.2, () => RR(c, w * 0.1, d * 0.05, w * 0.3, d * 0.3, m * 0.04));
  },
  catHouse(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.05);
    R(c, -w * 0.45, -d * 0.4, w * 0.5, d * 0.7);
    tone(c, 0.35, () => E(c, -w * 0.2, d * 0.3, w * 0.1, d * 0.06));
    C(c, w * 0.25, -d * 0.15, m * 0.18);
    soft(c, () => { CS(c, w * 0.25, -d * 0.15, m * 0.12); CS(c, w * 0.25, -d * 0.15, m * 0.06); });
  },
  litterBox(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.12);
    tone(c, 0.15, () => RR(c, -w / 2 + m * 0.1, -d / 2 + m * 0.1, w - m * 0.2, d - m * 0.2, m * 0.08));
    soft(c, () => { for (let i = 0; i < 9; i++) C(c, -w * 0.25 + (i % 3) * w * 0.25, -d * 0.2 + Math.floor(i / 3) * d * 0.2, m * 0.02); });
  },
  feeder(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'perch')) { C(c, 0, d * 0.25, m * 0.2); L(c, 0, d * 0.25, 0, -d * 0.2); RR(c, -w * 0.45, -d * 0.26, w * 0.9, d * 0.1, d * 0.05); C(c, -w * 0.38, -d * 0.36, m * 0.08); C(c, w * 0.38, -d * 0.36, m * 0.08); return; }
    RR(c, -w / 2, -d / 2, w, d, m * 0.2);
    C(c, -w * 0.22, 0, m * 0.32); C(c, w * 0.22, 0, m * 0.32);
    soft(c, () => { CS(c, -w * 0.22, 0, m * 0.2); CS(c, w * 0.22, 0, m * 0.2); });
  },
  trophy(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'stuffed')) {
      E(c, 0, d * 0.05, w * 0.36, d * 0.36);
      C(c, 0, -d * 0.3, m * 0.17);
      C(c, -m * 0.13, -d * 0.42, m * 0.06); C(c, m * 0.13, -d * 0.42, m * 0.06);
      for (const sx of [-1, 1]) for (const sy of [-0.15, 0.32]) E(c, sx * w * 0.36, d * sy, m * 0.08, m * 0.06);
      return;
    }
    E(c, 0, -d * 0.3, w * 0.3, d * 0.18);
    E(c, 0, d * 0.05, w * 0.16, d * 0.32);
    if (has(it, 'deer')) { for (const s of [-1, 1]) { L(c, s * w * 0.08, -d * 0.1, s * w * 0.42, -d * 0.4); L(c, s * w * 0.22, -d * 0.22, s * w * 0.3, -d * 0.02); L(c, s * w * 0.33, -d * 0.32, s * w * 0.46, -d * 0.18); } }
    else if (has(it, 'goat')) { for (const s of [-1, 1]) { c.beginPath(); c.moveTo(s * w * 0.06, -d * 0.12); c.quadraticCurveTo(s * w * 0.4, -d * 0.3, s * w * 0.3, d * 0.2); c.stroke(); } }
    else { C(c, -w * 0.16, -d * 0.12, m * 0.07); C(c, w * 0.16, -d * 0.12, m * 0.07); if (has(it, 'boar')) { L(c, -w * 0.08, d * 0.3, -w * 0.18, d * 0.2); L(c, w * 0.08, d * 0.3, w * 0.18, d * 0.2); } }
  },
  screen(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const n = cl(Math.round(W / 25), 3, 10), s = W / n, t = cl(H * 0.06, 0.8, 2.5), A = Math.min(H / 2 - t, s * 0.35);
      c.beginPath(); c.moveTo(-W / 2, A);
      for (let i = 1; i <= n; i++) c.lineTo(-W / 2 + i * s, i % 2 ? -A : A);
      c.lineWidth *= 2.4; c.stroke(); c.lineWidth /= 2.4;
      for (let i = 0; i <= n; i++) tone(c, 0.6, () => C(c, -W / 2 + i * s, i % 2 ? -A : A, t * 0.8));
    });
  },
  partition(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const t = cl(H * 0.5, 1, 8);
      R(c, -W / 2, -t / 2, W, t);
      if (has(it, 'glass')) soft(c, () => { for (let x = -W / 2 + 6; x < W / 2; x += 12) L(c, x, t / 2, x + t, -t / 2); });
      else tone(c, 0.35, () => R(c, -W / 2, -t / 2, W, t));
      for (const sx of [-1, 1]) tone(c, 0.6, () => R(c, sx * (W / 2 - t * 0.3) - t * 0.3, -Math.min(H, 40) / 2, t * 0.6, Math.min(H, 40)));
    });
  },
  board(c, w, d, it) {
    if (has(it, 'flip', 'easel')) {
      const m = Math.min(w, d);
      soft(c, () => tripod(c, m * 0.46));
      RR(c, -w * 0.42, -d * 0.36, w * 0.84, d * 0.12, 1);
      if (has(it, 'flip')) tone(c, 0.3, () => R(c, -w * 0.38, -d * 0.24, w * 0.76, d * 0.04));
      return;
    }
    alongX(c, w, d, (W, H) => {
      const t = Math.min(H * 0.5, 4);
      tone(c, has(it, 'chalk') ? 0.6 : 0.12, () => R(c, -W / 2, -H / 2, W, t));
      R(c, -W / 2, -H / 2, W, t);
      RR(c, -W * 0.4, -H / 2 + t, W * 0.8, Math.min(H * 0.3, t * 0.8), 0.5);
    });
  },
  globeBar(c, w, d) {
    const r = Math.min(w, d) / 2;
    soft(c, () => CS(c, 0, 0, r));
    C(c, 0, 0, r * 0.82);
    soft(c, () => { ES(c, 0, 0, r * 0.82, r * 0.35); ES(c, 0, 0, r * 0.35, r * 0.82); L(c, -r * 0.82, 0, r * 0.82, 0); });
    tone(c, 0.6, () => C(c, 0, 0, r * 0.06));
  },
  arcade(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.04);
    tone(c, 0.55, () => P(c, -w * 0.38, -d * 0.4, w * 0.38, -d * 0.4, w * 0.32, d * 0.05, -w * 0.32, d * 0.05));
    R(c, -w / 2, d * 0.15, w, d * 0.35);
    C(c, -w * 0.22, d * 0.32, m * 0.08);
    for (let i = 0; i < 3; i++) C(c, w * 0.05 + i * w * 0.12, d * 0.32, m * 0.04);
  },
  hookah(c, w, d) {
    const m = Math.min(w, d);
    C(c, 0, 0, m * 0.3);
    soft(c, () => CS(c, 0, 0, m * 0.14));
    tone(c, 0.5, () => C(c, 0, 0, m * 0.06));
    c.beginPath(); c.moveTo(m * 0.28, 0); c.quadraticCurveTo(w * 0.5, -d * 0.4, w * 0.2, -d * 0.45); c.stroke();
    c.beginPath(); c.moveTo(-m * 0.28, 0); c.quadraticCurveTo(-w * 0.5, d * 0.4, -w * 0.2, d * 0.45); c.stroke();
  },
  telescope(c, w, d) {
    const m = Math.min(w, d);
    soft(c, () => tripod(c, m * 0.46));
    c.save(); c.rotate(-PI / 5);
    RR(c, -m * 0.42, -m * 0.08, m * 0.84, m * 0.16, m * 0.04);
    R(c, m * 0.3, -m * 0.1, m * 0.12, m * 0.2);
    c.restore();
  },
  floorlamp(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'arched')) { C(c, -w * 0.35, d * 0.3, m * 0.14); c.beginPath(); c.moveTo(-w * 0.35, d * 0.3); c.quadraticCurveTo(-w * 0.3, -d * 0.45, w * 0.25, -d * 0.2); c.stroke(); C(c, w * 0.25, -d * 0.2, m * 0.2); soft(c, () => CS(c, w * 0.25, -d * 0.2, m * 0.08)); return; }
    C(c, 0, 0, m / 2);
    soft(c, () => { CS(c, 0, 0, m * 0.3); L(c, -m * 0.35, -m * 0.35, m * 0.35, m * 0.35); L(c, m * 0.35, -m * 0.35, -m * 0.35, m * 0.35); });
    C(c, 0, 0, m * 0.1);
  },
  mannequin(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'wheelchair')) { D.wheelchair(c, w, d); C(c, 0, -d * 0.05, m * 0.12); return; }
    if (has(it, 'dress_form')) { soft(c, () => tripod(c, m * 0.46)); E(c, 0, 0, w * 0.36, d * 0.26); return; }
    if (has(it, 'lying', 'reclining')) {
      alongX(c, w, d, (W, H) => { C(c, -W * 0.38, 0, H * 0.18); E(c, -W * 0.1, 0, W * 0.2, H * 0.32); E(c, W * 0.25, -H * 0.12, W * 0.2, H * 0.1); E(c, W * 0.25, H * 0.12, W * 0.2, H * 0.1); });
      return;
    }
    E(c, 0, 0, w * 0.46, d * 0.3);
    if (has(it, 'sitting')) { E(c, -w * 0.15, d * 0.3, w * 0.1, d * 0.18); E(c, w * 0.15, d * 0.3, w * 0.1, d * 0.18); }
    C(c, 0, 0, m * 0.2);
  },
  wheelchair(c, w, d) {
    const m = Math.min(w, d);
    for (const sx of [-1, 1]) wheel(c, sx * w * 0.44, -d * 0.05, w * 0.1, d * 0.6);
    RR(c, -w * 0.34, -d * 0.3, w * 0.68, d * 0.55, m * 0.04);
    R(c, -w * 0.34, -d * 0.42, w * 0.68, d * 0.1);
    soft(c, () => { L(c, -w * 0.2, d * 0.25, -w * 0.2, d * 0.45); L(c, w * 0.2, d * 0.25, w * 0.2, d * 0.45); R(c, -w * 0.3, d * 0.4, w * 0.6, d * 0.08); });
  },

  // ===== Mūzika un foto =====
  piano(c, w, d, it) {
    const grand = d > w * 0.9 && !has(it, 'banquette');
    const kb = grand ? cl(d * 0.12, 3, 22) : cl(d * 0.38, 3, 25);
    if (grand) {
      c.beginPath(); c.moveTo(-w / 2, d / 2); c.lineTo(w / 2, d / 2); c.lineTo(w / 2, d * 0.12);
      c.bezierCurveTo(w / 2, -d * 0.12, -w * 0.05, -d * 0.1, -w * 0.12, -d / 2);
      c.lineTo(-w / 2, -d / 2); c.closePath(); c.fill(); c.stroke();
      soft(c, () => L(c, -w * 0.4, d / 2 - kb, w * 0.2, -d * 0.2));
    } else RR(c, -w / 2, -d / 2, w, d, Math.min(w, d) * 0.04);
    const y0 = d / 2 - kb;
    R(c, -w / 2 + w * 0.02, y0, w * 0.96, kb);
    soft(c, () => { const n = cl(Math.round(w / 2.4), 8, 60); for (let i = 1; i < n; i++) L(c, -w / 2 + w * 0.02 + (i * w * 0.96) / n, y0, -w / 2 + w * 0.02 + (i * w * 0.96) / n, d / 2); });
    tone(c, 0.55, () => { const n = cl(Math.round(w / 2.4), 8, 60), s = (w * 0.96) / n; c.beginPath(); for (let i = 0; i < n - 1; i++) if ([0, 1, 3, 4, 5].includes(i % 7)) c.rect(-w / 2 + w * 0.02 + (i + 0.65) * s, y0, s * 0.7, kb * 0.6); c.fill(); });
  },
  guitar(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const big = has(it, 'double_bass', 'cello'), m = Math.min(W, H);
      if (has(it, 'harp')) { P(c, -W * 0.45, H * 0.4, W * 0.45, H * 0.4, -W * 0.3, -H * 0.4); soft(c, () => { for (let i = 1; i < 8; i++) L(c, -W * 0.45 + (i * W * 0.9) / 8, H * 0.4, -W * 0.3 + (i * W * 0.15) / 8 * 0, H * 0.4 - (i / 8) * H * 0.8); }); return; }
      if (has(it, 'rack')) soft(c, () => dash(c, du(W, H), () => R(c, -W / 2, -H / 2, W, H)));
      const r1 = Math.min(H * 0.42, W * 0.16), r2 = r1 * 0.75;
      const x1 = -W / 2 + r1 * 1.1;
      C(c, x1, 0, r1);
      C(c, x1 + r1 * 1.25, 0, r2);
      c.beginPath(); c.arc(x1, 0, pos(r1 * 0.98), 0, TAU); c.fill();
      soft(c, () => CS(c, x1 + r1 * 0.75, 0, r2 * 0.35));
      R(c, x1 + r1 * 1.25 + r2 * 0.8, -m * 0.05, W / 2 - (x1 + r1 * 1.25 + r2 * 0.8) - W * 0.08, m * 0.1);
      RR(c, W / 2 - W * 0.09, -m * 0.08, W * 0.08, m * 0.16, 1);
      if (big) soft(c, () => L(c, -W / 2, 0, x1 - r1, 0));
    });
  },
  drums(c, w, d, it) {
    const m = Math.min(w, d);
    RR(c, -w * 0.16, -d * 0.12, w * 0.32, d * 0.26, m * 0.04);
    C(c, -w * 0.28, d * 0.12, m * 0.12);
    C(c, -w * 0.08, -d * 0.3, m * 0.1); C(c, w * 0.12, -d * 0.3, m * 0.1);
    C(c, w * 0.3, d * 0.1, m * 0.14);
    soft(c, () => { CS(c, -w * 0.4, -d * 0.3, m * 0.13); CS(c, w * 0.38, -d * 0.32, m * 0.15); CS(c, -w * 0.42, d * 0.2, m * 0.1); });
    C(c, 0, d * 0.38, m * 0.1);
  },
  mixer(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.04);
    const n = cl(Math.round(w / 5), 4, 40), s = w * 0.9 / n;
    soft(c, () => { for (let i = 0; i < n; i++) { const x = -w * 0.45 + (i + 0.5) * s; for (let j = 0; j < 3; j++) C(c, x, -d * 0.35 + j * d * 0.12, Math.min(s * 0.3, 1.2)); L(c, x, d * 0.05, x, d * 0.4); } });
    tone(c, 0.5, () => { for (let i = 0; i < n; i++) R(c, -w * 0.45 + (i + 0.3) * s, d * 0.1 + ((i * 7) % 5) * d * 0.05, s * 0.4, d * 0.05); });
  },
  standGear(c, w, d, it) {
    const m = Math.min(w, d);
    soft(c, () => tripod(c, m * 0.46));
    if (has(it, 'mispiter')) { RR(c, -w * 0.42, -d * 0.3, w * 0.84, d * 0.12, 1); return; }
    if (has(it, 'microphone')) { L(c, 0, 0, w * 0.35, -d * 0.35); C(c, w * 0.35, -d * 0.35, m * 0.06); return; }
    if (has(it, 'camera')) { RR(c, -m * 0.16, -m * 0.12, m * 0.32, m * 0.2, m * 0.03); R(c, -m * 0.06, -m * 0.26, m * 0.12, m * 0.14); return; }
    if (has(it, 'softbox')) { P(c, -w * 0.42, -d * 0.4, w * 0.42, -d * 0.4, w * 0.12, -d * 0.05, -w * 0.12, -d * 0.05); return; }
    if (has(it, 'umbrella')) { c.beginPath(); c.arc(0, d * 0.05, pos(m * 0.45), PI * 1.1, PI * 1.9); c.closePath(); c.fill(); c.stroke(); soft(c, () => { for (let i = 0; i < 5; i++) { const a = PI * 1.1 + (i + 0.5) * PI * 0.16; L(c, 0, d * 0.05, Math.cos(a) * m * 0.45, d * 0.05 + Math.sin(a) * m * 0.45); } }); return; }
    if (has(it, 'reflector')) { E(c, 0, -d * 0.2, w * 0.4, d * 0.1); return; }
    P(c, -m * 0.12, 0, m * 0.12, 0, m * 0.22, -m * 0.35, -m * 0.22, -m * 0.35);
  },
  backdrop(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const rr = Math.min(H * 0.15, 6);
      RR(c, -W / 2 + rr * 2, -rr, W - rr * 4, rr * 2, rr);
      for (const sx of [-1, 1]) C(c, sx * (W / 2 - rr * 2), 0, rr * 1.6);
      soft(c, () => dash(c, du(W, H), () => L(c, -W / 2 + H, H * 0.4, W / 2 - H, H * 0.4)));
    });
  },

  // ===== Sports =====
  treadmill(c, w, d) {
    alongY(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      RR(c, -W / 2, -H / 2 + H * 0.16, W, H * 0.84, m * 0.06);
      tone(c, 0.18, () => R(c, -W * 0.36, -H / 2 + H * 0.2, W * 0.72, H * 0.74));
      soft(c, () => { for (let y = -H / 2 + H * 0.24; y < H / 2 - 2; y += Math.max(H * 0.06, 3)) L(c, -W * 0.36, y, W * 0.36, y); });
      RR(c, -W / 2, -H / 2, W, H * 0.12, m * 0.05);
      L(c, -W * 0.46, -H / 2 + H * 0.1, -W * 0.46, -H / 2 + H * 0.35);
      L(c, W * 0.46, -H / 2 + H * 0.1, W * 0.46, -H / 2 + H * 0.35);
    });
  },
  exerciseBike(c, w, d) {
    alongY(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      RR(c, -W * 0.4, -H / 2, W * 0.8, H * 0.06, 1); RR(c, -W * 0.4, H / 2 - H * 0.06, W * 0.8, H * 0.06, 1);
      L(c, 0, -H / 2 + H * 0.03, 0, H / 2 - H * 0.03);
      RR(c, -W * 0.08, -H * 0.38, W * 0.16, H * 0.22, W * 0.06);
      RR(c, -W * 0.38, -H * 0.42, W * 0.76, H * 0.05, 1);
      E(c, 0, H * 0.2, W * 0.12, H * 0.08);
      for (const s of [-1, 1]) RR(c, s * W * 0.2 - W * 0.05, -H * 0.05, W * 0.1, H * 0.1, 1);
    });
  },
  rowingMachine(c, w, d) {
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      R(c, -W * 0.3, -H * 0.06, W * 0.78, H * 0.12);
      C(c, -W * 0.38, 0, H * 0.3);
      soft(c, () => CS(c, -W * 0.38, 0, H * 0.16));
      for (const s of [-1, 1]) RR(c, -W * 0.22, s * H * 0.22 - H * 0.1, W * 0.1, H * 0.2, 1);
      RR(c, W * 0.05, -H * 0.18, W * 0.14, H * 0.36, m * 0.08);
      L(c, -W * 0.3, -H * 0.4, -W * 0.3, H * 0.4);
      RR(c, W * 0.44, -H * 0.4, W * 0.04, H * 0.8, 1);
    });
  },
  elliptical(c, w, d) {
    alongY(c, w, d, (W, H) => {
      R(c, -W * 0.3, -H / 2 + H * 0.1, W * 0.6, H * 0.06);
      for (const s of [-1, 1]) { RR(c, s * W * 0.2 - W * 0.07, -H * 0.1, W * 0.14, H * 0.5, 1); L(c, s * W * 0.2, -H * 0.1, s * W * 0.35, -H / 2 + H * 0.05); }
      C(c, 0, -H / 2 + H * 0.2, Math.min(W, H) * 0.14);
      R(c, -W * 0.08, H * 0.38, W * 0.16, H * 0.12);
    });
  },
  stairClimber(c, w, d) {
    alongY(c, w, d, (W, H) => {
      RR(c, -W / 2, -H / 2 + H * 0.2, W, H * 0.8, Math.min(W, H) * 0.05);
      soft(c, () => { for (let y = -H / 2 + H * 0.3; y < H / 2; y += H * 0.1) L(c, -W * 0.4, y, W * 0.4, y); });
      RR(c, -W / 2, -H / 2, W, H * 0.12, 1);
      for (const s of [-1, 1]) L(c, s * W * 0.46, -H / 2 + H * 0.12, s * W * 0.46, H * 0.2);
    });
  },
  multiGym(c, w, d, it) {
    const m = Math.min(w, d), p = cl(m * 0.07, 2, 8);
    const post = (x, y) => tone(c, 0.65, () => R(c, x - p / 2, y - p / 2, p, p));
    const stack = (x, y, sw, sh) => { R(c, x - sw / 2, y - sh / 2, sw, sh); soft(c, () => { for (let i = 1; i < 6; i++) L(c, x - sw / 2, y - sh / 2 + (i * sh) / 6, x + sw / 2, y - sh / 2 + (i * sh) / 6); }); };
    soft(c, () => R(c, -w / 2, -d / 2, w, d), 0.6);
    if (has(it, 'crossover')) { for (const s of [-1, 1]) { stack(s * w * 0.4, -d * 0.2, w * 0.14, d * 0.35); post(s * w * 0.44, d * 0.3); } soft(c, () => L(c, -w * 0.44, -d * 0.4, w * 0.44, -d * 0.4)); dash(c, du(w, d), () => { L(c, -w * 0.4, 0, 0, d * 0.25); L(c, w * 0.4, 0, 0, d * 0.25); }); return; }
    if (has(it, 'leg_press')) { RR(c, -w * 0.15, d * 0.05, w * 0.3, d * 0.4, m * 0.05); P(c, -w * 0.2, -d * 0.1, w * 0.2, -d * 0.1, w * 0.25, -d * 0.4, -w * 0.25, -d * 0.4); soft(c, () => { L(c, -w * 0.4, d * 0.45, -w * 0.3, -d * 0.45); L(c, w * 0.4, d * 0.45, w * 0.3, -d * 0.45); }); return; }
    if (has(it, 'pull_up_dip')) { for (const [x, y] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) post(x * w, y * d); L(c, -w * 0.4, -d * 0.4, w * 0.4, -d * 0.4); for (const s of [-1, 1]) RR(c, s * w * 0.15 - w * 0.03, -d * 0.1, w * 0.06, d * 0.4, 1); return; }
    for (const [x, y] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) post(x * w, y * d);
    if (has(it, 'smith')) { L(c, -w * 0.48, -d * 0.1, w * 0.48, -d * 0.1); for (const s of [-1, 1]) R(c, s * w * 0.36 - w * 0.02, -d * 0.1 - d * 0.1, w * 0.04, d * 0.2); }
    stack(0, -d * 0.36, w * 0.24, d * 0.18);
    RR(c, -w * 0.1, -d * 0.05, w * 0.2, d * 0.45, m * 0.05);
  },
  weightBench(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      RR(c, -W * 0.45, -H * 0.15, W * 0.9, H * 0.3, m * 0.08);
      L(c, -W * 0.1, -H * 0.15, -W * 0.1, H * 0.15);
      if (has(it, 'press') || W > H * 2.2) {
        for (const s of [-1, 1]) tone(c, 0.6, () => R(c, -W * 0.36, s * H * 0.3 - 1.5, 3, 3));
        L(c, -W * 0.34, -H / 2, -W * 0.34, H / 2);
        for (const s of [-1, 1]) R(c, -W * 0.34 - W * 0.025, s * H * 0.44 - H * 0.06, W * 0.05, H * 0.12);
      }
    });
  },
  boxingBag(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'dummy')) { C(c, 0, 0, m * 0.32); C(c, 0, 0, m * 0.16); soft(c, () => CS(c, 0, 0, m * 0.48)); return; }
    C(c, 0, 0, m * 0.46);
    soft(c, () => { CS(c, 0, 0, m * 0.3); L(c, -m * 0.2, 0, m * 0.2, 0); L(c, 0, -m * 0.2, 0, m * 0.2); });
    tone(c, 0.6, () => C(c, 0, 0, m * 0.06));
  },
  boxingRing(c, w, d) {
    const m = Math.min(w, d), p = m * 0.04;
    R(c, -w / 2, -d / 2, w, d);
    for (let i = 1; i <= 3; i++) soft(c, () => R(c, -w / 2 + p * i * 0.6, -d / 2 + p * i * 0.6, w - p * i * 1.2, d - p * i * 1.2), 0.7);
    tone(c, 0.65, () => { for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(c, sx * (w / 2 - p), sy * (d / 2 - p), p * 0.9); });
  },
  ball(c, w, d, it) {
    const r = Math.min(w, d) / 2;
    C(c, 0, 0, r);
    if (has(it, 'soccer')) { c.beginPath(); for (let i = 0; i < 5; i++) { const a = -PI / 2 + (i * TAU) / 5; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35); } c.closePath(); tone(c, 0.7, () => c.fill()); for (let i = 0; i < 5; i++) { const a = -PI / 2 + (i * TAU) / 5; L(c, Math.cos(a) * r * 0.35, Math.sin(a) * r * 0.35, Math.cos(a) * r, Math.sin(a) * r); } }
    else if (has(it, 'basketball')) { L(c, -r, 0, r, 0); L(c, 0, -r, 0, r); ES(c, -r * 1.1, 0, r * 0.7, r * 0.8, -PI * 0.35, PI * 0.35); ES(c, r * 1.1, 0, r * 0.7, r * 0.8, PI * 0.65, PI * 1.35); }
    else soft(c, () => { c.beginPath(); c.arc(-r * 0.15, -r * 0.15, r * 0.55, PI * 1.05, PI * 1.55); c.stroke(); });
  },
  trampoline(c, w, d) {
    const r = Math.min(w, d) / 2;
    C(c, 0, 0, r);
    tone(c, 0.2, () => C(c, 0, 0, r * 0.78));
    soft(c, () => { for (let i = 0; i < 24; i++) { const a = (i * TAU) / 24; L(c, Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95); } });
  },
  pole(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'mats')) { RR(c, -w / 2, -d / 2, w, d, m * 0.06); soft(c, () => { L(c, -w / 6, -d / 2, -w / 6, d / 2); L(c, w / 6, -d / 2, w / 6, d / 2); }); return; }
    if (has(it, 'stage')) { C(c, 0, 0, m * 0.48); soft(c, () => CS(c, 0, 0, m * 0.38)); }
    tone(c, 0.7, () => C(c, 0, 0, Math.min(m * 0.12, 3)));
    CS(c, 0, 0, Math.min(m * 0.25, 8));
  },
  barre(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      if (has(it, 'stall')) { R(c, -W / 2, -H / 2, W, H * 0.3); soft(c, () => { for (let x = -W / 2 + 6; x < W / 2; x += 9) L(c, x, -H / 2, x, -H / 2 + H * 0.3); }); L(c, -W / 2, H * 0.2, W / 2, H * 0.2); return; }
      const y = has(it, 'wall') ? H * 0.2 : 0;
      c.lineWidth *= 2; L(c, -W / 2 + 2, y, W / 2 - 2, y); c.lineWidth /= 2;
      for (const x of [-W * 0.4, 0, W * 0.4]) { if (has(it, 'wall', 'pull_up')) L(c, x, y, x, -H / 2); else C(c, x, y, H * 0.12); }
    });
  },
  weightRack(c, w, d, it) {
    R(c, -w / 2, -d / 2, w, d);
    const m = Math.min(w, d), n = cl(Math.round(w / 22), 1, 12);
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + ((i + 0.5) * w) / n, s = Math.min(w / n, d) * 0.22;
      if (has(it, 'kettlebell')) { C(c, x, 0, s * 1.1); soft(c, () => CS(c, x, -s * 0.9, s * 0.6)); }
      else { L(c, x, -d * 0.3, x, d * 0.3); R(c, x - s, -d * 0.36, s * 2, d * 0.12); R(c, x - s, d * 0.24, s * 2, d * 0.12); }
    }
  },
  tire(c, w, d) {
    const r = Math.min(w, d) / 2;
    C(c, 0, 0, r);
    c.save(); c.fillStyle = c.strokeStyle; c.globalAlpha *= 0.12; c.beginPath(); c.arc(0, 0, r * 0.55, 0, TAU); c.fill(); c.restore();
    CS(c, 0, 0, r * 0.55);
    soft(c, () => { for (let i = 0; i < 20; i++) { const a = (i * TAU) / 20; L(c, Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85, Math.cos(a) * r, Math.sin(a) * r); } });
  },
  stepPlatform(c, w, d) {
    const m = Math.min(w, d);
    alongX(c, w, d, (W, H) => {
      RR(c, -W / 2, -H / 2, W, H, m * 0.1);
      soft(c, () => { for (let x = -W * 0.35; x <= W * 0.36; x += W * 0.07) L(c, x, -H * 0.3, x, H * 0.3); });
    });
  },
  darts(c, w, d) {
    const r = Math.min(w, d) / 2;
    C(c, 0, 0, r);
    soft(c, () => { CS(c, 0, 0, r * 0.75); CS(c, 0, 0, r * 0.45); for (let i = 0; i < 20; i++) { const a = (i * TAU) / 20; L(c, Math.cos(a) * r * 0.1, Math.sin(a) * r * 0.1, Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75); } });
    tone(c, 0.7, () => C(c, 0, 0, r * 0.1));
  },
  playGym(c, w, d, it) {
    const m = Math.min(w, d), p = cl(m * 0.05, 1, 6);
    R(c, -w / 2, -d / 2, w, d);
    soft(c, () => { R(c, -w / 2 + p, -d / 2 + p, w * 0.5, d * 0.5); for (let i = 1; i < 6; i++) L(c, -w / 2 + p, -d / 2 + p + (i * d * 0.5) / 6, -w / 2 + p + w * 0.5, -d / 2 + p + (i * d * 0.5) / 6); });
    P(c, w * 0.05, -d * 0.1, w * 0.25, -d * 0.1, w * 0.42, d * 0.45, w * 0.18, d * 0.45);
    tone(c, 0.5, () => { for (let i = 0; i < 6; i++) C(c, -w * 0.35 + (i % 3) * w * 0.12, d * 0.15 + Math.floor(i / 3) * d * 0.15, m * 0.03); });
  },

  // ===== Bērnu istaba =====
  playhouse(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'tent')) {
      c.beginPath(); for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6 + PI / 6; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * w / 2, Math.sin(a) * d / 2); } c.closePath(); c.fill(); c.stroke();
      soft(c, () => { for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6 + PI / 6; L(c, 0, 0, Math.cos(a) * w / 2, Math.sin(a) * d / 2); } });
      tone(c, 0.3, () => P(c, 0, 0, Math.cos(PI / 2 - PI / 6) * w / 2 * 0.0 - w * 0.2, d * 0.45, w * 0.2, d * 0.45));
      return;
    }
    R(c, -w / 2, -d / 2, w, d);
    const rh = Math.min(w, d) * 0.5;
    L(c, -w / 2, -d / 2, -w / 2 + rh, 0, w / 2 - rh, 0, w / 2, -d / 2);
    L(c, -w / 2, d / 2, -w / 2 + rh, 0); L(c, w / 2, d / 2, w / 2 - rh, 0);
    soft(c, () => { for (let y = -d / 2 + 4; y < d / 2; y += 5) L(c, -w / 2 + 1, y, w / 2 - 1, y); }, 0.25);
  },
  rockingHorse(c, w, d) {
    alongX(c, w, d, (W, H) => {
      for (const s of [-1, 1]) { c.beginPath(); c.ellipse(0, s * H * 0.36 - s * H * 0.8, W * 0.48, H * 0.8, 0, s > 0 ? PI * 0.3 : PI * 1.3, s > 0 ? PI * 0.7 : PI * 1.7); c.lineWidth *= 2; c.stroke(); c.lineWidth /= 2; }
      E(c, 0, 0, W * 0.28, H * 0.16);
      E(c, W * 0.3, 0, W * 0.12, H * 0.09);
      soft(c, () => { L(c, -W * 0.28, 0, -W * 0.4, 0); L(c, -W * 0.05, -H * 0.16, -W * 0.05, H * 0.16); });
    });
  },
  playpen(c, w, d) {
    const m = Math.min(w, d), t = cl(m * 0.05, 1, 4);
    RR(c, -w / 2, -d / 2, w, d, t);
    tone(c, 0.1, () => RR(c, -w / 2 + t, -d / 2 + t, w - 2 * t, d - 2 * t, t));
    soft(c, () => {
      for (let x = -w / 2 + 5; x < w / 2 - 2; x += 6) { L(c, x, -d / 2, x, -d / 2 + t); L(c, x, d / 2 - t, x, d / 2); }
      for (let y = -d / 2 + 5; y < d / 2 - 2; y += 6) { L(c, -w / 2, y, -w / 2 + t, y); L(c, w / 2 - t, y, w / 2, y); }
    });
  },
  swing(c, w, d) {
    const m = Math.min(w, d);
    soft(c, () => { L(c, -w * 0.45, -d * 0.45, -w * 0.3, -d * 0.1); L(c, w * 0.45, -d * 0.45, w * 0.3, -d * 0.1); L(c, -w * 0.45, d * 0.45, -w * 0.3, d * 0.1); L(c, w * 0.45, d * 0.45, w * 0.3, d * 0.1); });
    RR(c, -w * 0.32, -d * 0.18, w * 0.64, d * 0.36, m * 0.1);
    tone(c, 0.6, () => { for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(c, sx * w * 0.45, sy * d * 0.45, m * 0.04); });
  },
  stroller(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'shopping_cart')) {
      P(c, -w * 0.4, -d / 2, w * 0.4, -d / 2, w * 0.32, d * 0.36, -w * 0.32, d * 0.36);
      soft(c, () => { for (let i = 1; i < 6; i++) L(c, -w * 0.4 + (i * w * 0.8) / 6, -d / 2, -w * 0.32 + (i * w * 0.64) / 6, d * 0.36); });
      RR(c, -w * 0.42, d * 0.4, w * 0.84, d * 0.08, 1);
      return;
    }
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) wheel(c, sx * w * 0.44, sy * d * 0.36, w * 0.1, d * 0.2);
    RR(c, -w * 0.38, -d * 0.4, w * 0.76, d * 0.7, m * 0.15);
    tone(c, 0.2, () => eband(c, 0, -d * 0.05, w * 0.38, d * 0.35, m * 0.12, PI, TAU));
    L(c, -w * 0.38, d * 0.42, w * 0.38, d * 0.42);
  },
  kidsKitchen(c, w, d, it) {
    const m = Math.min(w, d);
    R(c, -w / 2, -d / 2, w, d);
    if (has(it, 'store')) { soft(c, () => { for (let i = 0; i < 8; i++) if (i % 2) R(c, -w / 2 + (i * w) / 8, -d / 2, w / 8, d * 0.25); }); L(c, -w / 2, -d / 2 + d * 0.25, w / 2, -d / 2 + d * 0.25); RR(c, w * 0.1, d * 0.05, w * 0.3, d * 0.3, 1); return; }
    C(c, -w * 0.25, -d * 0.12, m * 0.14); C(c, -w * 0.25, d * 0.2, m * 0.1);
    RR(c, w * 0.05, -d * 0.25, w * 0.35, d * 0.5, m * 0.08);
    C(c, w * 0.22, -d * 0.36, m * 0.04);
  },
  busyBoard(c, w, d) {
    const m = Math.min(w, d);
    alongX(c, w, d, (W, H) => {
      RR(c, -W / 2, -H / 2, W, H, Math.min(W, H) * 0.1);
      for (let i = 0; i < 4; i++) C(c, -W * 0.36 + i * W * 0.24, 0, Math.min(H * 0.3, W * 0.08));
    });
  },
  hoop(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w * 0.3, d * 0.05, w * 0.6, d * 0.4, m * 0.05);
    L(c, 0, d * 0.25, 0, -d * 0.3);
    R(c, -w * 0.45, -d * 0.36, w * 0.9, d * 0.06);
    CS(c, 0, -d * 0.18, Math.min(w * 0.16, d * 0.14));
  },
  basket(c, w, d) {
    E(c, 0, 0, w / 2, d / 2);
    soft(c, () => { ES(c, 0, 0, w * 0.4, d * 0.4); for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; L(c, Math.cos(a) * w * 0.4, Math.sin(a) * d * 0.4, Math.cos(a) * w / 2, Math.sin(a) * d / 2); } });
  },
  changingTable(c, w, d, it) {
    D.cabinet(c, w, d, { kind: 'drawer' });
    const m = Math.min(w, d);
    RR(c, -w * 0.45, -d * 0.4, w * 0.62, d * 0.7, m * 0.12);
    soft(c, () => { for (let i = 1; i < 4; i++) L(c, -w * 0.45 + (i * w * 0.62) / 4, -d * 0.36, -w * 0.45 + (i * w * 0.62) / 4, d * 0.26); });
    soft(c, () => RR(c, w * 0.22, -d * 0.3, w * 0.2, d * 0.24, 1));
  },

  // ===== Mazumtirdzniecība =====
  checkout(c, w, d, it) {
    const m = Math.min(w, d);
    alongX(c, w, d, (W, H) => {
      R(c, -W / 2, -H / 2, W, H);
      if (has(it, 'conveyor')) {
        tone(c, 0.18, () => R(c, -W / 2 + 2, -H * 0.35, W * 0.55, H * 0.55));
        soft(c, () => { for (let x = -W / 2 + 6; x < -W / 2 + W * 0.55; x += 6) L(c, x, -H * 0.35, x, H * 0.2); });
      } else if (has(it, 'display')) {
        tone(c, 0.12, () => R(c, -W / 2, H / 2 - H * 0.35, W, H * 0.35));
      }
      RR(c, W * 0.15, -H * 0.4, W * 0.22, H * 0.32, 1);
      tone(c, 0.5, () => R(c, W * 0.17, -H * 0.38, W * 0.18, H * 0.1));
      soft(c, () => C(c, W * 0.3, H * 0.26, Math.min(W, H) * 0.14));
    });
  },
  pos(c, w, d) {
    const m = Math.min(w, d);
    RR(c, -w * 0.45, -d * 0.4, w * 0.9, d * 0.8, m * 0.06);
    tone(c, 0.55, () => R(c, -w * 0.35, -d * 0.32, w * 0.7, d * 0.25));
    soft(c, () => { for (let i = 0; i < 12; i++) C(c, -w * 0.25 + (i % 4) * w * 0.17, d * 0.02 + Math.floor(i / 4) * d * 0.12, m * 0.03); });
  },
  kiosk(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'vending')) {
      RR(c, -w / 2, -d / 2, w, d, m * 0.03);
      tone(c, 0.15, () => R(c, -w / 2 + m * 0.05, d / 2 - d * 0.18, w * 0.68, d * 0.14));
      L(c, -w / 2, d / 2 - d * 0.2, w / 2, d / 2 - d * 0.2);
      soft(c, () => grid(c, -w / 2 + m * 0.05, -d * 0.4, w * 0.68, d * 0.55, 5, 4));
      R(c, w * 0.26, -d * 0.3, w * 0.18, d * 0.4);
      return;
    }
    if (has(it, 'queue', 'clock')) { RR(c, -w / 2, -d / 2, w, d, m * 0.06); tone(c, 0.5, () => R(c, -w * 0.35, -d * 0.25, w * 0.7, d * 0.4)); return; }
    RR(c, -w * 0.42, -d / 2, w * 0.84, d, m * 0.08);
    tone(c, 0.55, () => P(c, -w * 0.32, d * 0.05, w * 0.32, d * 0.05, w * 0.28, d * 0.4, -w * 0.28, d * 0.4));
    soft(c, () => { R(c, -w * 0.2, -d * 0.3, w * 0.4, d * 0.06); C(c, w * 0.24, -d * 0.12, m * 0.05); });
  },
  gate(c, w, d, it) {
    const m = Math.min(w, d), p = cl(m * 0.2, 2, 14);
    if (has(it, 'turnstile')) { RR(c, -w / 2, -d * 0.2, w * 0.3, d * 0.4, 1); for (let i = 0; i < 3; i++) { const a = -PI / 3 + (i * TAU) / 3; L(c, -w * 0.12, 0, -w * 0.12 + Math.cos(a) * w * 0.55, Math.sin(a) * d * 0.45); } return; }
    if (has(it, 'swing')) { RR(c, -w / 2, -d * 0.15, w * 0.15, d * 0.3, 1); L(c, -w * 0.35, 0, w / 2, 0); soft(c, () => dash(c, du(w, d), () => { c.beginPath(); c.arc(-w * 0.35, 0, w * 0.85, -PI / 2, 0); c.stroke(); })); return; }
    alongX(c, w, d, (W, H) => {
      RR(c, -W / 2, -H / 2, p, H, 1); RR(c, W / 2 - p, -H / 2, p, H, 1);
      if (has(it, 'detector')) R(c, -W / 2, -H / 2, W, H * 0.3);
      else soft(c, () => dash(c, du(W, H), () => L(c, -W / 2 + p, 0, W / 2 - p, 0)));
    });
  },
  queueBarrier(c, w, d) {
    alongX(c, w, d, (W, H) => {
      const r = Math.min(H * 0.45, W * 0.1);
      C(c, -W / 2 + r, 0, r); C(c, W / 2 - r, 0, r);
      c.lineWidth *= 1.8; L(c, -W / 2 + r, 0, W / 2 - r, 0); c.lineWidth /= 1.8;
      tone(c, 0.7, () => { C(c, -W / 2 + r, 0, r * 0.35); C(c, W / 2 - r, 0, r * 0.35); });
    });
  },
  signStand(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'sidewalk')) { R(c, -w * 0.42, -d * 0.3, w * 0.84, d * 0.6); L(c, -w * 0.42, 0, w * 0.42, 0); return; }
    if (has(it, 'banner')) { RR(c, -w * 0.45, -d * 0.1, w * 0.9, d * 0.2, d * 0.1); tone(c, 0.5, () => R(c, -w * 0.43, -d * 0.03, w * 0.86, d * 0.06)); return; }
    if (has(it, 'brochure')) { RR(c, -w * 0.4, -d * 0.3, w * 0.8, d * 0.6, m * 0.04); soft(c, () => { for (let i = 1; i < 4; i++) L(c, -w * 0.4, -d * 0.3 + (i * d * 0.6) / 4, w * 0.4, -d * 0.3 + (i * d * 0.6) / 4); }); return; }
    if (has(it, 'hostess')) { P(c, -w * 0.4, -d * 0.4, w * 0.4, -d * 0.4, w * 0.46, d * 0.4, -w * 0.46, d * 0.4); soft(c, () => L(c, -w * 0.4, -d * 0.1, w * 0.4, -d * 0.1)); return; }
    C(c, 0, d * 0.15, m * 0.25);
    L(c, 0, d * 0.15, 0, -d * 0.2);
    P(c, -w * 0.35, -d * 0.4, w * 0.35, -d * 0.4, w * 0.3, -d * 0.15, -w * 0.3, -d * 0.15);
  },
  scales(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'medical')) { RR(c, -w * 0.4, -d * 0.1, w * 0.8, d * 0.55, m * 0.06); L(c, 0, -d * 0.1, 0, -d * 0.35); RR(c, -w * 0.2, -d * 0.45, w * 0.4, d * 0.12, 1); return; }
    RR(c, -w * 0.45, -d * 0.1, w * 0.9, d * 0.55, m * 0.05);
    soft(c, () => RR(c, -w * 0.38, -d * 0.03, w * 0.76, d * 0.41, m * 0.04));
    RR(c, -w * 0.3, -d * 0.46, w * 0.6, d * 0.26, m * 0.04);
    tone(c, 0.55, () => R(c, -w * 0.22, -d * 0.4, w * 0.44, d * 0.12));
  },
  fittingRoom(c, w, d) {
    const m = Math.min(w, d), t = cl(m * 0.04, 1, 4);
    tone(c, 0.05, () => R(c, -w / 2, -d / 2, w, d));
    R(c, -w / 2, -d / 2, w, t); R(c, -w / 2, -d / 2, t, d); R(c, w / 2 - t, -d / 2, t, d);
    c.beginPath(); c.moveTo(-w / 2 + t, d / 2 - t); for (let x = -w / 2 + t; x < w / 2 - t; x += 8) c.quadraticCurveTo(x + 2, d / 2 - t * 3, x + 4, d / 2 - t), c.quadraticCurveTo(x + 6, d / 2 + t, Math.min(x + 8, w / 2 - t), d / 2 - t); c.stroke();
    soft(c, () => { R(c, -w * 0.25, -d / 2 + t, w * 0.5, t); C(c, w * 0.3, -d * 0.1, m * 0.03); });
  },
  drum(c, w, d, it) {
    const m = Math.min(w, d), r = m / 2;
    C(c, 0, 0, r);
    soft(c, () => CS(c, 0, 0, r * 0.86));
    if (has(it, 'bucket', 'barrel')) { soft(c, () => { for (let i = 0; i < 12; i++) { const a = (i * TAU) / 12; L(c, Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86, Math.cos(a) * r, Math.sin(a) * r); } }); if (has(it, 'bucket') && !has(it, 'overhead')) L(c, -r * 0.86, 0, r * 0.86, 0); return; }
    if (has(it, 'keg', 'cylinder', 'co2', 'dioxide')) { C(c, 0, 0, r * 0.3); tone(c, 0.6, () => C(c, 0, 0, r * 0.12)); return; }
    if (has(it, 'trash', 'bin')) { L(c, -r * 0.86, -r * 0.1, r * 0.86, -r * 0.1); tone(c, 0.5, () => RR(c, -r * 0.25, r * 0.86, r * 0.5, r * 0.14, 1)); return; }
    if (has(it, 'oil', 'lubricant', 'tank')) { C(c, r * 0.3, -r * 0.3, r * 0.22); return; }
  },
  draftTower(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'panel')) { alongX(c, w, d, (W, H) => { R(c, -W / 2, -H / 2, W, H); const n = cl(Math.round(W / 12), 1, 8); for (let i = 0; i < n; i++) C(c, -W / 2 + ((i + 0.5) * W) / n, H * 0.1, Math.min(H * 0.3, W / n * 0.25)); }); return; }
    RR(c, -w / 2, -d / 2, w, d, m * 0.06);
    tone(c, 0.15, () => RR(c, -w * 0.4, d * 0.05, w * 0.8, d * 0.35, 1));
    RR(c, -w * 0.4, -d * 0.2, w * 0.8, d * 0.2, d * 0.1);
    for (let i = 0; i < 3; i++) C(c, -w * 0.25 + i * w * 0.25, -d * 0.1, m * 0.06);
  },

  // ===== Medicīna =====
  medCart(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'surgical')) { dash(c, du(w, d), () => C(c, 0, 0, m * 0.48)); for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; C(c, Math.cos(a) * m * 0.28, Math.sin(a) * m * 0.28, m * 0.09); } C(c, 0, 0, m * 0.1); return; }
    if (has(it, 'mobile_exam_light')) { soft(c, () => star(c, m * 0.4, 5, m * 0.04)); L(c, 0, 0, w * 0.35, -d * 0.3); C(c, w * 0.35, -d * 0.3, m * 0.12); return; }
    if (has(it, 'microscope', 'colposcope')) { soft(c, () => star(c, m * 0.4, 5, m * 0.04)); C(c, 0, 0, m * 0.14); L(c, 0, 0, w * 0.3, -d * 0.3); RR(c, w * 0.22, -d * 0.4, w * 0.18, d * 0.18, m * 0.04); return; }
    RR(c, -w * 0.4, -d * 0.4, w * 0.8, d * 0.8, m * 0.06);
    tone(c, 0.6, () => casters(c, w, d, m * 0.05));
    tone(c, 0.55, () => R(c, -w * 0.3, -d * 0.36, w * 0.6, d * 0.12));
    soft(c, () => { R(c, -w * 0.3, -d * 0.05, w * 0.6, d * 0.2); C(c, -w * 0.15, d * 0.25, m * 0.05); C(c, w * 0.15, d * 0.25, m * 0.05); });
    if (has(it, 'ultrasound', 'laser', 'facial', 'intraoral')) L(c, w * 0.4, 0, w / 2 - 1, -d * 0.3);
  },
  trolley(c, w, d, it) {
    const m = Math.min(w, d);
    RR(c, -w * 0.42, -d * 0.42, w * 0.84, d * 0.84, m * 0.05);
    tone(c, 0.6, () => casters(c, w, d, m * 0.05));
    L(c, -w * 0.4, d * 0.46, w * 0.4, d * 0.46);
    if (has(it, 'crash')) { L(c, -w * 0.42, -d * 0.1, w * 0.42, -d * 0.1); L(c, -w * 0.42, d * 0.15, w * 0.42, d * 0.15); tone(c, 0.4, () => RR(c, -w * 0.25, -d * 0.36, w * 0.5, d * 0.2, 1)); return; }
    soft(c, () => { R(c, -w * 0.34, -d * 0.34, w * 0.3, d * 0.3); C(c, w * 0.18, -d * 0.18, m * 0.1); R(c, -w * 0.3, d * 0.06, w * 0.6, d * 0.24); });
  },
  mri(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'mri')) {
      R(c, -w / 2, -d / 2, w, d * 0.45);
      tone(c, 0.35, () => R(c, -w * 0.2, -d / 2 + d * 0.05, w * 0.4, d * 0.35));
      RR(c, -w * 0.12, -d * 0.2, w * 0.24, d * 0.7, m * 0.04);
      return;
    }
    if (has(it, 'cbct', 'mammography_unit', 'dental_x_ray', 'x_ray_unit')) {
      C(c, 0, -d * 0.1, m * 0.36);
      tone(c, 0.12, () => C(c, 0, -d * 0.1, m * 0.24));
      R(c, -w * 0.12, d * 0.25, w * 0.24, d * 0.2);
      soft(c, () => L(c, -m * 0.36, -d * 0.1, m * 0.36, -d * 0.1));
      return;
    }
    if (has(it, 'vertical')) { R(c, -w * 0.08, -d / 2, w * 0.16, d * 0.3); tone(c, 0.3, () => R(c, -w * 0.42, -d * 0.2, w * 0.84, d * 0.12)); return; }
    if (has(it, 'horizontal')) { R(c, -w / 2, -d * 0.3, w, d * 0.6); tone(c, 0.2, () => R(c, -w * 0.3, -d * 0.2, w * 0.6, d * 0.4)); return; }
    if (has(it, 'viewer')) { alongX(c, w, d, (W, H) => { R(c, -W / 2, -H / 2, W, H * 0.5); tone(c, 0.15, () => R(c, -W / 2 + 1, -H / 2 + 0.5, W - 2, H * 0.4)); }); return; }
    if (has(it, 'incubator')) { RR(c, -w * 0.45, -d * 0.4, w * 0.9, d * 0.8, m * 0.06); RR(c, -w * 0.38, -d * 0.32, w * 0.76, d * 0.5, m * 0.2); soft(c, () => { C(c, -w * 0.2, d * 0.3, m * 0.07); C(c, w * 0.2, d * 0.3, m * 0.07); }); return; }
    if (has(it, 'barrier')) { alongX(c, w, d, (W, H) => { R(c, -W / 2, -H * 0.15, W, H * 0.3); tone(c, 0.15, () => R(c, -W * 0.25, -H * 0.1, W * 0.5, H * 0.2)); for (const s of [-1, 1]) for (const t of [-1, 1]) C(c, s * W * 0.42, t * H * 0.35, H * 0.08); }); return; }
    RR(c, -w / 2, -d / 2, w, d, m * 0.05);
    tone(c, 0.45, () => R(c, -w * 0.35, -d * 0.15, w * 0.7, d * 0.08));
  },
  chamber(c, w, d, it) {
    const m = Math.min(w, d);
    RR(c, -w / 2, -d / 2, w, d, m * 0.05);
    if (has(it, 'fume')) { tone(c, 0.12, () => R(c, -w * 0.45, -d * 0.4, w * 0.9, d * 0.7)); L(c, -w / 2, d * 0.3, w / 2, d * 0.3); soft(c, () => { for (let x = -w * 0.4; x < w * 0.4; x += w * 0.1) L(c, x, d * 0.3, x + w * 0.05, d / 2); }); return; }
    if (has(it, 'centrifuge')) { C(c, 0, -d * 0.05, m * 0.34); soft(c, () => { for (let i = 0; i < 6; i++) { const a = (i * TAU) / 6; L(c, 0, -d * 0.05, Math.cos(a) * m * 0.3, -d * 0.05 + Math.sin(a) * m * 0.3); } }); return; }
    if (has(it, 'spray')) { tone(c, 0.12, () => R(c, -w / 2, -d / 2, w, d * 0.15)); soft(c, () => { for (let x = -w / 2 + 4; x < w / 2; x += 6) L(c, x, -d / 2, x, -d / 2 + d * 0.15); }); dash(c, du(w, d), () => L(c, -w * 0.4, d / 2, w * 0.4, d / 2)); return; }
    if (has(it, 'sandblasting')) { tone(c, 0.18, () => P(c, -w * 0.4, -d * 0.35, w * 0.4, -d * 0.35, w * 0.35, d * 0.05, -w * 0.35, d * 0.05)); C(c, -w * 0.2, d * 0.3, m * 0.09); C(c, w * 0.2, d * 0.3, m * 0.09); return; }
    if (has(it, 'furnace', 'muffle', 'forge')) { tone(c, 0.35, () => R(c, -w * 0.3, -d * 0.3, w * 0.6, d * 0.5)); soft(c, () => flame(c, 0, -d * 0.05, m * 0.14)); R(c, -w / 2, d * 0.28, w, d * 0.22); return; }
    R(c, -w / 2, d / 2 - d * 0.12, w, d * 0.12);
    C(c, 0, -d * 0.06, m * 0.3);
    soft(c, () => CS(c, 0, -d * 0.06, m * 0.2));
    tone(c, 0.55, () => R(c, w * 0.28, -d * 0.4, w * 0.16, d * 0.1));
  },

  // ===== Darbnīca / rūpniecība =====
  workbench(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'vise')) { R(c, -w / 2, -d / 2, w, d * 0.5); tone(c, 0.5, () => { R(c, -w * 0.3, d * 0.0, w * 0.6, d * 0.18); R(c, -w * 0.3, d * 0.26, w * 0.6, d * 0.18); }); L(c, 0, d * 0.18, 0, d * 0.48); L(c, -w * 0.2, d * 0.48, w * 0.2, d * 0.48); return; }
    if (has(it, 'grinder')) { R(c, -w * 0.2, -d * 0.3, w * 0.4, d * 0.6); for (const s of [-1, 1]) { R(c, s * w * 0.32 - w * 0.06, -d * 0.42, w * 0.12, d * 0.84); soft(c, () => L(c, s * w * 0.2, 0, s * w * 0.26, 0)); } return; }
    R(c, -w / 2, -d / 2, w, d);
    soft(c, () => { const n = cl(Math.round(d / 9), 2, 8); for (let i = 1; i < n; i++) L(c, -w / 2, -d / 2 + (i * d) / n, w / 2, -d / 2 + (i * d) / n); });
    tone(c, 0.45, () => { R(c, -w / 2 - 0.01, d / 2 - d * 0.22, w * 0.06, d * 0.22); R(c, w / 2 - w * 0.12, -d * 0.1, w * 0.06, d * 0.28); });
    if (has(it, 'pegboard')) { tone(c, 0.2, () => R(c, -w / 2, -d / 2, w, d * 0.12)); soft(c, () => { for (let x = -w / 2 + 3; x < w / 2; x += 5) C(c, x, -d / 2 + d * 0.06, 0.6); }); }
  },
  lathe(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      R(c, -W / 2, -H * 0.15, W, H * 0.4);
      R(c, -W / 2, -H / 2, W * 0.24, H * 0.85);
      C(c, -W / 2 + W * 0.28, 0, m * 0.18);
      R(c, W / 2 - W * 0.16, -H * 0.22, W * 0.14, H * 0.44);
      L(c, -W / 2 + W * 0.3, 0, W / 2 - W * 0.16, 0);
      soft(c, () => { R(c, -W * 0.05, H * 0.18, W * 0.2, H * 0.3); if (has(it, 'cnc')) R(c, -W / 2, -H / 2, W, H); });
      if (has(it, 'cnc')) tone(c, 0.5, () => R(c, W * 0.3, H * 0.28, W * 0.14, H * 0.2));
    });
  },
  saw(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'table_saw')) {
      R(c, -w / 2, -d / 2, w, d);
      tone(c, 0.6, () => R(c, -w * 0.06, -d * 0.2, w * 0.12, d * 0.4));
      soft(c, () => { CS(c, 0, 0, Math.min(w, d) * 0.22); L(c, w * 0.3, -d / 2, w * 0.3, d / 2); });
      R(c, w * 0.26, -d / 2, w * 0.06, d);
      return;
    }
    if (has(it, 'drill')) { RR(c, -w * 0.4, -d * 0.1, w * 0.8, d * 0.5, m * 0.04); C(c, 0, -d * 0.3, m * 0.16); R(c, -w * 0.3, -d * 0.45, w * 0.6, d * 0.3); C(c, 0, d * 0.1, m * 0.05); return; }
    if (has(it, 'band')) { RR(c, -w * 0.4, -d * 0.4, w * 0.8, d * 0.8, m * 0.08); R(c, -w * 0.45, -d * 0.1, w * 0.9, d * 0.5); tone(c, 0.7, () => R(c, -w * 0.05, -d * 0.4, w * 0.04, d * 0.8)); return; }
    RR(c, -w / 2, -d / 2, w, d, m * 0.05);
  },
  machine(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'anvil')) { c.beginPath(); c.moveTo(-w / 2, -d * 0.18); c.quadraticCurveTo(-w * 0.2, -d * 0.18, -w * 0.15, -d * 0.25); c.lineTo(w * 0.42, -d * 0.25); c.lineTo(w * 0.42, d * 0.25); c.lineTo(-w * 0.15, d * 0.25); c.quadraticCurveTo(-w * 0.2, d * 0.18, -w / 2, d * 0.18); c.closePath(); c.fill(); c.stroke(); soft(c, () => R(c, -w * 0.1, -d * 0.35, w * 0.4, d * 0.7)); return; }
    if (has(it, 'pottery')) { soft(c, () => RR(c, -w / 2, -d / 2, w, d, m * 0.2)); C(c, 0, -d * 0.08, m * 0.3); soft(c, () => CS(c, 0, -d * 0.08, m * 0.18)); R(c, -w * 0.25, d * 0.28, w * 0.5, d * 0.16); return; }
    if (has(it, 'ball_mill')) { RR(c, -w * 0.42, -d * 0.3, w * 0.84, d * 0.6, d * 0.3); soft(c, () => { for (let x = -w * 0.25; x < w * 0.3; x += w * 0.1) L(c, x, -d * 0.3, x, d * 0.3); }); R(c, -w / 2, -d * 0.1, w * 0.08, d * 0.2); return; }
    if (has(it, 'settling', 'extruder')) { C(c, -w * 0.2, 0, m * 0.3); C(c, w * 0.25, 0, m * 0.22); soft(c, () => L(c, -w * 0.2 + m * 0.3, 0, w * 0.25 - m * 0.22, 0)); return; }
    if (has(it, 'cylinder_cart')) { RR(c, -w * 0.45, -d * 0.4, w * 0.9, d * 0.7, m * 0.05); C(c, -w * 0.2, -d * 0.05, m * 0.22); C(c, w * 0.2, -d * 0.05, m * 0.22); wheel(c, -w * 0.4, d * 0.35, w * 0.12, d * 0.2); wheel(c, w * 0.4, d * 0.35, w * 0.12, d * 0.2); return; }
    if (has(it, 'generator')) { R(c, -w / 2, -d / 2, w, d); soft(c, () => { L(c, -w / 2, -d / 2, w / 2, d / 2); L(c, w / 2, -d / 2, -w / 2, d / 2); }); RR(c, -w * 0.3, -d * 0.25, w * 0.4, d * 0.5, m * 0.05); C(c, w * 0.25, 0, m * 0.15); return; }
    if (has(it, 'compressor')) { RR(c, -w / 2, -d * 0.25, w, d * 0.5, d * 0.25); R(c, -w * 0.2, -d * 0.45, w * 0.4, d * 0.3); C(c, w * 0.32, -d * 0.32, m * 0.1); return; }
    if (has(it, 'pressure_washer')) { RR(c, -w * 0.3, -d * 0.35, w * 0.6, d * 0.6, m * 0.08); C(c, 0, -d * 0.05, m * 0.15); wheel(c, -w * 0.38, d * 0.25, w * 0.1, d * 0.25); wheel(c, w * 0.38, d * 0.25, w * 0.1, d * 0.25); L(c, -w * 0.2, -d * 0.4, w * 0.2, -d * 0.4); return; }
    if (has(it, 'lawn', 'snow', 'cultivator')) {
      const head = has(it, 'snow') ? () => R(c, -w * 0.45, d * 0.15, w * 0.9, d * 0.3) : has(it, 'cultivator') ? () => { for (let i = 0; i < 4; i++) C(c, -w * 0.3 + i * w * 0.2, d * 0.3, m * 0.12); } : () => C(c, 0, d * 0.12, m * 0.34);
      head();
      if (has(it, 'snow')) soft(c, () => { for (let x = -w * 0.4; x < w * 0.42; x += w * 0.1) L(c, x, d * 0.15, x + w * 0.05, d * 0.45); });
      L(c, -w * 0.2, -d * 0.1, -w * 0.25, -d * 0.48, w * 0.25, -d * 0.48, w * 0.2, -d * 0.1);
      return;
    }
    if (has(it, 'welding_machine')) { RR(c, -w * 0.3, -d * 0.3, w * 0.6, d * 0.6, m * 0.05); tone(c, 0.5, () => R(c, -w * 0.2, d * 0.15, w * 0.4, d * 0.1)); soft(c, () => { c.beginPath(); c.moveTo(w * 0.3, 0); c.quadraticCurveTo(w * 0.5, d * 0.4, w * 0.1, d * 0.45); c.stroke(); }); return; }
    if (has(it, 'press', 'hammer', 'forging')) { R(c, -w * 0.4, -d * 0.4, w * 0.8, d * 0.8); tone(c, 0.6, () => { R(c, -w * 0.4, -d * 0.4, w * 0.14, d * 0.14); R(c, w * 0.26, -d * 0.4, w * 0.14, d * 0.14); R(c, -w * 0.4, d * 0.26, w * 0.14, d * 0.14); R(c, w * 0.26, d * 0.26, w * 0.14, d * 0.14); }); RR(c, -w * 0.2, -d * 0.2, w * 0.4, d * 0.4, 1); C(c, 0, 0, m * 0.1); return; }
    if (has(it, 'rolling', 'bender')) { R(c, -w / 2, -d * 0.3, w, d * 0.6); for (const y of [-d * 0.12, d * 0.12]) RR(c, -w * 0.4, y - d * 0.06, w * 0.8, d * 0.12, d * 0.06); R(c, -w / 2, -d * 0.4, w * 0.1, d * 0.8); R(c, w / 2 - w * 0.1, -d * 0.4, w * 0.1, d * 0.8); return; }
    if (has(it, 'milling')) { R(c, -w * 0.15, -d / 2, w * 0.3, d * 0.5); R(c, -w * 0.45, -d * 0.05, w * 0.9, d * 0.3); C(c, 0, -d * 0.2, m * 0.12); soft(c, () => grid(c, -w * 0.45, -d * 0.05, w * 0.9, d * 0.3, 6, 1)); return; }
    if (has(it, 'belt_grinder')) { RR(c, -w * 0.3, -d * 0.45, w * 0.6, d * 0.9, m * 0.2); soft(c, () => RR(c, -w * 0.18, -d * 0.35, w * 0.36, d * 0.7, m * 0.15)); return; }
    RR(c, -w / 2, -d / 2, w, d, m * 0.05);
    R(c, -w * 0.3, -d * 0.3, w * 0.6, d * 0.4);
    tone(c, 0.5, () => R(c, w * 0.25, d * 0.2, w * 0.18, d * 0.18));
  },
  carLift(c, w, d, it) {
    const m = Math.min(w, d), p = cl(m * 0.07, 4, 22);
    if (has(it, 'engine_hoist')) { L(c, -w * 0.35, d * 0.45, 0, -d * 0.35, w * 0.35, d * 0.45); L(c, 0, -d * 0.35, 0, d * 0.3); RR(c, -w * 0.06, -d * 0.45, w * 0.12, d * 0.3, 1); C(c, 0, d * 0.3, m * 0.05); for (const s of [-1, 1]) C(c, s * w * 0.35, d * 0.45, m * 0.04); return; }
    if (has(it, 'transmission')) { RR(c, -w * 0.15, -d * 0.15, w * 0.3, d * 0.3, m * 0.04); star(c, m * 0.45, 4, m * 0.04); return; }
    if (has(it, 'motorcycle')) { alongX(c, w, d, (W, H) => { RR(c, -W / 2, -H * 0.3, W, H * 0.6, H * 0.1); tone(c, 0.15, () => RR(c, -W * 0.4, -H * 0.12, W * 0.8, H * 0.24, 1)); }); return; }
    const runway = (x) => { R(c, x - w * 0.11, -d * 0.4, w * 0.22, d * 0.8); soft(c, () => { for (let y = -d * 0.35; y < d * 0.4; y += cl(d * 0.05, 4, 20)) L(c, x - w * 0.1, y, x + w * 0.1, y); }); };
    if (has(it, 'four_post')) { runway(-w * 0.25); runway(w * 0.25); tone(c, 0.65, () => { for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) R(c, sx * w * 0.43 - p / 2, sy * d * 0.44 - p / 2, p, p); }); return; }
    if (has(it, 'scissor')) { runway(-w * 0.25); runway(w * 0.25); soft(c, () => { for (const x of [-w * 0.25, w * 0.25]) { L(c, x - w * 0.08, -d * 0.3, x + w * 0.08, d * 0.3); L(c, x + w * 0.08, -d * 0.3, x - w * 0.08, d * 0.3); } }); return; }
    tone(c, 0.65, () => { R(c, -w / 2, -p / 2, p, p); R(c, w / 2 - p, -p / 2, p, p); });
    for (const s of [-1, 1]) { L(c, -w / 2 + p, 0, -w * 0.15, s * d * 0.35); L(c, w / 2 - p, 0, w * 0.15, s * d * 0.35); C(c, -w * 0.15, s * d * 0.35, p * 0.3); C(c, w * 0.15, s * d * 0.35, p * 0.3); }
    soft(c, () => dash(c, du(w, d) * 3, () => RR(c, -w * 0.3, -d * 0.45, w * 0.6, d * 0.9, w * 0.1)));
  },
  tireMachine(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'brake', 'headlight')) {
      alongX(c, w, d, (W, H) => {
        if (has(it, 'headlight')) { R(c, -W / 2, H * 0.3, W, H * 0.06); RR(c, -W * 0.1, -H * 0.3, W * 0.2, H * 0.5, 1); C(c, 0, -H * 0.05, Math.min(W, H) * 0.12); return; }
        for (const s of [-1, 1]) { R(c, s * W * 0.3 - W * 0.17, -H * 0.4, W * 0.34, H * 0.8); soft(c, () => { RR(c, s * W * 0.3 - W * 0.14, -H * 0.3, W * 0.28, H * 0.18, H * 0.09); RR(c, s * W * 0.3 - W * 0.14, H * 0.12, W * 0.28, H * 0.18, H * 0.09); }); }
      });
      return;
    }
    if (has(it, 'alignment')) { for (const s of [-1, 1]) { C(c, s * w * 0.3, d * 0.1, m * 0.18); soft(c, () => CS(c, s * w * 0.3, d * 0.1, m * 0.1)); } RR(c, -w * 0.1, -d * 0.45, w * 0.2, d * 0.3, 1); tone(c, 0.5, () => R(c, -w * 0.08, -d * 0.42, w * 0.16, d * 0.1)); return; }
    if (has(it, 'dolly', 'drum_dolly')) { RR(c, -w * 0.45, -d * 0.45, w * 0.9, d * 0.9, m * 0.06); soft(c, () => { for (let i = 1; i < 4; i++) L(c, -w * 0.45 + (i * w * 0.9) / 4, -d * 0.4, -w * 0.45 + (i * w * 0.9) / 4, d * 0.4); }); tone(c, 0.6, () => casters(c, w, d, m * 0.05)); if (has(it, 'drum')) C(c, 0, 0, m * 0.3); return; }
    if (has(it, 'tilter', 'painting', 'stand')) { R(c, -w * 0.45, -d * 0.1, w * 0.9, d * 0.2); R(c, -w * 0.1, -d * 0.45, w * 0.2, d * 0.9); RR(c, -w * 0.25, -d * 0.3, w * 0.5, d * 0.35, 1); tone(c, 0.6, () => casters(c, w, d, m * 0.04)); return; }
    if (has(it, 'infrared')) { soft(c, () => star(c, m * 0.4, 5, m * 0.04)); L(c, 0, 0, 0, -d * 0.25); R(c, -w * 0.4, -d * 0.45, w * 0.8, d * 0.18); tone(c, 0.3, () => { for (let i = 0; i < 4; i++) R(c, -w * 0.35 + i * w * 0.18, -d * 0.42, w * 0.12, d * 0.12); }); return; }
    if (has(it, 'station', 'nitrogen', 'inflator', 'vulcanizer')) { RR(c, -w * 0.4, -d * 0.4, w * 0.8, d * 0.8, m * 0.06); tone(c, 0.5, () => R(c, -w * 0.3, -d * 0.35, w * 0.6, d * 0.15)); C(c, -w * 0.15, d * 0.15, m * 0.1); C(c, w * 0.15, d * 0.15, m * 0.1); soft(c, () => CS(c, 0, d * 0.15, m * 0.32)); return; }
    if (has(it, 'washer')) { RR(c, -w / 2, -d / 2, w, d, m * 0.06); C(c, 0, 0, m * 0.36); soft(c, () => { CS(c, 0, 0, m * 0.24); L(c, -m * 0.36, 0, m * 0.36, 0); }); return; }
    RR(c, -w / 2, -d * 0.1, w, d * 0.6, m * 0.05);
    C(c, 0, -d * 0.18, m * 0.3);
    soft(c, () => { CS(c, 0, -d * 0.18, m * 0.18); for (let i = 0; i < 3; i++) { const a = -PI / 2 + (i * TAU) / 3; L(c, 0, -d * 0.18, Math.cos(a) * m * 0.28, -d * 0.18 + Math.sin(a) * m * 0.28); } });
    tone(c, 0.5, () => R(c, -w * 0.3, d * 0.3, w * 0.6, d * 0.12));
  },
  tankF(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'filtration', 'pump')) { C(c, -w * 0.22, 0, m * 0.25); C(c, w * 0.22, 0, m * 0.25); soft(c, () => L(c, -w * 0.45, -d * 0.4, w * 0.45, -d * 0.4)); if (has(it, 'pump')) R(c, -w * 0.1, d * 0.2, w * 0.2, d * 0.2); return; }
    C(c, 0, 0, m / 2);
    soft(c, () => CS(c, 0, 0, m * 0.36));
    tone(c, 0.55, () => C(c, 0, 0, m * 0.08));
    if (up(it)) soft(c, () => L(c, 0, -m / 2, 0, -d / 2));
  },
  boilerF(c, w, d, it) {
    const m = Math.min(w, d);
    if (up(it)) dash(c, du(w, d), () => RR(c, -w / 2, -d / 2, w, d, m * 0.06)); else RR(c, -w / 2, -d / 2, w, d, m * 0.06);
    C(c, 0, -d * 0.15, m * 0.18);
    soft(c, () => CS(c, 0, -d * 0.15, m * 0.1));
    tone(c, 0.55, () => R(c, -w * 0.25, d * 0.22, w * 0.5, d * 0.12));
    if (has(it, 'pellet', 'solid')) { R(c, -w / 2, -d / 2, w * 0.35, d * 0.5); flame(c, w * 0.2, d * 0.05, m * 0.1); }
  },
  car(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      if (has(it, 'trailer')) {
        R(c, -W / 2 + W * 0.18, -H / 2, W * 0.82, H);
        L(c, -W / 2 + W * 0.18, -H * 0.3, -W / 2, 0, -W / 2 + W * 0.18, H * 0.3);
        for (const s of [-1, 1]) wheel(c, W * 0.2, s * (H / 2 - H * 0.06), W * 0.14, H * 0.1);
        return;
      }
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) wheel(c, sx * W * 0.32, sy * (H / 2 - H * 0.04), W * 0.13, H * 0.08);
      RR(c, -W / 2, -H / 2 + H * 0.04, W, H * 0.92, m * 0.25);
      const van = has(it, 'van');
      RR(c, -W * (van ? 0.3 : 0.22), -H * 0.38, W * (van ? 0.7 : 0.48), H * 0.76, m * 0.12);
      tone(c, 0.3, () => { P(c, W * (van ? 0.4 : 0.26), -H * 0.36, W * (van ? 0.4 : 0.26), H * 0.36, W * (van ? 0.3 : 0.18), H * 0.3, W * (van ? 0.3 : 0.18), -H * 0.3); P(c, -W * (van ? 0.3 : 0.22), -H * 0.34, -W * (van ? 0.3 : 0.22), H * 0.34, -W * 0.3, H * 0.3, -W * 0.3, -H * 0.3); });
      soft(c, () => { E(c, W * 0.34, -H * 0.5 + H * 0.02, W * 0.02, H * 0.05); E(c, W * 0.34, H * 0.5 - H * 0.02, W * 0.02, H * 0.05); });
    });
  },
  bike(c, w, d, it) {
    alongX(c, w, d, (W, H) => {
      const m = Math.min(W, H);
      if (has(it, 'atv', 'snowmobile', 'jet_ski')) {
        if (has(it, 'snowmobile')) { R(c, W * 0.25, -H * 0.42, W * 0.25, H * 0.12); R(c, W * 0.25, H * 0.3, W * 0.25, H * 0.12); RR(c, -W / 2, -H * 0.25, W * 0.6, H * 0.5, m * 0.1); }
        else if (has(it, 'jet_ski')) { R(c, -W / 2, -H * 0.45, W, H * 0.9); E(c, 0, 0, W * 0.42, H * 0.3); }
        else { for (const sx of [-1, 1]) for (const sy of [-1, 1]) wheel(c, sx * W * 0.32, sy * H * 0.38, W * 0.2, H * 0.22); RR(c, -W * 0.38, -H * 0.3, W * 0.76, H * 0.6, m * 0.15); }
        E(c, -W * 0.05, 0, W * 0.15, H * 0.12);
        L(c, W * 0.18, -H * 0.3, W * 0.18, H * 0.3);
        return;
      }
      if (has(it, 'wall_mount')) soft(c, () => R(c, -W * 0.05, -H / 2, W * 0.1, H * 0.2));
      const wr = has(it, 'scooter') ? W * 0.08 : W * 0.2;
      wheel(c, -W / 2 + wr, 0, wr * 2, Math.min(H * 0.12, wr * 0.4));
      wheel(c, W / 2 - wr, 0, wr * 2, Math.min(H * 0.12, wr * 0.4));
      if (has(it, 'motorcycle')) RR(c, -W * 0.28, -H * 0.18, W * 0.5, H * 0.36, m * 0.12);
      else if (has(it, 'scooter')) RR(c, -W * 0.38, -H * 0.12, W * 0.7, H * 0.24, m * 0.06);
      else { L(c, -W * 0.3, 0, W * 0.3, 0); E(c, -W * 0.1, 0, W * 0.06, H * 0.08); }
      L(c, W * 0.28, -H * 0.4, W * 0.28, H * 0.4);
    });
  },
  tubRound(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'square')) { R(c, -w / 2, -d / 2, w, d); RR(c, -w / 2 + m * 0.08, -d / 2 + m * 0.08, w - m * 0.16, d - m * 0.16, m * 0.15); C(c, 0, 0, m * 0.03); return; }
    E(c, 0, 0, w / 2, d / 2);
    E(c, 0, 0, w / 2 - m * 0.07, d / 2 - m * 0.07);
    soft(c, () => { for (let i = 0; i < 24; i++) { const a = (i * TAU) / 24; L(c, Math.cos(a) * (w / 2 - m * 0.07), Math.sin(a) * (d / 2 - m * 0.07), Math.cos(a) * w / 2, Math.sin(a) * d / 2); } });
    C(c, 0, 0, m * 0.03);
  },
  slats(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'headrest', 'backrest')) {
      alongX(c, w, d, (W, H) => {
        RR(c, -W / 2, -H / 2, W, H, Math.min(W, H) * 0.2);
        soft(c, () => { const n = cl(Math.round(W / 5), 3, 30); for (let i = 1; i < n; i++) L(c, -W / 2 + (i * W) / n, -H / 2 + 1, -W / 2 + (i * W) / n, H / 2 - 1); });
      });
      return;
    }
    R(c, -w / 2, -d / 2, w, d);
    soft(c, () => { for (let y = -d / 2 + 6; y < d / 2; y += 6) L(c, -w / 2, y, w / 2, y); L(c, -w * 0.3, -d / 2, -w * 0.3, d / 2); L(c, w * 0.3, -d / 2, w * 0.3, d / 2); });
  },
  firewood(c, w, d) {
    body(c, w, d, null);
    const s = cl(Math.min(w, d) * 0.3, 4, 12);
    tone(c, 0.12, () => { for (let x = -w / 2 + s * 0.6; x < w / 2 - s * 0.4; x += s * 1.05) for (let y = -d / 2 + s * 0.6; y < d / 2 - s * 0.4; y += s * 1.05) C(c, x, y, s * 0.48); });
  },
  fireplace(c, w, d, it) {
    const m = Math.min(w, d);
    if (has(it, 'chimney')) { C(c, 0, 0, m * 0.46); CS(c, 0, 0, m * 0.3); if (has(it, 'tank')) soft(c, () => CS(c, 0, 0, m * 0.4)); return; }
    if (has(it, 'round_island', 'cylindrical', 'island_fireplace')) { E(c, 0, 0, w / 2, d / 2); tone(c, 0.15, () => E(c, 0, 0, w * 0.32, d * 0.32)); flame(c, 0, 0, m * 0.2); soft(c, () => dash(c, du(w, d), () => CS(c, 0, 0, m * 0.1))); return; }
    if (has(it, 'sauna_heater')) { R(c, -w / 2, -d / 2, w, d); soft(c, () => { for (let i = 0; i < 16; i++) C(c, -w * 0.3 + (i % 4) * w * 0.2, -d * 0.3 + Math.floor(i / 4) * d * 0.2, m * 0.08); }); return; }
    if (has(it, 'bioethanol')) { body(c, w, d, it, m * 0.08); tone(c, 0.4, () => RR(c, -w * 0.35, -d * 0.1, w * 0.7, d * 0.2, d * 0.1)); for (const x of [-w * 0.2, 0, w * 0.2]) soft(c, () => flame(c, x, 0, Math.min(d * 0.3, w * 0.08))); return; }
    if (has(it, 'corner')) { P(c, -w / 2, -d / 2, w / 2, -d / 2, w / 2, -d * 0.1, -w * 0.1, d / 2, -w / 2, d / 2); tone(c, 0.3, () => P(c, -w * 0.3, -d * 0.3, w * 0.2, -d * 0.3, -w * 0.3, d * 0.2)); return; }
    R(c, -w / 2, -d / 2, w, d);
    tone(c, 0.1, () => R(c, -w * 0.45, d * 0.12, w * 0.9, d * 0.38));
    P(c, -w * 0.32, d * 0.12, -w * 0.22, -d * 0.32, w * 0.22, -d * 0.32, w * 0.32, d * 0.12);
    flame(c, 0, -d * 0.08, Math.min(w * 0.12, d * 0.2));
  },
  unitBox(c, w, d, it) {
    const m = Math.min(w, d);
    body(c, w, d, it, m * 0.06);
    C(c, -w * 0.2, 0, m * 0.15);
    soft(c, () => { L(c, -w * 0.2, 0, -w * 0.2 + m * 0.1, -m * 0.08); });
    for (const x of [w * 0.15, w * 0.32]) R(c, x - m * 0.04, d / 2 - m * 0.2, m * 0.08, m * 0.2);
  },
};

function bedCore(c, w, d, it, blanket) {
  const m = Math.min(w, d);
  const hb = has(it, 'without_headboard') ? 0 : cl(d * 0.045, 1, 9);
  const f = cl(m * 0.025, 0.4, 3);
  let x0 = -w / 2, ww = w;
  if (has(it, 'storage_cabinets', 'murphy_bed_with_sofa')) {
    const cw = cl(w * 0.14, 3, 40);
    for (const s of [-1, 1]) { R(c, s > 0 ? w / 2 - cw : -w / 2, -d / 2, cw, d * 0.35); soft(c, () => L(c, s > 0 ? w / 2 - cw : -w / 2, -d / 2, s > 0 ? w / 2 : -w / 2 + cw, -d / 2 + d * 0.35)); }
    x0 = -w / 2 + cw; ww = w - 2 * cw;
  }
  if (has(it, 'race_car')) { for (const sx of [-1, 1]) for (const sy of [-0.3, 0.32]) wheel(c, sx * (w / 2 - w * 0.04), sy * d, w * 0.08, d * 0.16); RR(c, -w / 2 + w * 0.06, -d / 2, w * 0.88, d, m * 0.2); x0 = -w / 2 + w * 0.1; ww = w * 0.8; }
  else if (has(it, 'boat')) { P(c, -w / 2, -d / 2, w / 2, -d / 2, w / 2, d * 0.22, 0, d / 2, -w / 2, d * 0.22); x0 = -w / 2 + w * 0.1; ww = w * 0.8; }
  else R(c, x0, -d / 2, ww, d);
  if (hb) tone(c, 0.35, () => R(c, x0, -d / 2, ww, hb));
  if (has(it, 'bunny')) { E(c, -w * 0.2, -d / 2 + hb, w * 0.08, d * 0.04); E(c, w * 0.2, -d / 2 + hb, w * 0.08, d * 0.04); }
  if (has(it, 'wrought')) soft(c, () => { for (let x = x0 + 6; x < x0 + ww - 3; x += 8) C(c, x, -d / 2 + hb / 2, hb * 0.25); });
  const xi = x0 + f, iw = ww - 2 * f, y0 = -d / 2 + hb + f;
  const n = iw > 125 ? 2 : 1, g = cl(iw * 0.04, 0.4, 6), ph = cl(d * 0.13, 2, 30), pw = (iw - (n + 1) * g) / n;
  for (let i = 0; i < n; i++) RR(c, xi + g + i * (pw + g), y0 + g, pw, ph, ph * 0.35);
  if (!blanket) return;
  const yb = y0 + g + ph + g * 1.5, bh = d / 2 - f - yb;
  if (bh <= 2 || iw <= 2) return;
  const k = Math.min(iw, bh) * 0.28;
  P(c, xi, yb, xi + iw - k, yb, xi + iw, yb + k, xi + iw, yb + bh, xi, yb + bh);
  tone(c, 0.16, () => P(c, xi + iw - k, yb, xi + iw, yb + k, xi + iw - k, yb + k));
  soft(c, () => L(c, xi, yb + Math.min(bh * 0.14, 14), xi + iw - k * (1 - Math.min(bh * 0.14, 14) / k > 0 ? 1 - Math.min(bh * 0.14, 14) / k : 0), yb + Math.min(bh * 0.14, 14)));
  if (has(it, 'trundle', 'extendable')) soft(c, () => dash(c, du(w, d), () => L(c, x0, d / 2 - d * 0.02, x0 + ww, d / 2 - d * 0.02)));
}

function leaves(c, x, y, r, n, narrow) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n + 0.3;
    E(c, x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.5, r * (narrow ? 0.1 : 0.22), a);
  }
  soft(c, () => { for (let i = 0; i < n; i++) { const a = (i * TAU) / n + 0.3; L(c, x, y, x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9); } });
}
function fish(c, x, y, s) {
  E(c, x, y, s, s * 0.45);
  P(c, x - s * 0.9, y, x - s * 1.4, y - s * 0.4, x - s * 1.4, y + s * 0.4);
}

// ---------- 3D modeļi ----------
const tableB = (it, t = 4) => {
  const { w, d, h } = it, l = Math.max(2, Math.min(5, Math.min(w, d) * 0.08));
  const legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [sx * (w / 2 - l), (h - t) / 2, sz * (d / 2 - l), l, h - t, l, 'dark']);
  return [[0, h - t / 2, 0, w, t, d], ...legs];
};
const chairB = (it) => {
  const { w, d, h } = it, sh = Math.min(46, h * 0.55);
  return [...tableB({ w, d, h: sh }), [0, sh + (h - sh) / 2, -d / 2 + 2, w, h - sh, 4]];
};
const cylB = (it, tone) => [[0, it.h / 2, 0, it.w, it.h, it.d, tone, 'cyl']];
const roundTB = (it) => [[0, it.h - 2, 0, it.w, 4, it.d, null, 'cyl'], [0, (it.h - 4) / 2, 0, 8, it.h - 4, 8, 'dark', 'cyl']];
const bedB = (it) => {
  const { w, d } = it, hh = Math.max(it.h || 90, 60);
  return [[0, 15, 0, w, 30, d, 'dark'], [0, 40, 4, w - 4, 20, d - 8, 'white'], [0, hh / 2, -d / 2 + 4, w, hh, 8, 'dark']];
};
const counterB = (it) => { const { w, d, h } = it; return [[0, (h - 4) / 2, -2, w, h - 4, d - 4], [0, h - 2, 0, w, 4, d, 'white']]; };

export const build = {
  bedF: bedB,
  crib: (it) => [[0, it.h / 2, 0, it.w, it.h, it.d, 'white']],
  hospitalBed: (it) => [[0, 30, 0, it.w, 20, it.d, 'white'], [0, 12, 0, it.w * 0.8, 24, it.d * 0.8, 'dark']],
  examTable: (it) => tableB(it, 10),
  massageTable: (it) => tableB(it, 10),
  diningTable: (it) => tableB(it),
  plankTable: (it) => tableB(it),
  coffeeTable: (it) => tableB(it),
  consoleTable: (it) => tableB(it),
  desk: (it) => tableB(it),
  pingPong: (it) => tableB(it),
  foosball: (it) => tableB(it, 20),
  airHockey: (it) => tableB(it, 15),
  chessTable: (it) => tableB(it),
  prepTable: (it) => tableB(it),
  workbench: (it) => tableB(it, 6),
  roundDining: (it) => (has(it, 'half_round') ? tableB(it) : roundTB(it)),
  roundTable: roundTB,
  chair: chairB,
  salonChair: chairB,
  island: counterB,
  barCounter: counterB,
  kitchenBase: counterB,
  kSink: counterB,
  reception: counterB,
  stove: counterB,
  drum: (it) => cylB(it),
  tankF: (it) => cylB(it, 'white'),
  tubRound: (it) => (has(it, 'square') ? [[0, it.h / 2, 0, it.w, it.h, it.d]] : cylB(it)),
  boxingBag: (it) => [[0, Math.max(it.h, 100) / 2 + 30, 0, it.w * 0.9, Math.max(it.h, 100) * 0.9, it.d * 0.9, 'dark', 'cyl']],
  ball: (it) => [[0, Math.min(it.w, it.d) / 2, 0, Math.min(it.w, it.d), Math.min(it.w, it.d), Math.min(it.w, it.d), null, 'sphere']],
  trampoline: (it) => [[0, Math.min(it.h, 60) - 3, 0, it.w, 6, it.d, 'dark', 'cyl']],
  eggChair: (it) => [[0, it.h / 2, 0, it.w, it.h, it.d, null, 'sphere']],
  pouf: (it) => (has(it, 'round') ? [[0, it.h / 2, 0, it.w, it.h, it.d, null, 'cyl']] : [[0, it.h / 2, 0, it.w, it.h, it.d]]),
  xmasTree: (it) => [[0, 15, 0, 20, 30, 20, 'pot', 'cyl'], [0, 30 + (it.h - 30) * 0.3, 0, it.w, (it.h - 30) * 0.6, it.d, null, 'cyl'], [0, 30 + (it.h - 30) * 0.75, 0, it.w * 0.55, (it.h - 30) * 0.5, it.d * 0.55, null, 'cyl']],
  plant: (it) => [[0, 15, 0, it.w * 0.5, 30, it.w * 0.5, 'pot', 'cyl'], [0, 30 + (it.h - 30) / 2, 0, it.w, Math.max(it.h - 30, 10), it.d, null, 'sphere']],
  floorlamp: (it) => [[0, it.h - 15, 0, it.w, 30, it.w, 'white', 'cyl', 'light'], [0, (it.h - 30) / 2, 0, 3, it.h - 30, 3, 'dark', 'cyl']],
  stool: (it) => [[0, it.h - 3, 0, it.w, 6, it.d, null, 'cyl'], [0, (it.h - 6) / 2, 0, 5, it.h - 6, 5, 'dark', 'cyl']],
};

export const _errors = [];
export const draw = {};
for (const [k, fn] of Object.entries(D)) {
  if (typeof fn !== 'function') continue;
  // Drošības tīkls: simbols nekad nedrīkst apturēt plāna zīmēšanu.
  draw[k] = (c, w, d, it) => {
    if (!(w > 0) || !(d > 0)) return;
    c.save();
    try { fn(c, w, d, it); } catch (e) { if (_errors.length < 50) _errors.push(k + ': ' + (e && e.message)); c.restore(); c.save(); c.beginPath(); c.rect(-w / 2, -d / 2, w, d); c.fill(); c.stroke(); }
    c.restore();
  };
}

export const colors = {
  sofaCurve: '#7b8a9a', eggChair: '#a08670', rockingChair: '#b58c5e', lounger: '#c9b79c', benchPadded: '#b59a7a', seatRow: '#6b7680', hammock: '#d9c7a3',
  bedF: '#d8d2c8', roundBed: '#d8d2c8', crib: '#e8dcc8', hospitalBed: '#e6eef2', tanningBed: '#d9e2ea', petBed: '#c9a882', examTable: '#dfe8ee', massageTable: '#d9cfc2',
  dentalChair: '#cfe0ea', salonChair: '#8d969f', shampooUnit: '#8d969f',
  diningTable: '#c49a6c', roundDining: '#c49a6c', coffeeTable: '#b58c5e', plankTable: '#c9a477', nightstand: '#c9a477', consoleTable: '#b58c5e', desk: '#c49a6c', computerSet: '#5d6670',
  deskCurved: '#c49a6c', reception: '#d8c3a5', island: '#e9e6df', barCounter: '#8a6a4f', pingPong: '#2f6d8f', foosball: '#2f7d4f', airHockey: '#3f6fa0', chessTable: '#b58c5e',
  slidingDoors: '#e7e1d6', cabinet: '#d8c3a5', cornerUnit: '#e9e6df', kitchenBase: '#e9e6df', worktop: '#d9d4cb', frontPanel: '#e9e6df', tallCabinet: '#e9e6df', shelfUnit: '#d8c3a5',
  mediaWall: '#d8c3a5', projectorScreen: '#e3e6e9', wineRack: '#a0785a', shoeRack: '#d8c3a5', coatRack: '#a0785a', chest: '#b58c5e', locker: '#b7c0c8', safe: '#8a9299',
  displayCase: '#dfe8ee', retailShelf: '#d9d4cb', breadRack: '#c9a477', palletRack: '#c9ced3', panRack: '#c9ced3', toolCabinet: '#c9675c', headboard: '#b59a7a', wallPanel: '#c9b79c', radCover: '#f0f0f0',
  mirrorF: '#dcecf7', oven: '#b4b9be', dishwasher: '#d9dde2', washerF: '#eef0f2', kSink: '#e9e6df', kettle: '#d9dde2', toaster: '#c9ced3', coffeeMaker: '#9aa0a6', jarAppliance: '#d9dde2',
  cookerPot: '#c9ced3', waffle: '#9aa0a6', breadMaker: '#e3e6e9', grill: '#aab0b6', fryer: '#c9ced3', pizzaOven: '#a8735a', woodStove: '#8f959b', stoveGuard: '#c49a6c', buffetStation: '#c9ced3',
  prepTable: '#c9ced3', espresso: '#8a8f96', iceMaker: '#d9dde2', slicer: '#c9ced3', speaker: '#555a60', soundbar: '#2b2e33', avBox: '#9aa0a6', turntable: '#a7adb3', laptop: '#8a8f96',
  monitor: '#4b4f55', printer: '#e3e6e9', phone: '#a7adb3', projector: '#e3e6e9', vacuum: '#8a8f96', ironingBoard: '#d9dde2', garmentSteamer: '#e3e6e9', dryingRack: '#d9dde2', purifier: '#f4f6f8',
  sewingMachine: '#e3e6e9', heater: '#e3e6e9', xmasTree: '#3f7a46', blinds: '#e3ddd0', clock: '#f4f4f4', aquarium: '#bfe0ef', cage: '#d9d4cb', catHouse: '#c9b79c', litterBox: '#d9dde2', feeder: '#d9d4cb',
  trophy: '#8a6a4f', screen: '#c9b79c', partition: '#dcecf7', board: '#f4f6f8', globeBar: '#c9a477', arcade: '#7d838a', hookah: '#b58c5e', telescope: '#8a8f96', mannequin: '#e8dcc8', wheelchair: '#8a8f96',
  guitar: '#b5784a', drums: '#b84a3e', mixer: '#8f959b', standGear: '#6b737b', backdrop: '#d9d4cb', treadmill: '#9aa3ab', exerciseBike: '#9aa3ab', rowingMachine: '#9aa3ab', elliptical: '#9aa3ab',
  stairClimber: '#9aa3ab', multiGym: '#b0b6bc', weightBench: '#8a9299', boxingBag: '#b84a3e', boxingRing: '#3f6fa0', ball: '#e8a33d', trampoline: '#3f6fa0', pole: '#c9ced3', barre: '#c9a477',
  weightRack: '#9aa3ab', tire: '#6b7076', stepPlatform: '#9aa3ab', darts: '#d9cfb8', playGym: '#e8c07a', playhouse: '#e8c07a', rockingHorse: '#c9a477', playpen: '#e8dcc8', swing: '#c9a477',
  stroller: '#9fb7cf', kidsKitchen: '#f0d9a8', busyBoard: '#e8c07a', hoop: '#e08a3d', basket: '#c9a882', changingTable: '#e8dcc8', checkout: '#d9d4cb', pos: '#9aa0a6', kiosk: '#d9dde2', gate: '#c9ced3',
  queueBarrier: '#c9ced3', signStand: '#d9d4cb', scales: '#e3e6e9', fittingRoom: '#e3ddd0', drum: '#b7c0c8', draftTower: '#c9ced3', medCart: '#e6eef2', trolley: '#d9dde2', mri: '#e6eef2', chamber: '#d9dde2',
  lathe: '#8fa39a', saw: '#8fa39a', machine: '#8fa39a', carLift: '#d9b44a', tireMachine: '#d08a7f', tankF: '#e3e6e9', boilerF: '#f0f0f0', bike: '#8a8f96', tubRound: '#c9a477', slats: '#d9b98c', firewood: '#a0785a',
  unitBox: '#e3e6e9', officeChair: '#7d868f', stool: '#8d969f', chair: '#8d969f', piano: '#7a6a5f', stove: '#b9bec4', dryerStand: '#c9ced3', makeupStation: '#d8c3a5',
};

// ---------- Priekšmetu piesaiste ----------
const MAP = {
  sofa: 'two_seater_sofa three_seater_sofa kitchen_bench_sofa black_leather_sofa sleeper_sofa sofa_with_tall_legs outdoor_wicker_sofa outdoor_cushioned_sofa pallet_sofa high_back_privacy_sofa rectangular_modular_lobby_seating armless_sofa_module folding_sofa sofa_for_a_restaurant_with_a_screen',
  sofaCurve: 'curved_sofa semi_circular_sofa round_modular_lobby_seating oval_modular_lobby_seating',
  cornerSofa: 'two_piece_sectional_sofa three_piece_sectional_sofa corner_kitchen_sofa chaise_module chaise_module_with_armrest corner_module high_back_privacy_sofa_corner_section',
  armchair: 'armless_chair_module armchair_module comfy_hair rectangular_armchair_with_a_low_backrest low_profile_curved_chair armless_semicircular_armchair sleeper_chair high_back_armchair high_back_privacy_chair massage_chair armchair_with_ottoman recliner_armchair oversized_armchair kids_rolling_armchair kids_upholstered_armchair',
  eggChair: 'bean_bag_chair privacy_egg_chair egg_chair_with_backrest hanging_egg_chair round_patio_chair hammock_chair oversized_round_armchair',
  rockingChair: 'rocking_chair children_s_rocking_chair',
  lounger: 'chaise_lounge oversized_chaise_armchair hamam_lounger',
  pouf: 'ottoman end_module rounded_end_module side_armrest_module armrest_module_with_overlay large_ottoman_module small_ottoman_module ottoman_coffee_table legged_ottoman cube_ottoman round_ottoman triangular_pouf corner_pouf roman_style_ottoman ottoman_with_arms shark_shaped_ottoman',
  benchPadded: 'bed_bench banquette_for_grand_piano window_seat',
  bench: 'bench_with_built_in_table bench_with_arms rounded_end_bench storage_bench_with_drawers half_round_bench sauna_bench floating_sauna_bench bath_bench wooden_bench locker_room_bench hamam_bench',
  seatRow: 'three_seat_waiting_bench',
  hammock: 'hammock',
  chair: 'armless_chair dining_chair bentwood_chair rectangular_back_bentwood_chair wishbone_chair kids_chair highchair adjustable_chair guitarist_chair',
  officeChair: 'ergonomic_chair student_chair conference_room_chair office_chair executive_chair gaming_chair',
  stool: 'swivel_bar_stool backless_swivel_bar_stool backless_bar_stool swivel_counter_stool backless_swivel_counter_stool counter_stool stool adjustable_height_stool sauna_stool stylist_stool tattoo_artist_stool dentist_stool',
  bedF: 'click_clack_sofa_bed single_bed double_bed double_wrought_iron_bed double_bed_without_headboard murphy_bed_with_storage_cabinets double_murphy_bed murphy_bed_with_sofa full_size_murphy_bed daybed corner_daybed side_bed extendable_bed trundle_bed race_car_bed boat_bed bed_with_bunny_ears',
  bunk: 'bunk_bed loft_bed loft_bed_with_desk loft_bed_with_sofa_underneath bunk_bed_with_storage bunk_bed_with_full_size_lower_bed',
  roundBed: 'round_daybed round_daybed_with_privacy_curtain',
  crib: 'bassinet crib doll_cradle bassinet_stroller',
  hospitalBed: 'orthopedic_trauma_bed patient_stretcher',
  tanningBed: 'horizontal_tanning_bed vertical_tanning_booth',
  petBed: 'pet_bed',
  examTable: 'exam_table operating_table veterinary_exam_table veterinary_grooming_table',
  massageTable: 'massage_table massage_table_for_hamama',
  dentalChair: 'dental_unit gynecology_exam_chair esthetician_chair makeup_chair tattoo_client_chair',
  salonChair: 'salon_styling_chair kids_styling_chair_car_design pedicure_chair spa_chair',
  shampooUnit: 'shampoo_backwash_unit',
  wallPanel: 'full_wall_upholstered_panel horizontal_upholstered_wall_panel vertical_upholstered_wall_panel water_panel',
  headboard: 'soft_upholstered_headboard wooden_headboard winged_upholstered_headboard headboard_with_shelf',
  nightstand: 'floor_standing_nightstand wall_mounted_nightstand round_bedside_table end_table side_table',
  cabinet: 'floor_standing_dresser dresser_with_shelf wall_mounted_dresser corner_drawer_unit storage_combination_with_doors glass_front_storage_combination hutch_cabinet waiter_s_buffet display_cabinet low_upboard office_storage_cabinet office_credenza service_cabinet disposable_garment_cabinet single_door_medical_cabinet double_door_medical_cabinet medical_drawer_cabinet medical_file_cabinet hallway_unit_with_mirror_and_cabinet sliding_mirror_tall_cabinet tall_mirrored_cabinet_with_ironing_board aquarium_on_the_cabinet',
  cornerUnit: 'corner_pedestal double_door_corner_unit single_door_corner_unit curved_corner_wardrobe open_concave_corner_unit corner_concave_unit corner_shelving_unit curved_corner_shelving_unit triangular_corner_shelving_unit base_corner_cabinet base_blind_corner_cabinet base_rounded_corner_cabinet base_diagonal_corner_cabinet corner_base_cabinet_with_2_drawers corner_base_cabinet_with_3_drawers wall_corner_cabinet wall_blind_corner_cabinet wall_diagonal_corner_cabinet wall_rounded_corner_cabinet corner_counter_module inner_corner_counter_module',
  tv: 'tv_stand wall_mounted_tv_stand corner_tv_stand',
  shelfUnit: 'bookcase wall_mounted_shelf ikea_kallax_4_shelf_unit house_shaped_storage_shelf ikea_kallax_5_shelf_unit zigzag_bookcase bookcase_with_diagonal_shelves decorative_shelving_unit_rectangles loft_style_shelf tree_shaped_bookshelf tetra_shelving_unit shelf_module open_end_unit wall_mounted_rounded_open_end_unit',
  mediaWall: 'media_wall_cabinet wall_unit_with_overhead_cabinets wall_unit_with_tall_closed_cabinets wall_unit_with_open_side_shelves asymmetrical_storage_wall_with_open_type_shelves wall_unit_with_open_shelves asymmetrical_storage_wall_with_solid_shelves wide_wall_unit_with_open_shelves wall_unit_with_tall_overhead_drawers',
  coffeeTable: 'rectangular_coffee_table round_coffee_table oval_coffee_table double_coffee_table hexagonal_coffee_table slab_coffee_table bear_coffee_table convertible_coffee_table',
  consoleTable: 'wall_mounted_hallway_table floor_standing_console semicircular_console corner_console_table wall_mounted_hallway_table_with_legs',
  desk: 'wall_mounted_desk office_desk executive_desk standing_desk bureau_desk trapezoid_desk desk_with_drawers secretary_desk gaming_desk school_desk kid_s_table nurse_work_desk',
  computerSet: 'desktop_computer',
  deskL: 'l_shaped_executive_desk corner_reception_desk_unit corner_workstation l_shaped_desk_with_shelves l_shaped_desk asymmetric_l_shaped_desk',
  deskCurved: 'curved_executive_desk curved_conference_table_attachment curved_corner_reception_desk_unit semi_circular_reception_desk curved_bar_counter',
  reception: 'rectangular_reception_desk_unit nurse_station promotional_counter',
  diningTable: 'rectangular_dining_table rounded_corner_rectangular_dining_table live_edge_slab_table triangular_dining_table gateleg_dining_table conference_table_attachment rectangular_conference_table semi_circular_conference_table wall_mounted_drop_leaf_table',
  roundDining: 'round_dining_table oval_dining_table ellipse_dining_table half_round_dining_table',
  roundTable: 'bar_table round_bar_table',
  plankTable: 'bath_table folding_bath_table',
  island: 'open_island_with_overhang_for_2_seats closed_island_with_overhang_for_2_seats open_island_with_overhang_for_3_seats closed_island_with_overhang_for_3_seats corner_island_with_overhang_for_3_seats l_shaped_island_bar_support',
  barCounter: 'bar_counter warefall_bar_counter raised_bar_counter corner_raised_bar_counter bar_counter_straight_section bar_counter_corner_rounded_section bar_counter_corner_section bar_divider',
  wardrobe: 'single_door_wardrobe double_door_wardrobe 3_door_wardrobe_cabinet 4_door_wardrobe_cabinet open_wardrobe folding_door_wardrobe sliding_door_wardrobe 3_door_sliding_wardrobe 4_door_sliding_wardrobe section_with_shelves section_with_shelves_and_drawers section_with_shelves_and_shoe_rack section_with_hanging_rail_and_drawers section_with_hanging_rail_and_shoe_rack section_with_hanging_rail_for_long_clothes section_with_two_hanging_rails corner_wardrobe',
  slidingDoors: '2_door_sliding_doors 3_door_sliding_doors 4_door_sliding_doors',
  kitchenBase: 'base_cabinet_with_door floor_standing_cabinet_with_two_doors base_cabinet_with_drawers floor_standing_cabinet_with_three_drawers floor_cabinet_with_4_drawers floor_cabinet_with_microwave end_floor_cabinet rounded_floor_cabinet base_rounded_open_cabinet floor_mounted_wine_rack base_cabinet_with_pull_out_trash_can open_wine_rack built_in_wine_cabinet wall_cabinet_with_door wall_mounted_cabinet_with_two_doors wall_mounted_cabinet_with_lift_up_mechanism wall_mounted_cabinet_with_folding_lift_up_mechan wall_cabinet_with_glass_doors glass_display_wall_cabinet open_shelving_wall_cabinet microwave_wall_cabinet wall_mounted_mezzanine_cabinet end_wall_cabinet end_wall_display_cabinet rounded_wall_cabinet wall_mounted_bottle_rack single_door_overhead_unit double_door_overhead_unit cabinet_for_kids_kitchen bar_storage_rack',
  tallCabinet: 'tall_pantry_cabinet built_in_refrigerator_cabinet tall_microwave_cabinet tall_cabinet_with_built_in_coffee_machine tall_cabinet_for_refrigerator tall_display_cabinet tall_display_cabinet_with_drawers double_tall_display_cabinet double_tall_display_cabinet_with_drawers end_tall_display_cabinet tall_bottle_rack_cabinet tall_shoe_cabinet_with_3_tilt_out_drawers tall_cabinet_with_oven_and_microwave tall_oven_cabinet',
  worktop: 'countertop',
  frontPanel: 'furniture_front_drawer furniture_front_door furniture_panel',
  oven: 'base_oven_cabinet microwave_oven mini_oven convection_oven combi_oven conveyor_oven rotisserie_oven',
  stove: 'electric_cooktop_2_burners electric_cooktop_3_burners electric_cooktop_4_burners electric_cooktop_5_burners gas_cooktop_2_burners gas_cooktop_3_burners gas_cooktop_4_burners gas_cooktop_5_burners electric_range gas_range portable_electric_cooktop portable_gas_cooktop portable_induction_cooktop double_desktop_induction_stove 2_burner_range 4_burner_range 6_burner_range',
  fridge: 'standard_refrigerator 2_door_refrigerator freezer mini_fridge wine_cooler toy_refrigerator glass_door_refrigerator double_glass_door_refrigerator upright_freezer double_level_chest_freezer combination_freezer_island double_door_upright_freezer refrigerator_table ice_cream_freezer',
  dishwasher: 'dishwasher_cabinet dishwasher countertop_dishwasher conveyor_dishwasher hood_type_dishwasher front_load_dishwasher glass_washer pot_washer',
  washerF: 'washing_machine_cabinet washing_machine kids_washing_machine',
  kSink: 'standard_kitchen_sink sink_with_drainboard corner_kitchen_sink round_kitchen_sink double_bowl_kitchen_sink drop_in_kitchen_sink drop_in_round_kitchen_sink drop_in_double_bowl_kitchen_sink commercial_sink_unit bar_cabinet_with_sink',
  hood: 'dome_range_hood corner_range_hood built_in_range_hood wall_mounted_range_hood slanted_range_hood flat_range_hood round_island_range_hood rectangular_island_range_hood wall_mounted_exhaust_hood island_exhaust_hood',
  kettle: 'electric_kettle',
  toaster: 'toaster',
  coffeeMaker: 'coffee_maker',
  jarAppliance: 'stand_mixer blender juicer food_processor dough_mixer electric_meat_grinder vegetable_cutter',
  cookerPot: 'multi_cooker hootch_still steam_kettle electric_water_boiler',
  waffle: 'waffle_maker',
  breadMaker: 'bread_maker',
  grill: 'electric_grill kids_grill flat_griddle chargrill charcoal_grill',
  fryer: 'fryer pasta_cooker',
  pizzaOven: 'tandoor_oven wood_fired_pizza_oven vertical_broiler_gyro_machine',
  woodStove: 'wood_gas_stove wood_gas_stove_with_remote_firebox cylindrical_wood_gas_stove cylindrical_wood_gas_stove_with_remote_firebox wood_fireplace_stove',
  stoveGuard: 'sauna_stove_guard',
  buffetStation: 'coffee_station juice_station cutlery_station soup_station steam_table island_steam_table',
  prepTable: 'utility_prep_table stainless_steel_work_table refrigerated_prep_table stainless_steel_counter inner_corner_counter corner_counter',
  espresso: 'espresso_machine',
  iceMaker: 'ice_maker ice_crusher egg_tester',
  slicer: 'deli_slicer',
  tvWall: 'tv_on_wall_mount tv_on_stand mobile_tv_unit',
  projectorScreen: 'ceiling_mounted_projector_screen tripod_projector_screen',
  projector: 'projector',
  speaker: 'front_speaker_channel center_speaker_channel rear_speaker_channel subwoofer suspended_speaker_channel smart_speaker guitar_amplifier guitar_stack stage_monitor',
  soundbar: 'soundbar',
  avBox: 'dvd_blu_ray_player av_receiver xbox playstation server x_ray_film_processor cr_plate_scanner',
  turntable: 'turntable',
  laptop: 'laptop',
  monitor: 'ultrawide_monitor',
  printer: 'multifunction_printer desktop_printer 3d_printer',
  phone: 'telephone speakerphone paper_shredder',
  vacuum: 'robot_vacuum_cleaner upright_vacuum_cleaner vacuum_cleaner',
  ironingBoard: 'ironing_board toy_ironing_set',
  garmentSteamer: 'upright_garment_steamer',
  dryingRack: 'freestanding_drying_rack wall_mounted_drying_rack',
  purifier: 'humidifier uv_air_purifier wall_mounted_bactericidal_recirculator',
  sewingMachine: 'sewing_machine',
  heater: 'space_heater industrial_heater',
  shoeRack: 'shoe_cabinet open_shoe_rack shoe_cabinet_2_drawers shoe_cabinet_with_2_2_tilt_out_drawers shoe_storage_bench shoe_polishing_machine',
  coatRack: 'hallway_unit_with_coat_rack hooks_for_coat_rack single_hook double_hook wall_mounted_coat_rack coat_rack_with_shelf corner_freestanding_coat_rack freestanding_coat_rack freestanding_valet_stand bench_with_hooks',
  chest: 'storage_trunk toy_box',
  locker: 'locker storage_lockers',
  safe: 'office_safe hunting_rifle_safe',
  displayCase: 'display_counter_module glass_display_case corner_display_case narrow_display_case narrow_glass_display_case deli_display_case small_deli_display_case bakery_display_case display_counter corner_display_counter open_refrigerated_display_case open_deli_case bar_display_cabinet',
  retailShelf: 'wall_shelving island_display_rack inclined_display_bin produce_display_rack warehouse_shelving_unit motorcycle_helmet_rack cue_rack sale_table',
  breadRack: 'bread_rack angled_bread_rack corner_bread_rack',
  palletRack: 'pallet_rack',
  panRack: 'sheet_pan_rack proofing_cabinet',
  toolCabinet: 'rolling_tool_cabinet tool_storage_cabinet',
  radCover: 'radiator_cabinet_with_storage wall_mounted_radiator_cover',
  mirrorF: 'rectangular_mirror backlit_mirror round_mirror round_backlit_mirror asymmetrical_mirror half_moon_mirror oval_mirror arched_mirror_arch_at_the_top arched_mirror_arch_at_bottom shaving_mirror rectangular_framed_mirror floor_mirror',
  plant: 'planter_partition ficus_floor_standing yucca_floor_standing monstera zamioculcas ficus_lyrata strelitzia dieffenbachia dypsis_floor_standing potted_citrus_plant citrus_tree bamboo dragon_tree_in_the_pot tall_potted_cactus potted_cactus money_tree_crassula sugit_in_planter bonsai wall_mounted_vine_ivy plant_installation_near_wall plant_installation_wall_mounted vertical_garden',
  xmasTree: 'christmas_tree',
  blinds: 'roller_blind roman_blinds roller_shutter horizontal_blinds vertical_blinds_mounting_on_the_slope vertical_blinds_ceiling_mounted japanese_curtains_ceiling_mounted_4_panels japanese_curtains_ceiling_mounted_6_panels japanese_curtains_wall_mounted_4_panels japanese_curtains_wall_mounted_6_panels',
  clock: 'wall_clock',
  aquarium: 'aquarium_table_type mini_aquarium_round terrarium',
  cage: 'rodents_cage bird_cage_round bird_cage_rectangular hospital_cage',
  catHouse: 'cat_s_house_scratcher',
  litterBox: 'litter_box',
  feeder: 'feed_trough parrot_perch',
  trophy: 'stuffed_bear_full_hight deer_trophy_mount boar_trophy_mount goat_trophy_mount bear_trophy_mount',
  screen: 'decorative_folding_screen privacy_screen',
  partition: 'glass_office_partition solid_office_partition',
  board: 'magnetic_whiteboard flip_hart chalkboard easel',
  globeBar: 'globe_bar',
  arcade: 'arcade_automatic',
  hookah: 'hookah',
  telescope: 'telescope',
  floorlamp: 'standard_lamp arched_floor_lamp',
  mannequin: 'standing_mannequin sitting_mannequin reclining_mannequin lying_mannequin wheelchair_mannequin dress_form',
  piano: 'piano digital_piano grand_piano',
  guitar: 'acoustic_guitar_on_the_rack bass_guitar_on_the_rack electric_guitar_on_a_stand double_bass cello harp',
  drums: 'acoustic_drum_set electronic_drum_set',
  mixer: 'mixing_console',
  standGear: 'microphone_stand mispiter camera_on_tripod softbox_on_tripod photo_umbrella_on_tripod photo_spotlight_on_tripod reflector_on_tripod',
  backdrop: 'small_studio_backdrop large_studio_backdrop',
  treadmill: 'treadmill',
  exerciseBike: 'exercise_bike',
  rowingMachine: 'rowing_machine',
  elliptical: 'elliptical_machine',
  stairClimber: 'stairmaster',
  multiGym: 'pull_up_dip_station leg_press_machine cable_crossover_machine multi_gym_smith_machine weight_stack_machine',
  weightBench: 'weight_bench bench_press',
  boxingBag: 'boxing_dummy heavy_bag punching_bag',
  boxingRing: 'boxing_ring',
  pingPong: 'ping_pong_table',
  foosball: 'foosball_table',
  airHockey: 'air_hockey_table',
  poolTable: 'pool_table',
  chessTable: 'chess_table',
  ball: 'soccer_ball basketball exercise_ball',
  trampoline: 'kids_trampoline',
  pole: 'dance_pole pole_stage pole_crash_mats',
  barre: 'pull_up_bar wall_mounted_ballet_barre ballet_barre stall_bars_with_pull_up_bar',
  weightRack: 'kettlebell_rack dumbbell_rack',
  tire: 'training_tire',
  stepPlatform: 'aerobic_step_platform',
  darts: 'darts',
  playGym: 'kids_indoor_play_gym kids_climbing_frame',
  playhouse: 'kids_playhouse play_tent dollhouse',
  rockingHorse: 'rocking_horse',
  playpen: 'playpen',
  swing: 'hanging_swing infant_swing',
  stroller: 'toy_cart doll_stroller shopping_carts',
  kidsKitchen: 'kids_kitchen kids_store',
  busyBoard: 'busy_board_activity_board',
  hoop: 'basketball_hoop',
  basket: 'toy_storage_basket shopping_baskets',
  changingTable: 'changing_table',
  workbench: 'kids_tool_table carpentry_bench workbench_with_cabinet_and_pegboard workbench_with_shelves bench_vise bench_grinder clay_rolling_table welding_table tattoo_armrest_work_table',
  checkout: 'conveyor_chekout_station display_checkout_counter cashier_counter',
  pos: 'cash_register_pos_terminal',
  kiosk: 'self_checkout_kiosk self_service_kiosk wall_mounted_kiosk atm vending_machine queue_management_system',
  gate: 'security_gate swing_gate turnstile walk_through_metal_detector',
  queueBarrier: 'queue_barrier',
  signStand: 'brochure_stand banner_stand sidewalk_sign menu_stand hostess_stand',
  scales: 'self_check_scales label_printing_scales medical_scales',
  fittingRoom: 'fitting_room',
  drum: 'trash_can carbon_dioxide_cylinder beer_keg ice_bin commercial_trash_bin garbage_disposal oil_drain_tank tire_lubricant_tank wooden_sauna_bucket herbal_infusion_bucket bath_bucket wall_mounted_pouring_bucket overhead_dousing_bucket_cylinder overhead_dousing_bucket_cascade herbal_steam_barrel hand_sanitizer_stand',
  draftTower: 'draft_tower beer_dispensing_panel',
  medCart: 'ultrasound_system ventilator optical_biopsy_device mobile_exam_light surgical_light intraoral_scanner dental_operating_microscope colposcope multifunction_facial_machine laser_ipl_machine ophthalmology_workstation portable_dental_x_ray mammography_control_workstation',
  trolley: 'salon_trolley instrument_trolley crash_art mobile_dental_mini_table',
  mri: 'mri_scanner dental_cone_beam_ct_cbct dental_x_ray_unit mammography_unit neonatal_incubator horizontal_x_ray_detector vertical_x_ray_detector x_ray_film_viewer x_ray_protective_barrier',
  chamber: 'laboratory_centrifuge steam_sterilizer uv_disinfection_chamber sterilizer chemical_fume_hood spray_booth sandblasting_cabinet muffle_furnace induction_melting_furnace gas_forge coal_forge',
  dryerStand: 'hood_dryer climazon_dryer',
  lathe: 'wood_lathe engine_lathe cnc_lathe',
  saw: 'vertical_band_saw band_saw table_saw drill_press',
  machine: 'plate_rolling_machine pipe_bender belt_grinder universal_milling_machine pottery_wheel ball_mill clay_settling_tank clay_extruder anvil welding_machine cold_forging_press hydraulic_press power_hammer gas_cylinder_cart electrical_generator high_pressure_washer snow_removal lawn_mower motor_cultivator air_compressor',
  carLift: 'two_post_lift four_post_lift scissor_car_lift motorcycle_lift engine_hoist transmission_jack',
  tireMachine: 'wheel_balancer tire_changer wheel_straightening_machine tire_vulcanizer drum_dolly wheel_dolly engine_tilter painting_stand infrared_dryer ac_recharge_station oil_change_station wheel_washer nitrogen_tire_inflator brake_tester headlight_beam_tester parts_washer wheel_alignment_machine',
  car: 'sedan_car suv_car cargo_van utility_trailer kids_electric_car',
  bike: 'motorcycle atv jet_ski_on_trailer snowmobile electric_scooter bicycle bicycle_wall_mount snow_sled_wall_mount',
  tankF: 'water_filtration_system water_storage_tank hydraulic_accumulator pump_station thermal_storage_tank floor_standing_expansion_tank wall_mounted_expansion_tank water_cooler',
  boilerF: 'wall_mounted_heating_boiler floor_standing_heating_boiler electric_heating_boiler floor_standing_water_heater pellet_boiler solid_fuel_boiler',
  tubRound: 'round_soaking_tub square_soaking_tub',
  slats: 'bath_headrest sauna_backrest sauna_floor_mat',
  firewood: 'firewood_rack',
  fireplace: 'fireplace_with_surround corner_fireplace round_island_fireplace island_fireplace electric_fireplace_with_surround electric_fire_place freestanding_electric_fireplace sauna_heater cylindrical_electric_fireplace chimney_pipe chimney_with_water_tank wall_mounted_bioethanol_fireplace floor_bioethanol_fireplace',
  unitBox: 'steam_generator_for_hamam wall_mounted_steam_generator wall_mounted_storage_system shoe_cover_dispenser',
};
// Atsevišķi papildinājumi (ģimenes ar vairākiem simboliem vienā funkcijā).
Object.assign(MAP, {
  makeupStation: 'makeup_station styling_station_with_mirror vanity_table color_bar_station manicure_table',
});

D.makeupStation = function (c, w, d, it) {
  const m = Math.min(w, d);
  R(c, -w / 2, -d / 2, w, d);
  if (has(it, 'color_bar', 'manicure')) {
    if (has(it, 'manicure')) { RR(c, -w * 0.15, d * 0.05, w * 0.3, d * 0.3, m * 0.1); C(c, w * 0.32, -d * 0.2, m * 0.1); L(c, w * 0.32, -d * 0.2, w * 0.1, d * 0.05); }
    else soft(c, () => { for (let i = 0; i < 8; i++) C(c, -w * 0.4 + i * w * 0.115, -d * 0.25, m * 0.06); });
    return;
  }
  tone(c, 0.3, () => R(c, -w * 0.4, -d / 2, w * 0.8, d * 0.1));
  soft(c, () => { for (let i = 0; i < 7; i++) C(c, -w * 0.38 + i * w * 0.127, -d / 2 + d * 0.05, Math.min(d * 0.04, m * 0.04)); });
  soft(c, () => { C(c, -w * 0.2, d * 0.05, m * 0.06); RR(c, w * 0.1, -d * 0.05, w * 0.12, d * 0.2, 1); });
};
draw.makeupStation = (c, w, d, it) => { if (!(w > 0) || !(d > 0)) return; c.save(); try { D.makeupStation(c, w, d, it); } catch { /* */ } c.restore(); };

export const assign = {};
for (const [fam, keys] of Object.entries(MAP)) {
  if (!keys || !draw[fam]) continue;
  for (const k of keys.split(/\s+/)) if (k) assign[k] = fam;
}
