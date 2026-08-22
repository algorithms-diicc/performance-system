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
  originalFilename:
    "solucion.cpp",
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


const submission = {
  id: 42,
  title:
    "Experimento canónico",
  status: "Completada",
  executions: 1,
  completed: 1,
  failed: 0,
  queued: 0,
  running: 0,
  processing: 0,
  cancelled: 0,
  createdAt:
    "2026-08-17T12:00:00Z",
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
  },
};


function arrangeSuccessApi() {
  teacherApi.mockImplementation(
    (url) => {
      if (
        url.endsWith(
          "/executions/70"
        )
      ) {
        return Promise.resolve({
          execution: {
            ...execution,
            benchmark: "LCS",
            inputSize: 100,
            samples: 5,
            executionProfile:
              "balanced",
            executionConfig: {
              compiler_flags:
                "-O2",
              measurement: {
                samples_per_point:
                  5,
                points: 10,
                warmup_rounds: 1,
                perf_scope:
                  "process",
              },
            },
            hardwareSnapshot: {
              node: {
                cpu_model:
                  "Intel Core i7",
                architecture:
                  "x86_64",
                logical_cpus: 8,
              },
              measurement: {
                backend: "perf",
                requested_perf_scope:
                  "process",
              },
            },
          },
        });
      }

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
        url.includes(
          "/submissions?"
        )
      ) {
        return Promise.resolve({
          items: [submission],
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


const callCount = (
  predicate
) =>
  teacherApi.mock.calls
    .filter(
      ([url]) =>
        predicate(
          String(url)
        )
    )
    .length;


describe(
  "TeacherStudentDetail modal and submissions i18n",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      arrangeSuccessApi();
    });


    test(
      "localizes the technical modal from canonical state and preserves technical data and routes",
      async () => {
        renderEnglish();

        await screen.findByText(
          "exec70LCS"
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "View details",
            }
          )
        );

        const dialog =
          await screen.findByRole(
            "dialog"
          );

        expect(
          within(dialog).getByText(
            "Technical details"
          )
        ).toBeInTheDocument();

        expect(
          within(dialog).getByText(
            "Source"
          )
        ).toBeInTheDocument();

        expect(
          within(dialog).getByText(
            "solucion.cpp"
          )
        ).toBeInTheDocument();

        expect(
          within(dialog).getByText(
            "Experiment"
          )
        ).toBeInTheDocument();

        expect(
          within(dialog).getByText(
            "Completed"
          )
        ).toBeInTheDocument();

        expect(
          within(dialog).queryByText(
            "Completada"
          )
        ).not.toBeInTheDocument();

        expect(
          within(dialog).getByText(
            "Intel i7"
          )
        ).toBeInTheDocument();

        expect(
          within(dialog).queryByText(
            "Intel Core i7"
          )
        ).not.toBeInTheDocument();

        expect(
          within(dialog).getByText(
            "-O2"
          )
        ).toBeInTheDocument();

        expect(
          within(dialog).getByRole(
            "link",
            {
              name:
                "View experiment",
            }
          )
        ).toHaveAttribute(
          "href",
          "/submissions/42"
        );

        expect(
          within(dialog).getByRole(
            "link",
            {
              name:
                "View results",
            }
          )
        ).toHaveAttribute(
          "href",
          "/code/exec70LCS"
        );

        expect(
          callCount(
            (url) =>
              url.endsWith(
                "/executions/70"
              )
          )
        ).toBe(1);

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name: "switch-es",
            }
          )
        );

        expect(
          within(dialog).getByText(
            "Detalle técnico"
          )
        ).toBeInTheDocument();

        expect(
          within(dialog).getByText(
            "Completada"
          )
        ).toBeInTheDocument();

        expect(
          within(dialog).getByRole(
            "link",
            {
              name:
                "Ver experimento",
            }
          )
        ).toBeInTheDocument();

        expect(
          callCount(
            (url) =>
              url.endsWith(
                "/executions/70"
              )
          )
        ).toBe(1);
      }
    );


    test(
      "derives submission status from technical counters instead of backend Spanish label",
      async () => {
        renderEnglish();

        await screen.findByText(
          "exec70LCS"
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Experiments",
            }
          )
        );

        const link =
          await screen.findByRole(
            "link",
            {
              name:
                /Experimento canónico ID 42/i,
            }
          );

        expect(
          link
        ).toHaveAttribute(
          "href",
          "/submissions/42"
        );

        expect(
          screen.getByText(
            "Completed",
            {
              selector:
                ".teacher-submission-status",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Completada",
            {
              selector:
                ".teacher-submission-status",
            }
          )
        ).not.toBeInTheDocument();

        expect(
          callCount(
            (url) =>
              url.includes(
                "/submissions?"
              )
          )
        ).toBe(1);

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
            "Completada",
            {
              selector:
                ".teacher-submission-status",
            }
          )
        ).toBeInTheDocument();

        expect(
          callCount(
            (url) =>
              url.includes(
                "/submissions?"
              )
          )
        ).toBe(1);
      }
    );


    test(
      "reactively localizes submission errors without repeating the failed request",
      async () => {
        teacherApi.mockImplementation(
          (url) => {
            if (
              url.includes(
                "/submissions?"
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

        renderEnglish();

        await screen.findByText(
          "exec70LCS"
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Experiments",
            }
          )
        );

        expect(
          await screen.findByText(
            "The service is temporarily unavailable. Try again in a few moments."
          )
        ).toBeInTheDocument();

        expect(
          callCount(
            (url) =>
              url.includes(
                "/submissions?"
              )
          )
        ).toBe(1);

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
          callCount(
            (url) =>
              url.includes(
                "/submissions?"
              )
          )
        ).toBe(1);
      }
    );
  }
);
