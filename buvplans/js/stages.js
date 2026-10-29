// Darba stadijas (lapas) tādā pašā secībā un ar tādiem pašiem rīkiem kā Remplanner plānotājā.
// Katra stadija rāda savus rīkus; citās stadijās ievietotais plānā ir fonā vai paslēpts.
import { STAGE_DEFS } from './catalog-data.js';

// Būvniecības stadijas rāda tikai sienas, ailes un ēkas elementus.
const BUILD = new Set(['init', 'break_walls', 'create_walls']);

const FLAGS = {
  init: { edit: ['walls', 'openings'], dims: true },
  break_walls: { edit: ['walls', 'openings'], dims: true },
  create_walls: { edit: ['walls', 'openings'], dims: true, newWalls: true },
  rooms: { edit: ['rooms'], dims: true, roomNumbers: true },
  cables: { show: ['sockets', 'light_connections', 'light', 'shield'] },
  sockets: { show: ['cables'] },
  light_connections: { show: ['light', 'cables'] },
  light: { show: ['light_connections', 'cables'] },
  waterplan: { show: ['santeh'] },
  santeh: { show: ['waterplan'] },
  warm_floor: { show: ['floor'] },
  shield: { shield: true },
  floor: { edit: ['rooms'], dims: true, roomFill: 'floor' },
  walls: { edit: ['rooms'], dims: true, faces: 'wall' },
  ceiling: { edit: ['rooms'], roomFill: 'ceiling' },
  hydroisolation: { edit: ['rooms'], roomFill: 'waterFloor', faces: 'waterWall' },
  isolation: { edit: ['rooms'], faces: 'insulation' },
  shtukaturka: { edit: ['rooms'], faces: 'plasterWall', roomFill: 'plasterCeiling' },
  styazhka: { edit: ['rooms'], roomFill: 'screed' },
};

export const STAGES = STAGE_DEFS.map((s) => ({ ...s, ...(FLAGS[s.id] || {}), build: BUILD.has(s.id) }));

/** Lietotāja pievienotā lapa (piezīmēm, izmēriem, figūrām). */
export const customStage = (sheet) => ({ id: sheet.id, name: sheet.name, custom: true, tools: [], dims: true });

export const stageById = (id, sheets = []) => STAGES.find((s) => s.id === id) || (sheets.find((x) => x.id === id) && customStage(sheets.find((x) => x.id === id))) || STAGES[0];

/**
 * Kā objektu (priekšmetu, līniju, zonu) ar slāni `layer` zīmēt šajā stadijā:
 * 'active' (rediģējams), 'shown' (pilnā krāsā), 'faded' (fonā) vai 'hidden'.
 */
export function layerMode(stage, layer) {
  if (!stage) return 'active';
  if (layer === stage.id) return 'active';
  if (layer === 'init') return stage.build && stage.id !== 'init' ? 'shown' : stage.id === 'init' ? 'active' : 'shown';
  if (stage.build) return 'hidden';
  if (stage.show?.includes(layer)) return 'shown';
  if (stage.custom) return 'faded';
  return 'faded';
}
export const itemMode = layerMode;

/**
 * Sienas statuss: 'existing' (esoša), 'demolish' (nojaucama), 'new' (jauna starpsiena).
 * Pamatplānā rāda esošo situāciju, demontāžā — atzīmētās nojaucamās, vēlāk — jauno situāciju.
 */
export function wallMode(stage, wall) {
  const st = wall.status || 'existing';
  if (!stage) return st === 'demolish' ? 'hidden' : 'normal';
  if (stage.id === 'init') return st === 'new' ? 'hidden' : 'normal';
  if (stage.id === 'break_walls') return st === 'new' ? 'hidden' : st === 'demolish' ? 'demolish' : 'normal';
  if (stage.id === 'create_walls') return st === 'demolish' ? 'hidden' : st === 'new' ? 'new' : 'normal';
  return st === 'demolish' ? 'hidden' : 'normal';
}

/** Sienas, kas pastāv gala situācijā (telpām, 3D un aprēķiniem). */
export const finalWalls = (floor) => floor.walls.filter((w) => w.status !== 'demolish');
