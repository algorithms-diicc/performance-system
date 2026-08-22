const normalizeWhitespace = (value) =>
  String(value || "")
    .replace(/[\s\u00a0\u202f]+/gu, " ")
    .trim();

export const formatDateTime = (
  value,
  locale,
  fallback = ""
) => {
  if (!value) return fallback;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return normalizeWhitespace(
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  );
};

export const formatDuration = (
  milliseconds,
  locale,
  fallback = ""
) => {
  if (
    milliseconds === null ||
    milliseconds === undefined ||
    milliseconds === ""
  ) {
    return fallback;
  }

  const value = Number(milliseconds);

  if (!Number.isFinite(value) || value < 0) {
    return fallback;
  }

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  });

  const seconds = value / 1000;
  if (seconds < 60) {
    return `${number.format(seconds)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes} min ${remainingSeconds} s`;
};

export const formatAcademicPeriod = (
  course,
  {
    semesterLabel = "Semester",
    fallback = "",
  } = {}
) => {
  const year = String(course?.academicYear ?? "").trim();
  const term = String(course?.academicTerm ?? "").trim();

  if (!year && !term) return fallback;
  if (year && term) {
    return `${year} · ${semesterLabel} ${term}`;
  }
  if (year) return year;
  return `${semesterLabel} ${term}`;
};
