import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { staffPanelContainer, FLAGS, errorContainer } from '../utils/embeds.js';
import { staffRows } from '../utils/panels.js';
import emias from '../dataUtils/emias.js';
import { ROLES } from '../utils/constants.js';

export default {
  data: new SlashCommandBuilder()
    .setName('штаб')
    .setNameLocalizations({ 'en-US': 'staff', 'en-GB': 'staff' })
    .setDescription('Панель управления персоналом (Главврач)')
    .setDescriptionLocalizations({ 'en-US': 'Staff control panel' })
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async execute(interaction) {
    const gid = interaction.guildId;
    const actor = await emias.getUserByDiscordId(interaction.user.id, gid);
    const isHead = actor && actor.role === ROLES.HEAD_PHYSICIAN;
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    const all = await emias.getAllStaff(gid);
    const hasHead = all.some(u => u.role === ROLES.HEAD_PHYSICIAN && u.is_active === 1);

    if (hasHead && !isHead) {
      await interaction.reply({ components: [errorContainer('Только главный врач может открыть штаб.')], flags: FLAGS, ephemeral: true });
      return;
    }
    if (!hasHead && !isAdmin && !isHead) {
      await interaction.reply({ components: [errorContainer('Штат пуст. Первым может стать только администратор сервера.')], flags: FLAGS, ephemeral: true });
      return;
    }

    const staffList = await emias.getAllStaff(gid);
    const container = staffPanelContainer(staffList);
    const rows = staffRows();

    await interaction.reply({ components: [container, ...rows], flags: FLAGS, ephemeral: true });
  },
};
