const { prisma } = require('./db');
const { ROLES } = require('../utils/constants');

// ─── Хелперы маппинга Prisma → snake_case (совместимость с вызывающим кодом) ──

function mapUser(u) {
  if (!u) return null;
  return {
    id: u.id, discord_id: u.discordId, discord_username: u.discordUsername,
    discord_avatar: u.discordAvatar, full_name: u.fullName, specialty: u.specialty,
    role: u.role, status: u.status, is_active: u.isActive,
    created_at: u.createdAt, guild_id: u.guildId,
  };
}

function mapPatient(p) {
  if (!p) return null;
  return {
    id: p.id, card_number: p.cardNumber, full_name: p.fullName,
    birth_date: p.birthDate, sex: p.sex, oms_number: p.omsNumber,
    blood_group: p.bloodGroup, allergies: p.allergies, phone: p.phone,
    discord_id: p.discordId, status: p.status, created_by: p.createdBy,
    created_at: p.createdAt, guild_id: p.guildId,
  };
}

function mapAppointment(a) {
  if (!a) return null;
  return {
    id: a.id, ticket_number: a.ticketNumber, patient_id: a.patientId,
    doctor_id: a.doctorId, date: a.date, time: a.time, status: a.status,
    room: a.room, created_by: a.createdBy, created_at: a.createdAt,
    updated_at: a.updatedAt, guild_id: a.guildId,
    patient_name: a.patient?.fullName,
    patient_card: a.patient?.cardNumber,
    patient_discord_id: a.patient?.discordId,
    doctor_name: a.doctor?.fullName,
    doctor_specialty: a.doctor?.specialty,
  };
}

function mapRecord(r) {
  if (!r) return null;
  return {
    id: r.id, patient_id: r.patientId, doctor_id: r.doctorId,
    visit_date: r.visitDate, record_type: r.recordType,
    complaints: r.complaints, diagnosis_code: r.diagnosisCode,
    diagnosis_text: r.diagnosisText, notes: r.notes,
    sick_leave_days: r.sickLeaveDays, created_at: r.createdAt,
  };
}

function mapPrescription(p) {
  if (!p) return null;
  return {
    id: p.id, prescription_number: p.prescriptionNumber,
    patient_id: p.patientId, doctor_id: p.doctorId,
    medication: p.medication, dosage: p.dosage,
    duration_days: p.durationDays, issued_at: p.issuedAt,
  };
}

function mapAudit(a) {
  if (!a) return null;
  return {
    id: a.id, actor_id: a.actorId, action: a.action,
    entity_type: a.entityType, entity_id: a.entityId,
    details: a.details, ip: a.ip, created_at: a.createdAt,
    actor_name: a.actor?.fullName || null,
  };
}

// ─── Нумерация документов ────────────────────────────────────────────────

