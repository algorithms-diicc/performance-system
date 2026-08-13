import { requestJson } from "../common/requestErrorModel";

const dateTimeFormatter =
  new Intl.DateTimeFormat(
    "es-CL",
    {
      dateStyle: "medium",
      timeStyle: "short",
    }
  );

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
        "No fue posible cargar la información solicitada.",
    }
  );
}

export function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "—";
  }

  return dateTimeFormatter
    .format(parsed);
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
