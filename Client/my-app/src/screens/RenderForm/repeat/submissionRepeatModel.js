import { buildReuseConfiguration } from "../reuse/executionReuseModel";

const REPEAT_QUERY_KEY = "repeat";

export function parseRepeatSubmissionId(search = "") {
  const params = new URLSearchParams(search);
  const value = params
    .getAll(REPEAT_QUERY_KEY)
    .map((item) => String(item || "").trim())
    .find((item) => /^[1-9]\d*$/.test(item));

  return value || null;
}

export function buildRepeatSearch(submissionId) {
  const normalized = String(submissionId || "").trim();
  if (!/^[1-9]\d*$/.test(normalized)) return "";

  const params = new URLSearchParams();
  params.set(REPEAT_QUERY_KEY, normalized);
  return `?${params.toString()}`;
}

export function buildRepeatConfiguration(
  descriptor,
  activeCourses = []
) {
  const common = buildReuseConfiguration(
    descriptor,
    activeCourses
  );
  const sourceSubmissionId = String(
    descriptor?.sourceSubmissionId || ""
  ).trim();
  const archiveFilename = String(
    descriptor?.archiveFilename || ""
  ).trim();
  const archiveUrl = String(
    descriptor?.archiveUrl || ""
  ).trim();

  if (
    !common ||
    !/^[1-9]\d*$/.test(sourceSubmissionId) ||
    !archiveFilename.toLowerCase().endsWith(".zip") ||
    !archiveUrl.startsWith("/api/submissions/")
  ) {
    return null;
  }

  return {
    ...common,
    sourceSubmissionId,
    archiveFilename,
    archiveUrl,
  };
}
