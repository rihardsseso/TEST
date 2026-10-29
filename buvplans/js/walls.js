// Sienu materiāli: standarta biezumi, rasējuma šķērssvītrojums un bloku patēriņš aprēķiniem.
// block — bloka skata izmērs ar šuvi cm (garums × augstums); perM2 — gabali uz m² sienas skata.

export const WALL_MATERIALS = [
  { id: 'gas', name: 'Gāzbetona bloki', thick: [10, 15, 20, 25, 30, 37.5], def: 30, block: [60, 20], pattern: 'dots', bg: '#f3f1ea', ink: '#8a857a' },
  { id: 'clay', name: 'Keramzītbetona bloki', thick: [10, 15, 20, 25, 30], def: 25, block: [50, 20], pattern: 'circles', bg: '#efe8dc', ink: '#8b7a62' },
  { id: 'ceramic', name: 'Keramikas bloki', thick: [8, 12, 25, 30, 38, 44], def: 38, block: [25, 25], pattern: 'hatch', bg: '#fbf3ee', ink: '#9b6a55' },
  { id: 'brick', name: 'Ķieģeļu mūris', thick: [12, 25, 38, 51], def: 25, perM2: (t) => (51 * t) / 12, pattern: 'brick', bg: '#f8e7df', ink: '#a0523d' },
  { id: 'concrete', name: 'Monolītais betons', thick: [15, 20, 25, 30], def: 20, pattern: 'concrete', bg: '#e8e8e8', ink: '#5f5f5f' },
  { id: 'timber', name: 'Koka karkass', thick: [10, 15, 20, 25], def: 15, pattern: 'insulation', bg: '#fff8ea', ink: '#b08a4f' },
  { id: 'clt', name: 'Koka masīvs (CLT)', thick: [10, 12, 16, 20], def: 12, pattern: 'wood', bg: '#f1e2c6', ink: '#b88d58' },
  { id: 'drywall', name: 'Ģipškartona starpsiena', thick: [7.5, 10, 12.5, 15], def: 10, pattern: 'plain', bg: '#ffffff', ink: '#9a9a9a', partition: true },
  { id: 'gypsum', name: 'Ģipša bloki', thick: [8, 10], def: 8, block: [67, 50], pattern: 'dots', bg: '#f7f5f0', ink: '#a8a294', partition: true },
  { id: 'glass', name: 'Stikls', thick: [1, 4, 8, 12], def: 4, pattern: 'plain', bg: '#e3f1fa', ink: '#6aa3c8', partition: true },
  { id: 'slat', name: 'Līstu starpsiena', thick: [4, 6, 10], def: 6, pattern: 'wood', bg: '#f1e2c6', ink: '#b88d58', partition: true },
  { id: 'other', name: 'Cits materiāls', thick: [5, 8, 10, 12, 15, 20], def: 10, pattern: 'hatch', bg: '#ffffff', ink: '#6f6f6f' },
];

export const wallMaterial = (id) => WALL_MATERIALS.find((m) => m.id === id) || null;

/** Bloku (ķieģeļu) skaits uz m² sienas skata vai null, ja materiāls netiek skaitīts gabalos. */
export function unitsPerM2(mat, thickness) {
  if (!mat) return null;
  if (mat.perM2) return mat.perM2(thickness);
  if (mat.block) return 1e4 / (mat.block[0] * mat.block[1]);
  return null;
}

/** Zīmē materiāla šķērssvītrojuma vienību (size × size) — gan rakstam plānā, gan paraugam izvēlnē. */
export function paintMaterial(g, mat, size = 12) {
  g.fillStyle = mat.bg;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = mat.ink;
  g.fillStyle = mat.ink;
  g.lineWidth = 0.8;
  const k = size / 12;
  g.beginPath();
  switch (mat.pattern) {
    case 'dots':
      for (const [x, y] of [[2, 3], [7, 1.5], [10, 7], [4, 9], [8.5, 10.5], [1, 6.5]]) g.rect(x * k, y * k, 0.9 * k, 0.9 * k);
      g.fill();
      return;
    case 'circles':
      for (const [x, y, r] of [[3, 3, 1.6], [9, 4, 1.2], [5.5, 9, 1.4], [11, 10, 0.9]]) {
        g.moveTo((x + r) * k, y * k);
        g.arc(x * k, y * k, r * k, 0, Math.PI * 2);
      }
      break;
    case 'hatch':
      g.moveTo(-1, size + 1); g.lineTo(size + 1, -1);
      g.moveTo(-1, size / 2 + 1); g.lineTo(size / 2 + 1, -1);
      g.moveTo(size / 2 - 1, size + 1); g.lineTo(size + 1, size / 2 - 1);
      break;
    case 'brick':
      for (let i = -size; i <= size; i += 4 * k) { g.moveTo(i, size); g.lineTo(i + size, 0); }
      break;
    case 'concrete':
      g.moveTo(-1, size + 1); g.lineTo(size + 1, -1);
      g.stroke();
      g.beginPath();
      for (const [x, y] of [[3, 3], [8, 8], [9, 2.5], [2.5, 9]]) {
        g.moveTo(x * k, (y - 1) * k); g.lineTo((x + 1.2) * k, (y + 0.8) * k); g.lineTo((x - 1.2) * k, (y + 0.8) * k); g.closePath();
      }
      g.fill();
      return;
    case 'insulation':
      g.moveTo(0, 2 * k); g.lineTo(3 * k, 10 * k); g.lineTo(6 * k, 2 * k); g.lineTo(9 * k, 10 * k); g.lineTo(12 * k, 2 * k);
      break;
    case 'wood':
      g.moveTo(0, 3 * k); g.quadraticCurveTo(6 * k, 1 * k, 12 * k, 3 * k);
      g.moveTo(0, 8 * k); g.quadraticCurveTo(6 * k, 10 * k, 12 * k, 8 * k);
      break;
    default:
      return;
  }
  g.stroke();
}

/** Materiāla paraugs kā izvēlnes ikona (taisnstūris ar rakstu un kontūru). */
export function drawMaterialSwatch(cv, mat) {
  const g = cv.getContext('2d');
  const tile = document.createElement('canvas');
  tile.width = tile.height = 12;
  paintMaterial(tile.getContext('2d'), mat, 12);
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = g.createPattern(tile, 'repeat');
  const h = Math.round(cv.height * 0.5), y = Math.round((cv.height - h) / 2);
  g.fillRect(2, y, cv.width - 4, h);
  g.strokeStyle = '#2b2b2b';
  g.lineWidth = 1.5;
  g.strokeRect(2, y, cv.width - 4, h);
}
