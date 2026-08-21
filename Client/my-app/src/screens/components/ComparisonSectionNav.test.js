import React from "react";
import {
  render,
  screen,
  within,
} from "@testing-library/react";

import { I18nProvider } from "../../i18n";
import ComparisonSectionNav from "./ComparisonSectionNav";


function renderNav(language = "es") {
  render(
    <I18nProvider initialLanguage={language}>
      <ComparisonSectionNav />
    </I18nProvider>
  );
}


describe("ComparisonSectionNav", () => {
  test("exposes the six comparison stages in Spanish", () => {
    renderNav();

    const nav = screen.getByRole("navigation", {
      name: "Secciones de la comparación",
    });

    [
      ["Implementaciones", "#comparison-implementations"],
      ["Resumen", "#comparison-summary"],
      ["Interpretación", "#comparison-interpretation"],
      ["Asistencia IA", "#comparison-ai"],
      ["Métricas", "#comparison-metrics"],
      ["Auditoría", "#comparison-audit"],
    ].forEach(([name, href]) => {
      expect(
        within(nav).getByRole("link", { name })
      ).toHaveAttribute("href", href);
    });
  });

  test("localizes the same architecture in English", () => {
    renderNav("en");

    const nav = screen.getByRole("navigation", {
      name: "Comparison sections",
    });

    expect(
      within(nav).getByRole("link", {
        name: "AI assistance",
      })
    ).toHaveAttribute("href", "#comparison-ai");
  });
});
