export const MIN_COMPARISON_EXECUTIONS = 2;
export const MAX_COMPARISON_EXECUTIONS = 4;

export const TARGET_METRICS = Object.freeze([
  "DurationTime",
  "IPC",
  "CacheMissRate",
  "BranchMissRate",
  "EnergyPkg",
]);

const resolveText = (
  t,
  key,
  fallback,
  params = {}
) =>
  typeof t === "function"
    ? t(key, params)
    : fallback;


export const HISTORICAL_CANDIDATE_STATUSES = Object.freeze({
  COMPATIBLE: { label: "Compatible", tone: "success", selectable: true },
  LIMITED: {
    label: "Con limitaciones",
    tone: "warning",
    selectable: true,
  },
  INCOMPATIBLE: {
    label: "Incompatible",
    tone: "danger",
    selectable: false,
  },
  UNAVAILABLE: {
    label: "No disponible",
    tone: "neutral",
    selectable: false,
  },
});

const METRIC_LABELS = Object.freeze({
  DurationTime: "Tiempo de ejecución",
  IPC: "Instrucciones por ciclo (IPC)",
  CacheMissRate: "Tasa de fallos de caché",
  BranchMissRate: "Tasa de fallos de predicción",
  EnergyPkg: "Energía del paquete CPU",
});

const METRIC_INTERPRETATIONS = Object.freeze({
  DurationTime:
    "Valores menores representan menor tiempo de ejecución observado en los tamaños de entrada comparados.",
  IPC:
    "Un IPC mayor describe más instrucciones retiradas por ciclo, pero no implica por sí solo un menor tiempo total.",
  CacheMissRate:
    "Una tasa menor indica menos fallos de caché observados; no demuestra por sí sola la causa del rendimiento.",
  BranchMissRate:
    "Una tasa menor indica menos fallos de predicción observados; no constituye una explicación causal por sí sola.",
  EnergyPkg:
    "Compare energía únicamente cuando está disponible para todas las implementaciones seleccionadas.",
});

const LIMITED_INTERPRETATION =
  "Esta comparación es válida únicamente dentro de las limitaciones mostradas.";
const INCOMPATIBLE_INTERPRETATION =
  "La comparación fue bloqueada para evitar conclusiones experimentales no justificadas.";
const PARTIAL_OVERLAP_INTERPRETATION =
  "La comparación se limita a los tamaños de entrada medidos en común. No se interpola ni extrapola fuera de ese dominio.";
const SINGLE_INPUT_INTERPRETATION =
  "Existe un único tamaño compartido; esta comparación no permite inferir una tendencia de escalamiento.";
const DISPERSION_INTERPRETATION =
  "Si la dispersión es amplia respecto de las diferencias observadas, conviene interpretar diferencias pequeñas con cautela.";

export const COMPARISON_DIMENSIONS = Object.freeze([
  ["benchmark", "Benchmark"],
  ["hardware", "Hardware"],
  ["measurementBackend", "Backend"],
  ["profile", "Perfil"],
  ["protocol", "Protocolo"],
  ["compilerFlags", "Flags del compilador"],
  ["inputSizes", "Tamaños de entrada"],
  ["metrics", "Métricas"],
]);

export const comparisonDimensionLabel = (
  key,
  t
) => {
  const fallback =
    COMPARISON_DIMENSIONS.find(
      ([dimensionKey]) => dimensionKey === key
    )?.[1] || String(key || "");

  return resolveText(
    t,
    `comparisonModel.dimensions.${key}`,
    fallback
  );
};


const MARKER_SYMBOLS = ["circle", "square", "diamond", "triangle-up"];
const LINE_DASHES = ["solid", "dash", "dot", "dashdot"];

const cleanCodename = (value) => String(value ?? "").trim();

const finiteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const uniqueNumericDomain = (values) =>
  Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map(finiteNumber)
        .filter((value) => value !== null)
    )
  ).sort((left, right) => left - right);

