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

import AdminUser
  from "./AdminUser";


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


const user = {
  id: 7,
  name: "Grace Hopper",
  email: "grace@example.com",
  role: "Teacher",
  isActive: true,
  status: "Activo",
  createdAt:
    "2026-08-10T12:00:00Z",
  submissionsCount: 2,
  executionsCount: 3,
  completedExecutions: 2,
  failedExecutions: 1,
  queuedExecutions: 0,
  runningExecutions: 0,
  processingExecutions: 0,
  cancelledExecutions: 0,
  lastExecutionState:
    "COMPLETED",
  lastExecutionStatus:
    "Completado",
  lastExecutionAt:
    "2026-08-20T12:00:00Z",
};


const payload = {
  items: [user],
  summary: {
    total: 1,
    active: 1,
    inactive: 0,
  },
  total: 1,
  filteredTotal: 1,
};


const okResponse = (
  data = payload
) => ({
  ok: true,
  status: 200,
  json:
    jest.fn()
      .mockResolvedValue(
        data
      ),
});


const renderEnglish = () =>
  render(
    <I18nProvider
      initialLanguage="en"
    >
      <LanguageControl />

      <MemoryRouter>
        <AdminUser />
      </MemoryRouter>
    </I18nProvider>
  );


describe(
  "AdminUser i18n",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      global.fetch =
        jest.fn()
          .mockResolvedValue(
            okResponse()
          );
    });


    afterEach(() => {
      delete global.fetch;
    });


    test(
      "localizes roles, account state and canonical execution state without refetching",
      async () => {
        renderEnglish();

        expect(
          await screen.findByText(
            "grace@example.com"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "heading",
            {
              name: "Users",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Teacher",
            {
              selector:
                ".admin-user-role",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Active",
            {
              selector:
                ".app-status-badge",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Completed",
            {
              selector:
                ".admin-last-execution .app-status-badge",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Completado",
            {
              selector:
                ".admin-last-execution .app-status-badge",
            }
          )
        ).not.toBeInTheDocument();

        await waitFor(() =>
          expect(
            global.fetch
          ).toHaveBeenCalledTimes(1)
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
            "Docente",
            {
              selector:
                ".admin-user-role",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Activo",
            {
              selector:
                ".app-status-badge",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Completado",
            {
              selector:
                ".admin-last-execution .app-status-badge",
            }
          )
        ).toBeInTheDocument();

        expect(
          global.fetch
        ).toHaveBeenCalledTimes(1);
      }
    );


    test(
      "uses the technical account-status filter value",
      async () => {
        renderEnglish();

        await screen.findByText(
          "grace@example.com"
        );

        fireEvent.change(
          screen.getByLabelText(
            "Status"
          ),
          {
            target: {
              value:
                "inactive",
            },
          }
        );

        await waitFor(() =>
          expect(
            global.fetch.mock.calls
              .some(
                ([url]) =>
                  String(url).includes(
                    "status=inactive"
                  )
              )
          ).toBe(true)
        );

        expect(
          global.fetch.mock.calls
            .some(
              ([url]) =>
                String(url).includes(
                  "status=Inactivo"
                )
            )
        ).toBe(false);
      }
    );


    test(
      "reactively localizes service errors without repeating the request",
      async () => {
        global.fetch =
          jest.fn()
            .mockResolvedValue({
              ok: false,
              status: 500,
            });

        renderEnglish();

        expect(
          await screen.findByText(
            "The service is temporarily unavailable. Try again in a few moments."
          )
        ).toBeInTheDocument();

        expect(
          global.fetch
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
          global.fetch
        ).toHaveBeenCalledTimes(1);
      }
    );
  }
);
