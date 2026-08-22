import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { requestJson } from "../common/requestErrorModel";
import { I18nProvider } from "../i18n";
import ProfilePage from "./ProfilePage";

jest.mock("../common/requestErrorModel", () => ({
  requestJson: jest.fn(),
}));

const profile = {
  id: 3,
  full_name: "Ada Lovelace",
  email: "ada@example.com",
  role: "Student",
  isActive: true,
  statusLabel: "Activo",
  createdAt: "2026-01-02T00:00:00Z",
  lastLogin: "2026-08-17T12:00:00Z",
};

const summary = {
  submissionsCount: 1,
  executionsCount: 1,
  completedExecutions: 1,
  failedExecutions: 0,
  queuedExecutions: 0,
  runningExecutions: 0,
  processingExecutions: 0,
  cancelledExecutions: 0,
  avgDurationMs: 9000,
  lastExecutionDurationMs: 1250,
  lastExecutionAt: "2026-08-17T12:00:00Z",
  lastExecutionState: "COMPLETED",
  lastExecutionStatus: "Completado",
  lastExecutionCodename: "exec10LCS",
  lastSubmissionId: 42,
};

const course = {
  id: 9,
  code: "CC4102",
  name: "Diseño y Análisis de Algoritmos",
  academicYear: 2026,
  academicTerm: 2,
  teacher: {
    fullName: "Grace Hopper",
    email: "grace@example.com",
  },
};

describe("ProfilePage i18n", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requestJson.mockImplementation((url) => {
      if (url === "/api/profile") {
        return Promise.resolve({ profile, summary });
      }
      if (url === "/api/student/courses") {
        return Promise.resolve({ items: [course] });
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  });

  test("localizes technical labels while preserving institutional data", async () => {
    render(
      <I18nProvider initialLanguage="en">
        <MemoryRouter>
          <ProfilePage />
        </MemoryRouter>
      </I18nProvider>
    );

    expect(
      await screen.findByRole("heading", { name: "My profile" })
    ).toBeInTheDocument();

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Student")).toBeInTheDocument();
    expect(screen.getByText("Experiments")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Courses for my analyses",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("1.25 s")).toBeInTheDocument();
    expect(screen.queryByText("9 s")).not.toBeInTheDocument();

    expect(
      screen.getByText("Active", { selector: ".profile-badge" })
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Activo", { selector: ".profile-badge" })
    ).not.toBeInTheDocument();

    expect(
      screen.getByText("Completed", {
        selector: ".profile-last-execution strong",
      })
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Completado", {
        selector: ".profile-last-execution strong",
      })
    ).not.toBeInTheDocument();

    expect(screen.getByText("2026 · Semester 2")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Diseño y Análisis de Algoritmos",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /View experiment/i })
    ).toHaveAttribute("href", "/submissions/42");
  });
});
