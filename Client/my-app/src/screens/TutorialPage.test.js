import React from "react";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

import TutorialPage from "./TutorialPage";

const STUDENT = {
  id: 21,
  role_name: "Student",
};

const TEACHER = {
  id: 22,
  role_name: "Teacher",
};

const ADMIN = {
  id: 23,
  role_name: "Admin",
};

const LocationProbe = () => {
  const location = useLocation();

  return (
    <output data-testid="tutorial-location">
      {`${location.pathname}${location.search}`}
    </output>
  );
};

const renderTutorial = ({
  currentUser = STUDENT,
  route = "/tutorial",
} = {}) => render(
  <MemoryRouter initialEntries={[route]}>
    <LocationProbe />
    <TutorialPage currentUser={currentUser} />
  </MemoryRouter>
);

describe("TutorialPage Iteration 9", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = jest.fn();
  });

  test("a student sees exactly three stages and no teacher content", () => {
    const { container } = renderTutorial();
    const navigation = screen.getByTestId("tutorial-primary-navigation");
    const links = within(navigation).getAllByRole("link");

    expect(links).toHaveLength(3);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#crear",
      "#resultados",
      "#comparar",
    ]);
    expect(container.querySelector("#supervisar")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("tutorial-shot-teacher-course")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Abrir Supervisión" })
    ).not.toBeInTheDocument();
  });


  test("documents AUTO, PINNED, operational policy, availability, and student academic context", () => {
    renderTutorial();

    const operational = screen.getByTestId(
      "tutorial-final-edition-operational-contract"
    );
    const technicalDetails = operational.closest("details");
    const technicalSummary = screen
      .getByText("Ver detalles técnicos")
      .closest("summary");

    expect(technicalDetails).not.toBeNull();
    expect(technicalSummary).not.toBeNull();
    expect(technicalDetails).not.toHaveAttribute("open");
    expect(
      screen.getByText(
        "AUTO, rangos operacionales y disponibilidad del nodo."
      )
    ).toBeInTheDocument();

    fireEvent.click(technicalSummary);

    expect(technicalDetails).toHaveAttribute("open");

    expect(
      within(operational).getByRole("heading", {
        name: "AUTO es la opción recomendada",
      })
    ).toBeInTheDocument();

    expect(operational).toHaveTextContent("PINNED");
    expect(operational).toHaveTextContent(/cola FIFO/i);
    expect(operational).toHaveTextContent(
      /policy define el rango ejecutable/i
    );

    expect(
      screen.getByText(
        /curso activo o elegir explícitamente un análisis personal/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: "Abrir Protocolos",
      })
    ).toHaveAttribute("href", "/protocols");
  });

  test("offers three guided comparisons without prescribing conclusions", () => {
    const { container } = renderTutorial({
      route: "/tutorial#ejemplos",
    });

    expect(container.querySelector("#ejemplos")).toBeInTheDocument();

    const compactFilenames = Array.from(
      container.querySelectorAll(
        ".tutorial-example-files code"
      )
    ).map((element) => element.textContent);

    expect(compactFilenames).toEqual([
      "lcs_full_matrix.cpp",
      "lcs_two_rows.cpp",
      "camm_naive.cpp",
      "camm_blocked.cpp",
      "size_duplicate_quadratic.c",
      "size_duplicate_sort.cpp",
    ]);

    expect(screen.getAllByText("C++")).toHaveLength(2);
    expect(screen.getByText("C + C++")).toBeInTheDocument();

    [
      [
        "Descargar comparación LCS",
        "/tutorial-codigos/performance-system-demo-lcs.zip",
      ],
      [
        "Descargar comparación CAMM",
        "/tutorial-codigos/performance-system-demo-camm.zip",
      ],
      [
        "Descargar comparación SIZE",
        "/tutorial-codigos/performance-system-demo-size.zip",
      ],
    ].forEach(([name, href]) => {
      const link = screen.getByRole("link", { name });

      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("download");
    });

    const prepareLinks = screen.getAllByRole(
      "link",
      { name: /Preparar análisis/ }
    );

    expect(
      prepareLinks.map((link) => link.getAttribute("href"))
    ).toEqual([
      "/?starter=lcs",
      "/?starter=camm",
      "/?starter=size",
    ]);

    const guides = [
      screen.getByTestId("tutorial-example-guide-lcs"),
      screen.getByTestId("tutorial-example-guide-camm"),
      screen.getByTestId("tutorial-example-guide-size"),
    ];

    guides.forEach((guide) => {
      expect(guide).not.toHaveAttribute("open");
    });

    const lcsSummary = within(guides[0])
      .getByText("Explorar LCS")
      .closest("summary");

    fireEvent.click(lcsSummary);

    expect(guides[0]).toHaveAttribute("open");
    expect(
      within(guides[0]).getByRole("heading", {
        name: "Estrategias incluidas",
      })
    ).toBeInTheDocument();
    expect(
      within(guides[0]).getByRole("heading", {
        name: "Preguntas para formular una hipótesis",
      })
    ).toBeInTheDocument();
    expect(
      within(guides[0]).getByText(
        /conserva únicamente la fila anterior y la fila actual/i
      )
    ).toBeInTheDocument();
    expect(
      within(guides[0]).getByText(
        /qué métricas podrían reflejar la diferencia/i
      )
    ).toBeInTheDocument();

    fireEvent.click(prepareLinks[0]);

    expect(
      screen.getByTestId("tutorial-location")
    ).toHaveTextContent("/?starter=lcs");

    const exampleCards = Array.from(
      container.querySelectorAll(".tutorial-example-card")
    );

    expect(exampleCards.map((card) =>
      within(card).getByText(/^(LCS|CAMM|SIZE)$/).textContent
    )).toEqual(["LCS", "CAMM", "SIZE"]);

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/^Memoria$/i)).not.toBeInTheDocument();
  });

  test.each([
    ["Teacher", TEACHER],
    ["Admin", ADMIN],
  ])("%s sees the fourth pedagogical stage and teacher CTA", (_role, user) => {
    const { container } = renderTutorial({ currentUser: user });
    const navigation = screen.getByTestId("tutorial-primary-navigation");

    expect(within(navigation).getAllByRole("link")).toHaveLength(4);
    expect(
      within(navigation).getByRole("link", { name: /Supervisar un curso/ })
    ).toHaveAttribute("href", "#supervisar");
    expect(container.querySelector("#supervisar")).toBeInTheDocument();
    expect(screen.getByTestId("tutorial-shot-teacher-course")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir Supervisión" })
    ).toHaveAttribute("href", "/teacher/courses");

    expect(
      screen.getByText(
        /Protocolos experimentales del curso/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /no queda ligado a un nodo concreto/i
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Administración/i })
    ).not.toBeInTheDocument();
  });

  test("opens the accessible lightbox and closes it by button or Escape", () => {
    renderTutorial();
    const expand = screen.getAllByRole("button", {
      name: /Ampliar captura:/,
    })[0];

    fireEvent.click(expand);
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    fireEvent.click(
      screen.getByRole("button", { name: "Cerrar captura ampliada" })
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(expand);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test.each([
    ["#crear", STUDENT],
    ["#resultados", STUDENT],
    ["#comparar", STUDENT],
    ["#supervisar", TEACHER],
    ["#ejemplos", STUDENT],
  ])("keeps hash navigation operational for %s", (hash, currentUser) => {
    Element.prototype.scrollIntoView.mockClear();
    renderTutorial({ currentUser, route: `/tutorial${hash}` });

    expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
