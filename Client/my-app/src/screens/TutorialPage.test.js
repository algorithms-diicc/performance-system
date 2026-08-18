import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import TutorialPage from "./TutorialPage";

describe("TutorialPage starter examples", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  test("publishes one canonical ZIP for each supported benchmark", () => {
    const { container } = render(
      <MemoryRouter initialEntries={["/tutorial#ejemplos"]}>
        <TutorialPage />
      </MemoryRouter>
    );

    expect(container.querySelector("#ejemplos")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Algoritmos clásicos listos para medir",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Descargar ejemplo SIZE",
      })
    ).toHaveAttribute(
      "href",
      "/tutorial-codigos/size_template.zip"
    );

    expect(
      screen.getByRole("link", {
        name: "Descargar ejemplo LCS",
      })
    ).toHaveAttribute(
      "href",
      "/tutorial-codigos/lcs_template.zip"
    );

    expect(
      screen.getByRole("link", {
        name: "Descargar ejemplo CAMM",
      })
    ).toHaveAttribute(
      "href",
      "/tutorial-codigos/camm_template.zip"
    );

    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  test("explains the multi-CPP SIZE example", () => {
    render(
      <MemoryRouter>
        <TutorialPage />
      </MemoryRouter>
    );

    expect(screen.getByText("insertion_sort.cpp")).toBeInTheDocument();
    expect(screen.getByText("merge_sort.cpp")).toBeInTheDocument();
    expect(
      screen.getByText(/implementaciones independientes/i)
    ).toBeInTheDocument();
  });
});
