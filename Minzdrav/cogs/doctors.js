const { SlashCommandBuilder } = require('discord.js');
const { doctorsEmbed, errorEmbed } = require('../utils/embeds');
const { getDoctors } = require('../dataUtils/emias');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('врачи')
    .setDescription('Активные врачи поликлиники')
    .setNameLocalizations({ 'en-US': 'doctors' }),

  async execute(interaction) {
    const docs = getDoctors();
    const e = doctorsEmbed(docs);
    await interaction.reply({ embeds: [e], ephemeral: true });
  },
};
