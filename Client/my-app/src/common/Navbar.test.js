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

import Navbar from "./Navbar";

const renderNavbar = (
  roleName,
  onLogout = jest.fn()
) =>
  render(
    <MemoryRouter>
      <Navbar
        currentUser={{
          id: 3,
          full_name: "Ada Lovelace",
          email: "ada@example.com",
          role_name: roleName,
        }}
        onLogout={onLogout}
      />
      <Routes>
        <Route
          path="/profile"
          element={<div>Profile route target</div>}
        />
      </Routes>
    </MemoryRouter>
  );

describe("Navbar primary modules", () => {
  test("student sees the three core modules", () => {
    renderNavbar("Student");

    expect(
      screen.getByRole("link", { name: /^Nuevo análisis$/i })
    ).toHaveAttribute("href", "/");
    expect(
      screen.getByRole("link", { name: /Historial/i })
    ).toHaveAttribute("href", "/history");
    expect(
      screen.getByRole("link", { name: /Cómo funciona/i })
    ).toHaveAttribute("href", "/tutorial");

    expect(
      screen.queryByRole("link", { name: /Supervisión/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Administración/i })
    ).not.toBeInTheDocument();
  });

  test("teacher keeps supervision after the three core modules", () => {
    renderNavbar("Teacher");

    expect(
      screen.getByRole("link", { name: /Historial/i })
    ).toHaveAttribute("href", "/history");
    expect(
      screen.getByRole("link", { name: /Supervisión/i })
    ).toHaveAttribute("href", "/teacher/courses");
  });

  test("admin exposes history, supervision and administration", () => {
    renderNavbar("Admin");

    expect(
      screen.getByRole("link", { name: /Historial/i })
    ).toHaveAttribute("href", "/history");
    expect(
      screen.getByRole("link", { name: /Supervisión/i })
    ).toHaveAttribute("href", "/teacher/courses");
    expect(
      screen.getByRole("link", { name: /Administración/i })
    ).toHaveAttribute("href", "/admin/users");
  });

  test("profile uses React Router and closes the user menu", () => {
    renderNavbar("Student");

    fireEvent.click(
      screen.getByRole("button", { name: /Ada Lovelace/i })
    );
    const profileLink = screen.getByRole("menuitem", {
      name: /Mi perfil/i,
    });

    expect(profileLink).toHaveAttribute("href", "/profile");
    expect(profileLink.tagName).toBe("A");

    fireEvent.click(profileLink);

    expect(screen.getByText("Profile route target")).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("logout still delegates to the existing handler", async () => {
    const onLogout = jest.fn();
    renderNavbar("Student", onLogout);

    fireEvent.click(
      screen.getByRole("button", { name: /Ada Lovelace/i })
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: /Cerrar sesión/i })
    );

    await waitFor(() =>
      expect(onLogout).toHaveBeenCalledTimes(1)
    );
  });
});
