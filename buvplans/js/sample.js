// Parauga projekts: divistabu dzīvoklis ~63 m², lai redaktors atveras ar reālu plānu.
import { newProject, makeWall, makeOpening, uid } from './model.js';
import { detectRooms } from './rooms.js';
import { pointInPolygon } from './geometry.js';
import { byKind } from './catalog.js';

export function sampleProject() {
  const p = newProject('Divistabu dzīvoklis (paraugs)');
  p.address = 'Parauga iela 12–5, Rīga';
  p.status = 'progress';
  const f = p.floors[0];
  const W = (x1, y1, x2, y2, t) => {
    const w = makeWall({ x: x1, y: y1 }, { x: x2, y: y2 }, t);
    f.walls.push(w);
    return w;
  };
  const top = W(0, 0, 900, 0, 30);
  const right = W(900, 0, 900, 700, 30);
  const bottom = W(900, 700, 0, 700, 30);
  const left = W(0, 700, 0, 0, 30);
  const midTop = W(500, 0, 500, 420, 12);
  const midBot = W(500, 420, 500, 700, 12);
  const hor = W(0, 420, 900, 420, 12);
  const bathW = W(300, 420, 300, 700, 12);

  const O = (type, wall, pos, opts) => f.openings.push(makeOpening(type, wall.id, pos, opts));
  O('window', top, 250, { width: 180 });
  O('window', top, 700, { width: 150 });
  O('window', right, 560, { width: 120 });
  O('window', left, 500, { width: 120 }); // y = 200, dzīvojamā istaba
  O('door', bottom, 500, { width: 100, hinge: true }); // ieejas durvis gaitenī (x = 400)
  O('door', bathW, 90, { width: 80, swing: true });
  O('door', hor, 400, { width: 90, swing: true }); // gaitenis → dzīvojamā istaba
  O('door', midBot, 60, { width: 80 }); // gaitenis → virtuve
  O('door', midTop, 340, { width: 80, hinge: true }); // dzīvojamā → guļamistaba

  detectRooms(f);
  const names = [
    [{ x: 250, y: 200 }, 'Dzīvojamā istaba', 'parquet', 'paint'],
    [{ x: 700, y: 200 }, 'Guļamistaba', 'laminate', 'wallpaper'],
    [{ x: 700, y: 560 }, 'Virtuve', 'tile', 'paint'],
    [{ x: 400, y: 560 }, 'Gaitenis', 'darktile', 'plaster'],
    [{ x: 150, y: 560 }, 'Vannas istaba', 'tile', 'tile'],
  ];
  for (const [pt, name, fl, wl] of names) {
    const r = f.rooms.find((x) => pointInPolygon(pt, x.points));
    if (r) Object.assign(r, { name, floorFinish: fl, wallFinish: wl });
  }

  const I = (kind, x, y, rot = 0, extra = {}) => {
    const d = byKind(kind);
    f.items.push({ id: uid(), kind, name: d.name, x, y, w: d.w, d: d.d, h: d.h, elev: d.elev, rot, color: d.color, ...extra });
  };
  // Dzīvojamā istaba
  I('sofa3', 170, 330, 180);
  I('coffee', 170, 240);
  I('armchair', 370, 250, 90);
  I('tvstand', 170, 38);
  I('bookshelf', 33, 340, 270);
  I('plant', 440, 50);
  I('rtable', 380, 120);
  I('chair', 380, 65);
  I('chair', 380, 175, 180);
  // Guļamistaba
  I('bed160', 700, 126);
  I('night', 590, 45);
  I('night', 810, 45);
  I('wardrobe', 700, 377, 180);
  I('desk', 855, 290, 90);
  // Virtuve
  I('fridge', 539, 465, 270);
  I('kcounter', 536, 540, 270);
  I('stove', 536, 600, 270);
  I('kcounter120', 600, 653, 180);
  I('ksink', 700, 653, 180);
  I('dtable', 790, 520, 90, { w: 120, d: 80 });
  I('chair', 725, 500, 270);
  I('chair', 725, 545, 270);
  I('chair', 855, 500, 90);
  I('chair', 855, 545, 90);
  // Vannas istaba
  I('bath170', 115, 646, 180);
  I('wc', 48, 470, 270);
  I('basin', 160, 451);
  I('washer', 255, 641, 180);
  // Gaitenis
  I('wardrobe', 471, 610, 90, { w: 120, d: 45 });
  // Elektrība
  I('light', 250, 150);
  I('light', 700, 290);
  I('light', 640, 500);
  I('spot', 400, 500);
  I('spot', 400, 620);
  I('spot', 150, 520);
  I('switch', 345, 432, 0);
  I('switch', 491, 380, 90);
  I('socket', 60, 411, 180);
  I('socket', 300, 21, 0);
  I('socket', 509, 160, 270);
  I('socket', 882, 200, 90);
  I('socket', 600, 432, 0);
  I('socket', 650, 432, 0);

  f.dims.push({ id: uid(), a: { x: 0, y: -15 }, b: { x: 900, y: -15 }, offset: -45 });
  f.dims.push({ id: uid(), a: { x: 915, y: 0 }, b: { x: 915, y: 700 }, offset: -45 });
  f.labels.push({ id: uid(), x: 400, y: 760, text: 'Ieeja', size: 14 });
  return p;
}
