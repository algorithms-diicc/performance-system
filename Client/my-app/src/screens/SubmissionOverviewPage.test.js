import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";

import downloadAuthenticatedFile from "../utils/downloadAuthenticatedFile";
import SubmissionOverviewPage from "./SubmissionOverviewPage";
import { formatSubmissionDateTime } from "./submissionOverviewModel";

jest.mock("axios");
jest.mock("../utils/downloadAuthenticatedFile");

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
  useParams: () => ({ submissionId: "42" }),
}));

const ARCHIVE_SHA = "b".repeat(64);
const STUDENT_USER = { role_name: "Student" };
const TEACHER_USER = { role_name: "Teacher" };
const ADMIN_USER = { role_name: "Admin" };

const ownerSubmission = {
  id: 42,
  courseId: 9,
  course: {
    id: 9,
    code: "CC4102",
    name: "Diseño y Análisis de Algoritmos",
    academicYear: 2026,
    academicTerm: 1,
  },
  title: "Comparación de algoritmos de ordenamiento",
  originalFilename: "algoritmos.zip",
  archiveSha256: ARCHIVE_SHA,
  createdAt: "2026-08-17T12:00:00Z",
  note: "Referencia inicial",
  isPinned: false,
};

const completedSummary = {
  executionsCount: 1,
  completedExecutions: 1,
  failedExecutions: 0,
  queuedExecutions: 0,
  runningExecutions: 0,
  processingExecutions: 0,
  cancelledExecutions: 0,
};

const completedExecution = {
  executionId: 10,
  publicId: "public-execution-10",
  codename: "opaque-codename-10",
  originalFilename: "std_sort.cpp",
  submissionId: 42,
  submissionTitle: ownerSubmission.title,
  state: "COMPLETED",
  stateLabel: "Completado",
  durationMs: 1250,
  hardwareProfile: "Intel i7",
  resultAvailable: true,
  failure: null,
  benchmark: "LCS",
};

const ownerPermissions = {
  canEditMetadata: true,
  canViewPrivateMetadata: true,
};

const readOnlyPermissions = {
  canEditMetadata: false,
  canViewPrivateMetadata: false,
};

const sourceTrace = {
  submission: {
    id: 42,
    title: ownerSubmission.title,
    archive: {
      originalFilename: "algoritmos.zip",
      sha256: ARCHIVE_SHA,
      available: true,
      integrity: "verified",
    },
  },
  execution: {
    publicId: completedExecution.publicId,
    codename: completedExecution.codename,
    source: {
      filename: "std_sort.cpp",
      sourceIndex: 0,
      available: true,
      sha256: "c".repeat(64),
      sizeBytes: 31,
    },
  },
  permissions: {
    canViewSource: true,
    canDownloadSource: true,
    canDownloadArchive: true,
  },
};

const sourcePayload = {
  filename: "std_sort.cpp",
  content: "int main() {\n  return 0;\n}\n",
  sizeBytes: 31,
  sha256: "c".repeat(64),
};

const comparisonExecution = (index, overrides = {}) => ({
  ...completedExecution,
  executionId: 10 + index,
  publicId: `public-execution-${10 + index}`,
  codename: `comparison-codename-${index}`,
  originalFilename: `implementation-${index}.cpp`,
  ...overrides,
});

const arrangeRequests = ({
  submission = ownerSubmission,
  summary = completedSummary,
  permissions = ownerPermissions,
  executions = [completedExecution],
  trace = sourceTrace,
  source = sourcePayload,
  traceError = null,
  sourceError = null,
} = {}) => {
  axios.get.mockImplementation((url) => {
    const requestURL = String(url);

    if (requestURL.endsWith("/executions")) {
      return Promise.resolve({ data: { items: executions } });
    }

    if (requestURL.endsWith("/trace")) {
      return traceError
        ? Promise.reject(traceError)
        : Promise.resolve({ data: trace });
    }

    if (requestURL.endsWith("/source")) {
      return sourceError
        ? Promise.reject(sourceError)
        : Promise.resolve({ data: { source } });
    }

    return Promise.resolve({
      data: { submission, summary, permissions },
    });
  });
};

const renderSubmissionPage = (currentUser = STUDENT_USER) =>
  render(
    <MemoryRouter initialEntries={["/submissions/42"]}>
      <SubmissionOverviewPage currentUser={currentUser} />
    </MemoryRouter>
  );

