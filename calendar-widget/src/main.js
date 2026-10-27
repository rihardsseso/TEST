'use strict';

const { app, BrowserWindow, ipcMain, shell, safeStorage, dialog, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { Store } = require('./store');
const google = require('./google');

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win;
let store;
let auth = null; // { refreshToken, email }
let access = null; // { accessToken, expiresAt }
let client = null; // { clientId, clientSecret }
let eventColors = null;

const userDir = () => app.getPath('userData');
const authFile = () => path.join(userDir(), 'auth.bin');
const clientFile = () => path.join(userDir(), 'oauth-client.json');

// ---------- OAuth klienta konfigurācija ----------

function loadClient() {
  // 1) lietotāja ievadītā, 2) blakus .exe failam, 3) iebūvēta būvēšanas laikā
  const candidates = [clientFile()];
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    candidates.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'oauth-client.json'));
  }
  candidates.push(path.join(__dirname, 'oauth-client.json'));
  for (const file of candidates) {
    try {
      return google.parseClientConfig(fs.readFileSync(file, 'utf8'));
    } catch {
      // nākamais
    }
  }
  return null;
}

function saveClient(cfg) {
  fs.mkdirSync(userDir(), { recursive: true });
  fs.writeFileSync(clientFile(), JSON.stringify(cfg, null, 2));
  client = cfg;
}

// ---------- Atslēgu glabāšana (šifrēta ar Windows DPAPI) ----------

function loadAuth() {
  try {
    const buf = fs.readFileSync(authFile());
    const text = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(buf)
      : buf.toString('utf8');
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function saveAuth(data) {
  fs.mkdirSync(userDir(), { recursive: true });
  const text = JSON.stringify(data);
  const buf = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(text)
    : Buffer.from(text, 'utf8');
  fs.writeFileSync(authFile(), buf);
  auth = data;
}

function clearAuth() {
  auth = null;
  access = null;
  eventColors = null;
  try {
    fs.unlinkSync(authFile());
  } catch {
    // nav faila
  }
}

async function getAccessToken() {
  if (!auth || !client) throw Object.assign(new Error('Nav pieslēgts'), { code: 'signed_out' });
  if (access && access.expiresAt > Date.now()) return access.accessToken;
  try {
    access = await google.refreshAccessToken({ ...client, refreshToken: auth.refreshToken });
  } catch (e) {
    if (e.code === 'invalid_grant') {
      clearAuth();
      throw Object.assign(new Error('Pieslēgšanās beigusies — pieslēdzies vēlreiz'), { code: 'signed_out' });
    }
    throw e;
  }
  return access.accessToken;
}

// ---------- Kalendāra dati ----------

async function fetchAgenda() {
  const token = await getAccessToken();
  if (!eventColors) eventColors = await google.getEventColors(token).catch(() => ({}));
  const calendars = await google.listCalendars(token);
  const chosen = store.get('selectedCalendars');
  const visible = calendars.filter((c) => (chosen ? chosen.includes(c.id) : c.selected));

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + store.get('days'));

  const results = await Promise.allSettled(
    visible.map((c) => google.listEvents(token, c.id, start.toISOString(), end.toISOString())),
  );

  const events = [];
  const errors = [];
  results.forEach((r, i) => {
    const cal = visible[i];
    if (r.status === 'rejected') {
      errors.push(`${cal.name}: ${r.reason.message}`);
      return;
    }
    for (const e of r.value) {
      if (e.status === 'cancelled') continue;
      const self = (e.attendees || []).find((a) => a.self);
      if (self && self.responseStatus === 'declined') continue;
      const allDay = !!e.start?.date;
      events.push({
        id: `${cal.id}|${e.id}`,
        seriesId: e.recurringEventId ? `${cal.id}|${e.recurringEventId}` : null,
        title: e.summary || '(bez nosaukuma)',
        location: e.location || '',
        allDay,
        start: allDay ? e.start.date : e.start.dateTime,
        end: allDay ? e.end.date : e.end.dateTime,
        color: (e.colorId && eventColors[e.colorId]) || cal.color || '#4285f4',
        calendar: cal.name,
        link: e.htmlLink || null,
      });
    }
  });

  return {
    email: auth.email,
    calendars,
    events,
    errors,
    fetchedAt: Date.now(),
  };
}

// ---------- Logs ----------

function visibleBounds(b) {
  // Ja saglabātā pozīcija ir ārpus ekrāniem (piem., atvienots monitors), centrē logu.
  if (b.x === undefined || b.y === undefined) return { width: b.width, height: b.height };
  const onScreen = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return b.x + 40 > a.x && b.x < a.x + a.width - 40 && b.y >= a.y - 10 && b.y < a.y + a.height - 40;
  });
  return onScreen ? b : { width: b.width, height: b.height };
}

