import {
  aggregatePollingState,
  buildMessagesFromSnapshot,
  indexExecutionRecords,
  normalizeExecutionSnapshot,
} from "./executionPollingModel";

describe("executionPollingModel", () => {
  test("COMPLETED is terminal and results ready", () => {
    const item = normalizeExecutionSnapshot({
      publicId: "p1",
      codename: "abcLCS",
      state: "COMPLETED",
      stateVersion: 3,
      resultAvailable: true,
    });
    expect(item.terminal).toBe(true);
    expect(item.resultsReady).toBe(true);
    expect(item.hasError).toBe(false);
  });

  test("FAILED is terminal and exposes failure message", () => {
    const item = normalizeExecutionSnapshot({
      state: "FAILED",
      failure: {
        stage: "COMPILATION",
        code: "COMPILE_ERROR",
        message: "No compila",
      },
    });
    expect(item.terminal).toBe(true);
    expect(item.hasError).toBe(true);
    expect(item.errorMessage).toBe("No compila");
  });

  test("RUNNING is not terminal", () => {
    const item = normalizeExecutionSnapshot({
      state: "RUNNING",
      startedAt: "2026-08-11T01:00:00",
    });
    expect(item.terminal).toBe(false);
    expect(item.resultsReady).toBe(false);
  });

  test("PROCESSING synthesizes processing messages", () => {
    const messages = buildMessagesFromSnapshot({
      state: "PROCESSING",
      startedAt: "2026-08-11T01:00:00",
      processingAt: "2026-08-11T01:01:00",
    });
    expect(
      messages.some((entry) =>
        entry.msg.includes("Generando gráficos")
      )
    ).toBe(true);
  });

  test("COMPLETED synthesizes Resultados listos", () => {
    const messages = buildMessagesFromSnapshot({
      state: "COMPLETED",
      resultAvailable: true,
    });
    expect(
      messages.some((entry) =>
        entry.msg.includes("Resultados listos")
      )
    ).toBe(true);
  });

  test("aggregate allDone only when all completed", () => {
    const aggregate = aggregatePollingState([
      { resultsReady: true, terminal: true, hasError: false },
      { resultsReady: true, terminal: true, hasError: false },
    ]);
    expect(aggregate.allDone).toBe(true);
    expect(aggregate.allTerminal).toBe(true);
    expect(aggregate.hasError).toBe(false);
  });

  test("aggregate failure is terminal but not allDone", () => {
    const aggregate = aggregatePollingState([
      {
        resultsReady: false,
        terminal: true,
        hasError: true,
        errorMessage: "Falló",
      },
    ]);
    expect(aggregate.allDone).toBe(false);
    expect(aggregate.allTerminal).toBe(true);
    expect(aggregate.hasError).toBe(true);
    expect(aggregate.firstErrorMessage).toBe("Falló");
  });

  test("execution records are indexed by codename", () => {
    const map = indexExecutionRecords([
      {
        publicId: "uuid-1",
        codename: "abcLCS",
        originalFilename: "lcs.cpp",
      },
    ]);
    expect(map.get("abcLCS")).toEqual({
      publicId: "uuid-1",
      codename: "abcLCS",
      originalFilename: "lcs.cpp",
    });
  });
});
