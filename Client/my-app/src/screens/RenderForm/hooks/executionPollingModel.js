export const TERMINAL_STATES = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

function event(time, key, details = {}) {
  return { key, time: time || "", ...details };
}

export function buildEventsFromSnapshot(snapshot = {}) {
  const state = String(snapshot.state || "").toUpperCase();
  const events = [];

  if (snapshot.createdAt || snapshot.queuedAt || state) {
    events.push(
      event(snapshot.createdAt || snapshot.queuedAt, "accepted")
    );
  }

  if (snapshot.queuedAt || state === "QUEUED") {
    events.push(event(snapshot.queuedAt, "queued"));
  }

  if (snapshot.startedAt || state === "RUNNING") {
    events.push(event(snapshot.startedAt, "running"));
  }

  if (snapshot.processingAt || state === "PROCESSING") {
    events.push(event(snapshot.processingAt, "processing"));
  }

  if (state === "COMPLETED") {
    events.push(event(snapshot.finishedAt, "completed"));
  }

  if (state === "FAILED") {
    const failure = snapshot.failure || {};
    events.push(
      event(
        snapshot.finishedAt || snapshot.updatedAt,
        "failed",
        failure.message ? { message: failure.message } : {}
      )
    );
  }

  if (state === "CANCELLED") {
    events.push(
      event(snapshot.finishedAt || snapshot.updatedAt, "cancelled")
    );
  }

  return events;
}

export function normalizeQueueAhead(value, state) {
  if (String(state || "").toUpperCase() !== "QUEUED") {
    return null;
  }

  const numeric = Number(value);

  return Number.isInteger(numeric) && numeric >= 0
    ? numeric
    : null;
}

export function normalizeQueuePosition(value, queueAhead, state) {
  if (String(state || "").toUpperCase() !== "QUEUED") {
    return null;
  }

  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 1) {
    return numeric;
  }

  return Number.isInteger(queueAhead) && queueAhead >= 0
    ? queueAhead + 1
    : null;
}

export function normalizeExecutionSnapshot(snapshot = {}, fallback = {}) {
  const state = String(snapshot.state || "").toUpperCase();
  const terminal =
    typeof snapshot.terminal === "boolean"
      ? snapshot.terminal
      : TERMINAL_STATES.has(state);

  const resultsReady =
    state === "COMPLETED" && snapshot.resultAvailable === true;

  const hasFailure = state === "FAILED";
  const hasCancelled = state === "CANCELLED";

  const errorMessage =
    snapshot.failure?.message || "";

  const queueAhead = normalizeQueueAhead(
    snapshot.queueAhead,
    state
  );

  return {
    publicId: snapshot.publicId || fallback.publicId || "",
    codename: snapshot.codename || fallback.codename || "",
    originalName:
      snapshot.originalFilename ||
      fallback.originalFilename ||
      snapshot.codename ||
      fallback.codename ||
      "",
    status: state,
    state,
    stateVersion: snapshot.stateVersion ?? 0,
    terminal,
    taskType: snapshot.benchmark || "",
    inputSize: snapshot.inputSize,
    samples: snapshot.samples,
    measurementNode:
      snapshot.measurementNode &&
      typeof snapshot.measurementNode === "object"
        ? {
            nodeKey:
              snapshot.measurementNode.nodeKey || "",
            displayName:
              snapshot.measurementNode.displayName || "",
          }
        : null,
    hardwareProfile:
      snapshot.hardwareProfile || "",
    events: buildEventsFromSnapshot(snapshot),
    resultsReady,
    hasError: hasFailure,
    hasFailure,
    hasCancelled,
    errorMessage,
    resultAvailable: snapshot.resultAvailable === true,
    resultsUrl: snapshot.resultsUrl || null,
    failure: snapshot.failure || null,
    queuedAt: snapshot.queuedAt || null,
    queueAhead,
    queuePosition: normalizeQueuePosition(
      snapshot.queuePosition,
      queueAhead,
      state
    ),
    canCancel:
      state === "QUEUED" && snapshot.canCancel === true,
    startedAt: snapshot.startedAt || null,
    processingAt: snapshot.processingAt || null,
    finishedAt: snapshot.finishedAt || null,
  };
}

export function aggregatePollingState(items = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      allDone: false,
      allTerminal: false,
      hasError: false,
      hasFailure: false,
      hasCancelled: false,
      firstErrorMessage: "",
    };
  }

  const hasFailure = items.some(
    (item) => item.hasFailure === true || item.hasError === true
  );

  return {
    allDone: items.every((item) => item.resultsReady === true),
    allTerminal: items.every((item) => item.terminal === true),
    hasError: hasFailure,
    hasFailure,
    hasCancelled: items.some(
      (item) => item.hasCancelled === true
    ),
    firstErrorMessage:
      items.find(
        (item) =>
          (item.hasFailure === true || item.hasError === true) &&
          item.errorMessage
      )?.errorMessage || "",
  };
}

export function indexExecutionRecords(records = []) {
  const map = new Map();

  if (!Array.isArray(records)) {
    return map;
  }

  records.forEach((record) => {
    if (!record || !record.codename) return;

    map.set(record.codename, {
      publicId: record.publicId || "",
      codename: record.codename,
      originalFilename:
        record.originalFilename || record.codename,
    });
  });

  return map;
}
