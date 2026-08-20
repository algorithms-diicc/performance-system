import React from "react";
import {
  fireEvent,
  render,
  screen,
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
  requestJson,
} from "../common/requestErrorModel";

import AdminUserDetail
  from "./AdminUserDetail";


jest.mock(
  "../common/requestErrorModel",
  () => ({
    requestJson:
      jest.fn(),
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
  hardwareProfile:
    "Intel i7",
  resultAvailable: true,
  finishedAt:
    "2026-08-20T12:00:00Z",
};


const submission = {
  id: 42,
  title:
    "Experimento canónico",
  status:
    "Con ejecuciones aprobadas",
  executionsCount: 1,
  completedExecutions: 1,
  failedExecutions: 0,
  queuedExecutions: 0,
  runningExecutions: 0,
  processingExecutions: 0,
  cancelledExecutions: 0,
  createdAt:
    "2026-08-17T12:00:00Z",
};


const auditItem = {
  id: 90,
  action:
    "USER_ROLE_UPDATED",
  description:
    "Rol cambiado por admin",
  createdAt:
    "2026-08-18T12:00:00Z",
};


const profilePayload = {
  profile: {
    id: 3,
    full_name:
      "Ada Lovelace",
    email:
      "ada@example.com",
    role: "Student",
    isActive: true,
    statusLabel: "Activo",
    createdAt:
      "2026-01-02T00:00:00Z",
    lastLogin:
      "2026-08-17T12:00:00Z",
  },
  summary: {
    submissionsCount: 1,
    executionsCount: 1,
    completedExecutions: 1,
    failedExecutions: 0,
    queuedExecutions: 0,
    runningExecutions: 0,
    processingExecutions: 0,
    cancelledExecutions: 0,
  },
};


function arrangeRequests() {
  requestJson.mockImplementation(
    (url) => {
      if (
        url ===
        "/api/admin/executions/70"
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
        url.includes(
          "/audit-log?"
        )
      ) {
        return Promise.resolve({
          items: [auditItem],
          total: 1,
        });
      }

      if (
        url ===
        "/api/admin/users/3"
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
          "/admin/users/3",
        ]}
      >
        <Routes>
          <Route
            path="/admin/users/:id"
            element={
              <AdminUserDetail />
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );


const requestCount = (
  fragment
) =>
  requestJson.mock.calls
    .filter(
      ([url]) =>
        String(url).includes(
          fragment
        )
    )
    .length;


describe(
  "AdminUserDetail secondary tabs and modal i18n",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      arrangeRequests();
    });


    test(
      "derives submission presentation from technical counters without language refetch",
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
                /Submissions/i,
            }
          )
        );

        expect(
          await screen.findByText(
            "Approved",
            {
              selector:
                ".admin-submission-status",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Con ejecuciones aprobadas"
          )
        ).not.toBeInTheDocument();

        expect(
          screen.getByRole(
            "link",
            {
              name:
                /Experimento canónico ID 42/i,
            }
          )
        ).toHaveAttribute(
          "href",
          "/submissions/42"
        );

        expect(
          requestCount(
            "/submissions?"
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
            "Con ejecuciones aprobadas",
            {
              selector:
                ".admin-submission-status",
            }
          )
        ).toBeInTheDocument();

        expect(
          requestCount(
            "/submissions?"
          )
        ).toBe(1);
      }
    );


    test(
      "localizes audit chrome while preserving persisted audit content",
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
                "Activity",
            }
          )
        );

        expect(
          await screen.findByText(
            "Persisted audit-log actions for this user."
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "USER_ROLE_UPDATED"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Rol cambiado por admin"
          )
        ).toBeInTheDocument();

        expect(
          requestCount(
            "/audit-log?"
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
            "Acciones persistidas en el registro de auditoría."
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "USER_ROLE_UPDATED"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Rol cambiado por admin"
          )
        ).toBeInTheDocument();

        expect(
          requestCount(
            "/audit-log?"
          )
        ).toBe(1);
      }
    );


    test(
      "localizes modal from canonical state and preserves technical routes without refetch",
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
            "Intel Core i7"
          )
        ).toBeInTheDocument();

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
          requestCount(
            "/api/admin/executions/70"
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
            "Completado"
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
          requestCount(
            "/api/admin/executions/70"
          )
        ).toBe(1);
      }
    );
  }
);
