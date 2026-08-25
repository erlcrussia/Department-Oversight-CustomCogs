const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { setDoctorStatus, getUserByDiscordId } = require('../dataUtils/emias');
const { DOCTOR_STATUS_LABELS } = require('../utils/constants');
const { isStaff } = require('../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('статус')
    .setDescription('Ваш рабочий статус (для врачей)')
    .addStringOption(o => o.setName('состояние').setDescription('Новый статус').setRequired(true)
      .addChoices(
        { name: 'Свободен', value: 'free' },
        { name: 'На приёме', value: 'in_appointment' },
        { name: 'Не на смене', value: 'offline' },
      )),

  async execute(interaction) {
    const staff = getUserByDiscordId(interaction.user.id);
    if (!isStaff(staff)) {
      await interaction.reply({ embeds: [errorEmbed('Вы не являетесь сотрудником.')], ephemeral: true });
      return;
    }
    const st = interaction.options.getString('состояние');
    const updated = setDoctorStatus(interaction.user.id, st);
    if (!updated) {
      await interaction.reply({ embeds: [errorEmbed('Не удалось обновить статус.')], ephemeral: true });
      return;
    }
    await interaction.reply({ embeds: [successEmbed('Статус обновлён', `Ваш статус: **${DOCTOR_STATUS_LABELS[st]}**`)], ephemeral: true });
  },
};