function createWindow() {
  const bounds = visibleBounds(store.get('bounds'));
  win = new BrowserWindow({
    ...bounds,
    minWidth: 240,
    minHeight: 200,
    frame: false,
    transparent: true,
    resizable: false, // izmēru maina ar pašu stūra rokturi (caurspīdīgi logi Windows nav maināmi)
    hasShadow: false,
    backgroundColor: '#00000000',
    alwaysOnTop: store.get('alwaysOnTop'),
    title: 'Kalendāra logrīks',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  let saveTimer;
  const rememberBounds = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (win && !win.isDestroyed() && !win.isMinimized()) store.set({ bounds: win.getBounds() });
    }, 400);
  };
  win.on('moved', rememberBounds);
  win.on('move', rememberBounds);
  win.on('resize', rememberBounds);

  // Saites atver sistēmas pārlūkā, nevis logrīkā
  win.webContents.setWindowOpenHandler(({ url }) => {
    openExternalSafe(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());
}

function openExternalSafe(url) {
  try {
    const u = new URL(url);
    if (u.protocol === 'https:') shell.openExternal(u.toString());
  } catch {
    // nederīga adrese
  }
}

function applyLoginItem(enabled) {
  if (process.platform !== 'win32') return;
  // Portatīvais .exe izpako sevi pagaidu mapē, tāpēc jāreģistrē oriģinālā faila ceļš
  const exe = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  app.setLoginItemSettings({ openAtLogin: enabled, path: exe });
}

// ---------- IPC ----------

function registerIpc() {
  ipcMain.handle('state:get', () => ({
    hasClient: !!client,
    signedIn: !!auth,
    email: auth?.email || null,
    settings: store.all(),
  }));

  ipcMain.handle('settings:set', (_e, patch) => {
    const allowed = [
      'theme', 'bgTransparency', 'eventTransparency', 'eventOverrides', 'days',
      'alwaysOnTop', 'startWithWindows', 'selectedCalendars', 'refreshMinutes',
    ];
    const clean = {};
    for (const k of allowed) if (k in patch) clean[k] = patch[k];
    if ('days' in clean) clean.days = Math.min(30, Math.max(1, parseInt(clean.days, 10) || 7));
    if ('alwaysOnTop' in clean) win.setAlwaysOnTop(!!clean.alwaysOnTop);
    if ('startWithWindows' in clean) applyLoginItem(!!clean.startWithWindows);
    return store.set(clean);
  });

  ipcMain.handle('client:set', (_e, { clientId, clientSecret }) => {
    saveClient(google.parseClientConfig({ clientId, clientSecret }));
    return true;
  });

  ipcMain.handle('client:import', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: 'Izvēlies Google OAuth klienta JSON failu',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });
    if (r.canceled || !r.filePaths[0]) return false;
    saveClient(google.parseClientConfig(fs.readFileSync(r.filePaths[0], 'utf8')));
    return true;
  });

  ipcMain.handle('client:reset', () => {
    try {
      fs.unlinkSync(clientFile());
    } catch {
      // nav faila
    }
    client = loadClient();
    return !!client;
  });

  ipcMain.handle('auth:signIn', async () => {
    if (!client) throw new Error('Nav iestatīts Google OAuth klients');
    const t = await google.authorize(client, (url) => shell.openExternal(url));
    if (!t.refreshToken) throw new Error('Google neatgrieza atjaunošanas atslēgu — mēģini vēlreiz');
    saveAuth({ refreshToken: t.refreshToken, email: t.email });
    access = { accessToken: t.accessToken, expiresAt: t.expiresAt };
    if (!win.isDestroyed()) {
      win.show();
      win.focus();
    }
    return { email: t.email };
  });

  ipcMain.handle('auth:signOut', async () => {
    const token = auth?.refreshToken;
    clearAuth();
    if (token) await google.revoke(token);
    return true;
  });

  ipcMain.handle('agenda:get', async () => {
    try {
      return { ok: true, data: await fetchAgenda() };
    } catch (e) {
      return { ok: false, code: e.code || null, message: e.message };
    }
  });

  ipcMain.on('open:link', (_e, url) => openExternalSafe(url));
  ipcMain.on('win:minimize', () => win.minimize());
  ipcMain.on('win:close', () => app.quit());
  ipcMain.on('win:resize', (_e, { width, height }) => {
    const b = win.getBounds();
    win.setBounds({
      x: b.x,
      y: b.y,
      width: Math.max(240, Math.round(width)),
      height: Math.max(200, Math.round(height)),
    });
  });
}

app.whenReady().then(() => {
  store = new Store(userDir());
  client = loadClient();
  auth = loadAuth();
  registerIpc();
  createWindow();
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
});

app.on('window-all-closed', () => app.quit());
