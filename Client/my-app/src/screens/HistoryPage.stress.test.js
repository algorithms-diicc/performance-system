import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { requestJson } from "../common/requestErrorModel";
import HistoryPage from "./HistoryPage";

jest.mock("../common/requestErrorModel", () => ({
  requestJson: jest.fn(),
}));

const PAGE_SIZE = 20;
const TOTAL_SUBMISSIONS = 57;

const course = {
  id: 9,
  code: "CC4102",
  name: "Diseño y Análisis de Algoritmos",
  academicYear: 2026,
  academicTerm: 2,
};

const stateCycle = [
  ["EMPTY", "Sin ejecuciones", 0],
  ["IN_PROGRESS", "En progreso", 2],
  ["COMPLETED", "Completado", 3],
  ["PARTIAL", "Parcial", 3],
  ["FAILED", "Error", 2],
];

const benchmarkCycle = [
  ["SIZE", ["SIZE"]],
  ["LCS", ["LCS"]],
  ["CAMM", ["CAMMR", "CAMMSO"]],
];

const makeStressItem = (index) => {
  const ordinal = TOTAL_SUBMISSIONS - index;
  const [aggregateState, aggregateStateLabel, executionsCount] =
    stateCycle[index % stateCycle.length];
  const [family, benchmarks] =
    benchmarkCycle[index % benchmarkCycle.length];

  const multiCpp = index % 4 === 0;

  return {
    id: 2000 + ordinal,
    title: `Stress experiment ${ordinal}`,
    originalFilename: `stress-${ordinal}.zip`,
    isPinned: index % 7 === 0,
    course: index % 2 === 0 ? null : course,
    aggregateState,
    aggregateStateLabel,
    activityAt: new Date(
      Date.UTC(2026, 7, 18, 23, 0) - index * 60_000
    ).toISOString(),
    executionsCount,
    benchmarks,
    benchmarkFamilies: [family],
    sourceFilenames:
      executionsCount === 0
        ? []
        : multiCpp
        ? [
            `impl-${ordinal}-1.cpp`,
            `impl-${ordinal}-2.cpp`,
            `impl-${ordinal}-3.cpp`,
            `impl-${ordinal}-4.cpp`,
            `impl-${ordinal}-5.cpp`,
          ]
        : [`impl-${ordinal}.cpp`],
  };
};

const stressItems = Array.from(
  { length: TOTAL_SUBMISSIONS },
  (_, index) => makeStressItem(index)
);

const paginatedResponse = (page) => {
  const start = (page - 1) * PAGE_SIZE;

  return {
    items: stressItems.slice(start, start + PAGE_SIZE),
    page,
    pageSize: PAGE_SIZE,
    total: TOTAL_SUBMISSIONS,
  };
};

const renderHistory = () =>
  render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>
  );

