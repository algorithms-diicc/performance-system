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
import axios from "axios";

import { I18nProvider, useI18n } from "../i18n";
import ComparisonPage from "./ComparisonPage";

jest.mock("axios");

const mockPlotProps = jest.fn();
jest.mock("react-plotly.js", () => (props) => {
  mockPlotProps(props);
  return <div data-testid="comparison-plot" />;
});

const VALID_PATH =
  "/compare?execution=execution-a&execution=execution-b";

const point = (inputSize, median, mean) => ({
  inputSize,
  median,
  mean,
  stddev: 1,
  q1: median - 2,
  q3: median + 3,
  samplesValid: 9,
  samplesTotal: 10,
  iqrOutliersDetected: 1,
});

const executions = [
  {
    publicId: "public-a",
    codename: "execution-a",
    submissionId: 42,
    submissionTitle: "Experimento del estudiante",
    sourceFilename: "alpha.cpp",
    benchmark: "SIZE",
    profile: "BALANCED",
    compilerFlags: "-O3",
    sourceLanguage: "C++",
    compiler: "g++",
  },
  {
    publicId: "public-b",
    codename: "execution-b",
    submissionId: 42,
    submissionTitle: "Experimento del estudiante",
    sourceFilename: "beta.cpp",
    benchmark: "SIZE",
    profile: "BALANCED",
    compilerFlags: "-O3",
    sourceLanguage: "C++",
    compiler: "g++",
  },
];

const series = executions.map(
  (execution, index) => ({
    publicId: execution.publicId,
    codename: execution.codename,
    sourceFilename: execution.sourceFilename,
    sourceLanguage: execution.sourceLanguage,
    compiler: execution.compiler,
    points: [
      point(
        100,
        (index + 1) * 10,
        (index + 1) * 11
      ),
      point(
        200,
        (index + 1) * 20,
        (index + 1) * 22
      ),
    ],
  })
);

const compatiblePayload = {
  compatibility: {
    status: "COMPATIBLE",
    blockers: [],
    warnings: [],
    dimensions: {
      benchmark: { status: "MATCH" },
      hardware: { status: "MATCH" },
      measurementBackend: { status: "MATCH" },
      profile: { status: "MATCH" },
      protocol: { status: "MATCH" },
      sourceToolchain: {
        status: "MATCH",
        versionStatus: "MATCH",
      },
      compilerFlags: { status: "MATCH" },
      inputSizes: { status: "MATCH" },
      metrics: { status: "MATCH" },
    },
    commonInputSizes: [100, 200],
    commonMetrics: ["DurationTime"],
    excludedMetrics: [],
  },
  executions,
  metrics: {
    DurationTime: {
      unit: "ms",
      commonInputSizes: [100, 200],
      series,
    },
  },
};

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

