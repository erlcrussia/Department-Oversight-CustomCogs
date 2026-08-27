const {
  Events,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  PermissionFlagsBits,
} = require('discord.js');
const {
  errorContainer,
  successContainer,
  siteCodeContainer,
  integrationSettingsContainer,
  queueContainer,
  cardContainer,
  helpContainer,
  staffPanelContainer,
  FLAGS,
} = require('../utils/embeds');
const { mainRows, staffRows, statusSelectRow, wipeSelectRow, integrationSettingsRows } = require('../utils/panels');
const emias = require('../dataUtils/emias');
const settings = require('../dataUtils/settings');
const { ROLES } = require('../utils/constants');

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction, client) {
    const id = interaction.customId || '';
    const gid = interaction.guildId;

    if (interaction.isChatInputCommand()) return;

    try {
      if (interaction.isButton()) {
        if (id === 'emias:book') return handleBookButton(interaction, gid);
        if (id === 'emias:tickets') return handleTickets(interaction, gid);
        if (id === 'emias:link') return handleLinkButton(interaction);
        if (id === 'emias:site-code') return handleSiteCode(interaction, gid);
        if (id === 'emias:queue') return handleQueue(interaction, gid);
        if (id === 'emias:card') return handleCardButton(interaction);
        if (id === 'emias:status') return handleStatusButton(interaction);
        if (id === 'emias:admit') return handleAdmitButton(interaction, gid);
        if (id === 'emias:prescription') return handlePrescriptionButton(interaction, gid);
        if (id === 'emias:integrations') return handleIntegrations(interaction, gid);
        if (id === 'integ:cat:bookings') return handleIntegCategory(interaction, gid, 'bookings');
        if (id === 'integ:cat:notify') return handleIntegCategory(interaction, gid, 'notify');
        if (id === 'integ:ping-doctor') return handleIntegPingDoctor(interaction, gid);
        if (id === 'integ:ping-patient') return handleIntegPingPatient(interaction, gid);

        if (id === 'staff:add') return handleStaffAddButton(interaction, gid);
        if (id === 'staff:list') return handleStaffList(interaction, gid);
        if (id === 'staff:stats') return handleStats(interaction, gid);
        if (id === 'staff:wipe') return handleWipeButton(interaction);
        if (id === 'staff:block') return handleBlockButton(interaction);
        if (id === 'staff:unblock') return handleUnblockButton(interaction);
      }

      if (interaction.isStringSelectMenu()) {
        if (id === 'emias:status:select') return handleStatusSelect(interaction, gid);
        if (id === 'staff:wipe:select') return handleWipeSelect(interaction, gid);
        if (id === 'integ:channel') return handleIntegChannel(interaction, gid);
      }

      if (interaction.isModalSubmit()) {
        if (id === 'emias:book:modal') return handleBookModal(interaction, gid);
        if (id === 'emias:link:modal') return handleLinkModal(interaction);
        if (id === 'emias:card:modal') return handleCardModal(interaction, gid);
        if (id === 'emias:admit:modal') return handleAdmitModal(interaction, gid);
        if (id === 'emias:prescription:modal') return handlePrescriptionModal(interaction, gid);
        if (id === 'staff:add:modal') return handleStaffAddModal(interaction, gid);
        if (id === 'staff:block:modal') return handleBlockModal(interaction);
        if (id === 'staff:unblock:modal') return handleUnblockModal(interaction);
      }
    } catch (e) {
      console.error('[ЕМИАС] component error', e);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ components: [errorContainer(e.message || 'Ошибка')], flags: FLAGS, ephemeral: true }).catch(() => {});
      } else {
        await interaction.followUp({ components: [errorContainer(e.message || 'Ошибка')], flags: FLAGS, ephemeral: true }).catch(() => {});
      }
    }
  },
};

// ─── Handlers ───────────────────────────────────────────────────────────

