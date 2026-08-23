import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import axios from "axios";

import downloadAuthenticatedFile from "../utils/downloadAuthenticatedFile";
import ReproducibilityPanel, {
  sourceDownloadFilename,
} from "./ReproducibilityPanel";

jest.mock("axios");
jest.mock("../utils/downloadAuthenticatedFile");

const SOURCE_SHA = "c".repeat(64);
const CSV_SHA = "d".repeat(64);
const ARCHIVE_SHA = "e".repeat(64);

const manifest = {
  schemaVersion: "1.0",
  submission: {
    id: 42,
    title: "Ordenamiento",
    archive: {
      originalFilename: "algoritmos.zip",
      sha256: ARCHIVE_SHA,
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
    sourceIndex: 0,
    available: true,
    sha256: SOURCE_SHA,
    sizeBytes: 2048,
  },
  configuration: {
    inputSize: 5000,
    samples: 30,
    compiler: "g++",
    compilerFlags: "-O2 -std=c++17",
    measurement: {
      points: 10,
      samplesPerPoint: 3,
      warmupRounds: 2,
      perfScope: "process",
      singleEventFallback: false,
    },
  },
  environmentObserved: {
    hostname: "private-host",
    cpu: {
      vendor: "GenuineIntel",
      model: "Intel Core i5-9400",
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
        version: "g++ (Ubuntu 9.4.0) 9.4.0",
      },
    },
  },
  artifacts: {
    measurements: {
      filename: "CombinedResults.csv",
      available: true,
      sha256: CSV_SHA,
      sizeBytes: 4096,
    },
  },
  result_path: "/private/results/CombinedResults.csv",
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
    canDownloadArchive: true,
  },
};

const sourcePayload = {
  source: {
    filename: "nested/std_sort.cpp",
    content: "int main() { return 0; }\n",
    sizeBytes: 2048,
    sha256: SOURCE_SHA,
  },
};

const arrangeRequests = ({
  manifestValue = manifest,
  traceValue = trace,
  manifestError = null,
  traceError = null,
} = {}) => {
  axios.get.mockImplementation((url) => {
    const requestURL = String(url);
    if (requestURL.endsWith("/manifest")) {
      return manifestError
        ? Promise.reject(manifestError)
        : Promise.resolve({ data: manifestValue });
    }
    if (requestURL.endsWith("/trace")) {
      return traceError
        ? Promise.reject(traceError)
        : Promise.resolve({ data: traceValue });
    }
    if (requestURL.endsWith("/source")) {
      return Promise.resolve({ data: sourcePayload });
    }
    throw new Error(`Unexpected GET ${requestURL}`);
  });
};

const renderPanel = async (options = {}) => {
  const {
    onContextChange,
    expand = true,
    ...requestOptions
  } = options || {};
  arrangeRequests(requestOptions);
  render(
    <ReproducibilityPanel
      codename="exec70LCS"
      onContextChange={onContextChange}
    />
  );
  await screen.findByRole("heading", {
    name: "Reproducibilidad y trazabilidad experimental",
  });
  await waitFor(() =>
    expect(
      screen.queryByText("Cargando identidad reproducible…")
    ).not.toBeInTheDocument()
  );

  if (expand) {
    fireEvent.click(
      screen.getByRole("button", {
        name: "Mostrar detalles",
      })
    );
  }
};

