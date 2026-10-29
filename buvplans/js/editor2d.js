// 2D plāna redaktors: rīki, piesaiste, vilkšana, tālummaiņa.
import {
  dist, sub, add, mul, norm, projectOnSegment, pointInPolygon, rotate, lineIntersection, round,
} from './geometry.js';
import {
  makeWall, makeOpening, wallLength, wallDir, wallNormal, wallPoint, clampOpening,
  nearestWall, moveJoint, segmentCovered, uid, snapshotWalls, followHosts,
} from './model.js';
import { drawFloor, drawOpening, THEME, fitView, itemDrawScale, fmtLen } from './draw2d.js';
import { rebuildRooms } from './rooms.js';
import { byKind, drawItem2D, isPoint, categoryOf } from './catalog.js';
import { itemMode, wallMode } from './stages.js';

export const TOOLS = {
  select: { name: 'Atlasīt', key: 'v', hint: 'Klikšķis atlasa objektu, vilkšana pārvieto. Tukšā vietā vilkšana bīda plānu.' },
  wall: { name: 'Siena', key: 'w', hint: 'Klikšķini sienas sākumu un katru stūri. Ieraksti garumu cm un Enter. Dubultklikšķis vai Esc pabeidz. Shift — bez leņķa piesaistes.' },
  rect: { name: 'Telpa', key: 'k', hint: 'Velc taisnstūri — tiks izveidotas četras sienas un telpa.' },
  door: { name: 'Durvis', key: 'd', hint: 'Klikšķini uz sienas, lai ievietotu durvis.' },
  window: { name: 'Logs', key: 'l', hint: 'Klikšķini uz sienas, lai ievietotu logu.' },
  dim: { name: 'Izmērs', key: 'm', hint: 'Klikšķini divus punktus izmēra līnijai.' },
  text: { name: 'Teksts', key: 't', hint: 'Klikšķini, kur novietot uzrakstu.' },
  place: { name: 'Novietot', key: null, hint: 'Klikšķini plānā, lai novietotu priekšmetu. Pie sienas tas pagriežas pats. R — pagriezt, Alt — bez piesaistes, Esc — beigt.' },
  demolish: { name: 'Demontēt', key: 'x', hint: 'Klikšķini uz sienas, lai atzīmētu to kā nojaucamu (sarkana). Atkārtots klikšķis atceļ.' },
  wire: { name: 'Vads', key: 'e', hint: 'Klikšķini vada lūzuma punktus; tie pielīp rozetēm, slēdžiem un gaismekļiem. Dubultklikšķis vai Esc pabeidz.' },
};

export class Editor2D {
  constructor(canvas, store, hooks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.store = store;
    this.hooks = hooks;
    this.view = { scale: 0.6, ox: 60, oy: 60 };
    this.settings = { grid: true, snap: true, dims: true, hints: true, units: 'cm', wallThickness: 25, partitionThickness: 10 };
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
    if (!stage.tools.includes(this.tool) && !['place', 'dim', 'text'].includes(this.tool)) this.setTool('select');
    if (this.tool === 'place' && !stage.cats.includes(byKind(this.state.kind)?.cat)) this.setTool('select');
    const s = this.store.selection;
    if (s && !this.selectable(s.kind, this.store.selected())) this.store.select(null);
    this.requestRender();
  }

  /** Vai objektu var atlasīt aktīvajā stadijā. */
  selectable(kind, obj) {
    const st = this.stage;
    if (!obj) return false;
    if (!st) return true;
    if (kind === 'items') return itemMode(st, categoryOf(obj)) === 'active';
    if (kind === 'walls') return !!st.edit?.includes('walls') && wallMode(st, obj) !== 'hidden';
    if (kind === 'openings') {
      const w = this.floor.walls.find((x) => x.id === obj.wallId);
      return !!st.edit?.includes('openings') && w && wallMode(st, w) !== 'hidden';
    }
    if (kind === 'rooms') return !!st.edit?.includes('rooms');
    if (kind === 'wires') return st.wires === 'edit';
    return true;
  }

