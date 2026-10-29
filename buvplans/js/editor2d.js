// 2D plāna redaktors: rīki, piesaiste, vilkšana, tālummaiņa.
import {
  dist, sub, add, mul, norm, projectOnSegment, pointInPolygon, rotate, lineIntersection, round, dot,
} from './geometry.js';
import {
  makeWall, makeOpening, wallLength, wallDir, wallNormal, wallPoint, clampOpening,
  nearestWall, moveJoint, segmentCovered, uid, snapshotWalls, followHosts,
} from './model.js';
import { drawFloor, drawOpening, THEME, fitView, itemDrawScale, fmtLen } from './draw2d.js';
import { rebuildRooms } from './rooms.js';
import { byKind, drawItem2D, isPoint, categoryOf } from './catalog.js';
import { layerMode, wallMode } from './stages.js';
import { wallMaterial } from './walls.js';
import { LINE_TYPES, ZONE_TYPES, FINISHES } from './catalog-data.js';

export const TOOLS = {
  select: { name: 'Atlasīt', key: 'v', hint: 'Klikšķis atlasa objektu, vilkšana pārvieto. Tukšā vietā vilkšana bīda plānu.' },
  wall: { name: 'Zīmēt sienu', key: 'w', hint: 'Klikšķini sienas sākumu un katru stūri. Ieraksti garumu cm un Enter. Dubultklikšķis vai Esc pabeidz. Shift — bez leņķa piesaistes.' },
  rect: { name: 'Taisnstūris', key: 'k', hint: 'Velc taisnstūri — tiks izveidotas četras sienas.' },
  door: { name: 'Durvis', key: 'd', hint: 'Klikšķini uz sienas, lai ievietotu durvis.' },
  window: { name: 'Logs', key: 'l', hint: 'Klikšķini uz sienas, lai ievietotu logu.' },
  opening: { name: 'Aile', key: null, hint: 'Klikšķini uz sienas, lai ievietotu. Puse — pēc tā, kurā sienas pusē ir kursors.' },
  dim: { name: 'Pievienot izmēru', key: 'm', hint: 'Klikšķini divus punktus izmēra līnijai.' },
  text: { name: 'Komentārs', key: 't', hint: 'Klikšķini, kur novietot komentāru.' },
  place: { name: 'Novietot', key: null, hint: 'Klikšķini plānā, lai novietotu. Pie sienas pagriežas pats. R — pagriezt, Alt — bez magnēta, Esc — beigt.' },
  line: { name: 'Līnija', key: null, hint: 'Klikšķini lūzuma punktus; tie pielīp priekšmetiem. Dubultklikšķis, Enter vai Esc pabeidz.' },
  zone: { name: 'Zona', key: null, hint: 'Velc taisnstūri vai klikšķini stūrus (atpakaļ pirmajā punktā vai dubultklikšķis noslēdz).' },
  demolish: { name: 'Demontēt', key: 'x', hint: 'Klikšķini uz objekta, lai atzīmētu to demontāžai (sarkans).' },
  undemolish: { name: 'Noņemt demontāžu', key: null, hint: 'Klikšķini uz sarkanā objekta, lai noņemtu demontāžas atzīmi.' },
  finish: { name: 'Apdare', key: null, hint: 'Klikšķini telpā vai pie sienas, lai piešķirtu apdari.' },
  remove: { name: 'Noņemt apdari', key: null, hint: 'Klikšķini telpā vai pie sienas, lai noņemtu apdari.' },
  eraser: { name: 'Dzēst ar klikšķi', key: 'e', hint: 'Klikšķini uz objektiem, lai tos dzēstu. Esc — beigt.' },
  image: { name: 'Attēls', key: null, hint: 'Klikšķini plānā, kur novietot attēlu.' },
};

// Kuras apdares tiek piešķirtas telpai (grīda/griesti), kuras — sienas virsmai.
const ROOM_TARGETS = { floor: 'floorFinish', ceiling: 'ceiling', screed: 'screed', waterFloor: 'waterFloor', plasterCeiling: 'plasterCeiling', baseboard: 'baseboard', ceilingMolding: 'ceilingMolding' };
const FACE_TARGETS = new Set(['wall', 'waterWall', 'insulation', 'plasterWall']);
// Ko „Noņemt” dzēš katrā stadijā.
const REMOVE_BY_STAGE = {
  floor: { room: ['floorFinish', 'baseboard'], zone: true }, walls: { face: ['wall'] }, ceiling: { room: ['ceiling', 'ceilingMolding'] },
  hydroisolation: { room: ['waterFloor'], face: ['waterWall'] }, isolation: { face: ['insulation'] },
  shtukaturka: { room: ['plasterCeiling'], face: ['plasterWall'] }, styazhka: { room: ['screed'] },
};

export class Editor2D {
  constructor(canvas, store, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.store = store;
    this.hooks = hooks;
    this.view = { scale: 0.6, ox: 60, oy: 60 };
    this.settings = {
      grid: true, snap: true, magnet: true, dims: true, hints: true, units: 'cm',
      wallMaterial: 'gas', wallThickness: 25, wallColor: 'white', partitionMaterial: 'drywall', partitionThickness: 10,
      socketHeight: 30, boxHeight: 240, show: {},
    };
    this.stage = null;
    this.tool = 'select';
    this.state = {};
    this.pointers = new Map();
    this.hover = null;
    this.cursor = null;
    this.typed = '';
    this.theme = THEME;
    this.bind();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    store.addEventListener('change', () => this.requestRender());
  }

  get floor() {
    return this.store.floor;
  }

  get layer() {
    return this.stage?.id || 'init';
  }

  // ---------- koordinātas ----------
  toWorld(sx, sy) {
    return { x: (sx - this.view.ox) / this.view.scale, y: (sy - this.view.oy) / this.view.scale };
  }
  toScreen(p) {
    return { x: p.x * this.view.scale + this.view.ox, y: p.y * this.view.scale + this.view.oy };
  }
  eventPoint(e) {
    const r = this.canvas.getBoundingClientRect();
    return { sx: e.clientX - r.left, sy: e.clientY - r.top };
  }
  get tol() {
    return 8 / this.view.scale;
  }

  resize() {
    const parent = this.canvas.parentElement;
    const w = parent.clientWidth, h = parent.clientHeight;
    if (!w || !h) return;
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.w = w;
    this.h = h;
    if (!this.fitted) {
      this.fit();
      this.fitted = true;
    }
    this.render();
  }