export const parseExecutionQuery = (
  value,
  t
) => {
  const searchParams =
    value instanceof URLSearchParams
      ? value
      : new URLSearchParams(String(value || "").replace(/^\?/, ""));
  const executions = searchParams
    .getAll("execution")
    .map(cleanCodename);

  if (
    executions.length < MIN_COMPARISON_EXECUTIONS ||
    executions.length > MAX_COMPARISON_EXECUTIONS
  ) {
    return {
      valid: false,
      executions,
      reason: resolveText(
        t,
        "comparisonModel.query.count",
        "La URL debe incluir entre 2 y 4 implementaciones."
      ),
    };
  }

  if (executions.some((codename) => !codename)) {
    return {
      valid: false,
      executions,
      reason: resolveText(
        t,
        "comparisonModel.query.empty",
        "La URL contiene una implementación vacía."
      ),
    };
  }

  if (new Set(executions).size !== executions.length) {
    return {
      valid: false,
      executions,
      reason: resolveText(
        t,
        "comparisonModel.query.duplicate",
        "Cada implementación debe aparecer una sola vez."
      ),
    };
  }

  return { valid: true, executions, reason: "" };
};

export const buildComparisonPath = (executions) => {
  const searchParams = new URLSearchParams();

  (Array.isArray(executions) ? executions : []).forEach((value) => {
    searchParams.append("execution", cleanCodename(value));
  });

  return `/compare?${searchParams.toString()}`;
};

export const historicalCandidatePresentation = (
  status,
  t
) => {
  const normalized = String(status || "").trim().toUpperCase();
  const statusKey = Object.prototype.hasOwnProperty.call(
    HISTORICAL_CANDIDATE_STATUSES,
    normalized
  )
    ? normalized
    : "UNAVAILABLE";
  const fallback =
    HISTORICAL_CANDIDATE_STATUSES[statusKey];

  return {
    ...fallback,
    label: resolveText(
      t,
      `comparisonModel.historicalStatuses.${statusKey.toLowerCase()}`,
      fallback.label
    ),
  };
};

export const filterHistoricalCandidates = (items, showIncompatible) =>
  (Array.isArray(items) ? items : []).filter((item) => {
    const status = String(item?.status || "").trim().toUpperCase();
    if (showIncompatible) {
      return Object.prototype.hasOwnProperty.call(
        HISTORICAL_CANDIDATE_STATUSES,
        status
      );
    }
    return ["COMPATIBLE", "LIMITED"].includes(status);
  });

export const appendHistoricalExecution = (executions, codename) => {
  const current = (Array.isArray(executions) ? executions : [])
    .map(cleanCodename)
    .filter(Boolean);
  const candidate = cleanCodename(codename);

  if (
    !candidate ||
    current.includes(candidate) ||
    current.length >= MAX_COMPARISON_EXECUTIONS
  ) {
    return current;
  }
  return [...current, candidate];
};

export const removeComparisonExecution = (executions, codename) => {
  const current = (Array.isArray(executions) ? executions : [])
    .map(cleanCodename)
    .filter(Boolean);
  const target = cleanCodename(codename);

  if (current.length <= MIN_COMPARISON_EXECUTIONS || !current.includes(target)) {
    return current;
  }
  return current.filter((value) => value !== target);
};

export const canAddHistoricalCandidate = (
  item,
  selectedExecutions
) => {
  const presentation = historicalCandidatePresentation(item?.status);
  const current = (Array.isArray(selectedExecutions)
    ? selectedExecutions
    : []
  )
    .map(cleanCodename)
    .filter(Boolean);
  const codename = cleanCodename(item?.codename);

  return (
    presentation.selectable &&
    item?.selectable === true &&
    Boolean(codename) &&
    !current.includes(codename) &&
    current.length < MAX_COMPARISON_EXECUTIONS
  );
};

export const formatHistoricalCandidateDate = (
  value,
  locale = "es-CL",
  fallback = "Fecha no disponible"
) => {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  })
    .format(date)
    .replace(/[\s\u00a0\u202f]+/gu, " ")
    .trim();
};

