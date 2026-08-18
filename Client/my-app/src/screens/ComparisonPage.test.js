import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import axios from "axios";

import ComparisonPage from "./ComparisonPage";

jest.mock("axios");
const mockPlotProps = jest.fn();
jest.mock("react-plotly.js", () => (props) => {
  mockPlotProps(props);
  return <div data-testid="comparison-plot" />;
});

const VALID_PATH = "/compare?execution=execution-a&execution=execution-b";
const STUDENT = { role_name: "Student" };

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="location-probe">
      {location.pathname}{location.search}
    </output>
  );
};

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

const dimensions = {
  benchmark: { status: "MATCH", verified: true },
  hardware: { status: "MATCH", verified: true },
  measurementBackend: { status: "MATCH", verified: true },
  profile: { status: "MATCH", verified: true },
  protocol: { status: "MATCH", verified: true },
  compilerFlags: { status: "MATCH", verified: true },
  sourceProvenance: { status: "VERIFIED", verified: true },
  inputSizes: { status: "MATCH", verified: true },
  metrics: { status: "LIMITED", verified: true },
};

const executions = [
  {
    publicId: "public-a",
    codename: "execution-a",
    submissionId: 42,
    submissionTitle: "Algoritmos de ordenamiento",
    sourceFilename: "std_sort.cpp",
    benchmark: "SIZE",
    profile: "BALANCED",
    compilerFlags: "-O3",
  },
  {
    publicId: "public-b",
    codename: "execution-b",
    submissionId: 42,
    submissionTitle: "Algoritmos de ordenamiento",
    sourceFilename: "insertion_sort.cpp",
    benchmark: "SIZE",
    profile: "BALANCED",
    compilerFlags: "-O3",
  },
];

const series = (multiplier = 1) =>
  executions.map((execution, index) => ({
    publicId: execution.publicId,
    codename: execution.codename,
    sourceFilename: execution.sourceFilename,
    points: [
      point(100, (index + 1) * multiplier * 10, (index + 1) * multiplier * 11),
      point(200, (index + 1) * multiplier * 20, (index + 1) * multiplier * 22),
      point(300, (index + 1) * multiplier * 30, (index + 1) * multiplier * 33),
    ],
  }));

const compatiblePayload = {
  schemaVersion: "1.0",
  compatibility: {
    status: "COMPATIBLE",
    blockers: [],
    warnings: [],
    dimensions,
    commonInputSizes: [100, 200, 300],
    inputCoverage: [],
    commonMetrics: ["IPC", "DurationTime"],
    excludedMetrics: [
      {
        metric: "EnergyPkg",
        reasonCode: "TARGET_METRIC_UNAVAILABLE",
        message: "EnergyPkg no está disponible de forma común.",
      },
    ],
  },
  executions,
  metrics: {
    DurationTime: {
      unit: "ms",
      commonInputSizes: [100, 200, 300],
      series: series(),
    },
    IPC: {
      unit: "ratio",
      commonInputSizes: [100, 200],
      series: series(0.1).map((item) => ({
        ...item,
        points: item.points.slice(0, 2),
      })),
    },
  },
};

const candidate = (status, codename, overrides = {}) => ({
  publicId: `public-${codename}`,
  codename,
  submissionId: 84,
  submissionTitle: "Entrega histórica",
  sourceFilename: `${codename}.cpp`,
  createdAt: "2026-08-18T12:00:00Z",
  benchmark: "SIZE",
  profile: "BALANCED",
  status,
  selectable: ["COMPATIBLE", "LIMITED"].includes(status),
  compatibility: {
    status,
    blockers: [],
    warnings: [],
    commonInputSizes: [100, 200],
    commonMetrics: ["DurationTime"],
  },
  reason:
    status === "COMPATIBLE"
      ? null
      : `Explicación pública ${status.toLowerCase()}.`,
  ...overrides,
});

