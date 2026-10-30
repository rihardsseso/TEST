// Mēbeļu, santehnikas un elektroinstalācijas katalogs ar 2D simboliem un vienkāršiem 3D modeļiem.
// Izmēri cm: w – platums, d – dziļums, h – augstums, elev – augstums no grīdas.
// Pilnais katalogs (ITEMS) ir ģenerēts catalog-data.js; šeit — simboli, 3D modeļi un vecā parauga katalogs.
import { ITEMS } from './catalog-data.js';
import * as symFurniture from './sym-furniture.js';
import * as symTech from './sym-tech.js';

export const CATEGORIES = [
  { id: 'building', name: 'Ēkas elementi' },
  { id: 'heating', name: 'Apkure' },
  { id: 'living', name: 'Dzīvojamā istaba' },
  { id: 'bedroom', name: 'Guļamistaba' },
  { id: 'kitchen', name: 'Virtuve' },
  { id: 'other', name: 'Dekors' },
  { id: 'bath', name: 'Santehnika' },
  { id: 'water', name: 'Ūdensapgāde' },
  { id: 'sockets', name: 'Rozetes' },
  { id: 'switches', name: 'Slēdži' },
  { id: 'lighting', name: 'Apgaismojums' },
  { id: 'wiring', name: 'Elektroinstalācija' },
];

// 2D zīmēšana notiek lokālajās koordinātās: centrs (0,0), x ∈ [-w/2, w/2], y ∈ [-d/2, d/2],
// priekšpuse ir +y virzienā, aizmugure (pie sienas) –y virzienā.
const R = (c, x, y, w, h) => { c.beginPath(); c.rect(x, y, w, h); c.fill(); c.stroke(); };
const C = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke(); };
const L = (c, ...p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); };
const RR = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); c.stroke(); };
const E = (c, x, y, rx, ry) => { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); c.stroke(); };

