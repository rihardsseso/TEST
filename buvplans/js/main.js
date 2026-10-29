// Lietotnes savienojums: skati, paneļi, īpašības, stāvi, projekti, eksports.
import { Store, newProject, newFloor, uid, wallLength, wallDir, clampOpening, moveJoint, makeWall, STATUSES, statusLabel } from './model.js';
import { Editor2D, TOOLS } from './editor2d.js';
import { CATALOG, CATEGORIES, FLOOR_FINISHES, WALL_FINISHES, drawItem2D, byKind } from './catalog.js';
import { detectRooms, syncRooms } from './rooms.js';
import { roomStats, floorStats, specification, openingSchedule, statsCSV, fmt } from './calc.js';
import { roomElevations, elevationSVG } from './elevations.js';
import { buildAlbum, SHEET_TYPES } from './album.js';
import { readTheme, renderFloorImage } from './draw2d.js';
import { sampleProject } from './sample.js';
import * as storage from './storage.js';
import { add, mul, polygonArea } from './geometry.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const embedded = (() => { try { return window.self !== window.top; } catch { return true; } })();
document.documentElement.classList.toggle('embedded', embedded);

// ---------- projekta ielāde ----------
function initialProject() {
  const last = storage.lastProjectId();
  const p = last && storage.loadProject(last);
  if (p) {
    try { return storage.validateProject(p); } catch { /* bojāts — sāk ar paraugu */ }
  }
  const s = sampleProject();
  storage.saveProject(s);
  return s;
}

const store = new Store(initialProject());
storage.setLastProject(store.project.id);

// ---------- stāvokļa josla un paziņojumi ----------
const statusEl = $('#statusHint'), coordEl = $('#statusCoord');
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

