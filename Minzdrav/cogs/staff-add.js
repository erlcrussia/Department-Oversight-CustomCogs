const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { getUserByDiscordId, createStaff, getAllStaff } = require('../dataUtils/emias');
const { ROLES, SPECIALTIES } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('добавить-сотрудника')
    .setDescription('Добавить сотрудника (только Главврач)')
    .addUserOption(o => o.setName('пользователь').setDescription('Discord пользователь').setRequired(true))
    .addStringOption(o => o.setName('фио').setDescription('ФИО сотрудника (напр. Иванов Иван Иванович)').setRequired(true))
    .addStringOption(o => o.setName('роль').setDescription('Роль').setRequired(true)
      .addChoices(
        { name: 'Главный врач', value: ROLES.HEAD_PHYSICIAN },
        { name: 'Врач', value: ROLES.PHYSICIAN },
        { name: 'Регистратор', value: ROLES.REGISTRAR },
        { name: 'Медсестра', value: ROLES.NURSE },
      ))
    .addStringOption(o => o.setName('специальность').setDescription('Специальность (для врачей)').setAutocomplete(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'специальность') {
      const q = focused.value.toLowerCase();
      const choices = SPECIALTIES.map(s => ({ name: s.name, value: s.code }));
      const filtered = q ? choices.filter(c => c.name.toLowerCase().includes(q)) : choices;
      await interaction.respond(filtered.slice(0, 25));
    }
  },

  async execute(interaction) {
    const actor = getUserByDiscordId(interaction.user.id);
    // Если в БД ещё нет главврача — разрешаем первому администратору сервера
    const all = getAllStaff();
    const hasHead = all.some(u => u.role === ROLES.HEAD_PHYSICIAN && u.is_active === 1);
    const isHead = actor && actor.role === ROLES.HEAD_PHYSICIAN;
    const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);

    if (hasHead && !isHead) {
      await interaction.reply({ embeds: [errorEmbed('Только Главврач может добавлять сотрудников.')], ephemeral: true });
      return;
    }
    if (!hasHead && !isAdmin && !isHead) {
      await interaction.reply({ embeds: [errorEmbed('Первым сотрудником может стать только администратор сервера. Нет активного Главврача.')], ephemeral: true });
      return;
    }

    const user = interaction.options.getUser('пользователь');
    const fio = interaction.options.getString('фио');
    const role = interaction.options.getString('роль');
    const specialty = interaction.options.getString('специальность');

    if (role === ROLES.PHYSICIAN && !specialty) {
      await interaction.reply({ embeds: [errorEmbed('Для врача укажите специальность (напр. терапевт).')], ephemeral: true });
      return;
    }
    if (role !== ROLES.PHYSICIAN && role !== ROLES.HEAD_PHYSICIAN && specialty) {
      // игнор
    }

    const existing = getUserByDiscordId(user.id);
    if (existing) {
      await interaction.reply({ embeds: [errorEmbed(`Пользователь <@${user.id}> уже в штате как **${existing.full_name}** (${existing.role}). Используйте \`/персонал\` для изменения.`)], ephemeral: true });
      return;
    }

    if (!/^.{5,100}$/.test(fio.trim()) || fio.trim().split(' ').length < 2) {
      await interaction.reply({ embeds: [errorEmbed('ФИО должно содержать минимум 2 слова (5-100 символов).')], ephemeral: true });
      return;
    }

    try {
      const id = createStaff({
        discordId: user.id,
        discordUsername: user.username,
        fullName: fio.trim(),
        specialty: specialty || null,
        role,
      });
      const specLabel = specialty ? ` · ${SPECIALTIES.find(s => s.code === specialty)?.name || specialty}` : '';
      await interaction.reply({ embeds: [successEmbed('Сотрудник добавлен', `<@${user.id}> → **${fio}**\nРоль: \`${role}\`${specLabel}\nID: \`${id}\``)], ephemeral: false });
    } catch (e) {
      await interaction.reply({ embeds: [errorEmbed('Ошибка: ' + e.message)], ephemeral: true });
    }
  },
};
