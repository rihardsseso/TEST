'use strict';

// Laika prognoze no Open-Meteo (https://open-meteo.com) — bez maksas un bez API atslēgas.

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.reason || `Laika serviss atbildēja ar HTTP ${res.status}`);
  return body;
}

async function searchCities(query) {
  const q = String(query || '').trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ name: q, count: '8', language: 'lv', format: 'json' });
  const body = await getJson(`${GEOCODE_URL}?${params}`);
  return (body.results || []).map((r) => ({
    name: r.name,
    region: r.admin1 || '',
    country: r.country || '',
    lat: Math.round(r.latitude * 10000) / 10000,
    lon: Math.round(r.longitude * 10000) / 10000,
  }));
}

function parseForecast(body) {
  const c = body.current || {};
  const d = body.daily || {};
  const days = (d.time || []).map((date, i) => ({
    date,
    code: d.weather_code?.[i],
    max: d.temperature_2m_max?.[i],
    min: d.temperature_2m_min?.[i],
    precip: d.precipitation_probability_max?.[i] ?? null,
  }));
  return {
    current: {
      temp: c.temperature_2m,
      feels: c.apparent_temperature,
      code: c.weather_code,
      isDay: c.is_day !== 0,
      wind: c.wind_speed_10m,
    },
    days,
  };
}

async function getForecast(lat, lon) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,apparent_temperature,weather_code,is_day,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    wind_speed_unit: 'ms',
    timezone: 'auto',
    forecast_days: '5',
  });
  return parseForecast(await getJson(`${FORECAST_URL}?${params}`));
}

module.exports = { searchCities, getForecast, parseForecast };
