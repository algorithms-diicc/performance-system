import {
  EXECUTION_STATE_OPTIONS,
  adminUserCompletedCount,
  adminUserFailedCount,
  adminUserLastExecutionLabel,
  executionStateBadgeClass,
  executionStateLabel,
  executionStatsFromSummary,
  filterAdminExecutions,
  normalizeAdminExecution,
  normalizeAdminSummary,
} from "./adminExecutionStateModel";

describe("CORE-04E-4 adminExecutionStateModel", () => {
  test("maps canonical labels", () => {
    expect(executionStateLabel("QUEUED")).toBe("En cola");
    expect(executionStateLabel("RUNNING")).toBe("En ejecución");
    expect(executionStateLabel("PROCESSING")).toBe("Procesando");
    expect(executionStateLabel("COMPLETED")).toBe("Completado");
    expect(executionStateLabel("FAILED")).toBe("Error");
    expect(executionStateLabel("CANCELLED")).toBe("Cancelada");
  });

  test("canonical filter options contain all states", () => {
    expect(EXECUTION_STATE_OPTIONS.map((item) => item.value)).toEqual([
      "all",
      "QUEUED",
      "RUNNING",
      "PROCESSING",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
    ]);
  });

  test("normalizes execution response", () => {
    const execution = normalizeAdminExecution({
      executionId: 64,
      state: "COMPLETED",
      stateLabel: "Completado",
      publicId: "uuid",
      codename: "abcLCS",
      submissionTitle: "ejemplo123",
      resultAvailable: true,
    });

    expect(execution.state).toBe("COMPLETED");
    expect(execution.stateLabel).toBe("Completado");
    expect(execution.publicId).toBe("uuid");
    expect(execution.resultAvailable).toBe(true);
  });

  test("legacy compatibility is isolated in model", () => {
    const summary = normalizeAdminSummary({
      executionsCount: 9,
      okExecutions: 4,
      timeoutExecutions: 1,
      errorExecutions: 2,
    });

    expect(summary.completedExecutions).toBe(4);
    expect(summary.failedExecutions).toBe(3);
  });

  test("canonical counters take priority", () => {
    const summary = normalizeAdminSummary({
      executionsCount: 9,
      completedExecutions: 4,
      failedExecutions: 3,
      queuedExecutions: 2,
      okExecutions: 999,
      errorExecutions: 999,
    });

    expect(summary.completedExecutions).toBe(4);
    expect(summary.failedExecutions).toBe(3);
    expect(summary.activeExecutions).toBe(2);
  });

  test("filters by canonical state and problem", () => {
    const items = [
      { state: "COMPLETED", problem: "LCS" },
      { state: "FAILED", problem: "LCS" },
      { state: "QUEUED", problem: "CAMM" },
    ];

    expect(
      filterAdminExecutions(items, "FAILED", "lcs")
    ).toHaveLength(1);
  });

  test("badge classes are canonical-state based", () => {
    expect(executionStateBadgeClass("COMPLETED")).toContain("success");
    expect(executionStateBadgeClass("FAILED")).toContain("error");
    expect(executionStateBadgeClass("RUNNING")).toContain("warning");
  });

  test("summary stats use canonical buckets", () => {
    expect(
      executionStatsFromSummary({
        totalExecutions: 9,
        completedExecutions: 4,
        failedExecutions: 3,
        queuedExecutions: 1,
        runningExecutions: 1,
        processingExecutions: 0,
        cancelledExecutions: 0,
      })
    ).toEqual({
      total: 9,
      completed: 4,
      failed: 3,
      active: 2,
      cancelled: 0,
    });
  });

  test("admin user helpers prefer canonical fields", () => {
    const user = {
      completedExecutions: 4,
      failedExecutions: 3,
      passedCount: 999,
      failedCount: 999,
      lastExecutionState: "COMPLETED",
      lastExecutionStatus: "legacy",
    };

    expect(adminUserCompletedCount(user)).toBe(4);
    expect(adminUserFailedCount(user)).toBe(3);
    expect(adminUserLastExecutionLabel(user)).toBe("Completado");
  });
});
