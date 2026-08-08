const { ActivityType } = require('discord.js');

const statusList = [
  { name: "Сотрудники ФСБ", type: ActivityType.Watching },
  { name: "ФСБ России", type: ActivityType.Watching },
  { name: "Жалобы и Обращения", type: ActivityType.Watching },
  { name: "Проверка Данных", type: ActivityType.Watching },
  { name: "База Данных", type: ActivityType.Watching },
  { name: "Федеральный Розыск", type: ActivityType.Watching }
];
let currentIndex = 0;

module.exports = {
  name: 'status-changer',
  interval: 300000,

  execute: (client, logger) => {
    if (!client.user) return;

    const status = statusList[currentIndex];
    client.user.setActivity(status.name, { type: status.type });

    logger.info(`👀 Статус обновлён: ${status.name} (${ActivityType[status.type]})`);
    currentIndex = (currentIndex + 1) % statusList.length;
  }
};