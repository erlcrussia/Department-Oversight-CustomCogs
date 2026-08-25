const { SlashCommandBuilder } = require('discord.js');
const { brandEmbed, footer, errorEmbed } = require('../utils/embeds');
const { getUserByDiscordId, getStats } = require('../dataUtils/emias');
const { ROLES } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('статистика')
    .setDescription('Статистика поликлиники (Главврач)'),

  async execute(interaction) {
    const actor = getUserByDiscordId(interaction.user.id);
    if (!actor || actor.role !== ROLES.HEAD_PHYSICIAN) {
      await interaction.reply({ embeds: [errorEmbed('Только для Главврача.')], ephemeral: true });
      return;
    }
    const s = getStats();
    const e = brandEmbed({ title: 'Статистика ЕМИАС' });
    e.addFields(
      { name: '👥 Пациенты', value: `Всего: **${s.patientsTotal}**\nЗаблокировано: **${s.patientsBlocked}**`, inline: true },
      { name: '🩺 Персонал', value: `Всего: **${s.staffTotal}**`, inline: true },
      { name: '🎫 Талоны сегодня', value: `Всего: **${s.ticketsToday}**\nОжидают: **${s.waitingToday}**\nПринято: **${s.doneToday}**`, inline: true },
      { name: '📋 Записей за 30 дней', value: `**${s.recordsMonth}**`, inline: true },
    );
    if (s.loadBySpecialty.length) {
      const lines = s.loadBySpecialty.map(r => `${r.specialty || '—'}: **${r.cnt}**`).join('\n');
      e.addFields({ name: 'Нагрузка по специальностям (сегодня)', value: lines.substring(0, 1024), inline: false });
    }
    if (s.topDiagnoses.length) {
      const lines = s.topDiagnoses.map(r => `\`${r.diagnosis_code}\` ${r.diagnosis_text || ''} — **${r.cnt}**`).join('\n');
      e.addFields({ name: 'Топ диагнозов', value: lines.substring(0, 1024), inline: false });
    }
    footer(e);
    await interaction.reply({ embeds: [e], ephemeral: true });
  },
};