// ---------- 2D redaktors ----------
const editor = new Editor2D($('#plan'), store, {
  onStatus: (t) => { statusEl.textContent = t; },
  onCursor: (p) => { coordEl.textContent = `x ${Math.round(p.x)}  y ${Math.round(p.y)} cm`; },
  onTool: (tool) => {
    $$('#tools [data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
    $$('#catalogGrid .cat-item').forEach((b) => b.classList.toggle('active', tool === 'place' && b.dataset.kind === editor.state.kind));
  },
  onEdit: () => {
    openSide('props');
    setTimeout(() => $('#props input')?.focus(), 30);
  },
});
Object.assign(editor.settings, storage.getPref('settings', {}));
editor.setTool('select');

// ---------- 3D (ielādē slinki, lai 2D strādā arī bez WebGL) ----------
let view3d = null;
async function ensure3D() {
  if (view3d) return view3d;
  try {
    const { View3D } = await import('./view3d.js');
    view3d = new View3D($('#scene'), store);
    view3d.setTheme(isDark());
  } catch (err) {
    $('#scene').innerHTML = `<p class="empty">3D skatu neizdevās ielādēt: ${esc(err.message)}. Pārbaudi interneta savienojumu un WebGL atbalstu.</p>`;
  }
  return view3d;
}

// ---------- skati ----------
let currentView = 'plan';
function setView(v) {
  currentView = v;
  $$('.views [data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  $$('.view').forEach((el) => { el.hidden = el.dataset.view !== v; });
  document.documentElement.dataset.view = v;
  if (v === 'plan') editor.resize();
  if (v === '3d') ensure3D().then((x) => x?.show());
  else view3d?.hide();
  if (v === 'calc') renderCalc();
  if (v === 'elev') renderElev();
  if (v === 'album') renderAlbum();
  try { if (location.hash.slice(1) !== v) history.replaceState(null, '', `#${v}`); } catch { /* ignore */ }
}
$$('.views [data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
window.addEventListener('hashchange', () => {
  const v = location.hash.slice(1);
  if (['plan', '3d', 'elev', 'calc', 'album'].includes(v) && v !== currentView) setView(v);
});

// ---------- rīki ----------
$$('#tools [data-tool]').forEach((b) => b.addEventListener('click', () => editor.setTool(b.dataset.tool)));
$('#undoBtn').addEventListener('click', () => store.undo());
$('#redoBtn').addEventListener('click', () => store.redo());
$('#zoomIn').addEventListener('click', () => editor.zoom(1.25));
$('#zoomOut').addEventListener('click', () => editor.zoom(0.8));
$('#zoomFit').addEventListener('click', () => editor.fit());

// ---------- sānu panelis ----------
const narrow = () => matchMedia('(max-width: 820px)').matches;
function openSide(tab, open = true) {
  $$('.side-tabs [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  $('#catalog').hidden = tab !== 'catalog';
  $('#props').hidden = tab !== 'props';
  if (open) document.documentElement.classList.add('side-open');
  if (tab === 'props') renderProps();
}
$$('.side-tabs [data-tab]').forEach((b) => b.addEventListener('click', () => openSide(b.dataset.tab)));
$('#sideToggle').addEventListener('click', () => document.documentElement.classList.toggle('side-open'));
$('#sideClose').addEventListener('click', () => document.documentElement.classList.remove('side-open'));

// ---------- katalogs ----------
let catFilter = 'all', catQuery = '';
function renderCatalogChips() {
  $('#catalogChips').innerHTML = [{ id: 'all', name: 'Viss' }, ...CATEGORIES]
    .map((c) => `<button type="button" class="chip" data-cat="${c.id}" aria-pressed="${c.id === catFilter}">${c.name}</button>`).join('');
  $$('#catalogChips .chip').forEach((b) => b.addEventListener('click', () => {
    catFilter = b.dataset.cat;
    renderCatalogChips();
    renderCatalog();
  }));
}
function renderCatalog() {
  const q = catQuery.trim().toLowerCase();
  const items = CATALOG.filter((c) => (catFilter === 'all' || c.cat === catFilter) && (!q || c.name.toLowerCase().includes(q)));
  $('#catalogGrid').innerHTML = items.length
    ? items.map((c) => `<button type="button" class="cat-item" data-kind="${c.kind}" title="${esc(c.name)} — ${c.w}×${c.d}×${c.h} cm"><canvas width="96" height="72"></canvas><span>${esc(c.name)}</span><small>${c.w}×${c.d}</small></button>`).join('')
    : '<p class="empty">Nekas netika atrasts.</p>';
  const t = readTheme();
  $$('#catalogGrid .cat-item').forEach((b) => {
    const def = byKind(b.dataset.kind);
    const cv = $('canvas', b), ctx = cv.getContext('2d');
    const k = Math.min(80 / def.w, 56 / def.d, 1.4);
    ctx.translate(48, 36);
    ctx.scale(k, k);
    ctx.lineWidth = 1.2 / k;
    ctx.fillStyle = def.color;
    ctx.strokeStyle = t.itemStroke;
    drawItem2D(ctx, def);
    b.addEventListener('click', () => {
      if (currentView !== 'plan') setView('plan');
      editor.setTool('place', { kind: def.kind });
      if (narrow()) document.documentElement.classList.remove('side-open');
    });
  });
}
$('#catalogSearch').addEventListener('input', (e) => { catQuery = e.target.value; renderCatalog(); });

// ---------- īpašību panelis ----------
const num = (label, key, value, opts = {}) => `<label class="field"><span>${label}</span><input type="number" inputmode="decimal" data-k="${key}" value="${Math.round(value * 10) / 10}" step="${opts.step || 1}" ${opts.min !== undefined ? `min="${opts.min}"` : ''}><em>${opts.unit ?? 'cm'}</em></label>`;
const txt = (label, key, value) => `<label class="field wide"><span>${label}</span><input type="text" data-k="${key}" value="${esc(value)}"></label>`;
const sel = (label, key, value, options) => `<label class="field wide"><span>${label}</span><select data-k="${key}">${options.map(([v, n]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
const chk = (label, key, value) => `<label class="check"><input type="checkbox" data-k="${key}" ${value ? 'checked' : ''}><span>${label}</span></label>`;
const btn = (label, act, cls = '') => `<button type="button" class="btn ${cls}" data-act="${act}">${label}</button>`;
const stat = (label, value) => `<div class="stat"><dt>${label}</dt><dd>${value}</dd></div>`;

const KIND_NAMES = { walls: 'Siena', openings: 'Aile', items: 'Priekšmets', rooms: 'Telpa', labels: 'Uzraksts', dims: 'Izmēra līnija' };

function renderProps() {
  const el = $('#props');
  const s = store.selection, obj = store.selected(), f = store.floor;
  let h = '';
  if (!obj) {
    const bg = f.background;
    h += `<h3>Stāvs</h3><div class="fields">${txt('Nosaukums', 'f.name', f.name)}${num('Griestu augstums', 'f.height', f.height)}${num('Līmenis (no ±0,00)', 'f.elevation', f.elevation)}${chk('Plānojuma variants (3D nerāda kopā ar stāviem)', 'f.variant', f.variant)}</div>
      <div class="row">${btn('Noteikt telpas no sienām', 'detect')}${btn('Visām sienām šo augstumu', 'applyHeight')}</div>
      <h3>Zīmēšana</h3><div class="fields">${num('Jaunas sienas biezums', 's.wallThickness', editor.settings.wallThickness, { min: 5 })}
      ${sel('Mērvienības', 's.units', editor.settings.units, [['cm', 'Centimetri'], ['mm', 'Milimetri'], ['m', 'Metri']])}
      ${chk('Režģis', 's.grid', editor.settings.grid)}${chk('Piesaiste režģim un leņķiem', 's.snap', editor.settings.snap)}${chk('Sienu garumi', 's.dims', editor.settings.dims)}${chk('Telpas veidojas automātiski', 's.autoRooms', editor.settings.autoRooms)}</div>
      <h3>Fona attēls</h3><p class="hint">Augšupielādē esošu plānu (attēlu) un pārzīmē to pa virsu.</p>
      ${bg ? `<div class="fields">${num('Attēla platums dabā', 'bg.widthCm', bg.widthCm, { min: 10 })}${num('Nobīde X', 'bg.x', bg.x || 0)}${num('Nobīde Y', 'bg.y', bg.y || 0)}
        <label class="field wide"><span>Caurspīdīgums</span><input type="range" min="0.05" max="1" step="0.05" data-k="bg.opacity" value="${bg.opacity ?? 0.5}"></label>${chk('Rādīt', 'bg.visible', bg.visible !== false)}</div>
        <div class="row">${btn('Aizstāt attēlu', 'bgUpload')}${btn('Noņemt', 'bgRemove', 'danger')}</div>` : `<div class="row">${btn('Augšupielādēt attēlu', 'bgUpload')}</div>`}
      <h3>Projekts</h3><div class="fields">${txt('Autors (albumam)', 'p.author', store.project.author)}${txt('Adrese', 'p.address', store.project.address)}
      ${sel('Statuss', 'p.status', store.project.status, STATUSES)}${txt('Mape', 'p.folder', store.project.folder)}</div>`;
  } else {
    h += `<h3>${KIND_NAMES[s.kind]}</h3>`;
    if (s.kind === 'walls') {
      h += `<div class="fields">${num('Garums (ass)', 'len', wallLength(obj), { min: 1 })}${num('Biezums', 'thickness', obj.thickness, { min: 2 })}${num('Augstums', 'height', obj.height, { min: 10 })}</div>
        <div class="row">${btn('Sadalīt uz pusēm', 'split')}${btn('Dzēst', 'delete', 'danger')}</div><p class="hint">Velc apļus sienas galos, lai mainītu stūrus; savienotās sienas sekos līdzi.</p>`;
    } else if (s.kind === 'openings') {
      h += `<div class="fields">${sel('Veids', 'type', obj.type, [['door', 'Durvis'], ['window', 'Logs']])}${num('Platums', 'width', obj.width, { min: 20 })}${num('Augstums', 'height', obj.height, { min: 20 })}
        ${num(obj.type === 'door' ? 'Slieksnis' : 'Palodzes augstums', 'sill', obj.sill, { min: 0 })}${num('No sienas sākuma', 'offset', obj.pos - obj.width / 2, { min: 0 })}</div>
        <div class="row">${obj.type === 'door' ? btn('Mainīt eņģu pusi', 'hinge') : ''}${btn(obj.type === 'door' ? 'Mainīt virināšanas pusi' : 'Mainīt palodzes pusi', 'swing')}${btn('Dzēst', 'delete', 'danger')}</div>`;
    } else if (s.kind === 'items') {
      const def = byKind(obj.kind);
      h += `<div class="fields">${txt('Nosaukums', 'name', obj.name || def?.name || '')}${num('Platums', 'w', obj.w, { min: 1 })}${num('Dziļums', 'd', obj.d, { min: 1 })}${num('Augstums', 'h', obj.h, { min: 1 })}
        ${num('Augstums no grīdas', 'elev', obj.elev || 0, { min: 0 })}${num('Pagrieziens', 'rot', obj.rot || 0, { unit: '°', step: 15 })}
        <label class="field wide"><span>Krāsa</span><input type="color" data-k="color" value="${obj.color || '#cccccc'}"></label></div>
        <div class="row">${btn('Pagriezt 90°', 'rotate')}${btn('Dublēt', 'duplicate')}${btn('Dzēst', 'delete', 'danger')}</div><p class="hint">R — pagriezt, bultiņas — pabīdīt (Shift — pa 10 cm), Alt vilkšanas laikā — bez piesaistes sienai.</p>`;
    } else if (s.kind === 'rooms') {
      const r = roomStats(f, obj);
      h += `<div class="fields">${txt('Nosaukums', 'name', obj.name)}${sel('Grīdas segums', 'floorFinish', obj.floorFinish, FLOOR_FINISHES.map((x) => [x.id, x.name]))}
        ${sel('Sienu apdare', 'wallFinish', obj.wallFinish, WALL_FINISHES.map((x) => [x.id, x.name]))}${num('Griestu augstums', 'height', obj.height || f.height, { min: 100 })}</div>
        <dl class="stats">${stat('Laukums', `${fmt(r.area)} m²`)}${stat('Perimetrs', `${fmt(r.perimeter)} m`)}${stat('Sienu laukums (bez ailēm)', `${fmt(r.wallNet)} m²`)}${stat('Tilpums', `${fmt(r.volume)} m³`)}${stat('Grīdlīste', `${fmt(r.baseboard)} m`)}${stat('Rozetes / slēdži / gaismekļi', `${r.sockets} / ${r.switches} / ${r.lights}`)}</dl>
        <div class="row">${btn('Sienu skati', 'elev')}${btn('Dzēst telpu', 'delete', 'danger')}</div>`;
    } else if (s.kind === 'labels') {
      h += `<div class="fields">${txt('Teksts', 'text', obj.text)}${num('Burtu izmērs', 'size', obj.size || 14, { unit: 'px', min: 8 })}</div><div class="row">${btn('Dzēst', 'delete', 'danger')}</div>`;
    } else if (s.kind === 'dims') {
      h += `<div class="fields">${num('Atkāpe', 'offset', obj.offset || 0)}</div><dl class="stats">${stat('Garums', `${Math.round(Math.hypot(obj.b.x - obj.a.x, obj.b.y - obj.a.y))} cm`)}</dl><div class="row">${btn('Dzēst', 'delete', 'danger')}</div>`;
    }
  }
  el.innerHTML = h;
  bindProps(el, s, obj);
}

function bindProps(el, s, obj) {
  const f = store.floor;
  $$('[data-k]', el).forEach((input) => {
    const evt = input.type === 'range' ? 'input' : 'change';
    input.addEventListener(evt, () => {
      const k = input.dataset.k;
      const v = input.type === 'checkbox' ? input.checked : input.type === 'number' || input.type === 'range' ? parseFloat(input.value) : input.value;
      if (input.type === 'number' && !Number.isFinite(v)) return;
      if (k.startsWith('s.')) {
        editor.settings[k.slice(2)] = v;
        storage.setPref('settings', editor.settings);
        editor.requestRender();
        return;
      }
      if (k.startsWith('bg.')) {
        store.commit((fl) => { fl.background[k.slice(3)] = v; });
        return;
      }
      if (k.startsWith('f.')) {
        store.commit((fl) => { fl[k.slice(2)] = v; });
        renderFloors();
        return;
      }
      if (k.startsWith('p.')) {
        store.commit((fl, p) => { p[k.slice(2)] = v; });
        return;
      }
      store.commit(() => applyProp(f, s.kind, obj, k, v));
      if (s.kind === 'openings' && k === 'type') renderProps();
    });
  });
  $$('[data-act]', el).forEach((b) => b.addEventListener('click', () => propAction(b.dataset.act, s, obj)));
}

function applyProp(f, kind, obj, k, v) {
  if (kind === 'walls' && k === 'len') {
    const d = wallDir(obj);
    const to = add(obj.a, mul(d, Math.max(1, v)));
    moveJoint(f, { ...obj.b }, to);
    syncRooms(f);
    return;
  }
  if (kind === 'openings') {
    const w = f.walls.find((x) => x.id === obj.wallId);
    if (k === 'offset') obj.pos = v + obj.width / 2;
    else if (k === 'type') {
      obj.type = v;
      Object.assign(obj, v === 'door' ? { sill: 0, height: 210, width: 90 } : { sill: 85, height: 140, width: 140 });
    } else obj[k] = v;
    if (w) clampOpening(obj, w);
    return;
  }
  if (kind === 'walls' && k === 'thickness') {
    obj.thickness = v;
    syncRooms(f);
    return;
  }
  obj[k] = k === 'rot' ? ((v % 360) + 360) % 360 : v;
}

function propAction(act, s, obj) {
  const f = store.floor;
  switch (act) {
    case 'delete': store.deleteSelected(); break;
    case 'detect': {
      store.checkpoint();
      const c = detectRooms(f);
      store.touch();
      toast(c.length ? `Atrastas jaunas telpas: ${c.length}` : 'Jaunu slēgtu telpu nav. Pārliecinies, ka sienas savienojas stūros.');
      break;
    }
    case 'applyHeight': store.commit((fl) => fl.walls.forEach((w) => { w.height = fl.height; })); toast('Sienu augstums atjaunināts'); break;
    case 'split': store.commit((fl) => {
      const L = wallLength(obj), mid = add(obj.a, mul(wallDir(obj), L / 2));
      const w2 = makeWall(mid, obj.b, obj.thickness, obj.height);
      for (const o of fl.openings) if (o.wallId === obj.id && o.pos > L / 2) { o.wallId = w2.id; o.pos -= L / 2; }
      obj.b = mid;
      fl.walls.push(w2);
    }); break;
    case 'hinge': store.commit(() => { obj.hinge = !obj.hinge; }); break;
    case 'swing': store.commit(() => { obj.swing = !obj.swing; }); break;
    case 'rotate': store.commit(() => { obj.rot = ((obj.rot || 0) + 90) % 360; }); break;
    case 'duplicate': duplicateSelection(); break;
    case 'elev': elevRoomId = obj.id; setView('elev'); break;
    case 'bgUpload': $('#fileBg').click(); break;
    case 'bgRemove': store.commit((fl) => { fl.background = null; }); break;
  }
}

function duplicateSelection() {
  const s = store.selection, obj = store.selected();
  if (!obj || !['items', 'labels'].includes(s.kind)) return;
  const copy = { ...JSON.parse(JSON.stringify(obj)), id: uid(), x: obj.x + 20, y: obj.y + 20 };
  store.commit((f) => f[s.kind].push(copy));
  store.select({ kind: s.kind, id: copy.id });
}

$('#fileBg').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) {
    toast('Attēls ir lielāks par 4 MB — samazini to, lai projekts ietilptu pārlūka krātuvē.');
    return;
  }
  const r = new FileReader();
  r.onload = () => {
    store.commit((f) => { f.background = { src: r.result, widthCm: 1000, x: 0, y: 0, opacity: 0.5, visible: true }; });
    toast('Fona attēls pievienots. Norādi tā platumu dabā, lai mērogs sakristu.');
  };
  r.readAsDataURL(file);
});

// ---------- stāvi ----------
function renderFloors() {
  const p = store.project;
  $('#floorTabs').innerHTML = p.floors.map((f) => `<button type="button" role="tab" class="floor-tab ${f.variant ? 'variant' : ''}" data-id="${f.id}" aria-selected="${f.id === store.floorId}">${esc(f.name)}</button>`).join('');
  $$('#floorTabs .floor-tab').forEach((b) => b.addEventListener('click', () => {
    store.setFloor(b.dataset.id);
    editor.fit();
  }));
  $('#floorDelete').disabled = p.floors.length < 2;
}
$('#floorAdd').addEventListener('click', () => {
  const p = store.project, top = p.floors.filter((f) => !f.variant).reduce((m, f) => Math.max(m, f.elevation + f.height), 0);
  const n = p.floors.filter((f) => !f.variant).length + 1;
  const f = newFloor(`${n}. stāvs`, top + 30, store.floor.height);
  // Jaunais stāvs manto ārsienas, lai būtu no kā sākt.
  const src = store.floor;
  const maxT = Math.max(0, ...src.walls.map((w) => w.thickness));
  f.walls = src.walls.filter((w) => w.thickness === maxT).map((w) => ({ ...JSON.parse(JSON.stringify(w)), id: uid() }));
  store.commit((_, pr) => pr.floors.push(f));
  store.setFloor(f.id);
  detectRooms(store.floor);
  store.touch();
  toast(`${f.name} pievienots ar ārsienām no iepriekšējā stāva`);
});
$('#floorVariant').addEventListener('click', () => {
  const src = store.floor;
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid();
  copy.variant = true;
  copy.name = `${src.name.replace(/ \(variants.*\)$/, '')} (variants ${store.project.floors.filter((f) => f.variant).length + 1})`;
  store.commit((_, pr) => pr.floors.push(copy));
  store.setFloor(copy.id);
  toast('Izveidots plānojuma variants — maini to, oriģināls paliek neskarts');
});
$('#floorDelete').addEventListener('click', () => {
  if (store.project.floors.length < 2) return;
  confirmInline($('#floorDelete'), `Dzēst „${store.floor.name}”?`, () => {
    const id = store.floorId;
    store.commit((_, pr) => { pr.floors = pr.floors.filter((f) => f.id !== id); });
    store.setFloor(store.project.floors[0].id);
  });
});

/** Apstiprinājums lapas iekšienē (pārlūka confirm() iegultā skatā nedarbojas). */
function confirmInline(anchor, question, onYes) {
  const pop = $('#confirmPop');
  $('#confirmText').textContent = question;
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 260, r.left))}px`;
  pop.style.top = `${Math.max(8, r.top - 96)}px`;
  const close = () => { pop.hidden = true; };
  $('#confirmYes').onclick = () => { close(); onYes(); };
  $('#confirmNo').onclick = close;
  $('#confirmYes').focus();
}

// ---------- aprēķini ----------
function renderCalc() {
  const p = store.project;
  let h = '';
  const all = p.floors.map((f) => ({ f, st: floorStats(f) }));
  const main = all.filter((x) => !x.f.variant);
  const sum = (k) => main.reduce((s, x) => s + x.st.totals[k], 0);
  h += `<div class="tiles">
    <div class="tile"><span>Kopējā platība</span><b>${fmt(sum('area'))}<small> m²</small></b></div>
    <div class="tile"><span>Telpas</span><b>${main.reduce((s, x) => s + x.st.rooms.length, 0)}</b></div>
    <div class="tile"><span>Sienu apjoms</span><b>${fmt(sum('wallVolume'))}<small> m³</small></b></div>
    <div class="tile"><span>Krāsojamās sienas</span><b>${fmt(sum('wallNet'))}<small> m²</small></b></div>
    <div class="tile"><span>Grīdlīste</span><b>${fmt(sum('baseboard'))}<small> m</small></b></div>
    <div class="tile"><span>Logu laukums</span><b>${fmt(sum('windowArea'))}<small> m²</small></b></div>
  </div>
  <div class="row calc-actions">${btn('Kopēt kā CSV', 'csvCopy')}<button type="button" class="btn embed-hide" data-act="csvSave">Lejupielādēt CSV</button></div>`;
  for (const { f, st } of all) {
    const rows = st.rooms.map((r) => `<tr><td>${esc(r.name)}</td><td class="n">${fmt(r.area)}</td><td class="n">${fmt(r.perimeter)}</td><td class="n">${fmt(r.volume)}</td><td class="n">${fmt(r.wallNet)}</td><td class="n">${fmt(r.ceiling)}</td><td class="n">${fmt(r.baseboard)}</td><td class="n">${fmt(r.windowSills)}</td><td class="n">${r.doors}/${r.windows}</td><td class="n">${r.sockets}/${r.switches}/${r.lights}</td><td>${esc(r.floorFinish)}</td></tr>`).join('');
    const spec = specification(f).map((s) => `<tr><td>${esc(s.name)}</td><td class="n">${s.w}×${s.d}×${s.h}</td><td class="n">${s.count}</td></tr>`).join('');
    const ops = openingSchedule(f).map((o) => `<tr><td>${o.type}</td><td class="n">${o.width}×${o.height}</td><td class="n">${o.sill}</td></tr>`).join('');
    h += `<section class="calc-floor"><h2>${esc(f.name)}${f.variant ? ' <span class="pill">variants</span>' : ''}</h2>
      <div class="table-wrap"><table class="data"><thead><tr><th>Telpa</th><th class="n">Laukums m²</th><th class="n">Perimetrs m</th><th class="n">Tilpums m³</th><th class="n">Sienas m²</th><th class="n">Griesti m²</th><th class="n">Grīdlīste m</th><th class="n">Palodzes m</th><th class="n">Durvis/logi</th><th class="n">Roz./slēdži/gaism.</th><th>Grīda</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="11" class="empty">Šajā stāvā vēl nav telpu. Uzzīmē sienas vai velc taisnstūri ar rīku „Telpa”.</td></tr>'}</tbody>
      <tfoot><tr><td>Kopā</td><td class="n">${fmt(st.totals.area)}</td><td></td><td class="n">${fmt(st.totals.volume)}</td><td class="n">${fmt(st.totals.wallNet)}</td><td class="n">${fmt(st.totals.ceiling)}</td><td class="n">${fmt(st.totals.baseboard)}</td><td></td><td class="n">${st.totals.doors}/${st.totals.windows}</td><td class="n">${st.totals.sockets}/${st.totals.switches}/${st.totals.lights}</td><td></td></tr></tfoot></table></div>
      <div class="calc-cols"><div class="table-wrap"><h3>Mēbeles un iekārtas</h3><table class="data"><thead><tr><th>Nosaukums</th><th class="n">Izmēri cm</th><th class="n">Skaits</th></tr></thead><tbody>${spec || '<tr><td colspan="3" class="empty">Nav priekšmetu</td></tr>'}</tbody></table></div>
      <div class="table-wrap"><h3>Ailes</h3><table class="data"><thead><tr><th>Veids</th><th class="n">P×A cm</th><th class="n">Palodze cm</th></tr></thead><tbody>${ops || '<tr><td colspan="3" class="empty">Nav aiļu</td></tr>'}</tbody></table>
      <dl class="stats">${stat('Sienu garums', `${fmt(st.totals.wallLength)} m`)}${stat('Mūra apjoms', `${fmt(st.totals.wallVolume)} m³`)}</dl></div></div></section>`;
  }
  const el = $('#calcBody');
  el.innerHTML = h;
  $$('[data-act]', el).forEach((b) => b.addEventListener('click', () => {
    const csv = statsCSV(store.project);
    if (b.dataset.act === 'csvSave') download(`${store.project.name}.csv`, new Blob(['﻿' + csv], { type: 'text/csv' }));
    else copyText(csv, 'Tabula nokopēta — ielīmē to izklājlapā');
  }));
}

// ---------- sienu skati ----------
let elevRoomId = null;
function renderElev() {
  const f = store.floor;
  const el = $('#elevBody');
  if (!f.rooms.length) {
    el.innerHTML = '<p class="empty">Sienu skati veidojas no telpām. Šajā stāvā telpu vēl nav.</p>';
    return;
  }
  if (!f.rooms.some((r) => r.id === elevRoomId)) elevRoomId = f.rooms[0].id;
  const room = f.rooms.find((r) => r.id === elevRoomId);
  const els = roomElevations(f, room);
  el.innerHTML = `<div class="chips" role="tablist">${f.rooms.map((r) => `<button type="button" class="chip" data-room="${r.id}" aria-pressed="${r.id === elevRoomId}">${esc(r.name)}</button>`).join('')}</div>
    <p class="hint">Katra siena attēlota, stāvot telpā un skatoties pret to. Elektrības punktiem norādīts augstums no grīdas.</p>
    <div class="elev-grid">${els.map((e) => `<figure class="elev-card"><figcaption><b>${e.label}</b> ${fmt(e.length / 100)} m × ${fmt(e.height / 100)} m · ${e.openings.length} ailes · ${e.items.length} priekšmeti</figcaption>${elevationSVG(e, editor.settings.units)}</figure>`).join('')}</div>`;
  $$('[data-room]', el).forEach((b) => b.addEventListener('click', () => { elevRoomId = b.dataset.room; renderElev(); }));
}

// ---------- albums ----------
const albumSheets = new Set(storage.getPref('albumSheets', SHEET_TYPES.map((s) => s.id)));
function renderAlbumControls() {
  $('#albumOpts').innerHTML = SHEET_TYPES.map((s) => `<label class="check"><input type="checkbox" value="${s.id}" ${albumSheets.has(s.id) ? 'checked' : ''}><span>${s.name}</span></label>`).join('');
  $$('#albumOpts input').forEach((i) => i.addEventListener('change', () => {
    if (i.checked) albumSheets.add(i.value); else albumSheets.delete(i.value);
    storage.setPref('albumSheets', [...albumSheets]);
    renderAlbum();
  }));
}
async function renderAlbum() {
  const body = $('#albumSheets');
  body.innerHTML = '<p class="empty">Gatavo lapas…</p>';
  let v3 = null;
  if (albumSheets.has('visual')) v3 = await ensure3D();
  const { html, count } = buildAlbum(store.project, {
    enabled: albumSheets, units: editor.settings.units,
    snapshot: v3 ? () => { v3.rebuild(true); return v3.snapshot(1400, 900); } : null,
  });
  body.innerHTML = html || '<p class="empty">Izvēlies vismaz vienu lapu tipu.</p>';
  $('#albumCount').textContent = `${count} lapas`;
  scaleSheets();
}
function scaleSheets() {
  const wrap = $('#albumSheets');
  const w = wrap.clientWidth;
  const k = Math.min(1, w / 1123);
  wrap.style.setProperty('--sheet-k', k);
}
new ResizeObserver(() => { if (currentView === 'album') scaleSheets(); }).observe($('#albumSheets'));
$('#albumPrint').addEventListener('click', () => window.print());

// ---------- 3D vadīklas ----------
$$('#view3dOpts input').forEach((i) => i.addEventListener('change', async () => {
  const v = await ensure3D();
  if (!v) return;
  v.options[i.dataset.opt] = i.checked;
  v.rebuild(i.dataset.opt === 'allFloors');
}));
$('#view3dReset').addEventListener('click', async () => (await ensure3D())?.rebuild(true));
$('#view3dShot').addEventListener('click', async () => {
  const v = await ensure3D();
  if (v) exportImage(v.screenshot(), `${store.project.name} 3D.png`);
});
$('#planPng').addEventListener('click', () => {
  const t = readTheme();
  exportImage(renderFloorImage(store.floor, t, { width: 2000, height: 1400, units: editor.settings.units }), `${store.project.name} - ${store.floor.name}.png`);
});

// ---------- eksports / imports ----------
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name.replace(/[\\/:*?"<>|]/g, '_');
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function exportImage(dataUrl, name) {
  if (!embedded) {
    fetch(dataUrl).then((r) => r.blob()).then((b) => download(name, b));
    return;
  }
  const d = $('#exportDialog');
  $('#exportTitle').textContent = 'Attēls';
  $('#exportBody').innerHTML = `<p class="hint">Šajā skatā lejupielāde nav atļauta — ar peles labo pogu (vai ilgi turot) saglabā attēlu.</p><img src="${dataUrl}" alt="${esc(name)}" class="export-img">`;
  d.showModal();
}
async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  } catch {
    const d = $('#exportDialog');
    $('#exportTitle').textContent = 'Kopē tekstu';
    $('#exportBody').innerHTML = '<p class="hint">Atlasi tekstu un nokopē to (Ctrl+C).</p><textarea class="export-text" readonly></textarea>';
    $('#exportBody textarea').value = text;
    d.showModal();
    $('#exportBody textarea').select();
  }
}
$('#exportClose').addEventListener('click', () => $('#exportDialog').close());

// ---------- projekti ----------
function renderProjects() {
  const list = storage.listProjects();
  const folders = [...new Set(list.map((p) => p.folder).filter(Boolean))].sort();
  const groups = [['', list.filter((p) => !p.folder)], ...folders.map((f) => [f, list.filter((p) => p.folder === f)])];
  $('#projectList').innerHTML = groups.filter(([, items]) => items.length).map(([folder, items]) => `
    ${folder ? `<h3 class="folder">${esc(folder)}</h3>` : ''}
    <ul class="plist">${items.map((p) => `<li class="${p.id === store.project.id ? 'current' : ''}">
      <button type="button" class="plist-open" data-open="${p.id}"><b>${esc(p.name)}</b><span>${p.floors} ${p.floors === 1 ? 'stāvs' : 'stāvi'} · ${fmt(p.area || 0, 1)} m² · ${new Date(p.updated).toLocaleString('lv-LV', { dateStyle: 'short', timeStyle: 'short' })}</span></button>
      <span class="pill status-${p.status || 'draft'}">${statusLabel(p.status)}</span>
      <button type="button" class="btn small" data-dup="${p.id}">Dublēt</button>
      <button type="button" class="btn small danger" data-del="${p.id}">Dzēst</button></li>`).join('')}</ul>`).join('') || '<p class="empty">Saglabātu projektu nav.</p>';
  $$('[data-open]').forEach((b) => b.addEventListener('click', () => openProject(b.dataset.open)));
  $$('[data-dup]').forEach((b) => b.addEventListener('click', () => {
    const p = storage.loadProject(b.dataset.dup);
    if (!p) return;
    p.id = uid();
    p.name = `${p.name} (kopija)`;
    p.updated = new Date().toISOString();
    storage.saveProject(p);
    renderProjects();
  }));
  $$('[data-del]').forEach((b) => b.addEventListener('click', () => confirmInline(b, 'Dzēst projektu neatgriezeniski?', () => {
    storage.deleteProject(b.dataset.del);
    if (b.dataset.del === store.project.id) loadIntoEditor(storage.listProjects()[0] ? storage.loadProject(storage.listProjects()[0].id) : newProject());
    renderProjects();
  })));
}
function loadIntoEditor(p) {
  storage.validateProject(p);
  store.load(p);
  storage.saveProject(p);
  storage.setLastProject(p.id);
  editor.fitted = false;
  editor.fit();
  syncProjectUI();
  if (view3d) view3d.fitted = false;
  setView(currentView === 'album' ? 'plan' : currentView);
}
function openProject(id) {
  const p = storage.loadProject(id);
  if (!p) return toast('Projektu neizdevās atvērt.');
  loadIntoEditor(p);
  $('#projectsDialog').close();
}
$('#projectsBtn').addEventListener('click', () => { renderProjects(); $('#projectsDialog').showModal(); });
$('#projectsClose').addEventListener('click', () => $('#projectsDialog').close());
$('#newProject').addEventListener('click', () => {
  const p = newProject(`Projekts ${storage.listProjects().length + 1}`);
  loadIntoEditor(p);
  $('#projectsDialog').close();
  editor.setTool('rect');
  toast('Jauns projekts. Velc taisnstūri, lai uzzīmētu pirmo telpu.');
});
$('#sampleProject').addEventListener('click', () => { loadIntoEditor(sampleProject()); $('#projectsDialog').close(); });
$('#importBtn').addEventListener('click', () => $('#fileImport').click());
$('#fileImport').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  file.text().then((t) => {
    const p = storage.validateProject(JSON.parse(t));
    if (storage.loadProject(p.id)) p.id = uid();
    loadIntoEditor(p);
    $('#projectsDialog').close();
    toast(`Importēts: ${p.name}`);
  }).catch((err) => toast(`Importēt neizdevās: ${err.message}`));
});
$('#exportBtn').addEventListener('click', () => {
  const json = JSON.stringify(store.project, null, 1);
  if (embedded) copyText(json, 'Projekta JSON nokopēts');
  else download(`${store.project.name}.buvplans.json`, new Blob([json], { type: 'application/json' }));
});

// ---------- projekta nosaukums un saglabāšana ----------
const nameInput = $('#projectName');
nameInput.addEventListener('change', () => store.commit((f, p) => { p.name = nameInput.value.trim() || 'Bez nosaukuma'; }));
function syncProjectUI() {
  nameInput.value = store.project.name;
  document.title = `${store.project.name} · Būvplāns`;
  renderFloors();
}
let saveTimer;
function scheduleSave() {
  clearTimeout(saveTimer);
  $('#saveState').textContent = 'Saglabā…';
  saveTimer = setTimeout(() => {
    const ok = storage.saveProject(store.project);
    storage.setLastProject(store.project.id);
    $('#saveState').textContent = ok ? 'Saglabāts pārlūkā' : 'Nav saglabāts — eksportē JSON';
    $('#saveState').classList.toggle('warn', !ok);
  }, 500);
}

store.addEventListener('change', () => {
  if (!$('#props').hidden && !$('#props').contains(document.activeElement)) renderProps();
  syncUndo();
  scheduleSave();
  if (currentView === 'calc') renderCalc();
  if (currentView === 'elev') renderElev();
});
store.addEventListener('select', () => {
  if (store.selection) openSide('props', !narrow() || document.documentElement.classList.contains('side-open'));
  else if (!$('#props').hidden) renderProps();
});
store.addEventListener('floor', () => { renderFloors(); renderProps(); });
store.addEventListener('load', () => syncProjectUI());
function syncUndo() {
  $('#undoBtn').disabled = !store.undoStack.length;
  $('#redoBtn').disabled = !store.redoStack.length;
}

// ---------- tastatūra ----------
const TOOL_KEYS = Object.fromEntries(Object.entries(TOOLS).filter(([, t]) => t.key).map(([id, t]) => [t.key, id]));
document.addEventListener('keydown', (e) => {
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
    if (e.key === 'Escape') e.target.blur();
    return;
  }
  if ($('dialog[open]')) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); store.redo(); return; }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelection(); return; }
  if (currentView !== 'plan') return;
  if (editor.onKey(e)) { e.preventDefault(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && store.selection) { e.preventDefault(); store.deleteSelected(); return; }
  if (!mod && !e.altKey && TOOL_KEYS[e.key.toLowerCase()]) editor.setTool(TOOL_KEYS[e.key.toLowerCase()]);
  if (e.key === '+' || e.key === '=') editor.zoom(1.2);
  if (e.key === '-') editor.zoom(1 / 1.2);
  if (e.key === '0') editor.fit();
});
document.addEventListener('keyup', (e) => editor.onKeyUp(e));

// ---------- tēma ----------
const media = matchMedia('(prefers-color-scheme: dark)');
function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : media.matches;
}
function themeChanged() {
  editor.refreshTheme();
  view3d?.setTheme(isDark());
  renderCatalog();
}
media.addEventListener('change', themeChanged);
new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
$('#themeBtn').addEventListener('click', () => {
  const root = document.documentElement;
  root.dataset.theme = isDark() ? 'light' : 'dark';
  storage.setPref('theme', root.dataset.theme);
});
const savedTheme = storage.getPref('theme', null);
if (savedTheme && !embedded) document.documentElement.dataset.theme = savedTheme;

// ---------- starts ----------
renderCatalogChips();
renderCatalog();
renderAlbumControls();
syncProjectUI();
syncUndo();
openSide('catalog');
if (narrow()) document.documentElement.classList.remove('side-open');
const startView = location.hash.slice(1);
setView(['plan', '3d', 'elev', 'calc', 'album'].includes(startView) ? startView : 'plan');
$('#saveState').textContent = 'Saglabāts pārlūkā';
window.buvplans = { store, editor, polygonArea };