async function nextCardNumber(guildId) {
  const year = new Date().getFullYear();
  const prefix = `ЕМК-${year}-`;
  const rows = await prisma.patients.findMany({
    where: { cardNumber: { startsWith: prefix }, guildId },
    select: { cardNumber: true },
  });
  let max = 0;
  for (const r of rows) {
    const n = Number(r.cardNumber.slice(prefix.length));
    if (n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(6, '0')}`;
}

async function nextTicketNumber(dateISO, guildId) {
  const compact = dateISO.replaceAll('-', '');
  const prefix = `Т-${compact}-`;
  const rows = await prisma.appointment.findMany({
    where: { ticketNumber: { startsWith: prefix }, guildId },
    select: { ticketNumber: true },
    orderBy: { ticketNumber: 'desc' },
  });
  const last = rows.length ? Number(rows[0].ticketNumber.slice(prefix.length)) : 0;
  return `${prefix}${String(last + 1).padStart(3, '0')}`;
}

async function nextPrescriptionNumber(guildId) {
  const year = new Date().getFullYear();
  const prefix = `Р-${year}-`;
  const rows = await prisma.prescription.findMany({
    where: { prescriptionNumber: { startsWith: prefix }, guildId },
    select: { prescriptionNumber: true },
    orderBy: { id: 'desc' },
  });
  const last = rows.length ? Number(rows[0].prescriptionNumber.slice(prefix.length)) : 0;
  return `${prefix}${String(last + 1).padStart(6, '0')}`;
}

// ─── Пользователи (персонал) ────────────────────────────────────────────

async function getUserByDiscordId(discordId, guildId) {
  const u = await prisma.users.findUnique({ where: { discordId } });
  if (!u || !u.isActive) return null;
  if (guildId && u.guildId !== guildId) return null;
  return mapUser(u);
}

async function getUserById(id) {
  const u = await prisma.users.findUnique({ where: { id } });
  return mapUser(u);
}

async function getAllStaff(guildId) {
  const where = { isActive: 1 };
  if (guildId) where.guildId = guildId;
  const all = await prisma.users.findMany({ where });
  const order = { [ROLES.HEAD_PHYSICIAN]: 0, [ROLES.PHYSICIAN]: 1, [ROLES.REGISTRAR]: 2, [ROLES.NURSE]: 3 };
  all.sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || a.fullName.localeCompare(b.fullName));
  return all.map(mapUser);
}

async function getDoctors(guildId) {
  const where = { isActive: 1, role: { in: [ROLES.PHYSICIAN, ROLES.HEAD_PHYSICIAN] } };
  if (guildId) where.guildId = guildId;
  const all = await prisma.users.findMany({ where, orderBy: { fullName: 'asc' } });
  return all.map(mapUser);
}

async function createStaff({ discordId, discordUsername, fullName, specialty, role, guildId }) {
  const u = await prisma.users.create({
    data: {
      discordId: discordId || null, discordUsername: discordUsername || null,
      fullName, specialty: specialty || null, role, status: 'free',
      guildId: guildId || '',
    },
  });
  await audit({ actorId: null, action: 'staff.create', entityType: 'user', entityId: String(u.id), details: { fullName, role, specialty }, guildId });
  return u.id;
}

async function updateStaff(id, fields) {
  const data = {};
  if (fields.full_name !== undefined) data.fullName = fields.full_name;
  if (fields.specialty !== undefined) data.specialty = fields.specialty;
  if (fields.role !== undefined) data.role = fields.role;
  if (fields.status !== undefined) data.status = fields.status;
  if (fields.discord_id !== undefined) data.discordId = fields.discord_id;
  if (fields.discord_username !== undefined) data.discordUsername = fields.discord_username;
  if (!Object.keys(data).length) return;
  await prisma.users.update({ where: { id }, data });
}

async function deactivateStaff(id) {
  await prisma.users.update({ where: { id }, data: { isActive: 0, status: 'offline' } });
  await audit({ actorId: null, action: 'staff.deactivate', entityType: 'user', entityId: String(id) });
}

async function setDoctorStatus(discordId, status, guildId) {
  const u = await prisma.users.findUnique({ where: { discordId } });
  if (!u) return null;
  await prisma.users.update({ where: { discordId }, data: { status } });
  await audit({ actorId: u.id, action: 'staff.status', entityType: 'user', entityId: String(u.id), details: { status }, guildId });
  return mapUser({ ...u, status });
}

// ─── Пациенты ───────────────────────────────────────────────────────────

async function getPatientById(id) {
  const p = await prisma.patients.findUnique({ where: { id } });
  return mapPatient(p);
}

async function searchPatients(query, guildId, limit = 20) {
  const where = {};
  if (guildId) where.guildId = guildId;

  if (!query) {
    const rows = await prisma.patients.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit });
    return rows.map(mapPatient);
  }

  const like = `%${query}%`;
  const conditions = [`(full_name ILIKE $1 OR card_number ILIKE $1 OR oms_number ILIKE $1)`];
  const params = [like];
  let idx = 2;

  if (guildId) {
    conditions.push(`guild_id = $${idx}`);
    params.push(guildId);
    idx++;
  }

  params.push(limit);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT * FROM "emias"."Patients" WHERE ${conditions.join(' AND ')} ORDER BY full_name LIMIT $${idx}`,
    ...params,
  );
  return rows.map(mapPatient);
}

async function getCitizensByDiscordId(discordId, guildId) {
  const where = { discordId };
  if (guildId) where.guildId = guildId;
  const rows = await prisma.patients.findMany({ where, orderBy: { fullName: 'asc' } });
  return rows.map(mapPatient);
}

