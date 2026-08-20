import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Navbar from "./Navbar";
import { I18nProvider } from "../i18n";

const renderEnglishNavbar = (
  roleName = "Student"
) =>
  render(
    <I18nProvider initialLanguage="en">
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
    </I18nProvider>
  );

describe("Navbar i18n", () => {
  test("renders primary navigation in English", () => {
    renderEnglishNavbar();

    expect(
      screen.getByRole("link", {
        name: /^New analysis$/i,
      })
    ).toHaveAttribute("href", "/");

    expect(
      screen.getByRole("link", {
        name: /^History$/i,
      })
    ).toHaveAttribute(
      "href",
      "/history"
    );

    expect(
      screen.getByRole("link", {
        name: /^How it works$/i,
      })
    ).toHaveAttribute(
      "href",
      "/tutorial"
    );
  });

  test("keeps authorization semantics while translating roles and modules", () => {
    renderEnglishNavbar("Teacher");

    expect(
      screen.getByRole("link", {
        name: /^Supervision$/i,
      })
    ).toHaveAttribute(
      "href",
      "/teacher/courses"
    );

    expect(
      screen.queryByRole("link", {
        name: /^Administration$/i,
      })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: /Ada Lovelace/i,
      })
    );

    expect(
      screen.getByText(/^Teacher$/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("menuitem", {
        name: /My profile/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("menuitem", {
        name: /Sign out/i,
      })
    ).toBeInTheDocument();
  });

  test("admin module remains authorized in English", () => {
    renderEnglishNavbar("Admin");

    expect(
      screen.getByRole("link", {
        name: /^Administration$/i,
      })
    ).toHaveAttribute(
      "href",
      "/admin/users"
    );
  });
});
