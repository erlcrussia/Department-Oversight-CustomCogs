const prismaModule = require('../../../prisma/client');
const prisma = prismaModule.prisma || prismaModule;

module.exports = { prisma };
