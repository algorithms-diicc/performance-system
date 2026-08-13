import {
  buildExecutionSearch,
  buildRecoveredExecutionState,
  parseExecutionPublicIds,
} from "./executionRecoveryModel";

describe("executionRecoveryModel", () => {
  test("parses one public id from URL", () => {
    expect(
      parseExecutionPublicIds(
        "?execution=11111111-1111-1111-1111-111111111111"
      )
    ).toEqual(["11111111-1111-1111-1111-111111111111"]);
  });

  test("supports multiple executions in one submission", () => {
    expect(
      parseExecutionPublicIds("?execution=a&execution=b")
    ).toEqual(["a", "b"]);
  });

  test("deduplicates execution ids", () => {
    expect(
      parseExecutionPublicIds("?execution=a&execution=a&execution=b")
    ).toEqual(["a", "b"]);
  });

  test("builds repeated execution query params", () => {
    expect(
      buildExecutionSearch([{ publicId: "a" }, { publicId: "b" }])
    ).toBe("?execution=a&execution=b");
  });

  test("empty execution list produces empty search", () => {
    expect(buildExecutionSearch([])).toBe("");
  });

  test("reconstructs snapshot and fileList", () => {
    const recovered = buildRecoveredExecutionState([
      {
        publicId: "uuid-1",
        codename: "abcLCS",
        originalFilename: "lcs.cpp",
        submissionId: 56,
        submissionTitle: "Prueba LCS",
        benchmark: "LCS",
        inputSize: 500,
        samples: 30,
        executionProfile: "BALANCED",
        terminal: false,
      },
    ]);

    expect(recovered.executionSnapshot.executions).toEqual([
      {
        publicId: "uuid-1",
        codename: "abcLCS",
        originalFilename: "lcs.cpp",
      },
    ]);
    expect(recovered.fileList).toEqual(["abcLCS"]);
  });

  test("restored completed execution is terminal", () => {
    const recovered = buildRecoveredExecutionState([
      { publicId: "uuid-1", codename: "abcLCS", terminal: true },
    ]);
    expect(recovered.allTerminal).toBe(true);
  });

  test("multiple executions remain nonterminal if one is active", () => {
    const recovered = buildRecoveredExecutionState([
      { publicId: "uuid-1", codename: "oneLCS", terminal: true },
      { publicId: "uuid-2", codename: "twoLCS", terminal: false },
    ]);

    expect(recovered.allTerminal).toBe(false);
    expect(recovered.fileList).toEqual(["oneLCS", "twoLCS"]);
  });
});
