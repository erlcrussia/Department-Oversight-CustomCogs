const { PrismaClient } = require('../../prisma/client');

// Единый экземпляр клиента к общей БД (Neon, схема "emias").
// Бот и сайт — равноправные клиенты одной базы: данные граждан/врачей/талонов общие.
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

module.exports = { prisma };
