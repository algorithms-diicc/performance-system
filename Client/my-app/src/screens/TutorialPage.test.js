import React from "react";
import {
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

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

const renderTutorial = ({
  currentUser = STUDENT,
  route = "/tutorial",
} = {}) => render(
  <MemoryRouter initialEntries={[route]}>
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

  test("documents C, C++, mixed, and the three canonical example downloads", () => {
    const { container } = renderTutorial({ route: "/tutorial#ejemplos" });

    expect(container.querySelector("#ejemplos")).toBeInTheDocument();
    expect(screen.getByText("insertion_sort.c")).toBeInTheDocument();
    expect(screen.getByText("merge_sort.cpp")).toBeInTheDocument();
    expect(
      screen.getByText("longest_common_subsequence.c")
    ).toBeInTheDocument();
    expect(
      screen.getByText("blocked_matrix_multiplication.cpp")
    ).toBeInTheDocument();
    expect(screen.getByText("Mixed C + C++")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: "Descargar ejemplo SIZE" })
    ).toHaveAttribute("href", "/tutorial-codigos/size_template.zip");
    expect(
      screen.getByRole("link", { name: "Descargar ejemplo LCS" })
    ).toHaveAttribute("href", "/tutorial-codigos/lcs_template.zip");
    expect(
      screen.getByRole("link", { name: "Descargar ejemplo CAMM" })
    ).toHaveAttribute("href", "/tutorial-codigos/camm_template.zip");

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
