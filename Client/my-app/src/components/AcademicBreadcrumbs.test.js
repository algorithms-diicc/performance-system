import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AcademicBreadcrumbs from "./AcademicBreadcrumbs";

const student = { role_name: "Student" };
const teacher = { role_name: "Teacher" };
const admin = { role_name: "Admin" };
const course = {
  id: 9,
  code: "CC4102",
  name: "Diseño y Análisis de Algoritmos",
};

const renderBreadcrumbs = (props) => {
  render(
    <MemoryRouter>
      <AcademicBreadcrumbs {...props} />
    </MemoryRouter>
  );
  return screen.getByRole("navigation", {
    name: "Ruta de navegación",
  });
};

describe("AcademicBreadcrumbs", () => {
  test("builds the Student Submission route", () => {
    const navigation = renderBreadcrumbs({
      currentUser: student,
      page: "submission",
      submissionId: 7,
    });

    expect(
      within(navigation).getByRole("link", { name: "Mi perfil" })
    ).toHaveAttribute("href", "/profile");
    expect(within(navigation).getByText("Experimento #7")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("builds the Student Result route with a human source filename", () => {
    const navigation = renderBreadcrumbs({
      currentUser: student,
      page: "result",
      submissionId: 7,
      sourceFilename: "solucion.cpp",
    });

    expect(
      within(navigation).getByRole("link", {
        name: "Experimento #7",
      })
    ).toHaveAttribute("href", "/submissions/7");
    expect(within(navigation).getByText("solucion.cpp")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("builds the Teacher Submission route through its course", () => {
    const navigation = renderBreadcrumbs({
      currentUser: teacher,
      page: "submission",
      submissionId: 7,
      course,
      courseId: 9,
    });

    expect(
      within(navigation).getByRole("link", { name: "Supervisión" })
    ).toHaveAttribute("href", "/teacher/courses");
    expect(
      within(navigation).getByRole("link", {
        name: "CC4102 · Diseño y Análisis de Algoritmos",
      })
    ).toHaveAttribute("href", "/teacher/courses/9");
    expect(within(navigation).getByText("Experimento #7")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("builds the Teacher Result route through course and Submission", () => {
    const navigation = renderBreadcrumbs({
      currentUser: teacher,
      page: "result",
      submissionId: 7,
      sourceFilename: "solucion.cpp",
      course,
      courseId: 9,
    });

    expect(
      within(navigation).getByRole("link", {
        name: "CC4102 · Diseño y Análisis de Algoritmos",
      })
    ).toHaveAttribute("href", "/teacher/courses/9");
    expect(
      within(navigation).getByRole("link", {
        name: "Experimento #7",
      })
    ).toHaveAttribute("href", "/submissions/7");
    expect(within(navigation).getByText("solucion.cpp")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("builds the Admin Submission route without owner identity", () => {
    const navigation = renderBreadcrumbs({
      currentUser: admin,
      page: "submission",
      submissionId: 7,
    });

    expect(
      within(navigation).getByRole("link", { name: "Administración" })
    ).toHaveAttribute("href", "/admin");
    expect(
      within(navigation).getByRole("link", { name: "Usuarios" })
    ).toHaveAttribute("href", "/admin/users");
    expect(within(navigation).getByText("Experimento #7")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("builds the Admin course Submission route through supervision", () => {
    const navigation = renderBreadcrumbs({
      currentUser: admin,
      page: "submission",
      submissionId: 7,
      course,
      courseId: 9,
    });

    expect(
      within(navigation).getByRole("link", { name: "Supervisión" })
    ).toHaveAttribute("href", "/teacher/courses");
    expect(
      within(navigation).getByRole("link", {
        name: "CC4102 · Diseño y Análisis de Algoritmos",
      })
    ).toHaveAttribute("href", "/teacher/courses/9");
    expect(
      within(navigation).queryByRole("link", {
        name: "Administración",
      })
    ).not.toBeInTheDocument();
    expect(within(navigation).getByText("Experimento #7")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("builds the Admin Result route without an owner link", () => {
    const navigation = renderBreadcrumbs({
      currentUser: admin,
      page: "result",
      submissionId: 7,
      sourceFilename: "solucion.cpp",
    });

    expect(
      within(navigation).getByRole("link", { name: "Usuarios" })
    ).toHaveAttribute("href", "/admin/users");
    expect(
      within(navigation).getByRole("link", {
        name: "Experimento #7",
      })
    ).toHaveAttribute("href", "/submissions/7");
    expect(navigation).not.toHaveTextContent("owner");
  });

  test("Teacher without course degrades without inventing a course route", () => {
    const navigation = renderBreadcrumbs({
      currentUser: teacher,
      page: "submission",
      submissionId: 7,
    });

    expect(within(navigation).getAllByRole("link")).toHaveLength(1);
    expect(navigation).not.toHaveTextContent("Curso #");
    expect(navigation).toHaveTextContent("Supervisión");
    expect(navigation).toHaveTextContent("Experimento #7");
  });

  test("uses Resultado when the source filename is absent", () => {
    const navigation = renderBreadcrumbs({
      currentUser: student,
      page: "result",
      submissionId: 7,
      sourceFilename: null,
    });

    expect(within(navigation).getByText("Resultado")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test("reduces a source path to its safe visible filename", () => {
    const navigation = renderBreadcrumbs({
      currentUser: student,
      page: "result",
      submissionId: 7,
      sourceFilename: "private/nested/solucion.cpp",
    });

    expect(within(navigation).getByText("solucion.cpp")).toHaveAttribute(
      "aria-current",
      "page"
    );
    expect(navigation).not.toHaveTextContent("private/nested");
  });

  test("marks only the final crumb as the current page", () => {
    const navigation = renderBreadcrumbs({
      currentUser: teacher,
      page: "result",
      submissionId: 7,
      sourceFilename: "solucion.cpp",
      course,
      courseId: 9,
    });

    expect(
      navigation.querySelectorAll('[aria-current="page"]')
    ).toHaveLength(1);
  });

  test("uses deterministic links and never encodes the codename as a label", () => {
    const navigation = renderBreadcrumbs({
      currentUser: admin,
      page: "result",
      submissionId: 7,
      sourceFilename: "solucion.cpp",
    });

    expect(
      within(navigation)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href"))
    ).toEqual(["/admin", "/admin/users", "/submissions/7"]);
    expect(navigation).not.toHaveTextContent("exec70LCS");
  });

  test("same-Submission comparison links to the experiment", () => {
    const navigation = renderBreadcrumbs({
      currentUser: student,
      page: "comparison",
      submissionId: 7,
    });

    expect(
      within(navigation).getByRole("link", { name: "Experimento #7" })
    ).toHaveAttribute("href", "/submissions/7");
    expect(within(navigation).getByText("Comparación")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test.each([
    [student, "Mi perfil", "/profile"],
    [teacher, "Supervisión", "/teacher/courses"],
    [admin, "Usuarios", "/admin/users"],
  ])(
    "mixed-Submission comparison uses the role fallback without owner identity",
    (currentUser, label, href) => {
      const navigation = renderBreadcrumbs({
        currentUser,
        page: "comparison",
      });

      expect(within(navigation).getByRole("link", { name: label })).toHaveAttribute(
        "href",
        href
      );
      expect(within(navigation).getByText("Comparación")).toHaveAttribute(
        "aria-current",
        "page"
      );
      expect(navigation).not.toHaveTextContent(/propietario|owner|usuario #/i);
    }
  );
});