const draw = {
  box: (c, w, d) => R(c, -w / 2, -d / 2, w, d),
  sofa(c, w, d) {
    RR(c, -w / 2, -d / 2, w, d, 6);
    R(c, -w / 2, -d / 2, w, d * 0.25);
    R(c, -w / 2, -d / 2, w * 0.1, d);
    R(c, w / 2 - w * 0.1, -d / 2, w * 0.1, d);
    const n = w > 180 ? 3 : 2, sw = (w * 0.8) / n;
    for (let i = 1; i < n; i++) L(c, -w * 0.4 + sw * i, -d / 4, -w * 0.4 + sw * i, d / 2);
  },
  armchair(c, w, d) {
    RR(c, -w / 2, -d / 2, w, d, 6);
    R(c, -w / 2, -d / 2, w, d * 0.28);
    R(c, -w / 2, -d / 2, w * 0.18, d);
    R(c, w / 2 - w * 0.18, -d / 2, w * 0.18, d);
  },
  table(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    L(c, -w / 2 + 6, -d / 2 + 6, w / 2 - 6, -d / 2 + 6, w / 2 - 6, d / 2 - 6, -w / 2 + 6, d / 2 - 6, -w / 2 + 6, -d / 2 + 6);
  },
  roundTable: (c, w, d) => E(c, 0, 0, w / 2, d / 2),
  chair(c, w, d) {
    RR(c, -w / 2, -d / 2 + d * 0.15, w, d * 0.85, 4);
    R(c, -w / 2, -d / 2, w, d * 0.15);
  },
  bed(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    R(c, -w / 2, -d / 2, w, 8);
    const pw = w > 120 ? (w - 30) / 2 : w - 20;
    RR(c, -w / 2 + 10, -d / 2 + 14, pw, 34, 8);
    if (w > 120) RR(c, w / 2 - 10 - pw, -d / 2 + 14, pw, 34, 8);
    L(c, -w / 2, -d / 2 + 70, w / 2, -d / 2 + 60);
  },
  wardrobe(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    L(c, -w / 2, d / 2 - 4, w / 2, d / 2 - 4);
    const n = Math.max(1, Math.round(w / 50));
    for (let i = 1; i < n; i++) L(c, -w / 2 + (w / n) * i, -d / 2, -w / 2 + (w / n) * i, d / 2 - 4);
    L(c, -w / 2, -d / 2, w / 2, d / 2 - 4);
  },
  shelf(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    L(c, -w / 2, 0, w / 2, 0);
  },
  tv(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    R(c, -w * 0.35, -d / 2 + 2, w * 0.7, 4);
  },
  counter(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    L(c, -w / 2, d / 2 - 5, w / 2, d / 2 - 5);
  },
  stove(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    const r = Math.min(w, d) * 0.16;
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) C(c, x * w * 0.22, y * d * 0.2, r);
  },
  fridge(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    L(c, -w / 2, d / 2 - 6, w / 2, d / 2 - 6);
    L(c, -w / 2 + 6, -d / 2 + 6, w / 2 - 6, d / 2 - 12);
    L(c, w / 2 - 6, -d / 2 + 6, -w / 2 + 6, d / 2 - 12);
  },
  sinkKitchen(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    RR(c, -w * 0.4, -d * 0.3, w * 0.5, d * 0.62, 5);
    C(c, -w * 0.15, -d * 0.36, 2.5);
  },
  bath(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    RR(c, -w / 2 + 7, -d / 2 + 7, w - 14, d - 14, Math.min(w, d) * 0.35);
    C(c, -w / 2 + 16, 0, 3);
  },
  shower(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    L(c, -w / 2, -d / 2, w / 2, d / 2);
    L(c, w / 2, -d / 2, -w / 2, d / 2);
    C(c, 0, 0, 4);
  },
  toilet(c, w, d) {
    R(c, -w / 2, -d / 2, w, d * 0.3);
    E(c, 0, d * 0.15, w * 0.42, d * 0.36);
  },
  basin(c, w, d) {
    RR(c, -w / 2, -d / 2, w, d, 4);
    E(c, 0, d * 0.05, w * 0.36, d * 0.32);
    C(c, 0, -d * 0.36, 2.5);
  },
  washer(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    C(c, 0, d * 0.05, Math.min(w, d) * 0.32);
  },
  radiator(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    for (let x = -w / 2 + 8; x < w / 2; x += 8) L(c, x, -d / 2, x, d / 2);
  },
  plant(c, w) {
    C(c, 0, 0, w / 2);
    for (let a = 0; a < 6; a++) {
      const r = (a * Math.PI) / 3;
      L(c, 0, 0, Math.cos(r) * w * 0.45, Math.sin(r) * w * 0.45);
    }
  },
  stairs(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    const n = Math.round(d / 28);
    for (let i = 1; i < n; i++) L(c, -w / 2, -d / 2 + (d / n) * i, w / 2, -d / 2 + (d / n) * i);
    L(c, 0, d / 2 - 10, 0, -d / 2 + 10, -8, -d / 2 + 22);
    L(c, 0, -d / 2 + 10, 8, -d / 2 + 22);
  },
  socket(c, w, d) {
    c.beginPath(); c.arc(0, d / 2 - w / 2, w / 2, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
    L(c, 0, -d / 2, 0, d / 2 - w / 2);
  },
  switch(c, w, d) {
    C(c, 0, d * 0.15, w * 0.32);
    L(c, w * 0.18, d * 0.05, w * 0.5, -d / 2);
  },
  light(c, w) {
    C(c, 0, 0, w / 2);
    L(c, -w * 0.35, -w * 0.35, w * 0.35, w * 0.35);
    L(c, w * 0.35, -w * 0.35, -w * 0.35, w * 0.35);
  },
  spot(c, w) {
    C(c, 0, 0, w / 2);
    C(c, 0, 0, w / 5);
  },
  socket2(c, w, d) {
    for (const x of [-w / 4, w / 4]) {
      c.beginPath(); c.arc(x, d / 2 - w / 4, w / 4, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
    }
    L(c, -w / 4, -d / 2, -w / 4, d / 2 - w / 4);
    L(c, w / 4, -d / 2, w / 4, d / 2 - w / 4);
  },
  socketTV(c, w, d) {
    draw.socket(c, w, d);
    L(c, -w / 2, -d / 2, w / 2, -d / 2);
  },
  socketNet(c, w, d) {
    draw.socket(c, w, d);
    L(c, -w / 2, d / 2 - w / 2, 0, -d / 2, w / 2, d / 2 - w / 2);
  },
  switch2(c, w, d) {
    C(c, 0, d * 0.15, w * 0.32);
    L(c, w * 0.1, d * 0.0, w * 0.35, -d / 2);
    L(c, -w * 0.1, d * 0.0, -w * 0.35, -d / 2);
  },
  switchPass(c, w, d) {
    C(c, 0, 0, w * 0.32);
    L(c, -w * 0.5, d / 2, w * 0.5, -d / 2);
  },
  sconce(c, w, d) {
    c.beginPath(); c.arc(0, -d / 2, w / 2, 0, Math.PI); c.closePath(); c.fill(); c.stroke();
    L(c, -w / 2, -d / 2, w / 2, -d / 2);
  },
  chandelier(c, w) {
    C(c, 0, 0, w * 0.12);
    for (let a = 0; a < 6; a++) {
      const r = (a * Math.PI) / 3;
      L(c, Math.cos(r) * w * 0.12, Math.sin(r) * w * 0.12, Math.cos(r) * w * 0.36, Math.sin(r) * w * 0.36);
      C(c, Math.cos(r) * w * 0.42, Math.sin(r) * w * 0.42, w * 0.08);
    }
  },
  towel(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    for (let x = -w / 2 + w / 4; x < w / 2; x += w / 4) L(c, x, -d / 2, x, d / 2);
  },
  boiler(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    C(c, 0, 0, Math.min(w, d) * 0.3);
  },
  manifold(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    for (let x = -w / 2 + 8; x < w / 2; x += 10) C(c, x, 0, Math.min(3, d / 3));
  },
  water(c, w, d, it) {
    C(c, 0, 0, w / 2);
    const kind = byKind(it?.kind)?.water || it?.kind;
    const letter = { wcold: 'A', whot: 'K', sewer: 'N', cold: 'A', hot: 'K' }[kind] || '';
    c.save();
    c.fillStyle = c.strokeStyle;
    c.font = `600 ${w * 0.7}px sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(letter, 0, w * 0.04);
    c.restore();
  },
  junction(c, w) {
    C(c, 0, 0, w / 2);
    L(c, -w * 0.35, -w * 0.35, w * 0.35, w * 0.35);
  },
  panel(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    c.beginPath(); c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, d / 2); c.lineTo(-w / 2, d / 2); c.closePath();
    const f = c.fillStyle; c.fillStyle = c.strokeStyle; c.fill(); c.fillStyle = f;
  },
  cornerSofa(c, w, d) {
    const a = Math.min(w, d) * 0.5;
    c.beginPath();
    c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.lineTo(w / 2, -d / 2 + a); c.lineTo(-w / 2 + a, -d / 2 + a);
    c.lineTo(-w / 2 + a, d / 2); c.lineTo(-w / 2, d / 2); c.closePath(); c.fill(); c.stroke();
    R(c, -w / 2, -d / 2, w, a * 0.3);
    R(c, -w / 2, -d / 2, a * 0.3, d);
  },
  pouf: (c, w, d) => RR(c, -w / 2, -d / 2, w, d, Math.min(w, d) * 0.25),
  stool: (c, w) => C(c, 0, 0, w / 2),
  officeChair(c, w, d) {
    C(c, 0, d * 0.05, w * 0.4);
    RR(c, -w * 0.38, -d / 2, w * 0.76, d * 0.2, 4);
  },
  bench(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    for (let x = -w / 2 + w / 4; x < w / 2; x += w / 4) L(c, x, -d / 2, x, d / 2);
  },
  deskL(c, w, d) {
    const a = Math.min(w, d) * 0.45;
    c.beginPath();
    c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.lineTo(w / 2, -d / 2 + a); c.lineTo(-w / 2 + a, -d / 2 + a);
    c.lineTo(-w / 2 + a, d / 2); c.lineTo(-w / 2, d / 2); c.closePath(); c.fill(); c.stroke();
  },
  tvWall(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    L(c, -w * 0.45, d / 2, w * 0.45, d / 2);
  },
  bunk(c, w, d) {
    draw.bed(c, w, d);
    L(c, -w / 2, -d / 2, w / 2, d / 2);
    L(c, w / 2, -d / 2, -w / 2, d / 2);
  },
  mirror(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    L(c, -w / 2, d / 2, w / 2, -d / 2);
  },
  bar(c, w, d) {
    L(c, -w / 2, 0, w / 2, 0);
    C(c, -w / 2, 0, d / 3);
    C(c, w / 2, 0, d / 3);
  },
  smallbox: (c, w, d) => RR(c, -w / 2, -d / 2, w, d, 3),
  faucet(c, w, d) {
    C(c, 0, -d * 0.2, Math.min(w, d) * 0.35);
    L(c, 0, -d * 0.2, 0, d / 2);
  },
  urinal(c, w, d) {
    c.beginPath(); c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.quadraticCurveTo(w / 2, d / 2, 0, d / 2); c.quadraticCurveTo(-w / 2, d / 2, -w / 2, -d / 2); c.fill(); c.stroke();
  },
  bidet(c, w, d) {
    E(c, 0, 0, w * 0.45, d * 0.45);
    C(c, 0, -d * 0.2, 2);
  },
  drain(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    for (let x = -w / 2 + 4; x < w / 2; x += 4) L(c, x, -d / 2 + 1, x, d / 2 - 1);
  },
  hood(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    c.setLineDash?.([4, 3]);
    L(c, -w / 2, -d / 2, w / 2, d / 2);
    L(c, w / 2, -d / 2, -w / 2, d / 2);
    c.setLineDash?.([]);
  },
  piano(c, w, d) {
    if (d > w) {
      c.beginPath(); c.moveTo(-w / 2, -d / 2); c.lineTo(w / 2, -d / 2); c.lineTo(w / 2, 0); c.quadraticCurveTo(w / 2, d / 2, 0, d / 2); c.lineTo(-w / 2, d / 2); c.closePath(); c.fill(); c.stroke();
    } else R(c, -w / 2, -d / 2, w, d);
    R(c, -w * 0.45, -d / 2, w * 0.9, Math.min(d, 60) * 0.25);
  },
  poolTable(c, w, d) {
    RR(c, -w / 2, -d / 2, w, d, 6);
    R(c, -w / 2 + 8, -d / 2 + 8, w - 16, d - 16);
    for (const [x, y] of [[-1, -1], [0, -1], [1, -1], [-1, 1], [0, 1], [1, 1]]) C(c, x * (w / 2 - 8), y * (d / 2 - 8), 3);
  },
  gym(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    R(c, -w * 0.4, -d * 0.35, w * 0.8, d * 0.7);
    C(c, 0, 0, Math.min(w, d) * 0.15);
  },
  car(c, w, d) {
    const [L2, W2] = w > d ? [w, d] : [d, w];
    c.save();
    if (d > w) c.rotate(Math.PI / 2);
    RR(c, -L2 / 2, -W2 / 2, L2, W2, W2 * 0.25);
    RR(c, -L2 * 0.15, -W2 * 0.4, L2 * 0.4, W2 * 0.8, 6);
    c.restore();
  },
  fireplace(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    c.beginPath(); c.moveTo(-w * 0.3, d / 2); c.lineTo(-w * 0.2, -d * 0.1); c.lineTo(w * 0.2, -d * 0.1); c.lineTo(w * 0.3, d / 2); c.stroke();
  },
  curtain(c, w, d) {
    c.beginPath();
    c.moveTo(-w / 2, 0);
    for (let x = -w / 2; x < w / 2; x += 10) c.quadraticCurveTo(x + 2.5, -d / 2, x + 5, 0), c.quadraticCurveTo(x + 7.5, d / 2, x + 10, 0);
    c.stroke();
  },
  stairsL(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    const a = Math.min(w, d) * 0.45;
    L(c, -w / 2 + a, d / 2, -w / 2 + a, -d / 2 + a, w / 2, -d / 2 + a);
    for (let y = -d / 2 + a + 28; y < d / 2; y += 28) L(c, -w / 2, y, -w / 2 + a, y);
    for (let x = -w / 2 + a + 28; x < w / 2; x += 28) L(c, x, -d / 2, x, -d / 2 + a);
  },
  stairsU(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    L(c, 0, d / 2, 0, -d / 2 + w * 0.45);
    L(c, -w / 2, -d / 2 + w * 0.45, w / 2, -d / 2 + w * 0.45);
    for (let y = -d / 2 + w * 0.45 + 28; y < d / 2; y += 28) L(c, -w / 2, y, w / 2, y);
  },
  spiral(c, w) {
    C(c, 0, 0, w / 2);
    C(c, 0, 0, w * 0.08);
    for (let a = 0; a < 12; a++) {
      const r = (a * Math.PI) / 6;
      L(c, Math.cos(r) * w * 0.08, Math.sin(r) * w * 0.08, Math.cos(r) * w / 2, Math.sin(r) * w / 2);
    }
  },
  elevator(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    L(c, -w / 2, -d / 2, w / 2, d / 2);
    L(c, w / 2, -d / 2, -w / 2, d / 2);
  },
  riser(c, w) {
    C(c, 0, 0, w / 2);
    C(c, 0, 0, w / 4);
  },
  shaft(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    L(c, -w / 2, -d / 2, w / 2, d / 2);
    L(c, w / 2, -d / 2, -w / 2, d / 2);
    R(c, -w / 2 + 4, -d / 2 + 4, w - 8, d - 8);
  },
  grille(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    for (let y = -d / 2 + 3; y < d / 2; y += 3) L(c, -w / 2 + 2, y, w / 2 - 2, y);
  },
  sensor(c, w) {
    C(c, 0, 0, w / 2);
    C(c, 0, 0, w / 6);
  },
  camera(c, w, d) {
    c.beginPath(); c.moveTo(0, -d / 2); c.lineTo(w / 2, d / 2); c.lineTo(-w / 2, d / 2); c.closePath(); c.fill(); c.stroke();
  },
  extinguisher(c, w) {
    C(c, 0, 0, w / 2);
    L(c, -w * 0.25, -w * 0.25, w * 0.25, w * 0.25);
  },
  acIndoor(c, w, d) {
    RR(c, -w / 2, -d / 2, w, d, 4);
    for (let x = -w / 2 + 8; x < w / 2 - 4; x += 8) L(c, x, d * 0.1, x + 4, d / 2 - 2);
  },
  acCassette(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    R(c, -w * 0.3, -d * 0.3, w * 0.6, d * 0.6);
    L(c, -w / 2, -d / 2, -w * 0.3, -d * 0.3); L(c, w / 2, -d / 2, w * 0.3, -d * 0.3);
    L(c, -w / 2, d / 2, -w * 0.3, d * 0.3); L(c, w / 2, d / 2, w * 0.3, d * 0.3);
  },
  acOutdoor(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    C(c, -w * 0.12, 0, Math.min(w, d) * 0.38);
  },
  fan(c, w) {
    C(c, 0, 0, w * 0.1);
    for (let a = 0; a < 3; a++) {
      const r = (a * 2 * Math.PI) / 3;
      E(c, Math.cos(r) * w * 0.28, Math.sin(r) * w * 0.28, w * 0.18, w * 0.07);
    }
  },
  floorlamp(c, w) {
    C(c, 0, 0, w / 2);
    C(c, 0, 0, w / 8);
  },
  track(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    for (const x of [-w * 0.3, 0, w * 0.3]) C(c, x, 0, d * 0.45);
  },
  waterGroup(c, w, d, it) {
    const n = 3, r = Math.min(w / n, d) / 2;
    ['A', 'K', 'N'].forEach((letter, i) => {
      const x = -w / 2 + r + i * (w - 2 * r) / (n - 1);
      C(c, x, 0, r);
      c.save(); c.fillStyle = c.strokeStyle; c.font = `600 ${r * 1.3}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(letter, x, r * 0.08); c.restore();
    });
  },
  node(c, w) {
    c.beginPath(); c.arc(0, 0, w / 2, 0, Math.PI * 2);
    const f = c.fillStyle; c.fillStyle = c.strokeStyle; c.fill(); c.fillStyle = f;
  },
  column(c, w, d) {
    R(c, -w / 2, -d / 2, w, d);
    L(c, -w / 2, -d / 2, w / 2, d / 2);
    L(c, w / 2, -d / 2, -w / 2, d / 2);
  },
  start(c, w) {
    C(c, 0, 0, w / 2);
    L(c, -w / 2, 0, w / 2, 0);
    L(c, 0, -w / 2, 0, w / 2);
  },
};