async function getPatientCard(patientId) {
  const pRaw = await prisma.patients.findUnique({ where: { id: patientId } });
  if (!pRaw) return null;
  const patient = mapPatient(pRaw);

  const ticketsRaw = await prisma.appointment.findMany({
    where: { patientId, status: { in: ['waiting', 'in_room'] } },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  });
  const tickets = [];
  for (const t of ticketsRaw) {
    const doctor = t.doctorId ? await prisma.users.findUnique({ where: { id: t.doctorId } }) : null;
    tickets.push(mapAppointment({ ...t, doctor, patient: pRaw }));
  }

  const recordsRaw = await prisma.record.findMany({
    where: { patientId }, orderBy: { visitDate: 'desc' }, take: 5,
  });
  const records = recordsRaw.map(mapRecord);

  const prescriptionsRaw = await prisma.prescription.findMany({
    where: { patientId }, orderBy: { issuedAt: 'desc' }, take: 5,
  });
  const prescriptions = prescriptionsRaw.map(mapPrescription);

  return { patient, tickets, records, prescriptions, linkedDiscord: patient.discord_id };
}

async function createPatient({ fullName, birthDate, sex, omsNumber, bloodGroup, allergies, phone, discordId, createdBy, guildId }) {
  if (omsNumber) {
    const dup = await prisma.patients.findFirst({ where: { omsNumber } });
    if (dup) { const e = new Error('Пациент с таким ОМС уже существует'); e.code = 'DUP_OMS'; throw e; }
  }
  const card = await nextCardNumber(guildId);
  const p = await prisma.patients.create({
    data: {
      cardNumber: card, fullName, birthDate: birthDate || null, sex: sex || null,
      omsNumber: omsNumber || null, bloodGroup: bloodGroup || null,
      allergies: allergies || null, phone: phone || null,
      discordId: discordId || null, createdBy: createdBy || null,
      guildId: guildId || '',
    },
  });
  await audit({ actorId: createdBy || null, action: 'patient.create', entityType: 'patient', entityId: String(p.id), details: { fullName, card }, guildId });
  return { id: p.id, card_number: card };
}

async function importPatient({ fullName, cardNumber, birthDate, sex, omsNumber, bloodGroup, allergies, phone, guildId }) {
  if (cardNumber) {
    const dup = await prisma.patients.findUnique({ where: { cardNumber } });
    if (dup) { const e = new Error('Карта уже существует'); e.code = 'DUP_CARD'; throw e; }
  }
  if (omsNumber) {
    const dup = await prisma.patients.findFirst({ where: { omsNumber } });
    if (dup) { const e = new Error('ОМС уже существует'); e.code = 'DUP_OMS'; throw e; }
  }
  const finalCard = cardNumber || await nextCardNumber(guildId);
  const p = await prisma.patients.create({
    data: {
      cardNumber: finalCard, fullName, birthDate: birthDate || null, sex: sex || null,
      omsNumber: omsNumber || null, bloodGroup: bloodGroup || null,
      allergies: allergies || null, phone: phone || null,
      guildId: guildId || '',
    },
  });
  await audit({ actorId: null, action: 'patient.import', entityType: 'patient', entityId: String(p.id), details: { fullName, finalCard, source: 'discord-forum' }, guildId });
  return { id: p.id, card_number: finalCard };
}

async function linkPatientByCode(code, discordId) {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const row = await prisma.linkCode.findUnique({ where: { code: normalized } });
  if (!row) { const e = new Error('Код не найден'); e.code = 'NOT_FOUND'; throw e; }
  if (row.usedAt) { const e = new Error('Код уже использован'); e.code = 'USED'; throw e; }
  if (new Date(row.expiresAt) < new Date()) { const e = new Error('Код истёк'); e.code = 'EXPIRED'; throw e; }
  const patient = await getPatientById(row.patientId);
  if (!patient) { const e = new Error('Пациент не найден'); e.code = 'PATIENT_NOT_FOUND'; throw e; }
  await prisma.linkCode.update({ where: { code: normalized }, data: { usedAt: new Date() } });
  await prisma.patients.update({ where: { id: row.patientId }, data: { discordId } });
  await audit({ actorId: null, action: 'citizen.link', entityType: 'patient', entityId: String(row.patientId), details: { discordId, code: normalized } });
  return patient;
}

