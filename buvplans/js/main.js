// Lietotnes savienojums: stadijas, rīkjoslas, īpašības, stāvi un varianti, projekti, eksports.
import { Store, newProject, newFloor, uid, wallLength, wallDir, clampOpening, moveJoint, makeWall, STATUSES, statusLabel, snapshotWalls, followHosts } from './model.js';
import { Editor2D, TOOLS } from './editor2d.js';
import { CATALOG, CATEGORIES, FLOOR_FINISHES, WALL_FINISHES, drawItem2D, byKind } from './catalog.js';
import { keepRoomsInSync } from './rooms.js';
import { roomStats, floorStats, specification, openingSchedule, statsCSV, fmt, wallMaterials } from './calc.js';
import { WALL_MATERIALS, wallMaterial, drawMaterialSwatch, paintMaterial } from './walls.js';
import { roomElevations, elevationSVG } from './elevations.js';
import { buildAlbum, SHEET_TYPES } from './album.js';
import { THEME, floorBounds, wallKind } from './draw2d.js';
import { STAGES, stageById } from './stages.js';
import { sampleProject } from './sample.js';
import * as storage from './storage.js';
import { add, mul } from './geometry.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const root = document.documentElement;
const embedded = (() => { try { return window.self !== window.top; } catch { return true; } })();
root.classList.toggle('embedded', embedded);

// ---------- projekta ielāde ----------
function initialProject() {
  const last = storage.lastProjectId();
  const p = last && storage.loadProject(last);
  if (p) {
    try { return storage.validateProject(p); } catch { /* bojāts — sāk ar paraugu */ }
  }
  const s = storage.validateProject(sampleProject());
  storage.saveProject(s);
  return s;
}
const store = new Store(initialProject());
keepRoomsInSync(store);
storage.setLastProject(store.project.id);

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2800);
}

// ---------- 2D redaktors ----------
const editor = new Editor2D($('#plan'), store, {
  onStatus: (t) => { $('#statusHint').textContent = t; },
  onTool: (tool) => {
    syncToolButtons();
    if (tool === 'wall' || tool === 'rect') editor.status(`${wallTypeLabel()}. ${TOOLS[tool].hint}`);
  },
  onEdit: () => setTimeout(() => $('#props input, #props select')?.focus(), 30),
  onView: (v) => syncZoom(v),
});
Object.assign(editor.settings, storage.getPref('settings', {}));

// ---------- 3D (ielādē slinki, lai 2D strādā arī bez WebGL) ----------
let view3d = null;
async function ensure3D() {
  if (view3d) return view3d;
  try {
    const { View3D } = await import('./view3d.js');
    view3d = new View3D($('#scene'), store);
    view3d.setTheme(false);
  } catch (err) {
    $('#scene').innerHTML = `<p class="empty">3D skatu neizdevās ielādēt: ${esc(err.message)}. Pārbaudi interneta savienojumu un WebGL atbalstu.</p>`;
  }
  return view3d;
}

// ---------- skati ----------
const VIEWS = ['plan', 'elev', '3d', 'calc', 'album'];
let currentView = 'plan';
function setView(v) {
  currentView = v;
  $$('.tb-mode').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === v)));
  $$('.site-nav [data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === (['plan', 'elev', '3d'].includes(v) ? 'plan' : v)));
  $$('.view').forEach((el) => { el.hidden = el.dataset.view !== v; });
  root.dataset.view = v;
  closeFloating();
  $('#settingsPop').hidden = true;
  $('#bgPop').hidden = true;
  if (v === 'plan') editor.resize();
  if (v === '3d') ensure3D().then((x) => x?.show());
  else view3d?.hide();
  if (v === 'calc') renderCalc();
  if (v === 'elev') renderElev();
  if (v === 'album') renderAlbum();
  try { if (location.hash.slice(1) !== v) history.replaceState(null, '', `#${v}`); } catch { /* ignore */ }
}
$$('.tb-mode').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
window.addEventListener('hashchange', () => {
  const v = location.hash.slice(1);
  if (VIEWS.includes(v) && v !== currentView) setView(v);
});
$$('[data-nav]').forEach((b) => b.addEventListener('click', () => {
  const n = b.dataset.nav;
  if (n === 'projects') openProjects();
  else if (n === 'help') $('#helpDialog').showModal();
  else setView(n);
}));
$('#helpClose').addEventListener('click', () => $('#helpDialog').close());
$('#calcBtn').addEventListener('click', () => setView('calc'));
$('#printBtn').addEventListener('click', () => setView('album'));
$('#sheetBtn').addEventListener('click', () => setView('album'));
$('#openBtn').addEventListener('click', () => openProjects());
$('#saveBtn').addEventListener('click', () => exportProject());
$('#shortcutsBtn').addEventListener('click', () => $('#helpDialog').showModal());

