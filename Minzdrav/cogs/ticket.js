const { SlashCommandBuilder } = require('discord.js');
const { brandEmbed, footer, errorEmbed, successEmbed, ticketStatusBadge, formatDate } = require('../utils/embeds');
const { getCitizensByDiscordId, getPatientCard, cancelTicket } = require('../dataUtils/emias');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('талон')
    .setDescription('Ваши активные талоны / отмена')
    .addIntegerOption(o => o.setName('отменить').setDescription('ID талона для отмены').setAutocomplete(true)),

  async autocomplete(interaction) {
    const citizens = getCitizensByDiscordId(interaction.user.id);
    const choices = [];
    for (const c of citizens) {
      const card = getPatientCard(c.id);
      for (const t of card.tickets) {
        choices.push({ name: `${t.ticket_number} · ${t.date} ${t.time} · ${c.full_name}`.substring(0, 100), value: t.id });
      }
    }
    const q = interaction.options.getFocused().toString().toLowerCase();
    const filtered = q ? choices.filter(c => c.name.toLowerCase().includes(q)) : choices;
    await interaction.respond(filtered.slice(0, 25));
  },

  async execute(interaction) {
    const cancelId = interaction.options.getInteger('отменить');
    if (cancelId) {
      try {
        const t = cancelTicket(cancelId, interaction.user.id);
        await interaction.reply({ embeds: [successEmbed('Талон отменён', `Талон \`${t.ticket_number}\` на ${t.date} ${t.time} — отменён.`)], ephemeral: true });
      } catch (err) {
        let msg = err.message;
        if (err.code === 'FORBIDDEN') msg = 'Вы не можете отменить чужой талон.';
        if (err.code === 'BAD_STATUS') msg = 'Можно отменить только талон в статусе ожидания.';
        await interaction.reply({ embeds: [errorEmbed(msg)], ephemeral: true });
      }
      return;
    }

    const citizens = getCitizensByDiscordId(interaction.user.id);
    if (!citizens.length) {
      await interaction.reply({ embeds: [errorEmbed('У вас нет персонажей.')], ephemeral: true });
      return;
    }
    const e = brandEmbed({ title: 'Ваши талоны' });
    let has = false;
    for (const c of citizens) {
      const card = getPatientCard(c.id);
      if (!card.tickets.length) continue;
      has = true;
      const lines = card.tickets.map(t => `\`${t.ticket_number}\` ${formatDate(t.date)} ${t.time} → ${t.doctor_name || '—'} (каб. ${t.room || '—'}) · ${ticketStatusBadge(t.status)} \`ID:${t.id}\``).join('\n');
      e.addFields({ name: `${c.full_name} · ${c.card_number}`, value: lines.substring(0, 1024), inline: false });
    }
    if (!has) e.setDescription('Нет активных талонов. Запишитесь через `/записаться`.');
    footer(e);
    await interaction.reply({ embeds: [e], ephemeral: true });
  },
};
