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


function profile(role) {
  return {
    id: 3,
    full_name: "Ada Lovelace",
    email: "ada@example.com",
    role,
    isActive: true,
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


function arrangeRole({
  initialRole,
  patchError = null,
}) {
  let currentRole = initialRole;

  requestJson.mockImplementation(
    (url, options = {}) => {
      if (
        url
          === "/api/admin/users/3/role"
        && options.method === "PATCH"
      ) {
        if (patchError) {
          return Promise.reject(
            patchError
          );
        }

        const payload =
          JSON.parse(options.body);
        currentRole = payload.role;

        return Promise.resolve({
          user: {
            id: 3,
            role: currentRole,
            changed: true,
          },
        });
      }

      if (
        url
        === "/api/admin/users/3"
      ) {
        return Promise.resolve({
          profile:
            profile(currentRole),
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
  "AdminUserDetail Iteration 3 role lifecycle",
  () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });


    test(
      "promotes Student to Teacher and updates the profile without a full-page reload",
      async () => {
        arrangeRole({
          initialRole: "Student",
        });
        renderPage();

        fireEvent.click(
          await screen.findByRole(
            "button",
            {
              name:
                "Promover a profesor",
            }
          )
        );

        const dialog =
          screen.getByRole(
            "dialog",
            {
              name:
                "Confirmar cambio de rol",
            }
          );

        fireEvent.click(
          within(dialog).getByRole(
            "button",
            {
              name:
                "Promover a profesor",
            }
          )
        );

        await waitFor(() =>
          expect(
            requestJson
          ).toHaveBeenCalledWith(
            "/api/admin/users/3/role",
            expect.objectContaining({
              method: "PATCH",
              body:
                JSON.stringify({
                  role: "Teacher",
                }),
            }),
            expect.any(Object)
          )
        );

        expect(
          await screen.findByText(
            "Docente"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Cambiar a estudiante",
            }
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "keeps a guarded Teacher demotion open and renders assigned courses inline",
      async () => {
        arrangeRole({
          initialRole: "Teacher",
          patchError: {
            status: 409,
            code:
              "USER_HAS_ASSIGNED_COURSES",
            payload: {
              error: {
                code:
                  "USER_HAS_ASSIGNED_COURSES",
                assignedCourses: 2,
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
                "Cambiar a estudiante",
            }
          )
        );

        const dialog =
          screen.getByRole(
            "dialog",
            {
              name:
                "Confirmar cambio de rol",
            }
          );

        fireEvent.click(
          within(dialog).getByRole(
            "button",
            {
              name:
                "Cambiar a estudiante",
            }
          )
        );

        expect(
          await within(dialog).findByRole(
            "alert"
          )
        ).toHaveTextContent(
          "Cursos asignados: 2. Transfiérelos antes de cambiar el rol."
        );
        expect(
          screen.getByText(
            "Docente"
          )
        ).toBeInTheDocument();
      }
    );


    test(
      "does not expose routine role controls for Admin profiles",
      async () => {
        arrangeRole({
          initialRole: "Admin",
        });
        renderPage();

        expect(
          await screen.findByText(
            "Administrador"
          )
        ).toBeInTheDocument();
        expect(
          screen.queryByText(
            "Gestión de rol"
          )
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole(
            "button",
            {
              name:
                "Cambiar a estudiante",
            }
          )
        ).not.toBeInTheDocument();
      }
    );
  }
);
