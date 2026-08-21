import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { I18nProvider } from "../../i18n";
import ComparisonAIAnalysisPanel from "./ComparisonAIAnalysisPanel";


const explanation = {
  provider: "mock",
  simulated: true,
  model: "local-comparative-mock-v1",
  cached: false,
  source: {
    student_code_sent: false,
    raw_csv_sent: false,
    browser_metrics_trusted: false,
    canonical_server_comparison: true,
  },
  content: {
    summary: "Síntesis comparativa.",
    patterns: [
      {
        metric: "DurationTime",
        text: "Patrón observado.",
      },
    ],
    tradeoffs: [
      {
        metrics: ["DurationTime", "IPC"],
        text: "Compensación observada.",
      },
    ],
    focus: [
      {
        metric: "IPC",
        text: "Foco sugerido.",
      },
    ],
    limitations: [
      "Limitación reportada.",
    ],
  },
};


function renderPanel(props = {}, language = "es") {
  const onGenerate = jest.fn();

  render(
    <I18nProvider initialLanguage={language}>
      <main className="comparison-page">
        <ComparisonAIAnalysisPanel
          explanation={null}
          loading={false}
          errorKey=""
          available
          unavailableKind=""
          onGenerate={onGenerate}
          metricLabel={(metric) =>
            metric === "DurationTime"
              ? "Tiempo de ejecución"
              : metric
          }
          {...props}
        />
      </main>
    </I18nProvider>
  );

  return onGenerate;
}


describe("ComparisonAIAnalysisPanel", () => {
  test("idle state exposes generation and privacy", () => {
    const onGenerate = renderPanel();

    expect(
      screen.getByRole("heading", {
        name: "Análisis comparativo asistido por IA",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/no recibe código fuente/i)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Generar análisis comparativo",
      })
    );

    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  test("renders the comparative output contract", () => {
    renderPanel({ explanation });

    expect(
      screen.getByText(
        "Respuesta simulada · modo desarrollo"
      )
    ).toBeInTheDocument();

    for (const name of [
      "Resumen",
      "Patrones observados",
      "Compensaciones observadas",
      "Qué conviene analizar",
      "Limitaciones",
    ]) {
      expect(
        screen.getByRole("heading", { name })
      ).toBeInTheDocument();
    }

    expect(
      screen.getByText(
        "Comparación reconstruida canónicamente en servidor"
      )
    ).toBeInTheDocument();
  });

  test("incompatible state disables generation", () => {
    renderPanel({
      available: false,
      unavailableKind: "incompatible",
    });

    expect(
      screen.getByText(
        "IA no disponible para esta comparación"
      )
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("button", {
        name: /Generar análisis comparativo/i,
      })
    ).not.toBeInTheDocument();
  });

  test("localizes the architecture in English", () => {
    renderPanel({}, "en");

    expect(
      screen.getByRole("heading", {
        name: "AI-assisted comparative analysis",
      })
    ).toBeInTheDocument();
  });
});
