'use strict';

// Fona gradients: krāsu punkti (krāsa, pozīcija %, necaurspīdīgums) → CSS gradients.
// Izmanto gan logrīks (pārlūka globālais `Gradient`), gan testi (Node `require`).

(function (root) {
  const PRESETS = [
    { name: 'Nakts', stops: [['#0f2027', 0], ['#203a43', 50], ['#2c5364', 100]] },
    { name: 'Okeāns', stops: [['#1e3c72', 0], ['#2a5298', 100]] },
    { name: 'Saulriets', stops: [['#c94b4b', 0], ['#4b134f', 100]] },
    { name: 'Violets', stops: [['#41295a', 0], ['#2f0743', 100]] },
    { name: 'Mežs', stops: [['#134e5e', 0], ['#71b280', 100]] },
    { name: 'Uguns', stops: [['#f12711', 0], ['#f5af19', 100]] },
    { name: 'Varavīksne', stops: [['#ff0000', 0], ['#ffa500', 20], ['#ffff00', 40], ['#00c000', 60], ['#0080ff', 80], ['#8000ff', 100]] },
    { name: 'Melns–balts', stops: [['#000000', 0], ['#ffffff', 100]] },
  ].map((p) => ({ name: p.name, stops: p.stops.map(([color, pos]) => ({ color, pos, opacity: 1 })) }));

  const DEFAULT = { enabled: true, type: 'linear', angle: 160, stops: PRESETS[0].stops };

  function hexToRgb(hex) {
    let h = String(hex || '').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return [0, 0, 0];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }

  function rgbToHex(rgb) {
    return `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;
  }

  const clamp = (v, lo, hi, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
  };

  // Sakārto un pārbauda iestatījumus (vismaz 2 punkti, vērtības robežās).
  function normalize(g) {
    const src = g && typeof g === 'object' ? g : {};
    let stops = Array.isArray(src.stops) ? src.stops : [];
    stops = stops
      .slice(0, 16)
      .map((s) => ({
        color: rgbToHex(hexToRgb(s && s.color)),
        pos: clamp(s && s.pos, 0, 100, 0),
        opacity: clamp(s && s.opacity, 0, 1, 1),
      }))
      .sort((a, b) => a.pos - b.pos);
    if (stops.length < 2) stops = DEFAULT.stops.map((s) => ({ ...s }));
    return {
      enabled: src.enabled === undefined ? DEFAULT.enabled : !!src.enabled,
      type: ['linear', 'radial', 'conic'].includes(src.type) ? src.type : 'linear',
      angle: clamp(src.angle, 0, 360, DEFAULT.angle),
      stops,
    };
  }

  // Krāsa un necaurspīdīgums dotajā pozīcijā (lai pievienotu jaunu punktu bez krāsas lēciena).
  function colorAt(stops, pos) {
    const s = [...stops].sort((a, b) => a.pos - b.pos);
    if (pos <= s[0].pos) return { color: s[0].color, opacity: s[0].opacity };
    const last = s[s.length - 1];
    if (pos >= last.pos) return { color: last.color, opacity: last.opacity };
    for (let i = 0; i < s.length - 1; i++) {
      const a = s[i];
      const b = s[i + 1];
      if (pos >= a.pos && pos <= b.pos) {
        const t = b.pos === a.pos ? 0 : (pos - a.pos) / (b.pos - a.pos);
        const ca = hexToRgb(a.color);
        const cb = hexToRgb(b.color);
        return {
          color: rgbToHex(ca.map((v, k) => v + (cb[k] - v) * t)),
          opacity: Math.round((a.opacity + (b.opacity - a.opacity) * t) * 100) / 100,
        };
      }
    }
    return { color: last.color, opacity: last.opacity };
  }

  // CSS gradients; `alpha` — kopējais fona necaurspīdīgums (1 − fona caurspīdīgums).
  // `forceType` ļauj zīmēt redaktora joslu vienmēr kā lineāru gradientu no kreisās uz labo.
  function toCss(g, alpha = 1, forceType) {
    const n = normalize(g);
    const parts = n.stops.map((s) => {
      const [r, gr, b] = hexToRgb(s.color);
      const a = Math.round(s.opacity * alpha * 1000) / 1000;
      return `rgba(${r}, ${gr}, ${b}, ${a}) ${s.pos}%`;
    });
    const type = forceType || n.type;
    if (type === 'radial') return `radial-gradient(circle at center, ${parts.join(', ')})`;
    if (type === 'conic') return `conic-gradient(from ${n.angle}deg at center, ${parts.join(', ')})`;
    const angle = forceType ? 90 : n.angle;
    return `linear-gradient(${angle}deg, ${parts.join(', ')})`;
  }

  const api = { PRESETS, DEFAULT, normalize, colorAt, toCss, hexToRgb, rgbToHex };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Gradient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
