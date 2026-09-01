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
  requestJson,
} from "../common/requestErrorModel";
import AdminUserDetail
  from "./AdminUserDetail";


jest.mock(
  "../common/requestErrorModel",
  () => ({
    requestJson: jest.fn(),
  })
);


const summary = {
  submissionsCount: 0,
  executionsCount: 0,
  completedExecutions: 0,
  failedExecutions: 0,
  queuedExecutions: 0,
  runningExecutions: 0,
  processingExecutions: 0,
  cancelledExecutions: 0,
};


function profile({
  role = "Student",
  isActive = true,
} = {}) {
  return {
    id: 3,
    full_name: "Ada Lovelace",
    email: "ada@example.com",
    role,
    isActive,
    createdAt: null,
    lastLogin: null,
  };
}


function renderPage() {
  return render(
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
  );
}


function arrangeAccess({
  role = "Student",
  initialActive = true,
  patchError = null,
} = {}) {
  let currentActive =
    initialActive;

  requestJson.mockImplementation(
    (url, options = {}) => {
      if (
        url
          === "/api/admin/users/3/access"
        && options.method
          === "PATCH"
      ) {
        if (patchError) {
          return Promise.reject(
            patchError
          );
        }

        const payload =
          JSON.parse(
            options.body
          );

        currentActive =
          payload.isActive;

        return Promise.resolve({
          user: {
            id: 3,
            isActive:
              currentActive,
            changed: true,
          },
          invalidatedSessions:
            currentActive
              ? 0
              : 2,
        });
      }

      if (
        url
        === "/api/admin/users/3"
      ) {
        return Promise.resolve({
          profile:
            profile({
              role,
              isActive:
                currentActive,
            }),
          summary,
        });
      }

      return Promise.resolve({
        items: [],
        total: 0,
      });
    }
  );
}


describe(
  "AdminUserDetail access lifecycle",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });


    test(
      "revokes an active user through the explicit access endpoint",
      async () => {
        arrangeAccess({
          initialActive: true,
        });
        renderPage();

        fireEvent.click(
          await screen.findByRole(
            "button",
            {
              name:
                "Revocar acceso",
            }
          )
        );

        const dialog =
          screen.getByRole(
            "dialog",
            {
              name:
                "Confirmar revocación de acceso",
            }
          );

        fireEvent.click(
          within(dialog).getByRole(
            "button",
            {
              name:
                "Revocar acceso",
            }
          )
        );

        await waitFor(() =>
          expect(
            requestJson
          ).toHaveBeenCalledWith(
            "/api/admin/users/3/access",
            expect.objectContaining({
              method: "PATCH",
              body:
                JSON.stringify({
                  isActive: false,
                }),
            }),
            expect.any(Object)
          )
        );

        expect(
          await screen.findByText(
            "Inactivo"
          )
        ).toBeInTheDocument();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Reactivar acceso",
            }
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "reactivates an inactive user without restoring previous sessions",
      async () => {
        arrangeAccess({
          role: "Teacher",
          initialActive: false,
        });
        renderPage();

        fireEvent.click(
          await screen.findByRole(
            "button",
            {
              name:
                "Reactivar acceso",
            }
          )
        );

        const dialog =
          screen.getByRole(
            "dialog",
            {
              name:
                "Confirmar reactivación de acceso",
            }
          );

        expect(dialog).toHaveTextContent(
          /iniciar sesión nuevamente con Google/i
        );

        fireEvent.click(
          within(dialog).getByRole(
            "button",
            {
              name:
                "Reactivar acceso",
            }
          )
        );

        await waitFor(() =>
          expect(
            requestJson
          ).toHaveBeenCalledWith(
            "/api/admin/users/3/access",
            expect.objectContaining({
              method: "PATCH",
              body:
                JSON.stringify({
                  isActive: true,
                }),
            }),
            expect.any(Object)
          )
        );

        expect(
          await screen.findByText(
            "Activo"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "keeps pending UdeC requests in their dedicated approval flow",
      async () => {
        arrangeAccess({
          initialActive: false,
          patchError: {
            status: 409,
            code:
              "USER_HAS_PENDING_ACCESS_REQUEST",
            payload: {
              error: {
                code:
                  "USER_HAS_PENDING_ACCESS_REQUEST",
              },
            },
          },
        });
        renderPage();

        fireEvent.click(
          await screen.findByRole(
            "button",
            {
              name:
                "Reactivar acceso",
            }
          )
        );

        const dialog =
          screen.getByRole(
            "dialog",
            {
              name:
                "Confirmar reactivación de acceso",
            }
          );

        fireEvent.click(
          within(dialog).getByRole(
            "button",
            {
              name:
                "Reactivar acceso",
            }
          )
        );

        expect(
          await within(dialog)
            .findByRole("alert")
        ).toHaveTextContent(
          /solicitud UdeC pendiente/i
        );

        expect(
          screen.getByText(
            "Inactivo"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "does not expose routine access controls for Admin profiles",
      async () => {
        arrangeAccess({
          role: "Admin",
          initialActive: true,
        });
        renderPage();

        expect(
          await screen.findByText(
            "Administrador"
          )
        ).toBeInTheDocument();

        expect(
          screen.queryByText(
            "Gestión de acceso"
          )
        ).not.toBeInTheDocument();

        expect(
          screen.queryByRole(
            "button",
            {
              name:
                "Revocar acceso",
            }
          )
        ).not.toBeInTheDocument();
      }
    );
  }
);
