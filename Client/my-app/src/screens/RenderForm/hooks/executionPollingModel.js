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

export function normalizeExecutionSnapshot(snapshot = {}, fallback = {}) {
  const state = String(snapshot.state || "").toUpperCase();
  const terminal =
    typeof snapshot.terminal === "boolean"
      ? snapshot.terminal
      : TERMINAL_STATES.has(state);

  const resultsReady =
    state === "COMPLETED" && snapshot.resultAvailable === true;

  const hasError =
    state === "FAILED" || state === "CANCELLED";

  const errorMessage =
    snapshot.failure?.message || "";

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
    events: buildEventsFromSnapshot(snapshot),
    resultsReady,
    hasError,
    errorMessage,
    resultAvailable: snapshot.resultAvailable === true,
    resultsUrl: snapshot.resultsUrl || null,
    failure: snapshot.failure || null,
    queuedAt: snapshot.queuedAt || null,
    queueAhead: normalizeQueueAhead(snapshot.queueAhead, state),
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
      firstErrorMessage: "",
    };
  }

  return {
    allDone: items.every((item) => item.resultsReady === true),
    allTerminal: items.every((item) => item.terminal === true),
    hasError: items.some((item) => item.hasError === true),
    firstErrorMessage:
      items.find(
        (item) => item.hasError === true && item.errorMessage
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
