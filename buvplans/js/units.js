// Mērvienības. Modelī visi garumi glabājas centimetros; plānā, paneļos, ievadē un tabulās
// tie tiek rādīti un ievadīti apakšējā joslā izvēlētajās vienībās (mm, cm, m, collas).

// k — reizinātājs no cm; step — ievadlauka solis; nudge — +/− pogas solis; dec — zīmes aiz komata.
const UNITS = {
  mm: { k: 10, step: 1, nudge: 10, dec: 1 },
  cm: { k: 1, step: 0.5, nudge: 1, dec: 1 },
  m: { k: 0.01, step: 0.01, nudge: 0.01, dec: 4 },
  in: { k: 1 / 2.54, step: 0.25, nudge: 0.5, dec: 2 },
};
const u = (units) => UNITS[units] || UNITS.cm;

export const unitName = (units) => (UNITS[units] ? units : 'cm');
export const toUnit = (cm, units) => cm * u(units).k;
export const fromUnit = (v, units) => v / u(units).k;
export const unitStep = (units) => u(units).step;
export const unitNudge = (units) => u(units).nudge;

/** Vērtība ievadlaukam: centimetri, pārrēķināti un noapaļoti līdz vienības precizitātei. */
export function inputValue(cm, units) {
  const d = 10 ** u(units).dec;
  return Math.round(toUnit(cm, units) * d) / d;
}

/** Garums tekstā ar komatu, piem., 12,5 (cm) vai 0,125 (m). */
export const fmtNum = (cm, units) => inputValue(cm, units).toLocaleString('lv-LV', { maximumFractionDigits: u(units).dec, useGrouping: false });
