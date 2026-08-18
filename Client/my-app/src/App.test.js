import React from "react";
import {
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import App from "./App";

jest.mock("react-plotly.js", () => () => (
  <div data-testid="plotly-chart" />
));

jest.mock("./screens/RenderForm", () => () => (
  <div data-testid="screen-render-form">
    Nuevo análisis
  </div>
));

jest.mock("./screens/RenderImage", () => ({ currentUser }) => (
  <div
    data-testid="screen-render-image"
    data-current-user-email={currentUser?.email || ""}
  >
    Resultados
  </div>
));

jest.mock("./screens/SubmissionOverviewPage", () => ({ currentUser }) => (
  <div
    data-testid="screen-submission-overview"
    data-current-user-email={currentUser?.email || ""}
  >
    Experimento
  </div>
));

jest.mock("./screens/ComparisonPage", () => ({ currentUser }) => (
  <div
    data-testid="screen-comparison"
    data-current-user-email={currentUser?.email || ""}
  >
    Comparación
  </div>
));

jest.mock("./common/Navbar", () => () => (
  <nav data-testid="navbar">
    Navbar
  </nav>
));

jest.mock("./screens/TutorialPage", () => () => (
  <div data-testid="screen-tutorial">
    Cómo funciona
  </div>
));

jest.mock("./screens/ProfilePage", () => () => (
  <div data-testid="screen-profile">
    Mi perfil
  </div>
));

jest.mock("./screens/SystemStatePage", () => ({
  statusCode,
}) => (
  <div data-testid={`screen-system-${statusCode}`}>
    Estado {statusCode}
  </div>
));

jest.mock("./screens/Login", () => () => (
  <div data-testid="screen-login">
    Login
  </div>
));

jest.mock("./screens/AdminUser", () => () => (
  <div data-testid="screen-admin-users">
    Administración
  </div>
));

jest.mock("./screens/AdminUserDetail", () => () => (
  <div data-testid="screen-admin-user-detail">
    Detalle usuario
  </div>
));

jest.mock("./components/Loader", () => () => (
  <div data-testid="screen-loader">
    Cargando sesión
  </div>
));

const setRoute = (path) => {
  window.history.pushState({}, "", path);
};

const mockAuthenticatedUser = (
  user = {
    id: 10,
    email: "student@udec.cl",
    role_id: 1,
  }
) => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => user,
  });
};

const mockUnauthenticated = () => {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status: 401,
    json: async () => ({}),
  });
};

describe("CORE-05H-1 App shell and routing regression", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    setRoute("/");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("unauthenticated user is redirected to login", async () => {
    setRoute("/profile");
    mockUnauthenticated();

    render(<App />);

    expect(
      await screen.findByTestId("screen-login")
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId("navbar")
    ).not.toBeInTheDocument();
  });

  test("authenticated student reaches new analysis", async () => {
    setRoute("/");
    mockAuthenticatedUser();

    render(<App />);

    expect(
      await screen.findByTestId("screen-render-form")
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("navbar")
    ).toBeInTheDocument();
  });

  test("authenticated unknown route renders real 404 state", async () => {
    setRoute("/ruta-que-no-existe");
    mockAuthenticatedUser();

    render(<App />);

    expect(
      await screen.findByTestId("screen-system-404")
    ).toBeInTheDocument();
  });

  test("student attempting admin route is redirected to 403", async () => {
    setRoute("/admin/users");
    mockAuthenticatedUser({
      id: 11,
      email: "student@udec.cl",
      role_id: 1,
    });

    render(<App />);

    expect(
      await screen.findByTestId("screen-system-403")
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId("screen-admin-users")
    ).not.toBeInTheDocument();
  });

  test("admin reaches administration route", async () => {
    setRoute("/admin/users");
    mockAuthenticatedUser({
      id: 2,
      email: "admin@udec.cl",
      role_id: 2,
    });

    render(<App />);

    expect(
      await screen.findByTestId("screen-admin-users")
    ).toBeInTheDocument();
  });

  test("authenticated user visiting login is redirected home", async () => {
    setRoute("/login");
    mockAuthenticatedUser();

    render(<App />);

    expect(
      await screen.findByTestId("screen-render-form")
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        window.location.pathname
      ).toBe("/");
    });
  });

  test.each([
    ["/code/exec70LCS", "screen-render-image"],
    ["/submissions/42", "screen-submission-overview"],
    ["/compare?execution=one&execution=two", "screen-comparison"],
  ])("passes the single currentUser session to %s", async (path, testId) => {
    setRoute(path);
    mockAuthenticatedUser({
      id: 10,
      email: "student@udec.cl",
      role_name: "Student",
    });

    render(<App />);

    expect(await screen.findByTestId(testId)).toHaveAttribute(
      "data-current-user-email",
      "student@udec.cl"
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/me", {
      credentials: "include",
    });
  });

  test("unauthenticated comparison route is redirected to login", async () => {
    setRoute("/compare?execution=one&execution=two");
    mockUnauthenticated();

    render(<App />);

    expect(await screen.findByTestId("screen-login")).toBeInTheDocument();
    expect(screen.queryByTestId("screen-comparison")).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
