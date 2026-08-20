export const EXECUTION_STATES = [
  "QUEUED",
  "RUNNING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export const EXECUTION_STATE_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "QUEUED", label: "En cola" },
  { value: "RUNNING", label: "En ejecución" },
  { value: "PROCESSING", label: "Procesando" },
  { value: "COMPLETED", label: "Completado" },
  { value: "FAILED", label: "Error" },
  { value: "CANCELLED", label: "Cancelada" },
];

const STATE_LABELS = {
  QUEUED: "En cola",
  RUNNING: "En ejecución",
  PROCESSING: "Procesando",
  COMPLETED: "Completado",
  FAILED: "Error",
  CANCELLED: "Cancelada",
};

export function executionStateLabel(state, fallback = "Desconocido") {
  if (!state) return fallback;
  const normalized = String(state).toUpperCase();
  return STATE_LABELS[normalized] || normalized;
}

const EXECUTION_STATE_I18N_KEYS = {
  QUEUED:
    "adminCommon.executionStates.queued",
  RUNNING:
    "adminCommon.executionStates.running",
  PROCESSING:
    "adminCommon.executionStates.processing",
  COMPLETED:
    "adminCommon.executionStates.completed",
  FAILED:
    "adminCommon.executionStates.failed",
  CANCELLED:
    "adminCommon.executionStates.cancelled",
};

const ADMIN_ROLE_I18N_KEYS = {
  Student:
    "adminCommon.roles.Student",
  Teacher:
    "adminCommon.roles.Teacher",
  Admin:
    "adminCommon.roles.Admin",
};


export function localizedExecutionStateLabel(
  state,
  t = null,
  fallback = "Desconocido"
) {
  if (!state) {
    return typeof t === "function"
      ? t(
          "adminCommon.executionStates.unknown"
        )
      : fallback;
  }

  const normalized =
    String(state).toUpperCase();

  const key =
    EXECUTION_STATE_I18N_KEYS[
      normalized
    ];

  if (
    key &&
    typeof t === "function"
  ) {
    return t(key);
  }

  return executionStateLabel(
    normalized,
    fallback
  );
}


export function localizedExecutionStateOptions(
  t = null
) {
  return EXECUTION_STATE_OPTIONS.map(
    (option) => ({
      value: option.value,
      label:
        option.value === "all"
          ? (
              typeof t === "function"
                ? t(
                    "adminCommon.executionStates.all"
                  )
                : option.label
            )
          : localizedExecutionStateLabel(
              option.value,
              t,
              option.label
            ),
    })
  );
}


export function adminRoleLabel(
  role,
  t = null
) {
  const normalized =
    String(role || "").trim();

  const legacy = {
    Student: "Estudiante",
    Teacher: "Docente",
    Admin: "Administrador",
  };

  const key =
    ADMIN_ROLE_I18N_KEYS[
      normalized
    ];

  if (
    key &&
    typeof t === "function"
  ) {
    return t(key);
  }

  if (legacy[normalized]) {
    return legacy[normalized];
  }

  if (
    typeof t === "function"
  ) {
    return t(
      "adminCommon.roles.unknown"
    );
  }

  return normalized || "Sin rol";
}


export function adminAccountStatusLabel(
  isActive,
  t = null
) {
  if (
    typeof isActive
    !== "boolean"
  ) {
    return typeof t === "function"
      ? t(
          "adminCommon.accountStatus.unknown"
        )
      : "Desconocido";
  }

  const key =
    isActive
      ? "adminCommon.accountStatus.active"
      : "adminCommon.accountStatus.inactive";

  if (
    typeof t === "function"
  ) {
    return t(key);
  }

  return isActive
    ? "Activo"
    : "Inactivo";
}


export function adminAccountStatusBadgeClass(
  isActive
) {
  if (
    typeof isActive
    !== "boolean"
  ) {
    return "";
  }

  return isActive
    ? "app-status-badge--success"
    : "app-status-badge--warning";
}


export function localizedAdminUserLastExecutionLabel(
  user = {},
  t = null
) {
  if (
    user.lastExecutionState
  ) {
    return localizedExecutionStateLabel(
      user.lastExecutionState,
      t
    );
  }

  if (
    typeof t === "function"
  ) {
    return t(
      "adminCommon.executionStates.none"
    );
  }

  return (
    user.lastExecutionStatus
    || "Sin ejecuciones"
  );
}