// ---------- stadijas ----------
let stage = stageById(storage.getPref('stage', 'base'));
function renderStageTabs() {
  $('#stageTabs').innerHTML = STAGES.map((s) => `<button type="button" role="tab" class="stage-tab" data-stage="${s.id}" aria-selected="${s.id === stage.id}">${s.name}</button>`).join('');
  $$('#stageTabs .stage-tab').forEach((b) => b.addEventListener('click', () => setStage(b.dataset.stage)));
  syncStageScroll();
}
function setStage(id) {
  stage = stageById(id);
  storage.setPref('stage', stage.id);
  $$('#stageTabs .stage-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.stage === stage.id)));
  $(`#stageTabs [data-stage="${stage.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  editor.setStage(stage);
  closeFloating();
  renderLeftbar();
  if (currentView !== 'plan') setView('plan');
  editor.status(stageHint());
}
function stageHint() {
  const first = { base: 'Sāc ar esošajām sienām: rīks „Siena” vai „Telpa” kreisajā joslā.', demolish: 'Klikšķini uz sienām, kuras nojauks — tās kļūs sarkanas.', partitions: 'Zīmē jaunās starpsienas — tās tiek atzīmētas kā jaunas.', rooms: 'Klikšķini telpā, lai mainītu nosaukumu, segumu un griestu augstumu.', wiring: 'Rīks „Vads” savieno sadalni, kārbas, slēdžus un gaismekļus.' }[stage.id];
  return first || 'Izvēlies priekšmetu kreisajā joslā un klikšķini plānā. Pie sienas tas pagriežas pats.';
}
function syncStageScroll() {
  const t = $('#stageTabs');
  $('#stageLeft').disabled = t.scrollLeft <= 2;
  $('#stageRight').disabled = t.scrollLeft + t.clientWidth >= t.scrollWidth - 2;
}
$('#stageTabs').addEventListener('scroll', syncStageScroll);
new ResizeObserver(syncStageScroll).observe($('#stageTabs'));
$('#stageLeft').addEventListener('click', () => $('#stageTabs').scrollBy({ left: -240 }));
$('#stageRight').addEventListener('click', () => $('#stageTabs').scrollBy({ left: 240 }));

// ---------- kreisā rīkjosla ----------
const ICONS = {
  select: '<path d="M6 3l12 7-5.5 1.6L10 17z"/>',
  wall: '<path d="M3 20V5h13v8h5" stroke-width="3.4"/>',
  rect: '<rect x="3.5" y="5" width="17" height="14" stroke-width="2.8"/>',
  door: '<path d="M3 20h4M17 20h4M7 20V6M7 6a14 14 0 0 1 10 14"/>',
  window: '<path d="M2 9h3M19 9h3M2 15h3M19 15h3"/><rect x="5" y="9" width="14" height="6"/><path d="M5 12h14"/>',
  dim: '<path d="M3 8v8M21 8v8M3 12h18M6 14l-2-2 2-2M18 10l2 2-2 2"/>',
  text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  demolish: '<rect x="4" y="9" width="16" height="6"/><path d="M4 9l6 6M9 9l6 6M14 9l6 6" stroke="#ff6b5f"/><path d="M3 3l18 18" stroke="#ff6b5f" stroke-width="2"/>',
  wire: '<path d="M4 18c3 0 3-12 8-12s5 12 8 12" stroke-dasharray="3 2.5"/><circle cx="4" cy="18" r="1.8"/><circle cx="20" cy="18" r="1.8"/>',
};
const TOOL_NAMES = { ...Object.fromEntries(Object.entries(TOOLS).map(([k, v]) => [k, `${v.name}${v.key ? ` (${v.key.toUpperCase()})` : ''}`])) };

function drawThumb(cv, def, mono) {
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  const k = Math.min((cv.width - 8) / def.w, (cv.height - 8) / def.d, 5);
  ctx.save();
  ctx.translate(cv.width / 2, cv.height / 2);
  ctx.scale(k, k);
  ctx.lineWidth = (mono ? 1.6 : 1.2) / k;
  ctx.fillStyle = mono ? 'rgba(255,255,255,0.14)' : def.color;
  ctx.strokeStyle = mono ? '#f2f2f2' : THEME.itemStroke;
  drawItem2D(ctx, def);
  ctx.restore();
}

function renderLeftbar() {
  const st = stage;
  let h = st.tools.map((t) => `<button type="button" class="lb-btn" data-tool="${t}" title="${esc(TOOL_NAMES[t])}" aria-label="${esc(TOOL_NAMES[t])}"><svg viewBox="0 0 24 24">${ICONS[t] || ''}</svg></button>`).join('');
  const defs = CATALOG.filter((c) => st.cats.includes(c.cat));
  if (defs.length) {
    h += '<div class="lb-sep"></div>';
    if (defs.length <= 9) {
      h += defs.map((d) => `<button type="button" class="lb-btn" data-kind="${d.kind}" title="${esc(d.name)} — ${d.w}×${d.d}×${d.h} cm" aria-label="${esc(d.name)}"><canvas width="60" height="52"></canvas></button>`).join('');
    } else {
      h += st.cats.map((cat) => {
        const name = CATEGORIES.find((c) => c.id === cat)?.name || cat;
        const d = CATALOG.find((c) => c.cat === cat);
        return `<button type="button" class="lb-btn more" data-cat="${cat}" data-thumb="${d.kind}" title="${esc(name)}" aria-label="${esc(name)}"><canvas width="60" height="52"></canvas></button>`;
      }).join('');
    }
  }
  h += '<div class="lb-sep"></div><button type="button" class="lb-btn help" data-nav-help title="Palīdzība" aria-label="Palīdzība">?</button>';
  const bar = $('#leftbar');
  bar.innerHTML = h;
  $$('.lb-btn canvas', bar).forEach((cv) => {
    const b = cv.parentElement;
    drawThumb(cv, byKind(b.dataset.kind || b.dataset.thumb), true);
  });
  $$('[data-tool]', bar).forEach((b) => b.addEventListener('click', (e) => {
    if (b.dataset.tool === 'wall') {
      // Siena: vispirms izvēlas sienas veidu un biezumu.
      e.stopPropagation();
      if (!$('#flyout').hidden && $('#flyout').dataset.cat === 'walls') return closeFloating();
      return openWallChooser(b);
    }
    closeFloating();
    editor.setTool(b.dataset.tool);
  }));
  $$('[data-kind]', bar).forEach((b) => b.addEventListener('click', () => {
    closeFloating();
    editor.setTool('place', { kind: b.dataset.kind });
  }));
  $$('[data-cat]', bar).forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!$('#flyout').hidden && $('#flyout').dataset.cat === b.dataset.cat) return closeFloating();
    openFlyout(b.dataset.cat, b);
  }));
  $('[data-nav-help]', bar).addEventListener('click', () => $('#helpDialog').showModal());
  syncToolButtons();
}

function openFlyout(cat, btn) {
  closeFloating();
  const fly = $('#flyout');
  const defs = CATALOG.filter((c) => c.cat === cat);
  fly.dataset.cat = cat;
  fly.innerHTML = `<h3>${esc(CATEGORIES.find((c) => c.id === cat)?.name || cat)}</h3><div class="fly-grid">${defs.map((d) => `<button type="button" class="fly-item" data-kind="${d.kind}" title="${esc(d.name)}"><canvas width="144" height="108"></canvas><span>${esc(d.name)}</span><small>${d.w}×${d.d}×${d.h}</small></button>`).join('')}</div>`;
  $$('.fly-item', fly).forEach((b) => {
    drawThumb($('canvas', b), byKind(b.dataset.kind), false);
    b.addEventListener('click', () => {
      editor.setTool('place', { kind: b.dataset.kind });
      closeFloating();
    });
  });
  fly.hidden = false;
  btn.setAttribute('aria-pressed', 'true');
  const ws = $('.workspace').getBoundingClientRect(), r = btn.getBoundingClientRect();
  fly.style.top = `${Math.max(4, Math.min(r.top - ws.top, ws.height - fly.offsetHeight - 8))}px`;
}

// ---------- sienu veids un biezums ----------
const fmtT = (t) => String(t).replace('.', ',');
const wallKeys = () => (stage?.newWalls ? ['partitionMaterial', 'partitionThickness'] : ['wallMaterial', 'wallThickness']);
function wallTypeLabel() {
  const [mk, tk] = wallKeys();
  return `${wallMaterial(editor.settings[mk])?.name || 'Siena'}, ${fmtT(editor.settings[tk])} cm`;
}

function openWallChooser(btn, matId = null) {
  closeFloating();
  const fly = $('#flyout');
  const [mk, tk] = wallKeys();
  fly.dataset.cat = 'walls';
  if (!matId) {
    fly.innerHTML = `<h3>Sienas veids</h3><div class="wall-list">${WALL_MATERIALS.map((m) => `<button type="button" class="wall-type ${editor.settings[mk] === m.id ? 'active' : ''}" data-mat="${m.id}">
      <canvas width="112" height="44"></canvas><span><b>${esc(m.name)}</b><small>${m.thick.map(fmtT).join(' · ')} cm</small></span></button>`).join('')}</div>`;
    $$('.wall-type', fly).forEach((b) => {
      drawMaterialSwatch($('canvas', b), wallMaterial(b.dataset.mat));
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        openWallChooser(btn, b.dataset.mat);
      });
    });
  } else {
    const m = wallMaterial(matId);
    const cur = editor.settings[mk] === m.id ? editor.settings[tk] : m.def;
    fly.innerHTML = `<h3 class="fly-head"><button type="button" class="fly-back" aria-label="Atpakaļ uz sienu veidiem">‹</button>${esc(m.name)} — biezums</h3>
      <div class="thick-grid">${m.thick.map((t) => `<button type="button" class="thick ${t === cur ? 'active' : ''}" data-t="${t}"><canvas width="120" height="64"></canvas><b>${fmtT(t)} cm</b></button>`).join('')}</div>
      <form class="thick-custom"><label for="thickCustom">Cits biezums</label><input id="thickCustom" type="number" inputmode="decimal" min="2" max="150" step="0.5" value="${cur}"><span>cm</span><button type="submit" class="btn small primary">Zīmēt</button></form>`;
    const choose = (t) => {
      editor.settings[mk] = m.id;
      editor.settings[tk] = t;
      storage.setPref('settings', editor.settings);
      closeFloating();
      editor.setTool('wall');
    };
    $$('.thick', fly).forEach((b) => {
      const t = parseFloat(b.dataset.t), cv = $('canvas', b), g = cv.getContext('2d');
      // Josla, kuras biezums atbilst sienas biezumam (mērogā pret lielāko piedāvāto).
      const h = Math.max(6, Math.round((t / Math.max(...m.thick)) * 52));
      const tile = document.createElement('canvas');
      tile.width = tile.height = 12;
      paintMaterial(tile.getContext('2d'), m, 12);
      g.fillStyle = g.createPattern(tile, 'repeat');
      g.fillRect(4, (64 - h) / 2, 112, h);
      g.strokeStyle = '#2b2b2b';
      g.lineWidth = 2;
      g.strokeRect(4, (64 - h) / 2, 112, h);
      b.addEventListener('click', () => choose(t));
    });
    $('.fly-back', fly).addEventListener('click', (e) => {
      e.stopPropagation();
      openWallChooser(btn);
    });
    $('.thick-custom', fly).addEventListener('submit', (e) => {
      e.preventDefault();
      const t = parseFloat($('#thickCustom').value);
      if (t >= 2 && t <= 150) choose(Math.round(t * 10) / 10);
      else toast('Biezumam jābūt no 2 līdz 150 cm.');
    });
  }
  fly.hidden = false;
  btn.setAttribute('aria-pressed', 'true');
  const ws = $('.workspace').getBoundingClientRect(), r = btn.getBoundingClientRect();
  fly.style.top = `${Math.max(4, Math.min(r.top - ws.top, ws.height - fly.offsetHeight - 8))}px`;
}

function syncToolButtons() {
  const kind = editor.tool === 'place' ? editor.state.kind : null;
  $$('#leftbar [data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === editor.tool)));
  $$('#leftbar [data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
  $$('#leftbar [data-cat]').forEach((b) => b.setAttribute('aria-pressed', String(!!kind && byKind(kind)?.cat === b.dataset.cat)));
  $$('[data-tool-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.toolBtn === editor.tool)));
}

// ---------- peldošie paneļi ----------
function closeFloating() {
  $('#flyout').hidden = true;
  $$('.dd-menu').forEach((m) => { m.hidden = true; });
  $('#tipPop').hidden = true;
  syncToolButtons();
}
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#flyout, #leftbar, .dd, #tipPop, .help-link')) closeFloating();
  if (!e.target.closest('#settingsPop, #settingsBtn, .dd-menu, #confirmPop')) $('#settingsPop').hidden = true;
  if (!e.target.closest('#bgPop, #bgBtn')) $('#bgPop').hidden = true;
});

const TIPS = {
  move: 'Velc tukšā vietā ar peli (rīkā „Atlasīt”) vai turi atstarpi un velc. Peles ritenītis tuvina un attālina, bultiņas apakšā labajā stūrī bīda plānu, taustiņš 0 parāda visu.',
  height: 'Visam stāvam: zobrats apakšā → „Griestu augstums”. Vienai telpai: stadijā „Telpas” klikšķini telpā un maini „Griestu augstums” — sarkanajā birkā H mainīsies uzreiz.',
};
$$('[data-tip]').forEach((b) => b.addEventListener('click', () => {
  const pop = $('#tipPop');
  const same = !pop.hidden && pop.dataset.tip === b.dataset.tip;
  closeFloating();
  if (same) return;
  pop.dataset.tip = b.dataset.tip;
  pop.innerHTML = `<p>${TIPS[b.dataset.tip]}</p>`;
  pop.hidden = false;
}));

// ---------- īpašību panelis ----------
const num = (label, key, value, opts = {}) => `<label class="field"><span>${label}</span><input type="number" inputmode="decimal" data-k="${key}" value="${Math.round(value * 10) / 10}" step="${opts.step || 1}" ${opts.min !== undefined ? `min="${opts.min}"` : ''}><em>${opts.unit ?? 'cm'}</em></label>`;
const txt = (label, key, value) => `<label class="field wide"><span>${label}</span><input type="text" data-k="${key}" value="${esc(value)}"></label>`;
const sel = (label, key, value, options) => `<label class="field wide"><span>${label}</span><select data-k="${key}">${options.map(([v, n]) => `<option value="${v}" ${v === value ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
const chk = (label, key, value) => `<label class="check"><input type="checkbox" data-k="${key}" ${value ? 'checked' : ''}><span>${label}</span></label>`;
const btn = (label, act, cls = '') => `<button type="button" class="btn small ${cls}" data-act="${act}">${label}</button>`;
const stat = (label, value) => `<div class="stat"><dt>${label}</dt><dd>${value}</dd></div>`;
const panelHead = (title, closeId) => `<div class="props-head"><h3>${title}</h3><button type="button" class="icon-btn" data-close="${closeId}" aria-label="Aizvērt"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`;

const KIND_NAMES = { walls: 'Siena', openings: 'Aile', items: 'Priekšmets', rooms: 'Telpa', labels: 'Uzraksts', dims: 'Izmēra līnija', wires: 'Vads' };
const WIRE_COLORS = [['#d93025', 'Spēka līnija (sarkans)'], ['#2f6fd6', 'Apgaismojums (zils)'], ['#2e9b3f', 'Vājstrāva (zaļš)'], ['#7a4bc2', 'Cits (violets)']];

function renderProps() {
  const el = $('#props');
  const s = store.selection, obj = store.selected(), f = store.floor;
  if (!obj) {
    el.hidden = true;
    return;
  }
  let h = '';
  if (s.kind === 'walls') {
    const mat = wallMaterial(obj.material);
    h += `<div class="fields">${sel('Materiāls', 'material', obj.material || '', [['', '— nav norādīts —'], ...WALL_MATERIALS.map((x) => [x.id, x.name])])}
      ${num('Garums (ass)', 'len', wallLength(obj), { min: 1 })}<label class="field"><span>Biezums</span><input type="number" inputmode="decimal" data-k="thickness" value="${obj.thickness}" min="2" step="0.5" list="thickList"><em>cm</em></label>
      <datalist id="thickList">${(mat?.thick || []).map((t) => `<option value="${t}"></option>`).join('')}</datalist>${num('Augstums', 'height', obj.height, { min: 10 })}
      ${sel('Nesošā / starpsiena', 'kind', wallKind(obj), [['bearing', 'Nesošā / ārsiena'], ['partition', 'Starpsiena']])}
      ${sel('Statuss', 'status', obj.status || 'existing', [['existing', 'Esoša'], ['demolish', 'Nojaucama'], ['new', 'Jauna']])}</div>
      <div class="row">${btn('Sadalīt uz pusēm', 'split')}${btn('Dzēst', 'delete', 'danger')}</div><p class="hint">Velc apļus sienas galos, lai mainītu stūrus; savienotās sienas un telpas sekos līdzi.</p>`;
  } else if (s.kind === 'openings') {
    h += `<div class="fields">${sel('Veids', 'type', obj.type, [['door', 'Durvis'], ['window', 'Logs']])}${num('Platums', 'width', obj.width, { min: 20 })}${num('Augstums', 'height', obj.height, { min: 20 })}
      ${num(obj.type === 'door' ? 'Slieksnis' : 'Palodzes augstums', 'sill', obj.sill, { min: 0 })}${num('No sienas sākuma', 'offset', obj.pos - obj.width / 2, { min: 0 })}</div>
      <div class="row">${obj.type === 'door' ? btn('Eņģu puse', 'hinge') : ''}${btn(obj.type === 'door' ? 'Virināšanas puse' : 'Palodzes puse', 'swing')}${btn('Dzēst', 'delete', 'danger')}</div>`;
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
      <dl class="stats">${stat('Laukums', `${fmt(r.area)} m²`)}${stat('Perimetrs', `${fmt(r.perimeter)} m`)}${stat('Sienas bez ailēm', `${fmt(r.wallNet)} m²`)}${stat('Tilpums', `${fmt(r.volume)} m³`)}${stat('Grīdlīste', `${fmt(r.baseboard)} m`)}${stat('Rozetes / slēdži / gaism.', `${r.sockets} / ${r.switches} / ${r.lights}`)}</dl>
      <p class="hint">Grīdas forma izriet no sienām: pārvietojot, pagarinot vai dzēšot sienu, grīda mainās līdzi.</p>
      <div class="row">${btn('Sienu skati', 'elev')}</div>`;
  } else if (s.kind === 'labels') {
    h += `<div class="fields">${txt('Teksts', 'text', obj.text)}${num('Burtu izmērs', 'size', obj.size || 14, { unit: 'px', min: 8 })}</div><div class="row">${btn('Dzēst', 'delete', 'danger')}</div>`;
  } else if (s.kind === 'dims') {
    h += `<div class="fields">${num('Atkāpe', 'offset', obj.offset || 0)}</div><dl class="stats">${stat('Garums', `${Math.round(Math.hypot(obj.b.x - obj.a.x, obj.b.y - obj.a.y))} cm`)}</dl><div class="row">${btn('Dzēst', 'delete', 'danger')}</div>`;
  } else if (s.kind === 'wires') {
    const L = obj.points.reduce((q, p, i) => (i ? q + Math.hypot(p.x - obj.points[i - 1].x, p.y - obj.points[i - 1].y) : 0), 0);
    h += `<div class="fields">${sel('Līnija', 'color', obj.color, WIRE_COLORS)}</div><dl class="stats">${stat('Garums plānā', `${fmt(L / 100)} m`)}${stat('Lūzuma punkti', obj.points.length)}</dl><div class="row">${btn('Dzēst', 'delete', 'danger')}</div>`;
  }
  el.innerHTML = panelHead(KIND_NAMES[s.kind], 'props') + `<div class="props-body">${h}</div>`;
  el.hidden = false;
  bindFields(el, (k, v) => {
    store.commit(() => applyProp(f, s.kind, obj, k, v));
    if ((s.kind === 'openings' && k === 'type') || k === 'material') renderProps();
  });
  $$('[data-act]', el).forEach((b) => b.addEventListener('click', () => propAction(b.dataset.act, obj)));
}

function bindFields(el, onChange) {
  $$('[data-k]', el).forEach((input) => {
    input.addEventListener(input.type === 'range' ? 'input' : 'change', () => {
      const v = input.type === 'checkbox' ? input.checked : input.type === 'number' || input.type === 'range' ? parseFloat(input.value) : input.value;
      if ((input.type === 'number' || input.type === 'range') && !Number.isFinite(v)) return;
      onChange(input.dataset.k, v);
    });
  });
  $$('[data-close]', el).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.close === 'props') store.select(null);
    else $(`#${b.dataset.close}`).hidden = true;
  }));
}

