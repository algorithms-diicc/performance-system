import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  applyDocumentLanguage,
  catalogLeafKeys,
  catalogsHaveParity,
  initializeDocumentLanguage,
  normalizeLanguage,
  readStoredLanguage,
  translate,
} from "./i18nCore";

describe("Performance System i18n core", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.setAttribute(
      "lang",
      "es"
    );
  });

  test("normalizes supported languages and falls back to Spanish", () => {
    expect(normalizeLanguage("en-US")).toBe("en");
    expect(normalizeLanguage("ES-cl")).toBe("es");
    expect(normalizeLanguage("fr")).toBe(
      DEFAULT_LANGUAGE
    );
  });

  test("reads persisted language and initializes html lang", () => {
    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      "en"
    );

    expect(readStoredLanguage()).toBe("en");
    expect(initializeDocumentLanguage()).toBe(
      "en"
    );
    expect(
      document.documentElement
        .getAttribute("lang")
    ).toBe("en");
  });

  test("invalid persisted values fall back to Spanish", () => {
    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      "invalid"
    );

    expect(readStoredLanguage()).toBe("es");
    applyDocumentLanguage(
      readStoredLanguage()
    );
    expect(
      document.documentElement
        .getAttribute("lang")
    ).toBe("es");
  });

  test("translates, interpolates and pluralizes", () => {
    expect(
      translate("es", "nav.history")
    ).toBe("Historial");
    expect(
      translate("en", "nav.history")
    ).toBe("History");

    expect(
      translate(
        "en",
        "language.switchTo",
        { language: "Spanish" }
      )
    ).toBe("Switch language to Spanish");

    expect(
      translate(
        "es",
        "common.executionCount",
        { count: 1 }
      )
    ).toBe("1 ejecución");

    expect(
      translate(
        "en",
        "common.executionCount",
        { count: 3 }
      )
    ).toBe("3 executions");
  });

  test("catalogs expose the same leaf keys", () => {
    expect(catalogsHaveParity()).toBe(true);
    expect(catalogLeafKeys("es")).toEqual(
      catalogLeafKeys("en")
    );
  });

  test("unknown keys remain visible for diagnostics", () => {
    expect(
      translate("en", "missing.translation")
    ).toBe("missing.translation");
  });
});
