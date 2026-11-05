'use strict';

const test = require('node:test');
const assert = require('node:assert');
const Namedays = require('../src/renderer/namedays.js');
const weather = require('../src/weather.js');

test('namesFor: kalendāra vārda dienas', () => {
  assert.deepStrictEqual(Namedays.namesFor(new Date(2026, 10, 5)), ['Šarlote', 'Lote']);
  assert.deepStrictEqual(Namedays.namesFor(new Date(2026, 5, 24)), ['Jānis']);
  assert.deepStrictEqual(Namedays.namesFor(new Date(2026, 0, 1)), ['Laimnesis', 'Solvita', 'Solvija']);
});

test('namesFor: 29. februārī vārda dienu nav', () => {
  assert.deepStrictEqual(Namedays.namesFor(new Date(2024, 1, 29)), []);
});

test('namesFor: paplašinātais saraksts pievieno vārdus bez dublikātiem', () => {
  const base = Namedays.namesFor(new Date(2026, 10, 5));
  const ext = Namedays.namesFor(new Date(2026, 10, 5), true);
  assert.deepStrictEqual(ext.slice(0, base.length), base);
  assert.ok(ext.length > base.length);
  assert.strictEqual(new Set(ext).size, ext.length);
});

test('parseForecast: Open-Meteo atbilde', () => {
  const f = weather.parseForecast({
    current: { temperature_2m: 4.3, apparent_temperature: 1.1, weather_code: 61, is_day: 0, wind_speed_10m: 5.2 },
    daily: {
      time: ['2026-11-05', '2026-11-06'],
      weather_code: [61, 3],
      temperature_2m_max: [6.1, 5],
      temperature_2m_min: [2.2, 1],
      precipitation_probability_max: [80, 10],
    },
  });
  assert.deepStrictEqual(f.current, { temp: 4.3, feels: 1.1, code: 61, isDay: false, wind: 5.2 });
  assert.deepStrictEqual(f.days[1], { date: '2026-11-06', code: 3, max: 5, min: 1, precip: 10 });
});
