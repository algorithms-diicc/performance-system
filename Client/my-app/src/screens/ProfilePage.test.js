import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { requestJson } from "../common/requestErrorModel";
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
  avgDurationMs: 1250,
  lastExecutionAt: "2026-08-17T12:00:00Z",
  lastExecutionState: "COMPLETED",
  lastExecutionStatus: "Completado",
  lastExecutionCodename: "exec10LCS",
  lastSubmissionId: 42,
};

const renderProfile = async (summaryOverrides = {}) => {
  requestJson.mockResolvedValue({
    profile,
    summary: { ...summary, ...summaryOverrides },
  });

  render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>
  );

  await screen.findByRole("heading", { name: "Mi perfil" });
};

describe("ProfilePage submission navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("keeps result navigation and adds the canonical experiment link", async () => {
    await renderProfile();

    expect(
      screen.getByRole("link", { name: /Ver experimento/i })
    ).toHaveAttribute("href", "/submissions/42");
    expect(
      screen.getByRole("link", { name: /Ver último resultado/i })
    ).toHaveAttribute("href", "/code/exec10LCS");
  });

  test.each(["FAILED", "RUNNING"])(
    "offers the experiment for a %s last execution without a false result link",
    async (lastExecutionState) => {
      await renderProfile({
        completedExecutions: 0,
        failedExecutions: lastExecutionState === "FAILED" ? 1 : 0,
        runningExecutions: lastExecutionState === "RUNNING" ? 1 : 0,
        lastExecutionState,
        lastExecutionStatus:
          lastExecutionState === "FAILED" ? "Error" : "En ejecución",
        lastExecutionCodename: "exec11LCS",
        lastSubmissionId: 43,
      });

      expect(
        screen.getByRole("link", { name: /Ver experimento/i })
      ).toHaveAttribute("href", "/submissions/43");
      expect(
        screen.queryByRole("link", { name: /Ver último resultado/i })
      ).not.toBeInTheDocument();
    }
  );

  test("does not render a broken experiment link without lastSubmissionId", async () => {
    await renderProfile({ lastSubmissionId: null });

    expect(
      screen.queryByRole("link", { name: /Ver experimento/i })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ver último resultado/i })
    ).toHaveAttribute("href", "/code/exec10LCS");
  });
});