  get newWallProps() {
    return this.stage?.newWalls
      ? { thickness: this.settings.partitionThickness, status: 'new', kind: 'partition' }
      : { thickness: this.settings.wallThickness, status: 'existing' };
  }

  setTool(tool, extra = {}) {
    this.finishChain();
    this.tool = tool;
    this.state = { ...extra };
    this.typed = '';
    this.canvas.dataset.tool = tool;
    this.hooks.onTool?.(tool);
    this.status(TOOLS[tool]?.hint || '');
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
      selection: this.store.selection, hover: this.hover, onImage: () => this.requestRender(),
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
    if (this.tool === 'wall' && st.anchor && c) {
      const a = S(st.anchor), b = S(c.p);
      ctx.lineCap = 'square';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = this.newWallProps.thickness * this.view.scale;
      ctx.strokeStyle = t.accent;
      ctx.globalAlpha = 0.45;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineCap = 'butt';
      const L = dist(st.anchor, c.p);
      label(b, this.typed ? `${this.typed}▌ cm` : `${fmtLen(L, this.settings.units)}  ${Math.round(normAngle(Math.atan2(c.p.y - st.anchor.y, c.p.x - st.anchor.x)))}°`);
    }
    if (this.tool === 'rect' && st.start && c) {
      const a = S(st.start), b = S(c.p);
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = Math.max(2, this.newWallProps.thickness * this.view.scale);
      ctx.globalAlpha = 0.45;
      ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
      ctx.globalAlpha = 1;
      const w = Math.abs(c.p.x - st.start.x), h = Math.abs(c.p.y - st.start.y);
      label(b, `${fmtLen(w, this.settings.units)} × ${fmtLen(h, this.settings.units)}`);
    }
    if (this.tool === 'dim' && st.a && c) {
      const a = S(st.a), b = S(c.p);
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      label(b, fmtLen(dist(st.a, c.p), this.settings.units));
    }
    if (this.tool === 'wire' && st.points?.length && c) {
      ctx.beginPath();
      [...st.points, c.p].map(S).forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.strokeStyle = t.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if ((this.tool === 'door' || this.tool === 'window') && st.ghost) {
      drawOpening(ctx, st.ghost.opening, st.ghost.wall, this.view, t, false, true);
    }
    if (this.tool === 'place' && st.ghost) {
      const it = st.ghost, p = S(it), k = itemDrawScale(it, this.view.scale);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((it.rot * Math.PI) / 180);
      ctx.scale(this.view.scale * k, this.view.scale * k);
      ctx.lineWidth = 1 / (this.view.scale * k);
      ctx.globalAlpha = 0.65;
      ctx.fillStyle = it.color;
      ctx.strokeStyle = t.accent;
      drawItem2D(ctx, it);
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
    const f = this.floor, tol = this.tol * 1.4;
    if (!free) {
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
    if (anchor && !free) {
      const v = sub(p, anchor);
      const L = Math.hypot(v.x, v.y);
      const ang = Math.round(Math.atan2(v.y, v.x) / (Math.PI / 12)) * (Math.PI / 12);
      const Ls = this.settings.snap ? round(L, 1) : L;
      q = { x: anchor.x + Math.cos(ang) * Ls, y: anchor.y + Math.sin(ang) * Ls };
      kind = 'angle';
    } else if (this.settings.snap && !free) {
      q = { x: round(p.x, 5), y: round(p.y, 5) };
      kind = 'grid';
    }
    if (!free) {
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

  // ---------- trāpījumi ----------
  hitTest(p) {
    const h = this.rawHit(p);
    return h && this.selectable(h.kind, this.floor[h.kind].find((x) => x.id === h.id)) ? h : null;
  }

  rawHit(p) {
    const f = this.floor, tol = this.tol, ok = (kind, obj) => this.selectable(kind, obj);
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
    for (const wr of f.wires || []) {
      if (!ok('wires', wr)) continue;
      for (let i = 0; i + 1 < wr.points.length; i++) {
        if (projectOnSegment(p, wr.points[i], wr.points[i + 1]).dist <= tol) return { kind: 'wires', id: wr.id };
      }
    }
    for (const w of f.walls) {
      if (ok('walls', w) && projectOnSegment(p, w.a, w.b).dist <= w.thickness / 2 + tol * 0.3) return { kind: 'walls', id: w.id };
    }
    if (this.stage?.edit?.includes('rooms') || !this.stage) {
      for (const r of [...f.rooms].reverse()) {
        if (pointInPolygon(p, r.points)) return { kind: 'rooms', id: r.id };
      }
    }
    return null;
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
      this.requestRender();
    });
    c.addEventListener('dblclick', (e) => {
      if (this.tool === 'wall') this.finishChain();
      else if (this.tool === 'wire') this.finishWire();
      else if (this.tool === 'select') this.hooks.onEdit?.();
      e.preventDefault();
    });
    c.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.tool === 'wall') this.finishChain();
      else if (this.tool === 'wire') this.finishWire();
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
      case 'door': case 'window': return this.placeOpening(p);
      case 'place': return this.placeItem(p, e.altKey);
      case 'dim': return this.clickDim(this.snap(p, { anchor: this.state.a, free }).p);
      case 'text': return this.placeText(p);
      case 'demolish': return this.toggleDemolish(p);
      case 'wire': return this.clickWire(this.snapWire(p, free));
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
      case 'rect': case 'dim': this.cursor = this.snap(p, { anchor: this.tool === 'dim' ? this.state.a : null, free }); break;
      case 'door': case 'window': this.ghostOpening(p); break;
      case 'place': this.ghostItem(p, e.altKey); break;
      case 'wire': this.cursor = { p: this.snapWire(p, free), snap: null }; break;
      case 'demolish': {
        const nw = nearestWall(this.floor, p, 30 / this.view.scale + 10);
        const h = nw && wallMode(this.stage, nw.wall) !== 'hidden' ? { kind: 'walls', id: nw.wall.id } : null;
        if (JSON.stringify(h) !== JSON.stringify(this.hover)) this.hover = h;
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
      if (Math.abs(b.x - a.x) > 30 && Math.abs(b.y - a.y) > 30) this.createRect(a, b);
    }
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
    if (hit.kind === 'walls') {
      this.drag.joints = [{ ...obj.a }, { ...obj.b }];
    }
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
        const pos = add(o, delta);
        Object.assign(obj, pos, { rot: o.rot });
        if (!e.altKey) this.magnet(obj);
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
      case 'wires': obj.points = o.points.map((q) => add(q, delta)); break;
    }
    this.requestRender();
    this.hooks.onLiveChange?.();
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

  // ---------- rīki ----------
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
    if (this.tool === 'wall') this.state = {};
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
    this.store.commit((f) => {
      for (let i = 0; i < 4; i++) {
        const p = pts[i], q = pts[(i + 1) % 4];
        if (!segmentCovered(f, p, q)) f.walls.push({ ...makeWall(p, q, this.newWallProps.thickness, f.height), ...this.newWallProps });
      }
    });
    const c = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const room = this.floor.rooms.find((r) => pointInPolygon(c, r.points));
    if (room && this.stage?.edit?.includes('rooms')) this.store.select({ kind: 'rooms', id: room.id });
  }

  ghostOpening(p) {
    const nw = nearestWall(this.floor, p, 40 / this.view.scale + 10);
    if (!nw) {
      this.state.ghost = null;
      return;
    }
    const o = makeOpening(this.tool, nw.wall.id, this.settings.snap ? round(nw.pos, 5) : nw.pos);
    clampOpening(o, nw.wall);
    const side = Math.sign(dotN(p, nw)) || 1;
    o.swing = side < 0;
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
    this.store.commit((f) => f.openings.push(g.opening));
    this.store.select({ kind: 'openings', id: g.opening.id });
    this.state.ghost = null;
  }

  ghostItem(p, free) {
    const def = byKind(this.state.kind);
    if (!def) return;
    const g = this.state.ghost || { id: uid(), kind: def.kind, name: def.name, w: def.w, d: def.d, h: def.h, elev: def.elev, rot: 0, color: def.color };
    const q = this.settings.snap && !free ? { x: round(p.x, 5), y: round(p.y, 5) } : p;
    Object.assign(g, q);
    if (!free) {
      if (!this.magnet(g)) g.rot = this.state.rot || 0;
    }
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

  clickDim(p) {
    if (!this.state.a) {
      this.state.a = p;
      return;
    }
    const a = this.state.a;
    this.state.a = null;
    if (dist(a, p) < 5) return;
    const dm = { id: uid(), a, b: p, offset: 0 };
    this.store.commit((f) => f.dims.push(dm));
    this.store.select({ kind: 'dims', id: dm.id });
  }

  toggleDemolish(p) {
    const nw = nearestWall(this.floor, p, 30 / this.view.scale + 10);
    if (!nw || wallMode(this.stage, nw.wall) === 'hidden') {
      this.status('Klikšķini tieši uz sienas.');
      return;
    }
    const w = nw.wall;
    this.store.commit(() => { w.status = w.status === 'demolish' ? 'existing' : 'demolish'; });
    this.status(w.status === 'demolish' ? 'Siena atzīmēta nojaukšanai.' : 'Atzīme noņemta.');
  }

  /** Vada punkts pielīp tuvākajam elektrības punktam. */
  snapWire(p, free) {
    if (!free) {
      let best = null;
      for (const it of this.floor.items) {
        const def = byKind(it.kind);
        if (!def?.electric) continue;
        const d = dist(p, it);
        if (d < this.tol * 2 && (!best || d < best.d)) best = { d, it };
      }
      if (best) return { x: best.it.x, y: best.it.y };
      const last = this.state.points?.[this.state.points.length - 1];
      if (last && this.settings.snap) {
        // Vadi parasti iet paralēli sienām — piesaiste horizontālei/vertikālei.
        if (Math.abs(p.x - last.x) < this.tol) return { x: last.x, y: round(p.y, 5) };
        if (Math.abs(p.y - last.y) < this.tol) return { x: round(p.x, 5), y: last.y };
      }
    }
    return this.settings.snap && !free ? { x: round(p.x, 5), y: round(p.y, 5) } : p;
  }

  clickWire(p) {
    const st = this.state;
    st.points = st.points || [];
    const last = st.points[st.points.length - 1];
    if (last && dist(last, p) < 1) return this.finishWire();
    st.points.push(p);
    this.requestRender();
  }

  finishWire() {
    const pts = this.state.points || [];
    this.state.points = [];
    if (pts.length < 2) return this.requestRender();
    const wr = { id: uid(), points: pts, color: '#d93025' };
    this.store.commit((f) => { (f.wires = f.wires || []).push(wr); });
    this.store.select({ kind: 'wires', id: wr.id });
  }

  placeText(p) {
    const l = { id: uid(), x: p.x, y: p.y, text: 'Uzraksts', size: 14 };
    this.store.commit((f) => f.labels.push(l));
    this.store.select({ kind: 'labels', id: l.id });
    this.setTool('select');
    this.hooks.onEdit?.();
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
    if (k === 'Enter' && this.tool === 'wire') {
      this.finishWire();
      return true;
    }
    if (k === 'Escape') {
      if (this.tool === 'wire' && this.state.points?.length) this.finishWire();
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
