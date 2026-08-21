import React from "react";
import { render, screen } from "@testing-library/react";

import { I18nProvider } from "../../i18n";
import ResultsSectionNav from "./ResultsSectionNav";

const renderNav = (language) =>
  render(
    <I18nProvider initialLanguage={language}>
      <ResultsSectionNav />
    </I18nProvider>
  );

describe("ResultsSectionNav", () => {
  test("exposes the four dashboard anchors in English", () => {
    renderNav("en");

    expect(
      screen.getByRole("navigation", {
        name: "Result sections",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Summary" })
    ).toHaveAttribute("href", "#results-summary");
    expect(
      screen.getByRole("link", { name: "Interpretation" })
    ).toHaveAttribute("href", "#results-interpretation");
    expect(
      screen.getByRole("link", { name: "Metrics" })
    ).toHaveAttribute("href", "#results-metrics");
    expect(
      screen.getByRole("link", { name: "Reproducibility" })
    ).toHaveAttribute("href", "#results-reproducibility");
  });

  test("localizes the same navigation in Spanish", () => {
    renderNav("es");

    expect(
      screen.getByRole("navigation", {
        name: "Secciones del resultado",
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Resumen" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Interpretación" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Métricas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reproducibilidad" })).toBeInTheDocument();
  });
});
