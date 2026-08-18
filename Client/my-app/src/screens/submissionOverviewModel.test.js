import {
  abbreviateArchiveSha256,
  canOpenExecutionResult,
  deriveSubmissionAggregateState,
  executionDisplayName,
  formatAcademicPeriod,
  formatBenchmark,
  formatCourseLabel,
  formatExecutionDuration,
  formatSubmissionDateTime,
  resolveResultsDestination,
  sortSubmissionExecutions,
} from "./submissionOverviewModel";

describe("submissionOverviewModel", () => {
  test("single execution keeps individual dashboard navigation", () => {
    expect(
      resolveResultsDestination(["execA"], 123)
    ).toMatchObject({
      kind: "execution",
      path: "/code/execA",
      codename: "execA",
    });
  });

  test("multi execution navigates to Submission overview", () => {
    expect(
      resolveResultsDestination(
        ["execA", "execB", "execC"],
        123
      )
    ).toMatchObject({
      kind: "submission",
      path: "/submissions/123",
    });
  });

  test("multi execution without submissionId never falls back to last codename", () => {
    const destination = resolveResultsDestination(
      ["execA", "execB"],
      null
    );

    expect(destination.path).toBeNull();
    expect(destination.kind).toBe("error");
    expect(destination.error).toBeTruthy();
  });

  test("aggregate COMPLETED", () => {
    expect(
      deriveSubmissionAggregateState({
        executionsCount: 3,
        completedExecutions: 3,
      })
    ).toBe("COMPLETED");
  });

  test("aggregate PARTIAL", () => {
    expect(
      deriveSubmissionAggregateState({
        executionsCount: 3,
        completedExecutions: 2,
        failedExecutions: 1,
      })
    ).toBe("PARTIAL");
  });

  test("aggregate FAILED", () => {
    expect(
      deriveSubmissionAggregateState({
        executionsCount: 3,
        failedExecutions: 2,
        cancelledExecutions: 1,
      })
    ).toBe("FAILED");
  });

  test("aggregate IN_PROGRESS has precedence while children are active", () => {
    expect(
      deriveSubmissionAggregateState({
        executionsCount: 3,
        completedExecutions: 1,
        failedExecutions: 1,
        processingExecutions: 1,
      })
    ).toBe("IN_PROGRESS");
  });

  test("aggregate EMPTY", () => {
    expect(
      deriveSubmissionAggregateState({
        executionsCount: 0,
      })
    ).toBe("EMPTY");
  });

  test("completed result is the only navigable execution state", () => {
    expect(
      canOpenExecutionResult({
        state: "COMPLETED",
        resultAvailable: true,
        codename: "execA",
      })
    ).toBe(true);

    expect(
      canOpenExecutionResult({
        state: "FAILED",
        resultAvailable: false,
        codename: "execB",
      })
    ).toBe(false);
  });

  test("execution list is ordered by executionId ascending", () => {
    expect(
      sortSubmissionExecutions([
        { executionId: 30, codename: "C" },
        { executionId: 10, codename: "A" },
        { executionId: 20, codename: "B" },
      ]).map((item) => item.codename)
    ).toEqual(["A", "B", "C"]);
  });

  test("source filename has visual priority over codename", () => {
    expect(
      executionDisplayName({
        originalFilename: "std_sort.cpp",
        codename: "opaque-execution-id",
      })
    ).toBe("std_sort.cpp");

    expect(
      executionDisplayName({ codename: "fallback-codename" })
    ).toBe("fallback-codename");
  });

  test("durationMs uses readable millisecond, second and minute formats", () => {
    expect(formatExecutionDuration(null)).toBe("Sin datos");
    expect(formatExecutionDuration(875)).toBe("875 ms");
    expect(formatExecutionDuration(1250)).toBe("1,25 s");
    expect(formatExecutionDuration(61500)).toBe("1 min 1,5 s");
    expect(formatExecutionDuration(-1)).toBe("Sin datos");
  });

  test("archive SHA is abbreviated without losing the fallback", () => {
    const sha = "a".repeat(64);

    expect(abbreviateArchiveSha256(sha)).toBe(
      `${"a".repeat(12)}…${"a".repeat(8)}`
    );
    expect(abbreviateArchiveSha256(null)).toBe("No disponible");
  });

  test("course, period, benchmark and creation date are presentation-ready", () => {
    const course = {
      code: "CC4102",
      name: "Diseño y Análisis de Algoritmos",
      academicYear: 2026,
      academicTerm: 1,
    };

    expect(formatCourseLabel(course)).toBe(
      "CC4102 · Diseño y Análisis de Algoritmos"
    );
    expect(formatAcademicPeriod(course)).toBe("Período 2026-1");
    expect(formatCourseLabel(null)).toBe("Sin curso asociado");
    expect(formatBenchmark("LCS")).toBe("LCS");
    expect(formatBenchmark(null)).toBe("No informado");
    expect(
      formatSubmissionDateTime("invalid-date")
    ).toBe("No disponible");
    expect(
      formatSubmissionDateTime("2026-08-17T12:00:00Z")
    ).not.toBe("No disponible");
  });

  test("creation date normalizes non-breaking Unicode whitespace", () => {
    const dateTimeFormatSpy = jest
      .spyOn(Intl, "DateTimeFormat")
      .mockImplementation(() => ({
        format: () =>
          "fecha\u00a0local\u202f  normalizada",
      }));

    try {
      const formatted = formatSubmissionDateTime(
        "2026-08-17T12:00:00Z"
      );

      expect(formatted).toBe("fecha local normalizada");
      expect(formatted).not.toMatch(/[\u00a0\u202f]/u);
      expect(dateTimeFormatSpy).toHaveBeenCalledWith(
        "es-CL",
        {
          dateStyle: "medium",
          timeStyle: "short",
        }
      );
    } finally {
      dateTimeFormatSpy.mockRestore();
    }
  });
});
