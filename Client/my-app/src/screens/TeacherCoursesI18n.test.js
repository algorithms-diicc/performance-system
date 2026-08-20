import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  MemoryRouter,
} from "react-router-dom";

import {
  I18nProvider,
  useI18n,
} from "../i18n";

import TeacherCourses
  from "./TeacherCourses";

import {
  teacherApi,
} from "./teacherApi";


jest.mock(
  "./teacherApi",
  () => {
    const actual =
      jest.requireActual(
        "./teacherApi"
      );

    return {
      ...actual,
      teacherApi:
        jest.fn(),
    };
  }
);


const LanguageControl = () => {
  const {
    setLanguage,
  } = useI18n();

  return (
    <button
      type="button"
      onClick={() =>
        setLanguage("es")
      }
    >
      switch-es
    </button>
  );
};


const course = {
  id: 9,
  code: "CC4102",
  name:
    "Diseño y Análisis de Algoritmos",
  academicYear: 2026,
  academicTerm: 2,
  isActive: true,
  teacher: {
    fullName:
      "Profesor Persistido",
  },
  activeStudents: 4,
  totalStudents: 5,
  submissions: 8,
  executions: 12,
  lastActivityAt:
    "2026-08-20T12:00:00Z",
};


const renderEnglish = () =>
  render(
    <I18nProvider
      initialLanguage="en"
    >
      <LanguageControl />

      <MemoryRouter>
        <TeacherCourses />
      </MemoryRouter>
    </I18nProvider>
  );


describe(
  "TeacherCourses i18n",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });


    test(
      "localizes course chrome while preserving institutional data and does not refetch on language change",
      async () => {
        teacherApi
          .mockResolvedValue({
            items: [course],
          });

        renderEnglish();

        expect(
          await screen.findByRole(
            "heading",
            { name: "Courses" }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Teacher supervision"
          )
        ).toBeInTheDocument();

        expect(
          await screen.findByText(
            "CC4102"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Diseño y Análisis de Algoritmos"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Profesor Persistido/
          )
        ).toBeInTheDocument();

        expect(
          screen.getAllByText(
            "Active"
          ).length
        ).toBeGreaterThanOrEqual(2);

        await waitFor(() =>
          expect(
            teacherApi
          ).toHaveBeenCalledTimes(1)
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            { name: "switch-es" }
          )
        );

        expect(
          await screen.findByRole(
            "heading",
            { name: "Cursos" }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Supervisión docente"
          )
        ).toBeInTheDocument();

        expect(
          teacherApi
        ).toHaveBeenCalledTimes(1);
      }
    );


    test(
      "reactively localizes a load error without repeating the request",
      async () => {
        teacherApi
          .mockRejectedValue({
            status: 500,
            code:
              "INTERNAL_ERROR",
            message:
              "Error interno del servidor.",
          });

        renderEnglish();

        expect(
          await screen.findByText(
            "The service is temporarily unavailable. Try again in a few moments."
          )
        ).toBeInTheDocument();

        expect(
          teacherApi
        ).toHaveBeenCalledTimes(1);

        fireEvent.click(
          screen.getByRole(
            "button",
            { name: "switch-es" }
          )
        );

        expect(
          await screen.findByText(
            "El servicio no está disponible temporalmente. Inténtalo nuevamente en unos momentos."
          )
        ).toBeInTheDocument();

        expect(
          teacherApi
        ).toHaveBeenCalledTimes(1);
      }
    );


    test(
      "does not leak a Spanish validation message in English and preserves it when switching to Spanish",
      async () => {
        teacherApi
          .mockResolvedValueOnce({
            items: [],
          })
          .mockRejectedValueOnce({
            status: 400,
            code:
              "VALIDATION_ERROR",
            payload: {
              error: {
                code:
                  "VALIDATION_ERROR",
              },
            },
            message:
              "Ya existe un curso con estos datos.",
          });

        renderEnglish();

        await screen.findByRole(
          "heading",
          { name: "Courses" }
        );

        fireEvent.click(
          screen.getAllByRole(
            "button",
            {
              name:
                "Create course",
            }
          )[0]
        );

        fireEvent.change(
          screen.getByLabelText(
            "Code"
          ),
          {
            target: {
              value: "CC4102",
            },
          }
        );

        fireEvent.change(
          screen.getByLabelText(
            "Name"
          ),
          {
            target: {
              value:
                "Algorithms",
            },
          }
        );

        fireEvent.submit(
          screen
            .getByLabelText("Code")
            .closest("form")
        );

        expect(
          await screen.findByText(
            "Check the course information and try again."
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Ya existe un curso con estos datos."
          )
        ).not.toBeInTheDocument();

        expect(
          teacherApi
        ).toHaveBeenCalledTimes(2);

        fireEvent.click(
          screen.getByRole(
            "button",
            { name: "switch-es" }
          )
        );

        expect(
          await screen.findByText(
            "Ya existe un curso con estos datos."
          )
        ).toBeInTheDocument();

        expect(
          teacherApi
        ).toHaveBeenCalledTimes(2);
      }
    );
  }
);
