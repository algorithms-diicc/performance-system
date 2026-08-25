const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeAccessRequestEmail = (value) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

export const canApplicantRequestAccess = (value) => {
  const normalized =
    normalizeAccessRequestEmail(value);

  if (!EMAIL_PATTERN.test(normalized)) {
    return false;
  }

  const domain = normalized
    .split("@")
    .pop();

  return domain === "udec.cl";
};

export const isUdecProfessorEmail = (value) => {
  const normalized =
    normalizeAccessRequestEmail(value);

  if (!EMAIL_PATTERN.test(normalized)) {
    return false;
  }

  const domain = normalized
    .split("@")
    .pop();

  if (domain.split(".").some((label) => !label)) {
    return false;
  }

  return (
    domain === "udec.cl"
    || domain.endsWith(".udec.cl")
  );
};
