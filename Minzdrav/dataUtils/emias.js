'use strict';

const { getSqliteDb } = require('./db');
const { ROLES } = require('../utils/constants');

// Хелперы нумерации документов (чистые, без фейков — последовательные)
function nextCardNumber(db) {
  const year = new Date().getFullYear();
  const prefix = `ЕМК-${year}-`;
  const row = db.prepare(`SELECT card_number FROM patients WHERE card_number LIKE ? ORDER BY id DESC LIMIT 1`).get(`${prefix}%`);
  const last = row ? Number(row.card_number.slice(prefix.length)) : 0;
  return `${prefix}${String(last + 1).padStart(6, '0')}`;
}
function nextTicketNumber(db, dateISO) {
  const compact = dateISO.replaceAll('-', '');
  const prefix = `Т-${compact}-`;
  const row = db.prepare(`SELECT ticket_number FROM appointments WHERE ticket_number LIKE ? ORDER BY ticket_number DESC LIMIT 1`).get(`${prefix}%`);
  const last = row ? Number(row.ticket_number.slice(prefix.length)) : 0;
  return `${prefix}${String(last + 1).padStart(3, '0')}`;
}
function nextPrescriptionNumber(db) {
  const year = new Date().getFullYear();
  const prefix = `Р-${year}-`;
  const row = db.prepare(`SELECT prescription_number FROM prescriptions WHERE prescription_number LIKE ? ORDER BY id DESC LIMIT 1`).get(`${prefix}%`);
  const last = row ? Number(row.prescription_number.slice(prefix.length)) : 0;
  return `${prefix}${String(last + 1).padStart(6, '0')}`;
}

