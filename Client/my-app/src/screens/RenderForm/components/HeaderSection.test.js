import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import HeaderSection from "./HeaderSection";

describe("HeaderSection onboarding", () => {
  test("links Nuevo análisis to the canonical examples section", () => {
    render(
      <MemoryRouter>
        <HeaderSection
          title="Nuevo análisis de rendimiento"
          subtitle="Configura tu experimento."
        />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("link", {
        name: /¿Necesitas un ejemplo\? Ver ejemplos de código/i,
      })
    ).toHaveAttribute("href", "/tutorial#ejemplos");
  });
});