async function createLinkCode(patientId, guildId) {
  await prisma.linkCode.deleteMany({ where: { patientId, usedAt: null } });
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.linkCode.create({ data: { code, patientId, expiresAt: expires, guildId: guildId || '' } });
  return { code, expiresAt: expires.toISOString() };
}

async function setPatientBlocked(patientId, blocked, actorId) {
  await prisma.patients.update({ where: { id: patientId }, data: { status: blocked ? 'blocked' : 'active' } });
  await audit({ actorId, action: blocked ? 'patient.block' : 'patient.unblock', entityType: 'patient', entityId: String(patientId) });
}

// ─── Коды авторизации сайта (бот → сайт) ────────────────────────────────

async function createSiteAuthCode(discordId, discordUsername, guildId) {
  await prisma.siteAuthCode.deleteMany({ where: { discordId, usedAt: null } });
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  const expires = new Date(Date.now() + 10 * 60 * 1000);
  await prisma.siteAuthCode.create({
    data: { code, discordId, discordUsername: discordUsername || null, expiresAt: expires, guildId: guildId || '' },
  });
  await audit({ actorId: null, action: 'site_auth.create', entityType: 'user', entityId: discordId, details: { code }, guildId });
  return { code, expiresAt: expires.toISOString() };
}

async function consumeSiteAuthCode(code) {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const row = await prisma.siteAuthCode.findUnique({ where: { code: normalized } });
  if (!row) { const e = new Error('Код не найден'); e.code = 'NOT_FOUND'; throw e; }
  if (row.usedAt) { const e = new Error('Код уже использован'); e.code = 'USED'; throw e; }
  if (new Date(row.expiresAt) < new Date()) { const e = new Error('Код истёк'); e.code = 'EXPIRED'; throw e; }
  await prisma.siteAuthCode.update({ where: { code: normalized }, data: { usedAt: new Date() } });

  const existing = await prisma.citizenAccount.findUnique({ where: { discordId: row.discordId } });
  if (existing) {
    await prisma.citizenAccount.update({
      where: { discordId: row.discordId },
      data: { lastLoginAt: new Date(), discordUsername: row.discordUsername || existing.discordUsername },
    });
  } else {
    await prisma.citizenAccount.create({
      data: { discordId: row.discordId, discordUsername: row.discordUsername || null, lastLoginAt: new Date(), guildId: row.guildId || '' },
    });
  }

  await audit({ actorId: null, action: 'site_auth.consume', entityType: 'user', entityId: row.discordId, details: { code: normalized } });
  return { discordId: row.discordId, discordUsername: row.discordUsername };
}

async function getSiteAuthCode(code) {
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return await prisma.siteAuthCode.findUnique({ where: { code: normalized } });
}

// ─── Талоны / Очередь ───────────────────────────────────────────────────

async function getQueue(dateISO, guildId) {
  const d = dateISO || new Date().toISOString().slice(0, 10);
  const where = { date: d, status: { not: 'cancelled' } };
  if (guildId) where.guildId = guildId;
  const rows = await prisma.appointment.findMany({ where, orderBy: { time: 'asc' } });
  const result = [];
  for (const a of rows) {
    const patient = await prisma.patients.findUnique({ where: { id: a.patientId } });
    const doctor = a.doctorId ? await prisma.users.findUnique({ where: { id: a.doctorId } }) : null;
    result.push(mapAppointment({ ...a, patient, doctor }));
  }
  return result;
}

async function getSchedule(doctorId, dateISO, guildId) {
  const where = { doctorId, date: dateISO, status: { in: ['waiting', 'in_room'] } };
  if (guildId) where.guildId = guildId;
  const rows = await prisma.appointment.findMany({ where, orderBy: { time: 'asc' } });
  const result = [];
  for (const a of rows) {
    const patient = await prisma.patients.findUnique({ where: { id: a.patientId } });
    result.push({ id: a.id, ticket_number: a.ticketNumber, date: a.date, time: a.time,
      status: a.status, room: a.room, patient_name: patient?.fullName, patient_card: patient?.cardNumber });
  }
  return result;
}

