import React, {
  useState,
} from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
import {
  AdminPendingRequestsContext,
} from "./adminPendingRequestsContext";


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


const resolvedListPayload = {
  items: [],
  summary: {
    pending: 0,
    approved: 3,
    rejected: 3,
  },
  page: 1,
  pageSize: 20,
  total: 0,
};


const PendingCountHarness = ({
  children,
}) => {
  const [
    pendingCount,
    setPendingCount,
  ] = useState(0);

  return (
    <AdminPendingRequestsContext.Provider
      value={{
        pendingCount,
        setPendingCount,
        refreshPendingCount:
          async () => {},
      }}
    >
      <output aria-label="pending-count">
        {pendingCount}
      </output>
      {children}
    </AdminPendingRequestsContext.Provider>
  );
};


const renderEnglish = () =>
  render(
    <I18nProvider
      initialLanguage="en"
    >
      <LanguageControl />
      <PendingCountHarness>
        <AdminAccessRequests />
      </PendingCountHarness>
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


const arrangeResolvedListAfter = (
  actionPath
) => {
  let listRequest = 0;

  requestJson.mockImplementation(
    (url) => {
      if (
        String(url).includes(
          "/api/admin/access-requests?"
        )
      ) {
        listRequest += 1;
        return Promise.resolve(
          listRequest === 1
            ? listPayload
            : resolvedListPayload
        );
      }

      if (url === actionPath) {
        return Promise.resolve({});
      }

      return Promise.resolve({});
    }
  );
};


describe(
  "AdminAccessRequests i18n and decisions",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();

      requestJson.mockResolvedValue(
        listPayload
      );

      window.confirm =
        jest.fn();
      window.prompt =
        jest.fn();
      window.alert =
        jest.fn();
    });


    afterEach(() => {
      delete window.confirm;
      delete window.prompt;
      delete window.alert;
    });


    test(
      "shows comment as its own column and removes the redundant requested role",
      async () => {
        renderEnglish();

        expect(
          await screen.findByText(
            "ada@example.com"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Comment",
            {
              selector: "th",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.getByText(
            "Necesito acceso para el curso.",
            {
              selector:
                ".admin-ops-comment",
            }
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Requested role"
          )
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText(
            "Teacher"
          )
        ).not.toBeInTheDocument();

        expect(
          screen.getByText(
            "Pending",
            {
              selector:
                ".admin-ops-status",
            }
          )
        ).toBeInTheDocument();
        expect(listCalls()).toBe(1);

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
          screen.getByText(
            "Comentario",
            {
              selector: "th",
            }
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
            "Necesito acceso para el curso.",
            {
              selector:
                ".admin-ops-comment",
            }
          )
        ).toBeInTheDocument();
        expect(listCalls()).toBe(1);
      }
    );


    test(
      "preserves canonical status filter values",
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
      }
    );


    test(
      "approves through the shared modal and refreshes the list and pending count",
      async () => {
        arrangeResolvedListAfter(
          "/api/admin/access-requests/10/approve"
        );
        renderEnglish();

        await screen.findByText(
          "ada@example.com"
        );
        await waitFor(() =>
          expect(
            screen.getByLabelText(
              "pending-count"
            )
          ).toHaveTextContent("1")
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name: "Approve",
            }
          )
        );

        const dialog =
          screen.getByRole(
            "dialog",
            {
              name:
                "Approve access request #10",
            }
          );

        expect(
          within(dialog).getByText(
            "Ada Lovelace"
          )
        ).toBeInTheDocument();
        expect(
          within(dialog).getByText(
            "prof@inf.udec.cl"
          )
        ).toBeInTheDocument();

        fireEvent.click(
          within(dialog).getByRole(
            "button",
            {
              name: "Approve",
            }
          )
        );

        await waitFor(() =>
          expect(
            requestJson.mock.calls
              .some(
                ([url, options]) =>
                  url
                    === "/api/admin/access-requests/10/approve"
                  && options?.method
                    === "POST"
              )
          ).toBe(true)
        );
        await waitFor(() =>
          expect(
            screen.queryByRole(
              "dialog"
            )
          ).not.toBeInTheDocument()
        );
        await waitFor(() =>
          expect(
            screen.getByLabelText(
              "pending-count"
            )
          ).toHaveTextContent("0")
        );
        expect(listCalls()).toBe(2);
        expect(window.confirm).not.toHaveBeenCalled();
        expect(window.prompt).not.toHaveBeenCalled();
        expect(window.alert).not.toHaveBeenCalled();
      }
    );


    test(
      "rejects through a danger modal and posts the optional reason",
      async () => {
        arrangeResolvedListAfter(
          "/api/admin/access-requests/10/reject"
        );
        renderEnglish();

        await screen.findByText(
          "ada@example.com"
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name: "Reject",
            }
          )
        );

        const dialog =
          screen.getByRole(
            "dialog",
            {
              name:
                "Reject access request #10",
            }
          );

        expect(dialog).toHaveClass(
          "confirm-action-modal--danger"
        );

        fireEvent.change(
          within(dialog).getByLabelText(
            "Rejection reason (optional)"
          ),
          {
            target: {
              value:
                "Course is not active",
            },
          }
        );

        fireEvent.click(
          within(dialog).getByRole(
            "button",
            {
              name: "Reject",
            }
          )
        );

        await waitFor(() => {
          const actionCall =
            requestJson.mock.calls.find(
              ([url]) =>
                url
                  === "/api/admin/access-requests/10/reject"
            );

          expect(actionCall).toBeDefined();
          expect(
            JSON.parse(
              actionCall[1].body
            )
          ).toEqual({
            reason:
              "Course is not active",
          });
        });

        await waitFor(() =>
          expect(
            screen.getByLabelText(
              "pending-count"
            )
          ).toHaveTextContent("0")
        );
        expect(window.confirm).not.toHaveBeenCalled();
        expect(window.prompt).not.toHaveBeenCalled();
        expect(window.alert).not.toHaveBeenCalled();
      }
    );


    test(
      "keeps resolve errors inline and reactively localizes them",
      async () => {
        requestJson.mockImplementation(
          (url) => {
            if (
              String(url).includes(
                "/api/admin/access-requests?"
              )
            ) {
              return Promise.resolve(
                listPayload
              );
            }

            return Promise.reject({
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
          }
        );
        renderEnglish();

        await screen.findByText(
          "ada@example.com"
        );
        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name: "Approve",
            }
          )
        );

        const dialog =
          screen.getByRole(
            "dialog"
          );
        fireEvent.click(
          within(dialog).getByRole(
            "button",
            {
              name: "Approve",
            }
          )
        );

        expect(
          await within(dialog).findByRole(
            "alert"
          )
        ).toHaveTextContent(
          "The service is temporarily unavailable. Try again in a few moments."
        );
        expect(
          screen.getByRole(
            "dialog"
          )
        ).toBeInTheDocument();
        expect(window.alert).not.toHaveBeenCalled();

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
            "alert"
          )
        ).toHaveTextContent(
          "El servicio no está disponible temporalmente. Inténtalo nuevamente en unos momentos."
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
        expect(listCalls()).toBe(1);

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
        expect(listCalls()).toBe(1);
      }
    );
  }
);
