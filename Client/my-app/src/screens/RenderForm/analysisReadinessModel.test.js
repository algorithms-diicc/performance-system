import {
  ANALYSIS_REQUIREMENT_KEYS,
  buildAnalysisRequirements,
} from "./analysisReadinessModel";

const valid = {
  file: { name: "code.zip" },
  fileError: "",
  fileMeta: { sourceCount: 1, cCount: 0, cppCount: 1 },
  isInspectingZip: false,
  selectedTaskType: "lcs",
  inputSize: 500,
  samples: 30,
  paramLimits: {
    lcs: {
      inputSize: { min: 100, max: 50000 },
      samples: { min: 1, max: 100 },
    },
    camm: {
      inputSize: { min: 1000, max: 150000 },
      samples: { min: 1, max: 100 },
    },
  },
  executionProfile: "equilibrado",
  dataType: "",
  courseContextLoading: false,
  courseContextError: "",
  courseSelectionRequired: false,
  selectedCourseId: "",
  measurementNodeMode: "AUTO",
  measurementNodeKey: "",
  measurementPolicyLoading: false,
  measurementPolicyUnavailable: false,
  measurementUnavailable: false,
};

describe("analysisReadinessModel", () => {
  test("ready configuration has no missing requirements", () => {
    expect(buildAnalysisRequirements(valid)).toEqual([]);
  });

  test.each([
    { sourceCount: 1, cCount: 1, cppCount: 0 },
    { sourceCount: 1, cCount: 0, cppCount: 1 },
    { sourceCount: 2, cCount: 1, cppCount: 1 },
  ])("C-only, C++-only and mixed ZIP metadata are ready", (fileMeta) => {
    expect(
      buildAnalysisRequirements({ ...valid, fileMeta })
    ).toEqual([]);
  });

  test.each([
    [
      "missing ZIP",
      { file: null, fileMeta: null },
      ANALYSIS_REQUIREMENT_KEYS.ZIP_REQUIRED,
    ],
    [
      "ZIP inspection",
      { isInspectingZip: true, fileMeta: null },
      ANALYSIS_REQUIREMENT_KEYS.ZIP_INSPECTING,
    ],
    [
      "invalid ZIP",
      { fileError: "invalid", fileMeta: null },
      ANALYSIS_REQUIREMENT_KEYS.ZIP_INVALID,
    ],
    [
      "missing benchmark",
      { selectedTaskType: "" },
      ANALYSIS_REQUIREMENT_KEYS.BENCHMARK_REQUIRED,
    ],
    [
      "invalid input size",
      { inputSize: 99 },
      ANALYSIS_REQUIREMENT_KEYS.INPUT_SIZE_INVALID,
    ],
    [
      "invalid Custom samples",
      { executionProfile: "personalizado", samples: 101 },
      ANALYSIS_REQUIREMENT_KEYS.SAMPLES_INVALID,
    ],
    [
      "missing CAMM distribution",
      { selectedTaskType: "camm", inputSize: 5000 },
      ANALYSIS_REQUIREMENT_KEYS.DATA_TYPE_REQUIRED,
    ],
    [
      "PINNED node required",
      {
        measurementNodeMode: "PINNED",
        measurementNodeKey: "",
      },
      ANALYSIS_REQUIREMENT_KEYS
        .MEASUREMENT_NODE_REQUIRED,
    ],
    [
      "measurement policy loading",
      { measurementPolicyLoading: true },
      ANALYSIS_REQUIREMENT_KEYS.MEASUREMENT_POLICY_LOADING,
    ],
    [
      "measurement policy unavailable",
      { measurementPolicyUnavailable: true },
      ANALYSIS_REQUIREMENT_KEYS.MEASUREMENT_POLICY_UNAVAILABLE,
    ],
    [
      "measurement environment unavailable",
      { measurementUnavailable: true },
      ANALYSIS_REQUIREMENT_KEYS.MEASUREMENT_UNAVAILABLE,
    ],
    [
      "academic context loading",
      { courseContextLoading: true },
      ANALYSIS_REQUIREMENT_KEYS.COURSE_LOADING,
    ],
    [
      "academic context error",
      { courseContextError: "error" },
      ANALYSIS_REQUIREMENT_KEYS.COURSE_UNAVAILABLE,
    ],
    [
      "required course",
      { courseSelectionRequired: true },
      ANALYSIS_REQUIREMENT_KEYS.COURSE_REQUIRED,
    ],
  ])("reports only the applicable %s requirement", (_label, patch, key) => {
    expect(
      buildAnalysisRequirements({ ...valid, ...patch })
    ).toEqual([key]);
  });

  test("reports multiple unsatisfied requirements without satisfied ones", () => {
    expect(
      buildAnalysisRequirements({
        ...valid,
        file: null,
        fileMeta: null,
        selectedTaskType: "",
        courseSelectionRequired: true,
      })
    ).toEqual([
      ANALYSIS_REQUIREMENT_KEYS.ZIP_REQUIRED,
      ANALYSIS_REQUIREMENT_KEYS.BENCHMARK_REQUIRED,
      ANALYSIS_REQUIREMENT_KEYS.COURSE_REQUIRED,
    ]);
  });

  test("predefined profiles ignore stale manual sample errors", () => {
    expect(
      buildAnalysisRequirements({
        ...valid,
        executionProfile: "rapido",
        samples: 999,
      })
    ).toEqual([]);
  });
});
