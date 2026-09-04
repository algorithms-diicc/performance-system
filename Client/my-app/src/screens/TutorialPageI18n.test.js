import React from "react";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { I18nProvider, useI18n } from "../i18n";
import TutorialPage from "./TutorialPage";

const TEACHER = {
  id: 30,
  role_name: "Teacher",
};

const LanguageControl = () => {
  const { setLanguage } = useI18n();

  return (
    <button type="button" onClick={() => setLanguage("es")}>
      switch-es
    </button>
  );
};

const renderBilingualTutorial = () => render(
  <I18nProvider initialLanguage="en">
    <LanguageControl />
    <MemoryRouter initialEntries={["/tutorial#ejemplos"]}>
      <TutorialPage currentUser={TEACHER} />
    </MemoryRouter>
  </I18nProvider>
);

describe("TutorialPage Iteration 9 i18n", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  test("localizes navigation, captions, and compatibility semantics", () => {
    renderBilingualTutorial();
    const navigation = screen.getByTestId("tutorial-primary-navigation");

    expect(
      screen.getByRole("heading", { name: "From code to performance evidence" })
    ).toBeInTheDocument();
    expect(
      within(navigation).getByRole("link", { name: /Create an experiment/ })
    ).toHaveAttribute("href", "#crear");
    expect(
      within(navigation).getByRole("link", { name: /Supervise a course/ })
    ).toHaveAttribute("href", "#supervisar");
    expect(screen.getByRole("heading", { name: "Limited" })).toBeInTheDocument();
    expect(
      screen.getByText(/Each source preserves its own language, compiler, execution, and result/)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "switch-es" }));

    expect(
      screen.getByRole("heading", { name: "De código a evidencia de rendimiento" })
    ).toBeInTheDocument();
    expect(
      within(navigation).getByRole("link", { name: /Crear un experimento/ })
    ).toHaveAttribute("href", "#crear");
    expect(
      within(navigation).getByRole("link", { name: /Supervisar un curso/ })
    ).toHaveAttribute("href", "#supervisar");
    expect(
      screen.getByRole("heading", { name: "Con limitaciones" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cada fuente conserva lenguaje, compilador, ejecución y resultado propios/)
    ).toBeInTheDocument();
  });

  test("switches all seven visible screenshots from English to Spanish assets", () => {
    renderBilingualTutorial();

    const englishImages = screen.getAllByTestId(/^tutorial-image-/);
    expect(englishImages).toHaveLength(7);
    englishImages.forEach((image) => {
      expect(image.getAttribute("src")).toMatch(/-en\.png$/);
    });

    fireEvent.click(screen.getByRole("button", { name: "switch-es" }));

    const spanishImages = screen.getAllByTestId(/^tutorial-image-/);
    expect(spanishImages).toHaveLength(7);
    spanishImages.forEach((image) => {
      expect(image.getAttribute("src")).toMatch(/-es\.png$/);
    });
  });

  test("keeps technical identifiers canonical in both languages", () => {
    renderBilingualTutorial();

    expect(screen.getAllByText("C / gcc").length).toBeGreaterThan(0);
    expect(screen.getAllByText("C++ / g++").length).toBeGreaterThan(0);
    expect(screen.getByText("C · gcc · -O3")).toBeInTheDocument();
    expect(screen.getByText("perf · gcc 9.4.0")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "switch-es" }));

    expect(screen.getAllByText("C / gcc").length).toBeGreaterThan(0);
    expect(screen.getAllByText("C++ / g++").length).toBeGreaterThan(0);
    expect(screen.getByText("C · gcc · -O3")).toBeInTheDocument();
    expect(screen.getByText("perf · gcc 9.4.0")).toBeInTheDocument();
  });


  test("localizes the Final Edition operational and protocol guidance", () => {
    renderBilingualTutorial();

    const technicalDetails = screen
      .getByText("View technical details")
      .closest("details");
    const technicalSummary = screen
      .getByText("View technical details")
      .closest("summary");

    expect(technicalDetails).not.toHaveAttribute("open");
    fireEvent.click(technicalSummary);
    expect(technicalDetails).toHaveAttribute("open");

    expect(
      screen.getByRole("heading", {
        name: "AUTO is the recommended option",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /PINNED is an advanced option/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Course experimental protocols/i
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "switch-es",
      })
    );

    expect(
      screen.getByRole("heading", {
        name: "AUTO es la opción recomendada",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /PINNED es una opción avanzada/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Protocolos experimentales del curso/i
      )
    ).toBeInTheDocument();
  });

  test("localizes guided comparison exploration", () => {
    renderBilingualTutorial();

    const lcsGuide = screen.getByTestId(
      "tutorial-example-guide-lcs"
    );

    expect(
      screen.getByRole("heading", {
        name: "Three cases for forming and testing hypotheses",
      })
    ).toBeInTheDocument();

    const englishSummary = within(lcsGuide)
      .getByText("Explore LCS")
      .closest("summary");

    expect(lcsGuide).not.toHaveAttribute("open");
    fireEvent.click(englishSummary);
    expect(lcsGuide).toHaveAttribute("open");

    expect(
      within(lcsGuide).getByRole("heading", {
        name: "Questions for forming a hypothesis",
      })
    ).toBeInTheDocument();
    expect(
      within(lcsGuide).getByText(
        /which metrics might reflect their different storage requirements/i
      )
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "switch-es",
      })
    );

    expect(
      screen.getByRole("heading", {
        name: "Tres casos para formular y contrastar hipótesis",
      })
    ).toBeInTheDocument();
    expect(
      within(lcsGuide).getByText("Explorar LCS")
    ).toBeInTheDocument();
    expect(lcsGuide).toHaveAttribute("open");
    expect(
      within(lcsGuide).getByRole("heading", {
        name: "Preguntas para formular una hipótesis",
      })
    ).toBeInTheDocument();
    expect(
      within(lcsGuide).getByText(
        /qué métricas podrían reflejar la diferencia en almacenamiento/i
      )
    ).toBeInTheDocument();
  });

});
