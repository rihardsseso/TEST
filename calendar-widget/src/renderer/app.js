'use strict';

/* global Agenda, Namedays */

const $ = (id) => document.getElementById(id);
const api = window.widget;

const state = {
  hasClient: false,
  signedIn: false,
  email: null,
  settings: null,
  agenda: null, // { calendars, events, errors, fetchedAt }
  pop: null, // atvērtais notikums
};

const fmtTime = new Intl.DateTimeFormat('lv-LV', { hour: '2-digit', minute: '2-digit' });
const fmtWeekday = new Intl.DateTimeFormat('lv-LV', { weekday: 'long' });
const fmtDate = new Intl.DateTimeFormat('lv-LV', { day: 'numeric', month: 'long' });
const fmtFull = new Intl.DateTimeFormat('lv-LV', { weekday: 'long', day: 'numeric', month: 'long' });

function cleanError(e) {
  const msg = (e && e.message) || String(e);
  return msg.replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pct(v) {
  return `${Math.round(v * 100)}%`;
}

// ---------- Skati ----------

function show(view) {
  for (const v of ['setup', 'login', 'agenda']) $(`view-${v}`).classList.toggle('hidden', v !== view);
  const inAgenda = view === 'agenda';
  $('btn-refresh').classList.toggle('hidden', !inAgenda);
  $('btn-settings').classList.toggle('hidden', !inAgenda);
  $('infobar').classList.toggle('hidden', !inAgenda);
  if (!inAgenda) {
    closeSettings();
    closePopover();
    $('status').textContent = '';
  }
}

function route() {
  if (!state.hasClient) show('setup');
  else if (!state.signedIn) show('login');
  else {
    show('agenda');
    renderInfobar();
    loadAgenda();
    loadWeather();
  }
}

function applyAppearance() {
  const s = state.settings;
  const alpha = 1 - s.bgTransparency;
  document.body.classList.toggle('light', s.theme === 'light');
  document.body.classList.toggle('see-through', alpha < 0.5);
  document.documentElement.style.setProperty('--bg-alpha', String(alpha));
  $('btn-pin').classList.toggle('on', !!s.alwaysOnTop);
  $('btn-pin').title = s.alwaysOnTop ? 'Vienmēr virspusē: ieslēgts' : 'Vienmēr virspusē: izslēgts';
}

async function saveSettings(patch) {
  state.settings = await api.setSettings(patch);
  applyAppearance();
}

// ---------- Darba kārtība ----------

let loading = false;

async function loadAgenda() {
  if (loading) return;
  loading = true;
  $('btn-refresh').disabled = true;
  $('status').textContent = 'Ielādē…';
  try {
    const r = await api.getAgenda();
    if (!r.ok) {
      if (r.code === 'signed_out') {
        state.signedIn = false;
        route();
        $('login-error').textContent = r.message;
        return;
      }
      $('status').textContent = 'Neizdevās atjaunot';
      $('agenda-error').textContent = r.message;
      return;
    }
    state.agenda = r.data;
    state.email = r.data.email;
    $('agenda-error').textContent = r.data.errors.join('\n');
    $('status').textContent = `Atjaunots ${fmtTime.format(new Date(r.data.fetchedAt))}`;
    renderAgenda();
    renderCalendarList();
  } finally {
    loading = false;
    $('btn-refresh').disabled = false;
  }
}

function dayTitle(date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date - today) / 86400000);
  if (diff === 0) return 'Šodien';
  if (diff === 1) return 'Rīt';
  return cap(fmtWeekday.format(date));
}

function timeLabel(ev, dayStart) {
  if (ev.allDay) return 'Visu dienu';
  const s = new Date(ev.start);
  const e = new Date(ev.end);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const from = s < dayStart ? '…' : fmtTime.format(s);
  const to = e > dayEnd ? '…' : fmtTime.format(e);
  if (+s === +e) return from;
  return `${from}–${to}`;
}

