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

import {
  I18nProvider,
  useI18n,
} from "../i18n";
import {
  requestJson,
} from "../common/requestErrorModel";
import AdminLayout from "./AdminLayout";

jest.mock(
  "../common/requestErrorModel",
  () => ({
    ...jest.requireActual(
      "../common/requestErrorModel"
    ),
    requestJson: jest.fn(),
  })
);

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
  beforeEach(() => {
    jest.clearAllMocks();
    requestJson.mockResolvedValue({
      summary: {
        pending: 3,
      },
    });
  });

  test("localizes the administration navigation and pending badge without changing routes", async () => {
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
      screen.getByRole("link", { name: /Access requests/ })
    ).toHaveAttribute("href", "/admin/access-requests");
    expect(
      screen.getByRole("link", { name: "Audit log" })
    ).toHaveAttribute("href", "/admin/audit-log");
    expect(
      await screen.findByLabelText(
        "3 pending access requests"
      )
    ).toHaveTextContent("3");

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
      screen.getByRole("link", { name: /Solicitudes/ })
    ).toHaveAttribute("href", "/admin/access-requests");
    expect(
      screen.getByRole("link", { name: "Auditoría" })
    ).toHaveAttribute("href", "/admin/audit-log");
    expect(
      screen.getByLabelText(
        "3 solicitudes de acceso pendientes"
      )
    ).toHaveTextContent("3");
    expect(requestJson).toHaveBeenCalledTimes(1);
  });

  test("does not render a pending badge when the count is zero", async () => {
    requestJson.mockResolvedValue({
      summary: {
        pending: 0,
      },
    });

    render(
      <I18nProvider initialLanguage="en">
        <MemoryRouter initialEntries={["/admin/users"]}>
          <Routes>
            <Route path="/admin" element={<AdminLayout />}>
              <Route path="users" element={<div>content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() =>
      expect(requestJson).toHaveBeenCalledTimes(1)
    );
    expect(
      document.querySelector(".admin-shell-nav__badge")
    ).not.toBeInTheDocument();
  });
});
