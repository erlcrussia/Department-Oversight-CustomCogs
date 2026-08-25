'use strict';

/**
 * Minzdrav — единый доступ к БД через Prisma.
 * Подключение берётся из основного бота (process.env.DATABASE_URL), указывать своё запрещено.
 * Для локального теста без Prisma — fallback не используется, требуется npx prisma generate.
 */

let prisma = null;

try {
  const prismaModule = require('../../../prisma/client');
  prisma = prismaModule.prisma || prismaModule;
} catch (_) {
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
  } catch (_) {
    prisma = null;
  }
}

function getPrisma() {
  if (!prisma) throw new Error('Prisma не инициализирована. Выполните npx prisma generate');
  return prisma;
}

module.exports = { getPrisma, prisma: getPrisma };
