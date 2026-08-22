import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";

import {
  I18nProvider,
  useI18n,
} from "../i18n";
import AdminLayout from "./AdminLayout";

const LanguageControl = () => {
  const { setLanguage } = useI18n();

  return (
    <button
      type="button"
      onClick={() => setLanguage("es")}
    >
      switch-es
    </button>
  );
};

describe("AdminLayout i18n", () => {
  test("localizes the administration navigation without changing routes", () => {
    render(
      <I18nProvider initialLanguage="en">
        <LanguageControl />
        <MemoryRouter initialEntries={["/admin/users"]}>
          <Routes>
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="users" element={<div>content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(
      screen.getByRole("navigation", {
        name: "Administration sections",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Users" })
    ).toHaveAttribute("href", "/admin/users");
    expect(
      screen.getByRole("link", { name: "Access requests" })
    ).toHaveAttribute("href", "/admin/access-requests");
    expect(
      screen.getByRole("link", { name: "Audit log" })
    ).toHaveAttribute("href", "/admin/audit-log");

    fireEvent.click(
      screen.getByRole("button", { name: "switch-es" })
    );

    expect(
      screen.getByRole("navigation", {
        name: "Secciones de administración",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Usuarios" })
    ).toHaveAttribute("href", "/admin/users");
    expect(
      screen.getByRole("link", { name: "Solicitudes" })
    ).toHaveAttribute("href", "/admin/access-requests");
    expect(
      screen.getByRole("link", { name: "Auditoría" })
    ).toHaveAttribute("href", "/admin/audit-log");
  });
});
