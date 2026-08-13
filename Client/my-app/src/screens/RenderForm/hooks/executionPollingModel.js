export const TERMINAL_STATES = new Set([
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

function message(time, msg) {
  return { time: time || "", msg };
}

export function buildMessagesFromSnapshot(snapshot = {}) {
  const state = String(snapshot.state || "").toUpperCase();
  const messages = [];

  messages.push(
    message(
      snapshot.createdAt || snapshot.queuedAt,
      "📦 Archivo añadido a la cola de espera."
    )
  );

  if (
    snapshot.startedAt ||
    ["RUNNING", "PROCESSING", "COMPLETED", "FAILED"].includes(state)
  ) {
    messages.push(
      message(snapshot.startedAt, "📨 Archivo recibido correctamente.")
    );
    messages.push(
      message(
        snapshot.startedAt,
        "🚚 Enviando test al slave para ejecutar las mediciones."
      )
    );
  }

  if (
    snapshot.processingAt ||
    state === "PROCESSING" ||
    state === "COMPLETED"
  ) {
    messages.push(
      message(
        snapshot.processingAt,
        "✅ Test ejecutado correctamente. Resultados CSV recibidos."
      )
    );
    messages.push(
      message(snapshot.processingAt, "📊 Generando gráficos...")
    );
  }

  if (state === "COMPLETED" && snapshot.resultAvailable) {
    messages.push(
      message(snapshot.finishedAt, "✅ Resultados listos.")
    );
  }

  if (state === "FAILED") {
    const failure = snapshot.failure || {};
    messages.push(
      message(
        snapshot.finishedAt || snapshot.updatedAt,
        `❌ ${failure.message || "La ejecución terminó con un error."}`
      )
    );
  }

  if (state === "CANCELLED") {
    messages.push(
      message(
        snapshot.finishedAt || snapshot.updatedAt,
        "❌ La ejecución fue cancelada."
      )
    );
  }

  return messages;
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
    snapshot.failure?.message ||
    (state === "CANCELLED"
      ? "La ejecución fue cancelada."
      : "");

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
    messages: buildMessagesFromSnapshot(snapshot),
    resultsReady,
    hasError,
    errorMessage,
    resultAvailable: snapshot.resultAvailable === true,
    resultsUrl: snapshot.resultsUrl || null,
    failure: snapshot.failure || null,
    queuedAt: snapshot.queuedAt || null,
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
