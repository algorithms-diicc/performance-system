export const MAX_SUBMISSION_TITLE_CHARS = 255;
export const MAX_SUBMISSION_NOTE_CHARS = 500;

export const TITLE_ORIGIN = Object.freeze({
  AUTO_SUGGESTED: "AUTO_SUGGESTED",
  MANUAL: "MANUAL",
});

const limitText = (value, maxLength) =>
  String(value ?? "").slice(0, maxLength);

/**
 * Deriva una sugerencia estable desde el nombre visible del ZIP.
 *
 * Archivo y título siguen siendo conceptos separados: esta función solo
 * propone el basename sin la extensión final .zip y nunca inventa texto
 * cuando el stem está vacío.
 */
export function suggestTitleFromArchiveFilename(filename) {
  const trimmedFilename = String(filename ?? "").trim();
  if (!trimmedFilename) return "";

  const basename = trimmedFilename.split(/[\\/]/u).pop() || "";
  const stem = basename.replace(/\.zip$/iu, "").trim();

  return limitText(stem, MAX_SUBMISSION_TITLE_CHARS);
}

export function manualSubmissionTitle(value = "") {
  return {
    value: limitText(value, MAX_SUBMISSION_TITLE_CHARS),
    origin: TITLE_ORIGIN.MANUAL,
  };
}

/**
 * Aplica la transición causada por seleccionar o reemplazar un ZIP.
 *
 * El origen se conserva explícitamente; no se infiere comparando strings.
 */
export function applyArchiveTitleSuggestion(currentState, filename) {
  const current = {
    value: limitText(
      currentState?.value,
      MAX_SUBMISSION_TITLE_CHARS
    ),
    origin:
      currentState?.origin === TITLE_ORIGIN.AUTO_SUGGESTED
        ? TITLE_ORIGIN.AUTO_SUGGESTED
        : TITLE_ORIGIN.MANUAL,
  };
  const suggestion = suggestTitleFromArchiveFilename(filename);

  if (current.origin === TITLE_ORIGIN.AUTO_SUGGESTED) {
    return {
      value: suggestion,
      origin: TITLE_ORIGIN.AUTO_SUGGESTED,
    };
  }

  if (!current.value.trim() && suggestion) {
    return {
      value: suggestion,
      origin: TITLE_ORIGIN.AUTO_SUGGESTED,
    };
  }

  return current;
}

/**
 * Resuelve el valor defensivo enviado al backend sin usar file.name completo.
 */
export function resolveSubmissionTitle({
  testName,
  archiveFilename,
  fallbackTitle,
}) {
  const explicitTitle = limitText(
    String(testName ?? "").trim(),
    MAX_SUBMISSION_TITLE_CHARS
  );
  if (explicitTitle) return explicitTitle;

  const suggestedTitle = suggestTitleFromArchiveFilename(archiveFilename);
  if (suggestedTitle) return suggestedTitle;

  return limitText(
    String(fallbackTitle ?? "").trim(),
    MAX_SUBMISSION_TITLE_CHARS
  );
}

export function normalizeDraftNote(value) {
  if (typeof value !== "string") return "";
  return limitText(value, MAX_SUBMISSION_NOTE_CHARS);
}

const STARTER_CONFIGURATIONS = Object.freeze({
  size: { selectedTaskType: "size", inputSize: 2500, executionProfile: "rapido", samples: 10, dataType: "" },
  lcs: { selectedTaskType: "lcs", inputSize: 1000, executionProfile: "rapido", samples: 10, dataType: "" },
  camm: { selectedTaskType: "camm", inputSize: 5000, executionProfile: "rapido", samples: 10, dataType: "cammr" },
});

export function parseStarterConfiguration(search = "") {
  const value = new URLSearchParams(search).get("starter");
  return STARTER_CONFIGURATIONS[String(value || "").toLowerCase()] || null;
}

/**
 * Evita tratar como restaurable el objeto default que genera el autosave.
 */
export function hasMeaningfulDraft(draft) {
  if (!draft || typeof draft !== "object") return false;

  if (String(draft.testName || "").trim()) return true;
  if (String(draft.note || "").trim()) return true;
  if (String(draft.selectedTaskType || "").trim()) return true;
  if (String(draft.dataType || "").trim()) return true;

  const profile = String(
    draft.executionProfile || "equilibrado"
  ).trim();

  if (profile && profile !== "equilibrado") return true;

  const inputSize = Number(draft.inputSize);
  if (Number.isFinite(inputSize) && inputSize !== 1000) return true;

  const samples = Number(draft.samples);
  return Number.isFinite(samples) && samples !== 30;
}
