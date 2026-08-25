const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { getUserByDiscordId, getPatientById, addPrescription, searchPatients } = require('../dataUtils/emias');
const { ROLES } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('рецепт')
    .setDescription('Выписать рецепт (врачи)')
    .addIntegerOption(o => o.setName('персонаж').setDescription('ID пациента').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('препарат').setDescription('Название препарата').setRequired(true))
    .addStringOption(o => o.setName('дозировка').setDescription('Дозировка (напр. 500 мг 2р/день)').setRequired(true))
    .addIntegerOption(o => o.setName('дней').setDescription('Длительность (дней)')),

  async autocomplete(interaction) {
    const list = searchPatients(interaction.options.getFocused().toString(), 25);
    await interaction.respond(list.map(p => ({ name: `${p.full_name} · ${p.card_number} (#${p.id})`.substring(0, 100), value: p.id })));
  },

  async execute(interaction) {
    const staff = getUserByDiscordId(interaction.user.id);
    if (!staff || ![ROLES.PHYSICIAN, ROLES.HEAD_PHYSICIAN].includes(staff.role)) {
      await interaction.reply({ embeds: [errorEmbed('Только для врачей.')], ephemeral: true });
      return;
    }
    const pid = interaction.options.getInteger('персонаж');
    const patient = getPatientById(pid);
    if (!patient) { await interaction.reply({ embeds: [errorEmbed('Пациент не найден.')], ephemeral: true }); return; }
    const med = interaction.options.getString('препарат');
    const dosage = interaction.options.getString('дозировка');
    const days = interaction.options.getInteger('дней');
    const res = addPrescription({ patientId: pid, doctorId: staff.id, medication: med, dosage, durationDays: days });
    await interaction.reply({ embeds: [successEmbed('Рецепт выписан', `Пациент: **${patient.full_name}**\nПрепарат: **${med}** — ${dosage}${days ? ` (${days} дн.)` : ''}\nНомер: \`${res.prescription_number}\``)], ephemeral: true });
  },
};