function renderAgenda() {
  if (!state.agenda) return;
  const now = new Date();
  const { eventTransparency, eventOverrides, days } = state.settings;
  const groups = Agenda.groupByDay(state.agenda.events, now, days);
  const root = $('agenda');
  root.replaceChildren();

  $('today-label').textContent = cap(fmtFull.format(now));

  for (const g of groups) {
    const day = document.createElement('div');
    day.className = 'day';
    if (g.key === Agenda.dayKey(now)) day.classList.add('today');

    const head = document.createElement('div');
    head.className = 'day-head';
    const name = document.createElement('span');
    name.textContent = dayTitle(g.date);
    const date = document.createElement('span');
    date.className = 'date';
    date.textContent = fmtDate.format(g.date);
    head.append(name, date);
    day.append(head);
    if (state.settings.namedaysEnabled) {
      const names = Namedays.namesFor(g.date, state.settings.namedaysExtended);
      if (names.length && g.key !== Agenda.dayKey(now)) {
        const nd = document.createElement('div');
        nd.className = 'day-names';
        nd.textContent = `Vārda dienas: ${names.join(', ')}`;
        day.append(nd);
      }
    }

    if (!g.events.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Nav notikumu';
      day.append(empty);
    }

    for (const ev of g.events) {
      const el = document.createElement('div');
      el.className = 'event';
      el.dataset.id = ev.id;
      el.style.setProperty('--ev', ev.color);
      if (ev.allDay) el.classList.add('allday');
      const end = Agenda.parseDate(ev.end);
      const start = Agenda.parseDate(ev.start);
      if (end <= now && !ev.allDay) el.classList.add('past');
      else if (start <= now && end > now && !ev.allDay) el.classList.add('now');

      const t = Agenda.eventTransparency(ev, eventOverrides, eventTransparency);
      el.style.opacity = String(1 - t);

      const time = document.createElement('div');
      time.className = 'time';
      time.textContent = timeLabel(ev, g.date);
      const body = document.createElement('div');
      body.className = 'body';
      const title = document.createElement('div');
      title.className = 'name';
      title.textContent = ev.title;
      body.append(title);
      if (ev.location) {
        const loc = document.createElement('div');
        loc.className = 'loc';
        loc.textContent = ev.location;
        body.append(loc);
      }
      el.append(time, body);

      if (hasOverride(ev)) {
        const mark = document.createElement('span');
        mark.className = 'custom';
        mark.title = 'Individuāls caurspīdīgums';
        mark.textContent = '◐';
        el.append(mark);
      }

      el.addEventListener('click', () => openPopover(ev));
      day.append(el);
    }
    root.append(day);
  }
  $('override-count').textContent = String(Object.keys(eventOverrides).length);
}

function hasOverride(ev) {
  const o = state.settings.eventOverrides;
  return ev.id in o || (ev.seriesId && `r:${ev.seriesId}` in o);
}

// ---------- Vārda dienas un laika prognoze ----------

// WMO laika apstākļu kodi (Open-Meteo) → ikona un apraksts
const WEATHER = [
  [[0], '☀️', '🌙', 'Skaidrs'],
  [[1], '🌤️', '🌙', 'Pārsvarā skaidrs'],
  [[2], '⛅', '☁️', 'Mainīgs mākoņu daudzums'],
  [[3], '☁️', '☁️', 'Apmācies'],
  [[45, 48], '🌫️', '🌫️', 'Migla'],
  [[51, 53, 55], '🌦️', '🌧️', 'Smidzina'],
  [[56, 57], '🌧️', '🌧️', 'Sasalstoša smidzināšana'],
  [[61], '🌧️', '🌧️', 'Neliels lietus'],
  [[63], '🌧️', '🌧️', 'Lietus'],
  [[65], '🌧️', '🌧️', 'Stiprs lietus'],
  [[66, 67], '🌧️', '🌧️', 'Sasalstošs lietus'],
  [[71], '🌨️', '🌨️', 'Neliels sniegs'],
  [[73], '🌨️', '🌨️', 'Sniegs'],
  [[75], '❄️', '❄️', 'Stiprs sniegs'],
  [[77], '🌨️', '🌨️', 'Sniega graudi'],
  [[80, 81], '🌦️', '🌧️', 'Lietusgāzes'],
  [[82], '⛈️', '⛈️', 'Stipras lietusgāzes'],
  [[85, 86], '🌨️', '🌨️', 'Sniegputenis'],
  [[95], '⛈️', '⛈️', 'Pērkona negaiss'],
  [[96, 99], '⛈️', '⛈️', 'Negaiss ar krusu'],
];

function weatherInfo(code, isDay = true) {
  const row = WEATHER.find(([codes]) => codes.includes(code));
  if (!row) return { icon: '🌡️', text: '' };
  return { icon: isDay ? row[1] : row[2], text: row[3] };
}

