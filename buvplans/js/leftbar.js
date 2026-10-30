// Kreisā rīkjosla kā Remplanner plānotājā: šaura ikonu josla, kas, uzvirzot peli, izvēršas ar nosaukumiem;
// grupas atver tumšu sarakstu ar saliekamām sadaļām; „KONFIGURĀCIJA” panelis aktīvā rīka iestatījumiem.
import { GROUPS, ITEMS, FINISHES, LINE_TYPES, ZONE_TYPES } from './catalog-data.js';
import { byKind, drawItem2D } from './catalog.js';
import { WALL_MATERIALS, wallMaterial, drawMaterialSwatch } from './walls.js';
import { icon, hasIcon } from './icons.js';
import { fromUnit, inputValue, unitStep, unitNudge, unitName, fmtNum } from './units.js';
import { libraryFor, removeFromLibrary } from './storage.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SEARCH_STAGES = new Set(['furniture', 'santeh', 'radiators', 'light', 'sockets', 'security', 'conditioners', 'ventilation', 'init', 'create_walls']);

export function createLeftbar({ editor, onHelp, onShield, status }) {
  const bar = $('#leftbar'), fly = $('#flyout'), cfg = $('#configPanel'), preview = $('#itemPreview');
  let stage = null, active = null;
  const U = () => editor.settings.units;
  const L = (cm) => fmtNum(cm, U());
  bar.addEventListener('mouseleave', () => bar.classList.remove('rest'));

  function drawThumb(cv, def, mono) {
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, cv.width, cv.height);
    const k = Math.min((cv.width - 8) / def.w, (cv.height - 8) / def.d, 5);
    ctx.save();
    ctx.translate(cv.width / 2, cv.height / 2);
    ctx.scale(k, k);
    ctx.lineWidth = (mono ? 1.6 : 1.2) / k;
    ctx.fillStyle = mono ? 'rgba(255,255,255,0.14)' : def.color;
    ctx.strokeStyle = mono ? '#f2f2f2' : '#3a3a3a';
    drawItem2D(ctx, def);
    ctx.restore();
  }

  const iconHtml = (spec) => {
    if (spec.icon && hasIcon(spec.icon)) return icon(spec.icon);
    if (spec.t === 'item' && byKind(spec.item)) return `<canvas width="56" height="48" data-thumb="${spec.item}"></canvas>`;
    return icon(spec.icon || 'box');
  };

  function render(st) {
    stage = st;
    active = null;
    closeFly();
    let h = '<div class="lb-inner">';
    (st.tools || []).forEach((spec, i) => {
      h += `<button type="button" class="lb-row ${spec.t === 'group' ? 'group' : ''}" data-i="${i}" title="${esc(spec.name)}"><span class="lb-ic">${iconHtml(spec)}</span><span class="lb-label">${esc(spec.name)}</span>${spec.t === 'group' ? '<span class="lb-chev">›</span>' : ''}</button>`;
    });
    if (st.custom) {
      for (const [t, name, ic] of [['zone', 'Zīmēt figūru', 'figure'], ['text', 'Komentārs', 'help'], ['dim', 'Pievienot izmēru', 'beam']]) {
        h += `<button type="button" class="lb-row" data-custom="${t}" title="${name}"><span class="lb-ic">${icon(ic)}</span><span class="lb-label">${name}</span></button>`;
      }
    }
    if (libraryFor(st.id).length) {
      h += `<button type="button" class="lb-row group lib" data-lib title="Mana bibliotēka"><span class="lb-ic">${icon('box')}</span><span class="lb-label">Mana bibliotēka</span><span class="lb-chev">›</span></button>`;
    }
    if (SEARCH_STAGES.has(st.id) && (st.tools || []).some((x) => x.t === 'group')) {
      h += `<button type="button" class="lb-row search" data-search title="Meklēt objektus"><span class="lb-ic">${icon('search')}</span><span class="lb-label">Meklēt objektus</span></button>`;
    }
    h += `<button type="button" class="lb-row help" data-help title="Palīdzība un atbalsts"><span class="lb-ic">?</span><span class="lb-label">Palīdzība un atbalsts</span></button></div>`;
    bar.innerHTML = h;
    // Sakļautā joslā rindas nedrīkst aizritēt uz sāniem (fokuss to citādi dara)
    const inner = $('.lb-inner', bar);
    inner.addEventListener('scroll', () => { if (inner.scrollLeft) inner.scrollLeft = 0; });
    $$('canvas[data-thumb]', bar).forEach((cv) => drawThumb(cv, byKind(cv.dataset.thumb), true));
    $$('.lb-row[data-i]', bar).forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const spec = st.tools[+b.dataset.i];
      if (spec.t === 'group') {
        if (!fly.hidden && fly.dataset.group === spec.group) return closeFly();
        return openGroup(spec.group, b);
      }
      closeFly();
      activate(spec, +b.dataset.i);
    }));
    $$('.lb-row[data-custom]', bar).forEach((b) => b.addEventListener('click', () => {
      closeFly();
      const t = b.dataset.custom;
      if (t === 'zone') activate({ t: 'zone', zone: 'figure', name: 'Zīmēt figūru' }, 'c-zone');
      else editor.setTool(t);
    }));
    $('[data-search]', bar)?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!fly.hidden && fly.dataset.group === '__search') return closeFly();
      openSearch($('[data-search]', bar));
    });
    $('[data-lib]', bar)?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!fly.hidden && fly.dataset.group === '__lib') return closeFly();
      openLibrary($('[data-lib]', bar));
    });
    $('[data-help]', bar).addEventListener('click', () => onHelp());
    sync();
  }

  // ---------- lietotāja bibliotēka ----------
  function openLibrary(btn) {
    closeFly();
    fly.dataset.group = '__lib';
    const list = libraryFor(stage.id);
    fly.innerHTML = `<div class="fly-list"><div class="fly-sec static"><span>Mana bibliotēka</span></div>${list.map((e) => `<div class="fly-lib"><button type="button" class="fly-row" data-entry="${e.id}"><span>${esc(e.name)}</span><em class="fly-count">${e.items.length > 1 ? `${e.items.length} gab.` : ''}</em></button><button type="button" class="fly-del" data-del-entry="${e.id}" title="Dzēst no bibliotēkas" aria-label="Dzēst no bibliotēkas">×</button></div>`).join('')}</div>
      <p class="fly-note">Priekšmetus pievieno ar labo peles pogu → „Saglabāt bibliotēkā”.</p>`;
    $$('[data-entry]', fly).forEach((b) => b.addEventListener('click', () => {
      const entry = list.find((x) => x.id === b.dataset.entry);
      closeFly();
      activate({ t: 'preset', entry, name: entry.name }, 'lib');
    }));
    $$('[data-del-entry]', fly).forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      removeFromLibrary(b.dataset.delEntry);
      if (libraryFor(stage.id).length) openLibrary($('[data-lib]', bar));
      else render(stage);
    }));
    showFly(btn);
  }

  // ---------- grupas saraksts ----------
  function openGroup(gid, btn) {
    closeFly();
    const g = GROUPS[gid];
    if (!g) return;
    fly.dataset.group = gid;
    const named = g.sections.filter((s) => s.name).length > 1;
    let h = '<div class="fly-list">';
    g.sections.forEach((sec, si) => {
      if (sec.name && named) h += `<button type="button" class="fly-sec" data-sec="${si}" aria-expanded="false"><span>${esc(sec.name)}</span><i>⌄</i></button>`;
      h += `<div class="fly-items" data-sec-items="${si}" ${sec.name && named ? 'hidden' : ''}>`;
      sec.items.forEach((it, ii) => {
        h += `<button type="button" class="fly-row" data-si="${si}" data-ii="${ii}"><span>${esc(it.name)}</span>${it.t === 'item' ? `<em class="fly-eye">${icon('eye')}</em>` : ''}</button>`;
      });
      h += '</div>';
    });
    h += '</div><p class="fly-note">Ritini peles riteni virs saraksta, lai redzētu visus rīkus</p>';
    fly.innerHTML = h;
    $$('.fly-sec', fly).forEach((b) => b.addEventListener('click', () => {
      const open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', String(open));
      $(`[data-sec-items="${b.dataset.sec}"]`, fly).hidden = !open;
    }));
    $$('.fly-row', fly).forEach((b) => {
      const spec = g.sections[+b.dataset.si].items[+b.dataset.ii];
      b.addEventListener('click', () => {
        closeFly();
        activate(spec, +btn.dataset.i);
      });
      if (spec.t === 'item') {
        b.addEventListener('mouseenter', () => showPreview(spec, b));
        b.addEventListener('mouseleave', () => { preview.hidden = true; });
      }
    });
    showFly(btn);
  }

  function openSearch(btn) {
    closeFly();
    fly.dataset.group = '__search';
    fly.innerHTML = `<div class="fly-search"><input id="objSearch" type="search" placeholder="Meklēt objektus…" autocomplete="off"><span>Ievadi nosaukumu, piemēram, „gulta”, „izlietne”, „lustra”.</span></div><div class="fly-list" id="objResults"></div>`;
    const input = $('#objSearch'), res = $('#objResults');
    const all = Object.entries(ITEMS);
    const run = () => {
      const q = input.value.trim().toLowerCase();
      if (q.length < 2) {
        res.innerHTML = '';
        return;
      }
      const hits = all.filter(([, d]) => d.name.toLowerCase().includes(q)).slice(0, 80);
      res.innerHTML = hits.length ? hits.map(([k, d]) => `<button type="button" class="fly-row" data-kind="${k}"><span>${esc(d.name)}</span><em class="fly-eye">${icon('eye')}</em></button>`).join('') : '<p class="fly-note">Nekas netika atrasts.</p>';
      $$('.fly-row', res).forEach((b) => {
        const spec = { t: 'item', item: b.dataset.kind, name: ITEMS[b.dataset.kind].name };
        b.addEventListener('click', () => {
          closeFly();
          activate(spec, null);
        });
        b.addEventListener('mouseenter', () => showPreview(spec, b));
        b.addEventListener('mouseleave', () => { preview.hidden = true; });
      });
    };
    input.addEventListener('input', run);
    showFly(btn);
    setTimeout(() => input.focus(), 20);
  }

  function showFly(btn) {
    bar.classList.add('pinned');
    fly.hidden = false;
    const ws = $('.workspace').getBoundingClientRect(), r = btn.getBoundingClientRect();
    fly.style.top = `${Math.max(0, Math.min(r.top - ws.top, ws.height - fly.offsetHeight - 6))}px`;
    btn.classList.add('open');
  }

  function closeFly() {
    fly.hidden = true;
    fly.dataset.group = '';
    preview.hidden = true;
    bar.classList.remove('pinned');
    $$('.lb-row.open', bar).forEach((b) => b.classList.remove('open'));
  }

  function showPreview(spec, row) {
    const def = byKind(spec.item);
    if (!def) return;
    preview.innerHTML = `<canvas width="200" height="140"></canvas><b>${esc(def.name)}</b><span>${L(def.w)} × ${L(def.d)} × ${L(def.h)} ${unitName(U())}${def.elev ? ` · ${L(def.elev)} ${unitName(U())} no grīdas` : ''}</span>`;
    drawThumb($('canvas', preview), def, false);
    preview.hidden = false;
    const ws = $('.workspace').getBoundingClientRect(), r = row.getBoundingClientRect(), f = fly.getBoundingClientRect();
    preview.style.left = `${f.right - ws.left + 6}px`;
    preview.style.top = `${Math.max(0, Math.min(r.top - ws.top - 40, ws.height - 200))}px`;
  }

  // ---------- rīka aktivizēšana ----------
  function activate(spec0, rowIndex) {
    const spec = JSON.parse(JSON.stringify(spec0));
    // Pēc izvēles josla sakļaujas, lai konfigurācijas panelis un plāns būtu sasniedzami
    if (bar.matches(':hover')) bar.classList.add('rest');
    active = { spec, row: rowIndex };
    switch (spec.t) {
      case 'wall': editor.setTool('wall', { spec: spec.material || spec.kind || spec.thickness ? spec : null }); break;
      case 'rect': editor.setTool('rect', { spec }); break;
      case 'opening': editor.setTool('opening', { spec }); break;
      case 'item': editor.setTool('place', { kind: spec.item, over: {} }); break;
      case 'preset': editor.setTool('place', { preset: spec.entry }); break;
      case 'line': editor.setTool('line', { spec }); break;
      case 'zone': editor.setTool('zone', { spec }); break;
      case 'demolish': editor.setTool('demolish', { target: spec.target }); break;
      case 'undemolish': editor.setTool('undemolish'); break;
      case 'finish': editor.setTool('finish', { spec }); break;
      case 'remove': editor.setTool('remove', { spec }); break;
      case 'shield': onShield(spec); break;
      default: break;
    }
    if (spec.t !== 'shield') status?.(`${spec.name}. ${editor.canvas.dataset.tool === 'select' ? '' : ''}`);
    showConfig();
    sync();
  }

  function sync() {
    const tool = editor.tool;
    if (tool === 'select') active = null;
    $$('.lb-row[data-i]', bar).forEach((b) => b.classList.toggle('active', !!active && active.row === +b.dataset.i));
    $('[data-lib]', bar)?.classList.toggle('active', active?.row === 'lib');
    $$('.lb-row[data-custom]', bar).forEach((b) => b.classList.toggle('active', tool === b.dataset.custom || (active?.row === 'c-zone' && b.dataset.custom === 'zone')));
    if (tool === 'select' || !active) cfg.hidden = true;
  }

  // ---------- KONFIGURĀCIJA ----------
  // Visi konfigurācijas skaitļi ir garumi: glabājas cm, rādās izvēlētajās vienībās.
  const numField = (label, key, value) => `<label class="cfg-field"><span>${label}</span><input type="number" inputmode="decimal" data-k="${key}" value="${value == null ? '' : inputValue(value, U())}" step="${unitStep(U())}"><em>${unitName(U())}</em></label>`;

  function showConfig() {
    if (!active) {
      cfg.hidden = true;
      return;
    }
    const spec = editor.state.spec || active.spec;
    let h = '';
    const s = editor.settings;
    if (active.spec.t === 'wall' || active.spec.t === 'rect') {
      const fixed = !!editor.state.spec;
      const matId = fixed ? spec.material : s.wallMaterial;
      const mat = wallMaterial(matId);
      const t = fixed ? spec.thickness ?? mat?.def : s.wallThickness;
      const presets = mat?.thick?.length ? mat.thick : [5, 8, 10, 12, 15, 20];
      h += `<div class="cfg-thick"><span>Biezums:</span><div class="cfg-step"><button type="button" data-step="-1" aria-label="Mazāk">−</button><input type="number" inputmode="decimal" id="cfgThick" value="${inputValue(t, U())}" step="${unitStep(U())}"><em>${unitName(U())}</em><button type="button" data-step="1" aria-label="Vairāk">+</button></div></div>
        <div class="cfg-presets">${presets.map((p) => `<button type="button" data-preset="${p}" class="${+p === +t ? 'on' : ''}">${L(p)}</button>`).join('')}</div>
        <label class="cfg-field wide"><span>Materiāli:</span><select id="cfgMat">${WALL_MATERIALS.map((m) => `<option value="${m.id}" ${m.id === matId ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
        <canvas class="cfg-swatch" width="180" height="26"></canvas>`;
      if (!fixed) h += `<div class="cfg-colors">${['white', 'grey', 'black'].map((c) => `<button type="button" class="dot ${c} ${(s.wallColor || 'white') === c ? 'on' : ''}" data-color="${c}" aria-label="${c}"></button>`).join('')}</div>`;
    } else if (active.spec.t === 'opening') {
      if (spec.variant === 'windoor') {
        h += numField('Loga platums:', 'windowWidth', spec.windowWidth) + numField('Loga augstums:', 'windowHeight', spec.windowHeight)
          + numField('Durvju platums:', 'doorWidth', spec.doorWidth) + numField('Durvju augstums:', 'height', spec.height) + numField('Augstums no grīdas:', 'windowSill', spec.windowSill)
          + `<label class="cfg-field wide"><span>Durvis:</span><select data-k="hinge"><option value="0" ${!spec.hinge ? 'selected' : ''}>Kreisās</option><option value="1" ${spec.hinge ? 'selected' : ''}>Labās</option></select></label>`;
      } else if (spec.type === 'window') {
        h += numField('Loga platums:', 'width', spec.width) + numField('Loga augstums:', 'height', spec.height) + numField('Augstums no grīdas:', 'sill', spec.sill);
      } else {
        h += numField('Platums:', 'width', spec.width) + numField('Augstums:', 'height', spec.height);
      }
    } else if (active.spec.t === 'item') {
      const def = byKind(active.spec.item);
      const o = editor.state.over || {};
      if (active.spec.item === 'column') h += numField('Garums:', 'w', o.w ?? def.w) + numField('Platums:', 'd', o.d ?? def.d);
      else h += numField('Garums:', 'w', o.w ?? def.w) + numField('Platums:', 'd', o.d ?? def.d) + numField('Augstums:', 'h', o.h ?? def.h);
    } else if (active.spec.t === 'line') {
      const lt = LINE_TYPES[spec.line] || {};
      if (spec.line === 'beam') h += numField('Biezums:', 'width', spec.width ?? 20) + numField('Augstums:', 'height', spec.height ?? 30);
      else if (lt.duct) {
        h += `<label class="cfg-field wide"><span>Caurules tips:</span><select data-k="round"><option value="0" ${!spec.round ? 'selected' : ''}>Plakana</option><option value="1" ${spec.round ? 'selected' : ''}>Apaļa</option></select></label>`
          + numField('Platums:', 'width', spec.width ?? 12) + numField('Augstums:', 'height', spec.height ?? 6)
          + `<div class="cfg-presets wide">${[[20.4, 6, 0], [12, 6, 0], [10, 5.5, 0], [10, 10, 1], [12.5, 12.5, 1], [15, 15, 1], [16, 16, 1]].map(([w, hh, r]) => `<button type="button" data-duct="${w}|${hh}|${r}">${r ? `Ø${L(w)}` : `${L(w)} × ${L(hh)}`}</button>`).join('')}</div>`;
      } else {
        h += `<p class="cfg-note"><i class="cfg-line" style="--c:${lt.color || '#d93025'}"></i>${esc(spec.label || lt.name || spec.name)}</p>
          <div class="cfg-seg"><span>Zīmēšanas veids:</span><button type="button" class="on">līnijas</button></div>`;
      }
    } else if (active.spec.t === 'zone') {
      const z = ZONE_TYPES[spec.zone] || {};
      h += `<p class="cfg-note"><i class="cfg-sw" style="--c:${z.fill || '#fff'};--b:${z.stroke || '#333'}"></i>${esc(z.name || spec.name)}</p>
        <div class="cfg-seg"><span>Zīmēšanas veids:</span><button type="button" data-mode="rect" class="${spec.mode !== 'lines' ? 'on' : ''}">taisnstūris</button><button type="button" data-mode="lines" class="${spec.mode === 'lines' ? 'on' : ''}">līnijas</button></div>`;
    } else if (active.spec.t === 'finish') {
      const fd = FINISHES[spec.target]?.[spec.value];
      h += `<p class="cfg-note"><i class="cfg-sw" style="--c:${fd?.color || '#ccc'};--b:#666"></i>${esc(fd?.name || spec.name)}</p>
        <p class="cfg-hint">${['wall', 'waterWall', 'insulation', 'plasterWall'].includes(spec.target) ? 'Klikšķini pie sienas — apdare tiks uzlikta šai sienas pusei. Klikšķis telpas vidū — visām telpas sienām.' : 'Klikšķini telpā, lai piešķirtu.'}</p>`;
    } else {
      cfg.hidden = true;
      return;
    }
    cfg.innerHTML = `<div class="cfg-head">Konfigurācija</div><div class="cfg-body">${h}</div><p class="cfg-off">Lai <b>izslēgtu</b> rīku, spied <b>Esc</b> vai peles labo pogu.</p>`;
    cfg.hidden = false;
    bindConfig();
  }

  function bindConfig() {
    const s = editor.settings;
    const fixedWall = (active.spec.t === 'wall' || active.spec.t === 'rect') && !!editor.state.spec;
    const setThick = (v) => {
      v = Math.max(0.5, Math.round(v * 10) / 10);
      if (fixedWall) editor.state.spec.thickness = v;
      else s.wallThickness = v;
      showConfig();
      editor.requestRender();
    };
    $$('[data-step]', cfg).forEach((b) => b.addEventListener('click', () => setThick(fromUnit(+$('#cfgThick').value + b.dataset.step * unitNudge(U()), U()))));
    $('#cfgThick', cfg)?.addEventListener('change', (e) => setThick(fromUnit(parseFloat(e.target.value) || unitNudge(U()), U())));
    $$('[data-preset]', cfg).forEach((b) => b.addEventListener('click', () => setThick(parseFloat(b.dataset.preset))));
    $('#cfgMat', cfg)?.addEventListener('change', (e) => {
      const m = wallMaterial(e.target.value);
      if (fixedWall) Object.assign(editor.state.spec, { material: m.id, thickness: m.def });
      else Object.assign(s, { wallMaterial: m.id, wallThickness: m.def });
      showConfig();
    });
    const sw = $('.cfg-swatch', cfg);
    if (sw) drawMaterialSwatch(sw, wallMaterial($('#cfgMat', cfg).value) || WALL_MATERIALS[0]);
    $$('[data-color]', cfg).forEach((b) => b.addEventListener('click', () => {
      s.wallColor = b.dataset.color;
      showConfig();
    }));
    $$('input[data-k], select[data-k]', cfg).forEach((inp) => inp.addEventListener('change', () => {
      const k = inp.dataset.k, v = inp.tagName === 'SELECT' ? inp.value === '1' : fromUnit(parseFloat(inp.value), U());
      if (inp.tagName !== 'SELECT' && !Number.isFinite(v)) return;
      if (active.spec.t === 'item') {
        editor.state.over = { ...(editor.state.over || {}), [k]: v };
        editor.state.ghost = null;
      } else {
        editor.state.spec[k] = v;
        if (active.spec.t === 'opening' && editor.state.spec.variant === 'windoor') {
          const sp = editor.state.spec;
          sp.width = (sp.windowWidth || 130) + (sp.doorWidth || 80);
        }
      }
    }));
    $$('[data-duct]', cfg).forEach((b) => b.addEventListener('click', () => {
      const [w, hh, r] = b.dataset.duct.split('|');
      Object.assign(editor.state.spec, { width: +w, height: +hh, round: r === '1' });
      showConfig();
    }));
    $$('[data-mode]', cfg).forEach((b) => b.addEventListener('click', () => {
      editor.state.spec.mode = b.dataset.mode;
      showConfig();
    }));
  }

  return { render, sync, closeFly, activate, showConfig, isOpen: () => !fly.hidden, refresh: () => stage && render(stage) };
}