async function bookAppointment({ patientId, doctorId, date, time, room, viaDiscordId, guildId }) {
  const pRaw = await prisma.patients.findUnique({ where: { id: patientId } });
  if (!pRaw) { const e = new Error('Пациент не найден'); e.code = 'PATIENT_NOT_FOUND'; throw e; }
  if (pRaw.status === 'blocked') { const e = new Error('Пациент заблокирован'); e.code = 'BLOCKED'; throw e; }

  if (doctorId) {
    const doc = await prisma.users.findUnique({ where: { id: doctorId } });
    if (!doc || doc.isActive === 0) { const e = new Error('Врач не найден'); e.code = 'DOCTOR_NOT_FOUND'; throw e; }
    const conflict = await prisma.appointment.findFirst({
      where: { doctorId, date, time, status: { in: ['waiting', 'in_room'] } },
    });
    if (conflict) { const e = new Error('Время у врача занято'); e.code = 'DOCTOR_CONFLICT'; throw e; }
  }

  const selfConflict = await prisma.appointment.findFirst({
    where: { patientId, date, time, status: { in: ['waiting', 'in_room'] } },
  });
  if (selfConflict) { const e = new Error('У пациента уже есть талон на это время'); e.code = 'SELF_CONFLICT'; throw e; }

  const ticket = await nextTicketNumber(date, guildId);
  const actor = viaDiscordId ? await prisma.users.findUnique({ where: { discordId: viaDiscordId } }) : null;

  const a = await prisma.appointment.create({
    data: {
      ticketNumber: ticket, patientId, doctorId: doctorId || null,
      date, time, status: 'waiting', room: room || null,
      createdBy: actor ? actor.id : null,
      guildId: guildId || '',
    },
  });
  await audit({ actorId: actor ? actor.id : null, action: 'ticket.create', entityType: 'appointment',
    entityId: String(a.id), details: { ticket, patientId, doctorId, date, time }, guildId });
  return { id: a.id, ticket_number: ticket };
}

async function cancelTicket(ticketId, viaDiscordId) {
  const aRaw = await prisma.appointment.findUnique({ where: { id: ticketId } });
  if (!aRaw) { const e = new Error('Талон не найден'); e.code = 'NOT_FOUND'; throw e; }
  if (aRaw.status !== 'waiting') { const e = new Error('Можно отменить только талон в ожидании'); e.code = 'BAD_STATUS'; throw e; }

  const patient = await prisma.patients.findUnique({ where: { id: aRaw.patientId } });
  const staff = viaDiscordId ? await prisma.users.findUnique({ where: { discordId: viaDiscordId } }) : null;
  if (patient?.discordId !== viaDiscordId && !staff) { const e = new Error('Нет прав для отмены'); e.code = 'FORBIDDEN'; throw e; }

  await prisma.appointment.update({ where: { id: ticketId }, data: { status: 'cancelled', updatedAt: new Date() } });
  await audit({ actorId: staff ? staff.id : null, action: 'ticket.cancel', entityType: 'appointment', entityId: String(ticketId) });
  return mapAppointment({ ...aRaw, patient, doctor: null });
}

