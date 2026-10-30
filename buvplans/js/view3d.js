// Interaktīvs 3D skats, kas tiek automātiski uzbūvēts no 2D plāna.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { wallLength, wallDir, wallPoint } from './model.js';
import { parts3D, finish, WALL_FINISHES, byKind } from './catalog.js';
import { finishDef } from './draw2d.js';
import { pointInPolygon, add, mul } from './geometry.js';

const U = 0.01; // cm → m

export class View3D {
  constructor(container, store) {
    this.container = container;
    this.store = store;
    this.options = { allFloors: false, cutWalls: false, shadows: true };
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 500);
    this.camera.position.set(8, 10, 12);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.495;
    this.controls.addEventListener('change', () => this.requestRender());
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.setupLights();
    this.dirty = true;
    this.active = false;
    store.addEventListener('change', () => {
      this.dirty = true;
      if (this.active) this.rebuild();
    });
    new ResizeObserver(() => this.resize()).observe(container);
  }

  setupLights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0xb8b2a6, 2.4);
    this.scene.add(this.hemi, new THREE.AmbientLight(0xffffff, 0.9));
    const sun = new THREE.DirectionalLight(0xfff6e8, 2.2);
    sun.position.set(-8, 16, -6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -15; sc.right = 15; sc.top = 15; sc.bottom = -15; sc.far = 60;
    sun.shadow.bias = -0.0005;
    this.sun = sun;
    this.scene.add(sun, sun.target);
  }

  setTheme(dark) {
    this.scene.background = new THREE.Color(dark ? 0x1b1f24 : 0xe9edf0);
    if (this.ground) this.ground.material.color.set(dark ? 0x272c32 : 0xdfe3e6);
    this.requestRender();
  }

  show() {
    this.active = true;
    this.resize();
    if (this.dirty) this.rebuild(!this.fitted);
    this.loop();
  }

  hide() {
    this.active = false;
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.requestRender();
  }

  requestRender() {
    this.needsRender = true;
  }

  loop() {
    if (!this.active) return;
    requestAnimationFrame(() => this.loop());
    const moved = this.controls.update();
    if (this.needsRender || moved) {
      this.needsRender = false;
      this.renderer.render(this.scene, this.camera);
    }
  }

  rebuild(fit = false) {
    this.dirty = false;
    disposeGroup(this.root);
    this.root.clear();
    const p = this.store.project, cur = this.store.floor;
    // Katram stāvam rāda tā pamatvariantu; aktīvajam stāvam — atvērto variantu.
    const floors = this.options.allFloors ? p.floors.filter((f) => ((f.group || f.id) === (cur.group || cur.id) ? f.id === cur.id : !f.variant)) : [cur];
    for (const f of floors) this.root.add(this.buildFloor(f, this.options.allFloors ? f.elevation : 0));
    const box = new THREE.Box3().setFromObject(this.root);
    if (!this.ground) {
      this.ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0xdfe3e6, roughness: 1 }));
      this.ground.rotation.x = -Math.PI / 2;
      this.ground.position.y = -0.02;
      this.ground.receiveShadow = true;
      this.scene.add(this.ground);
    }
    if (!box.isEmpty()) {
      const c = box.getCenter(new THREE.Vector3());
      this.sun.position.set(c.x - 8, 16, c.z - 6);
      this.sun.target.position.copy(c);
      if (fit || !this.fitted) {
        const sphere = box.getBoundingSphere(new THREE.Sphere());
        const dist = Math.max(sphere.radius, 2) / Math.sin(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 1.05;
        const dir = new THREE.Vector3(0.45, 0.8, 0.75).normalize();
        this.controls.target.copy(sphere.center);
        this.camera.position.copy(sphere.center).addScaledVector(dir, dist);
        this.fitted = true;
      }
    }
    this.requestRender();
  }

  buildFloor(f, elev) {
    const g = new THREE.Group();
    g.position.y = elev * U;
    const mats = new Map();
    const mat = (color, extra = {}) => {
      const k = color + JSON.stringify(extra);
      if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra }));
      return mats.get(k);
    };
    // Grīdas
    for (const r of f.rooms) {
      if (r.points.length < 3) continue;
      const shape = new THREE.Shape(r.points.map((q) => new THREE.Vector2(q.x * U, -q.y * U)));
      const geo = new THREE.ShapeGeometry(shape);
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat(finishDef('floor', r.floorFinish)?.color || '#e4dccd', { roughness: 0.7 }));
      m.position.y = 0.002 + (r.floorRaise || 0) * U;
      m.receiveShadow = true;
      g.add(m);
    }
    // Izmēri ar „Rādīt visos režīmos” — līnija un uzraksts virs grīdas
    for (const dm of f.dims || []) if (dm.allModes) g.add(dimension3D(dm));
    // Sienas ar ailēm
    const wallH = (w) => (this.options.cutWalls ? Math.min(w.height, 110) : w.height);
    for (const w of f.walls) {
      const L = wallLength(w);
      if (L < 1 || w.status === 'demolish' || w.kind === 'virtual') continue;
      const H = wallH(w);
      const color = wallColor(f, w);
      const ops = f.openings.filter((o) => o.wallId === w.id).sort((a, b) => a.pos - b.pos);
      const pieces = [];
      let x = -w.thickness / 2;
      for (const o of ops) {
        const s = o.pos - o.width / 2, e = o.pos + o.width / 2;
        if (s > x) pieces.push([x, s, 0, H]);
        if (o.sill > 0) pieces.push([s, e, 0, Math.min(o.sill, H)]);
        const top = o.sill + o.height;
        if (top < H) pieces.push([s, e, top, H]);
        x = Math.max(x, e);
        this.addOpening(g, w, o, mat, H);
      }
      if (x < L + w.thickness / 2) pieces.push([x, L + w.thickness / 2, 0, H]);
      const d = wallDir(w), ang = Math.atan2(d.y, d.x);
      for (const [s, e, y0, y1] of pieces) {
        if (e - s < 0.1 || y1 - y0 < 0.1) continue;
        const geo = new THREE.BoxGeometry((e - s) * U, (y1 - y0) * U, w.thickness * U);
        const m = new THREE.Mesh(geo, mat(color));
        const c = wallPoint(w, (s + e) / 2);
        m.position.set(c.x * U, ((y0 + y1) / 2) * U, c.y * U);
        m.rotation.y = -ang;
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
      }
    }
    // Priekšmeti
    for (const it of f.items) {
      const def = byKind(it.kind);
      if (!def || it.status === 'demolish') continue;
      if (this.options.cutWalls && def.electric === 'light') continue;
      const ig = new THREE.Group();
      for (const [px, py, pz, pw, ph, pd, tone, shape, flag] of parts3D(it)) {
        let geo;
        if (shape === 'cyl') geo = new THREE.CylinderGeometry((pw / 2) * U, (pw / 2) * U, ph * U, 24);
        else if (shape === 'sphere') geo = new THREE.SphereGeometry(0.5, 20, 14);
        else geo = new THREE.BoxGeometry(pw * U, ph * U, pd * U);
        const color = tone === 'dark' ? shade(it.color, -0.35) : tone === 'white' ? '#f3f1ec' : tone === 'pot' ? '#9a6b4f' : it.color;
        const m = new THREE.Mesh(geo, mat(color, flag === 'light' ? { emissive: new THREE.Color('#fff2c0'), emissiveIntensity: 0.9 } : {}));
        if (shape === 'sphere') m.scale.set(pw * U, ph * U, pd * U);
        m.position.set(px * U, py * U, pz * U);
        m.castShadow = flag !== 'light';
        m.receiveShadow = true;
        ig.add(m);
      }
      ig.position.set(it.x * U, (it.elev || 0) * U, it.y * U);
      ig.rotation.y = (-(it.rot || 0) * Math.PI) / 180;
      if (it.mirror) ig.scale.x = -1;
      g.add(ig);
    }
    return g;
  }

  addOpening(g, w, o, mat, H) {
    const d = wallDir(w), ang = Math.atan2(d.y, d.x);
    const c = wallPoint(w, o.pos);
    const top = Math.min(o.sill + o.height, H);
    if (top <= o.sill) return;
    const frame = mat('#f6f5f2');
    const add3 = (geo, material, x, y) => {
      const m = new THREE.Mesh(geo, material);
      const p = wallPoint(w, o.pos + x);
      m.position.set(p.x * U, y * U, p.y * U);
      m.rotation.y = -ang;
      g.add(m);
      return m;
    };
    if (o.type === 'window') {
      add3(new THREE.BoxGeometry(o.width * U, (top - o.sill) * U, 1.2 * U), mat('#9cc7e0', { transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.1 }), 0, (o.sill + top) / 2);
      add3(new THREE.BoxGeometry(o.width * U, 6 * U, w.thickness * 0.6 * U), frame, 0, o.sill + 3);
      add3(new THREE.BoxGeometry(o.width * U, 5 * U, 7 * U), frame, 0, top - 2.5);
      add3(new THREE.BoxGeometry(5 * U, (top - o.sill) * U, 7 * U), frame, 0, (o.sill + top) / 2);
      // Palodze telpas pusē
      const n = { x: -d.y, y: d.x }, side = o.swing ? -1 : 1;
      const sill = new THREE.Mesh(new THREE.BoxGeometry((o.width + 10) * U, 3 * U, 20 * U), frame);
      const sp = add(c, mul(n, side * (w.thickness / 2)));
      sill.position.set(sp.x * U, (o.sill - 1.5) * U, sp.y * U);
      sill.rotation.y = -ang;
      g.add(sill);
    } else {
      const leaf = add3(new THREE.BoxGeometry((o.width - 4) * U, (top - 1) * U, 4 * U), mat('#c49a6c'), 0, top / 2);
      leaf.castShadow = true;
      add3(new THREE.BoxGeometry(o.width * U, 6 * U, (w.thickness + 2) * U), frame, 0, top - 3);
      for (const sx of [-1, 1]) add3(new THREE.BoxGeometry(5 * U, top * U, (w.thickness + 2) * U), frame, sx * (o.width / 2 - 2.5), top / 2);
    }
  }

  screenshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  /** Skats no augšas albumam: atsevišķs attēls ar fiksētu kameru. */
  snapshot(width = 1400, height = 900) {
    const prevAspect = this.camera.aspect;
    const size = new THREE.Vector2();
    this.renderer.getSize(size);
    if (this.dirty || !this.root.children.length) this.rebuild(true);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    this.renderer.setSize(size.x, size.y);
    this.camera.aspect = prevAspect;
    this.camera.updateProjectionMatrix();
    this.requestRender();
    return url;
  }
}