function applyProp(f, kind, obj, k, v) {
  if (kind === 'walls' && k === 'len') {
    const before = snapshotWalls(f);
    moveJoint(f, { ...obj.b }, add(obj.a, mul(wallDir(obj), Math.max(1, v))));
    followHosts(f, before);
    return;
  }
  if (kind === 'walls' && k === 'material') {
    obj.material = v || undefined;
    if (wallMaterial(v)?.partition) obj.kind = 'partition';
    return;
  }
  if (kind === 'openings') {
    const w = f.walls.find((x) => x.id === obj.wallId);
    if (k === 'offset') obj.pos = v + obj.width / 2;
    else if (k === 'type') Object.assign(obj, { type: v }, v === 'door' ? { sill: 0, height: 210, width: 90 } : { sill: 85, height: 140, width: 140 });
    else obj[k] = v;
    if (w) clampOpening(obj, w);
    return;
  }
  obj[k] = k === 'rot' ? ((v % 360) + 360) % 360 : v;
}

function propAction(act, obj) {
  switch (act) {
    case 'delete': store.deleteSelected(); break;
    case 'split': store.commit((fl) => {
      const L = wallLength(obj), mid = add(obj.a, mul(wallDir(obj), L / 2));
      const w2 = { ...makeWall(mid, obj.b, obj.thickness, obj.height), kind: obj.kind, status: obj.status };
      for (const o of fl.openings) if (o.wallId === obj.id && o.pos > L / 2) { o.wallId = w2.id; o.pos -= L / 2; }
      obj.b = mid;
      fl.walls.push(w2);
    }); break;
    case 'hinge': store.commit(() => { obj.hinge = !obj.hinge; }); break;
    case 'swing': store.commit(() => { obj.swing = !obj.swing; }); break;
    case 'rotate': store.commit(() => { obj.rot = ((obj.rot || 0) + 90) % 360; }); break;
    case 'duplicate': duplicateSelection(); break;
    case 'elev': elevRoomId = obj.id; setView('elev'); break;
  }
}

