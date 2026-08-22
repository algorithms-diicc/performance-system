export const MAX_TEACHER_EMAILS = 200;


export function normalizeTeacherEmails(
  value
) {
  const seen = new Set();

  return String(value || "")
    .trim()
    .split(/[\s,;]+/)
    .map(
      (email) =>
        email.trim().toLowerCase()
    )
    .filter(
      (email) => {
        if (
          !email
          || seen.has(email)
        ) {
          return false;
        }

        seen.add(email);
        return true;
      }
    );
}


export function teacherEmailPreview(
  value
) {
  const emails =
    normalizeTeacherEmails(value);

  return {
    emails,
    count: emails.length,
    overLimit:
      emails.length
      > MAX_TEACHER_EMAILS,
  };
}
