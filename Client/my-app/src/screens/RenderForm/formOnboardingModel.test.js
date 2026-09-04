import {
  MAX_SUBMISSION_NOTE_CHARS,
  MAX_SUBMISSION_TITLE_CHARS,
  TITLE_ORIGIN,
  applyArchiveTitleSuggestion,
  hasMeaningfulDraft,
  manualSubmissionTitle,
  normalizeDraftNote,
  parseStarterConfiguration,
  resolveSubmissionTitle,
  suggestTitleFromArchiveFilename,
} from "./formOnboardingModel";

describe("formOnboardingModel title suggestion", () => {
  test.each([
    ["algoritmos.zip", "algoritmos"],
    ["mi.algoritmo.v2.zip", "mi.algoritmo.v2"],
    ["PRUEBA.ZIP", "PRUEBA"],
    [String.raw`C:\fakepath\laboratorio.zip`, "laboratorio"],
    [" /tmp/entrega.final.ZiP ", "entrega.final"],
  ])("suggests %s as %s", (filename, expected) => {
    expect(suggestTitleFromArchiveFilename(filename)).toBe(expected);
  });

  test("removes only the final zip extension", () => {
    expect(suggestTitleFromArchiveFilename("algoritmos.zip.backup")).toBe(
      "algoritmos.zip.backup"
    );
  });

  test("does not invent a title when the stem is empty", () => {
    expect(suggestTitleFromArchiveFilename(".zip")).toBe("");
    expect(suggestTitleFromArchiveFilename(" /folder/.ZIP ")).toBe("");
  });

  test("limits suggestions to the backend title contract", () => {
    const suggestion = suggestTitleFromArchiveFilename(
      `${"a".repeat(300)}.zip`
    );

    expect(suggestion).toHaveLength(MAX_SUBMISSION_TITLE_CHARS);
  });

  test("an empty manual title becomes an explicit automatic suggestion", () => {
    expect(
      applyArchiveTitleSuggestion(
        manualSubmissionTitle(""),
        "archivo.zip"
      )
    ).toEqual({
      value: "archivo",
      origin: TITLE_ORIGIN.AUTO_SUGGESTED,
    });
  });

  test("manual text selected before a ZIP is never overwritten", () => {
    expect(
      applyArchiveTitleSuggestion(
        manualSubmissionTitle("Mi experimento"),
        "archivo.zip"
      )
    ).toEqual({
      value: "Mi experimento",
      origin: TITLE_ORIGIN.MANUAL,
    });
  });

  test("an untouched automatic suggestion follows replacement ZIPs", () => {
    const automatic = applyArchiveTitleSuggestion(
      manualSubmissionTitle(""),
      "primero.zip"
    );

    expect(
      applyArchiveTitleSuggestion(automatic, "segundo.ZIP")
    ).toEqual({
      value: "segundo",
      origin: TITLE_ORIGIN.AUTO_SUGGESTED,
    });
  });

  test("editing an automatic suggestion makes it manual", () => {
    const edited = manualSubmissionTitle("primero ajustado");

    expect(
      applyArchiveTitleSuggestion(edited, "segundo.zip")
    ).toEqual({
      value: "primero ajustado",
      origin: TITLE_ORIGIN.MANUAL,
    });
  });

  test.each(["draft recuperado", "ejecución recuperada"])(
    "a title restored from %s is treated as manual",
    (restoredTitle) => {
      expect(
        applyArchiveTitleSuggestion(
          manualSubmissionTitle(restoredTitle),
          "nuevo.zip"
        ).value
      ).toBe(restoredTitle);
    }
  );

  test("a manually cleared title can be suggested on a later ZIP", () => {
    const cleared = manualSubmissionTitle("");

    expect(
      applyArchiveTitleSuggestion(cleared, "reemplazo.zip")
    ).toEqual({
      value: "reemplazo",
      origin: TITLE_ORIGIN.AUTO_SUGGESTED,
    });
  });

  test("the submission fallback never persists the complete .zip filename", () => {
    expect(
      resolveSubmissionTitle({
        testName: "",
        archiveFilename: "algoritmos.zip",
        fallbackTitle: "Entrada de texto",
      })
    ).toBe("algoritmos");

    expect(
      resolveSubmissionTitle({
        testName: "",
        archiveFilename: ".zip",
        fallbackTitle: "Entrada de texto",
      })
    ).toBe("Entrada de texto");
  });
});

describe("formOnboardingModel draft compatibility", () => {
  test("an old draft without note loads as empty", () => {
    expect(normalizeDraftNote(undefined)).toBe("");
  });

  test("draft note is capped defensively at 500 characters", () => {
    expect(normalizeDraftNote("n".repeat(700))).toHaveLength(
      MAX_SUBMISSION_NOTE_CHARS
    );
  });

  test("default autosave object is not a meaningful draft", () => {
    expect(
      hasMeaningfulDraft({
        version: 1,
        testName: "",
        note: "",
        selectedTaskType: "",
        inputSize: null,
        samples: 30,
        dataType: "",
        executionProfile: "equilibrado",
      })
    ).toBe(false);
  });

  test("null policy-dependent fields are not meaningful draft evidence", () => {
    expect(
      hasMeaningfulDraft({
        version: 1,
        testName: "",
        note: "",
        selectedTaskType: "",
        inputSize: null,
        samples: null,
        dataType: "",
        executionProfile: "equilibrado",
      })
    ).toBe(false);
  });

  test.each([
    [{ testName: "Experimento" }],
    [{ note: "comparar" }],
    [{ selectedTaskType: "lcs" }],
    [{ dataType: "cammr" }],
    [{ executionProfile: "rapido" }],
    [{ inputSize: 2500 }],
    [{ samples: 40 }],
  ])("recognizes meaningful draft evidence", (draft) => {
    expect(hasMeaningfulDraft(draft)).toBe(true);
  });
});

describe("formOnboardingModel starter configurations", () => {
  test.each([
    [
      "?starter=lcs",
      {
        selectedTaskType: "lcs",
        inputSize: 500,
        executionProfile: "rapido",
        samples: 10,
        dataType: "",
      },
    ],
    [
      "?starter=camm",
      {
        selectedTaskType: "camm",
        inputSize: 5000,
        executionProfile: "rapido",
        samples: 10,
        dataType: "cammr",
      },
    ],
    [
      "?starter=size",
      {
        selectedTaskType: "size",
        inputSize: 2500,
        executionProfile: "rapido",
        samples: 10,
        dataType: "",
      },
    ],
  ])("parses %s with canonical defaults", (search, expected) => {
    expect(parseStarterConfiguration(search)).toEqual(expected);
  });

  test("ignores unknown starter identifiers", () => {
    expect(parseStarterConfiguration("?starter=unknown")).toBeNull();
  });
});
