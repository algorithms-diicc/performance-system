const VALID_BENCHMARKS = new Set([
  "lcs",
  "camm",
  "size",
]);

const VALID_PROFILES = new Set([
  "rapido",
  "equilibrado",
  "exhaustivo",
  "personalizado",
]);

const VALID_CAMM_DATA_TYPES = new Set([
  "cammr",
  "cammso",
  "camms",
]);


export function parseProtocolId(search = "") {
  const raw =
    new URLSearchParams(search)
      .get("protocol");

  if (
    !raw ||
    !/^[1-9]\d*$/.test(raw)
  ) {
    return null;
  }

  const parsed = Number(raw);

  return Number.isSafeInteger(parsed)
    ? parsed
    : null;
}


export function buildProtocolConfiguration(
  protocol,
  activeCourses = []
) {
  if (
    !protocol ||
    typeof protocol !== "object"
  ) {
    return null;
  }

  const id = Number(protocol.id);
  const courseId =
    Number(protocol.courseId);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    !Number.isSafeInteger(courseId) ||
    courseId <= 0
  ) {
    return null;
  }

  const courseAvailable =
    activeCourses.some(
      (course) =>
        String(course?.id) ===
        String(courseId)
    );

  if (!courseAvailable) {
    return null;
  }

  const selectedTaskType =
    String(protocol.benchmark || "")
      .trim()
      .toLowerCase();

  if (
    !VALID_BENCHMARKS.has(
      selectedTaskType
    )
  ) {
    return null;
  }

  const inputSize =
    Number(protocol.inputSize);
  const samples =
    Number(protocol.samples);

  if (
    !Number.isFinite(inputSize) ||
    inputSize <= 0 ||
    !Number.isInteger(samples) ||
    samples < 1 ||
    samples > 100
  ) {
    return null;
  }

  const executionProfile =
    String(
      protocol.executionProfile || ""
    )
      .trim()
      .toLowerCase();

  if (
    !VALID_PROFILES.has(
      executionProfile
    )
  ) {
    return null;
  }

  let dataType = "";

  if (
    selectedTaskType === "camm"
  ) {
    dataType =
      String(protocol.dataType || "")
        .trim()
        .toLowerCase();

    if (
      !VALID_CAMM_DATA_TYPES.has(
        dataType
      )
    ) {
      return null;
    }
  }

  return {
    id,
    courseId,
    title:
      String(protocol.title || "")
        .trim(),
    objective:
      String(protocol.objective || "")
        .trim(),
    instructions:
      String(protocol.instructions || "")
        .trim(),
    selectedTaskType,
    inputSize,
    samples,
    executionProfile,
    dataType,
  };
}
