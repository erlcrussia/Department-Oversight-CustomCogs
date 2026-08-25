const { SlashCommandBuilder } = require('discord.js');
const { patientCardEmbed, errorEmbed } = require('../utils/embeds');
const { getPatientCard, getUserByDiscordId, searchPatients } = require('../dataUtils/emias');
const { canSeeMedicalData, isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('карта')
    .setDescription('Карточка пациента — сотрудникам')
    .addIntegerOption(o => o.setName('персонаж').setDescription('ID пациента').setRequired(true).setAutocomplete(true)),

  async autocomplete(interaction) {
    const q = interaction.options.getFocused().toString().toLowerCase();
    const list = searchPatients(q || '', 25);
    const choices = list.map(p => ({ name: `${p.full_name} · ${p.card_number} (#${p.id})`.substring(0, 100), value: p.id }));
    await interaction.respond(choices);
  },

  async execute(interaction) {
    const staff = getUserByDiscordId(interaction.user.id);
    if (!isStaff(staff)) {
      await interaction.reply({ embeds: [errorEmbed('Команда только для сотрудников.')], ephemeral: true });
      return;
    }
    const pid = interaction.options.getInteger('персонаж');
    const card = getPatientCard(pid);
    if (!card) {
      await interaction.reply({ embeds: [errorEmbed('Пациент не найден.')], ephemeral: true });
      return;
    }
    // Регистратор видит только демографию
    let records = card.records;
    let prescriptions = card.prescriptions;
    if (!canSeeMedicalData(staff)) {
      records = [];
      prescriptions = [];
    }
    const e = patientCardEmbed(card.patient, card.tickets, records, prescriptions);
    if (!canSeeMedicalData(staff) && (card.records.length || card.prescriptions.length)) {
      e.addFields({ name: 'ℹ️ Доступ', value: 'Медданные скрыты: доступны только врачам и главврачу.', inline: false });
    }
    await interaction.reply({ embeds: [e], ephemeral: true });
  },
};
