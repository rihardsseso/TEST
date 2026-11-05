'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { wallpaperRect } = require('../src/wallpaper.js');

const display = { x: 0, y: 0, width: 1920, height: 1080 };
const second = { x: 1920, y: 0, width: 1280, height: 1024 };
const virtual = { x: 0, y: 0, width: 3200, height: 1080 };

test('wallpaperRect: fill apgriež attēlu, lai tas aizpildītu monitoru', () => {
  const r = wallpaperRect('fill', { width: 1000, height: 1000 }, display, virtual);
  assert.deepStrictEqual(r, { x: 0, y: -420, width: 1920, height: 1920 });
});

test('wallpaperRect: fit, stretch, center un tile', () => {
  assert.deepStrictEqual(wallpaperRect('fit', { width: 1000, height: 1000 }, display, virtual),
    { x: 420, y: 0, width: 1080, height: 1080 });
  assert.deepStrictEqual(wallpaperRect('stretch', { width: 10, height: 10 }, display, virtual),
    { x: 0, y: 0, width: 1920, height: 1080 });
  assert.deepStrictEqual(wallpaperRect('center', { width: 800, height: 600 }, display, virtual),
    { x: 560, y: 240, width: 800, height: 600 });
  assert.deepStrictEqual(wallpaperRect('tile', { width: 64, height: 64 }, display, virtual),
    { x: 0, y: 0, width: 64, height: 64, tile: true });
});

test('wallpaperRect: otrais monitors un span pāri visiem monitoriem', () => {
  const r = wallpaperRect('stretch', { width: 10, height: 10 }, second, virtual);
  assert.deepStrictEqual(r, second);
  const s = wallpaperRect('span', { width: 3200, height: 1080 }, second, virtual);
  assert.deepStrictEqual(s, { x: 0, y: 0, width: 3200, height: 1080 });
});
