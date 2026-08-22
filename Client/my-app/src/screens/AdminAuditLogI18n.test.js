import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import {
  I18nProvider,
  useI18n,
} from "../i18n";

import {
  requestJson,
} from "../common/requestErrorModel";

import AdminAuditLog
  from "./AdminAuditLog";


jest.mock(
  "../common/requestErrorModel",
  () => ({
    ...jest.requireActual(
      "../common/requestErrorModel"
    ),
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


const auditItem = {
  id: 101,
  userId: 1,
  userName: "Admin INF",
  userEmail:
    "admin@inf.udec.cl",
  action:
    "approve_access_request",
  description:
    "Solicitud de acceso #10 APROBADA para el usuario ada@example.com.",
  createdAt:
    "2026-08-20T12:00:00Z",
};


const unknownAuditItem = {
  ...auditItem,
  id: 102,
  action:
    "legacy_custom_action",
  description:
    "Descripción histórica sin transformar.",
};


const payload = {
  items: [
    auditItem,
    unknownAuditItem,
  ],
  page: 1,
  pageSize: 25,
  total: 2,
};


const renderEnglish = () =>
  render(
    <I18nProvider
      initialLanguage="en"
    >
      <LanguageControl />
      <AdminAuditLog />
    </I18nProvider>
  );


const auditCalls = () =>
  requestJson.mock.calls
    .filter(
      ([url]) =>
        String(url).includes(
          "/api/admin/audit-log?"
        )
    )
    .length;


describe(
  "AdminAuditLog i18n",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      requestJson.mockResolvedValue(
        payload
      );
    });


    test(
      "humanizes known actions, preserves technical codes, and falls back safely",
      async () => {
        renderEnglish();

        expect(
          await screen.findByText(
            "approve_access_request",
            {
              selector: "code",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Access request approved",
            {
              selector:
                ".admin-audit-action strong",
            }
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "Unknown action"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "legacy_custom_action",
            {
              selector: "code",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Audit log",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Solicitud de acceso #10 APROBADA para el usuario ada@example.com."
          )
        ).toBeInTheDocument();

        expect(
          auditCalls()
        ).toBe(1);

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "switch-es",
            }
          )
        );

        expect(
          screen.getByRole(
            "heading",
            {
              name:
                "Auditoría",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Solicitud de acceso aprobada",
            {
              selector:
                ".admin-audit-action strong",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "approve_access_request",
            {
              selector: "code",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Acción desconocida"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText(
            "Descripción histórica sin transformar."
          )
        ).toBeInTheDocument();

        expect(
          auditCalls()
        ).toBe(1);
      }
    );


    test(
      "preserves exact technical audit filters and end-of-day upper bound",
      async () => {
        renderEnglish();

        await screen.findByText(
          "approve_access_request",
          {
            selector: "code",
          }
        );

        fireEvent.change(
          screen.getByLabelText(
            "Action"
          ),
          {
            target: {
              value:
                "reject_access_request",
            },
          }
        );

        fireEvent.change(
          screen.getByLabelText(
            "From"
          ),
          {
            target: {
              value:
                "2026-08-01",
            },
          }
        );

        fireEvent.change(
          screen.getByLabelText(
            "To"
          ),
          {
            target: {
              value:
                "2026-08-20",
            },
          }
        );

        await waitFor(() =>
          expect(
            requestJson.mock.calls
              .some(
                ([url]) => {
                  const value =
                    String(url);

                  return (
                    value.includes(
                      "action=reject_access_request"
                    )
                    &&
                    value.includes(
                      "from=2026-08-01"
                    )
                    &&
                    (
                      value.includes(
                        "to=2026-08-20T23%3A59%3A59.999999"
                      )
                      ||
                      value.includes(
                        "to=2026-08-20T23:59:59.999999"
                      )
                    )
                    &&
                    value.includes(
                      "page_size=25"
                    )
                  );
                }
              )
          ).toBe(true)
        );
      }
    );


    test(
      "reactively localizes service errors without repeating the failed request",
      async () => {
        requestJson.mockRejectedValue({
          status: 500,
          code:
            "INTERNAL_ERROR",
          payload: {
            error: {
              message:
                "psycopg2.OperationalError",
            },
          },
        });

        renderEnglish();

        expect(
          await screen.findByText(
            "The service is temporarily unavailable. Try again in a few moments."
          )
        ).toBeInTheDocument();

        expect(
          auditCalls()
        ).toBe(1);

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "switch-es",
            }
          )
        );

        expect(
          await screen.findByText(
            "El servicio no está disponible temporalmente. Inténtalo nuevamente en unos momentos."
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            /psycopg2/i
          )
        ).not.toBeInTheDocument();

        expect(
          auditCalls()
        ).toBe(1);
      }
    );
  }
);
