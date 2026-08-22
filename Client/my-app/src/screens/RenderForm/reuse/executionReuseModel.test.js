import {
  buildReuseConfiguration,
  buildReuseSearch,
  parseReusePublicId,
} from "./executionReuseModel";

describe("executionReuseModel", () => {
  test("parses one reuse public id", () => {
    expect(
      parseReusePublicId(
        "?reuse=11111111-1111-1111-1111-111111111111"
      )
    ).toBe(
      "11111111-1111-1111-1111-111111111111"
    );
  });

  test("uses the first non-empty reuse id", () => {
    expect(
      parseReusePublicId(
        "?reuse=&reuse=source-2"
      )
    ).toBe("source-2");
  });

  test("builds the reuse query", () => {
    expect(
      buildReuseSearch("source-1")
    ).toBe("?reuse=source-1");
  });

  test("maps CAMMR and BALANCED to frontend controls", () => {
    expect(
      buildReuseConfiguration(
        {
          sourcePublicId: "source-1",
          benchmark: "CAMMR",
          inputSize: 5000,
          samples: 30,
          executionProfile: "BALANCED",
          courseId: 12,
        },
        [{ id: 12 }, { id: 13 }]
      )
    ).toEqual({
      sourcePublicId: "source-1",
      selectedTaskType: "camm",
      dataType: "cammr",
      inputSize: 5000,
      samples: 30,
      executionProfile: "equilibrado",
      courseId: "12",
    });
  });

  test("plain legacy CAMM requires distribution choice", () => {
    const config = buildReuseConfiguration(
      {
        benchmark: "CAMM",
        inputSize: 5000,
        samples: 10,
        executionProfile: "QUICK",
      },
      []
    );

    expect(config.selectedTaskType).toBe("camm");
    expect(config.dataType).toBe("");
    expect(config.executionProfile).toBe(
      "rapido"
    );
  });

  test("does not reuse a course absent from active courses", () => {
    const config = buildReuseConfiguration(
      {
        benchmark: "SIZE",
        inputSize: 2500,
        samples: 50,
        executionProfile: "EXHAUSTIVE",
        courseId: 99,
      },
      [{ id: 12 }]
    );

    expect(config.courseId).toBeNull();
  });

  test("falls back to samples for legacy profile values", () => {
    const config = buildReuseConfiguration(
      {
        benchmark: "LCS",
        inputSize: 500,
        samples: 30,
        executionProfile: null,
      },
      []
    );

    expect(config.executionProfile).toBe(
      "equilibrado"
    );
  });

  test("maps arbitrary historical samples to Custom", () => {
    const config = buildReuseConfiguration(
      {
        benchmark: "LCS",
        inputSize: 500,
        samples: 41,
        executionProfile: null,
      },
      []
    );

    expect(config.executionProfile).toBe("personalizado");
    expect(config.samples).toBe(41);
  });

  test("rejects unsupported historical benchmarks", () => {
    expect(
      buildReuseConfiguration(
        { benchmark: "UNKNOWN" },
        []
      )
    ).toBeNull();
  });
});
