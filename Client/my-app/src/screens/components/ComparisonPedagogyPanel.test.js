import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import { I18nProvider } from "../../i18n";
import ComparisonPedagogyPanel from "./ComparisonPedagogyPanel";

const series = (
  codename,
  sourceFilename,
  firstMedian,
  lastMedian
) => ({
  public_id: `public-${codename}`,
  codename,
  source_filename: sourceFilename,
  median: lastMedian,
  mean: lastMedian + 0.1,
  q1: lastMedian - 1,
  q3: lastMedian + 1,
  stddev: 0.5,
  first: {
    input_size: 100,
    median: firstMedian,
    mean: firstMedian + 0.1,
  },
  last: {
    input_size: 300,
    median: lastMedian,
    mean: lastMedian + 0.1,
  },
  median_direction:
    lastMedian > firstMedian
      ? "increased"
      : lastMedian < firstMedian
        ? "decreased"
        : "unchanged",
});

const pedagogy = {
  version: "1.0",
  generation: {
    type: "deterministic_rules",
    uses_ai: false,
    statistics_recomputed: false,
    presentation_contract:
      "language-neutral-comparison-evidence-v1",
  },
  scope: {
    status: "LIMITED",
    common_input_sizes: [100, 200, 300],
    common_metrics: ["DurationTime", "IPC"],
    target_metric_count: 5,
  },
  metrics: {
    DurationTime: {
      metric: "DurationTime",
      unit: "ms",
      common_input_sizes: [100, 200, 300],
      observation: {
        input_size: 300,
        series: [
          series("alpha", "alpha.cpp", 10, 30),
          series("beta", "beta.cpp", 20, 40),
        ],
      },
      trend: {
        points_available: 3,
        series: [
          series("alpha", "alpha.cpp", 10, 30),
          series("beta", "beta.cpp", 20, 40),
        ],
      },
      variability: {
        input_size: 300,
        series: [
          series("alpha", "alpha.cpp", 10, 30),
          series("beta", "beta.cpp", 20, 40),
        ],
      },
      limitations: [],
    },
    IPC: {
      metric: "IPC",
      unit: "ratio",
      common_input_sizes: [100, 200],
      observation: {
        input_size: 200,
        series: [
          series("alpha", "alpha.cpp", 1, 2),
          series("beta", "beta.cpp", 1.2, 2.2),
        ],
      },
      trend: {
        points_available: 2,
        series: [
          series("alpha", "alpha.cpp", 1, 2),
          series("beta", "beta.cpp", 1.2, 2.2),
        ],
      },
      variability: {
        input_size: 200,
        series: [
          series("alpha", "alpha.cpp", 1, 2),
          series("beta", "beta.cpp", 1.2, 2.2),
        ],
      },
      limitations: ["METRIC_PARTIAL_COVERAGE"],
    },
  },
  limitations: {
    issues: [
      {
        severity: "warning",
        code: "PARTIAL_INPUT_OVERLAP",
        dimension: "inputSizes",
        metric: null,
      },
      {
        severity: "warning",
        code: "METRIC_PARTIAL_COVERAGE",
        dimension: "metrics",
        metric: "IPC",
      },
    ],
    excluded_metrics: [
      {
        metric: "EnergyPkg",
        reason_code: "TARGET_METRIC_UNAVAILABLE",
      },
    ],
  },
};

const renderPanel = (value = pedagogy, language = "es") =>
  render(
    <I18nProvider initialLanguage={language}>
      <ComparisonPedagogyPanel pedagogy={value} />
    </I18nProvider>
  );

describe("ComparisonPedagogyPanel", () => {
  test("renders deterministic contextual evidence without ranking", () => {
    renderPanel();

    expect(
      screen.getByRole("heading", {
        name: "Lectura comparativa de la evidencia",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Reglas determinísticas")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Medianas reportadas en InputSize 300")
    ).toBeInTheDocument();
    expect(screen.getByText("30 ms")).toBeInTheDocument();
    expect(
      screen.getByText("Alcance de esta lectura")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Energía del paquete CPU/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No asigna un ganador global/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Entre InputSize 100 y 300/)
    ).not.toBeInTheDocument();
  });

  test("reveals trend, variability and metric-specific limitations progressively", () => {
    renderPanel();

    const buttons = screen.getAllByRole("button", {
      name: /Evidencia y contexto/,
    });
    fireEvent.click(buttons[1]);

    expect(
      screen.getAllByText(/Entre InputSize 100 y 300/)
    ).toHaveLength(2);
    expect(
      screen.getAllByText(/Q1–Q3/)
    ).toHaveLength(2);
    expect(
      screen.getByText(
        /Esta métrica cubre 2 de 3 InputSize comunes/
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/1 advertencia específica/)
    ).toBeInTheDocument();
  });

  test("does not describe a scaling trend for one shared input size", () => {
    const singleInput = JSON.parse(JSON.stringify(pedagogy));
    singleInput.scope.common_input_sizes = [200];
    singleInput.metrics.DurationTime.common_input_sizes = [200];
    singleInput.metrics.DurationTime.trend.points_available = 1;

    renderPanel(singleInput);
    fireEvent.click(
      screen.getAllByRole("button", {
        name: /Evidencia y contexto/,
      })[0]
    );

    expect(
      screen.getByText(/Sólo existe un InputSize común/)
    ).toBeInTheDocument();
  });

  test("localizes the same structured contract in English", () => {
    renderPanel(pedagogy, "en");

    expect(
      screen.getByRole("heading", {
        name: "Comparative reading of the evidence",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Deterministic rules")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Scope of this reading")
    ).toBeInTheDocument();
  });
});