const renderEnglishPage = ({
  path = VALID_PATH,
  payload = compatiblePayload,
  candidates = { items: [] },
} = {}) => {
  axios.post.mockImplementation((url) =>
    Promise.resolve({
      data: String(url).endsWith("/candidates")
        ? candidates
        : payload,
    })
  );

  return render(
    <I18nProvider initialLanguage="en">
      <LanguageControl />
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/compare"
            element={
              <ComparisonPage
                currentUser={{
                  role_name: "Student",
                }}
              />
            }
          />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
};

const lastPlotProps = () =>
  mockPlotProps.mock.calls[
    mockPlotProps.mock.calls.length - 1
  ][0];

describe("ComparisonPage i18n", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    axios.get.mockResolvedValue({
      data: {
        submission: { id: 42, courseId: null, course: null },
        permissions: {
          canEditMetadata: true,
          canViewPrivateMetadata: true,
        },
      },
    });
  });

  test("localizes comparison chrome while preserving user and technical data", async () => {
    renderEnglishPage();

    expect(
      await screen.findByRole("heading", {
        name: "Implementation comparison",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText("Comparison analysis")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "2 implementations selected"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Experiment #42 · Experimento del estudiante"
      )
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("alpha.cpp · C++ · g++").length
    ).toBeGreaterThanOrEqual(1);

    expect(
      screen.getByRole("heading", {
        name: "Comparative summary",
      })
    ).toBeInTheDocument();

    const summaryCoverage =
      screen
        .getByText(
          "target metrics comparable"
        )
        .closest(
          ".comparison-page__summary-coverage"
        );
    expect(summaryCoverage).not.toBeNull();
    expect(summaryCoverage).toHaveTextContent(
      "1/5"
    );

    expect(
      screen.getAllByText("SIZE")
    ).toHaveLength(2);

    expect(
      screen.getByText(
        "The executions satisfy the compatibility contract for the common measurements shown."
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole("tab", {
        name: /Key metrics/,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Metric")
    ).toHaveValue("DurationTime");

    expect(
      screen.getByRole("option", {
        name: "Execution time",
      })
    ).toBeInTheDocument();
  });

  test("switches EN to ES including Plotly hover text without refetching", async () => {
    renderEnglishPage();

    await screen.findByRole("heading", {
      name: "Implementation comparison",
    });

    expect(
      lastPlotProps().data[0].hovertemplate
    ).toContain("Median: %{y} ms");

    const callsBeforeSwitch =
      axios.post.mock.calls.length;

    fireEvent.click(
      screen.getByRole("button", {
        name: "switch-es",
      })
    );

    expect(
      await screen.findByRole("heading", {
        name: "Comparación de implementaciones",
      })
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText("Métrica")
    ).toHaveValue("DurationTime");

    await waitFor(() =>
      expect(
        lastPlotProps().data[0].hovertemplate
      ).toContain("Mediana: %{y} ms")
    );

    expect(
      axios.post.mock.calls.length
    ).toBe(callsBeforeSwitch);
  });

  test("localizes invalid query feedback and never submits it", () => {
    renderEnglishPage({
      path: "/compare?execution=only-one",
    });

    expect(
      screen.getByText("Invalid comparison")
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "The URL must include between 2 and 4 implementations."
      )
    ).toBeInTheDocument();

    expect(axios.post).not.toHaveBeenCalled();
  });

  test("localizes backend scientific issue codes in English", async () => {
    renderEnglishPage({
      payload: {
        ...compatiblePayload,
        compatibility: {
          ...compatiblePayload.compatibility,
          status: "LIMITED",
          warnings: [
            {
              code: "PARTIAL_INPUT_OVERLAP",
              message:
                "Detalle científico persistido por el backend.",
            },
          ],
        },
      },
    });

    expect(
      await screen.findByText(
        "Comparison with limited scope"
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "The executions share only part of the measured InputSize domain."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "Detalle científico persistido por el backend."
      )
    ).not.toBeInTheDocument();

    expect(
      screen.getByText("Observations")
    ).toBeInTheDocument();
  });

  test("localizes historical candidate reasons instead of rendering raw backend Spanish", async () => {
    const rawReason =
      "Las ejecuciones usan lenguajes o compiladores diferentes.";

    renderEnglishPage({
      candidates: {
        items: [
          {
            publicId: "public-candidate-c",
            codename: "candidate-c",
            submissionId: 84,
            submissionTitle: "Entrega histórica",
            sourceFilename: "candidate.c",
            createdAt: "2026-08-18T12:00:00Z",
            benchmark: "SIZE",
            profile: "BALANCED",
            sourceLanguage: "C",
            compiler: "gcc",
            status: "LIMITED",
            selectable: true,
            compatibility: {
              status: "LIMITED",
              blockers: [],
              warnings: [
                {
                  code: "SOURCE_TOOLCHAIN_DIFFERS",
                  message: rawReason,
                },
              ],
              commonInputSizes: [100, 200],
              commonMetrics: ["DurationTime"],
            },
            reason: rawReason,
          },
        ],
      },
    });

    await screen.findByRole("heading", {
      name: "Implementation comparison",
    });
    fireEvent.click(
      screen.getByRole("button", {
        name: "Add historical execution",
      })
    );

    expect(
      await screen.findByText(
        "The executions use different languages or compilers; interpret the metrics as a comparison between implementations under different toolchains."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(rawReason)
    ).not.toBeInTheDocument();
  });
});