function duplicateSelection() {
  const s = store.selection, obj = store.selected();
  if (!obj || !['items', 'labels'].includes(s.kind)) return;
  const copy = { ...JSON.parse(JSON.stringify(obj)), id: uid(), x: obj.x + 20, y: obj.y + 20 };
  store.commit((f) => f[s.kind].push(copy));
  store.select({ kind: s.kind, id: copy.id });
}

// ---------- iestatījumi (zobrats) ----------
function renderSettings() {
  const f = store.floor, p = store.project, st = editor.settings;
  const el = $('#settingsPop');
  el.innerHTML = panelHead('Iestatījumi', 'settingsPop') + `<div class="props-body">
    <h4>Zīmēšana</h4><div class="fields">${num('Ārsienas biezums', 's.wallThickness', st.wallThickness, { min: 5 })}${num('Starpsienas biezums', 's.partitionThickness', st.partitionThickness, { min: 5 })}
    ${chk('Piesaiste režģim un 15° leņķiem', 's.snap', st.snap)}</div>
    <h4>Stāvs</h4><div class="fields">${txt('Nosaukums', 'f.name', f.name)}${num('Griestu augstums', 'f.height', f.height, { min: 150 })}${num('Līmenis no ±0,00', 'f.elevation', f.elevation)}</div>
    <div class="row">${btn('Visām sienām šo augstumu', 'applyHeight')}</div>
    <h4>Projekts</h4><div class="fields">${txt('Autors (albuma zīmogā)', 'p.author', p.author)}${txt('Adrese', 'p.address', p.address)}
    ${sel('Statuss', 'p.status', p.status, STATUSES)}${txt('Mape', 'p.folder', p.folder)}</div></div>`;
  bindFields(el, (k, v) => {
    if (k.startsWith('s.')) {
      editor.settings[k.slice(2)] = v;
      storage.setPref('settings', editor.settings);
      editor.requestRender();
    } else if (k.startsWith('f.')) {
      store.commit((fl) => {
        // Nosaukums un līmenis ir kopīgi visiem šī stāva variantiem; augstums — tikai šim variantam.
        for (const x of groupFloors()) if (k !== 'f.height' || x.id === fl.id) x[k.slice(2)] = v;
      });
    } else if (k.startsWith('p.')) store.commit((fl, pr) => { pr[k.slice(2)] = v; });
  });
  $('[data-act="applyHeight"]', el).addEventListener('click', () => {
    store.commit((fl) => fl.walls.forEach((w) => { w.height = fl.height; }));
    toast('Sienu augstums atjaunināts');
  });
}
$('#settingsBtn').addEventListener('click', () => {
  const el = $('#settingsPop');
  if (!el.hidden) {
    el.hidden = true;
    return;
  }
  renderSettings();
  el.hidden = false;
});

