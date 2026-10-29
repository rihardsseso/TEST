// Darba stadijas: katra rāda savus rīkus un katalogu, pārējais plānā ir fonā.
// Secība atbilst remonta gaitai — no esošās situācijas līdz elektroinstalācijai.

export const STAGES = [
  { id: 'base', name: 'Pamatplāns', tools: ['select', 'wall', 'rect', 'door', 'window', 'dim', 'text'], cats: ['building'], edit: ['walls', 'openings'], dims: true },
  { id: 'demolish', name: 'Demontāža', tools: ['select', 'demolish', 'dim', 'text'], cats: [], edit: ['walls'], dims: true },
  { id: 'partitions', name: 'Starpsienas', tools: ['select', 'wall', 'rect', 'door', 'window', 'dim', 'text'], cats: [], edit: ['walls', 'openings'], dims: true, newWalls: true },
  { id: 'rooms', name: 'Telpas', tools: ['select', 'dim', 'text'], cats: [], edit: ['rooms'], dims: true, roomFill: true },
  { id: 'heating', name: 'Apkure', tools: ['select'], cats: ['heating'] },
  { id: 'furniture', name: 'Mēbeles', tools: ['select'], cats: ['living', 'bedroom', 'kitchen', 'other'] },
  { id: 'plumbing', name: 'Santehnika', tools: ['select'], cats: ['bath'] },
  { id: 'water', name: 'Ūdensapgāde', tools: ['select'], cats: ['water'] },
  { id: 'sockets', name: 'Rozetes', tools: ['select'], cats: ['sockets'], wires: 'faded' },
  { id: 'switches', name: 'Slēdži', tools: ['select'], cats: ['switches'], wires: 'faded' },
  { id: 'lighting', name: 'Apgaismojums', tools: ['select'], cats: ['lighting'], wires: 'faded' },
  { id: 'wiring', name: 'Elektroinstalācija', tools: ['select', 'wire'], cats: ['wiring'], wires: 'edit', show: ['sockets', 'switches', 'lighting'] },
];

export const stageById = (id) => STAGES.find((s) => s.id === id) || STAGES[0];

const BUILD_STAGES = new Set(['base', 'demolish', 'partitions']);

/**
 * Kā priekšmets jāzīmē šajā stadijā: 'active' (rediģējams), 'shown' (pilnā krāsā, nerediģējams),
 * 'faded' (fonā) vai 'hidden'.
 */
export function itemMode(stage, cat) {
  if (!stage) return 'active';
  if (stage.cats.includes(cat)) return 'active';
  if (cat === 'building') return 'shown';
  if (BUILD_STAGES.has(stage.id)) return 'hidden';
  if (stage.show?.includes(cat)) return 'shown';
  return 'faded';
}

/**
 * Sienas statuss: 'existing' (esoša), 'demolish' (nojaucama), 'new' (jauna starpsiena).
 * Pamatplānā rāda esošo situāciju, demontāžā — atzīmētās nojaucamās, vēlāk — jauno situāciju.
 */
export function wallMode(stage, wall) {
  const st = wall.status || 'existing';
  if (!stage) return st === 'demolish' ? 'hidden' : 'normal';
  if (stage.id === 'base') return st === 'new' ? 'hidden' : 'normal';
  if (stage.id === 'demolish') return st === 'new' ? 'hidden' : st === 'demolish' ? 'demolish' : 'normal';
  if (stage.id === 'partitions') return st === 'demolish' ? 'hidden' : st === 'new' ? 'new' : 'normal';
  return st === 'demolish' ? 'hidden' : 'normal';
}

/** Sienas, kas pastāv gala situācijā (telpām, 3D un aprēķiniem). */
export const finalWalls = (floor) => floor.walls.filter((w) => w.status !== 'demolish');
