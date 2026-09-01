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
} from "../i18n";
import AdminUser from "./AdminUser";


const listPayload = {
  items: [],
  summary: {
    total: 0,
    active: 0,
    inactive: 0,
  },
  total: 0,
  filteredTotal: 0,
};


function response({
  ok = true,
  status = 200,
  data = listPayload,
} = {}) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
  };
}


function renderPage(language = "es") {
  return render(
    <I18nProvider initialLanguage={language}>
      <MemoryRouter>
        <AdminUser />
      </MemoryRouter>
    </I18nProvider>
  );
}


describe("AdminUser preauthorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test("creates a generic Teacher preauthorization and reloads the list", async () => {
    global.fetch = jest.fn((url, options = {}) => {
      if (
        url === "/api/admin/users"
        && options.method === "POST"
      ) {
        return Promise.resolve(
          response({
            status: 201,
            data: {
              user: {
                id: 42,
                fullName: "External Evaluator",
                email: "evaluator@example.com",
                role: "Teacher",
                isActive: true,
                preauthorized: true,
              },
            },
          })
        );
      }

      if (
        String(url).startsWith(
          "/api/admin/users?"
        )
      ) {
        return Promise.resolve(response());
      }

      return Promise.reject(
        new Error(`Unexpected request ${url}`)
      );
    });

    renderPage();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Preautorizar usuario",
      })
    );

    fireEvent.change(
      screen.getByLabelText("Nombre completo"),
      {
        target: {
          value: "  External Evaluator  ",
        },
      }
    );

    fireEvent.change(
      screen.getByLabelText("Correo exacto"),
      {
        target: {
          value: " Evaluator@Example.COM ",
        },
      }
    );

    fireEvent.change(
      screen.getByLabelText("Rol inicial"),
      {
        target: {
          value: "Teacher",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Crear preautorización",
      })
    );

    await waitFor(() => {
      const postCall =
        global.fetch.mock.calls.find(
          ([url, options]) =>
            url === "/api/admin/users"
            && options?.method === "POST"
        );

      expect(postCall).toBeTruthy();

      const body = JSON.parse(
        postCall[1].body
      );

      expect(body).toEqual({
        fullName: "External Evaluator",
        email: "Evaluator@Example.COM",
        role: "Teacher",
      });
    });

    expect(
      await screen.findByRole("status")
    ).toHaveTextContent(
      /preautorizado correctamente/i
    );

    await waitFor(() => {
      const listCalls =
        global.fetch.mock.calls.filter(
          ([url]) =>
            String(url).startsWith(
              "/api/admin/users?"
            )
        );

      expect(
        listCalls.length
      ).toBeGreaterThanOrEqual(2);
    });
  });

  test("maps existing-email conflict in English", async () => {
    global.fetch = jest.fn((url, options = {}) => {
      if (
        url === "/api/admin/users"
        && options.method === "POST"
      ) {
        return Promise.resolve(
          response({
            ok: false,
            status: 409,
            data: {
              error: {
                code: "USER_EMAIL_EXISTS",
                message: "mensaje backend",
              },
            },
          })
        );
      }

      return Promise.resolve(response());
    });

    renderPage("en");

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Preauthorize user",
      })
    );

    fireEvent.change(
      screen.getByLabelText("Full name"),
      {
        target: {
          value: "Known User",
        },
      }
    );

    fireEvent.change(
      screen.getByLabelText("Exact email"),
      {
        target: {
          value: "known@example.com",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Create preauthorization",
      })
    );

    expect(
      await screen.findByRole("status")
    ).toHaveTextContent(
      "That email already exists."
    );

    expect(
      screen.queryByText("mensaje backend")
    ).not.toBeInTheDocument();
  });
});
