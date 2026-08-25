'use strict';

const { EmbedBuilder } = require('discord.js');
const { ICON_URL, HEX_COLOR, PRIMARY_COLOR, SUCCESS_COLOR, WARNING_COLOR, DANGER_COLOR, DISCLAIMER } = require('../config');
const { TICKET_STATUS_LABELS, TICKET_STATUS_EMOJI, DOCTOR_STATUS_LABELS, DOCTOR_STATUS_EMOJI, RECORD_TYPE_LABELS } = require('./constants');

function brandEmbed(options = {}) {
  const e = new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setAuthor({ name: 'ЕМИАС — Минздрав', iconURL: ICON_URL })
    .setTimestamp();
  if (options.title) e.setTitle(options.title);
  if (options.description) e.setDescription(options.description);
  if (options.color) e.setColor(options.color);
  return e;
}

function footer(e) {
  return e.setFooter({ text: DISCLAIMER, iconURL: ICON_URL });
}

function ticketStatusBadge(status) {
  const emoji = TICKET_STATUS_EMOJI[status] || '•';
  const label = TICKET_STATUS_LABELS[status] || status;
  return `${emoji} ${label}`;
}

function doctorStatusBadge(status) {
  const emoji = DOCTOR_STATUS_EMOJI[status] || '•';
  const label = DOCTOR_STATUS_LABELS[status] || status;
  return `${emoji} ${label}`;
}

function patientCardEmbed(patient, tickets = [], records = [], prescriptions = []) {
  const e = brandEmbed({ title: `Медкарта · ${patient.full_name}` });
  e.setThumbnail(ICON_URL);
  e.addFields(
    { name: 'Карта', value: `\`${patient.card_number}\``, inline: true },
    { name: 'Дата рождения', value: patient.birth_date || '—', inline: true },
    { name: 'Пол', value: patient.sex || '—', inline: true },
    { name: 'ОМС', value: patient.oms_number ? `\`${patient.oms_number}\`` : '—', inline: true },
    { name: 'Группа крови', value: patient.blood_group || '—', inline: true },
    { name: 'Телефон', value: patient.phone || '—', inline: true },
  );
  if (patient.allergies) e.addFields({ name: '⚠️ Аллергии', value: `**${patient.allergies}**`, inline: false });
  if (patient.discord_id) e.addFields({ name: 'Привязан', value: `<@${patient.discord_id}>`, inline: true });
  e.addFields({ name: 'Статус', value: patient.status === 'blocked' ? '🔴 Заблокирован' : '🟢 Активен', inline: true });

  if (tickets.length) {
    const lines = tickets.slice(0, 5).map(t => `\`${t.date} ${t.time}\` ${ticketStatusBadge(t.status)} · ${t.ticket_number} → ${t.doctor_name || '—'} (каб. ${t.room || '—'})`).join('\n');
    e.addFields({ name: `🎫 Талоны (${tickets.length})`, value: lines.substring(0, 1024), inline: false });
  }
  if (records.length) {
    const lines = records.slice(0, 3).map(r => `**${r.diagnosis_code || ''}** ${r.diagnosis_text || ''} · ${RECORD_TYPE_LABELS[r.record_type] || r.record_type} · ${r.visit_date}`.trim()).join('\n');
    e.addFields({ name: `📋 Последние приёмы`, value: lines.substring(0, 1024) || '—', inline: false });
  }
  if (prescriptions.length) {
    const lines = prescriptions.slice(0, 3).map(p => `\`${p.prescription_number}\` ${p.medication} — ${p.dosage}`).join('\n');
    e.addFields({ name: `💊 Рецепты`, value: lines.substring(0, 1024) || '—', inline: false });
  }
  return footer(e);
}

