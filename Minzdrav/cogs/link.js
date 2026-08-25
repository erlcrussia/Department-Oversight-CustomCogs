const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed } = require('../utils/embeds');
const { linkPatientByCode } = require('../dataUtils/emias');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('привязать')
    .setDescription('Привязать персонажа по коду с сайта')
    .addStringOption(o => o.setName('код').setDescription('6-значный код из личного кабинета').setRequired(true)),

  async execute(interaction) {
    const code = interaction.options.getString('код');
    try {
      const patient = linkPatientByCode(code, interaction.user.id);
      const e = successEmbed('Привязка успешна', `Персонаж **${patient.full_name}** (\`${patient.card_number}\`) привязан к <@${interaction.user.id}>.`);
      await interaction.reply({ embeds: [e], ephemeral: true });
    } catch (err) {
      let msg = 'Ошибка привязки.';
      if (err.code === 'NOT_FOUND') msg = 'Код не найден. Проверьте правильность.';
      else if (err.code === 'USED') msg = 'Код уже использован.';
      else if (err.code === 'EXPIRED') msg = 'Срок кода истёк (15 мин). Сгенерируйте новый на сайте.';
      await interaction.reply({ embeds: [errorEmbed(msg)], ephemeral: true });
    }
  },
};