// ─── Пользователи (персонал) ────────────────────────────────────────────
function getUserByDiscordId(discordId) {
  const db = getSqliteDb();
  return db.prepare(`SELECT * FROM users WHERE discord_id = ? AND is_active = 1`).get(discordId) || null;
}
function getUserById(id) {
  const db = getSqliteDb();
  return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) || null;
}
function getAllStaff() {
  const db = getSqliteDb();
  return db.prepare(`SELECT * FROM users WHERE is_active=1 ORDER BY CASE role WHEN 'Главный врач' THEN 0 WHEN 'Врач' THEN 1 WHEN 'Регистратор' THEN 2 ELSE 3 END, full_name`).all();
}
function getDoctors() {
  const db = getSqliteDb();
  return db.prepare(`SELECT * FROM users WHERE is_active=1 AND role IN ('Врач','Главный врач') ORDER BY full_name`).all();
}
function createStaff({ discordId, discordUsername, fullName, specialty, role }) {
  const db = getSqliteDb();
  const r = db.prepare(`INSERT INTO users (discord_id, discord_username, full_name, specialty, role, status) VALUES (?, ?, ?, ?, ?, 'free')`).run(discordId || null, discordUsername || null, fullName, specialty || null, role);
  audit({ actorId: null, action: 'staff.create', entityType: 'user', entityId: String(r.lastInsertRowid), details: { fullName, role, specialty } });
  return r.lastInsertRowid;
}
function updateStaff(id, fields) {
  const db = getSqliteDb();
  const sets = [];
  const vals = [];
  if (fields.full_name !== undefined) { sets.push('full_name=?'); vals.push(fields.full_name); }
  if (fields.specialty !== undefined) { sets.push('specialty=?'); vals.push(fields.specialty); }
  if (fields.role !== undefined) { sets.push('role=?'); vals.push(fields.role); }
  if (fields.status !== undefined) { sets.push('status=?'); vals.push(fields.status); }
  if (fields.discord_id !== undefined) { sets.push('discord_id=?'); vals.push(fields.discord_id); }
  if (fields.discord_username !== undefined) { sets.push('discord_username=?'); vals.push(fields.discord_username); }
  if (!sets.length) return;
  vals.push(id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id=?`).run(...vals);
}
function deactivateStaff(id) {
  const db = getSqliteDb();
  db.prepare(`UPDATE users SET is_active=0, status='offline' WHERE id=?`).run(id);
  audit({ actorId: null, action: 'staff.deactivate', entityType: 'user', entityId: String(id) });
}
function setDoctorStatus(discordId, status) {
  const db = getSqliteDb();
  const u = getUserByDiscordId(discordId);
  if (!u) return null;
  db.prepare(`UPDATE users SET status=? WHERE id=?`).run(status, u.id);
  audit({ actorId: u.id, action: 'staff.status', entityType: 'user', entityId: String(u.id), details: { status } });
  return { ...u, status };
}

// ─── Пациенты ───────────────────────────────────────────────────────────
function getPatientById(id) {
  const db = getSqliteDb();
  return db.prepare(`SELECT * FROM patients WHERE id=?`).get(id) || null;
}
function searchPatients(query, limit = 20) {
  const db = getSqliteDb();
  if (!query) return db.prepare(`SELECT * FROM patients ORDER BY created_at DESC LIMIT ?`).all(limit);
  const like = `%${query}%`;
  return db.prepare(`SELECT * FROM patients WHERE full_name LIKE ? OR card_number LIKE ? OR oms_number LIKE ? ORDER BY full_name LIMIT ?`).all(like, like, like, limit);
}
function getCitizensByDiscordId(discordId) {
  const db = getSqliteDb();
  return db.prepare(`SELECT * FROM patients WHERE discord_id=? ORDER BY full_name`).all(discordId);
}
function getPatientCard(patientId) {
  const db = getSqliteDb();
  const patient = getPatientById(patientId);
  if (!patient) return null;
  const tickets = db.prepare(`SELECT a.*, u.full_name as doctor_name FROM appointments a LEFT JOIN users u ON u.id=a.doctor_id WHERE a.patient_id=? AND a.status IN ('waiting','in_room') ORDER BY a.date, a.time`).all(patientId);
  const records = db.prepare(`SELECT * FROM emr_records WHERE patient_id=? ORDER BY visit_date DESC LIMIT 5`).all(patientId);
  const prescriptions = db.prepare(`SELECT * FROM prescriptions WHERE patient_id=? ORDER BY issued_at DESC LIMIT 5`).all(patientId);
  const doctor = patient.discord_id ? getUserByDiscordId(patient.discord_id) : null;
  return { patient, tickets, records, prescriptions, linkedDiscord: patient.discord_id };
}
function createPatient({ fullName, birthDate, sex, omsNumber, bloodGroup, allergies, phone, discordId, createdBy }) {
  const db = getSqliteDb();
  if (omsNumber) {
    const dup = db.prepare(`SELECT id FROM patients WHERE oms_number=?`).get(omsNumber);
    if (dup) { const e = new Error('Пациент с таким ОМС уже существует'); e.code = 'DUP_OMS'; throw e; }
  }
  const card = nextCardNumber(db);
  const r = db.prepare(`INSERT INTO patients (card_number, full_name, birth_date, sex, oms_number, blood_group, allergies, phone, discord_id, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(card, fullName, birthDate || null, sex || null, omsNumber || null, bloodGroup || null, allergies || null, phone || null, discordId || null, createdBy || null);
  audit({ actorId: createdBy || null, action: 'patient.create', entityType: 'patient', entityId: String(r.lastInsertRowid), details: { fullName, card } });
  return { id: r.lastInsertRowid, card_number: card };
}
function importPatient({ fullName, cardNumber, birthDate, sex, omsNumber, bloodGroup, allergies, phone }) {
  const db = getSqliteDb();
  if (cardNumber) {
    const dup = db.prepare(`SELECT id FROM patients WHERE card_number=?`).get(cardNumber);
    if (dup) { const e = new Error('Карта уже существует'); e.code = 'DUP_CARD'; throw e; }
  }
  if (omsNumber) {
    const dup = db.prepare(`SELECT id FROM patients WHERE oms_number=?`).get(omsNumber);
    if (dup) { const e = new Error('ОМС уже существует'); e.code = 'DUP_OMS'; throw e; }
  }
  const finalCard = cardNumber || nextCardNumber(db);
  const r = db.prepare(`INSERT INTO patients (card_number, full_name, birth_date, sex, oms_number, blood_group, allergies, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(finalCard, fullName, birthDate || null, sex || null, omsNumber || null, bloodGroup || null, allergies || null, phone || null);
  audit({ actorId: null, action: 'patient.import', entityType: 'patient', entityId: String(r.lastInsertRowid), details: { fullName, finalCard, source: 'discord-forum' } });
  return { id: r.lastInsertRowid, card_number: finalCard };
}
function linkPatientByCode(code, discordId) {
  const db = getSqliteDb();
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const row = db.prepare(`SELECT * FROM link_codes WHERE code=?`).get(normalized);
  if (!row) { const e = new Error('Код не найден'); e.code = 'NOT_FOUND'; throw e; }
  if (row.used_at) { const e = new Error('Код уже использован'); e.code = 'USED'; throw e; }
  if (new Date(row.expires_at) < new Date()) { const e = new Error('Код истёк'); e.code = 'EXPIRED'; throw e; }
  const patient = getPatientById(row.patient_id);
  if (!patient) { const e = new Error('Пациент не найден'); e.code = 'PATIENT_NOT_FOUND'; throw e; }
  db.prepare(`UPDATE link_codes SET used_at=datetime('now') WHERE code=?`).run(normalized);
  db.prepare(`UPDATE patients SET discord_id=? WHERE id=?`).run(discordId, row.patient_id);
  audit({ actorId: null, action: 'citizen.link', entityType: 'patient', entityId: String(row.patient_id), details: { discordId, code: normalized } });
  return patient;
}
function createLinkCode(patientId) {
  const db = getSqliteDb();
  db.prepare(`DELETE FROM link_codes WHERE patient_id=? AND used_at IS NULL`).run(patientId);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  const expires = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  db.prepare(`INSERT INTO link_codes (code, patient_id, expires_at) VALUES (?, ?, ?)`).run(code, patientId, expires);
  return { code, expiresAt: expires };
}
function setPatientBlocked(patientId, blocked, actorId) {
  const db = getSqliteDb();
  const status = blocked ? 'blocked' : 'active';
  db.prepare(`UPDATE patients SET status=? WHERE id=?`).run(status, patientId);
  audit({ actorId, action: blocked ? 'patient.block' : 'patient.unblock', entityType: 'patient', entityId: String(patientId) });
}

// ─── Коды авторизации сайта (бот → сайт) ─────────────────────────────────
function createSiteAuthCode(discordId, discordUsername) {
  const db = getSqliteDb();
  // Инвалидируем старые неиспользованные коды этого пользователя
  db.prepare(`DELETE FROM site_auth_codes WHERE discord_id=? AND used_at IS NULL`).run(discordId);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 мин
  db.prepare(`INSERT INTO site_auth_codes (code, discord_id, discord_username, expires_at) VALUES (?, ?, ?, ?)`).run(code, discordId, discordUsername || null, expires);
  audit({ actorId: null, action: 'site_auth.create', entityType: 'user', entityId: discordId, details: { code } });
  return { code, expiresAt: expires };
}

function consumeSiteAuthCode(code) {
  const db = getSqliteDb();
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const row = db.prepare(`SELECT * FROM site_auth_codes WHERE code=?`).get(normalized);
  if (!row) { const e = new Error('Код не найден'); e.code = 'NOT_FOUND'; throw e; }
  if (row.used_at) { const e = new Error('Код уже использован'); e.code = 'USED'; throw e; }
  if (new Date(row.expires_at) < new Date()) { const e = new Error('Код истёк'); e.code = 'EXPIRED'; throw e; }
  db.prepare(`UPDATE site_auth_codes SET used_at=datetime('now') WHERE code=?`).run(normalized);

  // Убедимся что citizen_accounts существует
  const existing = db.prepare(`SELECT * FROM citizen_accounts WHERE discord_id=?`).get(row.discord_id);
  if (existing) {
    db.prepare(`UPDATE citizen_accounts SET last_login_at=datetime('now'), discord_username=? WHERE discord_id=?`).run(row.discord_username || existing.discord_username, row.discord_id);
  } else {
    db.prepare(`INSERT INTO citizen_accounts (discord_id, discord_username, last_login_at) VALUES (?, ?, datetime('now'))`).run(row.discord_id, row.discord_username || null);
  }

  // Также гарантируем что users запись для персонала может быть создана позже через /штаб, но для сайта достаточно citizen_accounts
  audit({ actorId: null, action: 'site_auth.consume', entityType: 'user', entityId: row.discord_id, details: { code: normalized } });
  return { discordId: row.discord_id, discordUsername: row.discord_username };
}

function getSiteAuthCode(code) {
  const db = getSqliteDb();
  const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return db.prepare(`SELECT * FROM site_auth_codes WHERE code=?`).get(normalized) || null;
}

// ─── Талоны / Очередь ───────────────────────────────────────────────────
function getQueue(dateISO) {
  const db = getSqliteDb();
  const d = dateISO || new Date().toISOString().slice(0, 10);
  return db.prepare(`
    SELECT a.*, p.full_name as patient_name, p.card_number as patient_card, p.discord_id as patient_discord_id,
           u.full_name as doctor_name, u.specialty as doctor_specialty
    FROM appointments a
    JOIN patients p ON p.id=a.patient_id
    LEFT JOIN users u ON u.id=a.doctor_id
    WHERE a.date=? AND a.status != 'cancelled'
    ORDER BY a.time
  `).all(d);
}
function getSchedule(doctorId, dateISO) {
  const db = getSqliteDb();
  return db.prepare(`SELECT a.*, p.full_name as patient_name, p.card_number as patient_card FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.doctor_id=? AND a.date=? AND a.status IN ('waiting','in_room') ORDER BY a.time`).all(doctorId, dateISO);
}
function bookAppointment({ patientId, doctorId, date, time, room, viaDiscordId }) {
  const db = getSqliteDb();
  const patient = getPatientById(patientId);
  if (!patient) { const e = new Error('Пациент не найден'); e.code = 'PATIENT_NOT_FOUND'; throw e; }
  if (patient.status === 'blocked') { const e = new Error('Пациент заблокирован'); e.code = 'BLOCKED'; throw e; }
  if (doctorId) {
    const doc = getUserById(doctorId);
    if (!doc || doc.is_active === 0) { const e = new Error('Врач не найден'); e.code = 'DOCTOR_NOT_FOUND'; throw e; }
    const conflict = db.prepare(`SELECT id FROM appointments WHERE doctor_id=? AND date=? AND time=? AND status IN ('waiting','in_room')`).get(doctorId, date, time);
    if (conflict) { const e = new Error('Время у врача занято'); e.code = 'DOCTOR_CONFLICT'; throw e; }
  }
  const selfConflict = db.prepare(`SELECT id FROM appointments WHERE patient_id=? AND date=? AND time=? AND status IN ('waiting','in_room')`).get(patientId, date, time);
  if (selfConflict) { const e = new Error('У пациента уже есть талон на это время'); e.code = 'SELF_CONFLICT'; throw e; }
  const ticket = nextTicketNumber(db, date);
  const actor = viaDiscordId ? getUserByDiscordId(viaDiscordId) : null;
  const r = db.prepare(`INSERT INTO appointments (ticket_number, patient_id, doctor_id, date, time, status, room, created_by) VALUES (?, ?, ?, ?, ?, 'waiting', ?, ?)`).run(ticket, patientId, doctorId || null, date, time, room || null, actor ? actor.id : null);
  audit({ actorId: actor ? actor.id : null, action: 'ticket.create', entityType: 'appointment', entityId: String(r.lastInsertRowid), details: { ticket, patientId, doctorId, date, time } });
  return { id: r.lastInsertRowid, ticket_number: ticket };
}
function cancelTicket(ticketId, viaDiscordId) {
  const db = getSqliteDb();
  const ticket = db.prepare(`SELECT a.*, p.discord_id as patient_discord_id FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.id=?`).get(ticketId);
  if (!ticket) { const e = new Error('Талон не найден'); e.code = 'NOT_FOUND'; throw e; }
  if (ticket.status !== 'waiting') { const e = new Error('Можно отменить только талон в ожидании'); e.code = 'BAD_STATUS'; throw e; }
  // Проверка прав: свой талон или сотрудник
  const staff = viaDiscordId ? getUserByDiscordId(viaDiscordId) : null;
  if (ticket.patient_discord_id !== viaDiscordId && !staff) { const e = new Error('Нет прав для отмены'); e.code = 'FORBIDDEN'; throw e; }
  db.prepare(`UPDATE appointments SET status='cancelled', updated_at=datetime('now') WHERE id=?`).run(ticketId);
  audit({ actorId: staff ? staff.id : null, action: 'ticket.cancel', entityType: 'appointment', entityId: String(ticketId) });
  return ticket;
}
function updateTicketStatus(ticketId, nextStatus, viaDiscordId) {
  const db = getSqliteDb();
  const ticket = db.prepare(`SELECT * FROM appointments WHERE id=?`).get(ticketId);
  if (!ticket) { const e = new Error('Талон не найден'); e.code = 'NOT_FOUND'; throw e; }
  const allowed = { waiting: ['in_room', 'cancelled', 'no_show'], in_room: ['done', 'cancelled'], done: [], cancelled: [], no_show: [] };
  if (!allowed[ticket.status]?.includes(nextStatus)) { const e = new Error(`Недопустимый переход ${ticket.status} → ${nextStatus}`); e.code = 'BAD_TRANSITION'; throw e; }
  // RBAC: только свой врач / регистратор / главврач
  const actor = viaDiscordId ? getUserByDiscordId(viaDiscordId) : null;
  if (actor && ticket.doctor_id && ticket.doctor_id !== actor.id && actor.role !== ROLES.HEAD_PHYSICIAN && actor.role !== ROLES.REGISTRAR) {
    const e = new Error('Нет прав'); e.code = 'FORBIDDEN'; throw e;
  }
  db.prepare(`UPDATE appointments SET status=?, updated_at=datetime('now') WHERE id=?`).run(nextStatus, ticketId);
  // Синхрон статуса врача
  if (ticket.doctor_id) {
    if (nextStatus === 'in_room') db.prepare(`UPDATE users SET status='in_appointment' WHERE id=?`).run(ticket.doctor_id);
    else if (['done', 'cancelled', 'no_show'].includes(nextStatus)) {
      const busy = db.prepare(`SELECT id FROM appointments WHERE doctor_id=? AND status='in_room' LIMIT 1`).get(ticket.doctor_id);
      if (!busy) db.prepare(`UPDATE users SET status='free' WHERE id=? AND status='in_appointment'`).run(ticket.doctor_id);
    }
  }
  audit({ actorId: actor ? actor.id : null, action: 'ticket.status', entityType: 'appointment', entityId: String(ticketId), details: { from: ticket.status, to: nextStatus } });
  return { ...ticket, status: nextStatus };
}
function callNext(doctorId, dateISO) {
  const db = getSqliteDb();
  const d = dateISO || new Date().toISOString().slice(0, 10);
  const next = db.prepare(`SELECT * FROM appointments WHERE doctor_id=? AND date=? AND status='waiting' ORDER BY time LIMIT 1`).get(doctorId, d);
  if (!next) return null;
  return updateTicketStatus(next.id, 'in_room', null);
}

// ─── ЭМК / Рецепты ──────────────────────────────────────────────────────
function addEmrRecord({ patientId, doctorId, recordType, complaints, diagnosisCode, diagnosisText, notes, sickLeaveDays }) {
  const db = getSqliteDb();
  const r = db.prepare(`INSERT INTO emr_records (patient_id, doctor_id, visit_date, record_type, complaints, diagnosis_code, diagnosis_text, notes, sick_leave_days) VALUES (?, ?, datetime('now','localtime'), ?, ?, ?, ?, ?, ?)`).run(patientId, doctorId, recordType || 'visit', complaints || null, diagnosisCode || null, diagnosisText || null, notes || null, sickLeaveDays || null);
  audit({ actorId: doctorId, action: 'emr.create', entityType: 'patient', entityId: String(patientId), details: { diagnosisCode } });
  return r.lastInsertRowid;
}
function addPrescription({ patientId, doctorId, medication, dosage, durationDays }) {
  const db = getSqliteDb();
  const num = nextPrescriptionNumber(db);
  const r = db.prepare(`INSERT INTO prescriptions (prescription_number, patient_id, doctor_id, medication, dosage, duration_days) VALUES (?, ?, ?, ?, ?, ?)`).run(num, patientId, doctorId, medication, dosage, durationDays || null);
  audit({ actorId: doctorId, action: 'prescription.create', entityType: 'patient', entityId: String(patientId), details: { medication } });
  return { id: r.lastInsertRowid, prescription_number: num };
}

// ─── Аудит / Статистика ─────────────────────────────────────────────────
function audit({ actorId, action, entityType, entityId, details, ip }) {
  const db = getSqliteDb();
  db.prepare(`INSERT INTO audit_log (actor_id, action, entity_type, entity_id, details, ip) VALUES (?, ?, ?, ?, ?, ?)`).run(actorId || null, action, entityType || null, entityId || null, details ? JSON.stringify(details) : null, ip || null);
}
function getAudit(limit = 50) {
  const db = getSqliteDb();
  return db.prepare(`SELECT a.*, u.full_name as actor_name FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT ?`).all(limit);
}
function getStats() {
  const db = getSqliteDb();
  const today = new Date().toISOString().slice(0, 10);
  const patientsTotal = db.prepare(`SELECT COUNT(*) as c FROM patients`).get().c;
  const patientsBlocked = db.prepare(`SELECT COUNT(*) as c FROM patients WHERE status='blocked'`).get().c;
  const staffTotal = db.prepare(`SELECT COUNT(*) as c FROM users WHERE is_active=1`).get().c;
  const ticketsToday = db.prepare(`SELECT COUNT(*) as c FROM appointments WHERE date=?`).get(today).c;
  const waitingToday = db.prepare(`SELECT COUNT(*) as c FROM appointments WHERE date=? AND status='waiting'`).get(today).c;
  const doneToday = db.prepare(`SELECT COUNT(*) as c FROM appointments WHERE date=? AND status='done'`).get(today).c;
  const recordsMonth = db.prepare(`SELECT COUNT(*) as c FROM emr_records WHERE visit_date >= date('now','-30 days')`).get().c;
  const loadBySpecialty = db.prepare(`SELECT u.specialty as specialty, COUNT(*) as cnt FROM appointments a JOIN users u ON u.id=a.doctor_id WHERE a.date=? GROUP BY u.specialty`).all(today);
  const topDiagnoses = db.prepare(`SELECT diagnosis_code, diagnosis_text, COUNT(*) as cnt FROM emr_records WHERE diagnosis_code IS NOT NULL GROUP BY diagnosis_code ORDER BY cnt DESC LIMIT 5`).all();
  return { patientsTotal, patientsBlocked, staffTotal, ticketsToday, waitingToday, doneToday, recordsMonth, loadBySpecialty, topDiagnoses };
}

// ─── Очистка фейков ─────────────────────────────────────────────────────
function purgeFakeData() {
  const db = getSqliteDb();
  // Удаляем все тестовые данные, оставляя только структуру + реальных сотрудников (если они привязаны к реальным Discord ID)
  // Здесь — полная очистка пациентов/талонов для чистого старта (вызывается вручную главврачом или при первом запуске)
  const counts = {};
  counts.appointments = db.prepare(`SELECT COUNT(*) as c FROM appointments`).get().c;
  counts.emr = db.prepare(`SELECT COUNT(*) as c FROM emr_records`).get().c;
  counts.prescriptions = db.prepare(`SELECT COUNT(*) as c FROM prescriptions`).get().c;
  counts.audit = db.prepare(`SELECT COUNT(*) as c FROM audit_log`).get().c;
  // Не удаляем автоматически — только по явному вызову
  return counts;
}
function wipeAllFake() {
  const db = getSqliteDb();
  db.exec(`DELETE FROM appointments; DELETE FROM emr_records; DELETE FROM prescriptions; DELETE FROM audit_log; DELETE FROM link_codes;`);
  // Не трогаем users/patients — их чистит отдельно или оставляет
  // Для полной очистки (как просили):
  // db.exec(`DELETE FROM patients; DELETE FROM citizen_accounts; DELETE FROM citizen_sessions;`);
  return { ok: true };
}
function wipePatients() {
  const db = getSqliteDb();
  db.exec(`DELETE FROM patients; DELETE FROM appointments; DELETE FROM emr_records; DELETE FROM prescriptions; DELETE FROM link_codes;`);
  return { ok: true };
}

module.exports = {
  nextCardNumber,
  nextTicketNumber,
  nextPrescriptionNumber,
  getUserByDiscordId,
  getUserById,
  getAllStaff,
  getDoctors,
  createStaff,
  updateStaff,
  deactivateStaff,
  setDoctorStatus,
  getPatientById,
  searchPatients,
  getCitizensByDiscordId,
  getPatientCard,
  createPatient,
  importPatient,
  linkPatientByCode,
  createLinkCode,
  setPatientBlocked,
  createSiteAuthCode,
  consumeSiteAuthCode,
  getSiteAuthCode,
  getQueue,
  getSchedule,
  bookAppointment,
  cancelTicket,
  updateTicketStatus,
  callNext,
  addEmrRecord,
  addPrescription,
  audit,
  getAudit,
  getStats,
  purgeFakeData,
  wipeAllFake,
  wipePatients,
};
