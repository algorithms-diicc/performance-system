import {
  aggregatePollingState,
  buildEventsFromSnapshot,
  indexExecutionRecords,
  normalizeExecutionSnapshot,
  normalizeQueueAhead,
  normalizeQueuePosition,
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

  test("CANCELLED is terminal but not a failure", () => {
    const item = normalizeExecutionSnapshot({ state: "CANCELLED" });
    expect(item.terminal).toBe(true);
    expect(item.hasFailure).toBe(false);
    expect(item.hasCancelled).toBe(true);
    expect(item.hasError).toBe(false);
  });

  test("PROCESSING produces semantic events without UI phrases", () => {
    const events = buildEventsFromSnapshot({
      state: "PROCESSING",
      startedAt: "2026-08-11T01:00:00",
      processingAt: "2026-08-11T01:01:00",
    });
    expect(events.map((entry) => entry.key)).toEqual([
      "accepted",
      "running",
      "processing",
    ]);
    expect(events.every((entry) => entry.msg === undefined)).toBe(true);
  });

  test("COMPLETED produces a completed semantic event", () => {
    const events = buildEventsFromSnapshot({
      state: "COMPLETED",
      resultAvailable: true,
    });
    expect(events.map((entry) => entry.key)).toContain("completed");
  });

  test("failed event preserves only the controlled public message as data", () => {
    expect(
      buildEventsFromSnapshot({
        state: "FAILED",
        failure: { message: "Controlled failure" },
      }).find((entry) => entry.key === "failed")
    ).toMatchObject({
      key: "failed",
      message: "Controlled failure",
    });
  });

  test.each([
    ["QUEUED", 0, 0],
    ["QUEUED", "1", 1],
    ["QUEUED", 2, 2],
    ["QUEUED", -1, null],
    ["QUEUED", 1.5, null],
    ["RUNNING", 3, null],
    ["COMPLETED", 0, null],
  ])("normalizes queueAhead for %s / %s", (state, value, expected) => {
    expect(normalizeQueueAhead(value, state)).toBe(expected);
  });

  test("snapshot carries queueAhead only while queued", () => {
    expect(
      normalizeExecutionSnapshot({ state: "QUEUED", queueAhead: 2 })
        .queueAhead
    ).toBe(2);
    expect(
      normalizeExecutionSnapshot({ state: "PROCESSING", queueAhead: 2 })
        .queueAhead
    ).toBeNull();
  });

  test.each([
    ["QUEUED", 1, 0, 1],
    ["QUEUED", 3, 0, 3],
    ["QUEUED", null, 2, 3],
    ["QUEUED", 0, 2, 3],
    ["RUNNING", 1, 0, null],
  ])(
    "normalizes queuePosition for %s",
    (state, position, queueAhead, expected) => {
      expect(
        normalizeQueuePosition(position, queueAhead, state)
      ).toBe(expected);
    }
  );

  test("snapshot exposes cancellation only for a queued authoritative record", () => {
    expect(
      normalizeExecutionSnapshot({
        state: "QUEUED",
        canCancel: true,
      }).canCancel
    ).toBe(true);
    expect(
      normalizeExecutionSnapshot({
        state: "RUNNING",
        canCancel: true,
      }).canCancel
    ).toBe(false);
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

  test("aggregate distinguishes cancelled from real failure", () => {
    const allCancelled = aggregatePollingState([
      { resultsReady: false, terminal: true, hasCancelled: true },
      { resultsReady: false, terminal: true, hasCancelled: true },
    ]);
    expect(allCancelled.allTerminal).toBe(true);
    expect(allCancelled.hasFailure).toBe(false);
    expect(allCancelled.hasCancelled).toBe(true);

    const mixed = aggregatePollingState([
      { resultsReady: true, terminal: true },
      { resultsReady: false, terminal: true, hasCancelled: true },
      { resultsReady: false, terminal: true, hasFailure: true },
    ]);
    expect(mixed.allDone).toBe(false);
    expect(mixed.hasFailure).toBe(true);
    expect(mixed.hasCancelled).toBe(true);
  });

  test("a cancelled sibling does not make an active group terminal", () => {
    const aggregate = aggregatePollingState([
      { resultsReady: false, terminal: true, hasCancelled: true },
      { resultsReady: false, terminal: false },
    ]);
    expect(aggregate.allTerminal).toBe(false);
    expect(aggregate.hasFailure).toBe(false);
    expect(aggregate.hasCancelled).toBe(true);
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
