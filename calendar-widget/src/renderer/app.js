'use strict';

/* global Agenda */

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
    loadAgenda();
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
  $('btn-refresh').onclick = () => loadAgenda();
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
  // Katru minūti pārzīmē, lai "tagad"/"pagājis" un datums būtu aktuāli
  setInterval(renderAgenda, 60 * 1000);
}

init();
