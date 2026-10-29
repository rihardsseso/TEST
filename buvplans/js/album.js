// PDF albums: lapas ar plāniem, sienu skatiem, aprēķiniem un specifikāciju, noformētas ar zīmoga lauku.
import { renderFloorImage, THEME } from './draw2d.js';
import { stageById } from './stages.js';
import { byKind } from './catalog.js';
import { floorStats, specification, openingSchedule, fmt } from './calc.js';
import { roomElevations, elevationSVG } from './elevations.js';
import { statusLabel } from './model.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const PRINT_THEME = THEME;

export const SHEET_TYPES = [
  { id: 'cover', name: 'Titullapa' },
  { id: 'plans', name: 'Plāni pa stadijām' },
  { id: 'rooms', name: 'Telpu eksplikācija' },
  { id: 'visual', name: '3D vizualizācija' },
  { id: 'elev', name: 'Sienu skati' },
  { id: 'spec', name: 'Specifikācija' },
];

/** Uzbūvē albuma lapu HTML. `enabled` — ieslēgto lapu tipu kopa, `snapshot()` — 3D attēla funkcija. */
export function buildAlbum(project, { enabled, units = 'cm', snapshot }) {
  const sheets = [];
  const floors = project.floors;
  const date = new Date().toLocaleDateString('lv-LV');
  if (enabled.has('plans')) {
    const cats = (f, list) => f.items.some((it) => list.includes(byKind(it.kind)?.cat));
    for (const f of floors) {
      const plans = [
        ['base', 'esošā situācija', true],
        ['demolish', 'demontāžas plāns', f.walls.some((w) => w.status === 'demolish')],
        ['partitions', 'starpsienu plāns', f.walls.some((w) => w.status === 'new')],
        ['rooms', 'grīdu segumi', f.rooms.length > 0],
        ['furniture', 'mēbeļu plāns', cats(f, ['living', 'bedroom', 'kitchen', 'other'])],
        ['water', 'santehnika un ūdensapgāde', cats(f, ['bath', 'water'])],
        ['heating', 'apkures plāns', cats(f, ['heating'])],
        ['wiring', 'elektrības plāns', cats(f, ['sockets', 'switches', 'lighting', 'wiring']) || f.wires?.length],
      ];
      for (const [id, title, has] of plans) {
        if (!has) continue;
        const stage = id === 'water' ? { ...stageById('water'), show: ['bath'] } : stageById(id);
        const img = renderFloorImage(f, PRINT_THEME, { width: 1500, height: 1000, units, stage });
        sheets.push({ title: `${f.name} — ${title}`, body: `<img class="sheet-img" src="${img}" alt="${esc(f.name)} ${title}">`, note: `Izmēri ${units === 'mm' ? 'mm' : units === 'm' ? 'm' : 'cm'}` });
      }
    }
  }
  if (enabled.has('rooms')) {
    for (const f of floors) {
      const st = floorStats(f);
      const rows = st.rooms.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}</td><td class="n">${fmt(r.area)}</td><td class="n">${fmt(r.perimeter)}</td><td class="n">${fmt(r.height)}</td><td class="n">${fmt(r.wallNet)}</td><td class="n">${fmt(r.baseboard)}</td><td>${esc(r.floorFinish)}</td><td>${esc(r.wallFinish)}</td></tr>`).join('');
      sheets.push({
        title: `${f.name} — telpu eksplikācija`,
        body: `<table class="sheet-table"><thead><tr><th>Nr.</th><th>Telpa</th><th class="n">Laukums, m²</th><th class="n">Perimetrs, m</th><th class="n">Augstums, m</th><th class="n">Sienas, m²</th><th class="n">Grīdlīste, m</th><th>Grīda</th><th>Sienas</th></tr></thead><tbody>${rows}</tbody>
        <tfoot><tr><td></td><td>Kopā</td><td class="n">${fmt(st.totals.area)}</td><td></td><td></td><td class="n">${fmt(st.totals.wallNet)}</td><td class="n">${fmt(st.totals.baseboard)}</td><td></td><td></td></tr></tfoot></table>
        <dl class="sheet-facts"><div><dt>Sienu garums</dt><dd>${fmt(st.totals.wallLength)} m</dd></div><div><dt>Sienu apjoms</dt><dd>${fmt(st.totals.wallVolume)} m³</dd></div><div><dt>Durvis / logi</dt><dd>${st.totals.doors} / ${st.totals.windows}</dd></div><div><dt>Rozetes / slēdži / gaismekļi</dt><dd>${st.totals.sockets} / ${st.totals.switches} / ${st.totals.lights}</dd></div></dl>`,
      });
    }
  }
  if (enabled.has('visual') && snapshot) {
    try {
      const img = snapshot();
      if (img) sheets.push({ title: '3D vizualizācija', body: `<img class="sheet-img" src="${img}" alt="3D skats">` });
    } catch { /* WebGL nav pieejams */ }
  }
  if (enabled.has('elev')) {
    for (const f of floors) {
      for (const r of f.rooms) {
        const els = roomElevations(f, r);
        if (!els.length) continue;
        const cards = els.map((e) => `<figure class="sheet-elev"><figcaption>Skats ${e.label}</figcaption>${elevationSVG(e, units)}</figure>`).join('');
        sheets.push({ title: `${r.name} — sienu skati`, body: `<div class="sheet-elev-grid n${Math.min(els.length, 6)}">${cards}</div>`, note: f.name });
      }
    }
  }
  if (enabled.has('spec')) {
    for (const f of floors) {
      const spec = specification(f);
      const ops = openingSchedule(f);
      const srows = spec.map((s, i) => `<tr><td>${i + 1}</td><td>${esc(s.name)}</td><td class="n">${s.w}×${s.d}×${s.h}</td><td class="n">${s.count}</td></tr>`).join('');
      const orows = ops.map((o, i) => `<tr><td>${i + 1}</td><td>${o.type}</td><td class="n">${o.width}×${o.height}</td><td class="n">${o.sill}</td></tr>`).join('');
      sheets.push({
        title: `${f.name} — specifikācija`,
        body: `<div class="sheet-cols"><table class="sheet-table"><thead><tr><th>Nr.</th><th>Priekšmets</th><th class="n">Izmēri, cm</th><th class="n">Skaits</th></tr></thead><tbody>${srows}</tbody></table>
        <table class="sheet-table"><thead><tr><th>Nr.</th><th>Aile</th><th class="n">P×A, cm</th><th class="n">Palodze, cm</th></tr></thead><tbody>${orows}</tbody></table></div>`,
      });
    }
  }
  const total = sheets.length + (enabled.has('cover') ? 1 : 0);
  let n = 0;
  const stamp = (title) => {
    n += 1;
    return `<div class="stamp"><div class="stamp-proj"><span>Projekts</span><b>${esc(project.name)}</b></div><div><span>Lapa</span><b>${esc(title)}</b></div><div><span>Autors</span><b>${esc(project.author || '—')}</b></div><div><span>Datums</span><b>${date}</b></div><div class="stamp-no"><span>Lapa</span><b>${n} / ${total}</b></div></div>`;
  };
  let html = '';
  if (enabled.has('cover')) {
    const list = sheets.map((s, i) => `<li><span>${i + 2}</span>${esc(s.title)}</li>`).join('');
    const area = floors.filter((f) => !f.variant).reduce((s, f) => s + floorStats(f).totals.area, 0);
    html += `<section class="sheet sheet-cover"><div class="cover-main"><p class="cover-kicker">Plānošanas risinājums · ${esc(statusLabel(project.status))}</p><h1>${esc(project.name)}</h1>
      <p class="cover-addr">${esc(project.address || '')}</p><dl class="cover-facts"><div><dt>Stāvi / varianti</dt><dd>${floors.length}</dd></div><div><dt>Kopējā platība</dt><dd>${fmt(area)} m²</dd></div><div><dt>Autors</dt><dd>${esc(project.author || '—')}</dd></div></dl></div>
      <div class="cover-list"><h2>Saturs</h2><ol>${list}</ol></div>${stamp('Titullapa')}</section>`;
  }
  for (const s of sheets) {
    html += `<section class="sheet"><header class="sheet-head"><h2>${esc(s.title)}</h2>${s.note ? `<span>${esc(s.note)}</span>` : ''}</header><div class="sheet-body">${s.body}</div>${stamp(s.title)}</section>`;
  }
  return { html, count: total };
}
