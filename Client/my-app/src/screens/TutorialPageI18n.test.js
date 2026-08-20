import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  MemoryRouter,
} from "react-router-dom";

import {
  I18nProvider,
  useI18n,
} from "../i18n";

import TutorialPage from "./TutorialPage";

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

describe("TutorialPage i18n", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  test(
    "localizes the guide while preserving canonical example downloads",
    () => {
      render(
        <I18nProvider initialLanguage="en">
          <LanguageControl />
          <MemoryRouter initialEntries={["/tutorial#ejemplos"]}>
            <TutorialPage />
          </MemoryRouter>
        </I18nProvider>
      );

      expect(
        screen.getByRole("heading", {
          name: "How Performance System works",
        })
      ).toBeInTheDocument();

      expect(
        screen.getByRole("heading", {
          name: "Classic algorithms ready to measure",
        })
      ).toBeInTheDocument();

      expect(
        screen.getByRole("link", {
          name: "Download SIZE example",
        })
      ).toHaveAttribute(
        "href",
        "/tutorial-codigos/size_template.zip"
      );

      expect(
        screen.getByRole("link", {
          name: "Download LCS example",
        })
      ).toHaveAttribute(
        "href",
        "/tutorial-codigos/lcs_template.zip"
      );

      expect(
        screen.getByRole("link", {
          name: "Download CAMM example",
        })
      ).toHaveAttribute(
        "href",
        "/tutorial-codigos/camm_template.zip"
      );

      expect(
        Element.prototype.scrollIntoView
      ).toHaveBeenCalled();
    }
  );

  test(
    "reactively localizes screenshot accessibility text while reusing the same asset",
    () => {
      render(
        <I18nProvider initialLanguage="en">
          <LanguageControl />
          <MemoryRouter>
            <TutorialPage />
          </MemoryRouter>
        </I18nProvider>
      );

      const englishImage = screen.getByRole("img", {
        name: "ZIP file selected in the new analysis form",
      });

      const source = englishImage.getAttribute("src");

      expect(
        screen.getByText(
          "The selected file must contain at least one .cpp source file."
        )
      ).toBeInTheDocument();

      fireEvent.click(
        screen.getByRole("button", {
          name: "switch-es",
        })
      );

      expect(
        screen.getByRole("heading", {
          name: "Cómo funciona Performance System",
        })
      ).toBeInTheDocument();

      const spanishImage = screen.getByRole("img", {
        name: "Archivo ZIP seleccionado en el formulario de nuevo análisis",
      });

      expect(
        spanishImage.getAttribute("src")
      ).toBe(source);

      expect(
        screen.getByText(
          "El archivo seleccionado debe contener al menos una fuente .cpp."
        )
      ).toBeInTheDocument();
    }
  );
});
