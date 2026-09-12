const PROJECT = {
  NAME: 'ЕМИАС',
  FULL_NAME: 'ЕМИАС · Единая медицинская информационно-аналитическая система',
  DISCLAIMER: 'Данный бот не является официальным ресурсом. Проект создан исключительно для RP-проекта.',
};

const PALETTE = {
  PRIMARY: '#0063B0',
  EMK: '#0066CC',
  BG: '#F5F7FA',
  DANGER: '#C0392B',
  SUCCESS: '#2E8B57',
  WARNING: '#D4A017',
  TEXT: '#333333',
};

const ROLES = {
  HEAD_PHYSICIAN: 'Главный врач',
  PHYSICIAN: 'Врач',
  REGISTRAR: 'Регистратор',
  NURSE: 'Медсестра',
};
const ALL_ROLES = Object.values(ROLES);

const TICKET_STATUS = {
  WAITING: 'waiting',
  IN_ROOM: 'in_room',
  DONE: 'done',
  CANCELLED: 'cancelled',
  NO_SHOW: 'no_show',
};
const TICKET_STATUS_LABELS = {
  waiting: 'Ожидание',
  in_room: 'В кабинете',
  done: 'Принят',
  cancelled: 'Отменён',
  no_show: 'Не явился',
};
const TICKET_STATUS_EMOJI = {
  waiting: '🟡',
  in_room: '🔵',
  done: '🟢',
  cancelled: '🔴',
  no_show: '⚪',
};

const DOCTOR_STATUS = {
  FREE: 'free',
  IN_APPOINTMENT: 'in_appointment',
  OFFLINE: 'offline',
};
const DOCTOR_STATUS_LABELS = {
  free: 'Свободен',
  in_appointment: 'На приёме',
  offline: 'Не на смене',
};
const DOCTOR_STATUS_EMOJI = {
  free: '🟢',
  in_appointment: '🟡',
  offline: '⚫',
};

const SPECIALTIES = [
  { code: 'terapevt', name: 'Терапевт', emoji: '🩺' },
  { code: 'pediatr', name: 'Педиатр', emoji: '🧸' },
  { code: 'hirurg', name: 'Хирург', emoji: '🔪' },
  { code: 'nevrolog', name: 'Невролог', emoji: '🧠' },
  { code: 'oftalmolog', name: 'Офтальмолог', emoji: '👁️' },
  { code: 'lor', name: 'Оториноларинголог', emoji: '👃' },
  { code: 'kardiolog', name: 'Кардиолог', emoji: '❤️' },
  { code: 'endokrinolog', name: 'Эндокринолог', emoji: '🧬' },
];

const DOC_FORMAT = {
  CARD_PREFIX: 'ЕМК',
  TICKET_PREFIX: 'Т',
  PRESCRIPTION_PREFIX: 'Р',
};

const RECORD_TYPES = {
  VISIT: 'visit',
  LAB: 'lab',
  PROCEDURE: 'procedure',
};
const RECORD_TYPE_LABELS = {
  visit: 'Приём (осмотр)',
  lab: 'Лабораторное исследование',
  procedure: 'Медицинская процедура',
};
const RECORD_TYPE_EMOJI = {
  visit: '📋',
  lab: '🧪',
  procedure: '⚕️',
};

const WS_EVENTS = {
  QUEUE_UPDATED: 'queue.updated',
  APPOINTMENT_CREATED: 'appointment.created',
  APPOINTMENT_STATUS_UPDATED: 'appointment.status.updated',
  DOCTOR_STATUS_UPDATED: 'doctor.status.updated',
  PATIENT_CREATED: 'patient.created',
  PATIENT_UPDATED: 'patient.updated',
  EMR_UPDATED: 'emr.updated',
};

module.exports = {
  PROJECT,
  PALETTE,
  ROLES,
  ALL_ROLES,
  TICKET_STATUS,
  TICKET_STATUS_LABELS,
  TICKET_STATUS_EMOJI,
  DOCTOR_STATUS,
  DOCTOR_STATUS_LABELS,
  DOCTOR_STATUS_EMOJI,
  SPECIALTIES,
  DOC_FORMAT,
  RECORD_TYPES,
  RECORD_TYPE_LABELS,
  RECORD_TYPE_EMOJI,
  WS_EVENTS,
};
