import React from "react";
import {
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { requestJson } from "../common/requestErrorModel";
import { I18nProvider } from "../i18n";
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
  benchmarkFamilies: ["SIZE"],
  sourceFilenames: ["insertion.cpp", "merge.cpp"],
};

describe("HistoryPage i18n", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    requestJson.mockImplementation((url) => {
      if (
        url ===
        "/api/submissions/history-filter-options"
      ) {
        return Promise.resolve({
          courses: [item.course],
        });
      }

      if (url.startsWith("/api/submissions?")) {
        return Promise.resolve({
          items: [item],
          page: 1,
          pageSize: 20,
          total: 1,
        });
      }

      return Promise.reject(
        new Error(`Unexpected request: ${url}`)
      );
    });
  });

  test("localizes UI and technical state while preserving user data", async () => {
    render(
      <I18nProvider initialLanguage="en">
        <MemoryRouter>
          <HistoryPage />
        </MemoryRouter>
      </I18nProvider>
    );

    expect(
      await screen.findByRole("heading", {
        name: "Comparación de ordenamiento",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "History",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("combobox", {
        name: "Filter by status",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Partial", {
        selector: ".history-status",
      })
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Parcial", {
        selector: ".history-status",
      })
    ).not.toBeInTheDocument();

    expect(
      screen.getByText(
        "CC4102 · Diseño y Análisis de Algoritmos",
        { selector: "strong" }
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText("2026 · Semester 2")
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: /View experiment/i,
      })
    ).toHaveAttribute(
      "href",
      "/submissions/42"
    );
  });
});
