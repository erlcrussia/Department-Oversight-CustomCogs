const { ActivityType } = require('discord.js');

const statusList = [
  { name: '-!о боте | erlcrussia.com', type: ActivityType.Custom },
];
let currentIndex = 0;

module.exports = {
  name: 'status-changer',
  interval: 300000, // 5 минут если кто не понял

  execute: (client, logger) => { // Вы можете передать глобальный логгер этого бота или передать как в /events/ready.js
    if (!client.user) return;

    const status = statusList[currentIndex];
    client.user.setActivity(status.name, { type: status.type });

    logger.info(`👀 Статус обновлён: ${status.name} (${ActivityType[status.type]})`);
    currentIndex = (currentIndex + 1) % statusList.length;
  }
};