// 3D modeļi tiek būvēti no kastēm; `part(x, y, z, w, h, d, color)` — centrs cm lokālajās koordinātās
// (x pa platumu, y uz augšu no grīdas, z uz priekšu).
const box = (w, d, h) => [[0, h / 2, 0, w, h, d]];
const build = {
  box: (it) => box(it.w, it.d, it.h),
  sofa: (it) => {
    const { w, d, h } = it;
    return [
      [0, 22, 0, w, 44, d],
      [0, h / 2 + 10, -d / 2 + d * 0.12, w, h - 20, d * 0.24],
      [-w / 2 + w * 0.05, 32, 0, w * 0.1, 64, d],
      [w / 2 - w * 0.05, 32, 0, w * 0.1, 64, d],
    ];
  },
  armchair: (it) => build.sofa(it),
  table: (it) => {
    const { w, d, h } = it, t = 4, l = 5;
    const legs = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => [sx * (w / 2 - l), (h - t) / 2, sz * (d / 2 - l), l, h - t, l, 'dark']);
    return [[0, h - t / 2, 0, w, t, d], ...legs];
  },
  roundTable: (it) => [[0, it.h - 2, 0, it.w, 4, it.d, null, 'cyl'], [0, (it.h - 4) / 2, 0, 8, it.h - 4, 8, 'dark', 'cyl']],
  chair: (it) => {
    const { w, d, h } = it;
    return [
      ...build.table({ w, d, h: 46 }),
      [0, 46 + (h - 46) / 2, -d / 2 + 2, w, h - 46, 4],
    ];
  },
  bed: (it) => {
    const { w, d } = it;
    return [
      [0, 15, 0, w, 30, d, 'dark'],
      [0, 40, 4, w - 4, 20, d - 8, 'white'],
      [0, 55, -d / 2 + 4, w, 110, 8, 'dark'],
    ];
  },
  chandelier: (it) => [[0, it.h / 2, 0, it.w, it.h * 0.6, it.w, 'white', 'sphere', 'light']],
  sconce: (it) => [[0, 0, -it.d / 4, it.w, it.h, it.d / 2, 'white', 'sphere', 'light']],
  plant: (it) => [[0, 15, 0, it.w * 0.5, 30, it.w * 0.5, 'pot', 'cyl'], [0, 30 + (it.h - 30) / 2, 0, it.w, it.h - 30, it.w, null, 'sphere']],
  light: (it) => [[0, 0, 0, it.w, it.w * 0.6, it.w, 'white', 'sphere', 'light']],
  spot: (it) => [[0, 0, 0, it.w, 3, it.w, 'white', 'cyl', 'light']],
  bath: (it) => box(it.w, it.d, it.h),
  toilet: (it) => [[0, 20, it.d * 0.1, it.w * 0.8, 40, it.d * 0.75, null, 'cyl'], [0, 55, -it.d / 2 + it.d * 0.15, it.w, 40, it.d * 0.3]],
  basin: (it) => [[0, it.h / 2, 0, it.w, it.h, it.d]],
  cornerSofa: (it) => {
    const a = Math.min(it.w, it.d) * 0.5;
    return [[0, 22, -it.d / 2 + a / 2, it.w, 44, a], [-it.w / 2 + a / 2, 22, a / 2, a, 44, it.d - a], [0, 55, -it.d / 2 + 6, it.w, 70, 12], [-it.w / 2 + 6, 55, 0, 12, 70, it.d]];
  },
  deskL: (it) => {
    const a = Math.min(it.w, it.d) * 0.45;
    return [[0, it.h - 2, -it.d / 2 + a / 2, it.w, 4, a], [-it.w / 2 + a / 2, it.h - 2, a / 2, a, 4, it.d - a], [0, (it.h - 4) / 2, -it.d / 2 + 4, it.w - 10, it.h - 4, 4, 'dark']];
  },
  bunk: (it) => [...build.bed({ ...it }), [0, 135, 0, it.w, 20, it.d, 'white'], [0, 120, 0, it.w + 4, 8, it.d + 4, 'dark']],
  officeChair: (it) => [[0, 45, 0, it.w * 0.8, 8, it.d * 0.8, null, 'cyl'], [0, 22, 0, 6, 44, 6, 'dark', 'cyl'], [0, 80, -it.d / 2 + 6, it.w * 0.75, 55, 6]],
  stool: (it) => [[0, it.h - 3, 0, it.w, 6, it.d, null, 'cyl'], [0, (it.h - 6) / 2, 0, 5, it.h - 6, 5, 'dark', 'cyl']],
  pouf: (it) => [[0, it.h / 2, 0, it.w, it.h, it.d, null, 'cyl']],
  floorlamp: (it) => [[0, it.h - 15, 0, it.w, 30, it.w, 'white', 'cyl', 'light'], [0, (it.h - 30) / 2, 0, 3, it.h - 30, 3, 'dark', 'cyl']],
  poolTable: (it) => build.table(it),
  fan: (it) => [[0, 0, 0, it.w, 3, it.w, null, 'cyl']],
  riser: (it) => [[0, it.h / 2, 0, it.w, it.h, it.w, null, 'cyl']],
  stool2: (it) => box(it.w, it.d, it.h),
  stairs: (it) => {
    const n = Math.max(2, Math.round(it.d / 28)), sd = it.d / n, sh = it.h / n;
    return Array.from({ length: n }, (_, i) => [0, sh * (i + 0.5), it.d / 2 - sd * (i + 0.5), it.w, sh, sd]);
  },
};

