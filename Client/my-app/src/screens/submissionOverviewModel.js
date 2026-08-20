export const SUBMISSION_AGGREGATE_LABELS = {
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completado",
  PARTIAL: "Parcial",
  FAILED: "Error",
  EMPTY: "Sin ejecuciones",
};

const FALLBACK_VALUE = "No disponible";

const toCount = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0
    ? number
    : 0;
};

export function resolveResultsDestination(
  fileList = [],
  submissionId = null
) {
  const codenames = Array.isArray(fileList)
    ? fileList
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    : [];

  if (codenames.length === 0) {
    return {
      kind: "none",
      path: null,
      codename: null,
      error: null,
    };
  }

  if (codenames.length === 1) {
    return {
      kind: "execution",
      path: `/code/${encodeURIComponent(codenames[0])}`,
      codename: codenames[0],
      error: null,
    };
  }

  const normalizedSubmissionId = String(
    submissionId ?? ""
  ).trim();

  if (!normalizedSubmissionId) {
    return {
      kind: "error",
      path: null,
      codename: null,
      error:
        "Las ejecuciones terminaron, pero no fue posible identificar el experimento completo. Reintenta la recuperación desde el historial.",
    };
  }

  return {
    kind: "submission",
    path:
      `/submissions/${encodeURIComponent(normalizedSubmissionId)}`,
    codename: null,
    error: null,
  };
}

export function deriveSubmissionAggregateState(
  summary = {}
) {
  const total = toCount(summary.executionsCount);
  const completed = toCount(summary.completedExecutions);
  const failed = toCount(summary.failedExecutions);
  const cancelled = toCount(summary.cancelledExecutions);
  const queued = toCount(summary.queuedExecutions);
  const running = toCount(summary.runningExecutions);
  const processing = toCount(summary.processingExecutions);

  const active = queued + running + processing;
  const unsuccessfulTerminal = failed + cancelled;

  if (total === 0) {
    return "EMPTY";
  }

  if (active > 0) {
    return "IN_PROGRESS";
  }

  if (completed > 0 && unsuccessfulTerminal === 0) {
    return "COMPLETED";
  }

  if (completed > 0 && unsuccessfulTerminal > 0) {
    return "PARTIAL";
  }

  if (completed === 0 && unsuccessfulTerminal > 0) {
    return "FAILED";
  }

  return "EMPTY";
}

export function sortSubmissionExecutions(items = []) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftId = Number(left.item?.executionId);
      const rightId = Number(right.item?.executionId);

      if (
        Number.isFinite(leftId) &&
        Number.isFinite(rightId) &&
        leftId !== rightId
      ) {
        return leftId - rightId;
      }

      return left.index - right.index;
    })
    .map(({ item }) => item);
}

export function canOpenExecutionResult(execution) {
  return Boolean(
    execution &&
      execution.state === "COMPLETED" &&
      execution.resultAvailable === true &&
      execution.codename
  );
}

export function executionDisplayName(
  execution = {},
  fallback = "Archivo sin nombre"
) {
  return (
    String(
      execution.originalFilename || ""
    ).trim() ||
    String(execution.codename || "").trim() ||
    fallback
  );
}

export function formatExecutionDuration(
  milliseconds,
  locale = "es-CL",
  fallback = "Sin datos"
) {
  if (
    milliseconds === null ||
    milliseconds === undefined
  ) {
    return fallback;
  }

  const value = Number(milliseconds);

  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  const decimalFormatter = new Intl.NumberFormat(
    locale,
    {
      maximumFractionDigits: 2,
    }
  );

  const seconds = value / 1000;

  if (seconds < 60) {
    return `${decimalFormatter.format(seconds)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds =
    seconds - minutes * 60;

  if (remainingSeconds < 0.005) {
    return `${minutes} min`;
  }

  return `${minutes} min ${decimalFormatter.format(
    remainingSeconds
  )} s`;
}

export function formatSubmissionDateTime(
  value,
  locale = "es-CL",
  fallback = FALLBACK_VALUE
) {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const formatted = new Intl.DateTimeFormat(
    locale,
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  ).format(date);

  return formatted
    .replace(/[\s\u00a0\u202f]+/gu, " ")
    .trim();
}

export function formatCourseLabel(
  course,
  fallback = "Sin curso asociado"
) {
  if (!course || typeof course !== "object") {
    return fallback;
  }

  const code = String(course.code || "").trim();
  const name = String(course.name || "").trim();

  return (
    [code, name].filter(Boolean).join(" · ") ||
    fallback
  );
}

export function formatAcademicPeriod(
  course,
  {
    periodLabel = "Período",
  } = {}
) {
  if (!course || typeof course !== "object") {
    return null;
  }

  const year = String(
    course.academicYear || ""
  ).trim();
  const term = String(
    course.academicTerm || ""
  ).trim();

  if (!year && !term) return null;
  if (year && term) {
    return `${periodLabel} ${year}-${term}`;
  }

  return `${periodLabel} ${year || term}`;
}

export function abbreviateArchiveSha256(
  value,
  fallback = FALLBACK_VALUE
) {
  const normalized = String(value || "").trim();

  if (!normalized) return fallback;
  if (normalized.length <= 24) return normalized;

  return `${normalized.slice(
    0,
    12
  )}…${normalized.slice(-8)}`;
}

export function formatBenchmark(
  value,
  fallback = "No informado"
) {
  return String(value || "").trim() || fallback;
}