export function executionStateBadgeClass(state) {
  const normalized = String(state || "").toUpperCase();

  if (normalized === "COMPLETED") {
    return "app-status-badge--success";
  }

  if (normalized === "FAILED" || normalized === "CANCELLED") {
    return "app-status-badge--error";
  }

  if (
    normalized === "QUEUED" ||
    normalized === "RUNNING" ||
    normalized === "PROCESSING"
  ) {
    return "app-status-badge--warning";
  }

  return "";
}

export function normalizeAdminExecution(raw = {}) {
  const state = String(raw.state || raw.rawStatus || "").toUpperCase();

  return {
    executionId: raw.executionId,
    publicId: raw.publicId || null,
    codename: raw.codename || null,
    submissionId: raw.submissionId,
    submissionTitle: raw.submissionTitle || null,
    state,
    stateLabel:
      raw.stateLabel ||
      executionStateLabel(state, raw.status || "Desconocido"),
    failure: raw.failure || null,
    resultAvailable: Boolean(raw.resultAvailable),
    startedAt: raw.startedAt || null,
    processingAt: raw.processingAt || null,
    finishedAt: raw.finishedAt || null,
    durationMs:
      raw.durationMs === null || raw.durationMs === undefined
        ? null
        : raw.durationMs,
    hardwareProfile: raw.hardwareProfile || null,
  };
}

export function normalizeAdminSummary(raw = {}) {
  const completedExecutions =
    raw.completedExecutions ?? raw.okExecutions ?? 0;

  const failedExecutions =
    raw.failedExecutions ??
    ((raw.timeoutExecutions || 0) + (raw.errorExecutions || 0));

  const queuedExecutions = raw.queuedExecutions || 0;
  const runningExecutions = raw.runningExecutions || 0;
  const processingExecutions = raw.processingExecutions || 0;
  const cancelledExecutions = raw.cancelledExecutions || 0;

  return {
    totalSubmissions: raw.submissionsCount || 0,
    totalExecutions: raw.executionsCount || 0,
    completedExecutions,
    failedExecutions,
    queuedExecutions,
    runningExecutions,
    processingExecutions,
    cancelledExecutions,
    activeExecutions:
      queuedExecutions + runningExecutions + processingExecutions,
    lastExecutionState: raw.lastExecutionState || null,
    lastExecutionStatus:
      raw.lastExecutionStatus ||
      executionStateLabel(raw.lastExecutionState, "Sin ejecuciones"),
    lastExecutionPublicId: raw.lastExecutionPublicId || null,
    lastExecutionCodename: raw.lastExecutionCodename || null,
  };
}

export function executionStatsFromSummary(summary) {
  if (!summary) {
    return {
      total: 0,
      completed: 0,
      failed: 0,
      active: 0,
      cancelled: 0,
    };
  }

  return {
    total: summary.totalExecutions || 0,
    completed: summary.completedExecutions || 0,
    failed: summary.failedExecutions || 0,
    active:
      summary.activeExecutions ??
      ((summary.queuedExecutions || 0) +
        (summary.runningExecutions || 0) +
        (summary.processingExecutions || 0)),
    cancelled: summary.cancelledExecutions || 0,
  };
}

export function filterAdminExecutions(
  executions,
  statusFilter,
  problemFilter
) {
  let data = Array.isArray(executions) ? [...executions] : [];

  if (statusFilter && statusFilter !== "all") {
    data = data.filter(
      (execution) => execution.state === statusFilter
    );
  }

  const query = String(problemFilter || "").trim().toLowerCase();
  if (query) {
    data = data.filter((execution) =>
      String(execution.problem || "")
        .toLowerCase()
        .includes(query)
    );
  }

  return data;
}

export function adminUserCompletedCount(user = {}) {
  return user.completedExecutions ?? user.passedCount ?? 0;
}

export function adminUserFailedCount(user = {}) {
  return user.failedExecutions ?? user.failedCount ?? 0;
}

export function adminUserLastExecutionLabel(user = {}) {
  if (user.lastExecutionState) {
    return executionStateLabel(user.lastExecutionState);
  }
  return user.lastExecutionStatus || "Sin ejecuciones";
}