async function handleBookButton(interaction, gid) {
  const modal = new ModalBuilder().setCustomId('emias:book:modal').setTitle('Запись к врачу');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('doctor').setLabel('Врач (ID # или ФИО)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('#2 или Соколова')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('date').setLabel('Дата').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('2026-08-30 или сегодня/завтра')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('time').setLabel('Время').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('10:30')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('patient').setLabel('Персонаж ID (пусто = первый)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('1')),
  );
  await interaction.showModal(modal);
}

async function handleBookModal(interaction, gid) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  const doctorRaw = interaction.fields.getTextInputValue('doctor').trim();
  let dateRaw = interaction.fields.getTextInputValue('date').trim();
  const timeRaw = interaction.fields.getTextInputValue('time').trim();
  const patientHint = interaction.fields.getTextInputValue('patient').trim();

  let doctorId = null;
  const m = doctorRaw.match(/#(\d+)/);
  if (m) doctorId = Number(m[1]);
  else {
    const docs = await emias.getDoctors(gid);
    const found = docs.find(d => d.full_name.toLowerCase().includes(doctorRaw.toLowerCase()));
    if (found) doctorId = found.id;
    else throw new Error(`Врач "${doctorRaw}" не найден. Узнайте ID через /штаб → Список.`);
  }

  const today = new Date();
  const fmt = d => d.toISOString().slice(0, 10);
  if (dateRaw === 'сегодня') dateRaw = fmt(today);
  else if (dateRaw === 'завтра') { const t = new Date(today); t.setDate(t.getDate() + 1); dateRaw = fmt(t); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) throw new Error('Дата: YYYY-MM-DD или сегодня/завтра');
  if (dateRaw < fmt(today)) throw new Error('Нельзя на прошедшую дату');
  if (!/^\d{2}:\d{2}$/.test(timeRaw)) throw new Error('Время: HH:MM');

  const citizens = await emias.getCitizensByDiscordId(interaction.user.id, gid);
  if (!citizens.length) throw new Error('Нет привязанных персонажей. Сначала привяжите кодом.');
  let pid;
  if (patientHint) pid = Number(patientHint);
  else if (citizens.length === 1) pid = citizens[0].id;
  else pid = citizens[0].id;
  const patient = await emias.getPatientById(pid);
  if (!patient || patient.discord_id !== interaction.user.id) throw new Error('Персонаж не найден или не ваш.');

  const res = await emias.bookAppointment({ patientId: pid, doctorId, date: dateRaw, time: timeRaw, viaDiscordId: interaction.user.id, guildId: gid });
  await interaction.editReply({ components: [successContainer('Запись создана', `**${patient.full_name}** → врач #${doctorId}\nДата: ${dateRaw} ${timeRaw}\nТалон: \`${res.ticket_number}\``)], flags: FLAGS });

  const doctor = doctorId ? await emias.getUserById(doctorId) : null;
  notifyBooking(interaction, gid, { patient, doctor, ticket: res.ticket_number, date: dateRaw, time: timeRaw }).catch(() => {});
}

async function handleTickets(interaction, gid) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  const citizens = await emias.getCitizensByDiscordId(interaction.user.id, gid);
  if (!citizens.length) {
    await interaction.editReply({ components: [errorContainer('Нет персонажей.')], flags: FLAGS });
    return;
  }
  const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
  const { PRIMARY_COLOR, ICON_URL, DISCLAIMER } = require('../config');
  const c = new ContainerBuilder().setAccentColor(PRIMARY_COLOR);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Мои талоны`));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  let has = false;
  for (const ch of citizens) {
    const card = await emias.getPatientCard(ch.id);
    if (!card.tickets.length) continue;
    has = true;
    const lines = card.tickets.map(t => `\`${t.ticket_number}\` ${t.date} ${t.time} → ${t.doctor_name || '—'} (каб. ${t.room || '—'}) · ${t.status} \`ID:${t.id}\``).join('\n');
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${ch.full_name} · ${ch.card_number}**\n${lines}`));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  }
  if (!has) c.addTextDisplayComponents(new TextDisplayBuilder().setContent('Нет активных талонов. Запишитесь через кнопку Записаться.'));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${DISCLAIMER}`));
  await interaction.editReply({ components: [c], flags: FLAGS });
}