async function updateTicketStatus(ticketId, nextStatus, viaDiscordId) {
  const aRaw = await prisma.appointment.findUnique({ where: { id: ticketId } });
  if (!aRaw) { const e = new Error('Талон не найден'); e.code = 'NOT_FOUND'; throw e; }
  const allowed = { waiting: ['in_room', 'cancelled', 'no_show'], in_room: ['done', 'cancelled'], done: [], cancelled: [], no_show: [] };
  if (!allowed[aRaw.status]?.includes(nextStatus)) { const e = new Error(`Недопустимый переход ${aRaw.status} → ${nextStatus}`); e.code = 'BAD_TRANSITION'; throw e; }

  const actor = viaDiscordId ? await prisma.users.findUnique({ where: { discordId: viaDiscordId } }) : null;
  if (actor && aRaw.doctorId && aRaw.doctorId !== actor.id && actor.role !== ROLES.HEAD_PHYSICIAN && actor.role !== ROLES.REGISTRAR) {
    const e = new Error('Нет прав'); e.code = 'FORBIDDEN'; throw e;
  }

  await prisma.appointment.update({ where: { id: ticketId }, data: { status: nextStatus, updatedAt: new Date() } });

  if (aRaw.doctorId) {
    if (nextStatus === 'in_room') {
      await prisma.users.update({ where: { id: aRaw.doctorId }, data: { status: 'in_appointment' } });
    } else if (['done', 'cancelled', 'no_show'].includes(nextStatus)) {
      const busy = await prisma.appointment.findFirst({ where: { doctorId: aRaw.doctorId, status: 'in_room' } });
      if (!busy) await prisma.users.update({ where: { id: aRaw.doctorId }, data: { status: 'free' } });
    }
  }

  await audit({ actorId: actor ? actor.id : null, action: 'ticket.status', entityType: 'appointment',
    entityId: String(ticketId), details: { from: aRaw.status, to: nextStatus } });

  const patient = await prisma.patients.findUnique({ where: { id: aRaw.patientId } });
  const doctor = await prisma.users.findUnique({ where: { id: aRaw.doctorId } });
  return mapAppointment({ ...aRaw, status: nextStatus, patient, doctor });
}

async function callNext(doctorId, dateISO) {
  const d = dateISO || new Date().toISOString().slice(0, 10);
  const next = await prisma.appointment.findFirst({
    where: { doctorId, date: d, status: 'waiting' },
    orderBy: { time: 'asc' },
  });
  if (!next) return null;
  return updateTicketStatus(next.id, 'in_room', null);
}

// ─── ЭМК / Рецепты ──────────────────────────────────────────────────────

async function addEmrRecord({ patientId, doctorId, recordType, complaints, diagnosisCode, diagnosisText, notes, sickLeaveDays, guildId }) {
  const r = await prisma.record.create({
    data: {
      patientId, doctorId: doctorId || null, recordType: recordType || 'visit',
      complaints: complaints || null, diagnosisCode: diagnosisCode || null,
      diagnosisText: diagnosisText || null, notes: notes || null,
      sickLeaveDays: sickLeaveDays || null,
      guildId: guildId || '',
    },
  });
  await audit({ actorId: doctorId, action: 'emr.create', entityType: 'patient', entityId: String(patientId), details: { diagnosisCode }, guildId });
  return r.id;
}

async function addPrescription({ patientId, doctorId, medication, dosage, durationDays, guildId }) {
  const num = await nextPrescriptionNumber(guildId);
  const r = await prisma.prescription.create({
    data: {
      prescriptionNumber: num, patientId, doctorId: doctorId || null,
      medication, dosage, durationDays: durationDays || null,
      guildId: guildId || '',
    },
  });
  await audit({ actorId: doctorId, action: 'prescription.create', entityType: 'patient', entityId: String(patientId), details: { medication }, guildId });
  return { id: r.id, prescription_number: num };
}

// ─── Аудит / Статистика ─────────────────────────────────────────────────

async function audit({ actorId, action, entityType, entityId, details, ip, guildId }) {
  await prisma.auditLog.create({
    data: {
      actorId: actorId || null, action, entityType: entityType || null,
      entityId: entityId || null, details: details ? JSON.stringify(details) : null,
      ip: ip || null, guildId: guildId || '',
    },
  }).catch(() => {});
}

async function getAudit(guildId, limit = 50) {
  const where = {};
  if (guildId) where.guildId = guildId;
  const rows = await prisma.auditLog.findMany({
    where, orderBy: { id: 'desc' }, take: limit,
  });
  return rows.map(mapAudit);
}

