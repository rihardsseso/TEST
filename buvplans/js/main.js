// Lietotnes savienojums: lapas (stadijas), rīkjoslas, īpašības, stāvi un varianti, projekti, eksports.
import { Store, newProject, newFloor, uid, wallLength, wallDir, clampOpening, moveJoint, makeWall, STATUSES, statusLabel, snapshotWalls, followHosts } from './model.js';
import { Editor2D, TOOLS } from './editor2d.js';
import { FLOOR_FINISHES, byKind } from './catalog.js';
import { keepRoomsInSync } from './rooms.js';
import { roomStats, floorStats, specification, openingSchedule, statsCSV, fmt, wallMaterials, lineSchedule, zoneSchedule, finishSchedule } from './calc.js';
import { WALL_MATERIALS, wallMaterial } from './walls.js';
import { roomElevations, elevationSVG } from './elevations.js';
import { buildAlbum, SHEET_TYPES } from './album.js';
import { THEME, floorBounds, wallKind, renderFloorImage, floorSVG, SHOW_DEFAULTS } from './draw2d.js';
import { STAGES, stageById } from './stages.js';
import { FINISHES, LINE_TYPES, ZONE_TYPES } from './catalog-data.js';
import { createLeftbar } from './leftbar.js';
import { createShield } from './shield.js';
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
let leftbar = null;
const editor = new Editor2D($('#plan'), store, {
  onStatus: (t) => { $('#statusHint').textContent = t; },
  onTool: () => { leftbar?.sync(); syncToolButtons(); },
  onEdit: () => setTimeout(() => $('#props input, #props select')?.focus(), 30),
  onView: (v) => syncZoom(v),
});
const savedSettings = storage.getPref('settings', {});
Object.assign(editor.settings, savedSettings, { show: { ...SHOW_DEFAULTS, ...(savedSettings.show || {}) } });

const shield = createShield({ store, toast });
leftbar = createLeftbar({
  editor,
  onHelp: () => $('#helpDialog').showModal(),
  onShield: (spec) => shield.action(spec),
  status: (t) => { $('#statusHint').textContent = t; },
});

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
  for (const id of ['#settingsPop', '#bgPop', '#showPop', '#rotatePop']) $(id).hidden = true;
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
$('#openBtn')?.addEventListener('click', () => openProjects());
$('#saveBtn').addEventListener('click', () => {
  storage.saveProject(store.project);
  toast('Projekts saglabāts pārlūkā. Failu var lejupielādēt izvēlnē „Eksports/Imports”.');
});
$('#shortcutsBtn').addEventListener('click', () => $('#helpDialog').showModal());

