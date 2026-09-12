const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'data', 'integrations.json');

// Дефолтные настройки интеграций (на гильдию)
const DEFAULTS = {
  bookingChannelId: null, // куда кидаются уведомления о новых записях
  pingDoctor: true,       // пинговать врача, к которому записались
  pingPatient: true,      // пинговать пациента
};

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
}

function get(guildId) {
  const all = readAll();
  return { ...DEFAULTS, ...(all[guildId] || {}) };
}

function set(guildId, patch) {
  const all = readAll();
  all[guildId] = { ...DEFAULTS, ...(all[guildId] || {}), ...patch };
  writeAll(all);
  return all[guildId];
}

module.exports = { get, set, DEFAULTS };