async function handleLinkButton(interaction) {
  const modal = new ModalBuilder().setCustomId('emias:link:modal').setTitle('Привязка персонажа');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('code').setLabel('Код с сайта (6 символов)').setStyle(TextInputStyle.Short).setRequired(true).setMinLength(4).setMaxLength(10))
  );
  await interaction.showModal(modal);
}

async function handleLinkModal(interaction) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  const code = interaction.fields.getTextInputValue('code').trim();
  try {
    const p = await emias.linkPatientByCode(code, interaction.user.id);
    await interaction.editReply({ components: [successContainer('Привязка успешна', `**${p.full_name}** (\`${p.card_number}\`) привязан к <@${interaction.user.id}>.`)], flags: FLAGS });
  } catch (e) {
    let msg = e.message;
    if (e.code === 'NOT_FOUND') msg = 'Код не найден.';
    else if (e.code === 'USED') msg = 'Код уже использован.';
    else if (e.code === 'EXPIRED') msg = 'Срок истёк (15 мин). Сгенерируйте новый.';
    throw new Error(msg);
  }
}

async function handleSiteCode(interaction, gid) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  const { code, expiresAt } = await emias.createSiteAuthCode(interaction.user.id, interaction.user.username, gid);
  const container = siteCodeContainer({ code, expiresAt });
  await interaction.editReply({ components: [container], flags: FLAGS });
}

async function handleQueue(interaction, gid) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  const staff = await emias.getUserByDiscordId(interaction.user.id, gid);
  if (!staff || ![ROLES.HEAD_PHYSICIAN, ROLES.PHYSICIAN, ROLES.REGISTRAR, ROLES.NURSE].includes(staff.role)) {
    throw new Error('Только для сотрудников.');
  }
  const date = new Date().toISOString().slice(0, 10);
  const q = await emias.getQueue(date, gid);
  const container = queueContainer({ date, queue: q });
  await interaction.editReply({ components: [container], flags: FLAGS });
}

async function handleCardButton(interaction) {
  const modal = new ModalBuilder().setCustomId('emias:card:modal').setTitle('Карта пациента');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pid').setLabel('ID пациента').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('1'))
  );
  await interaction.showModal(modal);
}

async function handleCardModal(interaction, gid) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  const staff = await emias.getUserByDiscordId(interaction.user.id, gid);
  if (!staff || ![ROLES.HEAD_PHYSICIAN, ROLES.PHYSICIAN, ROLES.REGISTRAR, ROLES.NURSE].includes(staff.role)) {
    throw new Error('Только для сотрудников.');
  }
  const pid = Number(interaction.fields.getTextInputValue('pid').trim());
  const card = await emias.getPatientCard(pid);
  if (!card) throw new Error('Пациент не найден.');
  const canSee = [ROLES.HEAD_PHYSICIAN, ROLES.PHYSICIAN].includes(staff.role);
  const records = canSee ? card.records : [];
  const prescriptions = canSee ? card.prescriptions : [];
  const container = cardContainer({ patient: card.patient, tickets: card.tickets, records, prescriptions });
  await interaction.editReply({ components: [container], flags: FLAGS });
}

async function handleStatusButton(interaction) {
  await interaction.reply({ components: [statusSelectRow()], ephemeral: true });
}

