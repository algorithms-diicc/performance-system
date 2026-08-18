import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import axios from "axios";

import downloadAuthenticatedFile from "../utils/downloadAuthenticatedFile";
import RenderImage from "./RenderImage";

jest.mock("axios");
jest.mock("../utils/downloadAuthenticatedFile");
jest.mock("react-plotly.js", () => () => (
  <div data-testid="plotly-chart" />
));

const manifest = {
  execution: {
    publicId: "public-execution-70",
    codename: "exec70LCS",
    state: "COMPLETED",
    benchmark: "LCS",
    profile: "balanced",
    createdAt: "2026-08-17T12:00:00Z",
    finishedAt: "2026-08-17T12:01:00Z",
  },
  submission: {
    id: 42,
    archive: {
      originalFilename: "algoritmos.zip",
      sha256: "a".repeat(64),
      available: true,
      integrity: "verified",
    },
  },
  source: {
    filename: "std_sort.cpp",
    available: true,
    sha256: "b".repeat(64),
    sizeBytes: 31,
  },
  configuration: {
    inputSize: 1000,
    samples: 10,
    compilerFlags: "-O2",
    measurement: {
      points: 10,
      samplesPerPoint: 1,
      warmupRounds: 2,
      perfScope: "process",
      singleEventFallback: false,
    },
  },
  environmentObserved: {
    cpu: {
      vendor: "GenuineIntel",
      model: "Intel Core",
      architecture: "x86_64",
      logicalCpus: 8,
    },
    measurementBackend: {
      name: "perf",
      version: "6.8",
      requestedScope: "process",
      perfEventParanoid: "-1",
    },
  },
  artifacts: {
    measurements: {
      filename: "CombinedResults.csv",
      available: true,
      sha256: "c".repeat(64),
      sizeBytes: 128,
    },
  },
};

const trace = {
  submission: manifest.submission,
  execution: {
    publicId: manifest.execution.publicId,
    codename: manifest.execution.codename,
    source: manifest.source,
  },
  permissions: {
    canViewSource: true,
    canDownloadSource: true,
    canDownloadArchive: true,
  },
};

const STUDENT_USER = { role_name: "Student" };
const TEACHER_USER = { role_name: "Teacher" };
const ADMIN_USER = { role_name: "Admin" };
const submissionDetail = {
  id: 42,
  courseId: 9,
  course: {
    id: 9,
    code: "CC4102",
    name: "Diseño y Análisis de Algoritmos",
  },
};

const renderPage = ({ currentUser = STUDENT_USER } = {}) => {
  render(
    <MemoryRouter initialEntries={["/code/exec70LCS"]}>
      <Routes>
        <Route
          path="/code/:codename"
          element={<RenderImage currentUser={currentUser} />}
        />
      </Routes>
    </MemoryRouter>
  );
};

