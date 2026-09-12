import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let prisma: any = null;

try {
  const pPath = path.resolve(__dirname, '../../../../prisma/client.js');
  const mod = await import(pathToFileURL(pPath).href);
  prisma = mod.default || mod.prisma || mod;
} catch {
  try {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
  } catch {
    prisma = null;
  }
}

export { prisma };
export default { prisma };
