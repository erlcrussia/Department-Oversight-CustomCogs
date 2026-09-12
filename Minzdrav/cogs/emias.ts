import { SlashCommandBuilder } from 'discord.js';
import { mainPanelContainer, FLAGS } from '../utils/embeds.js';
import { mainRows } from '../utils/panels.js';
import emias from '../dataUtils/emias.js';
import { isStaff, isDoctor, isHeadPhysician } from '../utils/permissions.js';
import interactionHandler from '../events/interactionCreate.js';

export default {
  data: new SlashCommandBuilder()
    .setName('емиас')
    .setNameLocalizations({ 'en-US': 'emias', 'en-GB': 'emias' })
    .setDescription('Главная панель ЕМИАС')
    .setDescriptionLocalizations({ 'en-US': 'EMIAS main panel' }),

  async execute(interaction) {
    const user = interaction.user;
    const gid = interaction.guildId;
    const staff = await emias.getUserByDiscordId(user.id, gid);
    const citizens = await emias.getCitizensByDiscordId(user.id, gid);

    const container = mainPanelContainer({ user, staff, citizens });
    const rows = mainRows(!!staff && isStaff(staff), staff && isDoctor(staff), staff && isHeadPhysician(staff));

    await interaction.reply({
      components: [container, ...rows],
      flags: FLAGS,
      ephemeral: true,
    });
  },

  async onInteraction(interaction, context) {
    const id = interaction.customId || '';
    if (id.startsWith('emias:') || id.startsWith('staff:') || id.startsWith('integ:')) {
      await interactionHandler.execute(interaction, context?.client);
      return true;
    }
    return false;
  },

  async handleModal(interaction, context) {
    const id = interaction.customId || '';
    if (id.startsWith('emias:') || id.startsWith('staff:') || id.startsWith('integ:')) {
      await interactionHandler.execute(interaction, context?.client);
      return true;
    }
    return false;
  },
};
