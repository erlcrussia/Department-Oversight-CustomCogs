'use strict';

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  ThumbnailBuilder,
  MessageFlags,
} = require('discord.js');
const { ICON_URL, PRIMARY_COLOR, DISCLAIMER } = require('../config');
const { TICKET_STATUS_LABELS, DOCTOR_STATUS_LABELS } = require('./constants');

function containerBase() {
  return new ContainerBuilder().setAccentColor(PRIMARY_COLOR);
}

function headerSection(title, subtitle) {
  return new SectionBuilder()
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## ${title}\n${subtitle || ''}`.trim())
    )
    .setThumbnailAccessory(
      new ThumbnailBuilder().setURL(ICON_URL).setDescription('ЕМИАС')
    );
}

function disclaimerText() {
  return new TextDisplayBuilder().setContent(`-# ${DISCLAIMER}`);
}

// ─── Главные контейнеры (панели) ─────────────────────────────────────────

function mainPanelContainer({ user, staff, citizens }) {
  const c = containerBase();
  c.addSectionComponents(headerSection('ЕМИАС — Минздрав', 'Единая медицинская система. Данные вымышленные (RP).'));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

  const roleLine = staff ? `${staff.role}${staff.specialty ? ` · ${staff.specialty}` : ''}` : 'Гражданин';
  const charsLine = citizens.length ? `${citizens.length} персонаж(ей): ${citizens.map(ch => ch.full_name).join(', ')}` : 'Нет привязанных персонажей — используйте привязку.';
  c.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**Пользователь:** ${user.username} (<@${user.id}>)\n**Роль:** ${roleLine}\n${charsLine}`.substring(0, 4000))
  );
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent('Выберите действие кнопками ниже. Панель доступна только вам.'));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(disclaimerText());
  return c;
}

function staffPanelContainer(staffList) {
  const c = containerBase();
  c.addSectionComponents(headerSection('Штаб — управление персоналом', 'Только для главного врача.'));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

  if (!staffList.length) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent('Штат пуст. Добавьте первого сотрудника.'));
  } else {
    const byRole = {};
    for (const u of staffList) {
      const r = u.role || 'Прочие';
      if (!byRole[r]) byRole[r] = [];
      byRole[r].push(u);
    }
    let content = '';
    for (const [role, list] of Object.entries(byRole)) {
      content += `**${role} (${list.length})**\n`;
      for (const u of list) {
        const spec = u.specialty ? ` · ${u.specialty}` : '';
        const mention = u.discord_id ? ` <@${u.discord_id}>` : ' (не привязан)';
        content += `- ${u.full_name} \`#${u.id}\`${spec}${mention} · ${DOCTOR_STATUS_LABELS[u.status] || u.status}\n`;
      }
      content += '\n';
    }
    // Split to avoid 4000 limit
    const chunks = splitText(content.trim(), 4000);
    for (const chunk of chunks) {
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(chunk));
    }
  }
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent('Управление — кнопками ниже. Изменение и увольнение через выбор сотрудника.'));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(disclaimerText());
  return c;
}

function queueContainer({ date, queue }) {
  const c = containerBase();
  c.addSectionComponents(headerSection(`Очередь · ${formatDate(date)}`, `Всего ${queue.length} талонов`));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

  if (!queue.length) {
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent('Очередь пуста. Нет активных талонов на эту дату.'));
  } else {
    const waiting = queue.filter(q => q.status === 'waiting').length;
    const inRoom = queue.filter(q => q.status === 'in_room').length;
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`Ожидают: **${waiting}** · В кабинете: **${inRoom}**`));
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

    const lines = queue.slice(0, 25).map(a =>
      `\`${a.time}\` ${TICKET_STATUS_LABELS[a.status] || a.status} · \`${a.ticket_number}\` ${a.patient_name} → ${a.doctor_name || '—'} (каб. ${a.room || '—'})`
    ).join('\n');

    const chunks = splitText(lines, 3500);
    for (const chunk of chunks) {
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(chunk));
    }
    if (queue.length > 25) {
      c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# и ещё ${queue.length - 25} талонов`));
    }
  }
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(disclaimerText());
  return c;
}

