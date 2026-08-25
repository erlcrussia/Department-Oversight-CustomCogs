const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { getUserByDiscordId, getPatientById, setPatientBlocked, searchPatients } = require('../dataUtils/emias');
const { ROLES } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('блок')
    .setDescription('Заблокировать персонажа (Главврач)')
    .addIntegerOption(o => o.setName('персонаж').setDescription('ID пациента').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('причина').setDescription('Причина блокировки')),

  async autocomplete(interaction) {
    const q = interaction.options.getFocused().toString().toLowerCase();
    const list = searchPatients(q || '', 25);
    const choices = list.map(p => ({ name: `${p.full_name} · ${p.card_number} (#${p.id}) ${p.status === 'blocked' ? '🔴' : ''}`.substring(0, 100), value: p.id }));
    await interaction.respond(choices);
  },

  async execute(interaction) {
    const actor = getUserByDiscordId(interaction.user.id);
    if (!actor || actor.role !== ROLES.HEAD_PHYSICIAN) {
      await interaction.reply({ embeds: [errorEmbed('Только Главврач может блокировать.')], ephemeral: true });
      return;
    }
    const pid = interaction.options.getInteger('персонаж');
    const reason = interaction.options.getString('причина') || '—';
    const p = getPatientById(pid);
    if (!p) { await interaction.reply({ embeds: [errorEmbed('Пациент не найден.')], ephemeral: true }); return; }
    if (p.status === 'blocked') { await interaction.reply({ embeds: [errorEmbed('Пациент уже заблокирован.')], ephemeral: true }); return; }
    setPatientBlocked(pid, true, actor.id);
    await interaction.reply({ embeds: [successEmbed('Персонаж заблокирован', `**${p.full_name}** (\`${p.card_number}\`)\nПричина: ${reason}\nЗаблокировал: <@${actor.discord_id}>`)] , ephemeral: false });
    if (p.discord_id) {
      try { const u = await interaction.client.users.fetch(p.discord_id); await u.send(`🔴 Ваш персонаж **${p.full_name}** заблокирован главврачом. Причина: ${reason}`); } catch {}
    }
  },
};
