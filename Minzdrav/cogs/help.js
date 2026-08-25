const { SlashCommandBuilder } = require('discord.js');
const { helpEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('помощь')
    .setNameLocalizations({ 'en-US': 'help', 'en-GB': 'help' })
    .setDescription('Список команд ЕМИАС')
    .setDescriptionLocalizations({ 'en-US': 'EMIAS help', 'en-GB': 'EMIAS help' }),

  async execute(interaction) {
    await interaction.reply({ embeds: [helpEmbed()], ephemeral: true });
  },
};
