'use strict';

// Tīras funkcijas notikumu grupēšanai pa dienām un caurspīdīguma aprēķinam.
// Izmanto gan logrīks (pārlūka globālais `Agenda`), gan testi (Node `require`).

(function (root) {
  function dayKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // "2026-10-27" → vietējā laika pusnakts (nevis UTC)
  function parseDate(s) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date(s);
  }

  // Atgriež [{ key, date, events: [...] }] katrai dienai no `from` uz `days` dienām.
  // Vairāku dienu notikumi parādās katrā dienā, kurā tie notiek.
  function groupByDay(events, from, days) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const out = [];
    for (let i = 0; i < days; i++) {
      const dayStart = new Date(start);
      dayStart.setDate(start.getDate() + i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayStart.getDate() + 1);
      const list = events.filter((e) => {
        const s = parseDate(e.start);
        const en = parseDate(e.end);
        // notikums bez ilguma (s == en) pieder tai dienai, kurā tas sākas
        if (+s === +en) return s >= dayStart && s < dayEnd;
        return s < dayEnd && en > dayStart;
      });
      list.sort((a, b) => {
        if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
        return parseDate(a.start) - parseDate(b.start) || a.title.localeCompare(b.title);
      });
      out.push({ key: dayKey(dayStart), date: dayStart, events: list });
    }
    return out;
  }

  // Notikuma caurspīdīgums: konkrētā notikuma iestatījums > visas sērijas iestatījums > noklusējums
  function eventTransparency(event, overrides, fallback) {
    if (overrides && event.id in overrides) return overrides[event.id];
    if (overrides && event.seriesId && `r:${event.seriesId}` in overrides) {
      return overrides[`r:${event.seriesId}`];
    }
    return fallback;
  }

  // Iestata caurspīdīgumu vienam notikumam vai visai sērijai; null noņem individuālo iestatījumu.
  function setOverride(overrides, event, value, wholeSeries) {
    const next = { ...overrides };
    delete next[event.id];
    if (wholeSeries && event.seriesId) {
      // Google atkārtojumu ID ir "<sērijas ID>_<laiks>" — noņem arī atsevišķo atkārtojumu iestatījumus
      const prefix = `${event.seriesId}_`;
      for (const k of Object.keys(next)) if (k.startsWith(prefix)) delete next[k];
      delete next[`r:${event.seriesId}`];
      if (value !== null) next[`r:${event.seriesId}`] = value;
    } else if (value !== null) {
      next[event.id] = value;
    }
    return next;
  }

  const api = { dayKey, parseDate, groupByDay, eventTransparency, setOverride };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Agenda = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
