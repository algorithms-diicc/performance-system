import {
  canOpenExecutionResult,
  deriveSubmissionAggregateState,
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
});
