export const SUBMISSION_AGGREGATE_LABELS = {
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completado",
  PARTIAL: "Parcial",
  FAILED: "Error",
  EMPTY: "Sin ejecuciones",
};

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
