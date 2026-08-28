let prisma = null;

try {
  const prismaModule = require('../../../prisma/client');
  prisma = prismaModule.prisma || prismaModule;
} catch (_) {
  try {
    const localModule = require('../../prisma/client');
    prisma = localModule.prisma || localModule;
  } catch (err) {
    try {
      const { PrismaClient } = require('@prisma/client');
      prisma = new PrismaClient();
    } catch {
      prisma = null;
    }
  }
}

module.exports = { prisma };
