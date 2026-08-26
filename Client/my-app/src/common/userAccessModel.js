/*
 * CORE-07F-4
 * Autorización visual del frontend.
 *
 * Esto NO reemplaza la autorización backend.
 *
 * Los IDs se mantienen únicamente como compatibilidad con sesiones
 * antiguas que todavía no incluyan role_name. La autorización real
 * del backend ya trabaja por nombre de rol.
 */

export const LEGACY_ROLE_IDS = Object.freeze({
  ADMIN: 2,
  TEACHER: 3,
});

// Compatibilidad con consumidores/tests anteriores.
// La autorización real no debe depender exclusivamente de estos IDs.
export const ADMIN_ROLE_ID = LEGACY_ROLE_IDS.ADMIN;
export const TEACHER_ROLE_ID = LEGACY_ROLE_IDS.TEACHER;

const normalizeRoleName = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const getRoleId = (user) => {
  if (!user || typeof user !== "object") {
    return null;
  }

  const raw =
    user.role_id ??
    user.roleId ??
    user.role?.id ??
    null;

  if (
    raw === null ||
    raw === undefined ||
    raw === ""
  ) {
    return null;
  }

  const numeric = Number(raw);

  return Number.isFinite(numeric)
    ? numeric
    : null;
};

export const getRoleName = (user) => {
  if (!user || typeof user !== "object") {
    return "";
  }

  return normalizeRoleName(
    user.role_name ??
    user.roleName ??
    (
      typeof user.role === "string"
        ? user.role
        : user.role?.name
    ) ??
    ""
  );
};

export const isAdminUser = (user) => {
  const roleName = getRoleName(user);

  if (
    roleName === "admin" ||
    roleName === "administrator" ||
    roleName === "administrador"
  ) {
    return true;
  }

  return (
    !roleName &&
    getRoleId(user) === LEGACY_ROLE_IDS.ADMIN
  );
};

export const isTeacherUser = (user) => {
  const roleName = getRoleName(user);

  if (
    roleName === "teacher" ||
    roleName === "professor" ||
    roleName === "profesor" ||
    roleName === "docente"
  ) {
    return true;
  }

  return (
    !roleName &&
    getRoleId(user) === LEGACY_ROLE_IDS.TEACHER
  );
};

export const canAccessTeacherArea = (user) =>
  isAdminUser(user) ||
  isTeacherUser(user);

export const isStudentUser = (user) => {
  if (!user || typeof user !== "object") {
    return false;
  }

  const roleName = getRoleName(user);

  if (
    roleName === "student" ||
    roleName === "estudiante"
  ) {
    return true;
  }

  return (
    !roleName &&
    !isAdminUser(user) &&
    !isTeacherUser(user)
  );
};

export const roleLabel = (user) => {
  if (isAdminUser(user)) {
    return "Administrador";
  }

  if (isTeacherUser(user)) {
    return "Profesor";
  }

  return "Estudiante";
};
