import {
  requestJson,
  requestStatus,
} from "../common/requestErrorModel";

import {
  formatDateTime as formatLocalizedDateTime,
} from "../i18n/formatters";


const LEGACY_FALLBACK =
  "No fue posible cargar la información solicitada.";


export async function teacherApi(
  url,
  options = {}
) {
  return requestJson(
    url,
    {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    },
    {
      fallback:
        LEGACY_FALLBACK,
    }
  );
}


export function teacherRequestErrorMessage(
  error,
  t = null,
  {
    fallbackKey =
      "teacherCommon.errors.generic",
    codeKeys = {},
    statusKeys = {},
  } = {}
) {
  if (error?.name === "AbortError") {
    return "";
  }

  /*
   * Compatibilidad temporal:
   * las pantallas Teacher aún no migradas siguen
   * recibiendo el mensaje legacy en español.
   */
  if (typeof t !== "function") {
    return (
      error?.message ||
      LEGACY_FALLBACK
    );
  }

  const code =
    String(error?.code || "")
      .trim()
      .toUpperCase();

  if (
    code &&
    Object.prototype.hasOwnProperty.call(
      codeKeys,
      code
    )
  ) {
    return t(codeKeys[code]);
  }

  const status =
    requestStatus(error);

  if (
    status !== null &&
    Object.prototype.hasOwnProperty.call(
      statusKeys,
      status
    )
  ) {
    return t(statusKeys[status]);
  }

  if (
    code === "NETWORK_ERROR" ||
    status === null
  ) {
    return t(
      "teacherCommon.errors.network"
    );
  }

  if (status === 401) {
    return t(
      "teacherCommon.errors.session"
    );
  }

  if (status === 403) {
    return t(
      "teacherCommon.errors.forbidden"
    );
  }

  if (status === 404) {
    return t(
      "teacherCommon.errors.notFound"
    );
  }

  if (status >= 500) {
    return t(
      "teacherCommon.errors.service"
    );
  }

  /*
   * 400 / 409 / 422 pueden contener mensajes
   * de negocio generados por backend. Si la
   * pantalla no entregó un codeKeys/statusKeys
   * estable, no se muestra texto backend crudo
   * en otro idioma.
   */
  return t(fallbackKey);
}


export function formatDateTime(
  value,
  locale = "es-CL",
  fallback = "—"
) {
  return formatLocalizedDateTime(
    value,
    locale,
    fallback
  );
}


export function coursePeriod(course) {
  if (!course) {
    return "—";
  }

  return `${course.academicYear}-${course.academicTerm}`;
}


export function pluralize(
  count,
  singular,
  plural
) {
  return `${count} ${
    count === 1
      ? singular
      : plural
  }`;
}
