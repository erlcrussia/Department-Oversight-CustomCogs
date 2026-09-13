import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from 'node:fs';

let prisma: any = null;

try {
  const candidates = [
    path.resolve(__dirname, '../../../prisma/client.js'),
    path.resolve(__dirname, '../../../prisma/client.ts'),
    path.resolve(__dirname, '../../../../prisma/client.js'),
    path.resolve(__dirname, '../../../../prisma/client.ts'),
  ];
  let found = false;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const mod = await import(pathToFileURL(p).href);
      prisma = mod.default || mod.prisma || mod;
      found = true;
      break;
    }
  }
  if (!found) {
    try {
      const prismaModule: any = await import('@prisma/client');
      const PrismaClient = prismaModule?.PrismaClient || prismaModule?.default?.PrismaClient || prismaModule?.default;
      if (typeof PrismaClient === 'function') {
        prisma = new PrismaClient();
      }
    } catch {
      prisma = null;
    }
  }
} catch {
  prisma = null;
}

export { prisma };
export default { prisma };
