'use strict';

// Google OAuth 2.0 (darbvirsmas lietotnes plūsma ar loopback adresi un PKCE)
// un Google Calendar API izsaukumi. Šis modulis nav atkarīgs no Electron.

const crypto = require('crypto');
const http = require('http');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const API = 'https://www.googleapis.com/calendar/v3';
const SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.readonly',
];

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function createPkce() {
  const verifier = base64url(crypto.randomBytes(48));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

function buildAuthUrl({ clientId, redirectUri, challenge, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state,
    access_type: 'offline',
    prompt: 'consent select_account',
  });
  return `${AUTH_URL}?${params}`;
}

// Pieņem Google Cloud Console lejupielādēto client_secret_*.json saturu
// (vai jau vienkāršotu { clientId, clientSecret } objektu).
function parseClientConfig(json) {
  const obj = typeof json === 'string' ? JSON.parse(json) : json;
  const src = obj.installed || obj.web || obj;
  const clientId = String(src.client_id || src.clientId || '').trim();
  const clientSecret = src.client_secret || src.clientSecret || '';
  if (!/\.apps\.googleusercontent\.com$/.test(clientId)) {
    throw new Error('Nederīgs Client ID — tam jābeidzas ar .apps.googleusercontent.com');
  }
  return { clientId, clientSecret: String(clientSecret).trim() };
}

function decodeIdTokenEmail(idToken) {
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
    return payload.email || null;
  } catch {
    return null;
  }
}

const CALLBACK_HTML = (ok, msg) => `<!doctype html><html lang="lv"><meta charset="utf-8">
<title>Kalendāra logrīks</title>
<body style="font-family:Segoe UI,sans-serif;background:#1e1f24;color:#eee;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center"><h2>${ok ? '✓ Pieslēgšanās izdevās' : '✗ Pieslēgšanās neizdevās'}</h2>
<p>${msg}</p></div></body></html>`;

// Atver pārlūkā Google pieslēgšanos un gaida atbildi uz 127.0.0.1.
// openBrowser(url) — funkcija, kas atver sistēmas pārlūku.
function authorize({ clientId, clientSecret }, openBrowser, { timeoutMs = 5 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    const { verifier, challenge } = createPkce();
    const state = base64url(crypto.randomBytes(16));
    let redirectUri;
    let done = false;

    const finish = (err, value) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      server.close();
      if (err) reject(err);
      else resolve(value);
    };

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, redirectUri);
      if (url.pathname !== '/') {
        res.writeHead(404).end();
        return;
      }
      const error = url.searchParams.get('error');
      const code = url.searchParams.get('code');
      if (url.searchParams.get('state') !== state) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' })
          .end(CALLBACK_HTML(false, 'Nederīgs pieprasījums.'));
        return;
      }
      if (error || !code) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          .end(CALLBACK_HTML(false, 'Piekļuve netika atļauta. Vari aizvērt šo logu.'));
        finish(new Error(error === 'access_denied' ? 'Piekļuve netika atļauta' : `Google kļūda: ${error}`));
        return;
      }
      try {
        const tokens = await exchangeCode({ clientId, clientSecret, code, verifier, redirectUri });
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          .end(CALLBACK_HTML(true, 'Vari aizvērt šo logu un atgriezties pie logrīka.'));
        finish(null, tokens);
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          .end(CALLBACK_HTML(false, 'Neizdevās iegūt piekļuves atslēgu.'));
        finish(e);
      }
    });

    const timer = setTimeout(() => finish(new Error('Pieslēgšanās laiks beidzās')), timeoutMs);

    server.on('error', (e) => finish(e));
    server.listen(0, '127.0.0.1', () => {
      redirectUri = `http://127.0.0.1:${server.address().port}`;
      Promise.resolve(openBrowser(buildAuthUrl({ clientId, redirectUri, challenge, state })))
        .catch((e) => finish(e));
    });
  });
}

async function postForm(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error_description || body.error || `HTTP ${res.status}`);
    err.code = body.error;
    throw err;
  }
  return body;
}

async function exchangeCode({ clientId, clientSecret, code, verifier, redirectUri }) {
  const params = {
    client_id: clientId,
    code,
    code_verifier: verifier,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  };
  if (clientSecret) params.client_secret = clientSecret;
  const t = await postForm(TOKEN_URL, params);
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + (t.expires_in - 60) * 1000,
    email: t.id_token ? decodeIdTokenEmail(t.id_token) : null,
  };
}

async function refreshAccessToken({ clientId, clientSecret, refreshToken }) {
  const params = {
    client_id: clientId,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  };
  if (clientSecret) params.client_secret = clientSecret;
  const t = await postForm(TOKEN_URL, params);
  return {
    accessToken: t.access_token,
    expiresAt: Date.now() + (t.expires_in - 60) * 1000,
  };
}

async function revoke(token) {
  try {
    await postForm(REVOKE_URL, { token });
  } catch {
    // ja atslēga jau nav derīga, nav ko atsaukt
  }
}

async function apiGet(accessToken, path, query = {}) {
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${API}${path}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error?.message || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

async function listCalendars(accessToken) {
  const items = [];
  let pageToken;
  do {
    const page = await apiGet(accessToken, '/users/me/calendarList', pageToken ? { pageToken } : {});
    items.push(...(page.items || []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items.map((c) => ({
    id: c.id,
    name: c.summaryOverride || c.summary,
    color: c.backgroundColor,
    primary: !!c.primary,
    selected: !!c.selected,
  }));
}

async function getEventColors(accessToken) {
  const colors = await apiGet(accessToken, '/colors');
  const out = {};
  for (const [id, c] of Object.entries(colors.event || {})) out[id] = c.background;
  return out;
}

async function listEvents(accessToken, calendarId, timeMin, timeMax) {
  const items = [];
  let pageToken;
  do {
    const query = {
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    };
    if (pageToken) query.pageToken = pageToken;
    const page = await apiGet(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, query);
    items.push(...(page.items || []));
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

module.exports = {
  SCOPES,
  createPkce,
  buildAuthUrl,
  parseClientConfig,
  decodeIdTokenEmail,
  authorize,
  refreshAccessToken,
  revoke,
  listCalendars,
  getEventColors,
  listEvents,
};
