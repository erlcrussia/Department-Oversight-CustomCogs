const { ROLES } = require('./constants');

/**
 * Проверка прав в стиле ЕМИАС RBAC, адаптированная под CustomCogs.
 * Данные берутся из dataUtils (пользователь по discord_id).
 */

function isHeadPhysician(user) {
  return user && user.role === ROLES.HEAD_PHYSICIAN;
}

function isDoctor(user) {
  return user && (user.role === ROLES.PHYSICIAN || user.role === ROLES.HEAD_PHYSICIAN);
}

function isRegistrar(user) {
  return user && user.role === ROLES.REGISTRAR;
}

function isStaff(user) {
  return user && user.is_active !== 0 && [ROLES.HEAD_PHYSICIAN, ROLES.PHYSICIAN, ROLES.REGISTRAR, ROLES.NURSE].includes(user.role);
}

function canSeeMedicalData(user) {
  return isHeadPhysician(user) || isDoctor(user);
}

function canManageTickets(user, ticket) {
  if (!user) return false;
  if (isHeadPhysician(user) || isRegistrar(user)) return true;
  if (ticket && ticket.doctor_id === user.id) return true;
  return false;
}

function requireStaff(user) {
  if (!isStaff(user)) {
    const e = new Error('Требуются права сотрудника Минздрава');
    e.code = 'NOT_STAFF';
    throw e;
  }
}

function requireHead(user) {
  if (!isHeadPhysician(user)) {
    const e = new Error('Только для Главного врача');
    e.code = 'NOT_HEAD';
    throw e;
  }
}

function requireDoctor(user) {
  if (!isDoctor(user)) {
    const e = new Error('Только для врачей');
    e.code = 'NOT_DOCTOR';
    throw e;
  }
}

module.exports = {
  isHeadPhysician,
  isDoctor,
  isRegistrar,
  isStaff,
  canSeeMedicalData,
  canManageTickets,
  requireStaff,
  requireHead,
  requireDoctor,
};