async function handleStatusSelect(interaction, gid) {
  await interaction.deferUpdate();
  const status = interaction.values[0];
  const staff = await emias.getUserByDiscordId(interaction.user.id, gid);
  if (!staff) throw new Error('Не сотрудник.');
  await emias.setDoctorStatus(interaction.user.id, status, gid);
  const labels = { free: 'Свободен', in_appointment: 'На приёме', offline: 'Не на смене' };
  await interaction.editReply({ components: [successContainer('Статус обновлён', `Новый статус: **${labels[status]}**`)], flags: FLAGS });
  await interaction.followUp({ components: [successContainer('Статус обновлён', `Новый статус: **${labels[status]}**`)], flags: FLAGS, ephemeral: true }).catch(() => {});
}

async function handleAdmitButton(interaction, gid) {
  const staff = await emias.getUserByDiscordId(interaction.user.id, gid);
  if (!staff || ![ROLES.PHYSICIAN, ROLES.HEAD_PHYSICIAN].includes(staff.role)) {
    await interaction.reply({ components: [errorContainer('Только для врачей.')], flags: FLAGS, ephemeral: true });
    return;
  }
  const modal = new ModalBuilder().setCustomId('emias:admit:modal').setTitle('Прием — запись ЭМК');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pid').setLabel('ID пациента').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('complaints').setLabel('Жалобы').setStyle(TextInputStyle.Paragraph).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('code').setLabel('МКБ код (напр. J00)').setStyle(TextInputStyle.Short).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('text').setLabel('Диагноз текст').setStyle(TextInputStyle.Short).setRequired(false)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('notes').setLabel('Заметки / больничный дней').setStyle(TextInputStyle.Short).setRequired(false)),
  );
  await interaction.showModal(modal);
}

async function handleAdmitModal(interaction, gid) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  const staff = await emias.getUserByDiscordId(interaction.user.id, gid);
  if (!staff || ![ROLES.PHYSICIAN, ROLES.HEAD_PHYSICIAN].includes(staff.role)) throw new Error('Только для врачей.');
  const pid = Number(interaction.fields.getTextInputValue('pid').trim());
  const complaints = interaction.fields.getTextInputValue('complaints').trim() || null;
  const code = interaction.fields.getTextInputValue('code').trim() || null;
  const text = interaction.fields.getTextInputValue('text').trim() || null;
  const notesRaw = interaction.fields.getTextInputValue('notes').trim() || null;
  if (code && !/^[A-ZА-Я]\d{2}(\.\d{1,2})?$/i.test(code)) throw new Error('МКБ: формат J00 / I10');
  const patient = await emias.getPatientById(pid);
  if (!patient) throw new Error('Пациент не найден.');
  let sick = null;
  if (notesRaw && /^\d+$/.test(notesRaw)) sick = Number(notesRaw);
  const notes = sick !== null ? null : notesRaw;
  const id = await emias.addEmrRecord({ patientId: pid, doctorId: staff.id, recordType: 'visit', complaints, diagnosisCode: code, diagnosisText: text, notes, sickLeaveDays: sick, guildId: gid });
  await interaction.editReply({ components: [successContainer('Запись добавлена', `Пациент: **${patient.full_name}**\nДиагноз: \`${code || '—'}\` ${text || ''}\nID записи: \`${id}\``)], flags: FLAGS });
}

async function handlePrescriptionButton(interaction, gid) {
  const staff = await emias.getUserByDiscordId(interaction.user.id, gid);
  if (!staff || ![ROLES.PHYSICIAN, ROLES.HEAD_PHYSICIAN].includes(staff.role)) {
    await interaction.reply({ components: [errorContainer('Только для врачей.')], flags: FLAGS, ephemeral: true });
    return;
  }
  const modal = new ModalBuilder().setCustomId('emias:prescription:modal').setTitle('Рецепт');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pid').setLabel('ID пациента').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('med').setLabel('Препарат').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('dosage').setLabel('Дозировка').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('500 мг 2р/день')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('days').setLabel('Дней').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('14')),
  );
  await interaction.showModal(modal);
}

