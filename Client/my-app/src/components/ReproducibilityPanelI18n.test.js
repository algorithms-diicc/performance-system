import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import axios from "axios";

import {
  I18nProvider,
  translate,
  useI18n,
} from "../i18n";
import ReproducibilityPanel, {
  executionStateLabel,
} from "./ReproducibilityPanel";

jest.mock("axios");
jest.mock("../utils/downloadAuthenticatedFile");

const manifest = {
  submission: {
    id: 42,
    archive: {
      originalFilename: "algoritmos.zip",
      sha256: "a".repeat(64),
      available: true,
      integrity: "verified",
    },
  },
  execution: {
    publicId: "public-execution-10",
    codename: "exec70LCS",
    state: "COMPLETED",
    benchmark: "LCS",
    profile: "balanced",
    createdAt: "2026-08-17T12:00:00Z",
    finishedAt: "2026-08-17T12:05:00Z",
  },
  source: {
    filename: "nested/std_sort.cpp",
    language: "C++",
    metadataProvenance: "explicit",
    available: true,
    sha256: "b".repeat(64),
    sizeBytes: 2048,
  },
  configuration: {
    inputSize: 5000,
    samples: 30,
    compiler: "g++",
    compilerFlags: "-O3 -std=c++17",
    measurement: {
      points: 10,
      samplesPerPoint: 3,
      warmupRounds: 2,
      perfScope: "process",
      singleEventFallback: false,
    },
  },
  environmentObserved: {
    cpu: {
      vendor: "AuthenticAMD",
      model: "AMD Ryzen 5 3600",
      architecture: "x86_64",
      logicalCpus: 6,
    },
    measurementBackend: {
      name: "perf",
      version: "perf version 6.8",
      requestedScope: "process",
      perfEventParanoid: "-1",
    },
    toolchain: {
      compiler: {
        family: "GNU",
        name: "g++",
        version: "g++ 9.4.0",
      },
    },
  },
  artifacts: {
    measurements: {
      filename: "CombinedResults.csv",
      available: true,
      sha256: "c".repeat(64),
      sizeBytes: 4096,
    },
  },
};

const trace = {
  submission: manifest.submission,
  execution: {
    publicId: "public-execution-10",
    codename: "exec70LCS",
    source: manifest.source,
  },
  permissions: {
    canViewSource: true,
    canDownloadSource: true,
  },
};

const LanguageControl = () => {
  const { setLanguage } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLanguage("es")}
    >
      switch-es
    </button>
  );
};

const arrangeRequests = ({
  manifestError = null,
} = {}) => {
  axios.get.mockImplementation((url) => {
    const requestURL = String(url);

    if (requestURL.endsWith("/manifest")) {
      return manifestError
        ? Promise.reject(manifestError)
        : Promise.resolve({ data: manifest });
    }

    if (requestURL.endsWith("/trace")) {
      return Promise.resolve({ data: trace });
    }

    throw new Error(
      `Unexpected GET ${requestURL}`
    );
  });
};

const renderEnglish = async ({
  manifestError = null,
} = {}) => {
  arrangeRequests({ manifestError });

  render(
    <I18nProvider initialLanguage="en">
      <LanguageControl />
      <ReproducibilityPanel
        codename="exec70LCS"
      />
    </I18nProvider>
  );

  await screen.findByRole("heading", {
    name: "Reproducibility and experimental traceability",
  });

  await waitFor(() =>
    expect(
      screen.queryByText(
        "Loading reproducible identity…"
      )
    ).not.toBeInTheDocument()
  );

  fireEvent.click(
    screen.getByRole("button", {
      name: "Show details",
    })
  );
};

describe("ReproducibilityPanel i18n", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("localizes chrome while preserving persisted experimental data", async () => {
    await renderEnglish();

    expect(
      screen.getByText("Experimental identity")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Configuration",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Hardware observed during execution",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Verified")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Download source",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("COMPLETED")).not.toBeInTheDocument();
    expect(screen.getByText("Warmup rounds")).toBeInTheDocument();

    [
      "exec70LCS",
      "public-execution-10",
      "LCS",
      "balanced",
      "-O3 -std=c++17",
      "AuthenticAMD",
      "AMD Ryzen 5 3600",
      "x86_64",
      "perf",
      "CombinedResults.csv",
    ].forEach((value) => {
      expect(
        screen.getAllByText(value).length
      ).toBeGreaterThan(0);
    });
  });

  test("switches an active request error EN to ES without refetching", async () => {
    await renderEnglish({
      manifestError: {
        response: { status: 500 },
      },
    });

    expect(
      screen.getByText(
        "Could not load the manifest."
      )
    ).toBeInTheDocument();

    expect(axios.get).toHaveBeenCalledTimes(2);

    fireEvent.click(
      screen.getByRole("button", {
        name: "switch-es",
      })
    );

    expect(
      await screen.findByText(
        "No fue posible cargar el manifest."
      )
    ).toBeInTheDocument();

    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test("reactively localizes integrity and action chrome without changing technical identifiers", async () => {
    await renderEnglish();

    fireEvent.click(
      screen.getByRole("button", {
        name: "switch-es",
      })
    );

    expect(
      await screen.findByRole("heading", {
        name: "Reproducibilidad y trazabilidad experimental",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Verificado")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Descargar fuente",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Completada")).toBeInTheDocument();
    expect(
      screen.getByText("Rondas de calentamiento")
    ).toBeInTheDocument();
    expect(screen.queryByText("COMPLETED")).not.toBeInTheDocument();
    expect(
      screen.getAllByText("exec70LCS").length
    ).toBeGreaterThan(0);
    ["AuthenticAMD", "x86_64", "perf", "-O3 -std=c++17"].forEach(
      (value) => {
        expect(screen.getAllByText(value).length).toBeGreaterThan(0);
      }
    );

    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test.each([
    ["QUEUED", "En cola", "Queued"],
    ["RUNNING", "En ejecución", "Running"],
    ["PROCESSING", "Procesando", "Processing"],
    ["COMPLETED", "Completada", "Completed"],
    ["FAILED", "Error", "Failed"],
    ["CANCELLED", "Cancelada", "Cancelled"],
  ])(
    "localizes canonical state %s without mutating the raw value",
    (state, expectedEs, expectedEn) => {
      expect(
        executionStateLabel(
          state,
          (key, params) => translate("es", key, params)
        )
      ).toBe(expectedEs);
      expect(
        executionStateLabel(
          state,
          (key, params) => translate("en", key, params)
        )
      ).toBe(expectedEn);
      expect(state).toBe(state.toUpperCase());
    }
  );

  test("falls back safely for an unknown persisted state", () => {
    expect(
      executionStateLabel(" future_state ", (key, params) =>
        translate("es", key, params)
      )
    ).toBe("FUTURE_STATE");
    expect(
      executionStateLabel(null, (key, params) =>
        translate("es", key, params)
      )
    ).toBe("No disponible");
  });
});
