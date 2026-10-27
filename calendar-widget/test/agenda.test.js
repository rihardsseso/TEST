'use strict';

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const Agenda = require('../src/renderer/agenda.js');
const google = require('../src/google.js');

const ev = (over) => ({ id: 'c|e1', seriesId: null, title: 'X', allDay: false, ...over });

test('groupByDay: notikumi pa dienām, visas dienas notikumi pirmie', () => {
  const from = new Date(2026, 9, 27, 15, 0);
  const events = [
    ev({ id: 'a', title: 'Vakars', start: new Date(2026, 9, 27, 18).toISOString(), end: new Date(2026, 9, 27, 19).toISOString() }),
    ev({ id: 'b', title: 'Rīts', start: new Date(2026, 9, 27, 8).toISOString(), end: new Date(2026, 9, 27, 9).toISOString() }),
    ev({ id: 'c', title: 'Brīvdiena', allDay: true, start: '2026-10-27', end: '2026-10-28' }),
    ev({ id: 'd', title: 'Rīt', start: new Date(2026, 9, 28, 10).toISOString(), end: new Date(2026, 9, 28, 11).toISOString() }),
  ];
  const g = Agenda.groupByDay(events, from, 3);
  assert.deepStrictEqual(g.map((d) => d.key), ['2026-10-27', '2026-10-28', '2026-10-29']);
  assert.deepStrictEqual(g[0].events.map((e) => e.id), ['c', 'b', 'a']);
  assert.deepStrictEqual(g[1].events.map((e) => e.id), ['d']);
  assert.strictEqual(g[2].events.length, 0);
});

test('groupByDay: vairāku dienu notikums parādās katrā dienā, beigu datums neieskaitot', () => {
  const events = [ev({ id: 'trip', allDay: true, start: '2026-10-27', end: '2026-10-29' })];
  const g = Agenda.groupByDay(events, new Date(2026, 9, 27), 3);
  assert.deepStrictEqual(g.map((d) => d.events.length), [1, 1, 0]);
});

test('groupByDay: notikums, kas beidzas pusnaktī, neparādās nākamajā dienā', () => {
  const events = [ev({ start: new Date(2026, 9, 27, 22).toISOString(), end: new Date(2026, 9, 28, 0).toISOString() })];
  const g = Agenda.groupByDay(events, new Date(2026, 9, 27), 2);
  assert.deepStrictEqual(g.map((d) => d.events.length), [1, 0]);
});

test('eventTransparency: notikums > sērija > noklusējums', () => {
  const e = ev({ id: 'c|s_1', seriesId: 'c|s' });
  assert.strictEqual(Agenda.eventTransparency(e, {}, 0.2), 0.2);
  assert.strictEqual(Agenda.eventTransparency(e, { 'r:c|s': 0.5 }, 0.2), 0.5);
  assert.strictEqual(Agenda.eventTransparency(e, { 'r:c|s': 0.5, 'c|s_1': 0.7 }, 0.2), 0.7);
  assert.strictEqual(Agenda.eventTransparency(e, { 'c|s_1': 0 }, 0.2), 0);
});

test('setOverride: viens notikums, visa sērija un atiestatīšana', () => {
  const e1 = ev({ id: 'c|s_1', seriesId: 'c|s' });
  let o = Agenda.setOverride({}, e1, 0.4, false);
  assert.deepStrictEqual(o, { 'c|s_1': 0.4 });

  o = { 'c|s_1': 0.4, 'c|s_2': 0.1, other: 0.3 };
  o = Agenda.setOverride(o, e1, 0.6, true);
  assert.deepStrictEqual(o, { other: 0.3, 'r:c|s': 0.6 });

  o = Agenda.setOverride(o, e1, null, true);
  assert.deepStrictEqual(o, { other: 0.3 });

  const single = ev({ id: 'x' });
  assert.deepStrictEqual(Agenda.setOverride({ x: 0.5 }, single, null, false), {});
});

test('parseClientConfig: Google lejupielādētais JSON un manuāla ievade', () => {
  const downloaded = { installed: { client_id: 'abc.apps.googleusercontent.com', client_secret: 'GOCSPX-1' } };
  assert.deepStrictEqual(google.parseClientConfig(JSON.stringify(downloaded)), {
    clientId: 'abc.apps.googleusercontent.com',
    clientSecret: 'GOCSPX-1',
  });
  assert.deepStrictEqual(google.parseClientConfig({ clientId: ' x.apps.googleusercontent.com ', clientSecret: '' }), {
    clientId: 'x.apps.googleusercontent.com',
    clientSecret: '',
  });
  assert.throws(() => google.parseClientConfig({ clientId: 'nav-derigs' }));
});

test('buildAuthUrl: PKCE, offline piekļuve un kalendāra lasīšanas tiesības', () => {
  const { verifier, challenge } = google.createPkce();
  assert.ok(verifier.length >= 43);
  const url = new URL(google.buildAuthUrl({ clientId: 'id', redirectUri: 'http://127.0.0.1:5000', challenge, state: 's' }));
  assert.strictEqual(url.searchParams.get('code_challenge_method'), 'S256');
  assert.strictEqual(url.searchParams.get('access_type'), 'offline');
  assert.match(url.searchParams.get('scope'), /calendar\.readonly/);
});

test('authorize: noraida atbildi ar nepareizu state un pieņem lietotāja atteikumu', async () => {
  let redirect;
  let state;
  const p = google.authorize({ clientId: 'x.apps.googleusercontent.com', clientSecret: '' }, (url) => {
    const u = new URL(url);
    redirect = u.searchParams.get('redirect_uri');
    state = u.searchParams.get('state');
  });
  const result = p.catch((e) => e);
  await new Promise((r) => setImmediate(r));
  const get = (q) => new Promise((res) => http.get(`${redirect}/?${q}`, (r) => { r.resume(); r.on('end', () => res(r.statusCode)); }));
  assert.strictEqual(await get('state=wrong&code=1'), 400);
  assert.strictEqual(await get(`state=${state}&error=access_denied`), 200);
  assert.match((await result).message, /Piekļuve netika atļauta/);
});

test('decodeIdTokenEmail', () => {
  const payload = Buffer.from(JSON.stringify({ email: 'a@b.lv' })).toString('base64url');
  assert.strictEqual(google.decodeIdTokenEmail(`h.${payload}.s`), 'a@b.lv');
  assert.strictEqual(google.decodeIdTokenEmail('garbage'), null);
});
