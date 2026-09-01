import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";

import {
  I18nProvider,
  useI18n,
} from "../i18n";

import TeacherCourseDetail
  from "./TeacherCourseDetail";

import {
  teacherApi,
} from "./teacherApi";


jest.mock(
  "./TeacherCourseAnalytics",
  () => () => null
);

jest.mock(
  "./TeacherCourseAttention",
  () => () => null
);

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
  id: 10,
  code: "INF-101",
  name: "Algorithms Course",
  academicYear: 2026,
  academicTerm: 2,
  isActive: true,
  teacher: {
    fullName:
      "Professor Persisted",
    email:
      "prof@example.com",
  },
};


const student = {
  membershipId: 90,
  userId: 3,
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  membershipActive: true,
  submissions: 2,
  executions: 0,
  completed: 0,
  failed: 0,
  lastActivityAt:
    "2026-08-20T12:00:00Z",
  lastResultCodename: null,
  attention: {
    noExecutions: true,
    failedMoreThanCompleted:
      false,
  },
};


const listPayload = {
  items: [student],
  total: 1,
};


function arrangeSuccessApi() {
  teacherApi.mockImplementation(
    (url, options = {}) => {
      if (
        url ===
          "/api/teacher/courses/10" &&
        options.method === "PATCH"
      ) {
        const payload =
          JSON.parse(
            options.body
          );

        return Promise.resolve({
          course: {
            ...course,
            isActive:
              payload.isActive ??
              course.isActive,
          },
        });
      }

      if (
        url ===
        "/api/teacher/courses/10"
      ) {
        return Promise.resolve({
          course,
        });
      }

      if (
        url.includes(
          "/api/teacher/courses/10/students?"
        )
      ) {
        return Promise.resolve(
          listPayload
        );
      }

      return Promise.resolve({});
    }
  );
}


const renderEnglish = () =>
  render(
    <I18nProvider
      initialLanguage="en"
    >
      <LanguageControl />

      <MemoryRouter
        initialEntries={[
          "/teacher/courses/10",
        ]}
      >
        <Routes>
          <Route
            path="/teacher/courses/:courseId"
            element={
              <TeacherCourseDetail />
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );


describe(
  "TeacherCourseDetail shell i18n",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      arrangeSuccessApi();
    });


    test(
      "localizes the course shell without refetching on language change",
      async () => {
        renderEnglish();

        expect(
          await screen.findByRole(
            "heading",
            {
              name:
                "Algorithms Course",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "link",
            {
              name:
                "← Back to courses",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Finish course",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Active",
            {
              selector:
                ".teacher-course-code-row .teacher-status",
            }
          )
        ).toBeInTheDocument();

        await waitFor(() =>
          expect(
            teacherApi
          ).toHaveBeenCalledTimes(5)
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name: "switch-es",
            }
          )
        );

        expect(
          screen.getByRole(
            "link",
            {
              name:
                "← Volver a cursos",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Finalizar curso",
            }
          )
        ).toBeInTheDocument();

        expect(
          teacherApi
        ).toHaveBeenCalledTimes(5);
      }
    );


    test(
      "reactively localizes the load error without repeating requests",
      async () => {
        teacherApi.mockImplementation(
          (url) => {
            if (
              url ===
              "/api/teacher/courses/10"
            ) {
              return Promise.reject({
                status: 500,
                code:
                  "INTERNAL_ERROR",
                message:
                  "Error interno del servidor.",
              });
            }

            if (
              url.includes(
                "/students?"
              )
            ) {
              return Promise.resolve({
                items: [],
                total: 0,
              });
            }

            return Promise.resolve(
              {}
            );
          }
        );

        renderEnglish();

        expect(
          await screen.findByText(
            "The service is temporarily unavailable. Try again in a few moments."
          )
        ).toBeInTheDocument();

        await waitFor(() =>
          expect(
            teacherApi
          ).toHaveBeenCalledTimes(3)
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name: "switch-es",
            }
          )
        );

        expect(
          await screen.findByText(
            "El servicio no está disponible temporalmente. Inténtalo nuevamente en unos momentos."
          )
        ).toBeInTheDocument();

        expect(
          teacherApi
        ).toHaveBeenCalledTimes(3);
      }
    );


    test(
      "uses the localized finish modal and preserves the PATCH contract",
      async () => {
        const confirmSpy =
          jest
            .spyOn(
              window,
              "confirm"
            )
            .mockReturnValue(true);

        renderEnglish();

        await screen.findByRole(
          "heading",
          {
            name:
              "Algorithms Course",
          }
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Finish course",
            }
          )
        );

        const dialog =
          screen.getByRole(
            "dialog",
            {
              name:
                "Finish course",
            }
          );

        expect(
          within(dialog).getByText(
            "Confirm finishing course INF-101 2026-2?"
          )
        ).toBeInTheDocument();

        expect(
          confirmSpy
        ).not.toHaveBeenCalled();

        fireEvent.click(
          within(dialog).getByRole(
            "button",
            {
              name:
                "Finish course",
            }
          )
        );

        await waitFor(() =>
          expect(
            teacherApi
          ).toHaveBeenCalledWith(
            "/api/teacher/courses/10",
            expect.objectContaining({
              method: "PATCH",
              body:
                JSON.stringify({
                  isActive: false,
                }),
            })
          )
        );

        confirmSpy.mockRestore();
      }
    );
  }
);