const item = (kind, name, cat, w, d, h, color, sym, extra = {}) => ({ kind, name, cat, w, d, h, color, sym: sym || 'box', elev: 0, ...extra });

export const CATALOG = [
  item('sofa3', 'Dīvāns, 3 vietas', 'living', 220, 95, 85, '#7b8a9a', 'sofa'),
  item('sofa2', 'Dīvāns, 2 vietas', 'living', 160, 90, 85, '#8a9a7b', 'sofa'),
  item('armchair', 'Atpūtas krēsls', 'living', 85, 85, 85, '#a08670', 'armchair'),
  item('coffee', 'Žurnālgaldiņš', 'living', 110, 60, 45, '#b58c5e', 'table'),
  item('tvstand', 'TV skapītis', 'living', 180, 45, 50, '#4b4f55', 'tv'),
  item('bookshelf', 'Grāmatplaukts', 'living', 100, 35, 200, '#c9a477', 'shelf'),
  item('dtable', 'Pusdienu galds', 'living', 160, 90, 75, '#b58c5e', 'table'),
  item('rtable', 'Apaļš galds', 'living', 100, 100, 75, '#b58c5e', 'roundTable'),
  item('chair', 'Krēsls', 'living', 45, 50, 90, '#5d6670', 'chair'),
  item('bed160', 'Gulta 160×200', 'bedroom', 170, 210, 100, '#d8d2c8', 'bed'),
  item('bed90', 'Gulta 90×200', 'bedroom', 100, 210, 90, '#d8d2c8', 'bed'),
  item('night', 'Naktsskapītis', 'bedroom', 45, 40, 50, '#c9a477', 'box'),
  item('wardrobe', 'Drēbju skapis', 'bedroom', 200, 60, 230, '#e7e1d6', 'wardrobe'),
  item('desk', 'Rakstāmgalds', 'bedroom', 120, 60, 75, '#c9a477', 'table'),
  item('dresser', 'Kumode', 'bedroom', 100, 45, 85, '#c9a477', 'shelf'),
  item('kcounter', 'Virtuves skapis 60', 'kitchen', 60, 60, 90, '#e9e6df', 'counter'),
  item('kcounter120', 'Virtuves skapis 120', 'kitchen', 120, 60, 90, '#e9e6df', 'counter'),
  item('stove', 'Plīts', 'kitchen', 60, 60, 90, '#3b3e43', 'stove'),
  item('fridge', 'Ledusskapis', 'kitchen', 60, 65, 200, '#d9dde2', 'fridge'),
  item('ksink', 'Virtuves izlietne', 'kitchen', 80, 60, 90, '#e9e6df', 'sinkKitchen'),
  item('wallcab', 'Augšējais skapis', 'kitchen', 80, 35, 70, '#e9e6df', 'counter', { elev: 145 }),
  item('bath170', 'Vanna 170×75', 'bath', 170, 75, 55, '#f4f6f8', 'bath'),
  item('shower', 'Dušas kabīne', 'bath', 90, 90, 200, '#cfe3ef', 'shower'),
  item('wc', 'Tualetes pods', 'bath', 40, 65, 80, '#f4f6f8', 'toilet'),
  item('basin', 'Izlietne', 'bath', 60, 48, 85, '#f4f6f8', 'basin'),
  item('washer', 'Veļas mašīna', 'bath', 60, 60, 85, '#eef0f2', 'washer'),
  item('wcold', 'Aukstā ūdens izvads', 'water', 10, 6, 8, '#d9e8fb', 'water', { elev: 60, water: 'cold' }),
  item('whot', 'Karstā ūdens izvads', 'water', 10, 6, 8, '#fbdcd9', 'water', { elev: 60, water: 'hot' }),
  item('sewer', 'Kanalizācijas izvads', 'water', 12, 8, 12, '#e4e4e4', 'water', { elev: 40, water: 'sewer' }),
  item('radiator', 'Radiators', 'heating', 80, 10, 60, '#f0f0f0', 'radiator', { elev: 15 }),
  item('towel', 'Dvieļu žāvētājs', 'heating', 50, 10, 80, '#e8e8e8', 'towel', { elev: 90 }),
  item('boiler', 'Apkures katls', 'heating', 45, 35, 75, '#f4f4f4', 'boiler', { elev: 120 }),
  item('manifold', 'Siltās grīdas kolektors', 'heating', 60, 10, 50, '#d8d8d8', 'manifold', { elev: 30 }),
  item('socket', 'Rozete', 'sockets', 10, 6, 8, '#ffffff', 'socket', { elev: 30, electric: 'socket' }),
  item('socket2', 'Dubultrozete', 'sockets', 16, 6, 8, '#ffffff', 'socket2', { elev: 30, electric: 'socket' }),
  item('socketTV', 'TV rozete', 'sockets', 10, 6, 8, '#ffffff', 'socketTV', { elev: 30, electric: 'weak' }),
  item('socketNet', 'Datortīkla rozete', 'sockets', 10, 6, 8, '#ffffff', 'socketNet', { elev: 30, electric: 'weak' }),
  item('switch', 'Slēdzis', 'switches', 10, 6, 8, '#ffffff', 'switch', { elev: 90, electric: 'switch' }),
  item('switch2', 'Divu taustiņu slēdzis', 'switches', 10, 6, 8, '#ffffff', 'switch2', { elev: 90, electric: 'switch' }),
  item('switchPass', 'Caurstaigājamais slēdzis', 'switches', 10, 6, 8, '#ffffff', 'switchPass', { elev: 90, electric: 'switch' }),
  item('light', 'Griestu lampa', 'lighting', 40, 40, 25, '#fff3c4', 'light', { elev: 230, electric: 'light' }),
  item('chandelier', 'Lustra', 'lighting', 70, 70, 60, '#fff3c4', 'chandelier', { elev: 200, electric: 'light' }),
  item('spot', 'Iebūvējamais gaismeklis', 'lighting', 12, 12, 3, '#fff3c4', 'spot', { elev: 267, electric: 'light' }),
  item('sconce', 'Sienas gaismeklis', 'lighting', 20, 12, 20, '#fff3c4', 'sconce', { elev: 180, electric: 'light' }),
  item('junction', 'Sadales kārba', 'wiring', 10, 6, 10, '#ffffff', 'junction', { elev: 240, electric: 'box' }),
  item('panel', 'Elektrības sadalne', 'wiring', 40, 12, 50, '#f2f2f2', 'panel', { elev: 140, electric: 'panel' }),
  item('plant', 'Augs', 'other', 45, 45, 120, '#5e8a4f', 'plant'),
  item('stairs', 'Kāpnes', 'building', 100, 300, 270, '#b58c5e', 'stairs'),
  item('column', 'Kolonna', 'building', 30, 30, 270, '#c8c8c8', 'box'),
];

