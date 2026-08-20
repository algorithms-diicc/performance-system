const BUSINESS_MESSAGE_STATUSES = new Set([400, 409, 422]);

const DEFAULT_STATUS_MESSAGES = {
  401: "Tu sesión expiró. Vuelve a iniciar sesión para continuar.",
  403: "Tu cuenta no tiene permisos para realizar esta acción.",
  404: "El recurso solicitado no está disponible.",
};

const DEFAULT_FALLBACK =
  "No fue posible completar la solicitud. Inténtalo nuevamente.";

export function requestStatus(error) {
  const value = error?.status ?? error?.response?.status;
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function responseMessage(error) {
  return (
    error?.payload?.error?.message ||
    error?.payload?.message ||
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    ""
  );
}

export function friendlyRequestError(
  error,
  fallback = DEFAULT_FALLBACK,
  statusMessages = {}
) {
  if (error?.name === "AbortError") {
    return "";
  }

  const status = requestStatus(error);
  const messages = {
    ...DEFAULT_STATUS_MESSAGES,
    ...statusMessages,
  };

  if (status === null) {
    return (
      "No pudimos conectar con el servidor. " +
      "Comprueba que el backend esté disponible e inténtalo nuevamente."
    );
  }

  if (messages[status]) {
    return messages[status];
  }

  if (status >= 500) {
    return (
      "El servicio no está disponible temporalmente. " +
      "Inténtalo nuevamente en unos momentos."
    );
  }

  if (BUSINESS_MESSAGE_STATUSES.has(status)) {
    const message = responseMessage(error);
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

export function localizedRequestError(
  error,
  t,
  {
    language = "es",
    fallbackKey =
      "commonErrors.generic",
    codeKeys = {},
    statusKeys = {},
  } = {}
) {
  if (
    error?.name
    === "AbortError"
  ) {
    return "";
  }

  if (
    typeof t
    !== "function"
  ) {
    return friendlyRequestError(
      error
    );
  }

  const code =
    String(
      error?.code
      || error?.payload?.error?.code
      || ""
    )
      .trim()
      .toUpperCase();

  if (
    code
    && Object.prototype
      .hasOwnProperty.call(
        codeKeys,
        code
      )
  ) {
    return t(
      codeKeys[code]
    );
  }

  const status =
    requestStatus(error);

  if (
    status !== null
    && Object.prototype
      .hasOwnProperty.call(
        statusKeys,
        status
      )
  ) {
    return t(
      statusKeys[status]
    );
  }

  if (
    code === "NETWORK_ERROR"
    || status === null
  ) {
    return t(
      "commonErrors.network"
    );
  }

  if (status === 401) {
    return t(
      "commonErrors.session"
    );
  }

  if (status === 403) {
    return t(
      "commonErrors.forbidden"
    );
  }

  if (status === 404) {
    return t(
      "commonErrors.notFound"
    );
  }

  if (status >= 500) {
    return t(
      "commonErrors.service"
    );
  }

  if (
    BUSINESS_MESSAGE_STATUSES
      .has(status)
    && String(language)
      .toLowerCase()
      .startsWith("es")
  ) {
    const message =
      responseMessage(error);

    if (
      typeof message
        === "string"
      && message.trim()
    ) {
      return message.trim();
    }
  }

  return t(
    fallbackKey
  );
}


export async function requestJson(
  url,
  options = {},
  {
    fallback = DEFAULT_FALLBACK,
    statusMessages = {},
  } = {}
) {
  let response;

  try {
    response = await fetch(url, options);
  } catch (cause) {
    if (cause?.name === "AbortError") {
      throw cause;
    }

    const error = new Error(
      friendlyRequestError(cause, fallback, statusMessages)
    );
    error.code = "NETWORK_ERROR";
    error.cause = cause;
    throw error;
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch (_) {
    // Una respuesta HTML o vacía nunca se presenta directamente al usuario.
  }

  if (!response.ok) {
    const error = new Error(fallback);
    error.status = response.status;
    error.payload = payload;
    error.code = payload?.error?.code;
    error.message = friendlyRequestError(
      error,
      fallback,
      statusMessages
    );
    throw error;
  }

  return payload;
}
