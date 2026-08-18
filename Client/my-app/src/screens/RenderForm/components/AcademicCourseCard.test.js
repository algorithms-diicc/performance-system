import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import AcademicCourseCard from "./AcademicCourseCard";

const courseA = {
  id: 9,
  code: "CC4102",
  name: "Diseño y Análisis de Algoritmos",
  academicYear: 2026,
  academicTerm: 2,
  teacher: {
    fullName: "Grace Hopper",
  },
};

const baseProps = {
  loading: false,
  error: "",
  selectedCourseId: "",
  selectionRequired: false,
  onCourseChange: jest.fn(),
  onRetry: jest.fn(),
};

describe("AcademicCourseCard onboarding", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("shows an explicit personal context when there are no active courses", () => {
    render(
      <AcademicCourseCard
        {...baseProps}
        courses={[]}
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Sin curso asociado",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Actualmente no tienes cursos activos.*análisis personal igualmente/i
      )
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  test("keeps the canonical automatic presentation for one active course", () => {
    render(
      <AcademicCourseCard
        {...baseProps}
        courses={[courseA]}
        selectedCourseId="9"
      />
    );

    expect(
      screen.getByRole("heading", {
        name: "Curso asociado",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Automático")).toBeInTheDocument();
    expect(screen.getByText("CC4102 · 2026-2")).toBeInTheDocument();
    expect(
      screen.getByText("Diseño y Análisis de Algoritmos")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Profesor: Grace Hopper")
    ).toBeInTheDocument();
  });

  test("several courses expose the controlled required selector", () => {
    const onCourseChange = jest.fn();
    const courseB = {
      ...courseA,
      id: 12,
      code: "CC5101",
      name: "Sistemas Paralelos",
      academicTerm: 1,
    };

    render(
      <AcademicCourseCard
        {...baseProps}
        courses={[courseA, courseB]}
        selectedCourseId="12"
        selectionRequired
        onCourseChange={onCourseChange}
      />
    );

    const selector = screen.getByRole("combobox", {
      name: "Curso de esta entrega",
    });

    expect(selector).toHaveValue("12");
    expect(selector).toBeRequired();
    expect(screen.getByText("Obligatorio")).toBeInTheDocument();

    fireEvent.change(selector, {
      target: { value: "9" },
    });

    expect(onCourseChange).toHaveBeenCalledWith("9");
  });
});
