import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  MemoryRouter,
} from "react-router-dom";

import TeacherCourseAttention, {
  buildAcademicAttention,
} from "./TeacherCourseAttention";


const students = [
  {
    userId: 1,
    fullName: "Sin Ejecuciones",
    attention: {
      noExecutions: true,
      failedMoreThanCompleted: false,
    },
    lastActivityAt: null,
  },
  {
    userId: 2,
    fullName: "Con Fallos",
    attention: {
      noExecutions: false,
      failedMoreThanCompleted: true,
    },
    lastActivityAt: "2026-08-18T10:00:00Z",
  },
  {
    userId: 3,
    fullName: "Actividad Reciente",
    attention: {
      noExecutions: false,
      failedMoreThanCompleted: false,
    },
    lastActivityAt: "2026-08-19T10:00:00Z",
    lastResultCodename: "recentLCS",
  },
];


describe("TeacherCourseAttention", () => {
  test("resume señales y ordena la actividad más reciente", () => {
    const summary =
      buildAcademicAttention(
        students
      );

    expect(
      summary.noExecutions.map(
        (student) => student.userId
      )
    ).toEqual([1]);
    expect(
      summary.failures.map(
        (student) => student.userId
      )
    ).toEqual([2]);
    expect(
      summary.recent.map(
        (student) => student.userId
      )
    ).toEqual([3, 2]);
  });

  test("los indicadores abren el filtro correcto y conservan navegación útil", () => {
    const onSelectFilter =
      jest.fn();

    render(
      <MemoryRouter>
        <TeacherCourseAttention
          courseId="10"
          students={students}
          loading={false}
          error={null}
          onRetry={() => {}}
          onSelectFilter={
            onSelectFilter
          }
        />
      </MemoryRouter>
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            /1 estudiantes sin ejecuciones/i,
        }
      )
    );
    expect(
      onSelectFilter
    ).toHaveBeenLastCalledWith(
      "no-executions"
    );

    fireEvent.click(
      screen.getByRole(
        "button",
        {
          name:
            /1 estudiantes con más fallos/i,
        }
      )
    );
    expect(
      onSelectFilter
    ).toHaveBeenLastCalledWith(
      "failures"
    );

    expect(
      screen.getByRole(
        "link",
        { name: /^Actividad Reciente/i }
      )
    ).toHaveAttribute(
      "href",
      "/teacher/courses/10/students/3"
    );

    expect(
      screen.getByRole(
        "link",
        {
          name:
            "Ver último resultado de Actividad Reciente",
        }
      )
    ).toHaveAttribute(
      "href",
      "/code/recentLCS"
    );
  });
});