async function handlePrescriptionModal(interaction, gid) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  const staff = await emias.getUserByDiscordId(interaction.user.id, gid);
  if (!staff || ![ROLES.PHYSICIAN, ROLES.HEAD_PHYSICIAN].includes(staff.role)) throw new Error('Только для врачей.');
  const pid = Number(interaction.fields.getTextInputValue('pid').trim());
  const med = interaction.fields.getTextInputValue('med').trim();
  const dosage = interaction.fields.getTextInputValue('dosage').trim();
  const daysRaw = interaction.fields.getTextInputValue('days').trim();
  const patient = await emias.getPatientById(pid);
  if (!patient) throw new Error('Пациент не найден.');
  const days = daysRaw ? Number(daysRaw) : null;
  const res = await emias.addPrescription({ patientId: pid, doctorId: staff.id, medication: med, dosage, durationDays: days, guildId: gid });
  await interaction.editReply({ components: [successContainer('Рецепт выписан', `**${patient.full_name}**\n${med} — ${dosage}${days ? ` (${days} дн.)` : ''}\nНомер: \`${res.prescription_number}\``)], flags: FLAGS });
}

// ─── Штаб ───────────────────────────────────────────────────────────────

async function handleStaffAddButton(interaction, gid) {
  const actor = await emias.getUserByDiscordId(interaction.user.id, gid);
  const all = await emias.getAllStaff(gid);
  const hasHead = all.some(u => u.role === ROLES.HEAD_PHYSICIAN && u.is_active === 1);
  const isHead = actor && actor.role === ROLES.HEAD_PHYSICIAN;
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  if (hasHead && !isHead) { await interaction.reply({ components: [errorContainer('Только главврач.')], flags: FLAGS, ephemeral: true }); return; }
  if (!hasHead && !isAdmin && !isHead) { await interaction.reply({ components: [errorContainer('Первым — только админ.')], flags: FLAGS, ephemeral: true }); return; }
  const modal = new ModalBuilder().setCustomId('staff:add:modal').setTitle('Добавить сотрудника');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('discordId').setLabel('Discord ID').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('123456789012345678')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('fio').setLabel('ФИО').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Иванов Иван Иванович')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('role').setLabel('Роль').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('Главный врач / Врач / Регистратор / Медсестра')),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('specialty').setLabel('Специальность (для врачей)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('terapevt')),
  );
  await interaction.showModal(modal);
}

async function handleStaffAddModal(interaction, gid) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  const discordId = interaction.fields.getTextInputValue('discordId').trim();
  const fio = interaction.fields.getTextInputValue('fio').trim();
  const roleRaw = interaction.fields.getTextInputValue('role').trim();
  const specialty = interaction.fields.getTextInputValue('specialty').trim() || null;
  if (!/^\d{5,25}$/.test(discordId)) throw new Error('Discord ID: 5-25 цифр');
  const roleMap = { 'главный врач': ROLES.HEAD_PHYSICIAN, 'главврач': ROLES.HEAD_PHYSICIAN, 'врач': ROLES.PHYSICIAN, 'регистратор': ROLES.REGISTRAR, 'медсестра': ROLES.NURSE };
  const role = roleMap[roleRaw.toLowerCase()] || roleRaw;
  if (!Object.values(ROLES).includes(role)) throw new Error('Роль: Главный врач / Врач / Регистратор / Медсестра');
  if (fio.split(' ').length < 2) throw new Error('ФИО минимум 2 слова');
  const existing = await emias.getUserByDiscordId(discordId, gid);
  if (existing) throw new Error('Пользователь уже в штате.');
  const id = await emias.createStaff({ discordId, discordUsername: null, fullName: fio, specialty, role, guildId: gid });
  await interaction.editReply({ components: [successContainer('Сотрудник добавлен', `<@${discordId}> → **${fio}**\nРоль: \`${role}\`${specialty ? ` · ${specialty}` : ''}\nID: \`${id}\``)], flags: FLAGS });
}

