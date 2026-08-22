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

import { teacherApi } from "./teacherApi";
import TeacherStudentDetail from "./TeacherStudentDetail";

jest.mock("./teacherApi", () => ({
  ...jest.requireActual("./teacherApi"),
  teacherApi: jest.fn(),
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
  executions: 1,
  completed: 1,
  failed: 0,
  queued: 0,
  running: 0,
  processing: 0,
  createdAt: "2026-08-17T12:00:00Z",
};

const arrangeTeacherApi = () => {
  teacherApi.mockImplementation((url) => {
    if (url.endsWith("/executions/70")) {
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
        fullName: "Ada Lovelace",
        email: "ada@example.com",
        lastLogin: "2026-08-17T12:00:00Z",
        membership: { isActive: true },
      },
      course: {
        code: "INF-101",
        academicYear: 2026,
        academicTerm: 2,
      },
      summary: {
        submissions: 1,
        executions: 1,
        completedExecutions: 1,
        failedExecutions: 0,
      },
    });
  });
};

const renderPage = () => {
  render(
    <MemoryRouter
      initialEntries={["/teacher/courses/10/students/3"]}
    >
      <Routes>
        <Route
          path="/teacher/courses/:courseId/students/:userId"
          element={<TeacherStudentDetail />}
        />
      </Routes>
    </MemoryRouter>
  );
};

describe("TeacherStudentDetail submission navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    arrangeTeacherApi();
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

    fireEvent.click(screen.getByText("Cerrar", { selector: "button" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Experimentos" })
    );

    expect(
      await screen.findByRole("link", {
        name: /Experimento canónico ID 42/i,
      })
    ).toHaveAttribute("href", "/submissions/42");
  });
});