// Ģimeņu noklusējuma krāsas ģenerētajiem priekšmetiem.
const FAMILY_COLORS = {
  sofa: '#7b8a9a', cornerSofa: '#7b8a9a', armchair: '#a08670', pouf: '#b59a7a', bed: '#d8d2c8', bunk: '#d8d2c8', chair: '#5d6670', stool: '#5d6670',
  officeChair: '#444a52', bench: '#c9a477', table: '#c49a6c', roundTable: '#c49a6c', deskL: '#c49a6c', wardrobe: '#e7e1d6', shelf: '#d8c3a5',
  counter: '#e9e6df', tv: '#4b4f55', tvWall: '#2b2e33', fridge: '#d9dde2', stove: '#3b3e43', hood: '#cfd3d8', sinkKitchen: '#e9e6df', basin: '#f4f6f8',
  bath: '#f4f6f8', shower: '#cfe3ef', toilet: '#f4f6f8', bidet: '#f4f6f8', urinal: '#f4f6f8', washer: '#eef0f2', boiler: '#f0f0f0', radiator: '#f0f0f0',
  towel: '#e8e8e8', faucet: '#c9ced3', drain: '#c9ced3', mirror: '#dcecf7', bar: '#c9ced3', plant: '#5e8a4f', piano: '#2b2e33', poolTable: '#2f7d4f',
  gym: '#6b737b', car: '#9aa6b2', fireplace: '#9c8c7c', curtain: '#d9cbb3', stairs: '#c49a6c', stairsL: '#c49a6c', stairsU: '#c49a6c', spiral: '#c49a6c',
  elevator: '#c8c8c8', riser: '#9fb7cf', shaft: '#d9d9d9', grille: '#eeeeee', sensor: '#ffffff', camera: '#ffffff', extinguisher: '#e05a4f',
  acIndoor: '#f4f6f8', acCassette: '#f4f6f8', acOutdoor: '#e3e6e9', fan: '#e3e6e9', floorlamp: '#fff3c4', track: '#f4f6f8', socket: '#ffffff',
  switch: '#ffffff', junction: '#ffffff', panel: '#f2f2f2', chandelier: '#fff3c4', spot: '#fff3c4', light: '#fff3c4', sconce: '#fff3c4',
  water: '#d9e8fb', waterGroup: '#e8eef6', manifold: '#d8d8d8', node: '#333333', column: '#c8c8c8', start: '#ffffff', smallbox: '#d6d9dc', box: '#d9d4cb',
};
// Vecā kataloga kategorijas → stadijas (slānis), kurā priekšmets rediģējams.
const LEGACY_STAGE = { building: 'init', heating: 'radiators', living: 'furniture', bedroom: 'furniture', kitchen: 'furniture', other: 'furniture', bath: 'santeh', water: 'waterplan', sockets: 'sockets', switches: 'light_connections', lighting: 'light', wiring: 'cables' };

