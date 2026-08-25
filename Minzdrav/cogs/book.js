const { SlashCommandBuilder } = require('discord.js');
const { successEmbed, errorEmbed, formatDate } = require('../utils/embeds');
const { getDoctors, getCitizensByDiscordId, getPatientById, bookAppointment } = require('../dataUtils/emias');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('записаться')
    .setDescription('Записать персонажа к врачу')
    .addStringOption(o => o.setName('врач').setDescription('ID врача или ФИО (напр. #2)').setRequired(true).setAutocomplete(true))
    .addStringOption(o => o.setName('дата').setDescription('YYYY-MM-DD или сегодня/завтра').setRequired(true))
    .addStringOption(o => o.setName('время').setDescription('HH:MM (09:00-17:30)').setRequired(true))
    .addStringOption(o => o.setName('персонаж').setDescription('ID персонажа (если несколько)').setAutocomplete(true)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused(true);
    if (focused.name === 'врач') {
      const docs = getDoctors();
      const q = focused.value.toLowerCase();
      const choices = docs.map(d => ({ name: `${d.full_name} — ${d.specialty || '—'} (#${d.id})`.substring(0, 100), value: `#${d.id}` }));
      const filtered = q ? choices.filter(c => c.name.toLowerCase().includes(q)) : choices;
      await interaction.respond(filtered.slice(0, 25));
    } else if (focused.name === 'персонаж') {
      const citizens = getCitizensByDiscordId(interaction.user.id);
      const q = focused.value.toLowerCase();
      const choices = citizens.map(c => ({ name: `${c.full_name} · ${c.card_number}`.substring(0, 100), value: String(c.id) }));
      const filtered = q ? choices.filter(c => c.name.toLowerCase().includes(q)) : choices;
      await interaction.respond(filtered.slice(0, 25));
    }
  },

  async execute(interaction) {
    let doctorRaw = interaction.options.getString('врач');
    let dateRaw = interaction.options.getString('дата');
    let timeRaw = interaction.options.getString('время');
    const charHint = interaction.options.getString('персонаж');

    // Парс врача
    let doctorId = null;
    const m = doctorRaw.match(/#(\d+)/);
    if (m) doctorId = Number(m[1]);
    else {
      const docs = getDoctors();
      const found = docs.find(d => d.full_name.toLowerCase().includes(doctorRaw.toLowerCase()));
      if (found) doctorId = found.id;
      else {
        await interaction.reply({ embeds: [errorEmbed(`Врач «${doctorRaw}» не найден. Используйте \`/врачи\` чтобы узнать ID.`)], ephemeral: true });
        return;
      }
    }

    // Парс даты
    const today = new Date();
    const fmt = d => d.toISOString().slice(0, 10);
    if (dateRaw === 'сегодня') dateRaw = fmt(today);
    else if (dateRaw === 'завтра') { const t = new Date(today); t.setDate(t.getDate() + 1); dateRaw = fmt(t); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      await interaction.reply({ embeds: [errorEmbed('Неверный формат даты. Используйте `YYYY-MM-DD` или `сегодня`/`завтра`.')], ephemeral: true });
      return;
    }
    if (dateRaw < fmt(today)) {
      await interaction.reply({ embeds: [errorEmbed('Нельзя записаться на прошедшую дату.')], ephemeral: true });
      return;
    }
    if (!/^\d{2}:\d{2}$/.test(timeRaw)) {
      await interaction.reply({ embeds: [errorEmbed('Неверный формат времени. Используйте `HH:MM` (напр. 09:30).')], ephemeral: true });
      return;
    }

    // Выбор персонажа
    const citizens = getCitizensByDiscordId(interaction.user.id);
    if (!citizens.length) {
      await interaction.reply({ embeds: [errorEmbed('У вас нет привязанных персонажей. Сначала `/привязать` код с сайта.')], ephemeral: true });
      return;
    }
    let patientId;
    if (charHint) patientId = Number(charHint);
    else if (citizens.length === 1) patientId = citizens[0].id;
    else {
      // если несколько — берём первый, но подсказываем
      patientId = citizens[0].id;
    }
    const patient = getPatientById(patientId);
    if (!patient || (patient.discord_id !== interaction.user.id)) {
      await interaction.reply({ embeds: [errorEmbed('Персонаж не найден или не принадлежит вам.')], ephemeral: true });
      return;
    }

    try {
      const res = bookAppointment({ patientId, doctorId, date: dateRaw, time: timeRaw, viaDiscordId: interaction.user.id });
      const doc = getDoctors().find(d => d.id === doctorId);
      const e = successEmbed('Запись создана', `**${patient.full_name}** → **${doc ? doc.full_name : 'Врач #' + doctorId}**\n📅 ${formatDate(dateRaw)} в ${timeRaw}\n🎫 Талон: \`${res.ticket_number}\``);
      await interaction.reply({ embeds: [e], ephemeral: true });
    } catch (err) {
      let msg = err.message || 'Ошибка записи.';
      if (err.code === 'DOCTOR_CONFLICT') msg = 'Время у врача уже занято. Выберите другое.';
      else if (err.code === 'SELF_CONFLICT') msg = 'У вас уже есть талон на это время.';
      else if (err.code === 'BLOCKED') msg = 'Персонаж заблокирован главврачом.';
      await interaction.reply({ embeds: [errorEmbed(msg)], ephemeral: true });
    }
  },
};
