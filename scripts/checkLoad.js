import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  console.error('❌ dist directory not found. Please run "npm run build" first.');
  process.exit(1);
}

const factions = ['MVD', 'FSB', 'FSVNG', 'MCHS', 'Pravo', 'Minzdrav'];
let totalErrors = 0;

for (const faction of factions) {
  const factionPath = path.join(distDir, faction);
  if (!fs.existsSync(factionPath)) {
    console.warn(`⚠️ Faction directory not found: ${faction}`);
    continue;
  }

  console.log(`\n🔍 Verifying faction: ${faction}`);
  const subfolders = ['cogs', 'tasks', 'events', 'dataUtils', 'utils'];

  for (const folder of subfolders) {
    const dir = path.join(factionPath, folder);
    if (!fs.existsSync(dir)) continue;

    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (!file.endsWith('.js') || file.endsWith('.d.ts')) continue;
      const fullPath = path.join(dir, file);
      try {
        const mod = await import(pathToFileURL(fullPath).href);
        const exp = mod.default || mod;

        if (folder === 'cogs') {
          if (exp?.data?.name) {
            console.log(`  ✅ [Command] /${exp.data.name} (${file})`);
          } else if (typeof exp?.setup === 'function' || typeof exp?.onInteraction === 'function') {
            console.log(`  ✅ [Handler] ${file}`);
          } else {
            console.log(`  ✅ [Module] ${file}`);
          }
        } else if (folder === 'tasks') {
          console.log(`  ✅ [Task] ${exp?.name || file} (interval: ${exp?.interval || 'unknown'})`);
        } else if (folder === 'events') {
          console.log(`  ✅ [Event] ${exp?.name || file}`);
        } else {
          console.log(`  ✅ [Util] ${file}`);
        }
      } catch (err) {
        console.error(`  ❌ Failed to load ${faction}/${folder}/${file}:`, err?.message || err);
        totalErrors++;
      }
    }
  }
}

if (totalErrors > 0) {
  console.error(`\n❌ Verification failed with ${totalErrors} error(s).`);
  process.exit(1);
} else {
  console.log('\n🎉 All custom bot modules verified successfully and are ready to run in the main bot!');
}