const renderLoadedPage = async (options = {}) => {
  const {
    currentUser = STUDENT_USER,
    ...requestOptions
  } = options || {};

  arrangeRequests(requestOptions);
  renderSubmissionPage(currentUser);

  await screen.findByRole("heading", {
    name:
      requestOptions?.submission?.title || ownerSubmission.title,
  });
};

describe("SubmissionOverviewPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    downloadAuthenticatedFile.mockResolvedValue({ data: new Blob([]) });
  });

  test("renders the canonical single-execution view with provenance and result navigation", async () => {
    await renderLoadedPage();

    const information = screen.getByRole("region", {
      name: "Información del experimento",
    });

    expect(within(information).getByText("algoritmos.zip")).toBeInTheDocument();
    expect(
      within(information).getByText(
        "CC4102 · Diseño y Análisis de Algoritmos"
      )
    ).toBeInTheDocument();
    expect(
      within(information).getByText(
        formatSubmissionDateTime(ownerSubmission.createdAt)
      )
    ).toBeInTheDocument();
    expect(within(information).getByTitle(ARCHIVE_SHA)).toHaveTextContent(
      `${"b".repeat(12)}…${"b".repeat(8)}`
    );
    expect(
      within(information).getByRole("button", {
        name: "Copiar SHA-256 completo",
      })
    ).toBeInTheDocument();

    const filenameHeading = screen.getByRole("heading", {
      name: "std_sort.cpp",
    });
    const executionCard = filenameHeading.closest("article");

    expect(filenameHeading).toBeInTheDocument();
    expect(
      within(executionCard).getByText("Fuente de esta ejecución")
    ).toBeInTheDocument();
    expect(
      within(executionCard).getByText("opaque-codename-10")
    ).toBeInTheDocument();
    expect(
      within(executionCard).queryByRole("heading", {
        name: "opaque-codename-10",
      })
    ).not.toBeInTheDocument();
    expect(within(executionCard).getByText("LCS")).toBeInTheDocument();
    expect(within(executionCard).getByText("1,25 s")).toBeInTheDocument();
    expect(within(executionCard).getByText("Disponible")).toBeInTheDocument();

    fireEvent.click(
      within(executionCard).getByRole("button", {
        name: "Ver código",
      })
    );

    const sourceDialog = await screen.findByRole("dialog");
    expect(sourceDialog).toBeInTheDocument();
    expect(
      await screen.findByText("int main() {", { exact: false })
    ).toBeInTheDocument();
    expect(
      within(sourceDialog).getByRole("heading", { name: "std_sort.cpp" })
    ).toBeInTheDocument();
    expect(within(sourceDialog).getByText("31 B")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Cerrar visor de código" })
    );

    fireEvent.click(
      within(executionCard).getByRole("button", {
        name: "Reutilizar configuración",
      })
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      "/?reuse=public-execution-10"
    );

    fireEvent.click(
      within(executionCard).getByRole("button", {
        name: "Ver resultado",
      })
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      "/code/opaque-codename-10"
    );
  });

  test.each([
    ["Student", STUDENT_USER],
    ["Teacher", TEACHER_USER],
    ["Admin", ADMIN_USER],
  ])(
    "builds the owner %s breadcrumb from canonical permissions",
    async (_role, currentUser) => {
      await renderLoadedPage({ currentUser });

      const navigation = screen.getByRole("navigation", {
        name: "Ruta de navegación",
      });
      expect(
        within(navigation).getByRole("link", { name: "Historial" })
      ).toHaveAttribute("href", "/history");
      expect(
        within(navigation).getByText("Experimento #42")
      ).toHaveAttribute("aria-current", "page");
      expect(
        axios.get.mock.calls.some(([url]) =>
          String(url).includes("/api/auth/me")
        )
      ).toBe(false);
    }
  );

  test.each([
    ["Teacher", TEACHER_USER],
    ["Admin", ADMIN_USER],
  ])(
    "%s non-owner with course keeps the supervision breadcrumb",
    async (_role, currentUser) => {
      await renderLoadedPage({
        currentUser,
        permissions: readOnlyPermissions,
      });

      const navigation = screen.getByRole("navigation", {
        name: "Ruta de navegación",
      });
      expect(
        within(navigation).getByRole("link", {
          name: "CC4102 · Diseño y Análisis de Algoritmos",
        })
      ).toHaveAttribute("href", "/teacher/courses/9");
      expect(
        within(navigation).queryByRole("link", { name: "Historial" })
      ).not.toBeInTheDocument();
    }
  );

  test("Admin non-owner personal Experiment keeps Administration Users", async () => {
    await renderLoadedPage({
      currentUser: ADMIN_USER,
      submission: {
        ...ownerSubmission,
        courseId: null,
        course: null,
      },
      permissions: readOnlyPermissions,
    });

    const navigation = screen.getByRole("navigation", {
      name: "Ruta de navegación",
    });
    expect(
      within(navigation).getByRole("link", { name: "Usuarios" })
    ).toHaveAttribute("href", "/admin/users");
  });

  test("renders multiple implementation cards in the same layout and exposes PARTIAL aggregate", async () => {
    const failedExecution = {
      ...completedExecution,
      executionId: 11,
      publicId: "public-execution-11",
      codename: "opaque-codename-11",
      originalFilename: "quick_sort.cpp",
      state: "FAILED",
      stateLabel: "Error",
      durationMs: null,
      resultAvailable: false,
      benchmark: "Sorting",
      failure: { message: "Compilación fallida" },
    };

    await renderLoadedPage({
      summary: {
        ...completedSummary,
        executionsCount: 2,
        completedExecutions: 1,
        failedExecutions: 1,
      },
      executions: [completedExecution, failedExecution],
    });

    expect(
      screen.getByRole("heading", { name: "std_sort.cpp" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "quick_sort.cpp" })
    ).toBeInTheDocument();
    expect(screen.getByText("Parcial")).toBeInTheDocument();
  });

  test("failed execution shows useful failure details and never offers a result", async () => {
    const failedExecution = {
      ...completedExecution,
      state: "FAILED",
      stateLabel: "Error",
      resultAvailable: false,
      durationMs: null,
      failure: {
        message: "El proceso excedió el tiempo máximo.",
        stage: "perf",
        code: "EXECUTION_TIMEOUT",
      },
    };

    await renderLoadedPage({
      summary: {
        ...completedSummary,
        completedExecutions: 0,
        failedExecutions: 1,
      },
      executions: [failedExecution],
    });

    expect(
      screen.getByText(
        "La implementación no pudo completar el análisis."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("El proceso excedió el tiempo máximo.")
    ).toBeInTheDocument();
    expect(screen.getByText("perf")).toBeInTheDocument();
    expect(screen.getByText("EXECUTION_TIMEOUT")).toBeInTheDocument();
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver resultado" })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Reutilizar configuración",
      })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver código" }));
    expect(
      await screen.findByText("int main() {", { exact: false })
    ).toBeInTheDocument();
  });

  test("active execution reports pending result without a false CTA", async () => {
    await renderLoadedPage({
      summary: {
        ...completedSummary,
        completedExecutions: 0,
        processingExecutions: 1,
      },
      executions: [
        {
          ...completedExecution,
          state: "PROCESSING",
          stateLabel: "Procesando",
          resultAvailable: false,
          durationMs: null,
        },
      ],
    });

    expect(screen.getByText("En progreso")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver resultado" })
    ).not.toBeInTheDocument();
  });

  test("owner sees note and reference and can start note editing", async () => {
    await renderLoadedPage();

    expect(
      screen.getByRole("heading", { name: "Metadata personal" })
    ).toBeInTheDocument();
    expect(screen.getByText("Referencia inicial")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marcar como referencia" })
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    expect(screen.getByLabelText("Nota personal")).toHaveValue(
      "Referencia inicial"
    );
    expect(screen.getByText("18/500 caracteres")).toBeInTheDocument();
  });

  test("successful note PATCH uses backend response as the new UI state", async () => {
    axios.patch.mockResolvedValue({
      data: {
        id: 42,
        note: "Nota normalizada por backend",
        isPinned: false,
      },
    });
    await renderLoadedPage();

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nota personal"), {
      target: { value: "  Nota normalizada por backend  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringMatching(/api\/submissions\/42$/),
        { note: "  Nota normalizada por backend  " },
        { withCredentials: true }
      )
    );
    expect(
      await screen.findByText("Nota normalizada por backend")
    ).toBeInTheDocument();
    expect(screen.getByText("Nota personal guardada.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Nota personal")).not.toBeInTheDocument();
  });

  test("failed note PATCH keeps the prior persisted note intact", async () => {
    axios.patch.mockRejectedValue({
      response: {
        data: { message: "La nota no pudo guardarse." },
      },
    });
    await renderLoadedPage();

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Nota personal"), {
      target: { value: "Borrador que falló" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("La nota no pudo guardarse.");
    expect(screen.getByLabelText("Nota personal")).toHaveValue(
      "Borrador que falló"
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText("Referencia inicial")).toBeInTheDocument();
    expect(screen.queryByText("Borrador que falló")).not.toBeInTheDocument();
  });

  test("owner can pin and unpin the experiment", async () => {
    axios.patch
      .mockResolvedValueOnce({
        data: {
          id: 42,
          note: "Referencia inicial",
          isPinned: true,
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 42,
          note: "Referencia inicial",
          isPinned: false,
        },
      });
    await renderLoadedPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Marcar como referencia" })
    );

    const pinnedButton = await screen.findByRole("button", {
      name: "Referencia",
    });
    expect(pinnedButton).toHaveAttribute("aria-pressed", "true");
    expect(axios.patch).toHaveBeenLastCalledWith(
      expect.stringMatching(/api\/submissions\/42$/),
      { isPinned: true },
      { withCredentials: true }
    );

    fireEvent.click(pinnedButton);

    const unpinnedButton = await screen.findByRole("button", {
      name: "Marcar como referencia",
    });
    expect(unpinnedButton).toHaveAttribute("aria-pressed", "false");
    expect(axios.patch).toHaveBeenLastCalledWith(
      expect.stringMatching(/api\/submissions\/42$/),
      { isPinned: false },
      { withCredentials: true }
    );
  });

  test("Teacher/Admin payload omitting private keys renders no private metadata controls", async () => {
    const readOnlySubmission = Object.fromEntries(
      Object.entries(ownerSubmission).filter(
        ([key]) => !["note", "isPinned"].includes(key)
      )
    );

    await renderLoadedPage({
      submission: readOnlySubmission,
      permissions: readOnlyPermissions,
      trace: {
        ...sourceTrace,
        permissions: {
          ...sourceTrace.permissions,
          canDownloadArchive: false,
        },
      },
    });

    expect(
      screen.queryByRole("heading", { name: "Metadata personal" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Nota personal")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /referencia/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: ownerSubmission.title })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Descargar ZIP original" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Reutilizar configuración",
      })
    ).not.toBeInTheDocument();
  });

  test("null archive SHA uses a readable fallback and no copy action", async () => {
    await renderLoadedPage({
      submission: {
        ...ownerSubmission,
        archiveSha256: null,
      },
    });

    const information = screen.getByRole("region", {
      name: "Información del experimento",
    });

    expect(
      within(information).getByText("No disponible", {
        selector: "code",
      })
    ).toBeInTheDocument();
    expect(
      within(information).queryByRole("button", {
        name: "Copiar SHA-256 completo",
      })
    ).not.toBeInTheDocument();
  });

  test("owner can start the verified original ZIP download", async () => {
    await renderLoadedPage();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Descargar ZIP original",
      })
    );

    await waitFor(() =>
      expect(downloadAuthenticatedFile).toHaveBeenCalledWith(
        expect.stringMatching(/api\/submissions\/42\/archive$/),
        "algoritmos.zip"
      )
    );
    expect(
      await screen.findByText("ZIP original descargado correctamente.")
    ).toBeInTheDocument();
  });

  test("historical unavailable archive is discreet and null filename is never invented", async () => {
    await renderLoadedPage({
      submission: {
        ...ownerSubmission,
        originalFilename: null,
      },
      trace: {
        ...sourceTrace,
        submission: {
          ...sourceTrace.submission,
          archive: {
            ...sourceTrace.submission.archive,
            originalFilename: null,
            available: false,
            integrity: "unavailable",
          },
        },
      },
    });

    const information = screen.getByRole("region", {
      name: "Información del experimento",
    });
    expect(within(information).getByText("No disponible")).toBeInTheDocument();
    expect(
      await within(information).findByText("Archivo original no disponible")
    ).toBeInTheDocument();
    expect(information).not.toHaveTextContent("submission-42.zip");
    expect(
      within(information).queryByRole("button", {
        name: "Descargar ZIP original",
      })
    ).not.toBeInTheDocument();
    expect(
      within(information).queryByRole("button", {
        name: "Repetir experimento",
      })
    ).not.toBeInTheDocument();
  });

  test("source unavailable opens contextual state without fake code", async () => {
    await renderLoadedPage({
      trace: {
        ...sourceTrace,
        execution: {
          ...sourceTrace.execution,
          source: {
            ...sourceTrace.execution.source,
            available: false,
            sha256: null,
            sizeBytes: null,
          },
        },
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Ver código" }));

    expect(
      await screen.findByText(
        "La fuente histórica no está disponible para esta ejecución."
      )
    ).toBeInTheDocument();
    expect(screen.queryByText("int main()", { exact: false })).not.toBeInTheDocument();
    expect(
      axios.get.mock.calls.some(([url]) => String(url).endsWith("/source"))
    ).toBe(false);
  });

  test("source request error remains contextual and never tears down Submission", async () => {
    await renderLoadedPage({
      sourceError: { response: { status: 404 } },
    });

    fireEvent.click(screen.getByRole("button", { name: "Ver código" }));

    expect(
      await screen.findByText(
        "La fuente histórica no está disponible para esta ejecución."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: ownerSubmission.title })
    ).toBeInTheDocument();
  });

  test("refresh reloads detail, executions, summary and permissions", async () => {
    const initialSubmission = Object.fromEntries(
      Object.entries(ownerSubmission).filter(
        ([key]) => !["note", "isPinned"].includes(key)
      )
    );
    const refreshedSubmission = {
      ...ownerSubmission,
      title: "Experimento actualizado",
      note: "Visible después del refresh",
      isPinned: true,
    };
    let detailRequestCount = 0;

    axios.get.mockImplementation((url) => {
      if (String(url).endsWith("/trace")) {
        return Promise.resolve({ data: sourceTrace });
      }

      if (String(url).endsWith("/executions")) {
        const executions =
          detailRequestCount > 1
            ? [
                completedExecution,
                {
                  ...completedExecution,
                  executionId: 11,
                  codename: "second-codename",
                  originalFilename: "merge_sort.cpp",
                },
              ]
            : [completedExecution];

        return Promise.resolve({ data: { items: executions } });
      }

      detailRequestCount += 1;

      if (detailRequestCount === 1) {
        return Promise.resolve({
          data: {
            submission: initialSubmission,
            summary: completedSummary,
            permissions: readOnlyPermissions,
          },
        });
      }

      return Promise.resolve({
        data: {
          submission: refreshedSubmission,
          summary: {
            ...completedSummary,
            executionsCount: 2,
            completedExecutions: 2,
          },
          permissions: ownerPermissions,
        },
      });
    });

    renderSubmissionPage();
    await screen.findByRole("heading", { name: ownerSubmission.title });
    expect(
      screen.queryByRole("heading", { name: "Metadata personal" })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Actualizar estados" })
    );

    expect(
      await screen.findByRole("heading", {
        name: "Experimento actualizado",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Metadata personal" })
    ).toBeInTheDocument();
    expect(screen.getByText("Visible después del refresh")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "merge_sort.cpp" })
    ).toBeInTheDocument();
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(6));
  });

  test("loading, request error and retry states remain actionable", async () => {
    let resolveDetail;
    let resolveExecutions;
    const detailPromise = new Promise((resolve) => {
      resolveDetail = resolve;
    });
    const executionsPromise = new Promise((resolve) => {
      resolveExecutions = resolve;
    });

    axios.get.mockImplementation((url) =>
      String(url).endsWith("/executions")
        ? executionsPromise
        : detailPromise
    );

    renderSubmissionPage();
    expect(screen.getByText("Cargando experimento")).toBeInTheDocument();

    await act(async () => {
      resolveDetail({
        data: {
          submission: ownerSubmission,
          summary: completedSummary,
          permissions: ownerPermissions,
        },
      });
      resolveExecutions({ data: { items: [completedExecution] } });
      await Promise.all([detailPromise, executionsPromise]);
    });

    expect(
      await screen.findByRole("heading", { name: ownerSubmission.title })
    ).toBeInTheDocument();
  });

  test("request error renders InlineState and can retry", async () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    axios.get.mockRejectedValue({ response: { status: 500 } });

    renderSubmissionPage();

    expect(
      await screen.findByText("No fue posible cargar el experimento")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" })
    ).toBeInTheDocument();

    consoleError.mockRestore();
  });

  test("empty execution list keeps the canonical empty state", async () => {
    await renderLoadedPage({
      summary: {
        executionsCount: 0,
        completedExecutions: 0,
        failedExecutions: 0,
        queuedExecutions: 0,
        runningExecutions: 0,
        processingExecutions: 0,
        cancelledExecutions: 0,
      },
      executions: [],
    });

    expect(
      screen.getByText("Sin ejecuciones", { selector: "strong" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Este experimento todavía no registra implementaciones ejecutables."
      )
    ).toBeInTheDocument();
  });

  test("owner can repeat only by navigating to a reviewable preload", async () => {
    await renderLoadedPage();

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Repetir experimento",
      })
    );

    expect(mockNavigate).toHaveBeenCalledWith("/?repeat=42");
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("explains ZIP to independent .cpp executions", async () => {
    await renderLoadedPage();

    expect(
      screen.getByText(
        "Cada archivo .cpp del experimento genera una ejecución independiente y conserva sus propios resultados."
      )
    ).toBeInTheDocument();
  });

  test("reference browser exposes compatible and incompatible reasons and builds a two-execution path", async () => {
    axios.post.mockResolvedValueOnce({
      data: {
        items: [
          {
            codename: "reference-compatible",
            sourceFilename: "baseline.cpp",
            status: "LIMITED",
            selectable: true,
            reason: "Cobertura común limitada.",
          },
          {
            codename: "reference-blocked",
            sourceFilename: "other-hardware.cpp",
            status: "INCOMPATIBLE",
            selectable: false,
            reason: "El hardware es distinto.",
          },
        ],
      },
    });
    await renderLoadedPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Comparar con referencia",
      })
    );

    const panel = await screen.findByRole("region", {
      name: "Referencias compatibles para comparar",
    });
    expect(within(panel).getByText("baseline.cpp")).toBeInTheDocument();
    expect(within(panel).getByText("Con limitaciones")).toBeInTheDocument();
    expect(within(panel).getByText("El hardware es distinto.")).toBeInTheDocument();
    expect(
      within(panel).getAllByRole("button", { name: "Comparar" })[1]
    ).toBeDisabled();

    fireEvent.click(
      within(panel).getAllByRole("button", { name: "Comparar" })[0]
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      "/compare?execution=opaque-codename-10&execution=reference-compatible"
    );
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/api\/comparisons\/reference-candidates$/),
      { execution: "opaque-codename-10" },
      { withCredentials: true }
    );
  });

  test("reference browser has a useful no-reference state", async () => {
    axios.post.mockResolvedValueOnce({ data: { items: [] } });
    await renderLoadedPage();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Comparar con referencia",
      })
    );

    expect(
      await screen.findByText(/Marca un Experimento como Referencia/i)
    ).toBeInTheDocument();
  });

  test("previous compatible navigates or reports a localized empty result", async () => {
    axios.post
      .mockResolvedValueOnce({
        data: {
          candidate: {
            codename: "previous-compatible",
            selectable: true,
          },
        },
      })
      .mockResolvedValueOnce({ data: { candidate: null } });
    await renderLoadedPage();

    const action = screen.getByRole("button", {
      name: "Comparar con anterior compatible",
    });
    fireEvent.click(action);
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        "/compare?execution=opaque-codename-10&execution=previous-compatible"
      )
    );

    fireEvent.click(action);
    expect(
      await screen.findByText("No existe una ejecución anterior compatible.")
    ).toBeInTheDocument();
  });

  test("comparison entry is disabled when fewer than two executions are eligible", async () => {
    await renderLoadedPage({
      executions: [
        comparisonExecution(1),
        comparisonExecution(2, {
          state: "FAILED",
          stateLabel: "Error",
          resultAvailable: false,
        }),
      ],
    });

    expect(
      screen.getByRole("button", { name: "Comparar implementaciones" })
    ).toBeDisabled();
    expect(
      screen.getByText(
        "Se necesitan al menos dos implementaciones completadas con resultados."
      )
    ).toBeInTheDocument();
  });

  test.each([2, 3, 4])(
    "comparison mode preselects exactly %i eligible executions",
    async (count) => {
      const executions = Array.from({ length: count }, (_, index) =>
        comparisonExecution(index + 1)
      );
      await renderLoadedPage({ executions });

      fireEvent.click(
        screen.getByRole("button", { name: "Comparar implementaciones" })
      );

      expect(
        screen.getByRole("button", {
          name: `Comparar seleccionadas (${count})`,
        })
      ).toBeEnabled();
      executions.forEach((item) => {
        expect(
          screen.getByLabelText(`Seleccionar ${item.originalFilename}`)
        ).toBeChecked();
      });
    }
  );

  test("more than four eligible executions starts without an arbitrary selection", async () => {
    const executions = Array.from({ length: 5 }, (_, index) =>
      comparisonExecution(index + 1)
    );
    await renderLoadedPage({ executions });

    fireEvent.click(
      screen.getByRole("button", { name: "Comparar implementaciones" })
    );

    expect(
      screen.getByText("Selecciona entre 2 y 4 implementaciones.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Comparar seleccionadas (0)" })
    ).toBeDisabled();
    executions.forEach((item) => {
      expect(
        screen.getByLabelText(`Seleccionar ${item.originalFilename}`)
      ).not.toBeChecked();
    });
  });

  test.each([
    ["FAILED", false, "La ejecución finalizó con error."],
    ["RUNNING", false, "La ejecución todavía está en progreso."],
    ["COMPLETED", false, "La ejecución no tiene resultados disponibles."],
  ])(
    "%s execution with resultAvailable=%s cannot be selected",
    async (state, resultAvailable, reason) => {
      await renderLoadedPage({
        executions: [
          comparisonExecution(1),
          comparisonExecution(2),
          comparisonExecution(3, {
            state,
            stateLabel: state,
            resultAvailable,
          }),
        ],
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Comparar implementaciones" })
      );

      expect(
        screen.queryByLabelText("Seleccionar implementation-3.cpp")
      ).not.toBeInTheDocument();
      expect(screen.getByText(`No participa: ${reason}`)).toBeInTheDocument();
    }
  );

  test("a fifth selection is blocked and deselecting restores its slot", async () => {
    const executions = Array.from({ length: 5 }, (_, index) =>
      comparisonExecution(index + 1)
    );
    await renderLoadedPage({ executions });
    fireEvent.click(
      screen.getByRole("button", { name: "Comparar implementaciones" })
    );

    executions.slice(0, 4).forEach((item) => {
      fireEvent.click(
        screen.getByLabelText(`Seleccionar ${item.originalFilename}`)
      );
    });

    const fifth = screen.getByLabelText("Seleccionar implementation-5.cpp");
    expect(fifth).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Comparar seleccionadas (4)" })
    ).toBeEnabled();

    fireEvent.click(
      screen.getByLabelText("Seleccionar implementation-2.cpp")
    );
    expect(fifth).toBeEnabled();
    fireEvent.click(fifth);
    expect(fifth).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Comparar seleccionadas (4)" })
    ).toBeEnabled();
  });

  test("compare action is disabled after reducing the selection to one", async () => {
    await renderLoadedPage({
      executions: [comparisonExecution(1), comparisonExecution(2)],
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Comparar implementaciones" })
    );
    fireEvent.click(
      screen.getByLabelText("Seleccionar implementation-2.cpp")
    );

    expect(
      screen.getByRole("button", { name: "Comparar seleccionadas (1)" })
    ).toBeDisabled();
  });

  test("comparison navigation uses repeated query keys in orderedExecutions order", async () => {
    await renderLoadedPage({
      executions: [
        comparisonExecution(3, { executionId: 30 }),
        comparisonExecution(1, { executionId: 10 }),
        comparisonExecution(2, { executionId: 20 }),
      ],
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Comparar implementaciones" })
    );
    fireEvent.click(
      screen.getByLabelText("Seleccionar implementation-2.cpp")
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Comparar seleccionadas (2)" })
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      "/compare?execution=comparison-codename-1&execution=comparison-codename-3"
    );
  });

  test("cancel exits comparison mode without affecting existing result navigation", async () => {
    await renderLoadedPage({
      executions: [comparisonExecution(1), comparisonExecution(2)],
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Comparar implementaciones" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      screen.queryByRole("region", {
        name: "Selección de implementaciones para comparar",
      })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Comparar implementaciones" })
    ).toBeEnabled();

    const firstCard = screen
      .getByRole("heading", { name: "implementation-1.cpp" })
      .closest("article");
    fireEvent.click(
      within(firstCard).getByRole("button", { name: "Ver resultado" })
    );
    expect(mockNavigate).toHaveBeenCalledWith("/code/comparison-codename-1");
  });
});
