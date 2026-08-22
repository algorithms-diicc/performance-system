export const ANALYSIS_REQUIREMENT_KEYS = Object.freeze({
  ZIP_REQUIRED: "zipRequired",
  ZIP_INSPECTING: "zipInspecting",
  ZIP_INVALID: "zipInvalid",
  BENCHMARK_REQUIRED: "benchmarkRequired",
  INPUT_SIZE_INVALID: "inputSizeInvalid",
  SAMPLES_INVALID: "samplesInvalid",
  DATA_TYPE_REQUIRED: "dataTypeRequired",
  COURSE_LOADING: "courseLoading",
  COURSE_UNAVAILABLE: "courseUnavailable",
  COURSE_REQUIRED: "courseRequired",
});

function isValidNumber(value, limits) {
  const numeric = Number(value);

  if (
    value === "" ||
    value === null ||
    value === undefined ||
    !Number.isFinite(numeric)
  ) {
    return false;
  }

  if (!limits) return true;

  return numeric >= limits.min && numeric <= limits.max;
}

/**
 * Única fuente de verdad para habilitar la revisión y explicar qué falta.
 * Devuelve claves semánticas; la capa de UI se encarga de localizarlas.
 */
export function buildAnalysisRequirements({
  file,
  fileError,
  fileMeta,
  isInspectingZip,
  selectedTaskType,
  inputSize,
  samples,
  paramLimits,
  executionProfile,
  dataType,
  courseContextLoading,
  courseContextError,
  courseSelectionRequired,
  selectedCourseId,
} = {}) {
  const requirements = [];

  if (fileError) {
    requirements.push(ANALYSIS_REQUIREMENT_KEYS.ZIP_INVALID);
  } else if (!file) {
    requirements.push(ANALYSIS_REQUIREMENT_KEYS.ZIP_REQUIRED);
  } else if (isInspectingZip) {
    requirements.push(ANALYSIS_REQUIREMENT_KEYS.ZIP_INSPECTING);
  } else if (!fileMeta || Number(fileMeta.sourceCount) < 1) {
    requirements.push(ANALYSIS_REQUIREMENT_KEYS.ZIP_INVALID);
  }

  if (!selectedTaskType) {
    requirements.push(ANALYSIS_REQUIREMENT_KEYS.BENCHMARK_REQUIRED);
  } else {
    const limits = paramLimits?.[selectedTaskType] || {};

    if (!isValidNumber(inputSize, limits.inputSize)) {
      requirements.push(ANALYSIS_REQUIREMENT_KEYS.INPUT_SIZE_INVALID);
    }

    if (
      executionProfile === "personalizado" &&
      !isValidNumber(samples, limits.samples)
    ) {
      requirements.push(ANALYSIS_REQUIREMENT_KEYS.SAMPLES_INVALID);
    }

    if (selectedTaskType === "camm" && !dataType) {
      requirements.push(ANALYSIS_REQUIREMENT_KEYS.DATA_TYPE_REQUIRED);
    }
  }

  if (courseContextLoading) {
    requirements.push(ANALYSIS_REQUIREMENT_KEYS.COURSE_LOADING);
  } else if (courseContextError) {
    requirements.push(ANALYSIS_REQUIREMENT_KEYS.COURSE_UNAVAILABLE);
  } else if (courseSelectionRequired && !selectedCourseId) {
    requirements.push(ANALYSIS_REQUIREMENT_KEYS.COURSE_REQUIRED);
  }

  return requirements;
}
