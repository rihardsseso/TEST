// Projektu glabāšana pārlūkā (localStorage). Visas darbības ir drošas arī tad, ja krātuve nav pieejama.
const INDEX = 'buvplans.index';
const PREFIX = 'buvplans.p.';

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function listProjects() {
  return read(INDEX, []).sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));
}

export function loadProject(id) {
  return read(PREFIX + id, null);
}

export function saveProject(p) {
  const ok = write(PREFIX + p.id, p);
  const idx = read(INDEX, []).filter((x) => x.id !== p.id);
  const area = p.floors.reduce((s, f) => s + (f.variant ? 0 : f.rooms.reduce((q, r) => q + roomArea(r.points), 0)), 0);
  idx.push({ id: p.id, name: p.name, status: p.status, folder: p.folder || '', updated: p.updated, floors: p.floors.length, area: area / 1e4 });
  return write(INDEX, idx) && ok;
}

export function deleteProject(id) {
  try {
    localStorage.removeItem(PREFIX + id);
  } catch { /* nav krātuves */ }
  write(INDEX, read(INDEX, []).filter((x) => x.id !== id));
}

export function lastProjectId() {
  return read('buvplans.last', null);
}

export function setLastProject(id) {
  write('buvplans.last', id);
}

export function getPref(key, fallback) {
  return read(`buvplans.pref.${key}`, fallback);
}

export function setPref(key, value) {
  write(`buvplans.pref.${key}`, value);
}

function roomArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s / 2);
}

/** Pārbauda importēta JSON struktūru, lai bojāts fails nesalauztu redaktoru. */
export function validateProject(p) {
  if (!p || typeof p !== 'object' || !Array.isArray(p.floors) || !p.floors.length) throw new Error('Failā nav Ēku plānošanas projekta.');
  for (const f of p.floors) {
    for (const k of ['walls', 'openings', 'rooms', 'items', 'dims', 'labels', 'lines', 'zones']) if (!Array.isArray(f[k])) f[k] = [];
    // Vecie elektrības vadi kļūst par kabeļu līnijām elektroinstalācijas lapā.
    if (Array.isArray(f.wires)) {
      for (const w of f.wires) f.lines.push({ id: w.id, type: w.color === '#2e9b3f' ? 'lowcable' : 'cable', points: w.points, layer: 'cables', color: w.color });
      delete f.wires;
    }
    if (typeof f.height !== 'number') f.height = 270;
    if (typeof f.elevation !== 'number') f.elevation = 0;
    if (!f.id) f.id = Math.random().toString(36).slice(2, 10);
    if (!f.group) f.group = f.id;
    if (!f.name) f.name = 'Stāvs';
  }
  if (!p.id) p.id = Math.random().toString(36).slice(2, 10);
  if (!p.name) p.name = 'Importēts projekts';
  return p;
}

// ---------- lietotāja bibliotēka („Mana bibliotēka”) ----------
// Ieraksts: { id, name, stage, items: [{ kind, w, d, h, ..., dx, dy }] } — glabājas iestatījumos, nevis projektā.
export function getLibrary() {
  const lib = getPref('library', []);
  return Array.isArray(lib) ? lib : [];
}

export function addToLibrary(entry) {
  const lib = getLibrary();
  lib.push(entry);
  setPref('library', lib);
  return lib;
}

export function removeFromLibrary(id) {
  const lib = getLibrary().filter((e) => e.id !== id);
  setPref('library', lib);
  return lib;
}

/** Bibliotēkas ieraksti konkrētai lapai. */
export const libraryFor = (stageId) => getLibrary().filter((e) => e.stage === stageId);
