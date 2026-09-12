/*
 * ═════════════════════════════════════════════════════════════
 *  index.js — Тестовый запуск CustomCogs
 * ═════════════════════════════════════════════════════════════
 *  ⚠️  ЭТОТ ФАЙЛ НЕЛЬЗЯ МЕНЯТЬ!
 *  Если нужно изменить логику тестирования — создайте новый
 *  файл, но НЕ редактируйте этот.
 *
 *  Использование:
 *    node index.js <фракция>
 *
 *  Пример:
 *    node index.js MVD
 *
 *  Файл автоматически загружает все коги, события и задачи
 *  указанной фракции из <фракция>/.
 * ═════════════════════════════════════════════════════════════
 */

const { Client, GatewayIntentBits, Events, Collection } = require('discord.js');
const path = require('path');
const fs = require('fs');

const FACTION = process.argv[2];

if (!FACTION) {
    console.error('Укажите фракцию: node index.js <фракция>');
    process.exit(1);
}

const factionPath = path.join(__dirname, FACTION);

if (!fs.existsSync(factionPath)) {
    console.error(`Директория фракции не найдена: ${factionPath}`);
    process.exit(1);
}

require('dotenv').config({ path: path.join(__dirname, '.env') });

const BOT_TOKEN = process.env.TEST_BOT_TOKEN || process.env.DISCORD_TOKEN;

let prisma;
try {
    prisma = require(path.join(__dirname, 'prisma', 'client'));
} catch {
    prisma = null;
}

const logger = console;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
global.logger = logger;

const commandsData = [];

function loadCogs(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            loadCogs(fullPath);
            continue;
        }

        if (!file.endsWith('.js')) continue;

        try {
            delete require.cache[require.resolve(fullPath)];
            const cog = require(fullPath);

            if (cog && cog.data && cog.data.name) {
                const key = cog.data.name;
                client.commands.set(key, cog);
                logger.info(`[INFO] Загружена команда: /${key}`);

                if (cog.data.toJSON) {
                    commandsData.push(cog.data.toJSON());
                }

                if (typeof cog.setup === 'function') {
                    cog.setup(client, logger);
                }
            } else if (cog && cog.name && typeof cog.execute === 'function' && typeof cog.interval === 'number') {
                logger.info(`[INFO] Загружена задача: ${cog.name}`);
                setInterval(() => cog.execute(client, logger), cog.interval);
                cog.execute(client, logger);
            } else {
                logger.info(`[INFO] Загружен модуль: ${file}`);
            }
        } catch (e) {
            logger.error(`[ERROR] Ошибка загрузки ${file}:`, e.message);
        }
    }
}

function loadEvents(dir) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    for (const file of files) {
        try {
            const eventPath = path.join(dir, file);
            delete require.cache[require.resolve(eventPath)];
            const event = require(eventPath);

            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
            logger.info(`[INFO] Загружено событие: ${event.name} из ${file}`);
        } catch (e) {
            logger.error(`[ERROR] Ошибка загрузки события ${file}:`, e.message);
        }
    }
}

loadCogs(path.join(factionPath, 'cogs'));
loadCogs(path.join(factionPath, 'tasks'));
loadEvents(path.join(factionPath, 'events'));

client.once(Events.ClientReady, async () => {
    logger.info(`[INFO] Тестовый бот ${client.user.tag} запущен для фракции ${FACTION}`);
    logger.info(`[INFO] Серверов: ${client.guilds.cache.size}`);

    try {
        for (const [, guild] of client.guilds.cache) {
            await guild.members.fetch();
        }
    } catch (e) {
        logger.warn(`[WARNING] Ошибка кэширования участников:`, e.message);
    }

    logger.info(`[INFO] Загружено команд: ${commandsData.length}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        logger.error(`[ERROR] Ошибка команды /${interaction.commandName}:`, error.message);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '[ERROR] Произошла ошибка.', ephemeral: true }).catch(() => { });
        }
    }
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    for (const cog of client.commands.values()) {
        if (typeof cog.handleMessage === 'function') {
            try {
                await cog.handleMessage(message, client);
            } catch (e) {
                logger.error(`[ERROR] Ошибка:`, e.message);
            }
        }
    }
});

process.on('unhandledRejection', (reason) => {
    logger.error('[ERROR] Необработанный отказ промиса:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('[ERROR] Необработанное исключение:', error);
});

client.login(BOT_TOKEN).catch(err => {
    logger.error('[ERROR] Ошибка входа:', err.message);
    process.exit(1);
});
