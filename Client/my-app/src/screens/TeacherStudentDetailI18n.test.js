import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
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

import {
  teacherApi,
} from "./teacherApi";

import TeacherStudentDetail
  from "./TeacherStudentDetail";


jest.mock(
  "./teacherApi",
  () => ({
    ...jest.requireActual(
      "./teacherApi"
    ),
    teacherApi: jest.fn(),
  })
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


const execution = {
  executionId: 70,
  codename: "exec70LCS",
  submissionId: 42,
  submissionTitle:
    "Experimento canónico",
  state: "COMPLETED",
  stateLabel: "Completada",
  durationMs: 1500,
  hardwareProfile: "Intel i7",
  resultAvailable: true,
  finishedAt:
    "2026-08-20T12:00:00Z",
};


const profilePayload = {
  profile: {
    fullName: "Ada Lovelace",
    email: "ada@example.com",
    lastLogin:
      "2026-08-17T12:00:00Z",
    membership: {
      isActive: true,
    },
  },
  course: {
    code: "INF-101",
    academicYear: 2026,
    academicTerm: 2,
  },
  summary: {
    submissions: 1,
    executions: 1,
    completedExecutions: 1,
    failedExecutions: 0,
    queuedExecutions: 0,
    runningExecutions: 0,
    processingExecutions: 0,
    lastActivityAt:
      "2026-08-20T12:00:00Z",
  },
};


function arrangeSuccessApi() {
  teacherApi.mockImplementation(
    (url) => {
      if (
        url.includes(
          "/executions?"
        )
      ) {
        return Promise.resolve({
          items: [execution],
          total: 1,
        });
      }

      if (
        url.endsWith(
          "/students/3"
        )
      ) {
        return Promise.resolve(
          profilePayload
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
          "/teacher/courses/10/students/3",
        ]}
      >
        <Routes>
          <Route
            path="/teacher/courses/:courseId/students/:userId"
            element={
              <TeacherStudentDetail />
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );


describe(
  "TeacherStudentDetail profile and executions i18n",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      arrangeSuccessApi();
    });


    test(
      "localizes profile and execution chrome from technical state without refetching",
      async () => {
        renderEnglish();

        expect(
          await screen.findByRole(
            "heading",
            {
              name: "Ada Lovelace",
            }
          )
        ).toBeInTheDocument();

        expect(
          await screen.findByText(
            "exec70LCS"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Course student"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "In course"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Completed",
            {
              selector:
                ".teacher-execution-state",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Completada",
            {
              selector:
                ".teacher-execution-state",
            }
          )
        ).not.toBeInTheDocument();

        expect(
          screen.getByText(
            "1.50 s"
          )
        ).toBeInTheDocument();

        await waitFor(() =>
          expect(
            teacherApi
          ).toHaveBeenCalledTimes(2)
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
          screen.getByText(
            "Estudiante del curso"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "En el curso"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Completada",
            {
              selector:
                ".teacher-execution-state",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "1,50 s"
          )
        ).toBeInTheDocument();

        expect(
          teacherApi
        ).toHaveBeenCalledTimes(2);
      }
    );


    test(
      "reactively localizes profile errors without repeating requests",
      async () => {
        teacherApi.mockImplementation(
          (url) => {
            if (
              url.endsWith(
                "/students/3"
              )
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
                "/executions?"
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
          ).toHaveBeenCalledTimes(2)
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
        ).toHaveBeenCalledTimes(2);
      }
    );


    test(
      "preserves execution status-filter query semantics",
      async () => {
        renderEnglish();

        await screen.findByText(
          "exec70LCS"
        );

        fireEvent.change(
          screen.getByLabelText(
            "Status"
          ),
          {
            target: {
              value: "FAILED",
            },
          }
        );

        await waitFor(() =>
          expect(
            teacherApi.mock.calls
              .some(
                ([url]) =>
                  String(url).includes(
                    "status=FAILED"
                  )
                  &&
                  String(url).includes(
                    "page_size=15"
                  )
              )
          ).toBe(true)
        );
      }
    );
  }
);
