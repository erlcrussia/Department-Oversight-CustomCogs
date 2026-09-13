import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainLocale: any = null;
try {
  const candidates = [
    path.resolve(__dirname, '../../utils/locale.js'),
    path.resolve(__dirname, '../../utils/locale.ts'),
    path.resolve(__dirname, '../../../utils/locale.js'),
    path.resolve(__dirname, '../../../utils/locale.ts'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const mod = await import(pathToFileURL(p).href);
      mainLocale = mod.default || mod;
      break;
    }
  }
} catch {
  mainLocale = null;
}

export function t(lang: string, key: string, ...args: any[]): any {
  if (mainLocale?.t) {
    return mainLocale.t(lang, key, ...args);
  }
  return args.length > 0 ? `${key} [${args.join(', ')}]` : key;
}

export async function getLang(guildId: string): Promise<string> {
  if (mainLocale?.getLang) {
    return await mainLocale.getLang(guildId);
  }
  return 'ru';
}

export default { t, getLang };
