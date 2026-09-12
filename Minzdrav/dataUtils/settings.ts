import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FILE = path.join(__dirname, '..', 'data', 'integrations.json');

// Дефолтные настройки интеграций (на гильдию)
const DEFAULTS = {
  bookingChannelId: null, // куда кидаются уведомления о новых записях
  pingDoctor: true,       // пинговать врача, к которому записались
  pingPatient: true,      // пинговать пациента
};

function readAll(): Record<string, any> {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeAll(obj: Record<string, any>): void {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(obj, null, 2));
}

function get(guildId: string): any {
  const all = readAll();
  return { ...DEFAULTS, ...(all[guildId] || {}) };
}

function set(guildId: string, patch: any): any {
  const all = readAll();
  all[guildId] = { ...DEFAULTS, ...(all[guildId] || {}), ...patch };
  writeAll(all);
  return all[guildId];
}

export {
  get,
  set,
  DEFAULTS
};

export default { get, set, DEFAULTS };
