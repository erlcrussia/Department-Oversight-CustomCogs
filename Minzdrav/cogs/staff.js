const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { staffPanelContainer, FLAGS, errorContainer } = require('../utils/embeds');
const { staffRows } = require('../utils/panels');
const { getUserByDiscordId, getAllStaff } = require('../dataUtils/emias');
const { ROLES } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('штаб')
    .setNameLocalizations({ 'en-US': 'staff', 'en-GB': 'staff' })
    .setDescription('Панель управления персоналом (Главврач)')
    .setDescriptionLocalizations({ 'en-US': 'Staff control panel' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const actor = getUserByDiscordId(interaction.user.id);
    const isHead = actor && actor.role === ROLES.HEAD_PHYSICIAN;
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    // Если штат пуст — разрешаем админу
    const all = getAllStaff();
    const hasHead = all.some(u => u.role === ROLES.HEAD_PHYSICIAN && u.is_active === 1);

    if (hasHead && !isHead) {
      await interaction.reply({ components: [errorContainer('Только главный врач может открыть штаб.')], flags: FLAGS, ephemeral: true });
      return;
    }
    if (!hasHead && !isAdmin && !isHead) {
      await interaction.reply({ components: [errorContainer('Штат пуст. Первым может стать только администратор сервера.')], flags: FLAGS, ephemeral: true });
      return;
    }

    const staffList = getAllStaff();
    const container = staffPanelContainer(staffList);
    const rows = staffRows();

    await interaction.reply({ components: [container, ...rows], flags: FLAGS, ephemeral: true });
  },
};
