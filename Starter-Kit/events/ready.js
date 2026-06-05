const logger = global.logger || console; // Вы можете импортировать глобальный логгер этого бота
module.exports = {
    name: 'ready',
    once: true,
    async execute() {
        logger.info(`${botName} готов к работе!`);
    }
};