const SHORT_DAYS = ['Sv', 'Pr', 'Ot', 'Tr', 'Ce', 'Pk', 'Se'];
const deg = (t) => (t === null || t === undefined ? '–' : `${Math.round(t)}°`);

let weatherData = null; // pēdējā veiksmīgā atbilde

function renderInfobar() {
  const s = state.settings;
  const names = s.namedaysEnabled ? Namedays.namesFor(new Date(), s.namedaysExtended) : [];
  $('nameday').classList.toggle('hidden', !names.length);
  $('nameday-names').textContent = names.join(', ');
  $('weather').classList.toggle('hidden', !s.weatherEnabled || !s.cities.length);
  renderWeather();
}

function renderWeather() {
  const s = state.settings;
  const city = s.cities[s.activeCity];
  const cityBtn = $('w-city');
  cityBtn.textContent = city ? city.name : '';
  cityBtn.classList.toggle('multi', s.cities.length > 1);
  cityBtn.title = s.cities.length > 1 ? 'Pārslēgt uz nākamo pilsētu' : 'Pilsētas var pievienot iestatījumos';

  const w = weatherData && city && weatherData.city.lat === city.lat && weatherData.city.lon === city.lon
    ? weatherData.data
    : null;
  if (!w) {
    $('w-icon').textContent = '⏳';
    $('w-temp').textContent = '';
    $('w-desc').textContent = 'Ielādē…';
    $('w-days').replaceChildren();
    return;
  }
  const now = weatherInfo(w.current.code, w.current.isDay);
  $('w-icon').textContent = now.icon;
  $('w-temp').textContent = deg(w.current.temp);
  const wind = w.current.wind !== undefined ? `, vējš ${Math.round(w.current.wind)} m/s` : '';
  $('w-desc').textContent = `${now.text}, jūtas kā ${deg(w.current.feels)}${wind}`;

  const box = $('w-days');
  box.replaceChildren();
  w.days.slice(0, 4).forEach((d, i) => {
    const date = Agenda.parseDate(d.date);
    const el = document.createElement('div');
    el.className = 'w-day';
    const info = weatherInfo(d.code);
    el.title = info.text + (d.precip !== null ? `, nokrišņu iespēja ${d.precip}%` : '');
    const label = document.createElement('div');
    label.className = 'd';
    label.textContent = i === 0 ? 'Šodien' : i === 1 ? 'Rīt' : SHORT_DAYS[date.getDay()];
    const icon = document.createElement('div');
    icon.className = 'i';
    icon.textContent = info.icon;
    const t = document.createElement('div');
    t.className = 't';
    const lo = document.createElement('span');
    lo.className = 'lo';
    lo.textContent = deg(d.min);
    t.append(`${deg(d.max)} `, lo);
    el.append(label, icon, t);
    if (d.precip) {
      const p = document.createElement('div');
      p.className = 'p';
      p.textContent = `💧${d.precip}%`;
      el.append(p);
    }
    box.append(el);
  });
}

let weatherLoading = false;
async function loadWeather(force) {
  const s = state.settings;
  if (!s.weatherEnabled || !s.cities.length || weatherLoading) return;
  weatherLoading = true;
  try {
    const r = await api.getWeather(force);
    $('w-error').textContent = r.ok ? '' : r.message;
    if (r.ok) weatherData = r;
    renderWeather();
  } finally {
    weatherLoading = false;
  }
}

async function nextCity() {
  const s = state.settings;
  if (s.cities.length < 2) return;
  await saveSettings({ activeCity: (s.activeCity + 1) % s.cities.length });
  renderWeather();
  loadWeather();
}

function cityLabel(c) {
  return [c.region, c.country].filter((x) => x && x !== c.name).join(', ');
}

