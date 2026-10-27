'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  bounds: { width: 360, height: 560 },
  theme: 'dark',
  // 0 = pilnībā necaurspīdīgs, 1 = pilnībā caurspīdīgs
  bgTransparency: 0.35,
  eventTransparency: 0,
  // { [eventId | 'r:' + recurringEventId]: transparency }
  eventOverrides: {},
  days: 7,
  alwaysOnTop: false,
  startWithWindows: false,
  // null = rādīt visus kalendārus, kas Google kalendārā ir atzīmēti
  selectedCalendars: null,
  refreshMinutes: 5,
};

class Store {
  constructor(dir, name = 'settings.json') {
    this.file = path.join(dir, name);
    this.data = { ...DEFAULTS };
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      this.data = { ...DEFAULTS, ...raw };
    } catch {
      // pirmā palaišana vai bojāts fails — paliek noklusējumi
    }
  }

  get(key) {
    return this.data[key];
  }

  all() {
    return { ...this.data };
  }

  set(patch) {
    Object.assign(this.data, patch);
    this.save();
    return this.all();
  }

  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = { Store, DEFAULTS };
