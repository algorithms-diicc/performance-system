import {
  appendHistoricalExecution,
  buildComparisonInterpretation,
  buildComparisonPath,
  buildComparisonTraces,
  buildUniqueSeriesLabels,
  canAddHistoricalCandidate,
  defaultComparisonMetric,
  filterHistoricalCandidates,
  filterPointsByInputRange,
  formatHistoricalCandidateDate,
  historicalCandidatePresentation,
  initialComparisonSelection,
  isComparisonEligibleExecution,
  normalizeInputRange,
  orderCommonMetrics,
  orderSelectedExecutions,
  parseExecutionQuery,
  removeComparisonExecution,
  toggleComparisonSelection,
} from "./comparisonModel";

const query = (...executions) => {
  const params = new URLSearchParams();
  executions.forEach((execution) => params.append("execution", execution));
  return params;
};

const execution = (codename, overrides = {}) => ({
  codename,
  state: "COMPLETED",
  resultAvailable: true,
  ...overrides,
});

const metricData = {
  unit: "ms",
  commonInputSizes: [100, 200, 300],
  series: [
    {
      sourceFilename: "first.cpp",
      points: [
        {
          inputSize: 100,
          median: 10,
          mean: 11,
          q1: 8,
          q3: 13,
          stddev: 1.5,
          samplesValid: 9,
          samplesTotal: 10,
        },
        {
          inputSize: 200,
          median: 20,
          mean: 22,
          q1: 17,
          q3: 24,
          stddev: 2,
          samplesValid: 10,
          samplesTotal: 10,
        },
        {
          inputSize: 300,
          median: null,
          mean: Number.NaN,
          q1: 25,
          q3: 34,
          stddev: 3,
        },
      ],
    },
  ],
};

describe("comparisonModel query contract", () => {
  test.each([
    [["a", "b"], 2],
    [["a", "b", "c"], 3],
    [["a", "b", "c", "d"], 4],
  ])("accepts %i ordered executions", (values, count) => {
    const parsed = parseExecutionQuery(query(...values));
    expect(parsed).toEqual({ valid: true, executions: values, reason: "" });
    expect(parsed.executions).toHaveLength(count);
  });

  test.each([
    [["only-one"], /entre 2 y 4/],
    [["a", "b", "c", "d", "e"], /entre 2 y 4/],
    [["a", "a"], /una sola vez/],
    [["a", "   "], /vacía/],
  ])("rejects an invalid execution query", (values, message) => {
    const parsed = parseExecutionQuery(query(...values));
    expect(parsed.valid).toBe(false);
    expect(parsed.reason).toMatch(message);
  });

  test("preserves query order and serializes repeated execution keys", () => {
    const path = buildComparisonPath(["third", "first"]);
    expect(path).toBe("/compare?execution=third&execution=first");
    expect(parseExecutionQuery(path.split("?")[1]).executions).toEqual([
      "third",
      "first",
    ]);
  });
});

describe("comparisonModel submission selection", () => {
  test("eligibility requires completed, published results and codename", () => {
    expect(isComparisonEligibleExecution(execution("ready"))).toBe(true);
    expect(
      isComparisonEligibleExecution(execution("failed", { state: "FAILED" }))
    ).toBe(false);
    expect(
      isComparisonEligibleExecution(
        execution("missing", { resultAvailable: false })
      )
    ).toBe(false);
    expect(isComparisonEligibleExecution(execution("  "))).toBe(false);
  });

  test("preselects two through four eligible executions, never an arbitrary subset", () => {
    expect(initialComparisonSelection([execution("a"), execution("b")])).toEqual([
      "a",
      "b",
    ]);
    expect(
      initialComparisonSelection(
        ["a", "b", "c", "d"].map((value) => execution(value))
      )
    ).toEqual(["a", "b", "c", "d"]);
    expect(
      initialComparisonSelection(
        ["a", "b", "c", "d", "e"].map((value) => execution(value))
      )
    ).toEqual([]);
  });

  test("blocks a fifth selection and restores capacity after deselection", () => {
    const full = ["a", "b", "c", "d"];
    expect(toggleComparisonSelection(full, "e")).toEqual(full);
    const reduced = toggleComparisonSelection(full, "b");
    expect(toggleComparisonSelection(reduced, "e")).toEqual([
      "a",
      "c",
      "d",
      "e",
    ]);
  });

  test("orders the selected executions by their visual card order", () => {
    const ordered = [execution("a"), execution("b"), execution("c")];
    expect(orderSelectedExecutions(ordered, ["c", "a"])).toEqual(["a", "c"]);
  });
});