function queueEmbed({ date, queue }) {
  const e = brandEmbed({ title: `Живая очередь · ${formatDate(date)}` });
  e.setColor(0x1d4ed8);
  if (!queue.length) {
    e.setDescription('Очередь пуста. Нет активных талонов на эту дату.');
  } else {
    const waiting = queue.filter(q => q.status === 'waiting').length;
    const inRoom = queue.filter(q => q.status === 'in_room').length;
    e.setDescription(`Всего: **${queue.length}** · Ожидают: **${waiting}** · В кабинете: **${inRoom}**`);
    const lines = queue.slice(0, 20).map(a => `\`${a.time}\` ${TICKET_STATUS_EMOJI[a.status] || '•'} \`${a.ticket_number}\` **${a.patient_name}** → ${a.doctor_name || '—'} (каб. ${a.room || '—'}) · ${TICKET_STATUS_LABELS[a.status] || a.status}`).join('\n');
    e.addFields({ name: `📋 Очередь`, value: lines.substring(0, 1024), inline: false });
    if (queue.length > 20) e.addFields({ name: '…', value: `и ещё ${queue.length - 20} талонов`, inline: false });
  }
  return footer(e);
}

function staffListEmbed(staff) {
  const e = brandEmbed({ title: 'Персонал поликлиники' });
  if (!staff.length) {
    e.setDescription('Сотрудники не найдены. Главврач может добавить их через `/добавить-сотрудника`.');
    return footer(e);
  }
  const byRole = {};
  for (const u of staff) {
    const r = u.role || 'Неизвестно';
    if (!byRole[r]) byRole[r] = [];
    byRole[r].push(u);
  }
  for (const [role, list] of Object.entries(byRole)) {
    const value = list.map(u => `${doctorStatusBadge(u.status)} **${u.full_name}**${u.specialty ? ` — ${u.specialty}` : ''} ${u.discord_id ? `(<@${u.discord_id}>)` : '(не привязан)'}`).join('\n').substring(0, 1024);
    e.addFields({ name: `${role} (${list.length})`, value, inline: false });
  }
  return footer(e);
}

function doctorsEmbed(doctors) {
  const grouped = {};
  for (const d of doctors) {
    const spec = d.specialty || 'Прочие';
    if (!grouped[spec]) grouped[spec] = [];
    grouped[spec].push(d);
  }
  const e = brandEmbed({ title: 'Врачи поликлиники', description: 'Используйте ID врача в команде `/записаться`.' });
  for (const [spec, list] of Object.entries(grouped)) {
    const value = list.map(d => `${doctorStatusBadge(d.status)} **${d.full_name}** \`#${d.id}\` ${d.discord_id ? `<@${d.discord_id}>` : ''}`).join('\n').substring(0, 1024);
    e.addFields({ name: `${spec} (${list.length})`, value, inline: false });
  }
  if (!doctors.length) e.setDescription('Нет активных врачей. Обратитесь к главврачу.');
  return footer(e);
}

function helpEmbed() {
  const e = brandEmbed({ title: 'ЕМИАС — помощь', description: 'Медицинская система Минздрава. Все данные — вымышленные (RP).' });
  e.addFields(
    { name: '👤 Гражданам', value: '`/я` — ваши персонажи и роль\n`/персонажи` — список персонажей\n`/записаться` — запись к врачу\n`/талон` — ваши талоны / отмена\n`/привязать` — привязать персонажа кодом с сайта', inline: false },
    { name: '🩺 Сотрудникам', value: '`/очередь` — очередь дня\n`/карта` — медкарта пациента\n`/врачи` — список врачей\n`/статус` — сменить свой статус', inline: false },
    { name: '⭐ Главврачу', value: '`/добавить-сотрудника` — добавить врача/регистратора\n`/персонал` — управление персоналом\n`/блок` / `/разблок` — блокировка персонажа\n`/импорт-эмк` — импорт карт из форума\n`/настройки` — вебхуки и каналы', inline: false },
    { name: '📋 Панели', value: '`/панель-записи` — панель записи к врачу\n`/живая-очередь` — автообновляемая очередь', inline: false },
  );
  return footer(e);
}

function errorEmbed(text) {
  return footer(brandEmbed({ title: 'Ошибка', description: text }).setColor(DANGER_COLOR));
}

function successEmbed(title, text) {
  return footer(brandEmbed({ title, description: text }).setColor(SUCCESS_COLOR));
}

function warningEmbed(title, text) {
  return footer(brandEmbed({ title, description: text }).setColor(WARNING_COLOR));
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

module.exports = {
  brandEmbed,
  footer,
  ticketStatusBadge,
  doctorStatusBadge,
  patientCardEmbed,
  queueEmbed,
  staffListEmbed,
  doctorsEmbed,
  helpEmbed,
  errorEmbed,
  successEmbed,
  warningEmbed,
  formatDate,
};
