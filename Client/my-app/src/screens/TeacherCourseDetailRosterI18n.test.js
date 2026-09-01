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


function arrangeApi() {
  teacherApi.mockImplementation(
    (url, options = {}) => {
      if (
        url ===
          "/api/teacher/courses/10/students" &&
        options.method === "POST"
      ) {
        return Promise.resolve({
          summary: {
            requested: 1,
            added: 0,
            reactivated: 0,
            alreadyActive: 0,
            rejected: 1,
          },
          added: [],
          reactivated: [],
          alreadyActive: [],
          rejected: [
            {
              email:
                "ghost@example.com",
              reason:
                "NOT_ELIGIBLE",
            },
          ],
        });
      }

      if (
        url.includes(
          "/api/teacher/courses/10/students?"
        )
      ) {
        return Promise.resolve({
          items: [student],
          total: 1,
        });
      }

      if (
        url ===
          "/api/teacher/courses/10/students/3" &&
        options.method === "DELETE"
      ) {
        return Promise.resolve({
          courseId: 10,
          userId: 3,
          membershipActive: false,
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
  "TeacherCourseDetail roster i18n",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      arrangeApi();
    });


    test(
      "localizes roster chrome and preserves institutional data without refetch on language change",
      async () => {
        renderEnglish();

        expect(
          await screen.findByText(
            "ada@example.com"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "heading",
            {
              name: "Students",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByPlaceholderText(
            "Search by name or email"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "link",
            {
              name: "View profile",
            }
          )
        ).toHaveAttribute(
          "href",
          "/teacher/courses/10/students/3"
        );

        expect(
          screen.getByRole(
            "button",
            {
              name: "Latest result",
            }
          )
        ).toBeDisabled();

        expect(
          screen.getAllByText(
            "No executions"
          ).length
        ).toBeGreaterThanOrEqual(1);

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
            "heading",
            {
              name: "Estudiantes",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByPlaceholderText(
            "Buscar nombre o correo"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "link",
            {
              name: "Ver ficha",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Ada Lovelace"
          )
        ).toBeInTheDocument();

        expect(
          teacherApi
        ).toHaveBeenCalledTimes(5);
      }
    );


    test(
      "localizes bulk enrollment summary and privacy-safe rejection reason",
      async () => {
        renderEnglish();

        await screen.findByText(
          "ada@example.com"
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name: "Add students",
            }
          )
        );

        const textarea =
          screen.getByLabelText(
            "Student emails"
          );

        fireEvent.change(
          textarea,
          {
            target: {
              value:
                "ghost@example.com",
            },
          }
        );

        fireEvent.submit(
          textarea.closest("form")
        );

        expect(
          await screen.findByText(
            "Enrollment result"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /1 rejected/
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /ghost@example.com/
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            /Account unavailable for enrollment/
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            /Cuenta no disponible/
          )
        ).not.toBeInTheDocument();
      }
    );


    test(
      "preserves membership-filter query semantics",
      async () => {
        renderEnglish();

        await screen.findByText(
          "ada@example.com"
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name: "Removed",
            }
          )
        );

        await waitFor(() =>
          expect(
            teacherApi
          ).toHaveBeenCalledWith(
            expect.stringContaining(
              "membership=inactive"
            ),
            expect.objectContaining({
              signal:
                expect.anything(),
            })
          )
        );

        expect(
          teacherApi.mock.calls.some(
            ([url]) =>
              String(url).includes(
                "page_size=50"
              ) &&
              String(url).includes(
                "membership=inactive"
              )
          )
        ).toBe(true);
      }
    );


    test(
      "uses the localized removal modal and preserves DELETE contract",
      async () => {
        const confirmSpy =
          jest
            .spyOn(
              window,
              "confirm"
            )
            .mockReturnValue(true);

        renderEnglish();

        await screen.findByText(
          "ada@example.com"
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name: "Remove",
            }
          )
        );

        const dialog =
          screen.getByRole(
            "dialog",
            {
              name:
                "Remove student",
            }
          );

        expect(
          within(dialog).getByText(
            "You will remove Ada Lovelace (ada@example.com) from the active roster."
          )
        ).toBeInTheDocument();

        expect(
          within(dialog).getByText(
            "The user account, experiments, and historical results will not be deleted."
          )
        ).toBeInTheDocument();

        expect(
          confirmSpy
        ).not.toHaveBeenCalled();

        fireEvent.click(
          within(dialog).getByRole(
            "button",
            { name: "Remove" }
          )
        );

        await waitFor(() =>
          expect(
            teacherApi
          ).toHaveBeenCalledWith(
            "/api/teacher/courses/10/students/3",
            expect.objectContaining({
              method: "DELETE",
            })
          )
        );

        confirmSpy.mockRestore();
      }
    );
  }
);