describe("HistoryPage stress history", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    requestJson.mockImplementation((url) => {
      if (url === "/api/submissions/history-filter-options") {
        return Promise.resolve({ courses: [course] });
      }

      if (url.startsWith("/api/submissions?")) {
        const query = String(url).split("?")[1] || "";
        const params = new URLSearchParams(query);
        const page = Number(params.get("page") || 1);

        return Promise.resolve(paginatedResponse(page));
      }

      return Promise.reject(
        new Error(`Unexpected request: ${url}`)
      );
    });
  });

  test("paginates 57 mixed submissions as 20/20/17 without client-side collapse", async () => {
    renderHistory();

    expect(
      await screen.findByRole("heading", {
        name: "Stress experiment 57",
      })
    ).toBeInTheDocument();

    expect(
      screen.getAllByRole("link", {
        name: /Ver experimento/i,
      })
    ).toHaveLength(20);

    const summary = screen.getByRole("region", {
      name: "Resumen del historial",
    });
    expect(
      within(summary).getByText("57")
    ).toBeInTheDocument();

    const pagination = screen.getByRole("navigation", {
      name: "Paginación del historial",
    });
    expect(pagination).toHaveTextContent("Página 1 de 3");

    // 20 elementos / ciclo de cinco estados => cuatro de cada estado.
    expect(
      screen.getAllByText("Sin ejecuciones", {
        selector: ".history-status",
      })
    ).toHaveLength(4);
    expect(
      screen.getAllByText("En progreso", {
        selector: ".history-status",
      })
    ).toHaveLength(4);
    expect(
      screen.getAllByText("Completado", {
        selector: ".history-status",
      })
    ).toHaveLength(4);
    expect(
      screen.getAllByText("Parcial", {
        selector: ".history-status",
      })
    ).toHaveLength(4);
    expect(
      screen.getAllByText("Error", {
        selector: ".history-status",
      })
    ).toHaveLength(4);

    // El mock mezcla contexto Personal/curso y referencias sin alterar orden.
    expect(
      screen.getAllByText("Sin curso asociado")
    ).toHaveLength(10);
    expect(
      screen.getAllByText(
        "CC4102 · Diseño y Análisis de Algoritmos",
        { selector: "strong" }
      )
    ).toHaveLength(10);
    expect(
      screen.getAllByText("Referencia")
    ).toHaveLength(3);

    // Las submissions multi-CPP muestran tres fuentes y resumen el resto.
    expect(
      screen.getAllByText("+2 más")
    ).toHaveLength(4);

    fireEvent.click(
      within(pagination).getByRole("button", {
        name: /Siguiente/i,
      })
    );

    expect(
      await screen.findByRole("heading", {
        name: "Stress experiment 37",
      })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getAllByRole("link", {
          name: /Ver experimento/i,
        })
      ).toHaveLength(20);
    });

    expect(pagination).toHaveTextContent("Página 2 de 3");

    await waitFor(() => {
      const currentPagination = screen.getByRole(
        "navigation",
        { name: "Paginación del historial" }
      );

      expect(
        within(currentPagination).getByRole(
          "button",
          { name: /Siguiente/i }
        )
      ).toBeEnabled();
    });

    const pageTwoPagination = screen.getByRole(
      "navigation",
      { name: "Paginación del historial" }
    );

    fireEvent.click(
      within(pageTwoPagination).getByRole(
        "button",
        { name: /Siguiente/i }
      )
    );

    expect(
      await screen.findByRole("heading", {
        name: "Stress experiment 17",
      })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getAllByRole("link", {
          name: /Ver experimento/i,
        })
      ).toHaveLength(17);
    });

    const pageThreePagination = screen.getByRole(
      "navigation",
      { name: "Paginación del historial" }
    );

    expect(pageThreePagination).toHaveTextContent(
      "Página 3 de 3"
    );

    expect(requestJson).toHaveBeenCalledWith(
      "/api/submissions?page=3&page_size=20",
      { credentials: "include" },
      { fallback: "No fue posible cargar tu historial." }
    );
  });

  test("preserves latest-first server chronology across page boundaries", async () => {
    renderHistory();

    await screen.findByRole("heading", {
      name: "Stress experiment 57",
    });

    const pageOneLinks = screen.getAllByRole("link", {
      name: /Ver experimento/i,
    });

    expect(pageOneLinks[0]).toHaveAttribute(
      "href",
      "/submissions/2057"
    );
    expect(pageOneLinks[19]).toHaveAttribute(
      "href",
      "/submissions/2038"
    );

    const pagination = screen.getByRole("navigation", {
      name: "Paginación del historial",
    });

    fireEvent.click(
      within(pagination).getByRole("button", {
        name: /Siguiente/i,
      })
    );

    await screen.findByRole("heading", {
      name: "Stress experiment 37",
    });

    const pageTwoLinks = screen.getAllByRole("link", {
      name: /Ver experimento/i,
    });

    expect(pageTwoLinks[0]).toHaveAttribute(
      "href",
      "/submissions/2037"
    );
    expect(pageTwoLinks[19]).toHaveAttribute(
      "href",
      "/submissions/2018"
    );
  });
});
