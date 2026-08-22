import { normalizeExecutionProfile } from "../executionProfileModel";

const REUSE_QUERY_KEY = "reuse";

const BENCHMARK_REUSE_CONFIG = {
  LCS: { selectedTaskType: "lcs", dataType: "" },
  SIZE: { selectedTaskType: "size", dataType: "" },
  CAMM: { selectedTaskType: "camm", dataType: "" },
  CAMMR: { selectedTaskType: "camm", dataType: "cammr" },
  CAMMSO: { selectedTaskType: "camm", dataType: "cammso" },
  CAMMS: { selectedTaskType: "camm", dataType: "camms" },
};

export function parseReusePublicId(search = "") {
  const params = new URLSearchParams(search);

  return (
    params
      .getAll(REUSE_QUERY_KEY)
      .map((value) => String(value || "").trim())
      .find(Boolean) || null
  );
}

export function buildReuseSearch(publicId) {
  const normalized = String(publicId || "").trim();
  if (!normalized) return "";

  const params = new URLSearchParams();
  params.set(REUSE_QUERY_KEY, normalized);

  return `?${params.toString()}`;
}

export function buildReuseConfiguration(
  descriptor,
  activeCourses = []
) {
  if (!descriptor) return null;

  const benchmark = String(
    descriptor.benchmark || ""
  ).trim().toUpperCase();

  const benchmarkConfig =
    BENCHMARK_REUSE_CONFIG[benchmark];

  if (!benchmarkConfig) return null;

  const reusableCourseId =
    descriptor.courseId === null ||
    descriptor.courseId === undefined
      ? null
      : String(descriptor.courseId);

  const courseStillAvailable =
    reusableCourseId !== null &&
    Array.isArray(activeCourses) &&
    activeCourses.some(
      (course) =>
        String(course?.id) === reusableCourseId
    );

  return {
    sourcePublicId: descriptor.sourcePublicId || null,
    selectedTaskType:
      benchmarkConfig.selectedTaskType,
    dataType: benchmarkConfig.dataType,
    inputSize: descriptor.inputSize,
    samples: descriptor.samples,
    executionProfile: normalizeExecutionProfile(
      descriptor.executionProfile,
      descriptor.samples
    ),
    courseId: courseStillAvailable
      ? reusableCourseId
      : null,
  };
}
