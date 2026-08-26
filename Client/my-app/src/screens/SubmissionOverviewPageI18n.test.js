import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import axios from "axios";

import {
  I18nProvider,
  useI18n,
} from "../i18n";
import SubmissionOverviewPage from "./SubmissionOverviewPage";

jest.mock("axios");
jest.mock("../utils/downloadAuthenticatedFile");

const mockNavigate = jest.fn();

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
  useParams: () => ({ submissionId: "42" }),
}));

const submission = {
  id: 42,
  courseId: 9,
  course: {
    id: 9,
    code: "CC4102",
    name: "Diseño y Análisis de Algoritmos",
    academicYear: 2026,
    academicTerm: 1,
  },
  protocolId: 5,
  protocol: {
    id: 5,
    title: "LCS laboratorio",
  },
  title: "Experimento del estudiante",
  originalFilename: "algoritmos.zip",
  archiveSha256: "b".repeat(64),
  createdAt: "2026-08-17T12:00:00Z",
  note: "Referencia inicial",
  isPinned: false,
};

const summary = {
  executionsCount: 1,
  completedExecutions: 1,
  failedExecutions: 0,
  queuedExecutions: 0,
  runningExecutions: 0,
  processingExecutions: 0,
  cancelledExecutions: 0,
};

const execution = {
  executionId: 10,
  publicId: "public-execution-10",
  codename: "opaque-codename-10",
  originalFilename: "std_sort.cpp",
  state: "COMPLETED",
  stateLabel: "Completado",
  statusLabel: "Completado",
  durationMs: 1250,
  hardwareProfile: "Intel i7",
  resultAvailable: true,
  benchmark: "LCS",
  failure: null,
};

const trace = {
  submission: {
    archive: {
      available: true,
    },
  },
  execution: {
    source: {
      filename: "std_sort.cpp",
      available: true,
    },
  },
  permissions: {
    canViewSource: true,
    canDownloadSource: true,
    canDownloadArchive: true,
  },
};

const permissions = {
  canEditMetadata: true,
  canViewPrivateMetadata: true,
};

