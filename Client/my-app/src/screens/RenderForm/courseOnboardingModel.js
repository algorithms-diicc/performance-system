const COURSE_QUERY_KEY = "course";
const EXECUTION_QUERY_KEY = "execution";

const clean = (value) => String(value ?? "").trim();

const isPositiveIntegerText = (value) =>
  /^[1-9]\d*$/u.test(value);

/**
 * Resuelve la sugerencia académica transportada por la URL.
 *
 * null:
 *   no existe una sugerencia aplicable o hay recuperación de ejecución.
 * "":
 *   sí existe `course`, pero es ambiguo o inválido.
 * string:
 *   id sintácticamente válido solicitado por la URL.
 *
 * La presencia de `execution` siempre tiene precedencia. El query de curso
 * es solo una sugerencia de UX y nunca una autorización.
 */
export function requestedCourseIdFromSearch(search = "") {
  const params = new URLSearchParams(search);

  const hasExecutionRecovery = params
    .getAll(EXECUTION_QUERY_KEY)
    .some((value) => Boolean(clean(value)));

  if (hasExecutionRecovery) {
    return null;
  }

  const requestedValues = params.getAll(COURSE_QUERY_KEY);

  if (requestedValues.length === 0) {
    return null;
  }

  if (requestedValues.length !== 1) {
    return "";
  }

  const requested = clean(requestedValues[0]);

  return isPositiveIntegerText(requested)
    ? requested
    : "";
}

/**
 * Whitelist contra los cursos activos entregados por el backend.
 *
 * null mantiene la selección existente.
 * "" limpia una sugerencia inválida/no autorizada.
 * un id selecciona únicamente un curso presente en `courses`.
 */
export function resolveCourseQuerySelection(
  search = "",
  courses = []
) {
  const requested = requestedCourseIdFromSearch(search);

  if (requested === null || requested === "") {
    return requested;
  }

  const items = Array.isArray(courses) ? courses : [];
  const authorized = items.some(
    (course) => clean(course?.id) === requested
  );

  return authorized ? requested : "";
}
