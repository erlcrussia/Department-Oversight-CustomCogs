const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, ChannelType } = require('discord.js');
const { SPECIALTIES } = require('./constants');

// ─── Главные панели — ряды кнопок (минимум эмодзи, контейнеры V2) ──────

function mainRows(isStaff, isDoctor, isHead) {
  const rows = [];

  // Ряд 1 — гражданин
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('emias:book').setLabel('Записаться').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('emias:tickets').setLabel('Мои талоны').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('emias:link').setLabel('Привязать').setStyle(ButtonStyle.Secondary),
    )
  );
  // Ряд 1b — код для сайта
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('emias:site-code').setLabel('Код для сайта').setStyle(ButtonStyle.Secondary),
    )
  );

  // Ряд 2 — сотрудник
  if (isStaff) {
    const staffRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('emias:queue').setLabel('Очередь').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('emias:card').setLabel('Карта').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('emias:status').setLabel('Статус').setStyle(ButtonStyle.Secondary),
    );
    if (isDoctor || isHead) {
      staffRow.addComponents(
        new ButtonBuilder().setCustomId('emias:admit').setLabel('Прием').setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(staffRow);

    // Ряд 3 — врач доп.
    if (isDoctor || isHead) {
      rows.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('emias:prescription').setLabel('Рецепт').setStyle(ButtonStyle.Secondary),
        )
      );
    }
  }

  // Ряд — интеграции (только главврач): открыть панель настроек
  if (isHead) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('emias:integrations').setLabel('Интеграции').setStyle(ButtonStyle.Primary),
      )
    );
  }

  return rows;
}

function integrationSettingsRows(settings, cat = 'bookings') {
  const rows = [];

  // Навигация по категориям (листание)
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('integ:cat:bookings')
        .setLabel('Записи')
        .setStyle(cat === 'bookings' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('integ:cat:notify')
        .setLabel('Уведомления')
        .setStyle(cat === 'notify' ? ButtonStyle.Primary : ButtonStyle.Secondary),
    )
  );

  // Контролы активной категории
  if (cat === 'bookings') {
    const chMenu = new ChannelSelectMenuBuilder()
      .setCustomId('integ:channel')
      .setPlaceholder(settings.bookingChannelId ? `Текущий: <#${settings.bookingChannelId}>` : 'Выберите канал для записей')
      .setMinValues(1)
      .setMaxValues(1)
      .addChannelTypes(ChannelType.GuildText);
    if (settings.bookingChannelId) chMenu.setDefaultChannels([settings.bookingChannelId]);
    rows.push(new ActionRowBuilder().addComponents(chMenu));
  } else {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('integ:ping-doctor')
          .setLabel(`Пинг врача: ${settings.pingDoctor ? 'ВКЛ' : 'ВЫКЛ'}`)
          .setStyle(settings.pingDoctor ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('integ:ping-patient')
          .setLabel(`Пинг пациента: ${settings.pingPatient ? 'ВКЛ' : 'ВЫКЛ'}`)
          .setStyle(settings.pingPatient ? ButtonStyle.Success : ButtonStyle.Secondary),
      )
    );
  }

  return rows;
}

function staffRows() {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('staff:add').setLabel('Добавить').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('staff:list').setLabel('Список').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('staff:stats').setLabel('Статистика').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('staff:wipe').setLabel('Очистка').setStyle(ButtonStyle.Danger),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('staff:block').setLabel('Блок').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('staff:unblock').setLabel('Разблок').setStyle(ButtonStyle.Secondary),
    ),
  ];
}

function statusSelectRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('emias:status:select')
      .setPlaceholder('Выберите статус')
      .addOptions(
        { label: 'Свободен', value: 'free', description: 'Готов к приёму' },
        { label: 'На приёме', value: 'in_appointment', description: 'Занят' },
        { label: 'Не на смене', value: 'offline', description: 'Оффлайн' },
      )
  );
}

function wipeSelectRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('staff:wipe:select')
      .setPlaceholder('Что очистить')
      .addOptions(
        { label: 'Талоны + ЭМК + рецепты', value: 'tickets', description: 'Оставить пациентов' },
        { label: 'Всё (пациенты + талоны)', value: 'all', description: 'Полная очистка — только реальные останутся' },
      )
  );
}

module.exports = { mainRows, staffRows, statusSelectRow, wipeSelectRow, integrationSettingsRows };