const arrangeRequests = () => {
  axios.get.mockImplementation((url) => {
    const requestURL = String(url);

    if (requestURL.endsWith("/executions")) {
      return Promise.resolve({
        data: { items: [execution] },
      });
    }

    if (requestURL.endsWith("/trace")) {
      return Promise.resolve({ data: trace });
    }

    return Promise.resolve({
      data: {
        submission,
        summary,
        permissions,
      },
    });
  });
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

const renderEnglishPage = () => {
  arrangeRequests();

  return render(
    <I18nProvider initialLanguage="en">
      <LanguageControl />
      <MemoryRouter
        initialEntries={["/submissions/42"]}
      >
        <SubmissionOverviewPage
          currentUser={{ role_name: "Student" }}
        />
      </MemoryRouter>
    </I18nProvider>
  );
};

describe("SubmissionOverviewPage i18n", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("localizes the experiment chrome while preserving user and technical data", async () => {
    renderEnglishPage();

    expect(
      await screen.findByRole("heading", {
        name: "Experimento del estudiante",
      })
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("Experiment #42")
    ).toHaveLength(2);

    expect(
      screen.getByRole("heading", {
        name: "Experiment information",
      })
    ).toBeInTheDocument();

    expect(
      screen.getAllByText(
        "CC4102 · Diseño y Análisis de Algoritmos"
      )
    ).toHaveLength(2);

    expect(
      screen.getByText("Protocol")
    ).toBeInTheDocument();
    expect(
      screen.getByText("LCS laboratorio")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Protocol #5")
    ).toBeInTheDocument();

    const executionCard = screen
      .getByRole("heading", {
        name: "std_sort.cpp",
      })
      .closest("article");

    expect(
      within(executionCard).getByText("Completed")
    ).toBeInTheDocument();

    expect(
      within(executionCard).queryByText("Completado")
    ).not.toBeInTheDocument();

    expect(
      within(executionCard).getByText("1.25 s")
    ).toBeInTheDocument();

    expect(
      within(executionCard).getByText("Available")
    ).toBeInTheDocument();

    expect(
      within(executionCard).getByText("Intel i7")
    ).toBeInTheDocument();

    expect(
      within(executionCard).getByText("LCS")
    ).toBeInTheDocument();

    expect(
      within(executionCard).getByText(
        "opaque-codename-10"
      )
    ).toBeInTheDocument();
  });

  test("switches visible labels and numeric formatting EN to ES without refetching", async () => {
    renderEnglishPage();

    await screen.findByRole("heading", {
      name: "Experiment information",
    });

    // Detail + executions + archive context + feedback.
    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledTimes(4)
    );

    const requestCount = axios.get.mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", {
        name: "switch-es",
      })
    );

    expect(
      await screen.findByRole("heading", {
        name: "Información del experimento",
      })
    ).toBeInTheDocument();

    const executionCard = screen
      .getByRole("heading", {
        name: "std_sort.cpp",
      })
      .closest("article");

    expect(
      within(executionCard).getByText("1,25 s")
    ).toBeInTheDocument();

    expect(
      within(executionCard).getByText("Disponible")
    ).toBeInTheDocument();

    expect(axios.get).toHaveBeenCalledTimes(
      requestCount
    );
  });

  test("does not leak a Spanish backend metadata error while the UI is English", async () => {
    axios.patch.mockRejectedValue({
      response: {
        data: {
          message: "La nota no pudo guardarse.",
        },
      },
    });

    renderEnglishPage();

    await screen.findByRole("heading", {
      name: "Experiment information",
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Edit",
      })
    );

    expect(
      screen.getByLabelText("Personal note")
    ).toHaveValue("Referencia inicial");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Save",
      })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent(
      "The note could not be saved. Review the content and try again."
    );

    expect(
      screen.queryByText(
        "La nota no pudo guardarse."
      )
    ).not.toBeInTheDocument();
  });

  test("keeps raw execution failure details technical even in English", async () => {
    const failedExecution = {
      ...execution,
      state: "FAILED",
      stateLabel: "Error",
      statusLabel: "Error",
      resultAvailable: false,
      durationMs: null,
      failure: {
        message:
          "El proceso excedió el tiempo máximo.",
        stage: "perf",
        code: "EXECUTION_TIMEOUT",
      },
    };

    axios.get.mockImplementation((url) => {
      const requestURL = String(url);

      if (requestURL.endsWith("/executions")) {
        return Promise.resolve({
          data: { items: [failedExecution] },
        });
      }

      if (requestURL.endsWith("/trace")) {
        return Promise.resolve({ data: trace });
      }

      return Promise.resolve({
        data: {
          submission,
          summary: {
            ...summary,
            completedExecutions: 0,
            failedExecutions: 1,
          },
          permissions,
        },
      });
    });

    render(
      <I18nProvider initialLanguage="en">
        <MemoryRouter
          initialEntries={["/submissions/42"]}
        >
          <SubmissionOverviewPage
            currentUser={{
              role_name: "Student",
            }}
          />
        </MemoryRouter>
      </I18nProvider>
    );

    await screen.findByRole("heading", {
      name: "Experimento del estudiante",
    });

    expect(
      screen.getByText(
        "The implementation could not complete the analysis."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "El proceso excedió el tiempo máximo."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("EXECUTION_TIMEOUT")
    ).toBeInTheDocument();

    expect(
      screen.getByText("perf")
    ).toBeInTheDocument();
  });

  test("localizes reference candidate reasons instead of rendering raw backend Spanish", async () => {
    const rawReason =
      "Las ejecuciones usan lenguajes o compiladores diferentes.";
    axios.post.mockResolvedValueOnce({
      data: {
        items: [
          {
            codename: "reference-candidate-c",
            sourceFilename: "candidate.c",
            status: "LIMITED",
            selectable: true,
            compatibility: {
              status: "LIMITED",
              blockers: [],
              warnings: [
                {
                  code: "SOURCE_TOOLCHAIN_DIFFERS",
                  message: rawReason,
                },
              ],
              commonInputSizes: [100, 200],
              commonMetrics: ["DurationTime"],
            },
            reason: rawReason,
          },
        ],
      },
    });

    renderEnglishPage();
    await screen.findByRole("heading", {
      name: "Experiment information",
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Compare with reference",
      })
    );

    const panel = await screen.findByRole("region", {
      name: "Compatible references for comparison",
    });
    expect(
      within(panel).getByText(
        "The executions use different languages or compilers; interpret the metrics as a comparison between implementations under different toolchains."
      )
    ).toBeInTheDocument();
    expect(
      within(panel).queryByText(rawReason)
    ).not.toBeInTheDocument();
  });
});
