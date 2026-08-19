import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Navbar from "./Navbar";

const renderNavbar = (roleName) =>
  render(
    <MemoryRouter>
      <Navbar
        currentUser={{
          id: 3,
          full_name: "Ada Lovelace",
          email: "ada@example.com",
          role_name: roleName,
        }}
        onLogout={jest.fn()}
      />
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
});