// Papildu simbolu moduļi: jaunas simbolu ģimenes un to piesaiste konkrētiem priekšmetiem.
const ASSIGN = {};
for (const m of [symFurniture, symTech]) {
  Object.assign(draw, m.draw);
  Object.assign(build, m.build);
  Object.assign(FAMILY_COLORS, m.colors);
  Object.assign(ASSIGN, m.assign);
}

const defCache = new Map();
/** Priekšmeta definīcija pēc tipa (vecais katalogs vai ģenerētais ITEMS). */
export function byKind(kind) {
  if (defCache.has(kind)) return defCache.get(kind);
  let def = CATALOG.find((c) => c.kind === kind);
  if (def) def = { ...def, sym: ASSIGN[kind] || def.sym, stage: LEGACY_STAGE[def.cat] || 'furniture' };
  else if (ITEMS[kind]) {
    const g = ITEMS[kind];
    const fam = ASSIGN[kind] || g.fam;
    def = { kind, name: g.name, w: g.w, d: g.d, h: g.h, elev: g.elev, color: FAMILY_COLORS[fam] || FAMILY_COLORS[g.fam] || '#d9d4cb', sym: fam, stage: g.stage, cat: g.stage, electric: g.electric, water: g.water };
  }
  defCache.set(kind, def || null);
  return def || null;
}

