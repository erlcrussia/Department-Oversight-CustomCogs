const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('привет')
        .setDescription('Простое приветствие от бота.'),

    async execute(interaction) {
        await interaction.reply({ content: `Привет, ${interaction.user.username}!`, allowedMentions: { parse: [] } });
    },

    prefix: {
        command: 'привет',
        aliases: ['hello', 'hi'],
        async run(message, args, client) {
            await message.reply({ content: `Привет, ${message.author.username}!`, allowedMentions: { parse: [] } });
        }
    }
};