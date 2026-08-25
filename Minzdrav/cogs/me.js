const { SlashCommandBuilder } = require('discord.js');
const { brandEmbed, footer } = require('../utils/embeds');
const { getCitizensByDiscordId, getUserByDiscordId } = require('../dataUtils/emias');
const { ROLES } = require('../utils/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('я')
    .setDescription('Ваши персонажи и роль сотрудника')
    .setDescriptionLocalizations({ 'en-US': 'Your characters and staff role' }),

  async execute(interaction) {
    const discordId = interaction.user.id;
    const citizens = getCitizensByDiscordId(discordId);
    const staff = getUserByDiscordId(discordId);

    const e = brandEmbed({ title: `Профиль · ${interaction.user.username}` });
    e.setThumbnail(interaction.user.displayAvatarURL());

    if (staff) {
      e.addFields({ name: '🩺 Сотрудник', value: `**${staff.full_name}**\nРоль: \`${staff.role}\`${staff.specialty ? ` · ${staff.specialty}` : ''}\nСтатус: \`${staff.status}\``, inline: false });
    } else {
      e.addFields({ name: '🩺 Сотрудник', value: 'Не числитесь в штате. Обратитесь к главврачу.', inline: false });
    }

    if (citizens.length) {
      const lines = citizens.map(c => `**${c.full_name}** · \`${c.card_number}\`${c.status === 'blocked' ? ' 🔴 заблокирован' : ''}`).join('\n').substring(0, 1024);
      e.addFields({ name: `👤 Персонажи (${citizens.length})`, value: lines, inline: false });
    } else {
      e.addFields({ name: '👤 Персонажи', value: 'Нет привязанных персонажей. Используйте `/привязать` с кодом из личного кабинета.', inline: false });
    }

    footer(e);
    await interaction.reply({ embeds: [e], ephemeral: true });
  },
};