describe("ReproducibilityPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    downloadAuthenticatedFile.mockResolvedValue({ data: new Blob([]) });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: jest.fn().mockResolvedValue(undefined) },
    });
  });

  test("selects a language-aware source download fallback", () => {
    expect(sourceDownloadFilename("nested/main.c", "C")).toBe("main.c");
    expect(sourceDownloadFilename("", "C")).toBe("source.c");
    expect(sourceDownloadFilename(null, "C++")).toBe("source.cpp");
    expect(sourceDownloadFilename(undefined, null)).toBe("source.txt");
  });

  test("starts collapsed without delaying requests, context, or refetching on expand", async () => {
    const onContextChange = jest.fn();

    await renderPanel({
      onContextChange,
      expand: false,
    });

    const toggle = screen.getByRole("button", {
      name: "Mostrar detalles",
    });

    expect(toggle).toHaveAttribute(
      "aria-expanded",
      "false"
    );
    expect(
      screen.queryByRole("heading", {
        name: "Configuración",
      })
    ).not.toBeInTheDocument();

    expect(axios.get).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(onContextChange).toHaveBeenLastCalledWith({
        submissionId: 42,
        sourceFilename: "std_sort.cpp",
      })
    );

    fireEvent.click(toggle);

    expect(
      screen.getByRole("button", {
        name: "Ocultar detalles",
      })
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("heading", {
        name: "Configuración",
      })
    ).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  test("loads manifest and trace independently by codename", async () => {
    await renderPanel();

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/api\/executions\/exec70LCS\/manifest$/),
      { withCredentials: true }
    );
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/api\/executions\/exec70LCS\/trace$/),
      { withCredentials: true }
    );
  });

  test("emits only sanitized non-private navigation context", async () => {
    const onContextChange = jest.fn();

    await renderPanel({ onContextChange });

    await waitFor(() =>
      expect(onContextChange).toHaveBeenLastCalledWith({
        submissionId: 42,
        sourceFilename: "std_sort.cpp",
      })
    );

    onContextChange.mock.calls.forEach(([context]) => {
      expect(Object.keys(context).sort()).toEqual([
        "sourceFilename",
        "submissionId",
      ]);
      expect(JSON.stringify(context)).not.toMatch(
        /owner|email|hostname|result_path|hardware_snapshot/i
      );
    });
  });

  test("presents identity, configuration, measurement whitelist and observed hardware", async () => {
    await renderPanel();

    expect(screen.getAllByText("nested/std_sort.cpp").length).toBeGreaterThan(0);
    expect(screen.getAllByText("public-execution-10").length).toBeGreaterThan(0);
    expect(screen.getAllByText("exec70LCS").length).toBeGreaterThan(0);
    expect(screen.getByText("LCS")).toBeInTheDocument();
    expect(screen.getByText("balanced")).toBeInTheDocument();
    expect(screen.getByText("5000")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("-O2 -std=c++17")).toBeInTheDocument();
    expect(screen.getAllByText("C++").length).toBeGreaterThan(0);
    expect(screen.getByText("Explícita (contrato v2)")).toBeInTheDocument();
    expect(screen.getAllByText("g++").length).toBeGreaterThan(1);
    expect(
      screen.getByText("g++ (Ubuntu 9.4.0) 9.4.0")
    ).toBeInTheDocument();
    expect(screen.getByText("Muestras por punto")).toBeInTheDocument();
    expect(
      screen.getByText("Rondas de calentamiento")
    ).toBeInTheDocument();
    expect(screen.getByText("Fallback por evento")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Hardware observado durante la ejecución",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Intel Core i5-9400")).toBeInTheDocument();
    expect(screen.getByText("perf version 6.8")).toBeInTheDocument();
  });

  test("shows inferred compiler from trace for a byte-stable legacy manifest", async () => {
    const legacyManifestSource = {
      ...manifest.source,
    };
    delete legacyManifestSource.language;
    delete legacyManifestSource.metadataProvenance;
    const legacyManifestConfiguration = {
      ...manifest.configuration,
    };
    delete legacyManifestConfiguration.compiler;
    const legacyManifest = {
      ...manifest,
      source: legacyManifestSource,
      configuration: legacyManifestConfiguration,
    };
    const legacyTrace = {
      ...trace,
      execution: {
        ...trace.execution,
        source: {
          ...legacyManifestSource,
          language: "C++",
          compiler: "g++",
          metadataProvenance:
            "inferred_legacy_cpp",
        },
      },
    };

    await renderPanel({
      manifestValue: legacyManifest,
      traceValue: legacyTrace,
    });

    expect(
      screen.getAllByText("C++").length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("Inferida (C++ legacy)")
    ).toBeInTheDocument();
    const configuredCompilerItem = screen
      .getByText("Compilador configurado")
      .closest(".reproducibility-panel__data-item");
    expect(configuredCompilerItem).toHaveTextContent("g++");
    expect(configuredCompilerItem).not.toHaveTextContent(
      "No disponible"
    );
  });

  test("shows source, measurements and archive integrity without internal paths or raw JSON", async () => {
    await renderPanel();
    const text = document.body.textContent;

    expect(text).toContain(SOURCE_SHA);
    expect(text).toContain(CSV_SHA);
    expect(text).toContain(ARCHIVE_SHA);
    expect(text).toContain("CombinedResults.csv");
    expect(text).toContain("Verificado");
    expect(text).not.toContain("/private/");
    expect(text).not.toContain("private-host");
    expect(text).not.toContain("hardware_snapshot");
    expect(text).not.toContain("result_path");
    expect(text).not.toContain('{"schemaVersion"');
  });

  test("copies the public ID and canonical absolute link with accessible feedback", async () => {
    await renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Copiar ID" }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "public-execution-10"
      )
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Public ID copiado"
    );

    fireEvent.click(screen.getByRole("button", { name: "Copiar enlace" }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(
        `${window.location.origin}/code/exec70LCS`
      )
    );
  });

  test("uses every canonical download endpoint and the shared helper", async () => {
    await renderPanel();

    const actions = [
      ["Descargar fuente", /\/source\/download$/, "std_sort.cpp"],
      ["Descargar manifest JSON", /\/manifest\/download$/, "performance-system-exec70LCS-manifest.json"],
      ["Descargar CSV", /\/measurements\/download$/, "performance-system-exec70LCS.csv"],
      ["Descargar paquete reproducible", /\/bundle$/, "performance-system-exec70LCS-bundle.zip"],
    ];

    for (const [label, endpoint, filename] of actions) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      await waitFor(() =>
        expect(downloadAuthenticatedFile).toHaveBeenLastCalledWith(
          expect.stringMatching(endpoint),
          filename
        )
      );
      await waitFor(() =>
        expect(screen.getByRole("button", { name: label })).not.toBeDisabled()
      );
    }
  });

  test("source viewer renders code and unavailable artifacts disable exact actions", async () => {
    await renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Ver código" }));
    expect(
      await screen.findByText("int main() { return 0; }", { exact: false })
    ).toBeInTheDocument();

    cleanup();
    const unavailableManifest = {
      ...manifest,
      source: { ...manifest.source, available: false, sha256: null },
      artifacts: {
        measurements: {
          ...manifest.artifacts.measurements,
          available: false,
          sha256: null,
        },
      },
    };
    const unavailableTrace = {
      ...trace,
      execution: {
        ...trace.execution,
        source: { ...trace.execution.source, available: false },
      },
    };

    await renderPanel({
      manifestValue: unavailableManifest,
      traceValue: unavailableTrace,
    });

    expect(screen.getByRole("button", { name: "Ver código" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Descargar fuente" })
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descargar CSV" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Descargar paquete reproducible" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Descargar manifest JSON" })
    ).toBeEnabled();
  });

  test("partial hardware and independent API failures remain readable", async () => {
    const partialManifest = {
      ...manifest,
      environmentObserved: {
        cpu: {},
        measurementBackend: {},
      },
    };
    await renderPanel({ manifestValue: partialManifest });

    const hardware = screen
      .getByRole("heading", {
        name: "Hardware observado durante la ejecución",
      })
      .closest("article");
    expect(within(hardware).getAllByText("No disponible").length).toBe(10);

    cleanup();
    await renderPanel({
      manifestError: { response: { status: 500 } },
    });
    expect(screen.getByText("No fue posible cargar el manifest.")).toBeInTheDocument();
    expect(screen.getAllByText("public-execution-10").length).toBeGreaterThan(0);

    cleanup();
    await renderPanel({ traceError: { response: { status: 500 } } });
    expect(screen.getByText("No fue posible cargar la procedencia.")).toBeInTheDocument();
    expect(screen.getByText("LCS")).toBeInTheDocument();
  });
});
