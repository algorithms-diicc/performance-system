import {
  buildRepeatConfiguration,
  buildRepeatSearch,
  parseRepeatSubmissionId,
} from "./submissionRepeatModel";

describe("submissionRepeatModel", () => {
  const descriptor = {
    sourceSubmissionId: 42,
    archiveFilename: "sorting.zip",
    archiveUrl: "/api/submissions/42/archive",
    benchmark: "CAMMR",
    inputSize: 5000,
    samples: 30,
    executionProfile: "BALANCED",
    courseId: 12,
  };

  test("parses and builds one positive Submission id", () => {
    expect(parseRepeatSubmissionId("?repeat=42&reuse=old")).toBe("42");
    expect(parseRepeatSubmissionId("?repeat=0")).toBeNull();
    expect(buildRepeatSearch(42)).toBe("?repeat=42");
    expect(buildRepeatSearch("bad")).toBe("");
  });

  test("maps exact CAMM variant and reusable active course", () => {
    expect(
      buildRepeatConfiguration(descriptor, [{ id: 12 }])
    ).toEqual({
      sourcePublicId: null,
      sourceSubmissionId: "42",
      archiveFilename: "sorting.zip",
      archiveUrl: "/api/submissions/42/archive",
      selectedTaskType: "camm",
      dataType: "cammr",
      inputSize: 5000,
      samples: 30,
      executionProfile: "equilibrado",
      courseId: "12",
    });
  });

  test("drops an inactive course and rejects unsafe archive descriptors", () => {
    expect(
      buildRepeatConfiguration(descriptor, [])?.courseId
    ).toBeNull();
    expect(
      buildRepeatConfiguration(
        { ...descriptor, archiveUrl: "https://example.test/private" },
        []
      )
    ).toBeNull();
  });
});