const candidatesPayload = {
  schemaVersion: "1.0",
  selection: {
    executions: ["execution-a", "execution-b"],
    count: 2,
    max: 4,
  },
  items: [
    candidate("COMPATIBLE", "historical-compatible"),
    candidate("LIMITED", "historical-limited"),
    candidate("INCOMPATIBLE", "historical-incompatible"),
    candidate("UNAVAILABLE", "historical-unavailable"),
  ],
  truncated: false,
};

const renderPage = ({
  path = VALID_PATH,
  currentUser = STUDENT,
} = {}) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/compare"
          element={
            <>
              <ComparisonPage currentUser={currentUser} />
              <LocationProbe />
            </>
          }
        />
        <Route path="/profile" element={<div>Perfil destino</div>} />
      </Routes>
    </MemoryRouter>
  );

const renderResolved = async (
  payload = compatiblePayload,
  options = {}
) => {
  axios.post.mockResolvedValue({ data: payload });
  renderPage(options);
  await screen.findByRole("heading", {
    name: "Comparación de implementaciones",
  });
};

const renderWithCandidates = async ({
  comparison = compatiblePayload,
  candidates = candidatesPayload,
  options = {},
} = {}) => {
  axios.post.mockImplementation((url) =>
    Promise.resolve({
      data: url.endsWith("/candidates") ? candidates : comparison,
    })
  );
  renderPage(options);
  await screen.findByRole("heading", {
    name: "Comparación de implementaciones",
  });
};

const lastPlotProps = () =>
  mockPlotProps.mock.calls[mockPlotProps.mock.calls.length - 1][0];