  fit() {
    if (!this.w) return;
    this.view = fitView(this.floor, this.w, this.h, 75);
    this.view.scale = Math.min(this.view.scale, 2);
    this.requestRender();
  }

  zoom(factor, sx = this.w / 2, sy = this.h / 2) {
    const before = this.toWorld(sx, sy);
    this.view.scale = Math.max(0.04, Math.min(8, this.view.scale * factor));
    this.view.ox = sx - before.x * this.view.scale;
    this.view.oy = sy - before.y * this.view.scale;
    this.requestRender();
  }

  setStage(stage) {
    this.stage = stage;
    if (!['select', 'dim', 'text', 'eraser'].includes(this.tool)) this.setTool('select');
    const s = this.store.selection;
    if (s && !this.selectable(s.kind, this.store.selected())) this.store.select(null);
    this.requestRender();
  }

  /** Vai objektu var atlasīt aktīvajā stadijā. */
  selectable(kind, obj) {
    const st = this.stage;
    if (!obj) return false;
    if (!st) return true;
    if (kind === 'items' || kind === 'lines' || kind === 'zones') return layerMode(st, kind === 'items' ? categoryOf(obj) : obj.layer || 'init') === 'active';
    if (kind === 'walls') return !!st.edit?.includes('walls') && wallMode(st, obj) !== 'hidden';
    if (kind === 'openings') {
      const w = this.floor.walls.find((x) => x.id === obj.wallId);
      return !!st.edit?.includes('openings') && w && wallMode(st, w) !== 'hidden';
    }
    if (kind === 'rooms') return !!st.edit?.includes('rooms');
    return true;
  }

  /** Jaunas sienas īpašības: no rīka (starpsienas veids) vai no konfigurācijas paneļa. */
  get newWallProps() {
    const st = this.settings, spec = this.state.spec;
    const partition = this.stage?.newWalls;
    const props = {
      thickness: spec?.thickness ?? (partition ? st.partitionThickness : st.wallThickness),
      material: spec?.material ?? (partition ? st.partitionMaterial : st.wallMaterial),
      status: spec?.status ?? (partition ? 'new' : 'existing'),
    };
    const kind = spec?.kind ?? (partition || wallMaterial(props.material)?.partition ? 'partition' : null);
    if (kind) props.kind = kind;
    if (st.wallColor && st.wallColor !== 'white' && !spec?.kind) props.color = st.wallColor;
    return props;
  }

  setTool(tool, extra = {}) {
    this.finishChain();
    this.finishLine();
    this.tool = tool;
    this.state = { ...extra };
    this.typed = '';
    this.canvas.dataset.tool = tool;
    this.status(TOOLS[tool]?.hint || '');
    this.hooks.onTool?.(tool);
    this.requestRender();
  }

  status(text) {
    this.hooks.onStatus?.(text);
  }

