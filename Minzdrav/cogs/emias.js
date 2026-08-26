const { SlashCommandBuilder } = require('discord.js');
const { mainPanelContainer, FLAGS } = require('../utils/embeds');
const { mainRows } = require('../utils/panels');
const emias = require('../dataUtils/emias');
const { isStaff, isDoctor, isHeadPhysician } = require('../utils/permissions');

module.exports = {
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
};
