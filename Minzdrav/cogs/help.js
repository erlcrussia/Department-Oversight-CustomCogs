const { SlashCommandBuilder } = require('discord.js');
const { helpContainer, FLAGS } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('помощь')
    .setNameLocalizations({ 'en-US': 'help', 'en-GB': 'help' })
    .setDescription('Помощь по ЕМИАС')
    .setDescriptionLocalizations({ 'en-US': 'EMIAS help' }),

  async execute(interaction) {
    await interaction.reply({ components: [helpContainer()], flags: FLAGS, ephemeral: true });
  },
};
