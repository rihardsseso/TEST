// Sadales skapja konstruktors: DIN sliedes ar moduļiem, kopnes un savienojuma vadi.
import { uid } from './model.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const DIN = 34; // 1 DIN moduļa platums ekrānā, px
const KIND_COLORS = { breaker: '#f4f6f8', relay: '#fff7e6', other: '#eef4fb', separator: '#d9d9d9', busbar: '#f3e3c8', busbarN: '#dbe8fb' };
const KIND_NAMES = { breaker: 'Automātslēdzis', relay: 'Relejs / aizsardzība', other: 'Spaile / cits', separator: 'Atdalītājs', busbar: 'Kopne', busbarN: 'Neitrāles kopne' };

export function createShield({ store, toast }) {
  const view = $('#shieldView');
  let selected = null, wireMode = null;

  const data = () => {
    const f = store.floor;
    f.shield = f.shield || { rails: [], wires: [] };
    return f.shield;
  };
  const railWidth = (r) => (r.auto !== false ? Math.max(12, Math.ceil(r.modules.reduce((s, m) => s + m.size, 0))) : r.din);

  function render() {
    const d = data();
    const maxDin = Math.max(12, ...d.rails.map(railWidth));
    let h = `<div class="sh-wrap"><div class="sh-box" style="width:${maxDin * DIN + 60}px">`;
    if (!d.rails.length) h += '<p class="sh-empty">Sadalne ir tukša. Kreisajā joslā izvēlies „Pievienot DIN sliedi”, tad pievieno automātslēdžus un citus moduļus.</p>';
    d.rails.forEach((r, ri) => {
      const w = railWidth(r);
      h += `<div class="sh-rail ${selected?.rail === r.id && !selected.module ? 'sel' : ''}" data-rail="${r.id}" style="width:${w * DIN}px"><span class="sh-rail-no">${ri + 1}</span><div class="sh-mods">`;
      for (const m of r.modules) {
        const isSel = selected?.module === m.id, wiring = wireMode?.from === m.id;
        h += `<button type="button" class="sh-mod k-${m.kind} ${isSel ? 'sel' : ''} ${wiring ? 'wiring' : ''}" data-mod="${m.id}" style="width:${m.size * DIN}px;background:${KIND_COLORS[m.kind] || '#fff'}" title="${esc(m.name)}">
          ${m.kind === 'separator' ? '' : `<b>${esc(m.rating || (m.kind === 'busbar' || m.kind === 'busbarN' ? '' : m.poles + 'P'))}</b><span>${esc(m.label || m.name)}</span>${m.group ? `<i>${esc(m.group)}</i>` : ''}`}</button>`;
      }
      h += `</div><div class="sh-free" style="width:${Math.max(0, w - r.modules.reduce((s, m) => s + m.size, 0)) * DIN}px"></div></div>`;
    });
    h += `<svg class="sh-wires" xmlns="http://www.w3.org/2000/svg"></svg></div>`;
    h += `<aside class="sh-side">${sidePanel()}</aside></div>`;
    view.innerHTML = h;
    bind();
    requestAnimationFrame(drawWires);
  }

  function sidePanel() {
    const d = data();
    if (wireMode) return `<h3>Vads</h3><p>Klikšķini uz <b>${wireMode.from ? 'otrā' : 'pirmā'}</b> moduļa, ko savienot.</p><button type="button" class="btn small" data-act="cancelWire">Atcelt</button>`;
    if (selected?.module) {
      const r = d.rails.find((x) => x.id === selected.rail), m = r?.modules.find((x) => x.id === selected.module);
      if (!m) return '';
      const opt = (vals, cur) => vals.map(([v, n]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${n}</option>`).join('');
      return `<h3>${esc(KIND_NAMES[m.kind] || 'Modulis')}</h3>
        <label class="field wide"><span>Grupas numurs</span><input data-mk="group" value="${esc(m.group || '')}"></label>
        <label class="field wide"><span>Moduļa izmērs</span><select data-mk="size">${opt([[0.5, '0,5 DIN'], [1, '1 DIN'], [2, '2 DIN'], [3, '3 DIN'], [4, '4 DIN'], [5, '5 DIN']], m.size)}</select></label>
        <label class="field wide"><span>Moduļa tips</span><select data-mk="kind">${opt([['breaker', 'Automātslēdzis'], ['relay', 'Relejs'], ['other', 'Spaile'], ['separator', 'Atdalītājs']], m.kind)}</select></label>
        <label class="field wide"><span>Polu skaits</span><select data-mk="poles">${opt([[1, '1'], [2, '2'], [3, '3'], [4, '4']], m.poles)}</select></label>
        <label class="field wide"><span>Nominālvērtība</span><input data-mk="rating" value="${esc(m.rating || '')}" placeholder="piem., C16"></label>
        <label class="field wide"><span>Nosaukums</span><input data-mk="label" value="${esc(m.label || m.name)}"></label>
        <label class="field wide"><span>Komentārs</span><input data-mk="comment" value="${esc(m.comment || '')}" placeholder="piem., virtuves rozetes"></label>
        <div class="row"><button type="button" class="btn small" data-act="copy">Izveidot kopiju</button><button type="button" class="btn small danger" data-act="delMod">Dzēst</button></div>`;
    }
    if (selected?.rail) {
      const r = d.rails.find((x) => x.id === selected.rail);
      if (!r) return '';
      return `<h3>DIN sliede</h3>
        <label class="check"><input type="checkbox" data-rk="auto" ${r.auto !== false ? 'checked' : ''}><span>Automātisks platums</span></label>
        <label class="field wide"><span>Platums: <b>${railWidth(r)} DIN</b></span><input type="range" min="12" max="48" step="1" data-rk="din" value="${railWidth(r)}" ${r.auto !== false ? 'disabled' : ''}></label>
        <p class="hint">Jauni moduļi tiek pievienoti atlasītajai sliedei.</p>
        <div class="row"><button type="button" class="btn small danger" data-act="delRail">Dzēst sliedi</button></div>`;
    }
    const counts = {};
    for (const r of d.rails) for (const m of r.modules) if (m.kind !== 'separator') counts[m.label || m.name] = (counts[m.label || m.name] || 0) + 1;
    const rows = Object.entries(counts).map(([n, c]) => `<tr><td>${esc(n)}</td><td class="n">${c}</td></tr>`).join('');
    return `<h3>Sadalnes saraksts</h3>${rows ? `<table class="data"><tbody>${rows}</tbody></table>` : '<p class="hint">Vēl nav moduļu.</p>'}
      <p class="hint">Sliedes: ${d.rails.length} · vadi: ${d.wires.length}</p>`;
  }

  function bind() {
    const d = data();
    $$('.sh-mod', view).forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const rail = d.rails.find((r) => r.modules.some((m) => m.id === b.dataset.mod));
      if (wireMode) {
        if (!wireMode.from) wireMode.from = b.dataset.mod;
        else if (wireMode.from !== b.dataset.mod) {
          const w = { id: uid(), from: wireMode.from, to: b.dataset.mod, color: wireMode.color };
          store.commit(() => d.wires.push(w));
          wireMode = { color: wireMode.color };
        }
        return render();
      }
      selected = { rail: rail.id, module: b.dataset.mod };
      render();
    }));
    $$('.sh-rail', view).forEach((el) => el.addEventListener('click', () => {
      if (wireMode) return;
      selected = { rail: el.dataset.rail };
      render();
    }));
    const sel = () => {
      const r = d.rails.find((x) => x.id === selected?.rail);
      return { r, m: r?.modules.find((x) => x.id === selected?.module) };
    };
    $$('[data-mk]', view).forEach((inp) => inp.addEventListener('change', () => {
      const { m } = sel();
      if (!m) return;
      const k = inp.dataset.mk;
      store.commit(() => { m[k] = ['size', 'poles'].includes(k) ? parseFloat(inp.value) : inp.value; });
      render();
    }));
    $$('[data-rk]', view).forEach((inp) => inp.addEventListener(inp.type === 'range' ? 'input' : 'change', () => {
      const { r } = sel();
      if (!r) return;
      store.commit(() => {
        if (inp.dataset.rk === 'auto') r.auto = inp.checked;
        else r.din = +inp.value;
      });
      render();
    }));
    $$('[data-act]', view).forEach((b) => b.addEventListener('click', () => {
      const { r, m } = sel();
      switch (b.dataset.act) {
        case 'delMod': store.commit(() => { r.modules = r.modules.filter((x) => x !== m); d.wires = d.wires.filter((w) => w.from !== m.id && w.to !== m.id); }); selected = { rail: r.id }; break;
        case 'copy': store.commit(() => r.modules.splice(r.modules.indexOf(m) + 1, 0, { ...m, id: uid() })); break;
        case 'delRail': store.commit(() => { const ids = new Set(r.modules.map((x) => x.id)); d.rails = d.rails.filter((x) => x !== r); d.wires = d.wires.filter((w) => !ids.has(w.from) && !ids.has(w.to)); }); selected = null; break;
        case 'cancelWire': wireMode = null; break;
      }
      render();
    }));
  }

  function drawWires() {
    const svg = $('.sh-wires', view), box = $('.sh-box', view);
    if (!svg || !box) return;
    const bb = box.getBoundingClientRect();
    svg.setAttribute('width', bb.width);
    svg.setAttribute('height', bb.height);
    const center = (id) => {
      const el = $(`[data-mod="${id}"]`, view);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left - bb.left + r.width / 2, y: r.bottom - bb.top - 4 };
    };
    svg.innerHTML = data().wires.map((w, i) => {
      const a = center(w.from), b = center(w.to);
      if (!a || !b) return '';
      const dy = 14 + (i % 4) * 6;
      return `<path d="M${a.x} ${a.y} V${a.y + dy} H${b.x} V${b.y}" fill="none" stroke="${w.color}" stroke-width="3" stroke-linejoin="round"/>`;
    }).join('');
  }

  /** Rīks no kreisās joslas. */
  function action(spec) {
    const d = data();
    const targetRail = () => {
      let r = d.rails.find((x) => x.id === selected?.rail) || d.rails[d.rails.length - 1];
      if (!r) {
        r = { id: uid(), din: 12, auto: true, modules: [] };
        d.rails.push(r);
      }
      return r;
    };
    switch (spec.action) {
      case 'rail': {
        const r = { id: uid(), din: 12, auto: true, modules: [] };
        store.commit(() => d.rails.push(r));
        selected = { rail: r.id };
        break;
      }
      case 'module': {
        store.commit(() => {
          const r = targetRail();
          const m = { id: uid(), ...spec.module, rating: spec.module.kind === 'breaker' ? 'C16' : '' };
          r.modules.push(m);
          selected = { rail: r.id, module: m.id };
        });
        break;
      }
      case 'separator': store.commit(() => targetRail().modules.push({ id: uid(), name: 'Atdalītājs', kind: 'separator', size: 0.5, poles: 1 })); break;
      case 'busbar': case 'busbarN': store.commit(() => targetRail().modules.push({ id: uid(), name: spec.action === 'busbar' ? 'Kopne' : 'Neitrāles kopne', kind: spec.action, size: 4, poles: 1 })); break;
      case 'wire':
        if (!d.rails.some((r) => r.modules.length >= 2)) toast?.('Vispirms pievieno vismaz divus moduļus.');
        else wireMode = { color: spec.color };
        break;
    }
    render();
  }

  return { render, action, clearSelection: () => { selected = null; wireMode = null; } };
}
