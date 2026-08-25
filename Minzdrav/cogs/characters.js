const { SlashCommandBuilder } = require('discord.js');
const { brandEmbed, footer } = require('../utils/embeds');
const { getCitizensByDiscordId } = require('../dataUtils/emias');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('персонажи')
    .setDescription('Список ваших персонажей')
    .setNameLocalizations({ 'en-US': 'characters' })
    .setDescriptionLocalizations({ 'en-US': 'Your characters list' }),

  async execute(interaction) {
    const citizens = getCitizensByDiscordId(interaction.user.id);
    const e = brandEmbed({ title: 'Ваши персонажи' });
    if (!citizens.length) {
      e.setDescription('У вас нет персонажей. Создайте персонажа на сайте ЕМИАС или попросите главврача импортировать карту.');
      footer(e);
      await interaction.reply({ embeds: [e], ephemeral: true });
      return;
    }
    for (const c of citizens) {
      const val = `Карта: \`${c.card_number}\`\nРождение: ${c.birth_date || '—'} · Пол: ${c.sex || '—'}\nОМС: ${c.oms_number || '—'} · Статус: ${c.status === 'blocked' ? '🔴 Заблокирован' : '🟢 Активен'}`;
      e.addFields({ name: c.full_name, value: val, inline: false });
    }
    footer(e);
    await interaction.reply({ embeds: [e], ephemeral: true });
  },
};
