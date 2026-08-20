import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import LanguageSwitcher from "./LanguageSwitcher";
import {
  I18nProvider,
  LANGUAGE_STORAGE_KEY,
} from "../i18n";

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.setAttribute(
      "lang",
      "es"
    );
  });

  test("changes language, html lang and persisted preference", () => {
    render(
      <I18nProvider initialLanguage="es">
        <LanguageSwitcher />
      </I18nProvider>
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Cambiar idioma a Inglés/i,
      })
    );

    expect(
      screen.getByRole("group", {
        name: /Language/i,
      })
    ).toBeInTheDocument();

    expect(
      document.documentElement
        .getAttribute("lang")
    ).toBe("en");

    expect(
      window.localStorage.getItem(
        LANGUAGE_STORAGE_KEY
      )
    ).toBe("en");

    expect(
      screen.getByRole("button", {
        name: /Switch language to English/i,
      })
    ).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
