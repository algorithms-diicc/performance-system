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
  useNavigate,
} from "react-router-dom";

import {
  I18nProvider,
} from "../i18n";

import TeacherCourseDetail
  from "./TeacherCourseDetail";

import {
  teacherApi,
} from "./teacherApi";


jest.mock(
  "react-router-dom",
  () => {
    const actual =
      jest.requireActual(
        "react-router-dom"
      );

    return {
      ...actual,
      useNavigate: jest.fn(),
    };
  }
);

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


const baseCourse = {
  id: 10,
  code: "INF-101",
  name: "Algorithms",
  academicYear: 2026,
  academicTerm: 2,
  isActive: true,
  teacher: {
    id: 11,
    fullName:
      "Current Teacher",
    email:
      "current@example.com",
  },
};

const baseStudent = {
  membershipId: 90,
  userId: 3,
  fullName: "Ada Lovelace",
  email: "ada@example.com",
  membershipActive: true,
  submissions: 1,
  executions: 1,
  completed: 1,
  failed: 0,
  attention: {},
};

const navigate = jest.fn();


function arrangeApi({
  course = baseCourse,
  student = baseStudent,
  patchError = null,
  removeError = null,
  restoreError = null,
} = {}) {
  teacherApi.mockImplementation(
    (url, options = {}) => {
      if (
        String(url).includes(
          "/api/admin/users?"
        )
      ) {
        const teacherRequest =
          String(url).includes(
            "role=Teacher"
          );

        return Promise.resolve({
          items:
            teacherRequest
              ? [
                  {
                    id: 11,
                    name:
                      "Current Teacher",
                    email:
                      "current@example.com",
                    role: "Teacher",
                    isActive: true,
                  },
                  {
                    id: 22,
                    name:
                      "New Teacher",
                    email:
                      "new@example.com",
                    role: "Teacher",
                    isActive: true,
                  },
                ]
              : [],
        });
      }

      if (
        url
          === "/api/teacher/courses/10/clone"
        && options.method === "POST"
      ) {
        return Promise.resolve({
          course: {
            ...course,
            id: 99,
          },
          studentsCopied: 1,
        });
      }

      if (
        url
          === "/api/teacher/courses/10"
        && options.method === "PATCH"
      ) {
        if (patchError) {
          return Promise.reject(
            patchError
          );
        }

        const payload =
          JSON.parse(options.body);

        return Promise.resolve({
          course: {
            ...course,
            isActive:
              payload.isActive
              ?? course.isActive,
            teacher:
              payload.teacherUserId
                ? {
                    id:
                      payload.teacherUserId,
                    fullName:
                      "New Teacher",
                    email:
                      "new@example.com",
                  }
                : course.teacher,
          },
        });
      }

      if (
        url
          === "/api/teacher/courses/10/students/3"
        && options.method === "DELETE"
      ) {
        return removeError
          ? Promise.reject(
              removeError
            )
          : Promise.resolve({});
      }

      if (
        url
          === "/api/teacher/courses/10/students/3/restore"
        && options.method === "POST"
      ) {
        return restoreError
          ? Promise.reject(
              restoreError
            )
          : Promise.resolve({});
      }

      if (
        url
          === "/api/teacher/courses/10/students"
        && options.method === "POST"
      ) {
        return Promise.resolve({
          summary: {
            added: 2,
            reactivated: 0,
            alreadyActive: 0,
            rejected: 0,
          },
        });
      }

      if (
        String(url).includes(
          "/api/teacher/courses/10/students?"
        )
      ) {
        return Promise.resolve({
          items: [student],
          total: 1,
        });
      }

      if (
        url
        === "/api/teacher/courses/10"
      ) {
        return Promise.resolve({
          course,
        });
      }

      return Promise.resolve({});
    }
  );
}