function renderCitySettings() {
  const s = state.settings;
  const box = $('set-cities');
  box.replaceChildren();
  s.cities.forEach((c, i) => {
    const row = document.createElement('label');
    row.className = 'city-item';
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'active-city';
    radio.checked = i === s.activeCity;
    radio.title = 'Rādīt šīs pilsētas laiku';
    radio.addEventListener('change', async () => {
      await saveSettings({ activeCity: i });
      renderWeather();
      loadWeather();
    });
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = `${c.name} `;
    const small = document.createElement('small');
    small.textContent = cityLabel(c);
    name.append(small);
    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '✕';
    del.title = 'Noņemt pilsētu';
    del.addEventListener('click', async (e) => {
      e.preventDefault();
      const cities = s.cities.filter((_, j) => j !== i);
      const active = i < s.activeCity ? s.activeCity - 1 : s.activeCity;
      await saveSettings({ cities, activeCity: active });
      renderCitySettings();
      renderInfobar();
      loadWeather();
    });
    row.append(radio, name, del);
    box.append(row);
  });
  if (!s.cities.length) {
    const p = document.createElement('p');
    p.className = 'muted small';
    p.textContent = 'Nav pievienotu pilsētu.';
    box.append(p);
  }
}

async function searchCity(e) {
  e.preventDefault();
  const q = $('city-query').value.trim();
  const box = $('city-results');
  box.replaceChildren();
  $('city-error').textContent = '';
  if (q.length < 2) return;
  $('btn-city-search').disabled = true;
  try {
    const r = await api.searchCities(q);
    if (!r.ok) {
      $('city-error').textContent = `Meklēšana neizdevās: ${r.message}`;
      return;
    }
    if (!r.results.length) {
      $('city-error').textContent = 'Nekas netika atrasts.';
      return;
    }
    for (const c of r.results) {
      const row = document.createElement('div');
      row.className = 'city-item result';
      row.title = 'Pievienot';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = `＋ ${c.name} `;
      const small = document.createElement('small');
      small.textContent = cityLabel(c);
      name.append(small);
      row.append(name);
      row.addEventListener('click', async () => {
        const s = state.settings;
        const existing = s.cities.findIndex((x) => x.lat === c.lat && x.lon === c.lon);
        const cities = existing >= 0 ? s.cities : [...s.cities, c];
        await saveSettings({ cities, activeCity: existing >= 0 ? existing : cities.length - 1 });
        $('city-query').value = '';
        box.replaceChildren();
        renderCitySettings();
        renderInfobar();
        loadWeather();
      });
      box.append(row);
    }
  } finally {
    $('btn-city-search').disabled = false;
  }
}

// ---------- Notikuma logs ar individuālo caurspīdīgumu ----------

function openPopover(ev) {
  closeSettings();
  state.pop = ev;
  const s = state.settings;
  $('pop-title').textContent = ev.title;
  $('pop-color').style.setProperty('--ev', ev.color);
  $('pop-where').textContent = ev.location ? `📍 ${ev.location}` : '';
  $('pop-cal').textContent = ev.calendar;

  const start = Agenda.parseDate(ev.start);
  if (ev.allDay) {
    const end = Agenda.parseDate(ev.end);
    end.setDate(end.getDate() - 1);
    $('pop-when').textContent = +end > +start
      ? `${fmtDate.format(start)} – ${fmtDate.format(end)}, visu dienu`
      : `${cap(fmtFull.format(start))}, visu dienu`;
  } else {
    $('pop-when').textContent = `${cap(fmtFull.format(start))}, ${fmtTime.format(start)}–${fmtTime.format(new Date(ev.end))}`;
  }

  const t = Agenda.eventTransparency(ev, s.eventOverrides, s.eventTransparency);
  $('pop-range').value = String(Math.round(t * 100));
  $('out-pop').textContent = pct(t);
  $('pop-series-wrap').classList.toggle('hidden', !ev.seriesId);
  $('pop-series').checked = !!ev.seriesId && !(ev.id in s.eventOverrides) && `r:${ev.seriesId}` in s.eventOverrides;
  $('btn-pop-open').classList.toggle('hidden', !ev.link);
  $('popover').classList.remove('hidden');
}

function closePopover() {
  state.pop = null;
  $('popover').classList.add('hidden');
}

let popSaveTimer;
function applyPopTransparency(value) {
  const ev = state.pop;
  if (!ev) return;
  const overrides = Agenda.setOverride(state.settings.eventOverrides, ev, value, $('pop-series').checked);
  state.settings = { ...state.settings, eventOverrides: overrides };
  renderAgenda();
  clearTimeout(popSaveTimer);
  popSaveTimer = setTimeout(() => saveSettings({ eventOverrides: state.settings.eventOverrides }), 300);
}

// ---------- Iestatījumi ----------

