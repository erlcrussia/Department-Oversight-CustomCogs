import { SlashCommandBuilder } from 'discord.js';
import { helpContainer, FLAGS } from '../utils/embeds.js';

export default {
  data: new SlashCommandBuilder()
    .setName('помощь')
    .setNameLocalizations({ 'en-US': 'help', 'en-GB': 'help' })
    .setDescription('Помощь по ЕМИАС')
    .setDescriptionLocalizations({ 'en-US': 'EMIAS help' }),

  async execute(interaction) {
    await interaction.reply({ components: [helpContainer()], flags: FLAGS, ephemeral: true });
  },
};
