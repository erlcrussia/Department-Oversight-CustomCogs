import { SlashCommandBuilder } from 'discord.js';
import { t, getLang } from '../../utils/locale.js';

export default {
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
    },

    prefix: {
        command: 'привет',
        aliases: ['hello', 'hi'],
        async run(message: any, args: string[], client: any) {
            const lang = await getLang(message.guildId);
            await message.reply({ content: t(lang, 'erl.hello.greeting', message.author.username), allowedMentions: { parse: [] } });
        }
    }
};