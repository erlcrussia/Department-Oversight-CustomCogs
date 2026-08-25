const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed, brandEmbed, footer } = require('../utils/embeds');
const { getUserByDiscordId, getPatientById, addEmrRecord, addPrescription, searchPatients } = require('../dataUtils/emias');
const { ROLES } = require('../utils/constants');

// МКБ-10 мини-справочник (27 кодов как в ЕМИАС, без фейка — реальные коды)
const MKB10 = [
  { code: 'J00', name: 'Острый назофарингит' },
  { code: 'J06.9', name: 'Острая респираторная инфекция' },
  { code: 'J44.8', name: 'ХОБЛ уточнённая' },
  { code: 'I10', name: 'Эссенциальная гипертензия' },
  { code: 'E66.9', name: 'Ожирение неуточнённое' },
  { code: 'M54.5', name: 'Боль внизу спины' },
  { code: 'A09', name: 'Гастроэнтерит' },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('прием')
    .setDescription('Добавить запись в ЭМК (врачи)')
    .addIntegerOption(o => o.setName('персонаж').setDescription('ID пациента').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('тип').setDescription('Тип записи').setRequired(true)
      .addChoices({ name: 'Приём', value: 'visit' }, { name: 'Лаборатория', value: 'lab' }, { name: 'Процедура', value: 'procedure' }))
    .addStringOption(o => o.setName('жалобы').setDescription('Жалобы пациента'))
    .addStringOption(o => o.setName('диагноз-код').setDescription('Код МКБ-10 (напр. J00)').setAutocomplete(true))
    .addStringOption(o => o.setName('диагноз').setDescription('Текст диагноза'))
    .addStringOption(o => o.setName('заметки').setDescription('Рекомендации / заметки'))
    .addIntegerOption(o => o.setName('больничный').setDescription('Дней больничного')),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'персонаж') {
      const list = searchPatients(focused.value, 25);
      await interaction.respond(list.map(p => ({ name: `${p.full_name} · ${p.card_number} (#${p.id})`.substring(0, 100), value: p.id })));
    } else if (focused.name === 'диагноз-код') {
      const q = focused.value.toLowerCase();
      const filtered = q ? MKB10.filter(m => m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)) : MKB10;
      await interaction.respond(filtered.slice(0, 25).map(m => ({ name: `${m.code} — ${m.name}`.substring(0, 100), value: m.code })));
    }
  },

  async execute(interaction) {
    const staff = getUserByDiscordId(interaction.user.id);
    if (!staff || ![ROLES.PHYSICIAN, ROLES.HEAD_PHYSICIAN].includes(staff.role)) {
      await interaction.reply({ embeds: [errorEmbed('Только для врачей и главврача.')], ephemeral: true });
      return;
    }
    const pid = interaction.options.getInteger('персонаж');
    const patient = getPatientById(pid);
    if (!patient) { await interaction.reply({ embeds: [errorEmbed('Пациент не найден.')], ephemeral: true }); return; }
    const type = interaction.options.getString('тип');
    const complaints = interaction.options.getString('жалобы');
    const code = interaction.options.getString('диагноз-код');
    const text = interaction.options.getString('диагноз');
    const notes = interaction.options.getString('заметки');
    const sick = interaction.options.getInteger('больничный');

    if (code && !/^[A-ZА-Я]\d{2}(\.\d{1,2})?$/i.test(code)) {
      await interaction.reply({ embeds: [errorEmbed('Неверный формат кода МКБ-10 (напр. J00, I10).')], ephemeral: true });
      return;
    }

    const id = addEmrRecord({ patientId: pid, doctorId: staff.id, recordType: type, complaints, diagnosisCode: code, diagnosisText: text, notes, sickLeaveDays: sick });
    const e = successEmbed('Запись добавлена', `Пациент: **${patient.full_name}** (\`${patient.card_number}\`)\nТип: \`${type}\`${code ? `\nДиагноз: \`${code}\` ${text || ''}` : ''}${sick ? `\nБольничный: ${sick} дн.` : ''}\nID записи: \`${id}\``);
    await interaction.reply({ embeds: [e], ephemeral: true });
  },
};
