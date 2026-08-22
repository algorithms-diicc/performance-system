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

import { requestJson } from "../common/requestErrorModel";
import AdminUserDetail from "./AdminUserDetail";

jest.mock("../common/requestErrorModel", () => ({
  requestJson: jest.fn(),
}));

const execution = {
  executionId: 70,
  codename: "exec70LCS",
  submissionId: 42,
  submissionTitle: "Experimento canónico",
  state: "COMPLETED",
  stateLabel: "Completada",
  durationMs: 1500,
  hardwareProfile: "Intel i7",
  resultAvailable: true,
};

const submission = {
  id: 42,
  title: "Experimento canónico",
  status: "COMPLETED",
  executionsCount: 1,
  completedExecutions: 1,
  failedExecutions: 0,
  queuedExecutions: 0,
  runningExecutions: 0,
  processingExecutions: 0,
  createdAt: "2026-08-17T12:00:00Z",
};

const arrangeRequests = () => {
  requestJson.mockImplementation((url) => {
    if (url === "/api/admin/executions/70") {
      return Promise.resolve({
        execution: {
          ...execution,
          benchmark: "LCS",
          executionConfig: { measurement: {} },
          hardwareSnapshot: {},
        },
      });
    }

    if (url.includes("/executions?")) {
      return Promise.resolve({ items: [execution], total: 1 });
    }

    if (url.includes("/submissions?")) {
      return Promise.resolve({ items: [submission], total: 1 });
    }

    return Promise.resolve({
      profile: {
        id: 3,
        full_name: "Ada Lovelace",
        email: "ada@example.com",
        role: "Student",
        isActive: true,
        statusLabel: "Activo",
        createdAt: "2026-01-02T00:00:00Z",
        lastLogin: "2026-08-17T12:00:00Z",
      },
      summary: {
        submissionsCount: 1,
        executionsCount: 1,
        completedExecutions: 1,
        failedExecutions: 0,
        queuedExecutions: 0,
        runningExecutions: 0,
        processingExecutions: 0,
        cancelledExecutions: 0,
      },
    });
  });
};

const renderPage = () => {
  render(
    <MemoryRouter initialEntries={["/admin/users/3"]}>
      <Routes>
        <Route
          path="/admin/users/:id"
          element={<AdminUserDetail />}
        />
      </Routes>
    </MemoryRouter>
  );
};

describe("AdminUserDetail submission navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    arrangeRequests();
  });

  test("links execution rows, submission rows and the detail modal to the experiment", async () => {
    renderPage();

    const executionLink = await screen.findByRole("link", {
      name: /Experimento canónico ID 42/i,
    });
    expect(executionLink).toHaveAttribute("href", "/submissions/42");

    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalle" })
    );
    expect(
      await screen.findByRole("link", { name: "Ver experimento" })
    ).toHaveAttribute("href", "/submissions/42");
    expect(
      screen.getByRole("link", { name: "Ver resultados" })
    ).toHaveAttribute("href", "/code/exec70LCS");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    fireEvent.click(
      screen.getByRole("button", { name: /Experimentos/i })
    );

    expect(
      await screen.findByRole("link", {
        name: /Experimento canónico ID 42/i,
      })
    ).toHaveAttribute("href", "/submissions/42");
  });
});
