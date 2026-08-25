const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed, warningEmbed } = require('../utils/embeds');
const { getUserByDiscordId, wipeAllFake, wipePatients } = require('../dataUtils/emias');
const { ROLES } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('очистка')
    .setDescription('Очистка фейк-данных (Главврач)')
    .addStringOption(o => o.setName('что').setDescription('Что очистить').setRequired(true)
      .addChoices(
        { name: 'Талоны + ЭМК + рецепты (оставить пациентов)', value: 'tickets' },
        { name: 'Всё: пациенты + талоны + ЭМК', value: 'all' },
      )),

  async execute(interaction) {
    const actor = getUserByDiscordId(interaction.user.id);
    const isHead = actor && actor.role === ROLES.HEAD_PHYSICIAN;
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    if (!isHead && !isAdmin) {
      await interaction.reply({ embeds: [errorEmbed('Только Главврач или администратор.')], ephemeral: true });
      return;
    }
    const what = interaction.options.getString('что');
    if (what === 'tickets') {
      wipeAllFake();
      await interaction.reply({ embeds: [successEmbed('Очистка выполнена', 'Удалены все талоны, записи ЭМК, рецепты и коды привязки. Пациенты сохранены.')], ephemeral: false });
    } else {
      wipePatients();
      await interaction.reply({ embeds: [warningEmbed('Полная очистка', 'Удалены **все** пациенты, талоны и медкарты. БД теперь пуста — данные будут только реальные.')], ephemeral: false });
    }
  },
};
