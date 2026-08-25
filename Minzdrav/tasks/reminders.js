'use strict';

const { getSqliteDb } = require('../dataUtils/db');

/**
 * Напоминания за 24ч / 1ч + утренний дайджест в 08:00.
 * Реальные данные — берёт только waiting талоны с привязанным Discord персонажа.
 */
let sent24 = new Set();
let sent1 = new Set();
let lastDigestDate = null;

module.exports = {
  name: 'emias-reminders',
  interval: 60000,

  execute: async (client, logger) => {
    try {
      const db = getSqliteDb();
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const now = new Date();

      const tickets = db.prepare(`
        SELECT a.*, p.full_name as patient_name, p.discord_id as patient_discord_id,
               u.full_name as doctor_name, u.discord_id as doctor_discord_id
        FROM appointments a
        JOIN patients p ON p.id=a.patient_id
        LEFT JOIN users u ON u.id=a.doctor_id
        WHERE a.date IN (?, ?) AND a.status='waiting' AND p.discord_id IS NOT NULL
        ORDER BY a.date, a.time
      `).all(today, tomorrow);

      for (const t of tickets) {
        const dt = new Date(`${t.date}T${t.time}:00`);
        const diffMs = dt - now;
        const diffH = diffMs / 3600000;
        const id = t.id;

        // За 24 часа
        if (diffH > 1 && diffH <= 24 && !sent24.has(id)) {
          try {
            const user = await client.users.fetch(t.patient_discord_id);
            await user.send(`⏰ Напоминание: через ~${Math.round(diffH)} ч приём у **${t.doctor_name || 'врача'}**.\n🎫 \`${t.ticket_number}\` · ${t.date} ${t.time} (каб. ${t.room || '—'})`);
            sent24.add(id);
          } catch {}
        }
        // За 1 час
        if (diffH > 0 && diffH <= 1 && !sent1.has(id)) {
          try {
            const user = await client.users.fetch(t.patient_discord_id);
            const mins = Math.max(1, Math.round(diffMs / 60000));
            await user.send(`🔔 Скоро приём: через **${mins} мин** у **${t.doctor_name || 'врача'}**, каб. ${t.room || '—'}.\n🎫 \`${t.ticket_number}\` · ${t.date} ${t.time}`);
            sent1.add(id);
          } catch {}
        }
      }

      // Чистим сеты от несуществующих
      const ids = new Set(tickets.map(t => t.id));
      for (const id of [...sent24]) if (!ids.has(id)) sent24.delete(id);
      for (const id of [...sent1]) if (!ids.has(id)) sent1.delete(id);

      // Утренний дайджест 08:00
      const hh = now.getHours();
      const mm = now.getMinutes();
      const dateKey = today;
      if (hh === 8 && mm < 2 && lastDigestDate !== dateKey) {
        lastDigestDate = dateKey;
        const doctors = db.prepare(`SELECT * FROM users WHERE discord_id IS NOT NULL AND is_active=1 AND role IN ('Врач','Главный врач')`).all();
        for (const doc of doctors) {
          const dayTickets = db.prepare(`SELECT a.*, p.full_name as patient_name FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.doctor_id=? AND a.date=? AND a.status IN ('waiting','in_room') ORDER BY a.time`).all(doc.id, today);
          if (!dayTickets.length) continue;
          try {
            const user = await client.users.fetch(doc.discord_id);
            const lines = dayTickets.map(t => `\`${t.time}\` ${t.patient_name} — \`${t.ticket_number}\` (каб. ${t.room || '—'})`).join('\n');
            await user.send(`📅 **Расписание на сегодня** (${today}) — ${dayTickets.length} талонов:\n${lines}`);
          } catch {}
        }
        if (logger) logger.info(`[ЕМИАС] Утренний дайджест отправлен на ${today}`);
      }
    } catch (e) {
      if (logger) logger.warn('[ЕМИАС] reminders error: ' + e.message);
    }
  },
};