  requestRender() {
    if (this.raf) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = null;
      this.render();
    });
  }

  // ---------- zīmēšana ----------
  render() {
    if (!this.w) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawFloor(ctx, this.floor, this.view, this.theme, {
      stage: this.stage, width: this.w, height: this.h, grid: this.settings.grid, dims: this.settings.dims, units: this.settings.units,
      show: this.settings.show, selection: this.store.selection, hover: this.hover, faceHover: this.state.faceHover, onImage: () => this.requestRender(),
    });
    this.drawPreview(ctx);
    this.hooks.onView?.(this.view);
  }

  drawPreview(ctx) {
    const t = this.theme, st = this.state, c = this.cursor;
    const S = (p) => this.toScreen(p);
    const label = (p, text) => {
      ctx.font = `600 12px ${t.mono}`;
      const m = ctx.measureText(text);
      ctx.fillStyle = t.accent;
      ctx.fillRect(p.x + 12, p.y + 10, m.width + 10, 20);
      ctx.fillStyle = t.bg;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, p.x + 17, p.y + 20);
    };
    const poly = (pts, close) => {
      ctx.beginPath();
      pts.map(S).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      if (close) ctx.closePath();
    };
    if (this.tool === 'wall' && st.anchor && c) {
      const a = S(st.anchor), b = S(c.p);
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = Math.max(2, this.newWallProps.thickness * this.view.scale);
      ctx.strokeStyle = t.accent;
      ctx.globalAlpha = 0.45;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineCap = 'butt';
      const L = dist(st.anchor, c.p);
      label(b, this.typed ? `${this.typed}▌ cm` : `${fmtLen(L, this.settings.units)}  ${Math.round(normAngle(Math.atan2(c.p.y - st.anchor.y, c.p.x - st.anchor.x)))}°`);
    }
    if ((this.tool === 'rect' || (this.tool === 'zone' && !st.points?.length)) && st.start && c) {
      const a = S(st.start), b = S(c.p);
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = this.tool === 'rect' ? Math.max(2, this.newWallProps.thickness * this.view.scale) : 2;
      ctx.globalAlpha = 0.45;
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.globalAlpha = 1;
      label(b, `${fmtLen(Math.abs(c.p.x - st.start.x), this.settings.units)} × ${fmtLen(Math.abs(c.p.y - st.start.y), this.settings.units)}`);
    }
    if (this.tool === 'zone' && st.points?.length && c) {
      poly([...st.points, c.p], false);
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if ((this.tool === 'dim' && st.a && c) || (this.tool === 'demolish' && st.sectionStart && c)) {
      const a = S(st.a || st.sectionStart.point), b = S(this.tool === 'demolish' ? st.sectionEnd?.point || c.p : c.p);
      ctx.strokeStyle = this.tool === 'demolish' ? t.demolish : t.accent;
      ctx.lineWidth = this.tool === 'demolish' ? 6 : 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      label(b, fmtLen(dist(st.a || st.sectionStart.point, this.tool === 'demolish' ? st.sectionEnd?.point || c.p : c.p), this.settings.units));
    }
    if (this.tool === 'line' && st.points?.length && c) {
      const lt = LINE_TYPES[st.spec?.line] || LINE_TYPES.cable;
      poly([...st.points, c.p], false);
      ctx.strokeStyle = lt.color;
      ctx.lineWidth = Math.max(2, lt.duct ? (st.spec?.width || 12) * this.view.scale : lt.width);
      ctx.globalAlpha = 0.7;
      ctx.setLineDash(lt.dash || []);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      const pts = [...st.points, c.p];
      label(S(c.p), fmtLen(pts.reduce((s, p, i) => (i ? s + dist(p, pts[i - 1]) : 0), 0), this.settings.units));
    }
    if ((this.tool === 'opening' || this.tool === 'door' || this.tool === 'window') && st.ghost) {
      drawOpening(ctx, st.ghost.opening, st.ghost.wall, this.view, t, false, true);
    }
    if ((this.tool === 'place' || this.tool === 'image') && st.ghost) {
      const it = st.ghost, p = S(it), k = itemDrawScale(it, this.view.scale);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((it.rot * Math.PI) / 180);
      ctx.scale(this.view.scale * k, this.view.scale * k);
      ctx.lineWidth = 1 / (this.view.scale * k);
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = it.color || '#ddd';
      ctx.strokeStyle = t.accent;
      if (this.tool === 'image') ctx.strokeRect(-it.w / 2, -it.d / 2, it.w, it.d);
      else drawItem2D(ctx, it);
      ctx.restore();
    }
    // Piesaistes punkts
    if (c && c.snap && this.tool !== 'select') {
      const p = S(c.p);
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (c.snap === 'end') ctx.rect(p.x - 6, p.y - 6, 12, 12);
      else if (c.snap === 'wall') { ctx.moveTo(p.x - 7, p.y - 7); ctx.lineTo(p.x + 7, p.y + 7); ctx.moveTo(p.x + 7, p.y - 7); ctx.lineTo(p.x - 7, p.y + 7); }
      else ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (this.state.chainStart && this.tool === 'wall') {
      const p = S(this.state.chainStart);
      ctx.fillStyle = t.accent;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ---------- piesaiste ----------
  snap(p, { anchor = null, free = false } = {}) {
    const f = this.floor, tol = this.tol * 1.4, magnet = this.settings.magnet && !free;
    if (magnet) {
      let best = null;
      for (const w of f.walls) {
        for (const q of [w.a, w.b]) {
          const d = dist(p, q);
          if (d < tol && (!best || d < best.d)) best = { d, q };
        }
      }
      if (best) return { p: { ...best.q }, snap: 'end' };
    }
    let q = p, kind = null;
    if (anchor && !free && this.settings.snap) {
      const v = sub(p, anchor);
      const L = Math.hypot(v.x, v.y);
      const ang = Math.round(Math.atan2(v.y, v.x) / (Math.PI / 12)) * (Math.PI / 12);
      const Ls = round(L, 1);
      q = { x: anchor.x + Math.cos(ang) * Ls, y: anchor.y + Math.sin(ang) * Ls };
      kind = 'angle';
    } else if (this.settings.snap && !free) {
      q = { x: round(p.x, 5), y: round(p.y, 5) };
      kind = 'grid';
    }
    if (magnet) {
      const nw = nearestWall(f, q, tol);
      if (nw) {
        if (anchor) {
          const x = lineIntersection(anchor, sub(q, anchor), nw.wall.a, sub(nw.wall.b, nw.wall.a));
          if (x && projectOnSegment(x, nw.wall.a, nw.wall.b).dist < 0.5 && dist(x, q) < tol * 2) return { p: x, snap: 'wall' };
        } else {
          return { p: nw.point, snap: 'wall' };
        }
      }
    }
    return { p: q, snap: kind };
  }

  /** Līnijas punkts pielīp priekšmetiem un iepriekšējā punkta horizontālei/vertikālei. */
  snapLine(p, free) {
    if (!free && this.settings.magnet) {
      let best = null;
      for (const it of this.floor.items) {
        if (layerMode(this.stage, categoryOf(it)) === 'hidden') continue;
        const d = dist(p, it);
        if (d < this.tol * 2 && (!best || d < best.d)) best = { d, it };
      }
      if (best) return { x: best.it.x, y: best.it.y };
      const last = this.state.points?.[this.state.points.length - 1];
      if (last) {
        if (Math.abs(p.x - last.x) < this.tol) return { x: last.x, y: round(p.y, 5) };
        if (Math.abs(p.y - last.y) < this.tol) return { x: round(p.x, 5), y: last.y };
      }
    }
    return this.settings.snap && !free ? { x: round(p.x, 5), y: round(p.y, 5) } : p;
  }

  // ---------- trāpījumi ----------
  hitTest(p) {
    const h = this.rawHit(p);
    return h && this.selectable(h.kind, this.floor[h.kind].find((x) => x.id === h.id)) ? h : null;
  }

  rawHit(p, opts = {}) {
    const f = this.floor, tol = this.tol, ok = opts.any ? () => true : (kind, obj) => this.selectable(kind, obj);
    for (const o of f.openings) {
      const w = f.walls.find((x) => x.id === o.wallId);
      if (!w || !ok('openings', o)) continue;
      const c = wallPoint(w, o.pos), d = wallDir(w);
      const pr = projectOnSegment(p, add(c, mul(d, -o.width / 2)), add(c, mul(d, o.width / 2)));
      if (pr.dist <= w.thickness / 2 + tol * 0.5) return { kind: 'openings', id: o.id };
    }
    const items = f.items.filter((it) => ok('items', it)).sort((a, b) => Number(isPoint(b)) - Number(isPoint(a)));
    for (const it of items) {
      const k = itemDrawScale(it, this.view.scale);
      const l = rotate(sub(p, it), -(it.rot || 0));
      if (Math.abs(l.x) <= (it.w * k) / 2 + tol * 0.3 && Math.abs(l.y) <= (it.d * k) / 2 + tol * 0.3) return { kind: 'items', id: it.id };
    }
    for (const l of f.labels) {
      const hw = ((l.text.length * (l.size || 14) * 0.3) + 6) / this.view.scale, hh = ((l.size || 14) / 2 + 4) / this.view.scale;
      if (Math.abs(p.x - l.x) <= hw && Math.abs(p.y - l.y) <= hh) return { kind: 'labels', id: l.id };
    }
    for (const d of f.dims) {
      const dir = norm(sub(d.b, d.a)), n = { x: -dir.y, y: dir.x };
      const pr = projectOnSegment(p, add(d.a, mul(n, d.offset || 0)), add(d.b, mul(n, d.offset || 0)));
      if (pr.dist <= tol) return { kind: 'dims', id: d.id };
    }
    for (const ln of f.lines || []) {
      if (!ok('lines', ln)) continue;
      const half = LINE_TYPES[ln.type]?.duct ? (ln.width || 12) / 2 : 0;
      for (let i = 0; i + 1 < ln.points.length; i++) {
        if (projectOnSegment(p, ln.points[i], ln.points[i + 1]).dist <= tol + half) return { kind: 'lines', id: ln.id };
      }
    }
    for (const w of f.walls) {
      if (ok('walls', w) && projectOnSegment(p, w.a, w.b).dist <= w.thickness / 2 + tol * 0.3) return { kind: 'walls', id: w.id };
    }
    for (const z of [...(f.zones || [])].reverse()) {
      if (ok('zones', z) && pointInPolygon(p, z.points)) return { kind: 'zones', id: z.id };
    }
    if (opts.any || this.stage?.edit?.includes('rooms') || !this.stage) {
      for (const r of [...f.rooms].reverse()) {
        if (pointInPolygon(p, r.points)) return { kind: 'rooms', id: r.id };
      }
    }
    return null;
  }

  /** Sienas virsma pie punkta: siena un puse ('p' — normāles pusē, 'n' — pretējā). */
  faceAt(p) {
    const nw = nearestWall({ walls: this.floor.walls.filter((w) => wallMode(this.stage, w) !== 'hidden' && w.kind !== 'virtual') }, p, 35);
    if (!nw) return null;
    const side = dot(sub(p, nw.point), wallNormal(nw.wall)) >= 0 ? 'p' : 'n';
    return { wall: nw.wall, side };
  }

  // ---------- notikumi ----------
  bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('pointercancel', (e) => this.onUp(e));
    c.addEventListener('pointerleave', () => {
      this.cursor = null;
      this.hover = null;
      this.state.faceHover = null;
      this.requestRender();
    });
    c.addEventListener('dblclick', (e) => {
      if (this.tool === 'wall') this.finishChain();
      else if (this.tool === 'line') this.finishLine();
      else if (this.tool === 'zone') this.finishZone();
      else if (this.tool === 'select') this.hooks.onEdit?.();
      e.preventDefault();
    });
    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.tool === 'wall' && this.state.anchor) this.finishChain();
      else if (this.tool === 'line' && this.state.points?.length) this.finishLine();
      else if (this.tool !== 'select') this.setTool('select');
    });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const { sx, sy } = this.eventPoint(e);
      if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) this.zoom(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), sx, sy);
      else {
        this.view.ox -= e.deltaX;
        this.requestRender();
      }
    }, { passive: false });
  }

  onDown(e) {
    const { sx, sy } = this.eventPoint(e);
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { sx, sy });
    if (this.pointers.size === 2) {
      // Divu pirkstu tālummaiņa — atceļ iesākto darbību.
      const [p1, p2] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(p1.sx - p2.sx, p1.sy - p2.sy), mx: (p1.sx + p2.sx) / 2, my: (p1.sy + p2.sy) / 2 };
      this.drag = null;
      return;
    }
    if (e.button === 1 || e.button === 2 || this.spaceDown) {
      this.drag = { mode: 'pan', sx, sy, ox: this.view.ox, oy: this.view.oy };
      return;
    }
    const p = this.toWorld(sx, sy);
    const free = e.shiftKey;
    switch (this.tool) {
      case 'select': return this.downSelect(p, sx, sy, e);
      case 'wall': return this.clickWall(this.snap(p, { anchor: this.state.anchor, free }).p);
      case 'rect': this.state.start = this.snap(p, { free }).p; return;
      case 'zone':
        if (this.state.points?.length) return this.clickZonePoint(this.snap(p, { free }).p);
        if (this.state.spec?.mode === 'lines') {
          this.state.points = [this.snap(p, { free }).p];
          return;
        }
        this.state.start = this.snap(p, { free }).p;
        this.state.downAt = { sx, sy };
        return;
      case 'door': case 'window': case 'opening': return this.placeOpening(p);
      case 'place': return this.placeItem(p, e.altKey);
      case 'image': return this.placeImage(p);
      case 'dim': return this.clickDim(this.snap(p, { anchor: this.state.a, free }).p);
      case 'text': return this.placeText(p);
      case 'line': return this.clickLine(this.snapLine(p, free));
      case 'demolish': return this.downDemolish(p);
      case 'undemolish': return this.undemolishAt(p);
      case 'finish': return this.applyFinish(p);
      case 'remove': return this.removeFinish(p);
      case 'eraser': return this.eraseAt(p);
    }
  }

  onMove(e) {
    const { sx, sy } = this.eventPoint(e);
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { sx, sy });
    if (this.pinch && this.pointers.size === 2) {
      const [p1, p2] = [...this.pointers.values()];
      const d = Math.hypot(p1.sx - p2.sx, p1.sy - p2.sy), mx = (p1.sx + p2.sx) / 2, my = (p1.sy + p2.sy) / 2;
      this.view.ox += mx - this.pinch.mx;
      this.view.oy += my - this.pinch.my;
      this.zoom(d / this.pinch.d, mx, my);
      this.pinch = { d, mx, my };
      return;
    }
    const p = this.toWorld(sx, sy);
    this.hooks.onCursor?.(p);
    const free = e.shiftKey;
    if (this.drag) return this.moveDrag(p, sx, sy, e);
    const setHover = (h) => {
      if (JSON.stringify(h) !== JSON.stringify(this.hover)) this.hover = h;
    };
    switch (this.tool) {
      case 'select': {
        const h = this.hitTest(p);
        if (JSON.stringify(h) !== JSON.stringify(this.hover)) {
          this.hover = h;
          this.requestRender();
        }
        const sw = this.store.selected();
        const onHandle = this.store.selection?.kind === 'walls' && sw && [sw.a, sw.b].some((q) => dist(q, p) < this.tol);
        this.canvas.style.cursor = onHandle ? 'crosshair' : h ? 'move' : 'default';
        return;
      }
      case 'wall': this.cursor = this.snap(p, { anchor: this.state.anchor, free }); break;
      case 'rect': case 'dim': case 'zone': this.cursor = this.snap(p, { anchor: this.tool === 'dim' ? this.state.a : null, free }); break;
      case 'door': case 'window': case 'opening': this.ghostOpening(p); break;
      case 'place': this.ghostItem(p, e.altKey); break;
      case 'image': this.ghostImage(p); break;
      case 'line': this.cursor = { p: this.snapLine(p, free), snap: null }; break;
      case 'demolish': {
        if (this.state.sectionStart) this.state.sectionEnd = projectOnWall(this.state.sectionStart.wall, p);
        setHover(this.demolishTarget(p));
        this.cursor = { p };
        break;
      }
      case 'undemolish': case 'eraser': setHover(this.tool === 'eraser' ? this.eraseTarget(p) : this.undemolishTarget(p)); this.cursor = { p }; break;
      case 'finish': case 'remove': {
        const tgt = this.tool === 'finish' ? this.state.spec?.target : null;
        const faceMode = this.tool === 'finish' ? FACE_TARGETS.has(tgt) : !!REMOVE_BY_STAGE[this.stage?.id]?.face;
        const face = faceMode ? this.faceAt(p) : null;
        this.state.faceHover = face ? { id: face.wall.id, side: face.side } : null;
        const room = !face ? this.floor.rooms.find((r) => pointInPolygon(p, r.points)) : null;
        setHover(room ? { kind: 'rooms', id: room.id } : null);
        this.cursor = { p };
        break;
      }
      default: this.cursor = { p };
    }
    this.requestRender();
  }

  onUp(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.tool === 'rect' && this.state.start && this.cursor) {
      const a = this.state.start, b = this.cursor.p;
      this.state.start = null;
      if (Math.abs(b.x - a.x) > 10 && Math.abs(b.y - a.y) > 10) this.createRect(a, b);
    }
    if (this.tool === 'zone' && this.state.start) {
      const a = this.state.start, b = this.cursor?.p || a;
      const { sx, sy } = this.eventPoint(e);
      const moved = Math.hypot(sx - this.state.downAt.sx, sy - this.state.downAt.sy) > 8;
      this.state.start = null;
      if (moved && Math.abs(b.x - a.x) > 5 && Math.abs(b.y - a.y) > 5) {
        this.createZone([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }]);
      } else {
        this.state.points = [a];
        this.status('Klikšķini nākamos stūrus; noslēdz, klikšķinot pirmajā punktā vai ar dubultklikšķi.');
      }
    }
    if (this.tool === 'demolish' && this.state.sectionStart) this.finishSection();
    if (this.drag?.moved && this.drag.mode !== 'pan') this.store.touch();
    this.drag = null;
    this.requestRender();
  }

  // ---------- atlase un vilkšana ----------
  downSelect(p, sx, sy) {
    const s = this.store.selection, sw = this.store.selected();
    if (s?.kind === 'walls' && sw) {
      for (const end of ['a', 'b']) {
        if (dist(sw[end], p) < this.tol) {
          this.drag = { mode: 'joint', from: { ...sw[end] }, sx, sy };
          return;
        }
      }
    }
    const hit = this.hitTest(p);
    if (!hit) {
      this.store.select(null);
      this.drag = { mode: 'pan', sx, sy, ox: this.view.ox, oy: this.view.oy };
      return;
    }
    this.store.select(hit);
    if (hit.kind === 'rooms') {
      // Grīdu nevar pārvietot — tā seko sienām; vilkšana telpā bīda plānu.
      this.drag = { mode: 'pan', sx, sy, ox: this.view.ox, oy: this.view.oy };
      return;
    }
    const obj = this.store.selected();
    this.drag = { mode: 'move', start: p, sx, sy, orig: JSON.parse(JSON.stringify(obj)), kind: hit.kind };
    if (hit.kind === 'walls') this.drag.joints = [{ ...obj.a }, { ...obj.b }];
  }

  moveDrag(p, sx, sy, e) {
    const dr = this.drag;
    if (dr.mode === 'pan') {
      this.view.ox = dr.ox + (sx - dr.sx);
      this.view.oy = dr.oy + (sy - dr.sy);
      this.requestRender();
      return;
    }
    if (!dr.moved) {
      if (Math.hypot(sx - dr.sx, sy - dr.sy) < 4) return;
      dr.moved = true;
      this.store.checkpoint();
    }
    const f = this.floor;
    if (dr.mode === 'joint') {
      const to = this.snap(p, { free: e.shiftKey }).p;
      const before = snapshotWalls(f);
      moveJoint(f, dr.from, to);
      followHosts(f, before);
      dr.from = to;
      rebuildRooms(f);
      this.requestRender();
      return;
    }
    const obj = this.store.selected();
    if (!obj) return;
    let delta = sub(p, dr.start);
    if (this.settings.snap && !e.shiftKey) delta = { x: round(delta.x, 5), y: round(delta.y, 5) };
    const o = dr.orig;
    switch (dr.kind) {
      case 'items': {
        Object.assign(obj, add(o, delta), { rot: o.rot });
        if (!e.altKey && this.settings.magnet && obj.kind !== '__image') this.magnet(obj);
        break;
      }
      case 'openings': {
        const w = f.walls.find((x) => x.id === obj.wallId);
        const nw = nearestWall(f, p, 60 / this.view.scale + 30);
        const target = nw && nw.wall.id !== w?.id && nw.dist < nw.wall.thickness ? nw.wall : w;
        if (!target) break;
        obj.wallId = target.id;
        obj.pos = projectOnSegment(p, target.a, target.b).t * wallLength(target);
        if (this.settings.snap && !e.shiftKey) obj.pos = round(obj.pos, 5);
        clampOpening(obj, target);
        break;
      }
      case 'walls': {
        const [ja, jb] = dr.joints;
        const curA = { ...obj.a }, curB = { ...obj.b };
        const before = snapshotWalls(f);
        moveJoint(f, curA, add(ja, delta));
        moveJoint(f, curB, add(jb, delta));
        followHosts(f, before);
        rebuildRooms(f);
        break;
      }
      case 'labels': Object.assign(obj, add(o, delta)); break;
      case 'dims': obj.a = add(o.a, delta); obj.b = add(o.b, delta); break;
      case 'lines': case 'zones': obj.points = o.points.map((q) => add(q, delta)); break;
    }
    this.requestRender();
  }

  /** Pievelk priekšmetu pie tuvākās sienas un pagriež ar aizmuguri pret to. */
  magnet(it) {
    const nw = nearestWall(this.floor, it, it.d / 2 + 40);
    if (!nw) return false;
    const w = nw.wall, n = wallNormal(w);
    const side = Math.sign((it.x - nw.point.x) * n.x + (it.y - nw.point.y) * n.y) || 1;
    const gap = w.thickness / 2 + it.d / 2 + 0.5;
    if (nw.dist > gap + 25) return false;
    const pos = add(nw.point, mul(n, side * gap));
    it.x = Math.round(pos.x * 10) / 10;
    it.y = Math.round(pos.y * 10) / 10;
    // Lokālā aizmugure ir –y; jāpagriež tā, lai tā skatās pret sienu (–side·n).
    const back = mul(n, -side);
    it.rot = Math.round(normAngle((Math.atan2(back.y, back.x) * 180) / Math.PI + 90));
    return true;
  }

  // ---------- sienas ----------
  clickWall(p) {
    const st = this.state;
    if (!st.anchor) {
      st.anchor = p;
      st.chainStart = p;
      st.count = 0;
      this.requestRender();
      return;
    }
    if (dist(st.anchor, p) < 1) {
      this.finishChain();
      return;
    }
    const a = st.anchor;
    const props = this.newWallProps;
    this.store.commit((f) => f.walls.push({ ...makeWall(a, p, props.thickness, f.height), ...props }));
    st.count += 1;
    st.anchor = p;
    this.typed = '';
    if (st.chainStart && dist(p, st.chainStart) < 0.5 && st.count >= 2) this.finishChain();
  }

  finishChain() {
    if (this.tool === 'wall') {
      const spec = this.state.spec;
      this.state = spec ? { spec } : {};
    }
    this.typed = '';
    this.requestRender();
  }

  applyTypedLength() {
    const st = this.state;
    const L = parseFloat(this.typed.replace(',', '.'));
    if (!st.anchor || !(L > 0) || !this.cursor) return;
    const dir = norm(sub(this.cursor.p, st.anchor));
    if (!dir.x && !dir.y) return;
    this.clickWall(add(st.anchor, mul(dir, L)));
  }

  createRect(a, b) {
    const pts = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
    const props = this.newWallProps;
    this.store.commit((f) => {
      for (let i = 0; i < 4; i++) {
        const p = pts[i], q = pts[(i + 1) % 4];
        if (!segmentCovered(f, p, q)) f.walls.push({ ...makeWall(p, q, props.thickness, f.height), ...props });
      }
    });
  }

  // ---------- ailes ----------
  ghostOpening(p) {
    const nw = nearestWall({ walls: this.floor.walls.filter((w) => wallMode(this.stage, w) !== 'hidden' && w.kind !== 'virtual') }, p, 40 / this.view.scale + 10);
    if (!nw) {
      this.state.ghost = null;
      return;
    }
    const spec = this.state.spec || { type: this.tool === 'door' ? 'door' : 'window' };
    const o = makeOpening(spec.type, nw.wall.id, this.settings.snap ? round(nw.pos, 5) : nw.pos, { ...spec, t: undefined, name: undefined, icon: undefined });
    delete o.t; delete o.name; delete o.icon;
    if (this.stage?.newWalls) o.status = 'new';
    clampOpening(o, nw.wall);
    o.swing = dotN(p, nw) < 0;
    this.state.ghost = { opening: o, wall: nw.wall };
  }

  placeOpening(p) {
    this.ghostOpening(p);
    const g = this.state.ghost;
    if (!g) {
      this.status('Durvis un logus var ievietot tikai sienā — pietuvini kursoru sienai.');
      return;
    }
    if (wallLength(g.wall) < g.opening.width) {
      this.status('Siena ir īsāka par aili.');
      return;
    }
    const o = { ...g.opening, id: uid() };
    this.store.commit((f) => f.openings.push(o));
    this.store.select({ kind: 'openings', id: o.id });
  }

  // ---------- priekšmeti un attēli ----------
  ghostItem(p, free) {
    const def = byKind(this.state.kind);
    if (!def) return;
    const over = this.state.over || {};
    let elev = def.elev;
    if (def.electric === 'socket' || def.electric === 'weak') elev = this.settings.socketHeight ?? elev;
    if (def.electric === 'box') elev = this.settings.boxHeight ?? elev;
    const g = this.state.ghost || { id: uid(), kind: def.kind, name: def.name, w: over.w ?? def.w, d: over.d ?? def.d, h: over.h ?? def.h, elev, rot: 0, color: def.color, layer: this.layer };
    Object.assign(g, { w: over.w ?? g.w, d: over.d ?? g.d, h: over.h ?? g.h });
    const q = this.settings.snap && !free ? { x: round(p.x, 5), y: round(p.y, 5) } : p;
    Object.assign(g, q);
    if (!free && this.settings.magnet) {
      if (!this.magnet(g)) g.rot = this.state.rot || 0;
    } else g.rot = this.state.rot || 0;
    this.state.ghost = g;
  }

  placeItem(p, free) {
    this.ghostItem(p, free);
    const g = this.state.ghost;
    if (!g) return;
    this.store.commit((f) => f.items.push({ ...g }));
    this.store.select({ kind: 'items', id: g.id });
    this.state.ghost = { ...g, id: uid() };
  }

  ghostImage(p) {
    const st = this.state;
    st.ghost = st.ghost || { id: uid(), kind: '__image', name: 'Attēls', src: st.src, w: st.w || 200, d: st.d || 150, h: 1, elev: 0, rot: 0, layer: this.layer };
    Object.assign(st.ghost, { x: p.x, y: p.y });
  }

  placeImage(p) {
    this.ghostImage(p);
    const g = { ...this.state.ghost };
    this.store.commit((f) => f.items.push(g));
    this.store.select({ kind: 'items', id: g.id });
    this.setTool('select');
  }

  // ---------- izmēri un komentāri ----------
  clickDim(p) {
    if (!this.state.a) {
      this.state.a = p;
      return;
    }
    const a = this.state.a;
    this.state.a = null;
    if (dist(a, p) < 5) return;
    const dm = { id: uid(), a, b: p, offset: 0, layer: this.layer };
    this.store.commit((f) => f.dims.push(dm));
    this.store.select({ kind: 'dims', id: dm.id });
  }

  placeText(p) {
    const l = { id: uid(), x: p.x, y: p.y, text: 'Komentārs', size: 14, layer: this.layer };
    this.store.commit((f) => f.labels.push(l));
    this.store.select({ kind: 'labels', id: l.id });
    this.setTool('select');
    this.hooks.onEdit?.();
  }

  // ---------- līnijas (caurules, kabeļi, gaisa vadi, sijas, margas) ----------
  clickLine(p) {
    const st = this.state;
    st.points = st.points || [];
    const last = st.points[st.points.length - 1];
    if (last && dist(last, p) < 1) return this.finishLine();
    st.points.push(p);
    this.requestRender();
  }

  finishLine() {
    if (this.tool !== 'line') return;
    const pts = this.state.points || [];
    this.state.points = [];
    if (pts.length < 2) return this.requestRender();
    const spec = this.state.spec || { line: 'cable' };
    const ln = { id: uid(), type: spec.line, points: pts, layer: this.layer };
    if (spec.label) ln.label = spec.label;
    if (LINE_TYPES[spec.line]?.duct) Object.assign(ln, { width: spec.width || 12, height: spec.height || 6, round: !!spec.round });
    if (spec.line === 'beam') Object.assign(ln, { width: spec.width || 20, height: spec.height || 30 });
    this.store.commit((f) => { (f.lines = f.lines || []).push(ln); });
    this.store.select({ kind: 'lines', id: ln.id });
  }

  // ---------- zonas (siltā grīda, atvērumi, terase, zonējums) ----------
  clickZonePoint(p) {
    const pts = this.state.points;
    if (pts.length >= 3 && dist(p, pts[0]) < this.tol * 1.5) return this.finishZone();
    pts.push(p);
    this.requestRender();
  }

  finishZone() {
    if (this.tool !== 'zone') return;
    const pts = this.state.points || [];
    this.state.points = [];
    if (pts.length >= 3) this.createZone(pts);
    this.requestRender();
  }

  createZone(points) {
    const spec = this.state.spec || { zone: 'figure' };
    const z = { id: uid(), type: spec.zone, points: points.map((q) => ({ ...q })), layer: this.layer };
    if (spec.zone === 'heatCable' || spec.zone === 'heatWater') Object.assign(z, { pitch: 15, pattern: 'snake' });
    this.store.commit((f) => { (f.zones = f.zones || []).push(z); });
    this.store.select({ kind: 'zones', id: z.id });
  }

  // ---------- demontāža ----------
  demolishTarget(p) {
    const target = this.state.target || 'wall';
    const f = this.floor;
    if (target === 'opening') {
      const h = this.rawHit(p, { any: true });
      return h?.kind === 'openings' ? h : null;
    }
    if (target === 'radiator' || target === 'panel') {
      const fam = target === 'radiator' ? ['radiator', 'towel'] : ['panel'];
      const it = f.items.find((x) => fam.includes(byKind(x.kind)?.sym) && dist(p, x) < Math.max(x.w, x.d) / 2 + this.tol);
      return it ? { kind: 'items', id: it.id } : null;
    }
    const nw = nearestWall({ walls: f.walls.filter((w) => wallMode(this.stage, w) !== 'hidden') }, p, 30 / this.view.scale + 10);
    return nw ? { kind: 'walls', id: nw.wall.id } : null;
  }

  downDemolish(p) {
    const target = this.state.target || 'wall';
    if (target === 'section') {
      const nw = nearestWall({ walls: this.floor.walls.filter((w) => wallMode(this.stage, w) === 'normal') }, p, 30 / this.view.scale + 10);
      if (!nw) return this.status('Velc gar sienu no posma sākuma līdz beigām.');
      this.state.sectionStart = { wall: nw.wall, ...projectOnWall(nw.wall, p) };
      this.state.sectionEnd = this.state.sectionStart;
      return;
    }
    const h = this.demolishTarget(p);
    if (!h) return this.status('Klikšķini tieši uz objekta.');
    const obj = this.floor[h.kind].find((x) => x.id === h.id);
    this.store.commit(() => { obj.status = obj.status === 'demolish' ? (h.kind === 'walls' ? 'existing' : undefined) : 'demolish'; });
    this.status(obj.status === 'demolish' ? 'Atzīmēts demontāžai.' : 'Atzīme noņemta.');
  }

  /** Sienas posma demontāža: siena tiek sadalīta, vidējā daļa — nojaucama. */
  finishSection() {
    const { sectionStart: s, sectionEnd: e } = this.state;
    this.state.sectionStart = this.state.sectionEnd = null;
    if (!s || !e) return;
    const w = s.wall, L = wallLength(w);
    let a = Math.min(s.pos, e.pos), b = Math.max(s.pos, e.pos);
    if (b - a < 5) return;
    a = a < 3 ? 0 : a;
    b = L - b < 3 ? L : b;
    const d = wallDir(w);
    const P = (x) => add(w.a, mul(d, x));
    this.store.commit((f) => {
      const pieces = [[0, a], [a, b], [b, L]].filter(([x0, x1]) => x1 - x0 > 0.5);
      const made = pieces.map(([x0, x1]) => ({ ...JSON.parse(JSON.stringify(w)), id: uid(), a: P(x0), b: P(x1), status: x0 === a && x1 === b ? 'demolish' : w.status }));
      f.walls = f.walls.filter((x) => x !== w).concat(made);
      for (const o of f.openings.filter((x) => x.wallId === w.id)) {
        const host = made.find((m, i) => o.pos >= pieces[i][0] && o.pos <= pieces[i][1]) || made[0];
        const i = made.indexOf(host);
        o.wallId = host.id;
        o.pos -= pieces[i][0];
      }
    });
    this.status(`Demontējams posms: ${fmtLen(b - a, this.settings.units)}`);
  }

  undemolishTarget(p) {
    const f = this.floor;
    for (const o of f.openings) {
      if (o.status !== 'demolish') continue;
      const w = f.walls.find((x) => x.id === o.wallId);
      if (w && dist(p, wallPoint(w, o.pos)) < o.width / 2 + this.tol) return { kind: 'openings', id: o.id };
    }
    for (const it of f.items) if (it.status === 'demolish' && dist(p, it) < Math.max(it.w, it.d) / 2 + this.tol) return { kind: 'items', id: it.id };
    for (const w of f.walls) if (w.status === 'demolish' && projectOnSegment(p, w.a, w.b).dist < w.thickness / 2 + this.tol) return { kind: 'walls', id: w.id };
    return null;
  }

  undemolishAt(p) {
    const h = this.undemolishTarget(p);
    if (!h) return this.status('Klikšķini uz sarkanā (demontējamā) objekta.');
    const obj = this.floor[h.kind].find((x) => x.id === h.id);
    this.store.commit(() => { if (h.kind === 'walls') obj.status = 'existing'; else delete obj.status; });
  }

  // ---------- apdare ----------
  applyFinish(p) {
    const spec = this.state.spec || {};
    const f = this.floor;
    if (FACE_TARGETS.has(spec.target)) {
      const face = this.faceAt(p);
      const room = !face && f.rooms.find((r) => pointInPolygon(p, r.points));
      if (!face && !room) return this.status('Klikšķini pie sienas (vai telpas vidū — visām tās sienām).');
      this.store.commit(() => {
        const faces = face ? [face] : roomFaces(f, room);
        for (const fc of faces) {
          fc.wall.faces = fc.wall.faces || {};
          fc.wall.faces[fc.side] = { ...(fc.wall.faces[fc.side] || {}), [spec.target]: spec.value };
        }
      });
      return;
    }
    const field = ROOM_TARGETS[spec.target];
    if (!field) return;
    const zone = spec.target === 'floor' ? (f.zones || []).find((z) => z.type === 'floorZone' && pointInPolygon(p, z.points)) : null;
    const room = f.rooms.find((r) => pointInPolygon(p, r.points));
    if (!zone && !room) return this.status('Klikšķini telpas iekšpusē.');
    this.store.commit(() => {
      const obj = zone || room;
      if (spec.target === 'ceilingMolding') obj.ceilingMolding = !obj.ceilingMolding;
      else obj[zone ? 'finish' : field] = spec.value;
    });
    this.store.select(zone ? { kind: 'zones', id: zone.id } : { kind: 'rooms', id: room.id });
  }

  removeFinish(p) {
    const f = this.floor;
    const rule = REMOVE_BY_STAGE[this.stage?.id] || { room: Object.values(ROOM_TARGETS), face: [...FACE_TARGETS] };
    const target = this.state.spec?.target;
    const face = rule.face ? this.faceAt(p) : null;
    this.store.commit(() => {
      if (face) {
        const fc = face.wall.faces?.[face.side];
        if (fc) for (const k of rule.face) if (!target || k.toLowerCase().includes(target.toLowerCase())) delete fc[k];
        return;
      }
      const zone = rule.zone ? (f.zones || []).find((z) => z.type === 'floorZone' && pointInPolygon(p, z.points)) : null;
      if (zone) {
        delete zone.finish;
        return;
      }
      const room = f.rooms.find((r) => pointInPolygon(p, r.points));
      if (room) for (const k of rule.room || []) delete room[k];
    });
  }

  // ---------- dzēšgumija ----------
  eraseTarget(p) {
    const h = this.hitTest(p);
    return h && h.kind !== 'rooms' ? h : null;
  }

  eraseAt(p) {
    const h = this.eraseTarget(p);
    if (!h) return;
    this.store.selection = h;
    this.store.deleteSelected();
  }

  // ---------- tastatūra ----------
  onKey(e) {
    const k = e.key;
    if (this.tool === 'wall' && this.state.anchor) {
      if (/^[0-9.,]$/.test(k)) {
        this.typed += k;
        this.requestRender();
        return true;
      }
      if (k === 'Backspace' && this.typed) {
        this.typed = this.typed.slice(0, -1);
        this.requestRender();
        return true;
      }
      if (k === 'Enter') {
        if (this.typed) this.applyTypedLength();
        else this.finishChain();
        return true;
      }
    }
    if (k === 'Enter' && this.tool === 'line') {
      this.finishLine();
      return true;
    }
    if (k === 'Enter' && this.tool === 'zone') {
      this.finishZone();
      return true;
    }
    if (k === 'Escape') {
      if (this.tool === 'line' && this.state.points?.length) this.finishLine();
      else if (this.tool === 'zone' && this.state.points?.length) this.finishZone();
      else if (this.tool === 'wall' && this.state.anchor) this.finishChain();
      else if (this.tool !== 'select') this.setTool('select');
      else this.store.select(null);
      return true;
    }
    if (k === ' ') {
      this.spaceDown = true;
      return true;
    }
    const sel = this.store.selected();
    if (this.tool === 'place' && (k === 'r' || k === 'R')) {
      this.state.rot = normAngle((this.state.rot || 0) + 90);
      if (this.state.ghost) this.state.ghost.rot = this.state.rot;
      this.requestRender();
      return true;
    }
    if (sel && this.store.selection.kind === 'items') {
      if (k === 'r' || k === 'R') {
        this.store.commit(() => { sel.rot = normAngle((sel.rot || 0) + (e.shiftKey ? -15 : 90)); });
        return true;
      }
      const step = e.shiftKey ? 10 : 1;
      const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[k];
      if (mv) {
        this.store.commit(() => { sel.x += mv[0]; sel.y += mv[1]; });
        return true;
      }
    }
    return false;
  }

  onKeyUp(e) {
    if (e.key === ' ') this.spaceDown = false;
  }
}

const normAngle = (a) => ((a % 360) + 360) % 360;
const dotN = (p, nw) => {
  const n = wallNormal(nw.wall);
  return (p.x - nw.point.x) * n.x + (p.y - nw.point.y) * n.y;
};
const projectOnWall = (w, p) => {
  const pr = projectOnSegment(p, w.a, w.b);
  return { pos: pr.t * wallLength(w), point: pr.point };
};

/** Visas sienu virsmas, kas robežojas ar telpu (to iekšpuse). */
export function roomFaces(floor, room) {
  const out = [];
  for (const w of floor.walls) {
    if (w.status === 'demolish' || w.kind === 'virtual') continue;
    const mid = wallPoint(w, wallLength(w) / 2), n = wallNormal(w);
    for (const [side, s] of [['p', 1], ['n', -1]]) {
      if (pointInPolygon(add(mid, mul(n, s * (w.thickness / 2 + 5))), room.points)) out.push({ wall: w, side });
    }
  }
  return out;
}

export { FINISHES, ZONE_TYPES };
