'use strict';

// Darbvirsmas fona attēls aiz logrīka (blūra efektam).
// Caurspīdīgs logs nevar noblūrēt to, kas atrodas aiz tā, tāpēc logrīks pats zīmē Windows fona
// attēlu tieši tajā vietā, kur tas ir uz ekrāna, un noblūrē to ar CSS.

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// Windows reģistra WallpaperStyle vērtības
const STYLES = { 0: 'center', 2: 'stretch', 6: 'fit', 10: 'fill', 22: 'span' };

function regQuery(name) {
  return new Promise((resolve) => {
    execFile('reg', ['query', 'HKCU\\Control Panel\\Desktop', '/v', name], { windowsHide: true }, (err, out) => {
      if (err) return resolve(null);
      const m = String(out).match(new RegExp(`${name}\\s+REG_\\w+\\s+(.*)$`, 'mi'));
      resolve(m ? m[1].trim() : null);
    });
  });
}

// Atgriež { file, style } vai null, ja fona attēla nav (piem., vienkrāsains fons).
async function findWallpaper() {
  if (process.env.WIDGET_WALLPAPER) {
    return { file: process.env.WIDGET_WALLPAPER, style: process.env.WIDGET_WALLPAPER_STYLE || 'fill' };
  }
  if (process.platform !== 'win32') return null;
  const [file, styleRaw, tileRaw] = await Promise.all([
    regQuery('WallPaper'),
    regQuery('WallpaperStyle'),
    regQuery('TileWallpaper'),
  ]);
  const style = tileRaw === '1' ? 'tile' : STYLES[parseInt(styleRaw, 10)] || 'fill';
  const candidates = [file];
  if (process.env.APPDATA) {
    // Windows glabā pašreizējā fona kopiju arī šeit (noder, ja oriģinālais fails ir izdzēsts)
    candidates.push(path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Themes', 'TranscodedWallpaper'));
  }
  for (const f of candidates) {
    if (f && fs.existsSync(f)) return { file: f, style };
  }
  return null;
}

// Fona attēla taisnstūris ekrāna koordinātās, kā Windows to novieto monitorā.
// display/virtual: { x, y, width, height }; img: { width, height }
function wallpaperRect(style, img, display, virtual) {
  const area = style === 'span' ? virtual : display;
  let w;
  let h;
  switch (style) {
    case 'stretch':
      return { x: area.x, y: area.y, width: area.width, height: area.height };
    case 'tile':
      return { x: area.x, y: area.y, width: img.width, height: img.height, tile: true };
    case 'center':
      w = img.width;
      h = img.height;
      break;
    case 'fit': {
      const k = Math.min(area.width / img.width, area.height / img.height);
      w = img.width * k;
      h = img.height * k;
      break;
    }
    default: {
      // fill un span
      const k = Math.max(area.width / img.width, area.height / img.height);
      w = img.width * k;
      h = img.height * k;
    }
  }
  return {
    x: area.x + (area.width - w) / 2,
    y: area.y + (area.height - h) / 2,
    width: w,
    height: h,
  };
}

module.exports = { findWallpaper, wallpaperRect };
