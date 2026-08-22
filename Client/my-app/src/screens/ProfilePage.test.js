import React from "react";
import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
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

const renderProfile = async (
  summaryOverrides = {},
  { coursesValue = [], coursesError = null } = {}
) => {
  requestJson.mockImplementation((url) => {
    if (url === "/api/profile") {
      return Promise.resolve({
        profile,
        summary: { ...summary, ...summaryOverrides },
      });
    }

    if (url === "/api/student/courses") {
      return coursesError
        ? Promise.reject(coursesError)
        : Promise.resolve({ items: coursesValue });
    }

    return Promise.reject(new Error(`Unexpected request: ${url}`));
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

  test("shows an explicit personal-analysis empty state without active courses", async () => {
    await renderProfile();

    expect(
      await screen.findByRole("heading", {
        name: "Cursos para mis análisis",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Actualmente no tienes cursos activos.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Iniciar análisis personal/i })
    ).toHaveAttribute("href", "/");
  });

  test("shows the active course context and builds its analysis link", async () => {
    await renderProfile({}, { coursesValue: [course] });

    expect(await screen.findByText("CC4102")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Diseño y Análisis de Algoritmos",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("2026 · Semestre 2")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Nuevo análisis en este curso/i })
    ).toHaveAttribute("href", "/?course=9");
  });

  test("renders several active courses independently", async () => {
    await renderProfile(
      {},
      {
        coursesValue: [
          course,
          {
            ...course,
            id: 12,
            code: "CC5101",
            name: "Sistemas Paralelos",
            academicTerm: 1,
          },
        ],
      }
    );

    expect(await screen.findByText("CC4102")).toBeInTheDocument();
    expect(screen.getByText("CC5101")).toBeInTheDocument();

    const links = screen.getAllByRole("link", {
      name: /Nuevo análisis en este curso/i,
    });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute("href", "/?course=9");
    expect(links[1]).toHaveAttribute("href", "/?course=12");
  });

  test("course failure does not hide the profile and can be retried", async () => {
    let courseAttempts = 0;
    requestJson.mockImplementation((url) => {
      if (url === "/api/profile") {
        return Promise.resolve({ profile, summary });
      }

      if (url === "/api/student/courses") {
        courseAttempts += 1;
        return courseAttempts === 1
          ? Promise.reject(new Error("Cursos temporalmente no disponibles"))
          : Promise.resolve({ items: [course] });
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(
      await screen.findByRole("heading", { name: "Mi perfil" })
    ).toBeInTheDocument();
    expect(
      await screen.findByText("No pudimos cargar tus cursos")
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Reintentar cursos" })
    );

    expect(await screen.findByText("CC4102")).toBeInTheDocument();
    expect(courseAttempts).toBe(2);
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

  test("links the profile summary to the complete history", async () => {
    await renderProfile();

    expect(
      screen.getByRole("link", { name: /Ver historial completo/i })
    ).toHaveAttribute("href", "/history");
  });

  test("preserves Experimentos and shows latest duration instead of the average", async () => {
    await renderProfile();

    expect(screen.getByText("Experimentos")).toBeInTheDocument();
    expect(screen.getByText("Duración")).toBeInTheDocument();
    expect(screen.getByText("1,25 s")).toBeInTheDocument();
    expect(screen.queryByText("9 s")).not.toBeInTheDocument();
  });

  test("keeps an active latest execution while rendering null duration safely", async () => {
    await renderProfile({
      completedExecutions: 0,
      runningExecutions: 1,
      lastExecutionState: "RUNNING",
      lastExecutionDurationMs: null,
      lastSubmissionId: 43,
    });

    expect(
      screen.getByText("En ejecución", {
        selector: ".profile-last-execution strong",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Sin datos")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ver experimento/i })
    ).toHaveAttribute("href", "/submissions/43");
    expect(
      screen.queryByRole("link", { name: /Ver último resultado/i })
    ).not.toBeInTheDocument();
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
