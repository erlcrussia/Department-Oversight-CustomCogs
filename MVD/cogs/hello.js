const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gagegaming99')
        .setDescription('Приветствует пользователя gagegaming99 от бота Управление Департаментами.'),

    async execute(interaction) {
        await interaction.reply(`Привет, ${interaction.user.username}! Это команда с бота Управление Департаментами.`);
    }
};