import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import axios from "axios";

import SubmissionOverviewPage from "./SubmissionOverviewPage";
import { formatSubmissionDateTime } from "./submissionOverviewModel";

jest.mock("axios");

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
  useParams: () => ({ submissionId: "42" }),
}));

const ARCHIVE_SHA = "b".repeat(64);

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

const arrangeRequests = ({
  submission = ownerSubmission,
  summary = completedSummary,
  permissions = ownerPermissions,
  executions = [completedExecution],
} = {}) => {
  axios.get.mockImplementation((url) => {
    if (String(url).endsWith("/executions")) {
      return Promise.resolve({ data: { items: executions } });
    }

    return Promise.resolve({
      data: { submission, summary, permissions },
    });
  });
};

const renderLoadedPage = async (options) => {
  arrangeRequests(options);
  render(<SubmissionOverviewPage />);

  await screen.findByRole("heading", {
    name:
      options?.submission?.title || ownerSubmission.title,
  });
};

describe("SubmissionOverviewPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      within(executionCard).queryByRole("heading", {
        name: "opaque-codename-10",
      })
    ).not.toBeInTheDocument();
    expect(within(executionCard).getByText("LCS")).toBeInTheDocument();
    expect(within(executionCard).getByText("1,25 s")).toBeInTheDocument();
    expect(within(executionCard).getByText("Disponible")).toBeInTheDocument();

    fireEvent.click(
      within(executionCard).getByRole("button", {
        name: "Ver resultado",
      })
    );

    expect(mockNavigate).toHaveBeenCalledWith(
      "/code/opaque-codename-10"
    );
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

    render(<SubmissionOverviewPage />);
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
    expect(axios.get).toHaveBeenCalledTimes(4);
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

    render(<SubmissionOverviewPage />);
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

    render(<SubmissionOverviewPage />);

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
});