export const isComparisonEligibleExecution = (execution) =>
  String(execution?.state || "").trim().toUpperCase() === "COMPLETED" &&
  execution?.resultAvailable === true &&
  Boolean(cleanCodename(execution?.codename));

export const comparisonIneligibilityReason = (
  execution,
  t
) => {
  const state = String(execution?.state || "").trim().toUpperCase();

  if (state !== "COMPLETED") {
    if (state === "FAILED") {
      return resolveText(
        t,
        "comparisonModel.ineligibility.failed",
        "La ejecución finalizó con error."
      );
    }
    if (["QUEUED", "RUNNING", "PROCESSING"].includes(state)) {
      return resolveText(
        t,
        "comparisonModel.ineligibility.active",
        "La ejecución todavía está en progreso."
      );
    }
    return resolveText(
      t,
      "comparisonModel.ineligibility.notCompleted",
      "La ejecución todavía no está completada."
    );
  }

  if (execution?.resultAvailable !== true) {
    return resolveText(
      t,
      "comparisonModel.ineligibility.noResults",
      "La ejecución no tiene resultados disponibles."
    );
  }

  if (!cleanCodename(execution?.codename)) {
    return resolveText(
      t,
      "comparisonModel.ineligibility.invalidId",
      "La ejecución no tiene un identificador válido."
    );
  }

  return "";
};

export const getEligibleExecutions = (executions) =>
  (Array.isArray(executions) ? executions : []).filter(
    isComparisonEligibleExecution
  );

export const initialComparisonSelection = (executions) => {
  const eligible = getEligibleExecutions(executions);

  if (
    eligible.length < MIN_COMPARISON_EXECUTIONS ||
    eligible.length > MAX_COMPARISON_EXECUTIONS
  ) {
    return [];
  }

  return eligible.map((execution) => cleanCodename(execution.codename));
};

export const toggleComparisonSelection = (selected, codename) => {
  const current = Array.isArray(selected) ? selected : [];
  const normalized = cleanCodename(codename);

  if (!normalized) return current;
  if (current.includes(normalized)) {
    return current.filter((value) => value !== normalized);
  }
  if (current.length >= MAX_COMPARISON_EXECUTIONS) return current;

  return [...current, normalized];
};

export const orderSelectedExecutions = (orderedExecutions, selected) => {
  const selectedSet = new Set(Array.isArray(selected) ? selected : []);

  return (Array.isArray(orderedExecutions) ? orderedExecutions : [])
    .map((execution) => cleanCodename(execution?.codename))
    .filter((codename) => codename && selectedSet.has(codename));
};