describe("comparisonModel historical candidates", () => {
  const candidates = [
    { codename: "compatible", status: "COMPATIBLE", selectable: true },
    { codename: "limited", status: "LIMITED", selectable: true },
    { codename: "incompatible", status: "INCOMPATIBLE", selectable: false },
    { codename: "unavailable", status: "UNAVAILABLE", selectable: false },
  ];

  test("maps the four public statuses defensively", () => {
    expect(historicalCandidatePresentation("COMPATIBLE")).toMatchObject({
      label: "Compatible",
      selectable: true,
    });
    expect(historicalCandidatePresentation("LIMITED")).toMatchObject({
      label: "Con limitaciones",
      selectable: true,
    });
    expect(historicalCandidatePresentation("INCOMPATIBLE")).toMatchObject({
      label: "Incompatible",
      selectable: false,
    });
    expect(historicalCandidatePresentation("unknown")).toMatchObject({
      label: "No disponible",
      selectable: false,
    });
  });

  test("default filtering shows only compatible and limited candidates", () => {
    expect(filterHistoricalCandidates(candidates, false)).toEqual(
      candidates.slice(0, 2)
    );
    expect(filterHistoricalCandidates(candidates, true)).toEqual(candidates);
  });

  test("adding preserves order and appends the candidate", () => {
    expect(appendHistoricalExecution(["A", "B"], "C")).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  test("adding never duplicates or creates a fifth execution", () => {
    expect(appendHistoricalExecution(["A", "B"], "A")).toEqual(["A", "B"]);
    expect(appendHistoricalExecution(["A", "B", "C", "D"], "E")).toEqual([
      "A",
      "B",
      "C",
      "D",
    ]);
  });

  test("removing is allowed above two and preserves remaining order", () => {
    expect(removeComparisonExecution(["A", "B", "C", "D"], "B")).toEqual([
      "A",
      "C",
      "D",
    ]);
  });

  test("removing cannot leave fewer than two executions", () => {
    expect(removeComparisonExecution(["A", "B"], "A")).toEqual(["A", "B"]);
  });

  test("candidate eligibility defends status, duplicates and max four", () => {
    expect(canAddHistoricalCandidate(candidates[0], ["A", "B"])).toBe(true);
    expect(canAddHistoricalCandidate(candidates[2], ["A", "B"])).toBe(false);
    expect(canAddHistoricalCandidate(candidates[0], ["compatible", "B"])).toBe(
      false
    );
    expect(canAddHistoricalCandidate(candidates[0], ["A", "B", "C", "D"])).toBe(
      false
    );
  });

  test("historical date formatting is stable across Unicode whitespace", () => {
    const value = formatHistoricalCandidateDate("2026-08-18T12:00:00Z");
    expect(value).not.toMatch(/[\u00a0\u202f]/u);
    expect(formatHistoricalCandidateDate("invalid")).toBe(
      "Fecha no disponible"
    );
  });
});

describe("comparisonModel metrics and traces", () => {
  const metrics = {
    EnergyPkg: {},
    Instructions: {},
    DurationTime: {},
    IPC: {},
    AlphaMetric: {},
  };

  test("orders target metrics first and additional metrics alphabetically", () => {
    expect(orderCommonMetrics(Object.keys(metrics), metrics)).toEqual([
      "DurationTime",
      "IPC",
      "EnergyPkg",
      "AlphaMetric",
      "Instructions",
    ]);
  });

  test("uses DurationTime as default and falls back to the first common metric", () => {
    expect(defaultComparisonMetric(Object.keys(metrics), metrics)).toBe(
      "DurationTime"
    );
    expect(defaultComparisonMetric(["Instructions", "IPC"], metrics)).toBe(
      "IPC"
    );
  });

  test("creates stable unique legend labels and filename fallbacks", () => {
    expect(
      buildUniqueSeriesLabels([
        { sourceFilename: "sort.cpp" },
        { sourceFilename: "sort.cpp" },
        { sourceFilename: null },
      ])
    ).toEqual(["sort.cpp · 1", "sort.cpp · 2", "Implementación 3"]);
  });

  test("normalizes a range to exact domain values", () => {
    expect(normalizeInputRange([300, 100, 200, 200], 200, 300)).toEqual({
      domain: [100, 200, 300],
      minimum: 200,
      maximum: 300,
    });
    expect(normalizeInputRange([100, 200], 150, 999)).toMatchObject({
      minimum: 100,
      maximum: 200,
    });
  });

  test("filters only existing points without interpolation", () => {
    const points = metricData.series[0].points;
    expect(filterPointsByInputRange(points, 150, 250)).toEqual([points[1]]);
  });

  test("builds median traces with exact asymmetric Q1/Q3 error bars", () => {
    const [trace] = buildComparisonTraces({ metricData, aggregation: "median" });
    expect(trace.x).toEqual([100, 200]);
    expect(trace.y).toEqual([10, 20]);
    expect(trace.error_y).toMatchObject({
      symmetric: false,
      array: [3, 4],
      arrayminus: [2, 3],
    });
    expect(trace.name).toBe("first.cpp");
  });

  test("builds mean traces with exact symmetric stddev error bars", () => {
    const [trace] = buildComparisonTraces({ metricData, aggregation: "mean" });
    expect(trace.y).toEqual([11, 22]);
    expect(trace.error_y).toMatchObject({
      symmetric: true,
      array: [1.5, 2],
    });
  });

  test("dispersion can be hidden without removing central values", () => {
    const [trace] = buildComparisonTraces({
      metricData,
      aggregation: "median",
      showDispersion: false,
    });
    expect(trace.y).toEqual([10, 20]);
    expect(trace).not.toHaveProperty("error_y");
  });

  test("null and nonfinite central values are omitted instead of becoming zero", () => {
    const [medianTrace] = buildComparisonTraces({ metricData });
    const [meanTrace] = buildComparisonTraces({
      metricData,
      aggregation: "mean",
    });
    expect(medianTrace.y).not.toContain(0);
    expect(meanTrace.y).not.toContain(0);
    expect(medianTrace.x).not.toContain(300);
    expect(meanTrace.x).not.toContain(300);
  });
});

describe("comparisonModel deterministic pedagogy", () => {
  const compatible = {
    status: "COMPATIBLE",
    blockers: [],
    warnings: [],
    dimensions: { inputSizes: { status: "MATCH" } },
    commonInputSizes: [100, 200],
    excludedMetrics: [],
  };

  test.each([
    [
      "DurationTime",
      "Valores menores representan menor tiempo de ejecución observado en los tamaños de entrada comparados.",
    ],
    [
      "IPC",
      "Un IPC mayor describe más instrucciones retiradas por ciclo, pero no implica por sí solo un menor tiempo total.",
    ],
    [
      "CacheMissRate",
      "Una tasa menor indica menos fallos de caché observados; no demuestra por sí sola la causa del rendimiento.",
    ],
    [
      "BranchMissRate",
      "Una tasa menor indica menos fallos de predicción observados; no constituye una explicación causal por sí sola.",
    ],
    [
      "EnergyPkg",
      "Compare energía únicamente cuando está disponible para todas las implementaciones seleccionadas.",
    ],
  ])("explains %s without declaring a winner", (selectedMetric, expected) => {
    const messages = buildComparisonInterpretation({
      compatibility: compatible,
      selectedMetric,
      metricData: null,
    });

    expect(messages).toContain(expected);
    expect(messages.join(" ")).not.toMatch(
      /estadísticamente más rápido|mejor algoritmo|más eficiente/i
    );
  });

  test("combines LIMITED, partial overlap, single size and visible dispersion", () => {
    const messages = buildComparisonInterpretation({
      compatibility: {
        ...compatible,
        status: "LIMITED",
        dimensions: { inputSizes: { status: "PARTIAL" } },
        commonInputSizes: [200],
        warnings: [
          { code: "PARTIAL_INPUT_OVERLAP" },
          { code: "SINGLE_COMMON_INPUT_SIZE" },
        ],
      },
      selectedMetric: "DurationTime",
      metricData,
      aggregation: "median",
      showDispersion: true,
    });

    expect(messages).toEqual([
      "Valores menores representan menor tiempo de ejecución observado en los tamaños de entrada comparados.",
      "Esta comparación es válida únicamente dentro de las limitaciones mostradas.",
      "La comparación se limita a los tamaños de entrada medidos en común. No se interpola ni extrapola fuera de ese dominio.",
      "Existe un único tamaño compartido; esta comparación no permite inferir una tendencia de escalamiento.",
      "Si la dispersión es amplia respecto de las diferencias observadas, conviene interpretar diferencias pequeñas con cautela.",
    ]);
  });

  test("INCOMPATIBLE blocks performance interpretation regardless of supplied metrics", () => {
    expect(
      buildComparisonInterpretation({
        compatibility: {
          ...compatible,
          status: "INCOMPATIBLE",
          blockers: [{ code: "HARDWARE_MISMATCH" }],
        },
        selectedMetric: "DurationTime",
        metricData,
      })
    ).toEqual([
      "La comparación fue bloqueada para evitar conclusiones experimentales no justificadas.",
    ]);
  });

  test("an excluded energy metric retains the all-implementations caveat", () => {
    const messages = buildComparisonInterpretation({
      compatibility: {
        ...compatible,
        status: "LIMITED",
        excludedMetrics: [{ metric: "EnergyPkg" }],
      },
      selectedMetric: "DurationTime",
      metricData: null,
    });

    expect(messages).toContain(
      "Compare energía únicamente cuando está disponible para todas las implementaciones seleccionadas."
    );
  });

  test("does not mention dispersion when the user hides it", () => {
    const messages = buildComparisonInterpretation({
      compatibility: compatible,
      selectedMetric: "DurationTime",
      metricData,
      showDispersion: false,
    });

    expect(messages.join(" ")).not.toContain("Si la dispersión es amplia");
  });
});
