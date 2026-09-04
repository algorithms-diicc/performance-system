import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
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
import RenderImage from "./RenderImage";

jest.mock("axios");

let mockLastPlotProps = null;
jest.mock("react-plotly.js", () => (props) => {
  mockLastPlotProps = props;
  return <div data-testid="plotly-chart" />;
});

jest.mock(
  "../components/ReproducibilityPanel",
  () => ({ codename }) => (
    <div data-testid="reproducibility-stub">
      {codename}
    </div>
  )
);

jest.mock("../utils/downloadAuthenticatedFile");

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
      cpu: {
        model: "Intel Core i5-9400",
      },
      backend: {
        name: "perf",
        version: "perf 6.8",
        requested_scope: "process",
      },
    },
  },
  processing: {},
  metrics: {
    DurationTime: {
      status: "available",
      points: [
        {
          input_size: 100,
          source: "student.cpp",
          median: 12.5,
          mean: 13,
          q1: 12,
          q3: 14,
          stddev: 1,
          samples_valid: 9,
          samples_total: 10,
          iqr_outliers_detected: 1,
        },
      ],
    },
    EnergyPkg: {
      status: "unsupported",
      availability: {
        rows_total: 10,
        unsupported: 10,
        provenance: "metric_availability_sidecar",
      },
      hardware_context: {
        event: "power/energy-pkg/",
        probe_state: "event_not_exposed",
        event_exposed: false,
      },
    },
  },
  analysis: {},
  pedagogy: {
    generation: {
      type: "deterministic_rules",
      uses_ai: false,
    },
    summary: {
      primary_metrics_available: [
        "DurationTime",
      ],
      highlights: [
        {
          metric: "DurationTime",
          kind: "trend",
          message_code: "trend",
          text:
            "Texto científico del backend preservado literalmente.",
        },
      ],
    },
    metrics: {
      DurationTime: {
        messages: [
          {
            metric: "DurationTime",
            kind: "snapshot",
            message_code: "snapshot",
            priority: "primary",
            text:
              "Texto científico del backend preservado literalmente.",
            evidence: {
              input_size: 100,
              median: 12.5,
              q1: 12,
              q3: 14,
              mean: 13,
              stddev: 1,
              coefficient_of_variation: 0.08,
            },
          },
          {
            metric: "DurationTime",
            kind: "trend",
            message_code: "trend",
            priority: "primary",
            text:
              "Texto científico del backend preservado literalmente.",
            evidence: {
              first: {
                input_size: 50,
                median: 6.25,
              },
              last: {
                input_size: 100,
                median: 12.5,
              },
              relative_change: 1,
              pairwise: {
                comparisons: 1,
                increasing: 1,
                decreasing: 0,
                unchanged: 0,
              },
            },
          },
          {
            metric: "DurationTime",
            kind: "outliers",
            message_code: "outliers_detected",
            priority: "secondary",
            text:
              "Texto científico del backend preservado literalmente.",
            evidence: {
              samples_evaluated: 10,
              iqr_outliers_detected: 1,
              iqr_outlier_rate: 0.1,
              iqr_diagnostic_groups: 1,
              groups_total: 1,
            },
          },
        ],
      },
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

const arrangeRequests = () => {
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
          input_size: 100,
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

describe("RenderImage scientific i18n", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLastPlotProps = null;
    arrangeRequests();
  });

  test("localizes metric chrome and Plotly presentation while preserving measured values and backend pedagogy", async () => {
    renderEnglish();

    expect(
      await screen.findByRole("heading", {
        name: "Execution exec70LCS",
      })
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("Execution time").length
    ).toBeGreaterThan(0);

    expect(
      screen.getByText("Guided interpretation")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "What the results show",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("What it represents")
    ).toBeInTheDocument();
    const evidenceDisclosures =
      screen.getAllByRole("button", {
        name: /What happened in this execution/i,
      });

    expect(
      evidenceDisclosures.length
    ).toBeGreaterThan(0);
    expect(
      evidenceDisclosures[0]
    ).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(evidenceDisclosures[0]);

    expect(
      evidenceDisclosures[0]
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText("Observed value")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Observed trend")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Variability")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /at the largest measured input size \(100\), the median was/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /A relative increase of 100/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Texto científico del backend preservado literalmente."
      )
    ).not.toBeInTheDocument();

    await waitFor(() =>
      expect(mockLastPlotProps).not.toBeNull()
    );

    expect(mockLastPlotProps.config).toEqual({
      responsive: true,
      displaylogo: false,
      toImageButtonOptions: {
        format: "png",
        filename:
          "performance-system-result-execution-time",
        scale: 2,
      },
    });
    expect(
      mockLastPlotProps.layout.paper_bgcolor
    ).toBeTruthy();
    expect(
      mockLastPlotProps.layout.paper_bgcolor
    ).not.toBe("rgba(0,0,0,0)");
    expect(
      mockLastPlotProps.layout.plot_bgcolor
    ).toBe(
      mockLastPlotProps.layout.paper_bgcolor
    );
    expect(
      mockLastPlotProps.layout.legend.bgcolor
    ).toBe(
      mockLastPlotProps.layout.paper_bgcolor
    );

    expect(
      mockLastPlotProps.layout.xaxis.title.text
    ).toBe("Input size");
    expect(
      mockLastPlotProps.data[0].y
    ).toEqual([12.5]);
    expect(
      mockLastPlotProps.data[0].error_y
    ).toMatchObject({
      array: [1.5],
      arrayminus: [0.5],
    });
    expect(
      mockLastPlotProps.data[0].hovertemplate
    ).toContain("Median: %{customdata[0]}");
    expect(
      mockLastPlotProps.data[0].hovertemplate
    ).toContain(
      "Numeric samples: %{customdata[6]}/%{customdata[7]}"
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Explain Execution time",
      })
    );

    expect(
      screen.getByText(
        /Total program execution duration in milliseconds\./i
      )
    ).toBeInTheDocument();

    expect(axios.post).not.toHaveBeenCalled();

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
        name: "Tiempo de ejecución",
      })
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Qué representa").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Tendencia observada").length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /en el mayor tamaño de entrada medido \(100\), la mediana fue/i
      ).length
    ).toBeGreaterThan(0);

    await waitFor(() =>
      expect(
        mockLastPlotProps.layout.xaxis.title.text
      ).toBe("Tamaño de entrada")
    );

    expect(
      mockLastPlotProps.config
        .toImageButtonOptions.filename
    ).toBe(
      "performance-system-result-tiempo-de-ejecucion"
    );
    expect(axios.get).toHaveBeenCalledTimes(4);
  });

  test("localizes hardware-backed metric unavailability from stable technical states", async () => {
    renderEnglish();

    await screen.findByRole("heading", {
      name: "Execution exec70LCS",
    });

    fireEvent.click(
      screen.getByRole("tab", {
        name: /Energy/i,
      })
    );

    expect(
      await screen.findByRole("heading", {
        name: "CPU package energy",
      })
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("Unavailable").length
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("Measurement context")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The perf backend in this environment does not expose power/energy-pkg/."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "10/10 samples did not have this event available in the measurement backend."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Unavailable · preserved provenance/i
      )
    ).toBeInTheDocument();
  });

  test(
    "requests individual AI analysis in the active language and identifies mock mode",
    async () => {
      axios.post.mockResolvedValue({
        data: {
          schema_version: "1.0",
          provider: "mock",
          simulated: true,
          generated_by_ai: false,
          language: "en",
          model: "local-deterministic-mock-v1",
          cached: false,
          content: {
            summary:
              "Mock summary from deterministic evidence.",
            observations: [
              {
                metric: "DurationTime",
                evidence_kind: "snapshot",
                text:
                  "Mock observation for execution time.",
              },
            ],
            limitations: [
              "One experimental limitation.",
            ],
            student_takeaway:
              "Inspect the evidence before drawing conclusions.",
          },
        },
      });

      renderEnglish();

      await screen.findByRole(
        "heading",
        {
          name: "Execution exec70LCS",
        }
      );

      fireEvent.click(
        screen.getByRole("button", {
          name: "Generate AI analysis",
        })
      );

      await waitFor(() =>
        expect(
          axios.post
        ).toHaveBeenCalledWith(
          expect.stringContaining(
            "api/executions/exec70LCS/ai-explanation"
          ),
          {
            force: false,
            language: "en",
          },
          {
            withCredentials: true,
          }
        )
      );

      expect(
        await screen.findByText(
          "Simulated response · development mode"
        )
      ).toBeInTheDocument();

      expect(
        screen.getByText(
          "Mock summary from deterministic evidence."
        )
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", {
          name: "switch-es",
        })
      );

      expect(
        await screen.findByRole("button", {
          name: "Generar análisis con IA",
        })
      ).toBeInTheDocument();

      await waitFor(() =>
        expect(
          screen.queryByText(
            "Mock summary from deterministic evidence."
          )
        ).not.toBeInTheDocument()
      );
    }
  );

});