async function getStats(guildId) {
  const today = new Date().toISOString().slice(0, 10);

  const wherePatients = guildId ? { guildId } : {};
  const whereStaff = guildId ? { isActive: 1, guildId } : { isActive: 1 };
  const whereToday = guildId ? { date: today, guildId } : { date: today };

  const [patientsTotal, patientsBlocked, staffTotal, ticketsToday, waitingToday, doneToday] = await Promise.all([
    prisma.patients.count({ where: wherePatients }),
    prisma.patients.count({ where: { ...wherePatients, status: 'blocked' } }),
    prisma.users.count({ where: whereStaff }),
    prisma.appointment.count({ where: whereToday }),
    prisma.appointment.count({ where: { ...whereToday, status: 'waiting' } }),
    prisma.appointment.count({ where: { ...whereToday, status: 'done' } }),
  ]);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const whereRecords = guildId ? { visitDate: { gte: thirtyDaysAgo }, guildId } : { visitDate: { gte: thirtyDaysAgo } };
  const recordsMonth = await prisma.record.count({ where: whereRecords });

  const loadBySpecialty = await prisma.$queryRawUnsafe(`
    SELECT u.specialty as specialty, COUNT(*)::int as cnt
    FROM "emias"."Appointment" a JOIN "emias"."Users" u ON u.id = a.doctor_id
    WHERE a.date = $1 AND a.status != 'cancelled' ${guildId ? ' AND a.guild_id = $2' : ''}
    GROUP BY u.specialty
  `, ...(guildId ? [today, guildId] : [today]));

  const topDiagnoses = await prisma.$queryRawUnsafe(`
    SELECT diagnosis_code, diagnosis_text, COUNT(*)::int as cnt
    FROM "emias"."Record"
    WHERE diagnosis_code IS NOT NULL ${guildId ? ' AND guild_id = $1' : ''}
    GROUP BY diagnosis_code, diagnosis_text
    ORDER BY cnt DESC LIMIT 5
  `, ...(guildId ? [guildId] : []));

  return { patientsTotal, patientsBlocked, staffTotal, ticketsToday, waitingToday, doneToday, recordsMonth, loadBySpecialty, topDiagnoses };
}

// ─── Очистка фейков ─────────────────────────────────────────────────────

async function purgeFakeData(guildId) {
  const where = guildId ? { guildId } : {};
  const [appointments, emr, prescriptions, auditLogs, linkCodes] = await Promise.all([
    prisma.appointment.count({ where }), prisma.record.count({ where }),
    prisma.prescription.count({ where }), prisma.auditLog.count({ where }), prisma.linkCode.count({ where }),
  ]);
  return { appointments, emr, prescriptions, audit: auditLogs, linkCodes };
}

async function wipeAllFake(guildId) {
  const where = guildId ? { guildId } : {};
  await Promise.all([
    prisma.appointment.deleteMany({ where }),
    prisma.record.deleteMany({ where }),
    prisma.prescription.deleteMany({ where }),
    prisma.auditLog.deleteMany({ where }),
    prisma.linkCode.deleteMany({ where }),
  ]);
  return { ok: true };
}

async function wipePatients(guildId) {
  const where = guildId ? { guildId } : {};
  const patientWhere = guildId ? { guildId } : {};
  const patientIds = (await prisma.patients.findMany({ where: patientWhere, select: { id: true } })).map(p => p.id);
  await Promise.all([
    prisma.patients.deleteMany({ where: patientWhere }),
    prisma.appointment.deleteMany({ where: { patientId: { in: patientIds }, ...where } }),
    prisma.record.deleteMany({ where: { patientId: { in: patientIds }, ...where } }),
    prisma.prescription.deleteMany({ where: { patientId: { in: patientIds }, ...where } }),
    prisma.linkCode.deleteMany({ where: { patientId: { in: patientIds }, ...where } }),
  ]);
  return { ok: true };
}

module.exports = {
  getUserByDiscordId, getUserById, getAllStaff, getDoctors,
  createStaff, updateStaff, deactivateStaff, setDoctorStatus,
  getPatientById, searchPatients, getCitizensByDiscordId, getPatientCard,
  createPatient, importPatient, linkPatientByCode, createLinkCode, setPatientBlocked,
  createSiteAuthCode, consumeSiteAuthCode, getSiteAuthCode,
  getQueue, getSchedule, bookAppointment, cancelTicket, updateTicketStatus, callNext,
  addEmrRecord, addPrescription,
  audit, getAudit, getStats,
  purgeFakeData, wipeAllFake, wipePatients,
};
