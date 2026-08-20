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
    lastExecutionAt:
      "2026-08-20T12:00:00Z",
  },
};


function arrangeSuccess() {
  requestJson.mockImplementation(
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


describe(
  "AdminUserDetail shell and executions i18n",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
      arrangeSuccess();
    });


    test(
      "localizes technical profile and execution state without refetching",
      async () => {
        renderEnglish();

        expect(
          await screen.findByText(
            "exec70LCS"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "User details",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Student",
            {
              selector:
                ".admin-user-role-chip",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Active",
            {
              selector:
                ".admin-user-overview-badges .app-status-badge",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Completed",
            {
              selector:
                ".admin-detail-table .app-status-badge",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Completada",
            {
              selector:
                ".admin-detail-table .app-status-badge",
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
            requestJson
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
          screen.getByRole(
            "heading",
            {
              name:
                "Detalle de usuario",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Estudiante",
            {
              selector:
                ".admin-user-role-chip",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Activo",
            {
              selector:
                ".admin-user-overview-badges .app-status-badge",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Completado",
            {
              selector:
                ".admin-detail-table .app-status-badge",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "1,50 s"
          )
        ).toBeInTheDocument();

        expect(
          requestJson
        ).toHaveBeenCalledTimes(2);
      }
    );


    test(
      "preserves canonical execution status filter values",
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
              value:
                "FAILED",
            },
          }
        );

        await waitFor(() =>
          expect(
            requestJson.mock.calls
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


    test(
      "reactively localizes profile service errors without repeating request",
      async () => {
        requestJson.mockImplementation(
          (url) => {
            if (
              url ===
              "/api/admin/users/3"
            ) {
              return Promise.reject({
                status: 500,
                code:
                  "INTERNAL_ERROR",
                message:
                  "Error interno del servidor.",
              });
            }

            return Promise.resolve({});
          }
        );

        renderEnglish();

        expect(
          await screen.findByText(
            "The service is temporarily unavailable. Try again in a few moments."
          )
        ).toBeInTheDocument();

        expect(
          requestJson
        ).toHaveBeenCalledTimes(1);

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
          requestJson
        ).toHaveBeenCalledTimes(1);
      }
    );
  }
);
