const { prisma } = require('../dataUtils/db');

let sent24 = new Set();
let sent1 = new Set();
let lastDigestDate = null;

module.exports = {
  name: 'emias-reminders',
  interval: 60000,

  execute: async (client, logger) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const now = new Date();

      const tickets = await prisma.appointment.findMany({
        where: {
          date: { in: [today, tomorrow] },
          status: 'waiting',
          patient: { discordId: { not: null } },
        },
        orderBy: [{ date: 'asc' }, { time: 'asc' }],
      });

      const DM_DELAY_MS = 1500;

      for (const t of tickets) {
        const patient = await prisma.patients.findUnique({ where: { id: t.patientId } });
        if (!patient?.discordId) continue;

        const doctor = t.doctorId ? await prisma.users.findUnique({ where: { id: t.doctorId } }) : null;

        const dt = new Date(`${t.date}T${t.time}:00`);
        const diffMs = dt - now;
        const diffH = diffMs / 3600000;
        const id = t.id;

        if (diffH > 1 && diffH <= 24 && !sent24.has(id)) {
          try {
            const user = await client.users.fetch(patient.discordId);
            await user.send(`Напоминание: через ~${Math.round(diffH)} ч приём у **${doctor?.fullName || 'врача'}**.\n\`${t.ticketNumber}\` · ${t.date} ${t.time} (каб. ${t.room || '—'})`);
            sent24.add(id);
            await new Promise(r => setTimeout(r, DM_DELAY_MS));
          } catch {
            sent24.add(id);
          }
        }

        if (diffH > 0 && diffH <= 1 && !sent1.has(id)) {
          try {
            const user = await client.users.fetch(patient.discordId);
            const mins = Math.max(1, Math.round(diffMs / 60000));
            await user.send(`Скоро приём: через **${mins} мин** у **${doctor?.fullName || 'врача'}**, каб. ${t.room || '—'}.\n\`${t.ticketNumber}\` · ${t.date} ${t.time}`);
            sent1.add(id);
            await new Promise(r => setTimeout(r, DM_DELAY_MS));
          } catch {
            sent1.add(id);
          }
        }
      }

      const ids = new Set(tickets.map(t => t.id));
      for (const id of [...sent24]) if (!ids.has(id)) sent24.delete(id);
      for (const id of [...sent1]) if (!ids.has(id)) sent1.delete(id);

      const hh = now.getHours();
      const mm = now.getMinutes();
      const dateKey = today;
      if (hh === 8 && mm < 2 && lastDigestDate !== dateKey) {
        lastDigestDate = dateKey;
        const doctors = await prisma.users.findMany({
          where: {
            discordId: { not: null },
            isActive: 1,
            role: { in: ['Врач', 'Главный врач'] },
          },
        });
        for (const doc of doctors) {
          const dayTickets = await prisma.appointment.findMany({
            where: { doctorId: doc.id, date: today, status: { in: ['waiting', 'in_room'] } },
            orderBy: { time: 'asc' },
          });
          if (!dayTickets.length) continue;
          try {
            const user = await client.users.fetch(doc.discordId);
            const lines = dayTickets.map(t => `\`${t.time}\` — \`${t.ticketNumber}\` (каб. ${t.room || '—'})`).join('\n');
            await user.send(`**Расписание на сегодня** (${today}) — ${dayTickets.length} талонов:\n${lines}`);
          } catch {}
        }
        if (logger) logger.info(`[ЕМИАС] Утренний дайджест отправлен на ${today}`);
      }
    } catch (e) {
      if (logger) logger.warn('[ЕМИАС] reminders error: ' + e.message);
    }
  },
};