// ---------- fona attēls ----------
function renderBg() {
  const bg = store.floor.background, el = $('#bgPop');
  el.innerHTML = panelHead('Zīmēt plānu no attēla', 'bgPop') + `<div class="props-body">
    <p class="hint">Augšupielādē esoša plāna attēlu vai foto, norādi tā platumu dabā un pārzīmē sienas pa virsu.</p>
    ${bg ? `<div class="fields">${num('Attēla platums dabā', 'widthCm', bg.widthCm, { min: 10 })}${num('Nobīde X', 'x', bg.x || 0)}${num('Nobīde Y', 'y', bg.y || 0)}
      <label class="field wide"><span>Caurspīdīgums</span><input type="range" min="0.05" max="1" step="0.05" data-k="opacity" value="${bg.opacity ?? 0.5}"></label>${chk('Rādīt attēlu', 'visible', bg.visible !== false)}</div>
      <div class="row">${btn('Aizstāt attēlu', 'upload')}${btn('Noņemt', 'remove', 'danger')}</div>` : `<div class="row">${btn('Augšupielādēt attēlu', 'upload')}</div>`}</div>`;
  bindFields(el, (k, v) => store.commit((fl) => { fl.background[k] = v; }));
  $$('[data-act]', el).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.act === 'upload') $('#fileBg').click();
    else {
      store.commit((fl) => { fl.background = null; });
      renderBg();
    }
  }));
}
$('#bgBtn').addEventListener('click', () => {
  const el = $('#bgPop');
  if (!el.hidden) {
    el.hidden = true;
    return;
  }
  if (currentView !== 'plan') setView('plan');
  renderBg();
  el.hidden = false;
});
$('#fileBg').addEventListener('change', (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) return toast('Attēls ir lielāks par 4 MB — samazini to, lai projekts ietilptu pārlūka krātuvē.');
  const r = new FileReader();
  r.onload = () => {
    store.commit((f) => { f.background = { src: r.result, widthCm: 1000, x: 0, y: 0, opacity: 0.5, visible: true }; });
    renderBg();
    $('#bgPop').hidden = false;
    toast('Attēls pievienots. Norādi tā platumu dabā, lai mērogs sakristu.');
  };
  r.readAsDataURL(file);
});