export function drawItem2D(ctx, it) {
  const def = byKind(it.kind);
  const fn = draw[def?.sym] || draw.box;
  fn(ctx, it.w, it.d, it);
}

/** Mazi sienas punkti (rozetes, slēdži, izvadi), kas ekrānā jāzīmē palielināti. */
export const isPoint = (it) => {
  const def = byKind(it.kind);
  return !!(def && (def.electric || def.water || ['sensor', 'camera', 'node', 'grille', 'riser', 'faucet'].includes(def.sym)) && Math.max(def.w, def.d) <= 30);
};

/** Vai simbolā ierakstīt nosaukumu (vispārīgiem taisnstūriem bez sava simbola). */
export const needsLabel = (it) => ['box', 'smallbox', 'gym', 'counter', 'shelf'].includes(byKind(it.kind)?.sym);

export function parts3D(it) {
  const def = byKind(it.kind);
  const fn = build[def?.sym] || build.box;
  return fn(it);
}

export const isElectric = (it) => byKind(it.kind)?.electric;
/** Slānis (stadija), kurā priekšmets tika ievietots un kurā to var rediģēt. */
export const categoryOf = (it) => it.layer || byKind(it.kind)?.stage || 'furniture';

export const FLOOR_FINISHES = [
  { id: 'parquet', name: 'Parkets', color: '#c9a477' },
  { id: 'laminate', name: 'Lamināts', color: '#b89773' },
  { id: 'tile', name: 'Flīzes', color: '#d7d9db' },
  { id: 'darktile', name: 'Tumšas flīzes', color: '#7d8186' },
  { id: 'carpet', name: 'Paklājs', color: '#9aa39a' },
  { id: 'concrete', name: 'Betons', color: '#b3b1ad' },
];

export const WALL_FINISHES = [
  { id: 'paint', name: 'Krāsojums', color: '#f1efe9' },
  { id: 'wallpaper', name: 'Tapetes', color: '#e3ddd0' },
  { id: 'tile', name: 'Flīzes', color: '#e5eaee' },
  { id: 'plaster', name: 'Dekoratīvais apmetums', color: '#d8d3ca' },
];

export const finish = (list, id) => list.find((f) => f.id === id) || list[0];
