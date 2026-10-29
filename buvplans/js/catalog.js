// Mēbeļu, santehnikas un elektroinstalācijas katalogs ar 2D simboliem un vienkāršiem 3D modeļiem.
// Izmēri cm: w – platums, d – dziļums, h – augstums, elev – augstums no grīdas.

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
    const letter = { wcold: 'A', whot: 'K', sewer: 'N' }[it?.kind] || '';
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

export const byKind = (kind) => CATALOG.find((c) => c.kind === kind);

export function drawItem2D(ctx, it) {
  const def = byKind(it.kind);
  const fn = draw[def?.sym] || draw.box;
  fn(ctx, it.w, it.d, it);
}

/** Mazi sienas punkti (rozetes, slēdži, izvadi), kas ekrānā jāzīmē palielināti. */
export const isPoint = (it) => {
  const def = byKind(it.kind);
  return !!(def && (def.electric || def.water) && Math.max(def.w, def.d) <= 20);
};

export function parts3D(it) {
  const def = byKind(it.kind);
  const fn = build[def?.sym] || build.box;
  return fn(it);
}

export const isElectric = (it) => byKind(it.kind)?.electric;
export const categoryOf = (it) => byKind(it.kind)?.cat || 'other';

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
