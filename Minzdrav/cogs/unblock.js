const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { getUserByDiscordId, getPatientById, setPatientBlocked, searchPatients } = require('../dataUtils/emias');
const { ROLES } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('разблок')
    .setDescription('Разблокировать персонажа (Главврач)')
    .addIntegerOption(o => o.setName('персонаж').setDescription('ID пациента').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction) {
    const q = interaction.options.getFocused().toString().toLowerCase();
    const list = searchPatients(q || '', 25).filter(p => p.status === 'blocked');
    const choices = list.map(p => ({ name: `${p.full_name} · ${p.card_number} (#${p.id})`.substring(0, 100), value: p.id }));
    await interaction.respond(choices);
  },

  async execute(interaction) {
    const actor = getUserByDiscordId(interaction.user.id);
    if (!actor || actor.role !== ROLES.HEAD_PHYSICIAN) {
      await interaction.reply({ embeds: [errorEmbed('Только Главврач.')], ephemeral: true });
      return;
    }
    const pid = interaction.options.getInteger('персонаж');
    const p = getPatientById(pid);
    if (!p) { await interaction.reply({ embeds: [errorEmbed('Пациент не найден.')], ephemeral: true }); return; }
    if (p.status !== 'blocked') { await interaction.reply({ embeds: [errorEmbed('Пациент не заблокирован.')], ephemeral: true }); return; }
    setPatientBlocked(pid, false, actor.id);
    await interaction.reply({ embeds: [successEmbed('Разблокирован', `**${p.full_name}** (\`${p.card_number}\`) — снова активен.`)] , ephemeral: false });
  },
};
