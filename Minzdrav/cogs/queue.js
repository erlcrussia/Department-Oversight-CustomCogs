const { SlashCommandBuilder } = require('discord.js');
const { queueEmbed, errorEmbed } = require('../utils/embeds');
const { getQueue, getUserByDiscordId } = require('../dataUtils/emias');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('очередь')
    .setDescription('Очередь дня — только для сотрудников')
    .addStringOption(o => o.setName('дата').setDescription('YYYY-MM-DD (по умолчанию сегодня)')),

  async execute(interaction) {
    const staff = getUserByDiscordId(interaction.user.id);
    if (!isStaff(staff)) {
      await interaction.reply({ embeds: [errorEmbed('Команда только для сотрудников Минздрава.')], ephemeral: true });
      return;
    }
    const raw = interaction.options.getString('дата');
    let date = raw || new Date().toISOString().slice(0, 10);
    if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      await interaction.reply({ embeds: [errorEmbed('Неверный формат даты. Используйте `YYYY-MM-DD`.')], ephemeral: true });
      return;
    }
    const q = getQueue(date);
    const e = queueEmbed({ date, queue: q });
    await interaction.reply({ embeds: [e], ephemeral: false });
  },
};
