import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Login from "./Login";
import { I18nProvider } from "../i18n";

const renderLogin = ({
  language = "es",
  route = "/login",
} = {}) =>
  render(
    <I18nProvider initialLanguage={language}>
      <MemoryRouter initialEntries={[route]}>
        <Login />
      </MemoryRouter>
    </I18nProvider>
  );

describe("Login i18n", () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("renders the public login shell in Spanish by default", () => {
    renderLogin();

    expect(
      screen.getByRole("heading", {
        name: /^Acceso institucional$/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Continuar con Google/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("group", {
        name: /^Idioma$/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(
        "Correo del profesor responsable"
      )
    ).toHaveAttribute(
      "placeholder",
      "profesor@inf.udec.cl"
    );
    expect(
      document.querySelector(
        ".login-footer-text"
      )
    ).toHaveTextContent(
      "jfuentess@inf.udec.cl"
    );
    expect(document.body).not.toHaveTextContent(
      [
        "josefuentes",
        "inf.udec.cl",
      ].join("@")
    );

    expect(
      document.querySelector(
        ".login-meta-text"
      )
    ).toHaveTextContent(
      "Cuando tu cuenta sea aprobada"
    );
    expect(
      document.querySelector(
        ".login-meta-text"
      )
    ).not.toHaveTextContent(
      /correo de confirmación/i
    );
  });

  test("renders the login shell in English and can switch back to Spanish", () => {
    renderLogin({ language: "en" });

    expect(
      screen.getByRole("heading", {
        name: /^Institutional access$/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", {
        name: /Continue with Google/i,
      })
    ).toBeInTheDocument();

    expect(
      document.querySelector(
        ".login-meta-text"
      )
    ).toHaveTextContent(
      "Once your account is approved"
    );
    expect(
      document.querySelector(
        ".login-meta-text"
      )
    ).not.toHaveTextContent(
      /confirmation email/i
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Switch language to Spanish/i,
      })
    );

    expect(
      screen.getByRole("heading", {
        name: /^Acceso institucional$/i,
      })
    ).toBeInTheDocument();
  });

  test("validation messages follow the current language", () => {
    renderLogin({ language: "en" });

    fireEvent.click(
      screen.getByRole("button", {
        name: /^Submit access request$/i,
      })
    );

    expect(
      screen.getByText("Full name is required.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Institutional email is required.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Enter the responsible professor's email."
      )
    ).toBeInTheDocument();

    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Switch language to Spanish/i,
      })
    );

    expect(
      screen.getByText(
        "El nombre completo es obligatorio."
      )
    ).toBeInTheDocument();
  });

  test("known OAuth codes are localized instead of exposing the backend message", () => {
    renderLogin({
      language: "en",
      route:
        "/login?auth_status=error" +
        "&auth_code=INVALID_OAUTH_STATE" +
        "&auth_message=MENSAJE_BACKEND_EN_ES",
    });

    expect(
      screen.getByRole("status")
    ).toHaveTextContent(
      "The sign-in request expired or is invalid. Try again."
    );

    expect(
      screen.queryByText("MENSAJE_BACKEND_EN_ES")
    ).not.toBeInTheDocument();
  });

  test("normalizes mixed-case emails and explains approval email delivery", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        id: 10,
        status: "PENDING",
      }),
    });
    renderLogin();

    fireEvent.change(
      screen.getByLabelText("Nombre completo"),
      {
        target: {
          value: "Ada Lovelace",
        },
      }
    );
    fireEvent.change(
      screen.getByLabelText(
        "Correo institucional UdeC"
      ),
      {
        target: {
          value: "  Alumno@UDEC.CL  ",
        },
      }
    );
    fireEvent.change(
      screen.getByLabelText(
        "Correo del profesor responsable"
      ),
      {
        target: {
          value: "  Profesor@INF.UDEC.CL  ",
        },
      }
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Enviar solicitud de acceso",
      })
    );

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledTimes(1)
    );
    const [, options] = global.fetch.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual(
      expect.objectContaining({
        email: "alumno@udec.cl",
        professor_email:
          "profesor@inf.udec.cl",
      })
    );
    expect(
      await screen.findByText(
        /Recibirás un correo cuando sea aprobada/i
      )
    ).toBeInTheDocument();
  });
});