// ---------- stāvi un varianti ----------
const groupOf = (f) => f.group || f.id;
const groupFloors = (g = groupOf(store.floor)) => store.project.floors.filter((f) => groupOf(f) === g);
function groups() {
  const seen = new Map();
  for (const f of store.project.floors) if (!seen.has(groupOf(f))) seen.set(groupOf(f), groupFloors(groupOf(f)));
  return [...seen.values()];
}
const baseOf = (list) => list.find((f) => !f.variant) || list[0];
function renderFloorMenus() {
  const cur = store.floor, gs = groups(), layouts = groupFloors();
  $('#floorBtn').textContent = baseOf(layouts).name;
  $('#layoutBtn').textContent = `${layouts.indexOf(cur) + 1}. variants`;
  $('#floorMenu').innerHTML = gs.map((list) => `<button type="button" role="menuitem" data-floor="${baseOf(list).id}" class="${list.includes(cur) ? 'current' : ''}">${esc(baseOf(list).name)}</button>`).join('')
    + `<hr><button type="button" role="menuitem" data-fact="add">+ Pievienot stāvu</button><button type="button" role="menuitem" data-fact="settings">Stāva iestatījumi…</button><button type="button" role="menuitem" class="danger" data-fact="del" ${gs.length < 2 ? 'disabled' : ''}>Dzēst stāvu</button>`;
  $('#layoutMenu').innerHTML = layouts.map((f, i) => `<button type="button" role="menuitem" data-floor="${f.id}" class="${f === cur ? 'current' : ''}">${i + 1}. variants</button>`).join('')
    + `<hr><button type="button" role="menuitem" data-fact="variant">+ Jauns variants (kopija)</button><button type="button" role="menuitem" class="danger" data-fact="delVariant" ${layouts.length < 2 ? 'disabled' : ''}>Dzēst šo variantu</button>`;
  $$('.dd-menu [data-floor]').forEach((b) => b.addEventListener('click', () => {
    closeFloating();
    store.setFloor(b.dataset.floor);
    editor.fit();
  }));
  $$('.dd-menu [data-fact]').forEach((b) => b.addEventListener('click', () => {
    closeFloating();
    floorAction(b.dataset.fact);
  }));
}
for (const [btnId, menuId] of [['#floorBtn', '#floorMenu'], ['#layoutBtn', '#layoutMenu']]) {
  $(btnId).addEventListener('click', () => {
    const m = $(menuId), open = m.hidden;
    closeFloating();
    m.hidden = !open;
  });
}
function floorAction(act) {
  const p = store.project, cur = store.floor;
  if (act === 'add') {
    const top = p.floors.filter((f) => !f.variant).reduce((m, f) => Math.max(m, f.elevation + f.height), 0);
    const f = newFloor(`${groups().length + 1}. stāvs`, top + 30, cur.height);
    f.walls = cur.walls.filter((w) => w.status !== 'demolish' && wallKind(w) === 'bearing').map((w) => ({ ...JSON.parse(JSON.stringify(w)), id: uid(), status: 'existing' }));
    store.commit((_, pr) => pr.floors.push(f));
    store.setFloor(f.id);
    store.touch();
    editor.fit();
    toast(`${f.name} pievienots ar nesošajām sienām no iepriekšējā stāva`);
  } else if (act === 'settings') {
    renderSettings();
    $('#settingsPop').hidden = false;
  } else if (act === 'del') {
    confirmInline($('#floorBtn'), `Dzēst „${baseOf(groupFloors()).name}” ar visiem variantiem?`, () => {
      const g = groupOf(cur);
      store.commit((_, pr) => { pr.floors = pr.floors.filter((f) => groupOf(f) !== g); });
      store.setFloor(store.project.floors[0].id);
      editor.fit();
    });
  } else if (act === 'variant') {
    const copy = { ...JSON.parse(JSON.stringify(cur)), id: uid(), variant: true, group: groupOf(cur) };
    store.commit((_, pr) => pr.floors.push(copy));
    store.setFloor(copy.id);
    toast('Izveidots plānojuma variants — maini to, pārējie varianti paliek neskarti');
  } else if (act === 'delVariant') {
    confirmInline($('#layoutBtn'), 'Dzēst šo plānojuma variantu?', () => {
      const id = cur.id, g = groupOf(cur);
      store.commit((_, pr) => {
        pr.floors = pr.floors.filter((f) => f.id !== id);
        const rest = pr.floors.filter((f) => groupOf(f) === g);
        if (rest.length && rest.every((f) => f.variant)) rest[0].variant = false;
      });
      store.setFloor(groupFloors(g)[0].id);
    });
  }
}

/** Apstiprinājums lapas iekšienē (pārlūka confirm() iegultā skatā nedarbojas). */
function confirmInline(anchor, question, onYes) {
  const pop = $('#confirmPop');
  $('#confirmText').textContent = question;
  pop.hidden = false;
  const r = anchor.getBoundingClientRect();
  pop.style.left = `${Math.max(8, Math.min(window.innerWidth - 260, r.left))}px`;
  const below = r.bottom + 6, above = r.top - pop.offsetHeight - 6;
  pop.style.top = `${above > 8 ? above : Math.min(below, window.innerHeight - pop.offsetHeight - 8)}px`;
  const close = () => { pop.hidden = true; };
  $('#confirmYes').onclick = () => { close(); onYes(); };
  $('#confirmNo').onclick = close;
  $('#confirmYes').focus();
}

// ---------- apakšējā josla ----------
$('#unitsSel').addEventListener('change', (e) => {
  editor.settings.units = e.target.value;
  storage.setPref('settings', editor.settings);
  editor.requestRender();
  if (currentView === 'elev') renderElev();
});
$('#undoBtn').addEventListener('click', () => store.undo());
$('#redoBtn').addEventListener('click', () => store.redo());
$('#deleteBtn').addEventListener('click', () => store.deleteSelected());
$$('.bb-toggle').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.setting;
  editor.settings[k] = !editor.settings[k];
  storage.setPref('settings', editor.settings);
  syncToggles();
  editor.requestRender();
}));
function syncToggles() {
  $$('.bb-toggle').forEach((b) => b.setAttribute('aria-pressed', String(!!editor.settings[b.dataset.setting])));
  root.classList.toggle('hints-off', !editor.settings.hints);
  $('#unitsSel').value = editor.settings.units;
}
$$('[data-tool-btn]').forEach((b) => b.addEventListener('click', () => {
  if (currentView !== 'plan') setView('plan');
  editor.setTool(editor.tool === b.dataset.toolBtn ? 'select' : b.dataset.toolBtn);
}));
$('#fitBtn').addEventListener('click', () => {
  if (currentView !== 'plan') setView('plan');
  editor.fit();
});
$('#rotateBtn').addEventListener('click', () => {
  const b = floorBounds(store.floor);
  if (!b) return;
  const c = { x: Math.round(b.minX + b.w / 2), y: Math.round(b.minY + b.h / 2) };
  const R = (p) => ({ x: c.x - (p.y - c.y), y: c.y + (p.x - c.x) });
  store.commit((f) => {
    for (const w of f.walls) { w.a = R(w.a); w.b = R(w.b); }
    for (const r of f.rooms) r.points = r.points.map(R);
    for (const it of f.items) Object.assign(it, R(it), { rot: ((it.rot || 0) + 90) % 360 });
    for (const d of f.dims) { d.a = R(d.a); d.b = R(d.b); }
    for (const l of f.labels) Object.assign(l, R(l));
    for (const wr of f.wires || []) wr.points = wr.points.map(R);
  });
  editor.fit();
});
$('#clearBtn').addEventListener('click', () => confirmInline($('#clearBtn'), `Notīrīt visu „${store.floor.name}” plānu?`, () => {
  store.commit((f) => { for (const k of ['walls', 'openings', 'rooms', 'items', 'dims', 'labels', 'wires']) f[k] = []; });
  store.select(null);
  toast('Stāvs notīrīts. Atsaukt var ar Ctrl+Z.');
}));