describe("ComparisonPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("invalid query renders a controlled state and never sends POST", async () => {
    renderPage({ path: "/compare?execution=only-one" });

    expect(
      screen.getByText("Comparación no válida")
    ).toBeInTheDocument();
    expect(axios.post).not.toHaveBeenCalled();
  });

  test("renders a loading state while the comparison request is pending", () => {
    axios.post.mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText("Cargando comparación")).toBeInTheDocument();
  });

  test("posts the exact ordered execution body with credentials", async () => {
    await renderResolved();

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/api\/comparisons$/),
      { executions: ["execution-a", "execution-b"] },
      { withCredentials: true }
    );
  });

  test("COMPATIBLE renders its neutral status and one comparative chart", async () => {
    await renderResolved();

    expect(screen.getByText("Compatible", { selector: "strong" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Las ejecuciones cumplen el contrato de compatibilidad para las mediciones comunes mostradas."
      )
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("comparison-plot")).toHaveLength(1);
  });

  test("renders deterministic guidance for the selected metric and excluded energy", async () => {
    await renderResolved();
    const guidance = screen.getByRole("heading", {
      name: "Cómo interpretar esta comparación",
    }).closest("section");

    expect(
      within(guidance).getByText(
        "Valores menores representan menor tiempo de ejecución observado en los tamaños de entrada comparados."
      )
    ).toBeInTheDocument();
    expect(
      within(guidance).getByText(
        "Compare energía únicamente cuando está disponible para todas las implementaciones seleccionadas."
      )
    ).toBeInTheDocument();
    expect(guidance).not.toHaveTextContent(
      /estadísticamente más rápido|mejor algoritmo|más eficiente/i
    );
  });

  test("pedagogy follows the metric selected by the user", async () => {
    await renderResolved();
    fireEvent.change(screen.getByLabelText("Métrica"), {
      target: { value: "IPC" },
    });
    const guidance = screen.getByRole("heading", {
      name: "Cómo interpretar esta comparación",
    }).closest("section");

    expect(
      within(guidance).getByText(
        "Un IPC mayor describe más instrucciones retiradas por ciclo, pero no implica por sí solo un menor tiempo total."
      )
    ).toBeInTheDocument();
    expect(
      within(guidance).queryByText(
        "Valores menores representan menor tiempo de ejecución observado en los tamaños de entrada comparados."
      )
    ).not.toBeInTheDocument();
  });

  test("LIMITED keeps the chart and renders backend warnings", async () => {
    await renderResolved({
      ...compatiblePayload,
      compatibility: {
        ...compatiblePayload.compatibility,
        status: "LIMITED",
        warnings: [
          {
            message: "Las ejecuciones sólo comparten parte de los InputSize.",
          },
        ],
      },
    });

    expect(screen.getByText("Comparación limitada")).toBeInTheDocument();
    expect(
      screen.getByText("Las ejecuciones sólo comparten parte de los InputSize.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("comparison-plot")).toBeInTheDocument();
  });

  test("LIMITED explains partial overlap, one shared size and visible dispersion", async () => {
    await renderResolved({
      ...compatiblePayload,
      compatibility: {
        ...compatiblePayload.compatibility,
        status: "LIMITED",
        dimensions: {
          ...compatiblePayload.compatibility.dimensions,
          inputSizes: { status: "PARTIAL", verified: true },
        },
        commonInputSizes: [200],
        warnings: [
          {
            code: "PARTIAL_INPUT_OVERLAP",
            message: "Sólo existe cobertura parcial.",
          },
          {
            code: "SINGLE_COMMON_INPUT_SIZE",
            message: "Sólo existe un tamaño común.",
          },
        ],
      },
    });
    const guidance = screen.getByRole("heading", {
      name: "Cómo interpretar esta comparación",
    }).closest("section");

    [
      "Esta comparación es válida únicamente dentro de las limitaciones mostradas.",
      "La comparación se limita a los tamaños de entrada medidos en común. No se interpola ni extrapola fuera de ese dominio.",
      "Existe un único tamaño compartido; esta comparación no permite inferir una tendencia de escalamiento.",
      "Si la dispersión es amplia respecto de las diferencias observadas, conviene interpretar diferencias pequeñas con cautela.",
    ].forEach((message) => {
      expect(within(guidance).getByText(message)).toBeInTheDocument();
    });
  });

  test("INCOMPATIBLE renders zero charts even if a future payload includes metrics", async () => {
    await renderResolved({
      ...compatiblePayload,
      compatibility: {
        ...compatiblePayload.compatibility,
        status: "INCOMPATIBLE",
        blockers: [{ message: "Los benchmarks son diferentes." }],
      },
    });

    expect(screen.getByText("Comparación incompatible")).toBeInTheDocument();
    expect(screen.queryByTestId("comparison-plot")).not.toBeInTheDocument();
    expect(mockPlotProps).not.toHaveBeenCalled();
    const guidance = screen.getByRole("heading", {
      name: "Cómo interpretar esta comparación",
    }).closest("section");
    expect(
      within(guidance).getByText(
        "La comparación fue bloqueada para evitar conclusiones experimentales no justificadas."
      )
    ).toBeInTheDocument();
    expect(guidance).not.toHaveTextContent(
      "Valores menores representan menor tiempo de ejecución observado"
    );
  });

  test("renders blocker messages supplied by the backend", async () => {
    await renderResolved({
      ...compatiblePayload,
      compatibility: {
        ...compatiblePayload.compatibility,
        status: "INCOMPATIBLE",
        blockers: [{ message: "El hardware observado no coincide." }],
      },
    });

    expect(screen.getByText("Bloqueo de compatibilidad")).toBeInTheDocument();
    expect(screen.getByText("El hardware observado no coincide.")).toBeInTheDocument();
  });

  test("renders the eight compatibility dimensions with defensive labels", async () => {
    await renderResolved();
    const region = screen.getByRole("heading", {
      name: "Compatibilidad por dimensión",
    }).closest("section");

    [
      "Benchmark",
      "Hardware",
      "Backend",
      "Perfil",
      "Protocolo",
      "Flags del compilador",
      "Tamaños de entrada",
      "Métricas",
    ].forEach((label) => {
      expect(within(region).getByText(label)).toBeInTheDocument();
    });
    expect(within(region).getAllByText("Compatible").length).toBeGreaterThan(0);
    expect(within(region).getByText("Con limitación")).toBeInTheDocument();
  });

  test("selects DurationTime as the default metric", async () => {
    await renderResolved();

    expect(screen.getByLabelText("Métrica")).toHaveValue("DurationTime");
    expect(lastPlotProps().data[0].y).toEqual([10, 20, 30]);
  });

  test("changes the active chart to IPC", async () => {
    await renderResolved();
    fireEvent.change(screen.getByLabelText("Métrica"), {
      target: { value: "IPC" },
    });

    await waitFor(() =>
      expect(lastPlotProps().data[0].y).toEqual([1, 2])
    );
    expect(screen.getByRole("heading", { name: "Instrucciones por ciclo (IPC)" })).toBeInTheDocument();
  });

  test("an excluded target metric is not selectable", async () => {
    await renderResolved();
    const metricSelect = screen.getByLabelText("Métrica");

    expect(
      within(metricSelect).queryByRole("option", {
        name: "Energía del paquete CPU",
      })
    ).not.toBeInTheDocument();
  });

  test("renders excluded metrics in a secondary explanatory block", async () => {
    await renderResolved();

    const section = screen.getByRole("heading", {
      name: "Métricas no comparables",
    }).closest("section");
    expect(within(section).getByText("Energía del paquete CPU")).toBeInTheDocument();
    expect(
      within(section).getByText("EnergyPkg no está disponible de forma común.")
    ).toBeInTheDocument();
  });

  test("switches aggregation from median to mean without recomputing values", async () => {
    await renderResolved();
    fireEvent.click(screen.getByLabelText("Media"));

    await waitFor(() =>
      expect(lastPlotProps().data[0].y).toEqual([11, 22, 33])
    );
  });

  test("toggles dispersion while preserving the central series", async () => {
    await renderResolved();
    expect(
      screen.getByText(
        "Si la dispersión es amplia respecto de las diferencias observadas, conviene interpretar diferencias pequeñas con cautela."
      )
    ).toBeInTheDocument();
    expect(lastPlotProps().data[0]).toHaveProperty("error_y");
    fireEvent.click(screen.getByLabelText("Mostrar dispersión"));

    await waitFor(() =>
      expect(lastPlotProps().data[0]).not.toHaveProperty("error_y")
    );
    expect(lastPlotProps().data[0].y).toEqual([10, 20, 30]);
    expect(
      screen.queryByText(
        "Si la dispersión es amplia respecto de las diferencias observadas, conviene interpretar diferencias pequeñas con cautela."
      )
    ).not.toBeInTheDocument();
  });

  test("filters the chart to exact existing InputSize points", async () => {
    await renderResolved();
    fireEvent.change(screen.getByLabelText("InputSize mínimo"), {
      target: { value: "200" },
    });

    expect(screen.getByLabelText("InputSize mínimo")).toHaveValue("200");
    await waitFor(() =>
      expect(lastPlotProps().data[0].x).toEqual([200, 300])
    );

    fireEvent.change(screen.getByLabelText("InputSize máximo"), {
      target: { value: "200" },
    });

    await waitFor(() => expect(lastPlotProps().data[0].x).toEqual([200]));
  });

  test("resets the InputSize range to the full metric domain", async () => {
    await renderResolved();
    fireEvent.change(screen.getByLabelText("InputSize mínimo"), {
      target: { value: "200" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Restablecer rango" }));

    await waitFor(() =>
      expect(lastPlotProps().data[0].x).toEqual([100, 200, 300])
    );
  });

  test("retry repeats the POST with the same ordered executions", async () => {
    axios.post
      .mockRejectedValueOnce({ response: { status: 500 } })
      .mockResolvedValueOnce({ data: compatiblePayload });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));
    await screen.findByRole("heading", {
      name: "Comparación de implementaciones",
    });

    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post.mock.calls[1].slice(1)).toEqual(
      axios.post.mock.calls[0].slice(1)
    );
  });

  test.each([
    [401, "Tu sesión ya no permite consultar esta comparación."],
    [403, "No tienes permisos para comparar una o más de estas ejecuciones."],
    [404, "Una de las ejecuciones o sus resultados ya no está disponible."],
    [409, "Una de las ejecuciones todavía no tiene resultados publicables."],
    [422, "Los resultados no cumplen el contrato necesario para compararlos."],
  ])("renders the controlled %i response", async (status, description) => {
    axios.post.mockRejectedValue({ response: { status } });
    renderPage();

    expect(await screen.findByText(description)).toBeInTheDocument();
  });

  test("renders the network-specific error", async () => {
    axios.post.mockRejectedValue(new Error("offline"));
    renderPage();

    expect(
      await screen.findByText("No pudimos conectar con el servidor.")
    ).toBeInTheDocument();
  });

  test("renders a generic error without exposing server details", async () => {
    axios.post.mockRejectedValue({
      response: { status: 500, data: { private: "stack-secret" } },
    });
    renderPage();

    expect(
      await screen.findByText("No fue posible cargar la comparación.")
    ).toBeInTheDocument();
    expect(screen.queryByText("stack-secret")).not.toBeInTheDocument();
  });

  test("never renders private or raw keys from otherwise valid payloads", async () => {
    await renderResolved({
      ...compatiblePayload,
      privatePath: "/private/results.csv",
      rawObject: { secret: "do-not-render" },
      executions: compatiblePayload.executions.map((item) => ({
        ...item,
        result_path: "/private/result.csv",
      })),
    });

    expect(screen.queryByText(/private\/results/)).not.toBeInTheDocument();
    expect(screen.queryByText("do-not-render")).not.toBeInTheDocument();
  });

  test("same-submission comparison links back to its experiment", async () => {
    await renderResolved();

    expect(
      screen.getByText("Experimento #42 · Algoritmos de ordenamiento")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver al experimento" })
    ).toHaveAttribute("href", "/submissions/42");
    const breadcrumbs = screen.getByRole("navigation", {
      name: "Ruta de navegación",
    });
    expect(
      within(breadcrumbs).getByRole("link", { name: "Experimento #42" })
    ).toHaveAttribute("href", "/submissions/42");
    expect(within(breadcrumbs).getByText("Comparación")).toHaveAttribute(
      "aria-current",
      "page"
    );
  });

  test.each([
    [{ role_name: "Student" }, "/profile", "Mi perfil"],
    [{ role_name: "Teacher" }, "/teacher/courses", "Supervisión"],
    [{ role_name: "Admin" }, "/admin/users", "Usuarios"],
  ])("mixed submissions use the canonical role fallback", async (currentUser, href, label) => {
    await renderResolved(
      {
        ...compatiblePayload,
        executions: [
          compatiblePayload.executions[0],
          { ...compatiblePayload.executions[1], submissionId: 84 },
        ],
      },
      { currentUser }
    );

    expect(screen.getByText("Ejecuciones de distintos experimentos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Volver" })).toHaveAttribute(
      "href",
      href
    );
    const breadcrumbs = screen.getByRole("navigation", {
      name: "Ruta de navegación",
    });
    expect(
      within(breadcrumbs).getByRole("link", { name: label })
    ).toHaveAttribute("href", href);
    expect(breadcrumbs).not.toHaveTextContent(/propietario|owner|usuario #/i);
  });

  test("uses sourceFilename as the primary unique legend label", async () => {
    await renderResolved();

    expect(lastPlotProps().data.map((trace) => trace.name)).toEqual([
      "std_sort.cpp",
      "insertion_sort.cpp",
    ]);
  });

  test("passes responsive and logo-free configuration to Plotly", async () => {
    await renderResolved();
    const props = lastPlotProps();

    expect(props.config).toEqual({ responsive: true, displaylogo: false });
    expect(props.useResizeHandler).toBe(true);
    expect(props.style).toEqual({ width: "100%", height: "100%" });
    expect(props.layout.autosize).toBe(true);
  });

  test("renders only one active Plot when multiple metrics are common", async () => {
    await renderResolved();
    fireEvent.change(screen.getByLabelText("Métrica"), {
      target: { value: "IPC" },
    });

    expect(screen.getAllByTestId("comparison-plot")).toHaveLength(1);
  });

  test("compatible response without common metrics renders a controlled state", async () => {
    await renderResolved({
      ...compatiblePayload,
      compatibility: {
        ...compatiblePayload.compatibility,
        commonMetrics: [],
      },
      metrics: {},
    });

    expect(screen.getByText("Sin métricas comparables")).toBeInTheDocument();
    expect(screen.queryByTestId("comparison-plot")).not.toBeInTheDocument();
  });

  test.each([2, 3])(
    "historical action is enabled with %i selected executions",
    async (count) => {
      const selected = [
        ...executions,
        ...(count === 3
          ? [
              {
                ...executions[0],
                publicId: "public-c",
                codename: "execution-c",
                sourceFilename: "merge_sort.cpp",
              },
            ]
          : []),
      ];
      await renderWithCandidates({
        comparison: { ...compatiblePayload, executions: selected },
        options: {
          path:
            count === 3
              ? `${VALID_PATH}&execution=execution-c`
              : VALID_PATH,
        },
      });

      expect(
        screen.getByRole("button", { name: "Agregar ejecución histórica" })
      ).toBeEnabled();
    }
  );

  test("four selected executions expose the max state and cannot search", async () => {
    await renderWithCandidates({
      options: {
        path: `${VALID_PATH}&execution=execution-c&execution=execution-d`,
      },
    });

    expect(
      screen.getByRole("button", { name: "Máximo 4 implementaciones" })
    ).toBeDisabled();
    expect(
      axios.post.mock.calls.some(([url]) => url.endsWith("/candidates"))
    ).toBe(false);
  });

  test("an incompatible current comparison cannot open historical search", async () => {
    await renderWithCandidates({
      comparison: {
        ...compatiblePayload,
        compatibility: {
          ...compatiblePayload.compatibility,
          status: "INCOMPATIBLE",
          blockers: [{ message: "Selección incompatible." }],
        },
      },
    });

    expect(
      screen.getByRole("button", { name: "Agregar ejecución histórica" })
    ).toBeDisabled();
  });

  test("candidate search posts exact body, order and credentials", async () => {
    await renderWithCandidates();
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar ejecución histórica" })
    );

    await screen.findByRole("heading", { name: "Ejecuciones históricas" });
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringMatching(/api\/comparisons\/candidates$/),
        { executions: ["execution-a", "execution-b"] },
        { withCredentials: true }
      )
    );
  });

  test("historical panel renders a loading state", async () => {
    axios.post.mockImplementation((url) =>
      url.endsWith("/candidates")
        ? new Promise(() => {})
        : Promise.resolve({ data: compatiblePayload })
    );
    renderPage();
    await screen.findByRole("heading", {
      name: "Comparación de implementaciones",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar ejecución histórica" })
    );

    expect(
      await screen.findByText("Buscando ejecuciones históricas")
    ).toBeInTheDocument();
  });

  test("historical error retry repeats the same candidate request", async () => {
    let candidateAttempts = 0;
    axios.post.mockImplementation((url) => {
      if (url.endsWith("/candidates")) {
        candidateAttempts += 1;
        return candidateAttempts === 1
          ? Promise.reject({ response: { status: 500 } })
          : Promise.resolve({ data: candidatesPayload });
      }
      return Promise.resolve({ data: compatiblePayload });
    });
    renderPage();
    await screen.findByRole("heading", {
      name: "Comparación de implementaciones",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar ejecución histórica" })
    );
    fireEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    expect(
      await screen.findByRole("heading", {
        name: "historical-compatible.cpp",
      })
    ).toBeInTheDocument();
    expect(candidateAttempts).toBe(2);
  });

  test("default historical view shows only compatible and limited candidates", async () => {
    await renderWithCandidates();
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar ejecución histórica" })
    );

    expect(
      await screen.findByRole("heading", {
        name: "historical-compatible.cpp",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "historical-limited.cpp" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "historical-incompatible.cpp" })
    ).not.toBeInTheDocument();
  });

  test("toggle reveals incompatible and unavailable candidates", async () => {
    await renderWithCandidates();
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar ejecución histórica" })
    );
    fireEvent.click(await screen.findByLabelText("Mostrar incompatibles"));

    expect(
      screen.getByRole("heading", { name: "historical-incompatible.cpp" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "historical-unavailable.cpp" })
    ).toBeInTheDocument();
  });

  test.each([
    ["historical-compatible.cpp", "historical-compatible"],
    ["historical-limited.cpp", "historical-limited"],
  ])("selectable candidate %s appends to the query", async (heading, codename) => {
    await renderWithCandidates();
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar ejecución histórica" })
    );
    const card = (await screen.findByRole("heading", { name: heading })).closest(
      "article"
    );
    fireEvent.click(within(card).getByRole("button", { name: "Agregar" }));

    await waitFor(() =>
      expect(screen.getByTestId("location-probe")).toHaveTextContent(
        `${VALID_PATH}&execution=${codename}`
      )
    );
    await waitFor(() =>
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringMatching(/api\/comparisons$/),
        { executions: ["execution-a", "execution-b", codename] },
        { withCredentials: true }
      )
    );
  });

  test("incompatible and unavailable candidate actions remain disabled", async () => {
    await renderWithCandidates();
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar ejecución histórica" })
    );
    fireEvent.click(await screen.findByLabelText("Mostrar incompatibles"));

    for (const heading of [
      "historical-incompatible.cpp",
      "historical-unavailable.cpp",
    ]) {
      const card = screen.getByRole("heading", { name: heading }).closest("article");
      expect(
        within(card).getByRole("button", { name: "No se puede agregar" })
      ).toBeDisabled();
    }
  });

  test("a candidate already selected cannot duplicate the URL", async () => {
    await renderWithCandidates({
      candidates: {
        ...candidatesPayload,
        items: [
          candidate("COMPATIBLE", "execution-a", {
            sourceFilename: "std_sort.cpp",
          }),
        ],
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar ejecución histórica" })
    );
    const button = await screen.findByRole("button", { name: "Ya seleccionada" });

    expect(button).toBeDisabled();
    expect(screen.getByTestId("location-probe")).toHaveTextContent(VALID_PATH);
  });

  test("empty compatible subset renders the explicit historical state", async () => {
    await renderWithCandidates({
      candidates: {
        ...candidatesPayload,
        items: [candidate("INCOMPATIBLE", "historical-incompatible")],
      },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Agregar ejecución histórica" })
    );

    expect(
      await screen.findByText(
        "No encontramos ejecuciones históricas compatibles con la selección actual."
      )
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Mostrar incompatibles")).toBeInTheDocument();
  });

  test.each([3, 4])(
    "removing from %i executions rebuilds the query and preserves order",
    async (count) => {
      const extra = [
        {
          ...executions[0],
          publicId: "public-c",
          codename: "execution-c",
          sourceFilename: "merge_sort.cpp",
        },
        {
          ...executions[0],
          publicId: "public-d",
          codename: "execution-d",
          sourceFilename: "heap_sort.cpp",
        },
      ].slice(0, count - 2);
      const selected = [...executions, ...extra];
      const path = `${VALID_PATH}${extra
        .map((item) => `&execution=${item.codename}`)
        .join("")}`;
      await renderWithCandidates({
        comparison: { ...compatiblePayload, executions: selected },
        options: { path },
      });

      fireEvent.click(
        screen.getByRole("button", { name: "Quitar insertion_sort.cpp" })
      );

      const remaining = ["execution-a", ...extra.map((item) => item.codename)];
      await waitFor(() =>
        expect(screen.getByTestId("location-probe")).toHaveTextContent(
          `/compare?${remaining
            .map((value) => `execution=${value}`)
            .join("&")}`
        )
      );
    }
  );

  test("exactly two executions expose no remove action", async () => {
    await renderResolved();
    expect(
      screen.queryByRole("button", { name: /^Quitar / })
    ).not.toBeInTheDocument();
  });
});
