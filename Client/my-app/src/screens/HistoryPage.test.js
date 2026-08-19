import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { requestJson } from "../common/requestErrorModel";
import HistoryPage from "./HistoryPage";

jest.mock("../common/requestErrorModel", () => ({
  requestJson: jest.fn(),
}));

const item = {
  id: 42,
  title: "Comparación de ordenamiento",
  originalFilename: "sorting.zip",
  isPinned: true,
  course: {
    id: 9,
    code: "CC4102",
    name: "Diseño y Análisis de Algoritmos",
    academicYear: 2026,
    academicTerm: 2,
  },
  aggregateState: "PARTIAL",
  aggregateStateLabel: "Parcial",
  activityAt: "2026-08-18T14:30:00Z",
  executionsCount: 2,
  benchmarks: ["SIZE"],
  benchmarkFamilies: ["SIZE"],
  sourceFilenames: ["insertion.cpp", "merge.cpp"],
};

const renderHistory = () =>
  render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>
  );

describe("HistoryPage", () => {
  const courseOptions = [
    {
      id: 9,
      code: "CC4102",
      name: "Diseño y Análisis de Algoritmos",
      academicYear: 2026,
      academicTerm: 2,
    },
  ];

  const historyResponse = (overrides = {}) => ({
    items: [item],
    page: 1,
    pageSize: 20,
    total: 1,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();

    requestJson.mockImplementation((url) => {
      if (url === "/api/submissions/history-filter-options") {
        return Promise.resolve({ courses: courseOptions });
      }

      if (url.startsWith("/api/submissions?")) {
        return Promise.resolve(historyResponse());
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
  });

  test("renders a Submission-centric history card", async () => {
    renderHistory();

    expect(
      await screen.findByRole("heading", {
        name: "Comparación de ordenamiento",
      })
    ).toBeInTheDocument();

    expect(screen.getByText("Referencia")).toBeInTheDocument();
    expect(
      screen.getByText("Parcial", { selector: ".history-status" })
    ).toBeInTheDocument();
    expect(screen.getByText("sorting.zip")).toBeInTheDocument();
    expect(
      screen.getByText("CC4102 · Diseño y Análisis de Algoritmos", {
        selector: "strong",
      })
    ).toBeInTheDocument();
    expect(screen.getByText("insertion.cpp · merge.cpp")).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /Ver experimento/i })
    ).toHaveAttribute("href", "/submissions/42");
  });

  test("requests the canonical paginated Submission endpoint", async () => {
    requestJson.mockImplementation((url) => {
      if (url === "/api/submissions/history-filter-options") {
        return Promise.resolve({ courses: [] });
      }

      if (url === "/api/submissions?page=1&page_size=20") {
        return Promise.resolve(
          historyResponse({
            items: [],
            total: 0,
          })
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderHistory();

    await screen.findByRole("heading", {
      name: "Aún no tienes experimentos registrados",
    });

    expect(requestJson).toHaveBeenCalledWith(
      "/api/submissions?page=1&page_size=20",
      { credentials: "include" },
      { fallback: "No fue posible cargar tu historial." }
    );
  });

  test("applies combined filters server-side and resets to page one", async () => {
    requestJson.mockImplementation((url) => {
      if (url === "/api/submissions/history-filter-options") {
        return Promise.resolve({ courses: courseOptions });
      }

      if (url === "/api/submissions?page=1&page_size=20") {
        return Promise.resolve(
          historyResponse({
            total: 21,
          })
        );
      }

      if (url === "/api/submissions?page=2&page_size=20") {
        return Promise.resolve(
          historyResponse({
            items: [{ ...item, id: 43, title: "Página dos" }],
            page: 2,
            total: 21,
          })
        );
      }

      if (
        url ===
        "/api/submissions?page=1&page_size=20&status=COMPLETED&benchmark=CAMM&course_id=9&q=merge.cpp"
      ) {
        return Promise.resolve(
          historyResponse({
            items: [{ ...item, aggregateState: "COMPLETED" }],
          })
        );
      }

      if (url.startsWith("/api/submissions?")) {
        return Promise.resolve(historyResponse());
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderHistory();

    await screen.findByRole("heading", {
      name: "Comparación de ordenamiento",
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Siguiente/i })
    );

    expect(
      await screen.findByRole("heading", { name: "Página dos" })
    ).toBeInTheDocument();

    fireEvent.change(
      screen.getByRole("combobox", { name: "Filtrar por estado" }),
      { target: { value: "COMPLETED" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filtrar por benchmark" }),
      { target: { value: "CAMM" } }
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Filtrar por curso" }),
      { target: { value: "9" } }
    );

    fireEvent.change(
      screen.getByRole("searchbox", { name: /Buscar/i }),
      { target: { value: "merge.cpp" } }
    );
    fireEvent.click(
      screen.getByRole("button", { name: /^Buscar$/i })
    );

    await waitFor(() => {
      expect(requestJson).toHaveBeenCalledWith(
        "/api/submissions?page=1&page_size=20&status=COMPLETED&benchmark=CAMM&course_id=9&q=merge.cpp",
        { credentials: "include" },
        { fallback: "No fue posible cargar tu historial." }
      );
    });
  });

  test("loads historical course options independently of the current page", async () => {
    renderHistory();

    expect(
      await screen.findByRole("option", {
        name: "CC4102 · Diseño y Análisis de Algoritmos",
      })
    ).toHaveValue("9");

    expect(requestJson).toHaveBeenCalledWith(
      "/api/submissions/history-filter-options",
      { credentials: "include" },
      { fallback: "No fue posible cargar los cursos del historial." }
    );
  });

  test("clears active filters and returns to the unfiltered first page", async () => {
    renderHistory();

    await screen.findByRole("heading", {
      name: "Comparación de ordenamiento",
    });

    fireEvent.change(
      screen.getByRole("combobox", { name: "Filtrar por estado" }),
      { target: { value: "FAILED" } }
    );

    await waitFor(() => {
      expect(requestJson).toHaveBeenCalledWith(
        "/api/submissions?page=1&page_size=20&status=FAILED",
        { credentials: "include" },
        { fallback: "No fue posible cargar tu historial." }
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Limpiar filtros" })
    );

    await waitFor(() => {
      const baselineCalls = requestJson.mock.calls.filter(
        ([url]) => url === "/api/submissions?page=1&page_size=20"
      );
      expect(baselineCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  test("shows a filtered empty state instead of the first-analysis empty state", async () => {
    requestJson.mockImplementation((url) => {
      if (url === "/api/submissions/history-filter-options") {
        return Promise.resolve({ courses: courseOptions });
      }

      if (url === "/api/submissions?page=1&page_size=20") {
        return Promise.resolve(historyResponse());
      }

      if (
        url ===
        "/api/submissions?page=1&page_size=20&benchmark=LCS"
      ) {
        return Promise.resolve(
          historyResponse({
            items: [],
            total: 0,
          })
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderHistory();

    await screen.findByRole("heading", {
      name: "Comparación de ordenamiento",
    });

    fireEvent.change(
      screen.getByRole("combobox", { name: "Filtrar por benchmark" }),
      { target: { value: "LCS" } }
    );

    expect(
      await screen.findByRole("heading", {
        name: "No encontramos experimentos",
      })
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: "Crear primer análisis" })
    ).not.toBeInTheDocument();
  });

  test("moves to the next page without client-side history filtering", async () => {
    requestJson.mockImplementation((url) => {
      if (url === "/api/submissions/history-filter-options") {
        return Promise.resolve({ courses: courseOptions });
      }

      if (url.includes("page=1")) {
        return Promise.resolve(
          historyResponse({
            total: 21,
          })
        );
      }

      if (url.includes("page=2")) {
        return Promise.resolve(
          historyResponse({
            items: [{ ...item, id: 43, title: "Página dos" }],
            page: 2,
            total: 21,
          })
        );
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderHistory();

    await screen.findByRole("heading", {
      name: "Comparación de ordenamiento",
    });

    fireEvent.click(
      screen.getByRole("button", { name: /Siguiente/i })
    );

    expect(
      await screen.findByRole("heading", { name: "Página dos" })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(requestJson).toHaveBeenCalledWith(
        "/api/submissions?page=2&page_size=20",
        { credentials: "include" },
        { fallback: "No fue posible cargar tu historial." }
      );
    });
  });

  test("shows a recoverable history error without coupling it to filter options", async () => {
    let historyAttempts = 0;

    requestJson.mockImplementation((url) => {
      if (url === "/api/submissions/history-filter-options") {
        return Promise.resolve({ courses: courseOptions });
      }

      if (url.startsWith("/api/submissions?")) {
        historyAttempts += 1;

        return historyAttempts === 1
          ? Promise.reject(
              new Error("Historial temporalmente no disponible")
            )
          : Promise.resolve(historyResponse());
      }

      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });

    renderHistory();

    expect(
      await screen.findByRole("heading", {
        name: "No pudimos cargar tu historial",
      })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Reintentar" })
    );

    expect(
      await screen.findByRole("heading", {
        name: "Comparación de ordenamiento",
      })
    ).toBeInTheDocument();

    expect(historyAttempts).toBe(2);
  });
});