function openSettings() {
  closePopover();
  const s = state.settings;
  $('set-email').textContent = state.email || '';
  $('set-email').title = state.email || '';
  $('set-bg').value = String(Math.round(s.bgTransparency * 100));
  $('out-bg').textContent = pct(s.bgTransparency);
  $('set-ev').value = String(Math.round(s.eventTransparency * 100));
  $('out-ev').textContent = pct(s.eventTransparency);
  $('set-theme').value = s.theme;
  $('set-days').value = String(s.days);
  $('set-top').checked = !!s.alwaysOnTop;
  $('set-autostart').checked = !!s.startWithWindows;
  $('override-count').textContent = String(Object.keys(s.eventOverrides).length);
  $('set-weather').checked = !!s.weatherEnabled;
  $('set-namedays').checked = !!s.namedaysEnabled;
  $('set-namedays-ext').checked = !!s.namedaysExtended;
  renderCitySettings();
  renderCalendarList();
  $('settings').classList.remove('hidden');
}

function closeSettings() {
  $('settings').classList.add('hidden');
}

function renderCalendarList() {
  const box = $('set-calendars');
  box.replaceChildren();
  if (!state.agenda) return;
  const chosen = state.settings.selectedCalendars;
  for (const c of state.agenda.calendars) {
    const label = document.createElement('label');
    label.className = 'cal-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = c.id;
    cb.checked = chosen ? chosen.includes(c.id) : c.selected;
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.setProperty('--ev', c.color);
    const name = document.createElement('span');
    name.className = 'ellipsis';
    name.textContent = c.name + (c.primary ? ' (galvenais)' : '');
    label.append(cb, dot, name);
    cb.addEventListener('change', async () => {
      const ids = [...box.querySelectorAll('input:checked')].map((i) => i.value);
      await saveSettings({ selectedCalendars: ids });
      loadAgenda();
    });
    box.append(label);
  }
}

// ---------- Notikumu apstrāde ----------

