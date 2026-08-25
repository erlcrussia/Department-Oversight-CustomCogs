const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { staffListEmbed, errorEmbed, successEmbed, brandEmbed, footer } = require('../utils/embeds');
const { getAllStaff, getUserByDiscordId, getUserById, updateStaff, deactivateStaff } = require('../dataUtils/emias');
const { ROLES } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('персонал')
    .setDescription('Управление персоналом (Главврач)')
    .addSubcommand(s => s.setName('список').setDescription('Показать весь персонал'))
    .addSubcommand(s => s.setName('изменить').setDescription('Изменить роль/специальность')
      .addIntegerOption(o => o.setName('id').setDescription('ID сотрудника').setRequired(true).setAutocomplete(true))
      .addStringOption(o => o.setName('роль').setDescription('Новая роль').addChoices(
        { name: 'Главный врач', value: ROLES.HEAD_PHYSICIAN },
        { name: 'Врач', value: ROLES.PHYSICIAN },
        { name: 'Регистратор', value: ROLES.REGISTRAR },
        { name: 'Медсестра', value: ROLES.NURSE },
      ))
      .addStringOption(o => o.setName('специальность').setDescription('Новая специальность').setAutocomplete(true))
      .addStringOption(o => o.setName('фио').setDescription('Новое ФИО')))
    .addSubcommand(s => s.setName('уволить').setDescription('Уволить сотрудника')
      .addIntegerOption(o => o.setName('id').setDescription('ID сотрудника').setRequired(true).setAutocomplete(true))),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'id') {
      const list = getAllStaff();
      const q = focused.value.toString().toLowerCase();
      const choices = list.map(u => ({ name: `${u.full_name} — ${u.role} (#${u.id})`.substring(0, 100), value: u.id }));
      const filtered = q ? choices.filter(c => c.name.toLowerCase().includes(q)) : choices;
      await interaction.respond(filtered.slice(0, 25));
    } else if (focused.name === 'специальность') {
      const { SPECIALTIES } = require('../utils/constants');
      const q = focused.value.toLowerCase();
      const choices = SPECIALTIES.map(s => ({ name: s.name, value: s.code }));
      const filtered = q ? choices.filter(c => c.name.toLowerCase().includes(q)) : choices;
      await interaction.respond(filtered.slice(0, 25));
    }
  },

  async execute(interaction) {
    const actor = getUserByDiscordId(interaction.user.id);
    if (!actor || actor.role !== ROLES.HEAD_PHYSICIAN) {
      await interaction.reply({ embeds: [errorEmbed('Только Главврач может управлять персоналом.')], ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'список') {
      const staff = getAllStaff();
      const e = staffListEmbed(staff);
      await interaction.reply({ embeds: [e], ephemeral: true });
      return;
    }

    if (sub === 'изменить') {
      const id = interaction.options.getInteger('id');
      const role = interaction.options.getString('роль');
      const spec = interaction.options.getString('специальность');
      const fio = interaction.options.getString('фио');
      const target = getUserById(id);
      if (!target || target.is_active === 0) {
        await interaction.reply({ embeds: [errorEmbed('Сотрудник не найден.')], ephemeral: true });
        return;
      }
      const patch = {};
      if (role) patch.role = role;
      if (spec !== null) patch.specialty = spec;
      if (fio) {
        if (fio.trim().split(' ').length < 2) { await interaction.reply({ embeds: [errorEmbed('ФИО минимум 2 слова.')], ephemeral: true }); return; }
        patch.full_name = fio.trim();
      }
      if (!Object.keys(patch).length) {
        await interaction.reply({ embeds: [errorEmbed('Нечего менять. Укажите роль/специальность/ФИО.')], ephemeral: true });
        return;
      }
      updateStaff(id, patch);
      await interaction.reply({ embeds: [successEmbed('Сотрудник обновлён', `**${target.full_name}** (#${id})\n` + Object.entries(patch).map(([k, v]) => `${k}: \`${v}\``).join('\n'))], ephemeral: true });
      return;
    }

    if (sub === 'уволить') {
      const id = interaction.options.getInteger('id');
      const target = getUserById(id);
      if (!target || target.is_active === 0) {
        await interaction.reply({ embeds: [errorEmbed('Сотрудник не найден.')], ephemeral: true });
        return;
      }
      if (target.discord_id === interaction.user.id) {
        await interaction.reply({ embeds: [errorEmbed('Нельзя уволить самого себя.')], ephemeral: true });
        return;
      }
      deactivateStaff(id);
      await interaction.reply({ embeds: [successEmbed('Сотрудник уволен', `**${target.full_name}** (#${id}, ${target.role}) — деактивирован.`)], ephemeral: true });
      return;
    }
  },
};