describe("RenderImage reproducibility integration", () => {
  const arrangeRequests = ({
    submissionId = 42,
    includeSubmission = true,
    manifestValue = manifest,
    traceValue = trace,
    manifestError = null,
    traceError = null,
    submissionValue = submissionDetail,
    submissionError = null,
    resultsError = null,
  } = {}) => {
    axios.get.mockImplementation((url) => {
      const requestURL = String(url);

      if (requestURL.includes("/results")) {
        if (resultsError) return Promise.reject(resultsError);

        const execution = { codename: "exec70LCS" };
        if (includeSubmission) {
          execution.submission_id = submissionId;
        }

        return Promise.resolve({
          data: {
            schema_version: "1.3",
            execution,
            processing: {},
            metrics: {},
            analysis: {},
            pedagogy: {},
          },
        });
      }

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
        return Promise.resolve({
          data: {
            source: {
              filename: "std_sort.cpp",
              content: "int main() { return 0; }\n",
              sizeBytes: 31,
              sha256: "b".repeat(64),
            },
          },
        });
      }

      if (requestURL.includes("_status.json")) {
        return Promise.resolve({ data: {} });
      }

      if (requestURL.includes("/api/submissions/")) {
        return submissionError
          ? Promise.reject(submissionError)
          : Promise.resolve({
              data: { submission: submissionValue },
            });
      }

      return Promise.resolve({ data: "" });
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    downloadAuthenticatedFile.mockResolvedValue({ data: new Blob([]) });
    arrangeRequests();
  });

  test("keeps deterministic experiment navigation while loading manifest and trace by codename", async () => {
    renderPage();

    expect(
      await screen.findByRole("link", { name: "Volver" })
    ).toHaveAttribute("href", "/submissions/42");
    expect(
      await screen.findByRole("link", { name: /Ver experimento/i })
    ).toHaveAttribute("href", "/submissions/42");
    expect(
      await screen.findByRole("heading", { name: "Reproducibilidad" })
    ).toBeInTheDocument();

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(5));
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/api\/executions\/exec70LCS\/manifest$/),
      { withCredentials: true }
    );
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/api\/executions\/exec70LCS\/trace$/),
      { withCredentials: true }
    );
    expect(
      axios.get.mock.calls.some(([url]) =>
        String(url).includes("/submissions/")
      )
    ).toBe(false);

    const navigation = screen.getByRole("navigation", {
      name: "Ruta de navegación",
    });
    expect(
      within(navigation).getByRole("link", {
        name: "Experimento #42",
      })
    ).toHaveAttribute("href", "/submissions/42");
    expect(
      await within(navigation).findByText("std_sort.cpp")
    ).toHaveAttribute("aria-current", "page");
  });

  test("reconstructs Submission navigation from reproducibility context when Results omits it", async () => {
    arrangeRequests({ includeSubmission: false });
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Ejecución exec70LCS" })
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("link", { name: /Ver experimento/i })
    ).toHaveAttribute("href", "/submissions/42");
    expect(
      (await screen.findAllByText("public-execution-70")).length
    ).toBeGreaterThan(0);
  });

  test("Teacher direct URL loads Submission context once and links the canonical course", async () => {
    renderPage({ currentUser: TEACHER_USER });

    const navigation = await screen.findByRole("navigation", {
      name: "Ruta de navegación",
    });
    expect(
      await within(navigation).findByRole("link", {
        name: "CC4102 · Diseño y Análisis de Algoritmos",
      })
    ).toHaveAttribute("href", "/teacher/courses/9");

    await waitFor(() =>
      expect(
        axios.get.mock.calls.filter(([url]) =>
          String(url).includes("/api/submissions/42")
        )
      ).toHaveLength(1)
    );
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/api\/submissions\/42$/),
      { withCredentials: true }
    );
  });

  test.each([
    [STUDENT_USER, "Mi perfil", "/profile"],
    [TEACHER_USER, "Supervisión", "/teacher/courses"],
    [ADMIN_USER, "Usuarios", "/admin/users"],
  ])(
    "uses the deterministic role fallback when no Submission can be resolved",
    async (currentUser, rootLabel, rootPath) => {
      arrangeRequests({
        includeSubmission: false,
        manifestValue: {
          ...manifest,
          submission: { ...manifest.submission, id: null },
        },
        traceValue: {
          ...trace,
          submission: { ...trace.submission, id: null },
        },
      });
      renderPage({ currentUser });

      expect(
        await screen.findByRole("link", { name: "Volver" })
      ).toHaveAttribute("href", rootPath);
      const navigation = screen.getByRole("navigation", {
        name: "Ruta de navegación",
      });
      expect(
        within(navigation).getByRole("link", { name: rootLabel })
      ).toHaveAttribute("href", rootPath);
      expect(
        axios.get.mock.calls.some(([url]) =>
          String(url).includes("/api/submissions/")
        )
      ).toBe(false);
    }
  );

  test("uses Resultado when reproducibility has no source filename", async () => {
    arrangeRequests({
      manifestValue: {
        ...manifest,
        source: { ...manifest.source, filename: null },
      },
      traceValue: {
        ...trace,
        execution: {
          ...trace.execution,
          source: { ...trace.execution.source, filename: null },
        },
      },
    });
    renderPage();

    const navigation = await screen.findByRole("navigation", {
      name: "Ruta de navegación",
    });
    expect(await within(navigation).findByText("Resultado")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("auxiliary Submission failure preserves dashboard and degrades Teacher breadcrumb without loops", async () => {
    arrangeRequests({
      submissionError: { response: { status: 500 } },
    });
    renderPage({ currentUser: TEACHER_USER });

    expect(
      await screen.findByRole("heading", { name: "Ejecución exec70LCS" })
    ).toBeInTheDocument();
    const navigation = screen.getByRole("navigation", {
      name: "Ruta de navegación",
    });
    expect(navigation).toHaveTextContent("Supervisión");
    expect(navigation).toHaveTextContent("Experimento #42");
    expect(await within(navigation).findByText("std_sort.cpp")).toBeInTheDocument();
    expect(navigation).not.toHaveTextContent("CC4102");

    await waitFor(() =>
      expect(
        axios.get.mock.calls.filter(([url]) =>
          String(url).includes("/api/submissions/42")
        )
      ).toHaveLength(1)
    );
    expect(
      screen.queryByText("No pudimos abrir esta ejecución")
    ).not.toBeInTheDocument();
  });

  test("result error state returns to the deterministic role root", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    arrangeRequests({
      resultsError: { response: { status: 404 } },
    });
    renderPage({ currentUser: ADMIN_USER });

    expect(
      await screen.findByRole("link", { name: "Volver" })
    ).toHaveAttribute("href", "/admin/users");
    expect(
      screen.getByText("Ejecución no encontrada")
    ).toBeInTheDocument();

    consoleError.mockRestore();
  });

  test("migrates the existing CSV action exclusively to the canonical 4B endpoint", async () => {
    renderPage();

    const headerDownload = await waitFor(() => {
      const button = document.querySelector(".results-download-button");
      expect(button).toBeTruthy();
      return button;
    });
    fireEvent.click(headerDownload);

    await waitFor(() =>
      expect(downloadAuthenticatedFile).toHaveBeenCalledWith(
        expect.stringMatching(
          /api\/executions\/exec70LCS\/measurements\/download$/
        ),
        "performance-system-exec70LCS.csv"
      )
    );
    expect(
      axios.get.mock.calls.some(([url]) =>
        String(url).includes("/files/exec70LCS/CombinedResults.csv")
      )
    ).toBe(false);
  });

  test("reproducibility data is pedagogical and source viewer is independent", async () => {
    renderPage();

    expect((await screen.findAllByText("std_sort.cpp")).length).toBeGreaterThan(0);
    expect(screen.getByText("balanced")).toBeInTheDocument();
    expect(screen.getByText("Intel Core")).toBeInTheDocument();
    expect(screen.getByText("CombinedResults.csv")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver código" }));
    expect(
      await screen.findByText("int main() { return 0; }", { exact: false })
    ).toBeInTheDocument();
  });

  test("manifest and trace failures never replace the scientific dashboard load state", async () => {
    arrangeRequests({
      manifestError: { response: { status: 500 } },
      traceError: { response: { status: 500 } },
    });
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Ejecución exec70LCS" })
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No fue posible cargar el manifest.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No fue posible cargar la procedencia.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No hay métricas disponibles en esta categoría")
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No pudimos abrir esta ejecución")
    ).not.toBeInTheDocument();
  });
});
