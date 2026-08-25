'use strict';

const { getPrisma } = require('./db');
const { ROLES } = require('../utils/constants');

// Хелперы — теперь через Prisma raw, без прямого sqlite и без process.env
async function getUserByDiscordId(discordId) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw`SELECT * FROM users WHERE discord_id = ${discordId} AND is_active = 1 LIMIT 1`;
  return rows[0] || null;
}

async function getUserById(id) {
  const prisma = getPrisma();
  const rows = await prisma.$queryRaw`SELECT * FROM users WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

async function getAllStaff() {
  const prisma = getPrisma();
  return prisma.$queryRaw`SELECT * FROM users WHERE is_active=1 ORDER BY CASE role WHEN 'Главный врач' THEN 0 WHEN 'Врач' THEN 1 WHEN 'Регистратор' THEN 2 ELSE 3 END, full_name`;
}

async function getDoctors() {
  const prisma = getPrisma();
  return prisma.$queryRaw`SELECT * FROM users WHERE is_active=1 AND role IN ('Врач','Главный врач') ORDER BY full_name`;
}

async function createStaff({ discordId, discordUsername, fullName, specialty, role }) {
  const prisma = getPrisma();
  const result = await prisma.$queryRaw`INSERT INTO users (discord_id, discord_username, full_name, specialty, role, status) VALUES (${discordId}, ${discordUsername}, ${fullName}, ${specialty}, ${role}, 'free') RETURNING id`;
  const id = result[0]?.id;
  await prisma.$executeRaw`INSERT INTO audit_log (actor_id, action, entity_type, entity_id, details) VALUES (NULL, 'staff.create', 'user', ${String(id)}, ${JSON.stringify({ fullName, role, specialty })})`;
  return id;
}

// Остальные методы — аналогично через $queryRaw/$executeRaw, без process.env
// Для краткости здесь заглушки — реальная логика в emias.prisma.js
// Полная реализация — в dataUtils/emias.prisma.js (см. ниже)

module.exports = {
  getUserByDiscordId,
  getUserById,
  getAllStaff,
  getDoctors,
  createStaff,
  // ... остальные экспорты через prisma
};
