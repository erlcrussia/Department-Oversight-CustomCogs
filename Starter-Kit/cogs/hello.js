const { SlashCommandBuilder } = require('discord.js');
const { t, getLang } = require('../../../utils/locale');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('привет')
        .setNameLocalizations({ 'en-US': 'hello', 'en-GB': 'hello' })
        .setDescription('Простое приветствие от бота.')
        .setDescriptionLocalizations({
            'en-US': 'A simple greeting from the bot.',
            'en-GB': 'A simple greeting from the bot.',
            'ru': 'Простое приветствие от бота.'
        }),

    async execute(interaction) {
        const lang = await getLang(interaction.guildId);
        await interaction.reply({ content: t(lang, 'erl.hello.greeting', interaction.user.username), allowedMentions: { parse: [] } });
    }
};