// Eksporta/importa un albuma izvēlnes
for (const [btnId, menuId] of [['#exportMenuBtn', '#exportMenu'], ['#printBtn', '#printMenu']]) {
  $(btnId).addEventListener('click', (e) => {
    e.stopPropagation();
    const m = $(menuId), open = m.hidden;
    closeFloating();
    m.hidden = !open;
  });
}
$$('[data-exp]').forEach((b) => b.addEventListener('click', () => {
  closeFloating();
  const f = store.floor, name = `${store.project.name} - ${f.name}`;
  switch (b.dataset.exp) {
    case 'plan': exportProject(); break;
    case 'load': $('#fileImport').click(); break;
    case 'pdf': setView('album'); break;
    case 'png': exportImage(renderFloorImage(f, THEME, { width: 2200, height: 1500, units: editor.settings.units, stage, show: editor.settings.show }), `${name}.png`); break;
    case 'svg': {
      const svg = floorSVG(f, { units: editor.settings.units });
      if (embedded) copyText(svg, 'SVG nokopēts starpliktuvē');
      else download(`${name}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
      break;
    }
  }
}));

// ---------- lapas (stadijas) ----------
const LEGACY_STAGE = { base: 'init', demolish: 'break_walls', partitions: 'create_walls', heating: 'radiators', plumbing: 'santeh', water: 'waterplan', switches: 'light_connections', lighting: 'light', wiring: 'cables' };
const sheets = () => (store.project.sheets = store.project.sheets || []);
let stage = stageById(LEGACY_STAGE[storage.getPref('stage', 'init')] || storage.getPref('stage', 'init'), sheets());
function renderStageTabs() {
  const all = [...STAGES, ...sheets().map((s) => ({ id: s.id, name: s.name, custom: true }))];
  $('#stageTabs').innerHTML = all.map((s) => `<button type="button" role="tab" class="stage-tab ${s.custom ? 'custom' : ''}" data-stage="${s.id}" aria-selected="${s.id === stage.id}">${esc(s.name)}</button>`).join('')
    + '<button type="button" class="stage-tab add" id="addSheet" title="Pievienot savu lapu">Pievienot lapu</button>';
  $$('#stageTabs .stage-tab[data-stage]').forEach((b) => {
    b.addEventListener('click', () => setStage(b.dataset.stage));
    if (b.classList.contains('custom')) b.addEventListener('dblclick', () => renameSheet(b.dataset.stage, b));
  });
  $('#addSheet').addEventListener('click', () => {
    const sh = { id: `sheet_${uid()}`, name: `Lapa ${sheets().length + 1}` };
    store.commit((f, p) => { p.sheets = [...(p.sheets || []), sh]; });
    renderStageTabs();
    setStage(sh.id);
    toast('Pievienota sava lapa — zīmē figūras, komentārus un izmērus. Dubultklikšķis uz cilnes to pārdēvē.');
  });
  syncStageScroll();
}
function renameSheet(id, tab) {
  const sh = sheets().find((s) => s.id === id);
  if (!sh) return;
  const input = document.createElement('input');
  input.className = 'tab-rename';
  input.value = sh.name;
  tab.replaceWith(input);
  input.focus();
  input.select();
  const done = (save) => {
    if (save && input.value.trim()) store.commit((f, p) => { p.sheets.find((s) => s.id === id).name = input.value.trim(); });
    renderStageTabs();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); });
  input.addEventListener('blur', () => done(true));
}
function setStage(id) {
  stage = stageById(id, sheets());
  storage.setPref('stage', stage.id);
  $$('#stageTabs .stage-tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.stage === stage.id)));
  $(`#stageTabs [data-stage="${stage.id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  editor.setStage(stage);
  closeFloating();
  leftbar.render(stage);
  renderHelpLinks();
  const isShield = !!stage.shield;
  $('#shieldView').hidden = !isShield;
  $('#plan').hidden = isShield;
  if (isShield) shield.render();
  if (currentView !== 'plan') setView('plan');
  editor.status(stageHint());
}
function stageHint() {
  const hints = {
    init: 'Sāc ar sienām: „Zīmēt sienu” — klikšķini stūrus vai velc. Garumu var ierakstīt ar cipariem.',
    break_walls: 'Klikšķini uz sienām, ailēm vai radiatoriem, kurus demontēs — tie kļūs sarkani.',
    create_walls: 'Izvēlies starpsienas veidu un zīmē jaunās sienas.',
    rooms: 'Klikšķini telpā, lai to nosauktu un iestatītu griestu augstumu.',
    shield: 'Pievieno DIN sliedi un moduļus; vadi savieno moduļus.',
    floor: 'Izvēlies segumu un klikšķini telpā.',
    walls: 'Izvēlies apdari un klikšķini pie sienas (telpas vidū — visām sienām).',
    ceiling: 'Izvēlies griestu apdari un klikšķini telpā.',
  };
  return hints[stage.id] || (stage.custom ? 'Sava lapa: figūras, komentāri un izmēri tikai šai lapai.' : 'Izvēlies rīku kreisajā joslā un klikšķini plānā.');
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

// Lapai atbilstošie padomi plāna augšā
const TIPS = {
  wall: ['Kā zīmēt sienu?', 'Izvēlies „Zīmēt sienu”, konfigurācijā norādi biezumu un materiālu, tad klikšķini sienas sākumā un katrā stūrī. Ieraksti garumu ar cipariem un Enter. Dubultklikšķis vai Esc pabeidz.'],
  move: ['Kā pārvietot zīmējumu?', 'Velc tukšā vietā ar peli (rīkā „Atlasīt”) vai turi atstarpi un velc. Peles ritenītis tuvina un attālina, bultiņas apakšā labajā stūrī bīda plānu, taustiņš 0 centrē projektu.'],
  room: ['Kā nosaukt telpu?', 'Klikšķini telpā (uz tās numura vai laukuma) un labajā panelī ieraksti nosaukumu un griestu augstumu.'],
  items: ['Kā pārvaldīt priekšmetus?', 'Izvēlies priekšmetu kreisajā joslā un klikšķini plānā. Pie sienas tas pagriežas pats. Atlasītu priekšmetu var vilkt, pagriezt ar R un mainīt izmērus labajā panelī.'],
  sockets: ['Kā ievietot rozetes?', 'Izvēlies rozetes veidu un klikšķini pie sienas — rozete pielīp sienai. Augstumu no grīdas maina labajā panelī; standarta augstums — programmas iestatījumos.'],
  height: ['Kā iestatīt griestu augstumu?', 'Visam stāvam: iestatījumi apakšā → „Griestu augstums”. Vienai telpai: lapā „Telpas” klikšķini telpā un maini „Griestu augstums”.'],
  finish: ['Kā uzlikt apdari?', 'Izvēlies apdari kreisajā joslā un klikšķini telpā (grīdai, griestiem) vai pie sienas (sienu apdarei, izolācijai). Klikšķis telpas vidū uzliek sienu apdari visām telpas sienām.'],
  lines: ['Kā zīmēt caurules un kabeļus?', 'Izvēlies līnijas veidu un klikšķini lūzuma punktus; tie pielīp priekšmetiem. Dubultklikšķis vai Enter pabeidz.'],
};
const STAGE_TIPS = {
  init: ['wall', 'move'], break_walls: ['move'], create_walls: ['wall', 'move'], rooms: ['room', 'height'], furniture: ['items', 'move'], santeh: ['items'],
  sockets: ['sockets'], light_connections: ['sockets'], light: ['items'], cables: ['lines'], waterplan: ['lines'], warm_floor: ['lines'], radiators: ['items'],
  floor: ['finish'], walls: ['finish'], ceiling: ['finish', 'height'], hydroisolation: ['finish'], isolation: ['finish'], shtukaturka: ['finish'], styazhka: ['finish'],
};
function renderHelpLinks() {
  const tips = STAGE_TIPS[stage.id] || ['move'];
  $('#helpLinks').innerHTML = tips.map((k) => `<button type="button" class="help-link" data-tip="${k}"><i>?</i>${esc(TIPS[k][0])}</button>`).join('');
  $$('#helpLinks [data-tip]').forEach((b) => b.addEventListener('click', () => {
    const pop = $('#tipPop');
    const same = !pop.hidden && pop.dataset.tip === b.dataset.tip;
    closeFloating();
    if (same) return;
    pop.dataset.tip = b.dataset.tip;
    pop.innerHTML = `<p>${esc(TIPS[b.dataset.tip][1])}</p>`;
    pop.hidden = false;
  }));
}

function syncToolButtons() {
  $$('[data-tool-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.toolBtn === editor.tool)));
  $('#figureBtn').setAttribute('aria-pressed', String(editor.tool === 'zone' && editor.state.spec?.zone === 'figure'));
}

// ---------- peldošie paneļi ----------
function closeFloating() {
  leftbar.closeFly();
  $$('.dd-menu, .tb-menu').forEach((m) => { m.hidden = true; });
  $('#tipPop').hidden = true;
}
document.addEventListener('pointerdown', (e) => {
  if (!e.target.closest('#flyout, #leftbar, .dd, .tb-dd, #tipPop, .help-link, #itemPreview')) closeFloating();
  for (const [pop, btn] of [['#settingsPop', '#settingsBtn'], ['#bgPop', '#bgBtn'], ['#showPop', '#showBtn'], ['#rotatePop', '#rotateBtn']]) {
    if (!e.target.closest(`${pop}, ${btn}, .dd-menu, #confirmPop`)) $(pop).hidden = true;
  }
});

// ---------- īpašību panelis ----------
const num = (label, key, value, opts = {}) => `<label class="field"><span>${label}</span><input type="number" inputmode="decimal" data-k="${key}" value="${Math.round((value ?? 0) * 10) / 10}" step="${opts.step || 1}" ${opts.min !== undefined ? `min="${opts.min}"` : ''}><em>${opts.unit ?? 'cm'}</em></label>`;
const txt = (label, key, value) => `<label class="field wide"><span>${label}</span><input type="text" data-k="${key}" value="${esc(value)}"></label>`;
const sel = (label, key, value, options) => `<label class="field wide"><span>${label}</span><select data-k="${key}">${options.map(([v, n]) => `<option value="${v}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
const chk = (label, key, value) => `<label class="check"><input type="checkbox" data-k="${key}" ${value ? 'checked' : ''}><span>${label}</span></label>`;
const btn = (label, act, cls = '') => `<button type="button" class="btn small ${cls}" data-act="${act}">${label}</button>`;
const stat = (label, value) => `<div class="stat"><dt>${label}</dt><dd>${value}</dd></div>`;
const panelHead = (title, closeId) => `<div class="props-head"><h3>${title}</h3><button type="button" class="icon-btn" data-close="${closeId}" aria-label="Aizvērt"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>`;
const finishOptions = (target, blank = '— nav —') => [['', blank], ...Object.entries(FINISHES[target] || {}).map(([k, v]) => [k, v.name])];

const KIND_NAMES = { walls: 'Siena', openings: 'Aile', items: 'Priekšmets', rooms: 'Telpa', labels: 'Komentārs', dims: 'Izmērs', lines: 'Līnija', zones: 'Zona' };
const LINE_COLORS = [['', 'Pēc veida'], ['#d93025', 'Sarkans'], ['#2f6fd6', 'Zils'], ['#2e9b3f', 'Zaļš'], ['#e0a100', 'Dzeltens'], ['#7a4bc2', 'Violets'], ['#333333', 'Melns']];
const OPENING_VARIANTS = {
  window: [['window', 'Logs'], ['opening', 'Aile bez loga'], ['windoor', 'Balkona bloks'], ['french', 'Franču logs (veramais)'], ['frenchSliding', 'Franču logs (bīdāmais)'], ['french4', 'Četrvērtņu franču logs']],
  door: [['single', 'Durvis'], ['opening', 'Aile'], ['double', 'Divviru durvis'], ['sliding', 'Bīdāmās'], ['sliding2', 'Divviru bīdāmās'], ['pocket', 'Iebīdāmās sienā'], ['pocket2', 'Divviru iebīdāmās'], ['stack', 'Paralēli bīdāma sistēma'], ['slideSys', 'Bīdāma sistēma'], ['pivot', 'Pagriežamās'], ['pivot2', 'Divviru pagriežamās'], ['bifold', 'Salokāmās'], ['bifold2', 'Divviru salokāmās'], ['accordion', 'Harmonikas'], ['glass', 'Stikla'], ['garage', 'Garāžas vārti'], ['balcony', 'Balkona durvis']],
};

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
    if (obj.kind === 'virtual') {
      h += `<p class="hint">Telpas zonējuma līnija sadala telpu zonās; tā neveido sienu.</p><dl class="stats">${stat('Garums', `${Math.round(wallLength(obj))} cm`)}</dl><div class="row">${btn('Dzēst', 'delete', 'danger')}</div>`;
    } else {
      h += `<div class="fields">${num('Garums', 'len', wallLength(obj), { min: 1 })}<label class="field"><span>Biezums</span><input type="number" inputmode="decimal" data-k="thickness" value="${obj.thickness}" min="0.5" step="0.5" list="thickList"><em>cm</em></label>
        <datalist id="thickList">${(mat?.thick || []).map((t) => `<option value="${t}"></option>`).join('')}</datalist>${num('Augstums', 'height', obj.height, { min: 10 })}
        ${sel('Materiāli', 'material', obj.material || '', [['', '— nav norādīts —'], ...WALL_MATERIALS.map((x) => [x.id, x.name])])}
        ${sel('Krāsa', 'color', obj.color || '', [['', 'Pēc materiāla (balta)'], ['grey', 'Pelēka'], ['black', 'Melna']])}
        ${sel('Nesošā / starpsiena', 'kind', wallKind(obj), [['bearing', 'Nesošā / ārsiena'], ['partition', 'Starpsiena'], ['balcony', 'Balkona margas']])}
        ${sel('Statuss', 'status', obj.status || 'existing', [['existing', 'Esoša'], ['demolish', 'Demontējama'], ['new', 'Jauna']])}</div>
        <div class="row">${btn('Sadalīt uz pusēm', 'split')}${btn('Dzēst', 'delete', 'danger')}</div><p class="hint">Velc apļus sienas galos, lai mainītu stūrus; savienotās sienas un grīda sekos līdzi.</p>`;
    }
  } else if (s.kind === 'openings') {
    const vlist = OPENING_VARIANTS[obj.type] || OPENING_VARIANTS.door;
    h += `<div class="fields">${sel('Veids', 'variant', obj.variant || vlist[0][0], vlist)}`;
    if (obj.variant === 'windoor') {
      h += num('Loga platums', 'windowWidth', obj.windowWidth ?? 130) + num('Loga augstums', 'windowHeight', obj.windowHeight ?? 140) + num('Durvju platums', 'doorWidth', obj.doorWidth ?? 80) + num('Durvju augstums', 'height', obj.height) + num('Loga augstums no grīdas', 'windowSill', obj.windowSill ?? 85);
    } else {
      h += num(obj.type === 'window' ? 'Loga platums' : 'Ailes platums', 'width', obj.width, { min: 20 }) + num(obj.type === 'window' ? 'Loga augstums' : 'Ailes augstums', 'height', obj.height, { min: 20 }) + num('Augstums no grīdas', 'sill', obj.sill, { min: 0 });
    }
    h += num('No sienas sākuma', 'offset', obj.pos - obj.width / 2, { min: 0 });
    if (obj.type === 'window' && obj.variant !== 'opening') h += num('Vērtņu skaits', 'casements', obj.casements ?? 2, { unit: '' }) + num('Palodzes izvirzījums', 'sillDepth', obj.sillDepth ?? 20);
    if (obj.type === 'door') h += chk('Kārba ar apmalēm', 'trims', obj.trims) + chk('Arkveida aile', 'arched', obj.arched);
    h += `${sel('Statuss', 'status', obj.status || '', [['', 'Esoša'], ['new', 'Jauna'], ['demolish', 'Demontējama']])}</div>
      <div class="row">${btn('Mainīt virināšanas virzienu', 'hinge')}${btn(obj.type === 'door' ? 'Pagriezt (uz otru pusi)' : 'Palodzes puse', 'swing')}${btn('Izveidot kopiju', 'copyOpening')}${btn('Dzēst', 'delete', 'danger')}</div>`;
  } else if (s.kind === 'items') {
    const def = byKind(obj.kind);
    if (obj.kind === '__image') {
      h += `<div class="fields">${txt('Paraksts', 'name', obj.name || '')}${num('Platums', 'w', obj.w, { min: 1 })}${num('Augstums (plānā)', 'd', obj.d, { min: 1 })}${num('Pagrieziens', 'rot', obj.rot || 0, { unit: '°', step: 15 })}</div><div class="row">${btn('Dzēst', 'delete', 'danger')}</div>`;
    } else {
      const point = def?.electric || def?.water;
      h += `<div class="fields">${txt('Nosaukums', 'name', obj.name || def?.name || '')}`;
      if (!point) h += num('Garums', 'w', obj.w, { min: 1 }) + num('Platums', 'd', obj.d, { min: 1 }) + num('Augstums', 'h', obj.h, { min: 1 });
      h += `${num('Augstums no grīdas', 'elev', obj.elev || 0, { min: 0 })}${num('Pagrieziena leņķis', 'rot', obj.rot || 0, { unit: '°', step: 15 })}`;
      if (point && def?.electric === 'socket') h += num('Rozešu skaits blokā', 'count', obj.count ?? 1, { unit: 'gab.' });
      if (!point) h += `<label class="field wide"><span>Krāsa</span><input type="color" data-k="color" value="${obj.color || '#cccccc'}"></label>`;
      h += `${txt('Komentārs', 'comment', obj.comment || '')}</div>
        <div class="row">${btn('Pagriezt 90°', 'rotate')}${point ? '' : btn('Spoguļot', 'mirror')}${btn('Izveidot kopiju', 'duplicate')}${btn('Dzēst', 'delete', 'danger')}</div>
        <p class="hint">R — pagriezt, bultiņas — pabīdīt (Shift — pa 10 cm), Alt vilkšanas laikā — bez magnēta.</p>`;
    }
  } else if (s.kind === 'rooms') {
    const r = roomStats(f, obj);
    h += `<div class="fields">${txt('Telpas nosaukums', 'name', obj.name)}${num('Griestu augstums', 'height', obj.height || f.height, { min: 100 })}
      ${sel('Grīdas segums', 'floorFinish', obj.floorFinish || '', finishOptions('floor').concat(FLOOR_FINISHES.filter((x) => obj.floorFinish === x.id).map((x) => [x.id, x.name])))}
      ${sel('Grīdlīste', 'baseboard', obj.baseboard || '', finishOptions('baseboard'))}
      ${sel('Griesti', 'ceiling', obj.ceiling || '', finishOptions('ceiling'))}${chk('Griestu līste', 'ceilingMolding', obj.ceilingMolding)}
      ${sel('Grīdas klons', 'screed', obj.screed || '', finishOptions('screed'))}${num('Klona biezums', 'screedLevel', obj.screedLevel ?? 5)}
      ${sel('Grīdas hidroizolācija', 'waterFloor', obj.waterFloor || '', finishOptions('waterFloor'))}
      ${chk('Neslēpt sienu skatos', 'showInElev', obj.showInElev !== false)}</div>
      <dl class="stats">${stat('Laukums', `${fmt(r.area)} m²`)}${stat('Perimetrs', `${fmt(r.perimeter)} m`)}${stat('Sienas bez ailēm', `${fmt(r.wallNet)} m²`)}${stat('Tilpums', `${fmt(r.volume)} m³`)}${stat('Grīdlīste', `${fmt(r.baseboard)} m`)}${stat('Rozetes / slēdži / gaism.', `${r.sockets} / ${r.switches} / ${r.lights}`)}</dl>
      <p class="hint">Grīdas forma izriet no sienām: pārvietojot, pagarinot vai dzēšot sienu, grīda mainās līdzi.</p>
      <div class="row">${btn('Sienu skati', 'elev')}</div>`;
  } else if (s.kind === 'labels') {
    h += `<div class="fields">${txt('Komentāra teksts', 'text', obj.text)}${num('Fonta izmērs', 'size', obj.size || 14, { unit: 'px', min: 8 })}
      <label class="field wide"><span>Krāsa</span><input type="color" data-k="color" value="${obj.color || '#222222'}"></label>${chk('Rāmis', 'frame', obj.frame)}</div><div class="row">${btn('Izveidot kopiju', 'duplicate')}${btn('Dzēst', 'delete', 'danger')}</div>`;
  } else if (s.kind === 'dims') {
    h += `<div class="fields">${num('Atkāpe', 'offset', obj.offset || 0)}<label class="field wide"><span>Krāsa</span><input type="color" data-k="color" value="${obj.color || '#333333'}"></label></div><dl class="stats">${stat('Garums', `${Math.round(Math.hypot(obj.b.x - obj.a.x, obj.b.y - obj.a.y))} cm`)}</dl><div class="row">${btn('Dzēst', 'delete', 'danger')}</div>`;
  } else if (s.kind === 'lines') {
    const def = LINE_TYPES[obj.type] || {};
    const L = obj.points.reduce((q, p, i) => (i ? q + Math.hypot(p.x - obj.points[i - 1].x, p.y - obj.points[i - 1].y) : 0), 0);
    h += `<div class="fields">${sel('Veids', 'type', obj.type, Object.entries(LINE_TYPES).map(([k, v]) => [k, v.name]))}${txt('Apzīmējums', 'label', obj.label || '')}`;
    if (def.duct || obj.type === 'beam') h += num('Platums', 'width', obj.width ?? def.width) + num('Augstums', 'height', obj.height ?? 6);
    if (def.duct) h += sel('Caurules tips', 'round', obj.round ? '1' : '0', [['0', 'Plakana'], ['1', 'Apaļa']]);
    else h += sel('Krāsa', 'color', obj.color || '', LINE_COLORS);
    h += `${num('Nolaidums no griestiem', 'drop', obj.drop || 0)}</div><dl class="stats">${stat('Garums', `${fmt(L / 100)} m`)}${stat('Lūzuma punkti', obj.points.length)}</dl><div class="row">${btn('Izveidot kopiju', 'copyLine')}${btn('Dzēst', 'delete', 'danger')}</div>`;
  } else if (s.kind === 'zones') {
    const def = ZONE_TYPES[obj.type] || {};
    const area = obj.points.reduce((acc, p, i, a) => { const q = a[(i + 1) % a.length]; return acc + p.x * q.y - q.x * p.y; }, 0);
    h += `<div class="fields">${sel('Veids', 'type', obj.type, Object.entries(ZONE_TYPES).map(([k, v]) => [k, v.name]))}${txt('Nosaukums', 'label', obj.label || '')}`;
    if (obj.type === 'floorZone') h += sel('Grīdas segums', 'finish', obj.finish || '', finishOptions('floor'));
    if (obj.type === 'heatCable' || obj.type === 'heatWater') h += num('Solis', 'pitch', obj.pitch ?? 15) + sel('Ieklāšana', 'pattern', obj.pattern || 'snake', [['snake', 'Dubultā čūska'], ['spiral', 'Spirāle']]);
    if (obj.type === 'ceiling2') h += num('Kārbas nolaidums', 'drop', obj.drop ?? 10) + num('Kārbas platums', 'boxWidth', obj.boxWidth ?? 40);
    h += `</div><dl class="stats">${stat('Laukums', `${fmt(Math.abs(area) / 2e4)} m²`)}${stat(def.name || 'Zona', '')}</dl><div class="row">${btn('Dzēst', 'delete', 'danger')}</div>`;
  }
  el.innerHTML = panelHead(KIND_NAMES[s.kind] || 'Objekts', 'props') + `<div class="props-body">${h}</div>`;
  el.hidden = false;
  bindFields(el, (k, v) => {
    store.commit(() => applyProp(f, s.kind, obj, k, v));
    if (['type', 'variant', 'material'].includes(k)) renderProps();
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
  if (kind === 'walls' && k === 'color') {
    if (v) obj.color = v; else delete obj.color;
    return;
  }
  if (kind === 'openings') {
    const w = f.walls.find((x) => x.id === obj.wallId);
    if (k === 'offset') obj.pos = v + obj.width / 2;
    else if (k === 'status') { if (v) obj.status = v; else delete obj.status; }
    else obj[k] = v;
    if (obj.variant === 'windoor' && ['windowWidth', 'doorWidth'].includes(k)) obj.width = (obj.windowWidth ?? 130) + (obj.doorWidth ?? 80);
    if (w) clampOpening(obj, w);
    return;
  }
  if (kind === 'lines' && k === 'round') {
    obj.round = v === '1';
    return;
  }
  if (kind === 'lines' && k === 'color' && !v) {
    delete obj.color;
    return;
  }
  if (kind === 'rooms' && ['floorFinish', 'ceiling', 'screed', 'waterFloor', 'baseboard'].includes(k) && !v) {
    delete obj[k];
    return;
  }
  obj[k] = k === 'rot' ? ((v % 360) + 360) % 360 : v;
}

function propAction(act, obj) {
  const f = store.floor;
  switch (act) {
    case 'delete': store.deleteSelected(); break;
    case 'split': store.commit((fl) => {
      const L = wallLength(obj), mid = add(obj.a, mul(wallDir(obj), L / 2));
      const w2 = { ...JSON.parse(JSON.stringify(obj)), ...makeWall(mid, obj.b, obj.thickness, obj.height), kind: obj.kind, status: obj.status, material: obj.material };
      for (const o of fl.openings) if (o.wallId === obj.id && o.pos > L / 2) { o.wallId = w2.id; o.pos -= L / 2; }
      obj.b = mid;
      fl.walls.push(w2);
    }); break;
    case 'hinge': store.commit(() => { obj.hinge = !obj.hinge; }); break;
    case 'swing': store.commit(() => { obj.swing = !obj.swing; }); break;
    case 'rotate': store.commit(() => { obj.rot = ((obj.rot || 0) + 90) % 360; }); break;
    case 'mirror': store.commit(() => { obj.mirror = !obj.mirror; }); break;
    case 'duplicate': duplicateSelection(); break;
    case 'copyOpening': {
      const w = f.walls.find((x) => x.id === obj.wallId);
      const o = { ...JSON.parse(JSON.stringify(obj)), id: uid(), pos: obj.pos + obj.width + 20 };
      store.commit(() => { f.openings.push(o); if (w) clampOpening(o, w); });
      store.select({ kind: 'openings', id: o.id });
      break;
    }
    case 'copyLine': {
      const l = { ...JSON.parse(JSON.stringify(obj)), id: uid(), points: obj.points.map((p) => ({ x: p.x + 20, y: p.y + 20 })) };
      store.commit(() => f.lines.push(l));
      store.select({ kind: 'lines', id: l.id });
      break;
    }
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

// ---------- programmas iestatījumi ----------
function renderSettings() {
  const f = store.floor, p = store.project, st = editor.settings;
  const el = $('#settingsPop');
  const yn = (key, val) => `<div class="seg">${[['1', 'Jā'], ['0', 'Nē']].map(([v, n]) => `<button type="button" data-yn="${key}" data-v="${v}" aria-pressed="${String(!!val === (v === '1'))}">${n}</button>`).join('')}</div>`;
  el.innerHTML = panelHead('Programmas iestatījumi', 'settingsPop') + `<div class="props-body">
    <h4>Plānotājs</h4><div class="fields">
    <label class="field wide"><span>Kompakts lapu panelis</span>${yn('compactTabs', st.compactTabs)}</label>
    ${sel('Mēbeļu un iekārtu krāsa', 's.furnitureColor', st.furnitureColor || 'color', [['color', 'Krāsaina'], ['green', 'Zaļa'], ['black', 'Melna']])}
    ${sel('Santehnikas krāsa', 's.plumbingColor', st.plumbingColor || 'color', [['color', 'Krāsaina'], ['green', 'Zaļa'], ['black', 'Melna'], ['blue', 'Zila']])}
    <label class="field wide"><span>Sienas leņķa mērīšana</span>${yn('wallAngle', st.wallAngle !== false)}</label>
    ${num('Standarta rozetes augstums', 's.socketHeight', st.socketHeight ?? 30)}${num('Sadales kārbas augstums', 's.boxHeight', st.boxHeight ?? 240)}
    ${chk('Režģis', 's.grid', st.grid)}${chk('Piesaiste režģim un 15° leņķiem', 's.snap', st.snap)}</div>
    <h4>Stāvs</h4><div class="fields">${txt('Nosaukums', 'f.name', f.name)}${num('Griestu augstums', 'f.height', f.height, { min: 150 })}${num('Līmenis no ±0,00', 'f.elevation', f.elevation)}</div>
    <div class="row">${btn('Visām sienām šo augstumu', 'applyHeight')}</div>
    <h4>Projekts</h4><div class="fields">${txt('Autors (albuma zīmogā)', 'p.author', p.author)}${txt('Adrese', 'p.address', p.address)}
    ${sel('Statuss', 'p.status', p.status, STATUSES)}${txt('Mape', 'p.folder', p.folder)}</div></div>`;
  bindFields(el, (k, v) => {
    if (k.startsWith('s.')) {
      editor.settings[k.slice(2)] = v;
      saveSettings();
      editor.requestRender();
    } else if (k.startsWith('f.')) {
      store.commit((fl) => {
        for (const x of groupFloors()) if (k !== 'f.height' || x.id === fl.id) x[k.slice(2)] = v;
      });
    } else if (k.startsWith('p.')) store.commit((fl, pr) => { pr[k.slice(2)] = v; });
  });
  $$('[data-yn]', el).forEach((b) => b.addEventListener('click', () => {
    editor.settings[b.dataset.yn] = b.dataset.v === '1';
    saveSettings();
    syncToggles();
    renderSettings();
  }));
  $('[data-act="applyHeight"]', el).addEventListener('click', () => {
    store.commit((fl) => fl.walls.forEach((w) => { w.height = fl.height; }));
    toast('Sienu augstums atjaunināts');
  });
}
function saveSettings() {
  storage.setPref('settings', editor.settings);
}
function togglePop(id, render) {
  const el = $(id);
  if (!el.hidden) {
    el.hidden = true;
    return;
  }
  render();
  el.hidden = false;
}
$('#settingsBtn').addEventListener('click', () => togglePop('#settingsPop', renderSettings));

// Rādīt/slēpt elementus
const SHOW_LABELS = [['wallDims', 'Sienu izmēri'], ['extDims', 'Ārējie izmēri'], ['userDims', 'Papildu izmēri'], ['itemDims', 'Priekšmetu izmēri'], ['heights', 'Augstumi'],
  ['roomNumbers', 'Telpu numuri'], ['areas', 'Laukumi'], ['furniture', 'Mēbeles'], ['outlets', 'Rozetes un slēdži'], ['finishing', 'Apdare'], ['water', 'Ūdensapgāde'],
  ['linear', 'Lineārais apgaismojums'], ['lighting', 'Apgaismojums'], ['ac', 'Kondicionēšana un ventilācija'], ['wireLengths', 'Vadu garumi'], ['comments', 'Komentāri']];
function renderShow() {
  const sh = editor.settings.show;
  $('#showPop').innerHTML = panelHead('Rādīt/slēpt elementus', 'showPop') + `<div class="props-body show-list">${SHOW_LABELS.map(([k, n]) => `<label class="check"><input type="checkbox" data-show="${k}" ${sh[k] ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>`;
  $$('[data-show]', $('#showPop')).forEach((i) => i.addEventListener('change', () => {
    editor.settings.show[i.dataset.show] = i.checked;
    saveSettings();
    syncToggles();
    editor.requestRender();
  }));
  bindFields($('#showPop'), () => {});
}
$('#showBtn').addEventListener('click', () => togglePop('#showPop', renderShow));

// Pagriezt / apgriezt projektu
function transformProject(fn, rotItems) {
  const b = floorBounds(store.floor);
  if (!b) return;
  const c = { x: Math.round(b.minX + b.w / 2), y: Math.round(b.minY + b.h / 2) };
  const T = (p) => fn(p, c);
  store.commit((f) => {
    for (const w of f.walls) { w.a = T(w.a); w.b = T(w.b); }
    for (const r of f.rooms) r.points = r.points.map(T);
    for (const it of f.items) Object.assign(it, T(it), { rot: rotItems(it.rot || 0) });
    for (const d of f.dims) { d.a = T(d.a); d.b = T(d.b); }
    for (const l of f.labels) Object.assign(l, T(l));
    for (const ln of f.lines || []) ln.points = ln.points.map(T);
    for (const z of f.zones || []) z.points = z.points.map(T);
  });
  editor.fit();
}
function renderRotate() {
  $('#rotatePop').innerHTML = panelHead('Pagriezt/apgriezt projektu', 'rotatePop') + `<div class="props-body"><div class="row col">
    ${btn('Pagriezt projektu par 90°', 'rot90')}${btn('Apgriezt horizontāli', 'flipH')}${btn('Apgriezt vertikāli', 'flipV')}</div></div>`;
  bindFields($('#rotatePop'), () => {});
  $$('[data-act]', $('#rotatePop')).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.act === 'rot90') transformProject((p, c) => ({ x: c.x - (p.y - c.y), y: c.y + (p.x - c.x) }), (r) => (r + 90) % 360);
    if (b.dataset.act === 'flipH') transformProject((p, c) => ({ x: 2 * c.x - p.x, y: p.y }), (r) => (360 - r) % 360);
    if (b.dataset.act === 'flipV') transformProject((p, c) => ({ x: p.x, y: 2 * c.y - p.y }), (r) => (540 - r) % 360);
  }));
}
$('#rotateBtn').addEventListener('click', () => togglePop('#rotatePop', renderRotate));

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
  if (currentView !== 'plan') setView('plan');
  togglePop('#bgPop', renderBg);
});
function readImage(input, cb) {
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) return toast('Attēls ir lielāks par 4 MB — samazini to, lai projekts ietilptu pārlūka krātuvē.');
    const r = new FileReader();
    r.onload = () => cb(r.result);
    r.readAsDataURL(file);
  });
}
readImage($('#fileBg'), (src) => {
  store.commit((f) => { f.background = { src, widthCm: 1000, x: 0, y: 0, opacity: 0.5, visible: true }; });
  renderBg();
  $('#bgPop').hidden = false;
  toast('Attēls pievienots. Norādi tā platumu dabā, lai mērogs sakristu.');
});
readImage($('#fileImage'), (src) => {
  const img = new Image();
  img.onload = () => {
    const w = 200, d = Math.round((w * img.naturalHeight) / img.naturalWidth);
    if (currentView !== 'plan') setView('plan');
    editor.setTool('image', { src, w, d });
  };
  img.src = src;
});
$('#imageBtn').addEventListener('click', () => $('#fileImage').click());
$('#figureBtn').addEventListener('click', () => {
  if (currentView !== 'plan') setView('plan');
  leftbar.activate({ t: 'zone', zone: 'figure', name: 'Zīmēt figūru' }, null);
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
    if (stage.shield) shield.render();
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
    f.walls = cur.walls.filter((w) => w.status !== 'demolish' && wallKind(w) === 'bearing').map((w) => ({ ...JSON.parse(JSON.stringify(w)), id: uid(), status: 'existing', faces: undefined }));
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
function confirmInline(anchor, question, onYes, yesLabel = 'Jā') {
  const pop = $('#confirmPop');
  $('#confirmText').textContent = question;
  $('#confirmYes').textContent = yesLabel;
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
  saveSettings();
  editor.requestRender();
  if (currentView === 'elev') renderElev();
});
$('#undoBtn').addEventListener('click', () => store.undo());
$('#redoBtn').addEventListener('click', () => store.redo());
$('#deleteBtn').addEventListener('click', () => store.deleteSelected());
$$('.bb-toggle').forEach((b) => b.addEventListener('click', () => {
  const k = b.dataset.setting;
  if (k === 'elements') return;
  editor.settings[k] = !editor.settings[k];
  saveSettings();
  syncToggles();
  editor.requestRender();
}));
function syncToggles() {
  $$('.bb-toggle').forEach((b) => {
    const k = b.dataset.setting;
    const on = k === 'elements' ? Object.values(editor.settings.show).every(Boolean) : !!editor.settings[k];
    b.setAttribute('aria-pressed', String(on));
  });
  root.classList.toggle('hints-off', !editor.settings.hints);
  root.classList.toggle('compact-tabs', !!editor.settings.compactTabs);
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
$('#clearBtn').addEventListener('click', () => confirmInline($('#clearBtn'), 'Šī darbība notīrīs visus šī varianta zīmējumus. Vai turpināt?', () => {
  store.commit((f) => { for (const k of ['walls', 'openings', 'rooms', 'items', 'dims', 'labels', 'lines', 'zones']) f[k] = []; f.shield = null; });
  store.select(null);
  toast('Zīmējumi notīrīti. Atsaukt var ar Ctrl+Z.');
}, 'Jā, notīrīt'));

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
    <div class="tile"><span>Elektrības kabeļi</span><b>${fmt(sum('wireLength'))}<small> m</small></b></div>
    <div class="tile"><span>Rozetes / slēdži / gaism.</span><b>${sum('sockets')} / ${sum('switches')} / ${sum('lights')}</b></div>
  </div>
  <div class="row calc-actions">${btn('Kopēt kā CSV', 'csvCopy')}<button type="button" class="btn small embed-hide" data-act="csvSave">Lejupielādēt CSV</button></div>`;
  for (const { f, st } of all) {
    const t = st.totals;
    const rows = st.rooms.map((r) => `<tr><td>${esc(r.name)}</td><td class="n">${fmt(r.area)}</td><td class="n">${fmt(r.perimeter)}</td><td class="n">${fmt(r.height)}</td><td class="n">${fmt(r.volume)}</td><td class="n">${fmt(r.wallNet)}</td><td class="n">${fmt(r.ceiling)}</td><td class="n">${fmt(r.baseboard)}</td><td class="n">${fmt(r.windowSills)}</td><td class="n">${r.doors}/${r.windows}</td><td class="n">${r.sockets}/${r.switches}/${r.lights}</td><td>${esc(r.floorFinish)}</td></tr>`).join('');
    const spec = specification(f).map((s) => `<tr><td>${esc(s.name)}</td><td class="n">${s.w}×${s.d}×${s.h}</td><td class="n">${s.count}</td></tr>`).join('');
    const ops = openingSchedule(f).map((o) => `<tr><td>${o.type}</td><td class="n">${o.width}×${o.height}</td><td class="n">${o.sill}</td></tr>`).join('');
    const layouts = groupFloors(groupOf(f));
    const label = `${esc(f.name)}${layouts.length > 1 ? ` · ${layouts.indexOf(f) + 1}. variants` : ''}`;
    h += `<section class="calc-floor"><h2>${label}${f.variant ? ' <span class="pill">variants</span>' : ''}</h2>
      <div class="table-wrap"><table class="data"><thead><tr><th>Telpa</th><th class="n">Laukums m²</th><th class="n">Perimetrs m</th><th class="n">H m</th><th class="n">Tilpums m³</th><th class="n">Sienas m²</th><th class="n">Griesti m²</th><th class="n">Grīdlīste m</th><th class="n">Palodzes m</th><th class="n">Durvis/logi</th><th class="n">Roz./slēdži/gaism.</th><th>Grīdas segums</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="12" class="empty">Šajā stāvā vēl nav telpu. Uzzīmē sienas.</td></tr>'}</tbody>
      <tfoot><tr><td>Kopā</td><td class="n">${fmt(t.area)}</td><td></td><td></td><td class="n">${fmt(t.volume)}</td><td class="n">${fmt(t.wallNet)}</td><td class="n">${fmt(t.ceiling)}</td><td class="n">${fmt(t.baseboard)}</td><td></td><td class="n">${t.doors}/${t.windows}</td><td class="n">${t.sockets}/${t.switches}/${t.lights}</td><td></td></tr></tfoot></table></div>
      ${materialsTable(f)}${finishTable(f)}${linesTable(f)}
      <div class="calc-cols"><div class="table-wrap"><h3>Mēbeles un iekārtas</h3><table class="data"><thead><tr><th>Nosaukums</th><th class="n">Izmēri cm</th><th class="n">Skaits</th></tr></thead><tbody>${spec || '<tr><td colspan="3" class="empty">Nav priekšmetu</td></tr>'}</tbody></table></div>
      <div class="table-wrap"><h3>Ailes</h3><table class="data"><thead><tr><th>Veids</th><th class="n">P×A cm</th><th class="n">Palodze cm</th></tr></thead><tbody>${ops || '<tr><td colspan="3" class="empty">Nav aiļu</td></tr>'}</tbody></table>
      <dl class="stats">${stat('Sienu garums (pēc remonta)', `${fmt(t.wallLength)} m`)}${stat('Mūra apjoms', `${fmt(t.wallVolume)} m³`)}${stat('Demontējamās sienas', `${fmt(t.demolishLength)} m · ${fmt(t.demolishVolume)} m³`)}${stat('Jaunās starpsienas', `${fmt(t.newLength)} m · ${fmt(t.newArea)} m²`)}${stat('TV / datortīkla rozetes', t.weak)}${stat('Ūdens un kanalizācijas izvadi', t.water)}</dl></div></div></section>`;
  }
  const el = $('#calcBody');
  el.innerHTML = h;
  $$('[data-act]', el).forEach((b) => b.addEventListener('click', () => {
    const csv = statsCSV(store.project);
    if (b.dataset.act === 'csvSave') download(`${store.project.name}.csv`, new Blob(['﻿' + csv], { type: 'text/csv' }));
    else copyText(csv, 'Tabula nokopēta — ielīmē to izklājlapā');
  }));
}
const fmtT = (t) => String(t).replace('.', ',');
function materialsTable(f) {
  const rows = wallMaterials(f).map((r) => `<tr><td>${esc(r.name)}</td><td class="n">${fmtT(r.thickness)}</td><td class="n">${fmt(r.length)}</td><td class="n">${fmt(r.area)}</td><td class="n">${fmt(r.volume, 3)}</td><td class="n">${r.units ? `~${r.units.toLocaleString('lv-LV')}` : '–'}</td></tr>`).join('');
  if (!rows) return '';
  return `<div class="table-wrap calc-mat"><h3>Sienu materiāli</h3><table class="data"><thead><tr><th>Materiāls</th><th class="n">Biezums cm</th><th class="n">Garums m</th><th class="n">Laukums bez ailēm m²</th><th class="n">Apjoms m³</th><th class="n">Bloki / ķieģeļi gab.</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="hint">Bloku skaits ir aptuvens — pēc bloka skata izmēra ar šuvi, bez rezerves griezumiem.</p></div>`;
}
function finishTable(f) {
  const rows = finishSchedule(f).map((r) => `<tr><td>${esc(r.groupName)}</td><td>${esc(r.name)}</td><td class="n">${fmt(r.qty)}</td><td>${r.unit}</td></tr>`).join('');
  const zones = zoneSchedule(f).map((z) => `<tr><td>Zona</td><td>${esc(z.name)}</td><td class="n">${fmt(z.area)}</td><td>m²</td></tr>`).join('');
  if (!rows && !zones) return '';
  return `<div class="table-wrap calc-mat"><h3>Apdare un zonas</h3><table class="data"><thead><tr><th>Darbs</th><th>Materiāls</th><th class="n">Daudzums</th><th>Mērv.</th></tr></thead><tbody>${rows}${zones}</tbody></table></div>`;
}
function linesTable(f) {
  const rows = lineSchedule(f).map((r) => `<tr><td><i class="swatch" style="background:${r.color}"></i>${esc(r.name)}</td><td class="n">${r.count}</td><td class="n">${fmt(r.length)}</td></tr>`).join('');
  if (!rows) return '';
  return `<div class="table-wrap calc-mat"><h3>Caurules, kabeļi un gaisa vadi</h3><table class="data"><thead><tr><th>Veids</th><th class="n">Līnijas</th><th class="n">Garums m</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="hint">Garums pēc plāna, bez nolaidumiem līdz rozetēm un rezerves.</p></div>`;
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
  if (embedded) copyText(json, 'Projekts nokopēts starpliktuvē (.plan saturs)');
  else {
    download(`${store.project.name}.plan`, new Blob([json], { type: 'application/json' }));
    toast('Projekts saglabāts .plan failā');
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
  }, 'Dzēst')));
}
function loadIntoEditor(p) {
  storage.validateProject(p);
  store.load(p);
  storage.saveProject(p);
  storage.setLastProject(p.id);
  editor.fitted = false;
  editor.fit();
  syncProjectUI();
  renderStageTabs();
  if (view3d) view3d.fitted = false;
  setStage(stageById(stage.id, sheets()).id);
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
  setStage('init');
  leftbar.activate(STAGES[0].tools[0], 0);
  toast('Jauns projekts. Zīmē sienas — klikšķini stūrus, garumu var ierakstīt ar cipariem.');
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
    $('#saveState').textContent = ok ? 'Saglabāts pārlūkā' : 'Nav saglabāts — eksportē .plan failu';
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
  if (stage.shield && !$('#shieldView').contains(document.activeElement)) shield.render();
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
  if (e.key === 'Escape' && (leftbar.isOpen() || ['#settingsPop', '#bgPop', '#showPop', '#rotatePop'].some((id) => !$(id).hidden))) {
    closeFloating();
    for (const id of ['#settingsPop', '#bgPop', '#showPop', '#rotatePop']) $(id).hidden = true;
    return;
  }
  if (editor.onKey(e)) { e.preventDefault(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && store.selection) { e.preventDefault(); store.deleteSelected(); return; }
  if (!mod && !e.altKey) {
    const k = e.key.toLowerCase();
    if (k === 'w' && stage.tools.some((t) => t.t === 'wall')) leftbar.activate(stage.tools.find((t) => t.t === 'wall'), stage.tools.findIndex((t) => t.t === 'wall'));
    else if (k === 'v') editor.setTool('select');
    else if (k === 'm') editor.setTool('dim');
    else if (k === 't') editor.setTool('text');
    else if (k === 'e') editor.setTool('eraser');
    else if (k === 'd' && stage.edit?.includes('openings')) editor.setTool('door');
    else if (k === 'l' && stage.edit?.includes('openings')) editor.setTool('window');
  }
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
window.buvplans = { store, editor, setStage, leftbar, shield };
export { TOOLS };