// Tālummaiņas slīdnis (logaritmisks) un bīdīšanas bultiņas
function syncZoom(v) {
  const ZMIN = Math.log(0.04), ZMAX = Math.log(8);
  const s = $('#zoomSlider');
  if (document.activeElement !== s) s.value = String(Math.round(((Math.log(v.scale) - ZMIN) / (ZMAX - ZMIN)) * 100));
}
$('#zoomSlider').addEventListener('input', (e) => {
  const target = Math.exp(Math.log(0.04) + (e.target.value / 100) * (Math.log(8) - Math.log(0.04)));
  editor.zoom(target / editor.view.scale);
});
$('#zoomIn').addEventListener('click', () => editor.zoom(1.25));
$('#zoomOut').addEventListener('click', () => editor.zoom(0.8));
$$('[data-pan]').forEach((b) => b.addEventListener('click', () => {
  const d = { up: [0, 120], down: [0, -120], left: [120, 0], right: [-120, 0] }[b.dataset.pan];
  editor.view.ox += d[0];
  editor.view.oy += d[1];
  editor.requestRender();
}));

// ---------- aprēķini ----------
function renderCalc() {
  const p = store.project;
  const all = p.floors.map((f) => ({ f, st: floorStats(f) }));
  const main = all.filter((x) => !x.f.variant);
  const sum = (k) => main.reduce((s, x) => s + x.st.totals[k], 0);
  let h = `<div class="tiles">
    <div class="tile"><span>Kopējā platība</span><b>${fmt(sum('area'))}<small> m²</small></b></div>
    <div class="tile"><span>Telpas</span><b>${main.reduce((s, x) => s + x.st.rooms.length, 0)}</b></div>
    <div class="tile"><span>Krāsojamās sienas</span><b>${fmt(sum('wallNet'))}<small> m²</small></b></div>
    <div class="tile"><span>Grīdlīste</span><b>${fmt(sum('baseboard'))}<small> m</small></b></div>
    <div class="tile"><span>Demontāža</span><b>${fmt(sum('demolishVolume'))}<small> m³</small></b></div>
    <div class="tile"><span>Jaunās starpsienas</span><b>${fmt(sum('newArea'))}<small> m²</small></b></div>
    <div class="tile"><span>Elektrības vadi</span><b>${fmt(sum('wireLength'))}<small> m</small></b></div>
    <div class="tile"><span>Rozetes / slēdži / gaism.</span><b>${sum('sockets')} / ${sum('switches')} / ${sum('lights')}</b></div>
  </div>
  <div class="row calc-actions">${btn('Kopēt kā CSV', 'csvCopy')}<button type="button" class="btn small embed-hide" data-act="csvSave">Lejupielādēt CSV</button></div>`;
  for (const { f, st } of all) {
    const t = st.totals;
    const rows = st.rooms.map((r) => `<tr><td>${esc(r.name)}</td><td class="n">${fmt(r.area)}</td><td class="n">${fmt(r.perimeter)}</td><td class="n">${fmt(r.height)}</td><td class="n">${fmt(r.volume)}</td><td class="n">${fmt(r.wallNet)}</td><td class="n">${fmt(r.ceiling)}</td><td class="n">${fmt(r.baseboard)}</td><td class="n">${fmt(r.windowSills)}</td><td class="n">${r.doors}/${r.windows}</td><td class="n">${r.sockets}/${r.switches}/${r.lights}</td><td>${esc(r.floorFinish)}</td><td>${esc(r.wallFinish)}</td></tr>`).join('');
    const spec = specification(f).map((s) => `<tr><td>${esc(s.name)}</td><td class="n">${s.w}×${s.d}×${s.h}</td><td class="n">${s.count}</td></tr>`).join('');
    const ops = openingSchedule(f).map((o) => `<tr><td>${o.type}</td><td class="n">${o.width}×${o.height}</td><td class="n">${o.sill}</td></tr>`).join('');
    const layouts = groupFloors(groupOf(f));
    const label = `${esc(f.name)}${layouts.length > 1 ? ` · ${layouts.indexOf(f) + 1}. variants` : ''}`;
    h += `<section class="calc-floor"><h2>${label}${f.variant ? ' <span class="pill">variants</span>' : ''}</h2>
      <div class="table-wrap"><table class="data"><thead><tr><th>Telpa</th><th class="n">Laukums m²</th><th class="n">Perimetrs m</th><th class="n">H m</th><th class="n">Tilpums m³</th><th class="n">Sienas m²</th><th class="n">Griesti m²</th><th class="n">Grīdlīste m</th><th class="n">Palodzes m</th><th class="n">Durvis/logi</th><th class="n">Roz./slēdži/gaism.</th><th>Grīda</th><th>Sienas</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="13" class="empty">Šajā stāvā vēl nav telpu. Uzzīmē sienas vai velc taisnstūri ar rīku „Telpa”.</td></tr>'}</tbody>
      <tfoot><tr><td>Kopā</td><td class="n">${fmt(t.area)}</td><td></td><td></td><td class="n">${fmt(t.volume)}</td><td class="n">${fmt(t.wallNet)}</td><td class="n">${fmt(t.ceiling)}</td><td class="n">${fmt(t.baseboard)}</td><td></td><td class="n">${t.doors}/${t.windows}</td><td class="n">${t.sockets}/${t.switches}/${t.lights}</td><td></td><td></td></tr></tfoot></table></div>
      ${materialsTable(f)}
      <div class="calc-cols"><div class="table-wrap"><h3>Mēbeles un iekārtas</h3><table class="data"><thead><tr><th>Nosaukums</th><th class="n">Izmēri cm</th><th class="n">Skaits</th></tr></thead><tbody>${spec || '<tr><td colspan="3" class="empty">Nav priekšmetu</td></tr>'}</tbody></table></div>
      <div class="table-wrap"><h3>Ailes</h3><table class="data"><thead><tr><th>Veids</th><th class="n">P×A cm</th><th class="n">Palodze cm</th></tr></thead><tbody>${ops || '<tr><td colspan="3" class="empty">Nav aiļu</td></tr>'}</tbody></table>
      <dl class="stats">${stat('Sienu garums (pēc remonta)', `${fmt(t.wallLength)} m`)}${stat('Mūra apjoms', `${fmt(t.wallVolume)} m³`)}${stat('Nojaucamās sienas', `${fmt(t.demolishLength)} m · ${fmt(t.demolishVolume)} m³`)}${stat('Jaunās starpsienas', `${fmt(t.newLength)} m · ${fmt(t.newArea)} m²`)}${stat('Elektrības vadi plānā', `${fmt(t.wireLength)} m`)}${stat('TV / datortīkla rozetes', t.weak)}${stat('Ūdens un kanalizācijas izvadi', t.water)}</dl></div></div></section>`;
  }
  const el = $('#calcBody');
  el.innerHTML = h;
  $$('[data-act]', el).forEach((b) => b.addEventListener('click', () => {
    const csv = statsCSV(store.project);
    if (b.dataset.act === 'csvSave') download(`${store.project.name}.csv`, new Blob(['﻿' + csv], { type: 'text/csv' }));
    else copyText(csv, 'Tabula nokopēta — ielīmē to izklājlapā');
  }));
}