function bind() {
  $('btn-min').onclick = () => api.minimize();
  $('btn-close').onclick = () => api.close();
  $('btn-refresh').onclick = () => {
    loadAgenda();
    loadWeather(true);
  };
  $('btn-pin').onclick = () => saveSettings({ alwaysOnTop: !state.settings.alwaysOnTop });
  $('btn-settings').onclick = () => ($('settings').classList.contains('hidden') ? openSettings() : closeSettings());
  $('btn-settings-close').onclick = closeSettings;

  // Iestatīšana
  $('link-console').onclick = (e) => {
    e.preventDefault();
    api.openLink('https://console.cloud.google.com/apis/credentials');
  };
  $('btn-import').onclick = async () => {
    $('setup-error').textContent = '';
    try {
      if (await api.importClient()) {
        state.hasClient = true;
        route();
      }
    } catch (e) {
      $('setup-error').textContent = cleanError(e);
    }
  };
  $('btn-save-client').onclick = async () => {
    $('setup-error').textContent = '';
    try {
      await api.setClient({
        clientId: $('in-client-id').value.trim(),
        clientSecret: $('in-client-secret').value.trim(),
      });
      state.hasClient = true;
      route();
    } catch (e) {
      $('setup-error').textContent = cleanError(e);
    }
  };
  const changeClient = async (e) => {
    e.preventDefault();
    await api.signOut();
    state.signedIn = false;
    state.agenda = null;
    state.hasClient = false;
    await api.resetClient();
    show('setup');
  };
  $('link-change-client').onclick = changeClient;
  $('link-change-client2').onclick = changeClient;

  // Pieslēgšanās
  $('btn-signin').onclick = async () => {
    const btn = $('btn-signin');
    btn.disabled = true;
    $('login-error').textContent = '';
    $('login-msg').textContent = 'Pārlūkā atvērta Google pieslēgšanās — pabeidz to tur…';
    try {
      const r = await api.signIn();
      state.signedIn = true;
      state.email = r.email;
      route();
    } catch (e) {
      $('login-error').textContent = cleanError(e);
    } finally {
      btn.disabled = false;
      $('login-msg').textContent = '';
    }
  };
  $('btn-signout').onclick = async () => {
    await api.signOut();
    state.signedIn = false;
    state.agenda = null;
    state.email = null;
    $('agenda').replaceChildren();
    route();
  };

  // Caurspīdīgums
  let bgTimer;
  $('set-bg').oninput = (e) => {
    const v = Number(e.target.value) / 100;
    state.settings = { ...state.settings, bgTransparency: v };
    $('out-bg').textContent = pct(v);
    applyAppearance();
    clearTimeout(bgTimer);
    bgTimer = setTimeout(() => saveSettings({ bgTransparency: v }), 250);
  };
  let evTimer;
  $('set-ev').oninput = (e) => {
    const v = Number(e.target.value) / 100;
    state.settings = { ...state.settings, eventTransparency: v };
    $('out-ev').textContent = pct(v);
    renderAgenda();
    clearTimeout(evTimer);
    evTimer = setTimeout(() => saveSettings({ eventTransparency: v }), 250);
  };
  $('btn-reset-overrides').onclick = async () => {
    await saveSettings({ eventOverrides: {} });
    renderAgenda();
  };

  $('set-theme').onchange = (e) => saveSettings({ theme: e.target.value });
  $('set-days').onchange = async (e) => {
    await saveSettings({ days: Number(e.target.value) });
    loadAgenda();
  };
  $('set-top').onchange = (e) => saveSettings({ alwaysOnTop: e.target.checked });
  $('set-autostart').onchange = (e) => saveSettings({ startWithWindows: e.target.checked });

  // Laika prognoze un vārda dienas
  $('w-city').onclick = nextCity;
  $('city-form').onsubmit = searchCity;
  $('set-weather').onchange = async (e) => {
    await saveSettings({ weatherEnabled: e.target.checked });
    renderInfobar();
    loadWeather();
  };
  const namedaysChanged = async () => {
    await saveSettings({
      namedaysEnabled: $('set-namedays').checked,
      namedaysExtended: $('set-namedays-ext').checked,
    });
    renderInfobar();
    renderAgenda();
  };
  $('set-namedays').onchange = namedaysChanged;
  $('set-namedays-ext').onchange = namedaysChanged;

  // Notikuma logs
  $('btn-pop-close').onclick = closePopover;
  $('pop-range').oninput = (e) => {
    const v = Number(e.target.value) / 100;
    $('out-pop').textContent = pct(v);
    applyPopTransparency(v);
  };
  $('pop-series').onchange = () => applyPopTransparency(Number($('pop-range').value) / 100);
  $('btn-pop-reset').onclick = () => {
    const ev = state.pop;
    applyPopTransparency(null);
    if (ev) openPopover(ev);
  };
  $('btn-pop-open').onclick = () => state.pop?.link && api.openLink(state.pop.link);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePopover();
      closeSettings();
    }
    if (e.key === 'F5' && state.signedIn) loadAgenda();
  });

  // Izmēra maiņa ar stūra rokturi
  const grip = $('grip');
  let drag = null;
  let frame = 0;
  grip.addEventListener('pointerdown', (e) => {
    grip.setPointerCapture(e.pointerId);
    drag = { x: e.screenX, y: e.screenY, w: window.outerWidth, h: window.outerHeight };
  });
  grip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    cancelAnimationFrame(frame);
    const size = { width: drag.w + e.screenX - drag.x, height: drag.h + e.screenY - drag.y };
    frame = requestAnimationFrame(() => api.resize(size));
  });
  const stop = () => {
    drag = null;
  };
  grip.addEventListener('pointerup', stop);
  grip.addEventListener('pointercancel', stop);
}

// ---------- Palaišana ----------

let refreshTimer;
function scheduleRefresh() {
  clearInterval(refreshTimer);
  const minutes = state.settings.refreshMinutes || 5;
  refreshTimer = setInterval(() => {
    if (state.signedIn && state.hasClient) loadAgenda();
  }, minutes * 60 * 1000);
}

async function init() {
  const s = await api.getState();
  Object.assign(state, s);
  applyAppearance();
  bind();
  route();
  scheduleRefresh();
  // Katru minūti pārzīmē, lai "tagad"/"pagājis", datums un vārda dienas būtu aktuāli
  setInterval(() => {
    renderAgenda();
    if (state.signedIn && state.hasClient) renderInfobar();
  }, 60 * 1000);
  // Laika prognozi atjauno ik pēc 30 minūtēm
  setInterval(() => {
    if (state.signedIn && state.hasClient) loadWeather(true);
  }, 30 * 60 * 1000);
}

init();
