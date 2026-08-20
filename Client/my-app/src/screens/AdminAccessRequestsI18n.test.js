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

import AdminAccessRequests
  from "./AdminAccessRequests";


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


const requestItem = {
  id: 10,
  status: "PENDING",
  user: {
    id: 42,
    fullName:
      "Ada Lovelace",
    email:
      "ada@example.com",
    roleName: "Teacher",
  },
  professorEmail:
    "prof@inf.udec.cl",
  courseCode: "INF-123",
  message:
    "Necesito acceso para el curso.",
  createdAt:
    "2026-08-20T12:00:00Z",
  resolvedAt: null,
  resolvedBy: null,
};


const listPayload = {
  items: [requestItem],
  summary: {
    pending: 1,
    approved: 2,
    rejected: 3,
  },
  page: 1,
  pageSize: 20,
  total: 1,
};


const renderEnglish = () =>
  render(
    <I18nProvider
      initialLanguage="en"
    >
      <LanguageControl />
      <AdminAccessRequests />
    </I18nProvider>
  );


const listCalls = () =>
  requestJson.mock.calls
    .filter(
      ([url]) =>
        String(url).includes(
          "/api/admin/access-requests?"
        )
    )
    .length;


describe(
  "AdminAccessRequests i18n",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      requestJson.mockResolvedValue(
        listPayload
      );

      window.confirm =
        jest.fn()
          .mockReturnValue(
            true
          );

      window.prompt =
        jest.fn()
          .mockReturnValue(
            ""
          );

      window.alert =
        jest.fn();
    });


    afterEach(() => {
      delete window.confirm;
      delete window.prompt;
      delete window.alert;
    });


    test(
      "localizes technical status and role without refetching on language change",
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
              name:
                "Access requests",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Teacher"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Pending",
            {
              selector:
                ".admin-ops-status",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Necesito acceso para el curso."
          )
        ).toBeInTheDocument();

        expect(
          listCalls()
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
                "Solicitudes de acceso",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Docente"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Pendiente",
            {
              selector:
                ".admin-ops-status",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Necesito acceso para el curso."
          )
        ).toBeInTheDocument();

        expect(
          listCalls()
        ).toBe(1);
      }
    );


    test(
      "preserves technical filters and localizes approve confirmation",
      async () => {
        renderEnglish();

        await screen.findByText(
          "ada@example.com"
        );

        fireEvent.change(
          screen.getByLabelText(
            "Status"
          ),
          {
            target: {
              value:
                "APPROVED",
            },
          }
        );

        await waitFor(() =>
          expect(
            requestJson.mock.calls
              .some(
                ([url]) =>
                  String(url).includes(
                    "status=APPROVED"
                  )
              )
          ).toBe(true)
        );

        fireEvent.change(
          screen.getByLabelText(
            "Status"
          ),
          {
            target: {
              value:
                "PENDING",
            },
          }
        );

        await screen.findByRole(
          "button",
          {
            name:
              "Approve",
          }
        );

        requestJson.mockResolvedValue(
          {}
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Approve",
            }
          )
        );

        expect(
          window.confirm
        ).toHaveBeenCalledWith(
          "Approve access request #10?"
        );

        await waitFor(() =>
          expect(
            requestJson.mock.calls
              .some(
                ([url, options]) =>
                  String(url)
                    ===
                    "/api/admin/access-requests/10/approve"
                  &&
                  options?.method
                    === "POST"
              )
          ).toBe(true)
        );
      }
    );


    test(
      "reactively localizes list errors without repeating the failed request",
      async () => {
        requestJson.mockRejectedValue({
          status: 500,
          code:
            "INTERNAL_ERROR",
          payload: {
            error: {
              message:
                "Error interno del servidor.",
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
          listCalls()
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
          listCalls()
        ).toBe(1);
      }
    );
  }
);
