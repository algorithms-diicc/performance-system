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
