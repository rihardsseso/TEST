'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Gradient = require('../src/renderer/gradient.js');

test('toCss: lineārs gradients ar kopējo un punkta necaurspīdīgumu', () => {
  const g = { enabled: true, type: 'linear', angle: 90, stops: [
    { color: '#ff0000', pos: 100, opacity: 0.5 },
    { color: '#0000ff', pos: 0, opacity: 1 },
  ] };
  assert.strictEqual(Gradient.toCss(g, 0.5), 'linear-gradient(90deg, rgba(0, 0, 255, 0.5) 0%, rgba(255, 0, 0, 0.25) 100%)');
  assert.match(Gradient.toCss({ ...g, type: 'radial' }), /^radial-gradient\(circle at center, /);
  assert.match(Gradient.toCss({ ...g, type: 'conic', angle: 45 }), /^conic-gradient\(from 45deg/);
  assert.match(Gradient.toCss({ ...g, type: 'radial' }, 1, 'linear'), /^linear-gradient\(90deg/);
});

test('normalize: nederīgi dati kļūst par drošu noklusējumu', () => {
  const n = Gradient.normalize({ type: 'x', angle: 999, stops: [{ color: 'zzz', pos: 150, opacity: 7 }] });
  assert.strictEqual(n.type, 'linear');
  assert.strictEqual(n.angle, 360);
  assert.ok(n.stops.length >= 2);
  const m = Gradient.normalize({ stops: [{ color: '#abc', pos: 150, opacity: 7 }, { color: '#000000', pos: -5 }] });
  assert.deepStrictEqual(m.stops, [
    { color: '#000000', pos: 0, opacity: 1 },
    { color: '#aabbcc', pos: 100, opacity: 1 },
  ]);
  assert.strictEqual(Gradient.normalize(undefined).enabled, true);
});

test('colorAt: interpolē krāsu un necaurspīdīgumu starp punktiem', () => {
  const stops = [{ color: '#000000', pos: 0, opacity: 0 }, { color: '#ffffff', pos: 100, opacity: 1 }];
  assert.deepStrictEqual(Gradient.colorAt(stops, 50), { color: '#808080', opacity: 0.5 });
  assert.deepStrictEqual(Gradient.colorAt(stops, 0), { color: '#000000', opacity: 0 });
});
