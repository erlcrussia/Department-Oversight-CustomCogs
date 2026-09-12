const logger = global.logger || console; // Вы можете импортировать глобальный логгер этого бота
module.exports = {
    name: 'ready',
    once: true,
    async execute() {
        const botName = (global as any).botName || 'Бот';
        logger.info(`${botName} готов к работе!`);
    }
};