export const humanMetricLabel = (
  metric,
  t
) => {
  if (METRIC_LABELS[metric]) {
    return resolveText(
      t,
      `comparisonModel.metrics.${metric}.label`,
      METRIC_LABELS[metric]
    );
  }

  const text = String(metric || "").trim();
  if (!text) {
    return resolveText(
      t,
      "comparisonModel.genericMetric",
      "Métrica"
    );
  }

  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const compatibilityIssueCodes = (compatibility) =>
  new Set(
    [
      ...(Array.isArray(compatibility?.blockers)
        ? compatibility.blockers
        : []),
      ...(Array.isArray(compatibility?.warnings)
        ? compatibility.warnings
        : []),
    ]
      .map((issue) => String(issue?.code || "").trim().toUpperCase())
      .filter(Boolean)
  );

const metricHasVisibleDispersion = (metricData, aggregation) =>
  (Array.isArray(metricData?.series) ? metricData.series : []).some((series) =>
    (Array.isArray(series?.points) ? series.points : []).some((point) => {
      if (aggregation === "mean") {
        const stddev = finiteNumber(point?.stddev);
        return stddev !== null && stddev >= 0;
      }
      return (
        finiteNumber(point?.q1) !== null &&
        finiteNumber(point?.q3) !== null
      );
    })
  );

const metricInterpretation = (
  metric,
  t
) => {
  const fallback = METRIC_INTERPRETATIONS[metric];
  if (!fallback) return "";

  return resolveText(
    t,
    `comparisonModel.metrics.${metric}.interpretation`,
    fallback
  );
};

export const buildComparisonInterpretation = ({
  compatibility,
  selectedMetric,
  metricData,
  aggregation = "median",
  showDispersion = true,
  t = null,
}) => {
  const contract =
    compatibility && typeof compatibility === "object"
      ? compatibility
      : {};
  const status = String(contract.status || "").trim().toUpperCase();

  if (status === "INCOMPATIBLE") {
    return [
      resolveText(
        t,
        "comparisonModel.interpretations.incompatible",
        INCOMPATIBLE_INTERPRETATION
      ),
    ];
  }

  const messages = [];
  const addMessage = (message) => {
    if (message && !messages.includes(message)) messages.push(message);
  };
  const metric = String(selectedMetric || "").trim();
  const issueCodes = compatibilityIssueCodes(contract);
  const inputStatus = String(
    contract.dimensions?.inputSizes?.status || ""
  )
    .trim()
    .toUpperCase();
  const commonInputSizes = Array.isArray(contract.commonInputSizes)
    ? contract.commonInputSizes
    : [];
  const energyExcluded = (Array.isArray(contract.excludedMetrics)
    ? contract.excludedMetrics
    : []
  ).some((item) => String(item?.metric || "").trim() === "EnergyPkg");

  addMessage(metricInterpretation(metric, t));
  if (energyExcluded) {
    addMessage(metricInterpretation("EnergyPkg", t));
  }
  if (status === "LIMITED") {
    addMessage(
      resolveText(
        t,
        "comparisonModel.interpretations.limited",
        LIMITED_INTERPRETATION
      )
    );
  }

  if (
    inputStatus === "PARTIAL" ||
    issueCodes.has("PARTIAL_INPUT_OVERLAP")
  ) {
    addMessage(
      resolveText(
        t,
        "comparisonModel.interpretations.partialOverlap",
        PARTIAL_OVERLAP_INTERPRETATION
      )
    );
  }

  if (
    commonInputSizes.length === 1 ||
    issueCodes.has("SINGLE_COMMON_INPUT_SIZE")
  ) {
    addMessage(
      resolveText(
        t,
        "comparisonModel.interpretations.singleInput",
        SINGLE_INPUT_INTERPRETATION
      )
    );
  }

  if (
    showDispersion &&
    metricHasVisibleDispersion(metricData, aggregation)
  ) {
    addMessage(
      resolveText(
        t,
        "comparisonModel.interpretations.dispersion",
        DISPERSION_INTERPRETATION
      )
    );
  }

  return messages;
};

export const orderCommonMetrics = (commonMetrics, metrics) => {
  const metricMap = metrics && typeof metrics === "object" ? metrics : {};
  const seen = new Set();
  const available = (Array.isArray(commonMetrics) ? commonMetrics : [])
    .filter((metric) => {
      if (typeof metric !== "string" || !metricMap[metric] || seen.has(metric)) {
        return false;
      }
      seen.add(metric);
      return true;
    });
  const targetRank = new Map(
    TARGET_METRICS.map((metric, index) => [metric, index])
  );

  return available.sort((left, right) => {
    const leftTarget = targetRank.has(left);
    const rightTarget = targetRank.has(right);

    if (leftTarget && rightTarget) {
      return targetRank.get(left) - targetRank.get(right);
    }
    if (leftTarget) return -1;
    if (rightTarget) return 1;
    return left.localeCompare(right, "es", { sensitivity: "base" });
  });
};

export const defaultComparisonMetric = (commonMetrics, metrics) => {
  const ordered = orderCommonMetrics(commonMetrics, metrics);
  return ordered.includes("DurationTime") ? "DurationTime" : ordered[0] || "";
};

export const buildUniqueSeriesLabels = (
  series,
  t
) => {
  const baseLabels = (Array.isArray(series) ? series : []).map(
    (item, index) =>
      String(item?.sourceFilename || "").trim() ||
      resolveText(
        t,
        "comparisonModel.seriesFallback",
        `Implementación ${index + 1}`,
        { index: index + 1 }
      )
  );
  const totals = baseLabels.reduce((counts, label) => {
    counts.set(label, (counts.get(label) || 0) + 1);
    return counts;
  }, new Map());
  const occurrences = new Map();

  return baseLabels.map((label) => {
    if (totals.get(label) === 1) return label;
    const occurrence = (occurrences.get(label) || 0) + 1;
    occurrences.set(label, occurrence);
    return `${label} · ${occurrence}`;
  });
};

export const normalizeInputRange = (inputSizes, minimum, maximum) => {
  const domain = uniqueNumericDomain(inputSizes);
  if (!domain.length) return { domain, minimum: null, maximum: null };

  const requestedMinimum = finiteNumber(minimum);
  const requestedMaximum = finiteNumber(maximum);
  let normalizedMinimum = domain.includes(requestedMinimum)
    ? requestedMinimum
    : domain[0];
  let normalizedMaximum = domain.includes(requestedMaximum)
    ? requestedMaximum
    : domain[domain.length - 1];

  if (normalizedMinimum > normalizedMaximum) {
    normalizedMaximum = normalizedMinimum;
  }

  return {
    domain,
    minimum: normalizedMinimum,
    maximum: normalizedMaximum,
  };
};

export const filterPointsByInputRange = (points, minimum, maximum) =>
  (Array.isArray(points) ? points : []).filter((point) => {
    const inputSize = finiteNumber(point?.inputSize);
    return (
      inputSize !== null &&
      (minimum === null || inputSize >= minimum) &&
      (maximum === null || inputSize <= maximum)
    );
  });

const pointCustomData = (label, point) => [
  label,
  finiteNumber(point?.median),
  finiteNumber(point?.mean),
  finiteNumber(point?.q1),
  finiteNumber(point?.q3),
  finiteNumber(point?.stddev),
  Number.isInteger(point?.samplesValid) ? point.samplesValid : null,
  Number.isInteger(point?.samplesTotal) ? point.samplesTotal : null,
  Number.isInteger(point?.iqrOutliersDetected)
    ? point.iqrOutliersDetected
    : null,
];

const medianDispersion = (point, median) => {
  const q1 = finiteNumber(point?.q1);
  const q3 = finiteNumber(point?.q3);
  if (q1 === null || q3 === null) return null;

  const upper = q3 - median;
  const lower = median - q1;
  return upper >= 0 && lower >= 0 ? { upper, lower } : null;
};

const meanDispersion = (point) => {
  const stddev = finiteNumber(point?.stddev);
  return stddev !== null && stddev >= 0 ? stddev : null;
};

export const buildComparisonTraces = ({
  metricData,
  aggregation = "median",
  showDispersion = true,
  minimum = null,
  maximum = null,
  t = null,
}) => {
  const series = Array.isArray(metricData?.series) ? metricData.series : [];
  const labels = buildUniqueSeriesLabels(series, t);
  const unit = String(metricData?.unit || "").trim();
  const centralKey = aggregation === "mean" ? "mean" : "median";
  const centralLabel =
    centralKey === "mean"
      ? resolveText(
          t,
          "comparisonModel.aggregation.mean",
          "Media"
        )
      : resolveText(
          t,
          "comparisonModel.aggregation.median",
          "Mediana"
        );

  const medianLabel = resolveText(
    t,
    "comparisonModel.aggregation.median",
    "Mediana"
  );
  const meanLabel = resolveText(
    t,
    "comparisonModel.aggregation.mean",
    "Media"
  );
  const inputSizeLabel = resolveText(
    t,
    "comparisonModel.hover.inputSize",
    "InputSize"
  );
  const stddevLabel = resolveText(
    t,
    "comparisonModel.hover.stddev",
    "Desv. estándar"
  );
  const validSamplesLabel = resolveText(
    t,
    "comparisonModel.hover.validSamples",
    "Muestras válidas"
  );
  const iqrOutliersLabel = resolveText(
    t,
    "comparisonModel.hover.iqrOutliers",
    "Outliers IQR"
  );

  return series.map((item, seriesIndex) => {
    const filtered = filterPointsByInputRange(item?.points, minimum, maximum);
    const retained = filtered
      .map((point) => ({
        point,
        central: finiteNumber(point?.[centralKey]),
      }))
      .filter(({ central }) => central !== null);
    const upperErrors = [];
    const lowerErrors = [];
    let hasDispersion = false;

    retained.forEach(({ point, central }) => {
      if (centralKey === "median") {
        const dispersion = medianDispersion(point, central);
        upperErrors.push(dispersion?.upper ?? 0);
        lowerErrors.push(dispersion?.lower ?? 0);
        hasDispersion = hasDispersion || Boolean(dispersion);
      } else {
        const dispersion = meanDispersion(point);
        upperErrors.push(dispersion ?? 0);
        hasDispersion = hasDispersion || dispersion !== null;
      }
    });

    const trace = {
      type: "scatter",
      mode: "lines+markers",
      name: labels[seriesIndex],
      x: retained.map(({ point }) => point.inputSize),
      y: retained.map(({ central }) => central),
      customdata: retained.map(({ point }) =>
        pointCustomData(labels[seriesIndex], point)
      ),
      connectgaps: false,
      marker: {
        symbol: MARKER_SYMBOLS[seriesIndex % MARKER_SYMBOLS.length],
        size: 8,
      },
      line: {
        dash: LINE_DASHES[seriesIndex % LINE_DASHES.length],
        width: 2.5,
      },
      hovertemplate:
        "<b>%{customdata[0]}</b><br>" +
        `${inputSizeLabel}: %{x}<br>` +
        `${centralLabel}: %{y}${unit ? ` ${unit}` : ""}<br>` +
        `${medianLabel}: %{customdata[1]}<br>` +
        `${meanLabel}: %{customdata[2]}<br>` +
        "Q1–Q3: %{customdata[3]} – %{customdata[4]}<br>" +
        `${stddevLabel}: %{customdata[5]}<br>` +
        `${validSamplesLabel}: %{customdata[6]}/%{customdata[7]}<br>` +
        `${iqrOutliersLabel}: %{customdata[8]}<extra></extra>`,
    };

    if (showDispersion && hasDispersion) {
      trace.error_y = {
        type: "data",
        visible: true,
        array: upperErrors,
        ...(centralKey === "median"
          ? { symmetric: false, arrayminus: lowerErrors }
          : { symmetric: true }),
      };
    }

    return trace;
  });
};

export const comparisonDimensionPresentation = (
  status,
  t
) => {
  const normalized = String(status || "").trim().toUpperCase();

  if (["MATCH", "VERIFIED", "AVAILABLE", "COMPATIBLE"].includes(normalized)) {
    return {
      label: resolveText(
        t,
        "comparisonModel.dimensionStatuses.compatible",
        "Compatible"
      ),
      tone: "success",
    };
  }
  if (["PARTIAL", "LIMITED"].includes(normalized)) {
    return {
      label: resolveText(
        t,
        "comparisonModel.dimensionStatuses.limited",
        "Con limitación"
      ),
      tone: "warning",
    };
  }
  if (["MISMATCH", "NO_OVERLAP", "AMBIGUOUS", "INCOMPATIBLE"].includes(normalized)) {
    return {
      label: resolveText(
        t,
        "comparisonModel.dimensionStatuses.incompatible",
        "Incompatible"
      ),
      tone: "danger",
    };
  }
  if (normalized === "UNAVAILABLE") {
    return {
      label: resolveText(
        t,
        "comparisonModel.dimensionStatuses.unavailable",
        "No disponible"
      ),
      tone: "neutral",
    };
  }
  return {
    label: resolveText(
      t,
      "comparisonModel.dimensionStatuses.unverifiable",
      "No verificable"
    ),
    tone: "neutral",
  };
};