async function handleStaffList(interaction, gid) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  const list = await emias.getAllStaff(gid);
  const container = staffPanelContainer(list);
  await interaction.editReply({ components: [container], flags: FLAGS });
}

async function handleStats(interaction, gid) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  const actor = await emias.getUserByDiscordId(interaction.user.id, gid);
  if (!actor || actor.role !== ROLES.HEAD_PHYSICIAN) throw new Error('Только главврач.');
  const s = await emias.getStats(gid);
  const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js');
  const { PRIMARY_COLOR, DISCLAIMER } = require('../config');
  const c = new ContainerBuilder().setAccentColor(PRIMARY_COLOR);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## Статистика ЕМИАС`));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
    `**Пациенты:** всего ${s.patientsTotal} · заблокировано ${s.patientsBlocked}`,
    `**Персонал:** ${s.staffTotal}`,
    `**Талоны сегодня:** всего ${s.ticketsToday} · ожидают ${s.waitingToday} · принято ${s.doneToday}`,
    `**Записей 30д:** ${s.recordsMonth}`,
  ].join('\n')));
  if (s.loadBySpecialty.length) {
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Нагрузка по специальностям сегодня**\n${s.loadBySpecialty.map(r => `${r.specialty || '—'}: ${r.cnt}`).join('\n')}`));
  }
  if (s.topDiagnoses.length) {
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Топ диагнозов**\n${s.topDiagnoses.map(r => `\`${r.diagnosis_code}\` ${r.diagnosis_text || ''} — ${r.cnt}`).join('\n')}`));
  }
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${DISCLAIMER}`));
  await interaction.editReply({ components: [c], flags: FLAGS });
}

async function handleWipeButton(interaction) {
  await interaction.reply({ components: [wipeSelectRow()], ephemeral: true });
}

async function handleWipeSelect(interaction, gid) {
  await interaction.deferUpdate();
  const val = interaction.values[0];
  const actor = await emias.getUserByDiscordId(interaction.user.id, gid);
  if (!actor || actor.role !== ROLES.HEAD_PHYSICIAN) throw new Error('Только главврач.');
  if (val === 'tickets') {
    await emias.wipeAllFake(gid);
    await interaction.editReply({ components: [successContainer('Очистка', 'Удалены талоны, ЭМК, рецепты и коды. Пациенты сохранены.')], flags: FLAGS });
  } else {
    await emias.wipePatients(gid);
    await interaction.editReply({ components: [successContainer('Полная очистка', 'Удалены все пациенты, талоны и медкарты. БД пуста — только реальные данные.')], flags: FLAGS });
  }
}

async function handleBlockButton(interaction) {
  const modal = new ModalBuilder().setCustomId('staff:block:modal').setTitle('Блокировка');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pid').setLabel('ID пациента').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('reason').setLabel('Причина').setStyle(TextInputStyle.Short).setRequired(false)),
  );
  await interaction.showModal(modal);
}

async function handleBlockModal(interaction) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  const actor = await emias.getUserByDiscordId(interaction.user.id, interaction.guildId);
  if (!actor || actor.role !== ROLES.HEAD_PHYSICIAN) throw new Error('Только главврач.');
  const pid = Number(interaction.fields.getTextInputValue('pid').trim());
  const reason = interaction.fields.getTextInputValue('reason').trim() || '—';
  const p = await emias.getPatientById(pid);
  if (!p) throw new Error('Пациент не найден.');
  await emias.setPatientBlocked(pid, true, actor.id);
  await interaction.editReply({ components: [successContainer('Заблокирован', `**${p.full_name}** (\`${p.card_number}\`)\nПричина: ${reason}`)], flags: FLAGS });
}

