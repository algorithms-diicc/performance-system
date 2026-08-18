import React from "react";
import { render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import axios from "axios";

import RenderImage from "./RenderImage";

jest.mock("axios");
jest.mock("react-plotly.js", () => () => (
  <div data-testid="plotly-chart" />
));

const renderPage = () => {
  render(
    <MemoryRouter initialEntries={["/code/exec70LCS"]}>
      <Routes>
        <Route path="/code/:codename" element={<RenderImage />} />
      </Routes>
    </MemoryRouter>
  );
};

describe("RenderImage submission navigation", () => {
  const arrangeRequests = (submissionId) => {
    axios.get.mockImplementation((url) => {
      if (url.includes("/results")) {
        const execution = {
          codename: "exec70LCS",
        };
        if (submissionId !== undefined) {
          execution.submission_id = submissionId;
        }

        return Promise.resolve({
          data: {
            schema_version: "1.3",
            execution,
            processing: {},
            metrics: {},
            analysis: {},
            pedagogy: {},
          },
        });
      }

      if (url.includes("_status.json")) {
        return Promise.resolve({ data: {} });
      }

      return Promise.resolve({ data: "" });
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    arrangeRequests(42);
  });

  test("uses the canonical results payload for a deterministic experiment link without another request", async () => {
    renderPage();

    expect(
      await screen.findByRole("link", { name: /Ver experimento/i })
    ).toHaveAttribute("href", "/submissions/42");

    expect(axios.get).toHaveBeenCalledTimes(3);
    expect(
      axios.get.mock.calls.some(([url]) =>
        String(url).includes("/submissions/")
      )
    ).toBe(false);
  });

  test("remains usable when the additive submission field is absent", async () => {
    arrangeRequests(undefined);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Ejecución exec70LCS" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Ver experimento/i })
    ).not.toBeInTheDocument();
  });
});
