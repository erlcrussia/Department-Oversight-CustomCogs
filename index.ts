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

import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const BOT_TOKEN = process.env.TEST_BOT_TOKEN || process.env.DISCORD_TOKEN;

let prisma: any = null;
try {
    const pPath = path.resolve(__dirname, '..', 'prisma', 'client.js');
    if (fs.existsSync(pPath)) {
        const pMod = await import(pathToFileURL(pPath).href);
        prisma = pMod.default || pMod.prisma || pMod;
    }
} catch {
    prisma = null;
}

const logger = console;

const client: any = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.commands = new Collection();
(global as any).logger = logger;

const commandsData: any[] = [];

async function loadCogs(dir: string) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            await loadCogs(fullPath);
            continue;
        }

        if (!file.endsWith('.js') && !file.endsWith('.ts')) continue;
        if (file.endsWith('.d.ts')) continue;

        try {
            const cogModule = await import(pathToFileURL(fullPath).href);
            const cog = cogModule.default || cogModule;

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
        } catch (e: any) {
            logger.error(`[ERROR] Ошибка загрузки ${file}:`, e.message);
        }
    }
}

async function loadEvents(dir: string) {
    if (!fs.existsSync(dir)) return;

    const files = fs.readdirSync(dir).filter(f => (f.endsWith('.js') || f.endsWith('.ts')) && !f.endsWith('.d.ts'));
    for (const file of files) {
        try {
            const eventPath = path.join(dir, file);
            const eventModule = await import(pathToFileURL(eventPath).href);
            const event = eventModule.default || eventModule;

            if (event.once) {
                client.once(event.name, (...args: any[]) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args: any[]) => event.execute(...args, client));
            }
            logger.info(`[INFO] Загружено событие: ${event.name} из ${file}`);
        } catch (e: any) {
            logger.error(`[ERROR] Ошибка загрузки события ${file}:`, e.message);
        }
    }
}

await loadCogs(path.join(factionPath, 'cogs'));
await loadCogs(path.join(factionPath, 'tasks'));
await loadEvents(path.join(factionPath, 'events'));

client.once(Events.ClientReady, async () => {
    logger.info(`[INFO] Тестовый бот ${client.user.tag} запущен для фракции ${FACTION}`);
    logger.info(`[INFO] Серверов: ${client.guilds.cache.size}`);

    try {
        for (const [, guild] of client.guilds.cache) {
            await guild.members.fetch();
        }
    } catch (e: any) {
        logger.warn(`[WARNING] Ошибка кэширования участников:`, e.message);
    }

    logger.info(`[INFO] Загружено команд: ${commandsData.length}`);
});

client.on(Events.InteractionCreate, async (interaction: any) => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error: any) {
        logger.error(`[ERROR] Ошибка команды /${interaction.commandName}:`, error.message);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '[ERROR] Произошла ошибка.', ephemeral: true }).catch(() => { });
        }
    }
});

client.on(Events.MessageCreate, async (message: any) => {
    if (message.author.bot) return;

    for (const cog of client.commands.values()) {
        if (typeof cog.handleMessage === 'function') {
            try {
                await cog.handleMessage(message, client);
            } catch (e: any) {
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

client.login(BOT_TOKEN).catch((err: any) => {
    logger.error('[ERROR] Ошибка входа:', err.message);
    process.exit(1);
});
