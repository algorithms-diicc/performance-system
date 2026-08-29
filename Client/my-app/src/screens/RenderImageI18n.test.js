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

import {
  I18nProvider,
  useI18n,
} from "../i18n";
import downloadAuthenticatedFile from "../utils/downloadAuthenticatedFile";
import RenderImage from "./RenderImage";

jest.mock("axios");
jest.mock("../utils/downloadAuthenticatedFile");
jest.mock("react-plotly.js", () => () => (
  <div data-testid="plotly-chart" />
));
jest.mock(
  "../components/ReproducibilityPanel",
  () => ({ codename }) => (
    <div data-testid="reproducibility-stub">
      {codename}
    </div>
  )
);

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

const resultsPayload = {
  schema_version: "1.3",
  execution: {
    codename: "exec70LCS",
    submission_id: 42,
    measurement_context: {
      registry: {
        measurement_node: {
          key: "shenu",
          name: "Shenu",
        },
        hardware_profile: {
          key: "shenu-intel-i5-9400",
          name: "Shenu Intel i5-9400",
        },
      },
    },
  },
  processing: {},
  metrics: {
    DurationTime: {
      status: "available",
      points: [
        {
          input_size: 1000,
          median: 12.5,
          mean: 12.7,
          q1: 12.0,
          q3: 13.0,
          stddev: 0.4,
          valid_samples: 10,
          total_samples: 10,
        },
      ],
    },
    IPC: {
      status: "available",
      points: [
        {
          input_size: 1000,
          median: 1.8,
          mean: 1.82,
          q1: 1.7,
          q3: 1.9,
          stddev: 0.08,
          valid_samples: 10,
          total_samples: 10,
        },
      ],
    },
    CacheMissRate: {
      status: "available",
      points: [
        {
          input_size: 1000,
          median: 2.5,
          mean: 2.6,
          q1: 2.3,
          q3: 2.8,
          stddev: 0.2,
          valid_samples: 10,
          total_samples: 10,
        },
      ],
    },
    BranchMissRate: {
      status: "available",
      points: [
        {
          input_size: 1000,
          median: 1.1,
          mean: 1.15,
          q1: 1.0,
          q3: 1.2,
          stddev: 0.05,
          valid_samples: 10,
          total_samples: 10,
        },
      ],
    },
    Instructions: {
      status: "unsupported",
      points: [],
    },
  },
  analysis: {},
  pedagogy: {
    summary: {
      highlights: [],
    },
  },
};

const submissionDetail = {
  id: 42,
  courseId: 9,
  course: {
    id: 9,
    code: "CC4102",
    name: "Diseño y Análisis de Algoritmos",
    academicYear: 2026,
    academicTerm: 2,
  },
};

const arrangeSuccess = () => {
  axios.get.mockImplementation((url) => {
    const requestURL = String(url);

    if (requestURL.includes("/results")) {
      return Promise.resolve({
        data: resultsPayload,
      });
    }

    if (requestURL.includes("/files/")) {
      return Promise.resolve({ data: "" });
    }

    if (requestURL.includes("_status.json")) {
      return Promise.resolve({
        data: {
          task_type: "LCS",
          input_size: 1000,
          samples: 10,
          files: [],
        },
      });
    }

    if (
      requestURL.includes(
        "/api/submissions/42"
      )
    ) {
      return Promise.resolve({
        data: {
          submission: submissionDetail,
        },
      });
    }

    throw new Error(
      `Unexpected GET ${requestURL}`
    );
  });
};

const renderEnglish = () =>
  render(
    <I18nProvider initialLanguage="en">
      <LanguageControl />
      <MemoryRouter
        initialEntries={[
          "/code/exec70LCS",
        ]}
      >
        <Routes>
          <Route
            path="/code/:codename"
            element={
              <RenderImage
                currentUser={{
                  role_name: "Student",
                }}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );

describe("RenderImage shell i18n", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    downloadAuthenticatedFile.mockResolvedValue(
      { data: new Blob([]) }
    );
  });

  test("localizes shell, metadata, filters and KPIs while preserving institutional data", async () => {
    arrangeSuccess();
    renderEnglish();

    expect(
      await screen.findByRole("heading", {
        name: "Execution exec70LCS",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Performance results")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Analysis completed")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "View experiment",
      })
    ).toHaveAttribute(
      "href",
      "/submissions/42"
    );

    expect(
      await screen.findByText(
        "CC4102 · Diseño y Análisis de Algoritmos"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText("Period 2026-2")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Text input")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Managed")
    ).toBeInTheDocument();

    expect(
      screen.getByText("Measurement node")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Shenu")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Hardware profile")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Shenu Intel i5-9400")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", {
        name: /Summary/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", {
        name: /Performance/i,
      })
    ).toBeInTheDocument();

    const kpiSection = screen
      .getByRole("heading", {
        name: "Main indicators",
      })
      .closest("section");

    expect(
      within(kpiSection).getByText("Time")
    ).toBeInTheDocument();
    expect(
      within(kpiSection).getByText("IPC")
    ).toBeInTheDocument();
    expect(
      within(kpiSection).getByText("Cache miss")
    ).toBeInTheDocument();
    expect(
      within(kpiSection).getByText("Branch miss")
    ).toBeInTheDocument();
    expect(
      within(kpiSection).queryByText("Instructions")
    ).not.toBeInTheDocument();
    expect(
      within(kpiSection).getByRole("status")
    ).toHaveTextContent(
      "4 of 5 main indicators available."
    );
    expect(
      within(kpiSection).queryByText("Unavailable")
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Filters/i,
      })
    );

    expect(
      screen.getByRole("heading", {
        name: "Analysis filters",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Aggregation")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Mean",
      })
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(axios.get).toHaveBeenCalledTimes(4)
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "switch-es",
      })
    );

    expect(
      await screen.findByRole("heading", {
        name: "Ejecución exec70LCS",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Resultados de rendimiento")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Filtros del análisis",
      })
    ).toBeInTheDocument();
    expect(
      within(kpiSection).getByRole("status")
    ).toHaveTextContent(
      "4 de 5 indicadores principales disponibles."
    );

    expect(axios.get).toHaveBeenCalledTimes(4);
  });

  test("reactively localizes a result 404 without retrying the request", async () => {
    axios.get.mockRejectedValue({
      response: { status: 404 },
    });

    renderEnglish();

    expect(
      await screen.findByText(
        "Execution not found"
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The execution or one of its result artifacts is no longer available."
      )
    ).toBeInTheDocument();

    expect(axios.get).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", {
        name: "switch-es",
      })
    );

    expect(
      await screen.findByText(
        "Ejecución no encontrada"
      )
    ).toBeInTheDocument();

    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  test("download errors switch language without repeating the download", async () => {
    arrangeSuccess();
    downloadAuthenticatedFile.mockRejectedValue({
      response: { status: 403 },
    });

    renderEnglish();

    const button =
      await screen.findByRole("button", {
        name: "Download CSV",
      });

    fireEvent.click(button);

    expect(
      await screen.findByText(
        "Your account does not have permission to download this CSV."
      )
    ).toBeInTheDocument();

    expect(
      downloadAuthenticatedFile
    ).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", {
        name: "switch-es",
      })
    );

    expect(
      await screen.findByText(
        "Tu cuenta no tiene permisos para descargar este CSV."
      )
    ).toBeInTheDocument();

    expect(
      downloadAuthenticatedFile
    ).toHaveBeenCalledTimes(1);
  });
});