async function handleUnblockButton(interaction) {
  const modal = new ModalBuilder().setCustomId('staff:unblock:modal').setTitle('Разблокировка');
  modal.addComponents(
    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('pid').setLabel('ID пациента').setStyle(TextInputStyle.Short).setRequired(true)),
  );
  await interaction.showModal(modal);
}

async function handleUnblockModal(interaction) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  const actor = await emias.getUserByDiscordId(interaction.user.id, interaction.guildId);
  if (!actor || actor.role !== ROLES.HEAD_PHYSICIAN) throw new Error('Только главврач.');
  const pid = Number(interaction.fields.getTextInputValue('pid').trim());
  const p = await emias.getPatientById(pid);
  if (!p) throw new Error('Пациент не найден.');
  await emias.setPatientBlocked(pid, false, actor.id);
  await interaction.editReply({ components: [successContainer('Разблокирован', `**${p.full_name}** снова активен.` )], flags: FLAGS });
}

// ─── Интеграции (панель настроек) ──────────────────────────────────────────

async function requireHead(interaction, gid) {
  const actor = await emias.getUserByDiscordId(interaction.user.id, gid);
  const isAdmin = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
  if (!(actor && actor.role === ROLES.HEAD_PHYSICIAN) && !isAdmin) {
    throw new Error('Только главврач или админ сервера.');
  }
}

async function renderIntegPanel(interaction, gid, cat = 'bookings') {
  const s = settings.get(gid);
  await interaction.update({
    components: [integrationSettingsContainer(s, cat), ...integrationSettingsRows(s, cat)],
    flags: FLAGS,
  });
}

async function handleIntegrations(interaction, gid) {
  await interaction.deferReply({ flags: FLAGS, ephemeral: true });
  await requireHead(interaction, gid);
  await renderIntegPanel(interaction, gid, 'bookings');
}

async function handleIntegCategory(interaction, gid, cat) {
  await interaction.deferUpdate();
  await requireHead(interaction, gid);
  await renderIntegPanel(interaction, gid, cat);
}

async function handleIntegChannel(interaction, gid) {
  await interaction.deferUpdate();
  await requireHead(interaction, gid);
  const channelId = interaction.values[0];
  settings.set(gid, { bookingChannelId: channelId });
  await renderIntegPanel(interaction, gid, 'bookings');
}

async function handleIntegPingDoctor(interaction, gid) {
  await interaction.deferUpdate();
  await requireHead(interaction, gid);
  const s = settings.get(gid);
  settings.set(gid, { pingDoctor: !s.pingDoctor });
  await renderIntegPanel(interaction, gid, 'notify');
}

async function handleIntegPingPatient(interaction, gid) {
  await interaction.deferUpdate();
  await requireHead(interaction, gid);
  const s = settings.get(gid);
  settings.set(gid, { pingPatient: !s.pingPatient });
  await renderIntegPanel(interaction, gid, 'notify');
}

// ─── Уведомление о новой записи (интеграции) ──────────────────────────────

async function notifyBooking(interaction, gid, { patient, doctor, ticket, date, time }) {
  const s = settings.get(gid);
  if (!s.bookingChannelId) return; // канал не задан — не шлём
  const channel = await interaction.client.channels.fetch(s.bookingChannelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const pings = [];
  if (s.pingPatient && patient && patient.discord_id) pings.push(`<@${patient.discord_id}>`);
  if (s.pingDoctor && doctor && doctor.discord_id) pings.push(`<@${doctor.discord_id}>`);

  const lines = [
    pings.join(' '),
    `**Новая запись на приём**`,
    `> **Пациент:** ${patient?.full_name || '—'}`,
    `> **Врач:** ${doctor ? `${doctor.full_name}${doctor.specialty ? ` (${doctor.specialty})` : ''}` : '—'}`,
    `> **Когда:** ${date} в ${time}`,
    `> **Талон:** \`${ticket}\``,
  ].filter(Boolean).join('\n');

  await channel.send({ content: lines }).catch(() => {});
}
