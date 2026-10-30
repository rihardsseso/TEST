// Papildu 2D simboli un 3D modeļi (furniture). Pašu zīmēti; aizpilda aģents.
// draw[fam](ctx, w, d, it) — lokālās koord.: centrs (0,0), priekšpuse +y, aizmugure (pie sienas) −y; ctx.fillStyle/strokeStyle jau iestatīti.
// build[fam](it) → [[x, y, z, w, h, d, tone?, shape?, flag?], ...] — kastes cm (centrs; y uz augšu no grīdas).
// assign: { itemKey: fam } — kuriem ITEMS (catalog-data.js) lietot jauno simbolu; colors: { fam: '#hex' }.
export const draw = {};
export const build = {};
export const assign = {};
export const colors = {};