function materialsTable(f) {
  const rows = wallMaterials(f).map((r) => `<tr><td>${esc(r.name)}</td><td class="n">${fmtT(r.thickness)}</td><td class="n">${fmt(r.length)}</td><td class="n">${fmt(r.area)}</td><td class="n">${fmt(r.volume, 3)}</td><td class="n">${r.units ? `~${r.units.toLocaleString('lv-LV')}` : '–'}</td></tr>`).join('');
  if (!rows) return '';
  return `<div class="table-wrap calc-mat"><h3>Sienu materiāli</h3><table class="data"><thead><tr><th>Materiāls</th><th class="n">Biezums cm</th><th class="n">Garums m</th><th class="n">Laukums bez ailēm m²</th><th class="n">Apjoms m³</th><th class="n">Bloki / ķieģeļi gab.</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="hint">Bloku skaits ir aptuvens — pēc bloka skata izmēra ar šuvi, bez rezerves griezumiem.</p></div>`;
}

// ---------- sienu skati ----------
let elevRoomId = null;
function renderElev() {
  const f = store.floor, el = $('#elevBody');
  if (!f.rooms.length) {
    el.innerHTML = '<p class="empty">Sienu skati veidojas no telpām. Šajā stāvā telpu vēl nav.</p>';
    return;
  }
  if (!f.rooms.some((r) => r.id === elevRoomId)) elevRoomId = f.rooms[0].id;
  const room = f.rooms.find((r) => r.id === elevRoomId);
  const els = roomElevations(f, room);
  el.innerHTML = `<div class="chips" role="tablist">${f.rooms.map((r) => `<button type="button" class="chip" data-room="${r.id}" aria-pressed="${r.id === elevRoomId}">${esc(r.name)}</button>`).join('')}</div>
    <p class="hint">Katra siena attēlota, stāvot telpā un skatoties pret to. Elektrības un ūdens punktiem norādīts augstums no grīdas.</p>
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
  const v3 = albumSheets.has('visual') ? await ensure3D() : null;
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
  wrap.style.setProperty('--sheet-k', Math.min(1, wrap.clientWidth / 1123));
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
  $('#exportTitle').textContent = 'Attēls';
  $('#exportBody').innerHTML = `<p class="hint">Šajā skatā lejupielāde nav atļauta — ar peles labo pogu (vai ilgi turot) saglabā attēlu.</p><img src="${dataUrl}" alt="${esc(name)}" class="export-img">`;
  $('#exportDialog').showModal();
}
async function copyText(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  } catch {
    $('#exportTitle').textContent = 'Kopē tekstu';
    $('#exportBody').innerHTML = '<p class="hint">Atlasi tekstu un nokopē to (Ctrl+C).</p><textarea class="export-text" readonly></textarea>';
    $('#exportBody textarea').value = text;
    $('#exportDialog').showModal();
    $('#exportBody textarea').select();
  }
}
function exportProject() {
  const json = JSON.stringify(store.project, null, 1);
  if (embedded) copyText(json, 'Projekts saglabāts pārlūkā; JSON nokopēts starpliktuvē');
  else {
    download(`${store.project.name}.buvplans.json`, new Blob([json], { type: 'application/json' }));
    toast('Projekts saglabāts failā');
  }
}
$('#exportClose').addEventListener('click', () => $('#exportDialog').close());

// ---------- projekti ----------
function openProjects() {
  renderProjects();
  $('#projectsDialog').showModal();
}
function renderProjects() {
  const list = storage.listProjects();
  const folders = [...new Set(list.map((p) => p.folder).filter(Boolean))].sort();
  const grouped = [['', list.filter((p) => !p.folder)], ...folders.map((f) => [f, list.filter((p) => p.folder === f)])];
  $('#projectList').innerHTML = grouped.filter(([, items]) => items.length).map(([folder, items]) => `
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
    Object.assign(p, { id: uid(), name: `${p.name} (kopija)`, updated: new Date().toISOString() });
    storage.saveProject(p);
    renderProjects();
  }));
  $$('[data-del]').forEach((b) => b.addEventListener('click', () => confirmInline(b, 'Dzēst projektu neatgriezeniski?', () => {
    storage.deleteProject(b.dataset.del);
    if (b.dataset.del === store.project.id) {
      const next = storage.listProjects()[0];
      loadIntoEditor(next ? storage.loadProject(next.id) : newProject());
    }
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
$('#projectsClose').addEventListener('click', () => $('#projectsDialog').close());
$('#newProject').addEventListener('click', () => {
  loadIntoEditor(newProject(`Projekts ${storage.listProjects().length + 1}`));
  $('#projectsDialog').close();
  setStage('base');
  editor.setTool('rect');
  toast('Jauns projekts. Velc taisnstūri, lai uzzīmētu pirmo telpu.');
});
$('#sampleProject').addEventListener('click', () => {
  loadIntoEditor(sampleProject());
  $('#projectsDialog').close();
});
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
$('#exportBtn').addEventListener('click', () => exportProject());

// ---------- nosaukums un saglabāšana ----------
const nameInput = $('#projectName');
nameInput.addEventListener('change', () => store.commit((f, p) => { p.name = nameInput.value.trim() || 'Bez nosaukuma'; }));
function syncProjectUI() {
  nameInput.value = store.project.name;
  document.title = `${store.project.name} · Būvplāns`;
  renderFloorMenus();
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
  if (!$('#props').contains(document.activeElement)) renderProps();
  syncUndo();
  scheduleSave();
  renderFloorMenus();
  if (currentView === 'calc') renderCalc();
  if (currentView === 'elev') renderElev();
});
store.addEventListener('select', () => renderProps());
store.addEventListener('floor', () => {
  renderFloorMenus();
  renderProps();
  $('#settingsPop').hidden = true;
});
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
  if (e.key === 'Escape' && (!$('#flyout').hidden || !$('#settingsPop').hidden || !$('#bgPop').hidden)) {
    closeFloating();
    $('#settingsPop').hidden = true;
    $('#bgPop').hidden = true;
    return;
  }
  if (editor.onKey(e)) { e.preventDefault(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && store.selection) { e.preventDefault(); store.deleteSelected(); return; }
  const tool = !mod && !e.altKey && TOOL_KEYS[e.key.toLowerCase()];
  if (tool && (stage.tools.includes(tool) || tool === 'dim' || tool === 'text')) editor.setTool(tool);
  if (e.key === '+' || e.key === '=') editor.zoom(1.2);
  if (e.key === '-') editor.zoom(1 / 1.2);
  if (e.key === '0') editor.fit();
});
document.addEventListener('keyup', (e) => editor.onKeyUp(e));

// ---------- starts ----------
renderStageTabs();
renderAlbumControls();
syncProjectUI();
syncUndo();
syncToggles();
setStage(stage.id);
const startView = location.hash.slice(1);
setView(VIEWS.includes(startView) ? startView : 'plan');
$('#saveState').textContent = 'Saglabāts pārlūkā';
window.buvplans = { store, editor, setStage };