function renderPage(
  currentUser = {
    id: 11,
    role_name: "Teacher",
  }
) {
  return render(
    <I18nProvider
      initialLanguage="en"
    >
      <MemoryRouter
        initialEntries={[
          "/teacher/courses/10",
        ]}
      >
        <Routes>
          <Route
            path="/teacher/courses/:courseId"
            element={
              <TeacherCourseDetail
                currentUser={currentUser}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}


describe(
  "TeacherCourseDetail Iteration 3 contracts",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      useNavigate.mockReturnValue(
        navigate
      );
      arrangeApi();
    });


    test(
      "Admin transfers the course with teacherUserId while preserving user-facing data",
      async () => {
        renderPage({
          id: 2,
          role_name: "Admin",
        });

        fireEvent.click(
          await screen.findByRole(
            "button",
            { name: "Edit" }
          )
        );

        const responsible =
          await screen.findByLabelText(
            "Responsible instructor"
          );

        expect(
          within(responsible).getByRole(
            "option",
            {
              name:
                "New Teacher — new@example.com",
            }
          )
        ).toBeInTheDocument();

        fireEvent.change(
          responsible,
          {
            target: {
              value: "22",
            },
          }
        );

        await waitFor(() =>
          expect(
            responsible
          ).toHaveValue("22")
        );
        fireEvent.submit(
          responsible.closest("form")
        );

        await waitFor(() => {
          const patchCall =
            teacherApi.mock.calls.find(
              ([url, options]) =>
                url
                  === "/api/teacher/courses/10"
                && options?.method
                  === "PATCH"
            );

          expect(
            JSON.parse(
              patchCall[1].body
            )
          ).toEqual(
            expect.objectContaining({
              teacherUserId: 22,
            })
          );
        });
      }
    );


    test(
      "Teacher editing a course has no responsible selector",
      async () => {
        renderPage();

        fireEvent.click(
          await screen.findByRole(
            "button",
            { name: "Edit" }
          )
        );

        expect(
          screen.queryByLabelText(
            "Responsible instructor"
          )
        ).not.toBeInTheDocument();
        expect(
          teacherApi.mock.calls.some(
            ([url]) =>
              String(url).includes(
                "/api/admin/users?"
              )
          )
        ).toBe(false);
      }
    );


    test(
      "clones the target period and optional active roster, then navigates to the new course",
      async () => {
        renderPage();

        fireEvent.click(
          await screen.findByRole(
            "button",
            { name: "Clone course" }
          )
        );

        const dialog =
          screen.getByRole(
            "dialog",
            { name: "Clone course" }
          );

        expect(
          within(dialog).getByText(
            "Experiments, executions, and results will not be copied."
          )
        ).toBeInTheDocument();

        fireEvent.change(
          within(dialog).getByLabelText(
            "Year"
          ),
          {
            target: {
              value: "2027",
            },
          }
        );
        fireEvent.change(
          within(dialog).getByLabelText(
            "Semester"
          ),
          {
            target: {
              value: "1",
            },
          }
        );
        fireEvent.click(
          within(dialog).getByLabelText(
            "Copy active students"
          )
        );

        await waitFor(() => {
          expect(
            within(dialog).getByLabelText(
              "Year"
            )
          ).toHaveValue(2027);
          expect(
            within(dialog).getByLabelText(
              "Semester"
            )
          ).toHaveValue("1");
          expect(
            within(dialog).getByLabelText(
              "Copy active students"
            )
          ).toBeChecked();
        });
        fireEvent.click(
          within(dialog).getByRole(
            "button",
            { name: "Clone course" }
          )
        );

        await waitFor(() =>
          expect(
            teacherApi
          ).toHaveBeenCalledWith(
            "/api/teacher/courses/10/clone",
            expect.objectContaining({
              method: "POST",
              body:
                JSON.stringify({
                  academicYear: 2027,
                  academicTerm: 1,
                  copyStudents: true,
                }),
            })
          )
        );
        expect(navigate).toHaveBeenCalledWith(
          "/teacher/courses/99"
        );
      }
    );


    test(
      "reactivates with ConfirmActionModal and never invokes native confirmation",
      async () => {
        arrangeApi({
          course: {
            ...baseCourse,
            isActive: false,
          },
        });
        const confirmSpy =
          jest.spyOn(
            window,
            "confirm"
          );

        renderPage();

        fireEvent.click(
          await screen.findByRole(
            "button",
            {
              name:
                "Reactivate course",
            }
          )
        );

        const dialog =
          screen.getByRole(
            "dialog",
            {
              name:
                "Reactivate course",
            }
          );
        fireEvent.click(
          within(dialog).getByRole(
            "button",
            {
              name:
                "Reactivate course",
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
                  isActive: true,
                }),
            })
          )
        );
        expect(confirmSpy)
          .not.toHaveBeenCalled();
        confirmSpy.mockRestore();
      }
    );


    test(
      "previews normalized unique emails and blocks more than 200 before the request",
      async () => {
        renderPage();

        fireEvent.click(
          await screen.findByRole(
            "button",
            { name: "Add students" }
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
                "ADA@example.com; ada@example.com\nBOB@example.com",
            },
          }
        );

        expect(
          screen.getByText(
            "2 emails detected"
          )
        ).toBeInTheDocument();

        fireEvent.submit(
          textarea.closest("form")
        );

        await waitFor(() => {
          const addCall =
            teacherApi.mock.calls.find(
              ([url, options]) =>
                url
                  === "/api/teacher/courses/10/students"
                && options?.method
                  === "POST"
            );

          expect(
            JSON.parse(
              addCall[1].body
            )
          ).toEqual({
            emails: [
              "ada@example.com",
              "bob@example.com",
            ],
          });
        });

        fireEvent.change(
          textarea,
          {
            target: {
              value:
                Array.from(
                  { length: 201 },
                  (_, index) =>
                    `student${index}@example.com`
                ).join(","),
            },
          }
        );

        expect(
          screen.getByText(
            "201 emails detected"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "The maximum is 200. Reduce the list before continuing."
          )
        ).toBeInTheDocument();
        expect(
          screen.getByRole(
            "button",
            { name: "Add to course" }
          )
        ).toBeDisabled();

        const addCalls =
          teacherApi.mock.calls.filter(
            ([url, options]) =>
              url
                === "/api/teacher/courses/10/students"
              && options?.method
                === "POST"
          );
        expect(addCalls).toHaveLength(1);
      }
    );


    test(
      "keeps removal failures inside the confirmation modal without native alerts",
      async () => {
        arrangeApi({
          removeError: {
            status: 500,
            code: "INTERNAL_ERROR",
          },
        });
        const alertSpy =
          jest.spyOn(
            window,
            "alert"
          );

        renderPage();

        fireEvent.click(
          await screen.findByRole(
            "button",
            { name: "Remove" }
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

        fireEvent.click(
          within(dialog).getByRole(
            "button",
            { name: "Remove" }
          )
        );

        expect(
          await within(dialog).findByRole(
            "alert"
          )
        ).toHaveTextContent(
          "The service is temporarily unavailable. Try again in a few moments."
        );
        expect(alertSpy)
          .not.toHaveBeenCalled();
        alertSpy.mockRestore();
      }
    );


    test(
      "shows save and restore failures inline without native alerts",
      async () => {
        const requestError = {
          status: 500,
          code: "INTERNAL_ERROR",
        };
        arrangeApi({
          student: {
            ...baseStudent,
            membershipActive: false,
          },
          patchError: requestError,
          restoreError: requestError,
        });
        const alertSpy =
          jest.spyOn(
            window,
            "alert"
          );

        renderPage();

        fireEvent.click(
          await screen.findByRole(
            "button",
            { name: "Edit" }
          )
        );
        fireEvent.submit(
          screen
            .getByDisplayValue(
              "INF-101"
            )
            .closest("form")
        );

        expect(
          await screen.findByText(
            "The service is temporarily unavailable. Try again in a few moments."
          )
        ).toBeInTheDocument();

        fireEvent.click(
          screen.getByRole(
            "button",
            { name: "Restore" }
          )
        );

        await waitFor(() =>
          expect(
            screen.getAllByText(
              "The service is temporarily unavailable. Try again in a few moments."
            ).length
          ).toBeGreaterThanOrEqual(2)
        );
        expect(alertSpy)
          .not.toHaveBeenCalled();
        alertSpy.mockRestore();
      }
    );
  }
);