function cardContainer({ patient, tickets, records, prescriptions }) {
  const c = containerBase();
  c.addSectionComponents(headerSection(`Карта · ${patient.full_name}`, `\`${patient.card_number}\` · ${patient.status === 'blocked' ? 'Заблокирован' : 'Активен'}`));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));

  const demo = [
    `**Дата рождения:** ${patient.birth_date || '—'}`,
    `**Пол:** ${patient.sex || '—'}`,
    `**ОМС:** ${patient.oms_number ? `\`${patient.oms_number}\`` : '—'}`,
    `**Группа крови:** ${patient.blood_group || '—'}`,
    `**Телефон:** ${patient.phone || '—'}`,
    `**Аллергии:** ${patient.allergies || '—'}`,
    patient.discord_id ? `**Привязан:** <@${patient.discord_id}>` : `**Привязан:** —`,
  ].join('\n');
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(demo));

  if (tickets.length) {
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Талоны (${tickets.length})**`));
    const lines = tickets.slice(0, 5).map(t => `\`${t.date} ${t.time}\` ${TICKET_STATUS_LABELS[t.status] || t.status} · \`${t.ticket_number}\` → ${t.doctor_name || '—'} (каб. ${t.room || '—'})`).join('\n');
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines));
  }

  if (records.length) {
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Последние приёмы**`));
    const lines = records.slice(0, 3).map(r => `**${r.diagnosis_code || ''}** ${r.diagnosis_text || ''} · ${r.record_type} · ${r.visit_date}`.trim()).join('\n');
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines || '—'));
  }

  if (prescriptions.length) {
    c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Рецепты**`));
    const lines = prescriptions.slice(0, 3).map(p => `\`${p.prescription_number}\` ${p.medication} — ${p.dosage}`).join('\n');
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(lines || '—'));
  }

  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(disclaimerText());
  return c;
}

function helpContainer() {
  const c = containerBase();
  c.addSectionComponents(headerSection('ЕМИАС — помощь', 'Краткий гид по панелям.'));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent([
    '**/емиас** — главная панель (запись, талоны, привязка, очередь, карта, статус).',
    '**/штаб** — управление персоналом (только главврач): добавить, изменить, уволить, статистика, очистка.',
    '',
    'Все действия — кнопками внутри панелей. Панели — контейнеры V2 без лишних эмодзи.',
    'Данные вымышленные (RP). Привязка персонажа — кодом с сайта.',
  ].join('\n')));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(disclaimerText());
  return c;
}

function siteCodeContainer({ code, expiresAt }) {
  const c = new ContainerBuilder().setAccentColor(PRIMARY_COLOR);
  c.addSectionComponents(headerSection('Код для сайта', 'Введи на сайте для входа'));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Код:** \`${code}\`\n**Действует до:** ${new Date(expiresAt).toLocaleString('ru-RU')}\n\nСкопируй и вставь на сайте в поле «Код из Discord». Одноразовый, 10 минут.`));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(disclaimerText());
  return c;
}

function errorContainer(text) {
  const c = new ContainerBuilder().setAccentColor(0xC0392B);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**Ошибка**\n${text}`));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(disclaimerText());
  return c;
}

function successContainer(title, text) {
  const c = new ContainerBuilder().setAccentColor(0x2E8B57);
  c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**\n${text}`));
  c.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  c.addTextDisplayComponents(disclaimerText());
  return c;
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

function splitText(str, max) {
  const res = [];
  for (let i = 0; i < str.length; i += max) res.push(str.slice(i, i + max));
  return res.length ? res : [''];
}

const FLAGS = MessageFlags.IsComponentsV2;

module.exports = {
  containerBase,
  mainPanelContainer,
  staffPanelContainer,
  queueContainer,
  cardContainer,
  helpContainer,
  siteCodeContainer,
  errorContainer,
  successContainer,
  formatDate,
  FLAGS,
  disclaimerText,
};