/** Sienas krāsa ņemta no telpas apdares, kurai siena robežojas. */
function wallColor(f, w) {
  for (const side of ['p', 'n']) {
    const fd = finishDef('wall', w.faces?.[side]?.wall);
    if (fd?.color) return fd.color;
  }
  const mid = wallPoint(w, wallLength(w) / 2);
  const d = wallDir(w), n = { x: -d.y, y: d.x };
  for (const s of [1, -1]) {
    const p = add(mid, mul(n, s * (w.thickness / 2 + 3)));
    const r = f.rooms.find((x) => pointInPolygon(p, x.points));
    if (r) return finish(WALL_FINISHES, r.wallFinish).color;
  }
  return '#eeece6';
}

function shade(hex, k) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + k)));
  return `#${c.getHexString()}`;
}

function disposeGroup(group) {
  group.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}


/** Izmēra līnija 3D skatā ar garuma uzrakstu (sprite). */
function dimension3D(dm) {
  const grp = new THREE.Group();
  const y = 0.03;
  const n = (() => {
    const dx = dm.b.x - dm.a.x, dy = dm.b.y - dm.a.y, L = Math.hypot(dx, dy) || 1;
    return { x: -dy / L, y: dx / L };
  })();
  const off = dm.offset || 0;
  const A = { x: dm.a.x + n.x * off, y: dm.a.y + n.y * off }, B = { x: dm.b.x + n.x * off, y: dm.b.y + n.y * off };
  const color = new THREE.Color(dm.color || '#d9480f');
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(A.x * U, y, A.y * U), new THREE.Vector3(B.x * U, y, B.y * U)]);
  grp.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })));
  const L = Math.hypot(dm.b.x - dm.a.x, dm.b.y - dm.a.y);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(0, 8, 256, 48);
  ctx.fillStyle = `#${color.getHexString()}`;
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${Math.round(L)} cm`, 128, 33);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sp.scale.set(0.8, 0.2, 1);
  sp.position.set(((A.x + B.x) / 2) * U, 0.25, ((A.y + B.y) / 2) * U);
  grp.add(sp);
  return grp;
}
