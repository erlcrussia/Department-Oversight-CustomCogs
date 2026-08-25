const { ActivityType } = require('discord.js');

const statusList = [
  { name: 'ЕМИАС — Минздрав', type: ActivityType.Watching },
  { name: 'запись к врачам', type: ActivityType.Watching },
  { name: 'электронные карты', type: ActivityType.Watching },
  { name: 'живую очередь', type: ActivityType.Watching },
  { name: 'приёмы и рецепты', type: ActivityType.Watching },
];
let currentIndex = 0;

module.exports = {
  name: 'emias-status',
  interval: 300000, // 5 мин

  execute: (client, logger) => {
    if (!client.user) return;
    const status = statusList[currentIndex];
    client.user.setActivity(status.name, { type: status.type });
    if (logger) logger.info(`[ЕМИАС] Статус: ${status.name}`);
    currentIndex = (currentIndex + 1) % statusList.length;
  },
};
