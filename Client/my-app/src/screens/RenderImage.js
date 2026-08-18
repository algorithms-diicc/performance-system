import AcademicBreadcrumbs from "../components/AcademicBreadcrumbs";
import InlineState from "../components/InlineState";
import ReproducibilityPanel from "../components/ReproducibilityPanel";
import downloadAuthenticatedFile from "../utils/downloadAuthenticatedFile";
// src/screens/RenderImage.js
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useLocation,
  useParams,
} from "react-router-dom";
import axios from "axios";
import Plot from "react-plotly.js";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Download,
  Filter,
  Gauge,
  GitBranch,
  Info,
  Layers3,
  MemoryStick,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Timer,
} from "lucide-react";

import {
  serverURL,
  METRIC_DESCRIPTIONS,
} from "../common/Constants";
import {
  isAdminUser,
  isTeacherUser,
} from "../common/userAccessModel";
import {
  formatAcademicPeriod,
  formatCourseLabel,
} from "./submissionOverviewModel";

import "./RenderImage.css";


/* ============================================================
   DASHBOARD CONFIGURATION

   UI-03A deliberately keeps the current HTML/iframe plots.
   UI-03B will replace this data contract with structured JSON
   and Plotly rendered directly in React.
   ============================================================ */

const PRIMARY_METRICS = [
  "DurationTime",
  "Instructions",
  "IPC",
  "CacheMissRate",
  "BranchMissRate",
  "L1DcacheLoadMisses",
];


const KPI_DEFINITIONS = [
  {
    metric: "DurationTime",
    label: "Tiempo",
    description: "Tiempo de ejecución",
    icon: Timer,
  },
  {
    metric: "IPC",
    label: "IPC",
    description: "Instrucciones por ciclo",
    icon: Gauge,
  },
  {
    metric: "CacheMissRate",
    label: "Cache miss",
    description: "Tasa de fallos de caché",
    icon: MemoryStick,
  },
  {
    metric: "BranchMissRate",
    label: "Branch miss",
    description: "Fallos de predicción",
    icon: GitBranch,
  },
  {
    metric: "Instructions",
    label: "Instrucciones",
    description: "Trabajo ejecutado por CPU",
    icon: BarChart3,
  },
];

const DASHBOARD_CATEGORIES = [
  {
    id: "summary",
    label: "Resumen",
    metrics: PRIMARY_METRICS,
  },
  {
    id: "performance",
    label: "Rendimiento",
    metrics: [
      "DurationTime",
      "TaskClock",
      "CpuClock",
      "Instructions",
      "IPC",
      "BranchMissRate",
      "CacheMissRate",
    ],
  },
  {
    id: "cache",
    label: "Caché",
    metrics: [
      "CacheMissRate",
      "CacheMissesPerMI",
      "CacheMisses",
      "L1DcacheLoads",
      "L1DcacheLoadMisses",
      "L1DcacheStores",
      "LLCLoads",
      "LLCLoadMisses",
      "LLCStores",
      "LLCStoreMisses",
    ],
  },
  {
    id: "cpu",
    label: "CPU",
    metrics: [
      "Instructions",
      "IPC",
      "BranchMissRate",
      "BranchMissesPerMI",
      "BranchMisses",
      "TaskClock",
      "CpuClock",
    ],
  },
  {
    id: "system",
    label: "Sistema",
    metrics: [
      "PageFaults",
      "MajorFaults",
    ],
  },
  {
    id: "energy",
    label: "Energía",
    metrics: [
      "EnergyPkg",
      "EnergyCores",
      "EnergyRAM",
    ],
  },
];

const METRIC_PRESENTATION = {
  DurationTime: {
    label: "Tiempo de ejecución",
    eyebrow: "Escalamiento",
    axisTitle: "Tiempo de ejecución (ms)",
    displayKind: "milliseconds",
  },
  TaskClock: {
    label: "Tiempo activo de tarea",
    eyebrow: "CPU",
    axisTitle: "Tiempo activo (ms)",
    displayKind: "milliseconds",
  },
  CpuClock: {
    label: "Tiempo de CPU",
    eyebrow: "CPU",
    axisTitle: "Tiempo de CPU (ms)",
    displayKind: "milliseconds",
  },
  Instructions: {
    label: "Instrucciones ejecutadas",
    eyebrow: "Trabajo de CPU",
    axisTitle: "Instrucciones",
    displayKind: "count",
  },
  CpuCycles: {
    label: "Ciclos de CPU",
    eyebrow: "CPU",
    axisTitle: "Ciclos",
    displayKind: "count",
  },
  IPC: {
    label: "Instrucciones por ciclo (IPC)",
    eyebrow: "Eficiencia de CPU",
    axisTitle: "IPC",
    displayKind: "ratio",
  },
  Branches: {
    label: "Saltos ejecutados",
    eyebrow: "Flujo de control",
    axisTitle: "Saltos",
    displayKind: "count",
  },
  BranchMisses: {
    label: "Fallos de predicción de salto",
    eyebrow: "Flujo de control",
    axisTitle: "Fallos de predicción",
    displayKind: "count",
  },
  BranchMissRate: {
    label: "Tasa de fallos de predicción",
    eyebrow: "Flujo de control",
    axisTitle: "Tasa de fallos (%)",
    displayKind: "percentage",
  },
  BranchMissesPerMI: {
    label: "Fallos de salto por millón de instrucciones",
    eyebrow: "Flujo de control",
    axisTitle: "Fallos / millón de instrucciones",
    displayKind: "perMillion",
  },
  CacheReferences: {
    label: "Referencias de caché",
    eyebrow: "Memoria",
    axisTitle: "Referencias de caché",
    displayKind: "count",
  },
  CacheMisses: {
    label: "Fallos de caché",
    eyebrow: "Memoria",
    axisTitle: "Fallos de caché",
    displayKind: "count",
  },
  CacheMissRate: {
    label: "Tasa de fallos de caché",
    eyebrow: "Memoria",
    axisTitle: "Tasa de fallos (%)",
    displayKind: "percentage",
  },
  CacheMissesPerMI: {
    label: "Fallos de caché por millón de instrucciones",
    eyebrow: "Memoria",
    axisTitle: "Fallos / millón de instrucciones",
    displayKind: "perMillion",
  },
  L1DcacheLoads: {
    label: "Lecturas de caché L1",
    eyebrow: "Memoria",
    axisTitle: "Lecturas L1",
    displayKind: "count",
  },
  L1DcacheLoadMisses: {
    label: "Fallos de lectura en caché L1",
    eyebrow: "Memoria",
    axisTitle: "Fallos de lectura L1",
    displayKind: "count",
  },
  L1DcacheStores: {
    label: "Escrituras de caché L1",
    eyebrow: "Memoria",
    axisTitle: "Escrituras L1",
    displayKind: "count",
  },
  LLCLoads: {
    label: "Lecturas de último nivel de caché",
    eyebrow: "Memoria",
    axisTitle: "Lecturas LLC",
    displayKind: "count",
  },
  LLCLoadMisses: {
    label: "Fallos de lectura en último nivel de caché",
    eyebrow: "Memoria",
    axisTitle: "Fallos de lectura LLC",
    displayKind: "count",
  },
  LLCStores: {
    label: "Escrituras de último nivel de caché",
    eyebrow: "Memoria",
    axisTitle: "Escrituras LLC",
    displayKind: "count",
  },
  LLCStoreMisses: {
    label: "Fallos de escritura en último nivel de caché",
    eyebrow: "Memoria",
    axisTitle: "Fallos de escritura LLC",
    displayKind: "count",
  },
  PageFaults: {
    label: "Fallos de página",
    eyebrow: "Sistema",
    axisTitle: "Fallos de página",
    displayKind: "count",
  },
  MajorFaults: {
    label: "Fallos de página mayores",
    eyebrow: "Sistema",
    axisTitle: "Fallos mayores",
    displayKind: "count",
  },
  EnergyPkg: {
    label: "Energía del paquete CPU",
    eyebrow: "Energía",
    axisTitle: "Energía (J)",
    displayKind: "energy",
  },
  EnergyCores: {
    label: "Energía de núcleos",
    eyebrow: "Energía",
    axisTitle: "Energía (J)",
    displayKind: "energy",
  },
  EnergyRAM: {
    label: "Energía de RAM",
    eyebrow: "Energía",
    axisTitle: "Energía (J)",
    displayKind: "energy",
  },
};


const normalizeSubmissionId = (value) => {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0
    ? numeric
    : null;
};

const normalizeNavigationFilename = (value) => {
  const normalized = String(value || "")
    .trim()
    .replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() || null;
};

function RenderImage({ currentUser }) {
  const location = useLocation();
  const { codename } = useParams();

  const [plotFiles, setPlotFiles] = useState([]);
  const [statusData, setStatusData] = useState({});
  const [resultsData, setResultsData] = useState(null);
  const [reproducibilityNavigationContext, setReproducibilityNavigationContext] =
    useState({
      submissionId: null,
      sourceFilename: null,
    });
  const [submissionNavigationContext, setSubmissionNavigationContext] =
    useState(null);
  const [activeCategory, setActiveCategory] =
    useState("summary");
  const [showAdvanced, setShowAdvanced] =
    useState(false);
  const [filtersOpen, setFiltersOpen] =
    useState(false);
  const [aggregation, setAggregation] =
    useState("median");
  const [showDispersion, setShowDispersion] =
    useState(true);
  const [xScale, setXScale] =
    useState("linear");
  const [rangeMin, setRangeMin] =
    useState("");
  const [rangeMax, setRangeMax] =
    useState("");
  const [expandedMetric, setExpandedMetric] =
    useState("");
  const [isLoading, setIsLoading] =
    useState(true);
  const [loadError, setLoadError] =
    useState("");
  const [loadErrorType, setLoadErrorType] =
    useState("error");
  const [aiExplanation, setAiExplanation] =
    useState(null);
  const [aiLoading, setAiLoading] =
    useState(false);
  const [aiError, setAiError] =
    useState("");
  const [downloadLoading, setDownloadLoading] =
    useState(false);
  const [downloadFeedback, setDownloadFeedback] =
    useState({
      kind: "",
      message: "",
    });

  const isAdmin = isAdminUser(currentUser);
  const isTeacher = isTeacherUser(currentUser);
  const roleRootPath = isAdmin
    ? "/admin/users"
    : isTeacher
    ? "/teacher/courses"
    : "/profile";
  const resultsSubmissionId = normalizeSubmissionId(
    resultsData?.execution?.submission_id
  );
  const effectiveSubmissionId =
    resultsSubmissionId ||
    normalizeSubmissionId(
      reproducibilityNavigationContext.submissionId
    );
  const deterministicBackPath = effectiveSubmissionId
    ? `/submissions/${encodeURIComponent(
        String(effectiveSubmissionId)
      )}`
    : roleRootPath;

  const handleReproducibilityContextChange = useCallback((context) => {
    const nextContext = {
      submissionId: normalizeSubmissionId(context?.submissionId),
      sourceFilename: normalizeNavigationFilename(
        context?.sourceFilename
      ),
    };

    setReproducibilityNavigationContext((current) => {
      if (
        current.submissionId === nextContext.submissionId &&
        current.sourceFilename === nextContext.sourceFilename
      ) {
        return current;
      }
      return nextContext;
    });
  }, []);

  const plotTheme = usePlotTheme();

  const filesBaseURL =
    `${serverURL}files/${codename}/`;

  useEffect(() => {
    let mounted = true;

    setAiExplanation(null);
    setAiError("");

    const loadResults = async () => {
      setIsLoading(true);
      setLoadError("");
      setLoadErrorType("error");
      setReproducibilityNavigationContext({
        submissionId: null,
        sourceFilename: null,
      });
      setSubmissionNavigationContext(null);

      try {
        /*
         * La API estructurada es la fuente canónica y obligatoria.
         * /files y /status quedan como fuentes auxiliares legacy.
         */
        const resultsResponse =
          await axios.get(
            `${serverURL}api/executions/${codename}/results`,
            {
              withCredentials: true,
            }
          );

        const [
          plotsResult,
          statusResult,
        ] = await Promise.allSettled([
          axios.get(
            `${serverURL}files/${codename}`,
            { withCredentials: true }
          ),
          axios.get(
            `${serverURL}status/${codename}_status.json`,
            { withCredentials: true }
          ),
        ]);

        if (!mounted) return;

        const plotsData =
          plotsResult.status === "fulfilled"
            ? plotsResult.value.data
            : "";

        const statusPayload =
          statusResult.status === "fulfilled"
            ? statusResult.value.data
            : {};

        if (plotsResult.status === "rejected") {
          console.warn(
            "Artefactos legacy de gráficos no disponibles:",
            plotsResult.reason
          );
        }

        if (statusResult.status === "rejected") {
          console.warn(
            "Status legacy no disponible; se continuará con la API canónica:",
            statusResult.reason
          );
        }

        const htmlFiles = String(
          plotsData || ""
        )
          .split("\n")
          .map((filename) => filename.trim())
          .filter((filename) =>
            filename.endsWith(".html")
          );

        setPlotFiles(htmlFiles);
        setStatusData(
          statusPayload || {}
        );
        setResultsData(
          resultsResponse.data || null
        );
      } catch (error) {
        console.error(
          "No se pudieron cargar los resultados:",
          error
        );

        if (mounted) {
          const status =
            error?.response?.status;

          if (!error?.response) {
            setLoadErrorType("network");
            setLoadError(
              "No pudimos comunicarnos con el servidor. Verifica que el backend esté disponible e inténtalo nuevamente."
            );
          } else if (status === 403) {
            setLoadErrorType("forbidden");
            setLoadError(
              "Esta ejecución existe, pero tu cuenta no tiene permisos para consultar sus resultados."
            );
          } else if (status === 404) {
            setLoadErrorType("not-found");
            setLoadError(
              "La ejecución o alguno de sus artefactos de resultados ya no está disponible."
            );
          } else if (
            status === 409 ||
            status === 425
          ) {
            setLoadErrorType("unavailable");
            setLoadError(
              "La ejecución todavía no tiene resultados listos para visualizar."
            );
          } else if (status === 401) {
            setLoadErrorType("forbidden");
            setLoadError(
              "Tu sesión ya no permite consultar esta ejecución. Vuelve a iniciar sesión."
            );
          } else {
            setLoadErrorType("error");
            setLoadError(
              "No fue posible cargar los resultados de esta ejecución."
            );
          }
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadResults();

    return () => {
      mounted = false;
    };
  }, [codename]);

  useEffect(() => {
    let active = true;

    setSubmissionNavigationContext(null);

    if (!effectiveSubmissionId) {
      return () => {
        active = false;
      };
    }

    axios
      .get(
        `${serverURL}api/submissions/${encodeURIComponent(
          String(effectiveSubmissionId)
        )}`,
        { withCredentials: true }
      )
      .then((response) => {
        if (!active) return;

        const detail = response.data?.submission || null;
        if (!detail) return;

        setSubmissionNavigationContext({
          course: detail.course || null,
          courseId: normalizeSubmissionId(
            detail.courseId ?? detail.course?.id
          ),
        });
      })
      .catch(() => {
        if (active) setSubmissionNavigationContext(null);
      });

    return () => {
      active = false;
    };
  }, [effectiveSubmissionId]);

  const metricFiles = useMemo(() => {
    return plotFiles.map((file) => ({
      file,
      metric: file
        .replace(".html", "")
        .trim(),
    }));
  }, [plotFiles]);

  const availableMetrics = useMemo(() => {
    const names = new Set(
      metricFiles.map(
        (item) => item.metric
      )
    );

    Object.keys(
      resultsData?.metrics || {}
    ).forEach((metric) => {
      names.add(metric);
    });

    return names;
  }, [metricFiles, resultsData]);

  const displayName = useMemo(() => {
    const navigationName =
      location.state?.name?.trim();

    if (navigationName) {
      return navigationName;
    }

    const originalFile =
      statusData?.files?.[0]
        ?.original_filename;

    if (originalFile) {
      return stripExtension(originalFile);
    }

    return `Ejecución ${codename}`;
  }, [
    location.state,
    statusData,
    codename,
  ]);

  useEffect(() => {
    document.title =
      `${displayName} · Performance System`;
  }, [displayName]);

  const visibleMetrics = useMemo(() => {
    const category =
      DASHBOARD_CATEGORIES.find(
        (item) =>
          item.id === activeCategory
      ) ||
      DASHBOARD_CATEGORIES[0];

    let requestedMetrics =
      category.metrics;

    if (
      activeCategory !== "summary" &&
      showAdvanced
    ) {
      const advancedInCategory =
        Array.from(availableMetrics)
          .filter((metric) =>
            belongsToCategory(
              metric,
              activeCategory
            )
          );

      requestedMetrics =
        requestedMetrics.concat(
          advancedInCategory
        );
    }

    if (
      activeCategory === "summary" &&
      showAdvanced
    ) {
      requestedMetrics =
        PRIMARY_METRICS.concat(
          Array.from(availableMetrics)
        );
    }

    return unique(requestedMetrics)
      .filter((metric) =>
        availableMetrics.has(metric)
      )
      .map((metric) => {
        const legacyFile =
          metricFiles.find(
            (item) =>
              item.metric === metric
          );

        return {
          metric,
          file: legacyFile?.file || "",
          metricData:
            resultsData?.metrics?.[metric] ||
            null,
        };
      });
  }, [
    activeCategory,
    showAdvanced,
    metricFiles,
    availableMetrics,
    resultsData,
  ]);

  const missingPrimaryCount =
    PRIMARY_METRICS.filter(
      (metric) =>
        !availableMetrics.has(metric)
    ).length;

  const inputSizes = useMemo(
    () =>
      collectInputSizes(
        resultsData
      ),
    [resultsData]
  );

  const effectiveRange = useMemo(
    () =>
      buildEffectiveRange(
        inputSizes,
        rangeMin,
        rangeMax
      ),
    [
      inputSizes,
      rangeMin,
      rangeMax,
    ]
  );

  const effectiveDispersion =
    aggregation === "mean" &&
    showDispersion;

  const canUseLogScale =
    inputSizes.length > 0 &&
    inputSizes.every(
      (value) => value > 0
    );

  const activeFilterCount =
    countActiveFilters({
      aggregation,
      showDispersion,
      xScale,
      rangeMin,
      rangeMax,
    });

  const kpiItems = useMemo(
    () =>
      buildKpiItems(
        resultsData,
        aggregation,
        effectiveDispersion,
        effectiveRange
      ),
    [
      resultsData,
      aggregation,
      effectiveDispersion,
      effectiveRange,
    ]
  );

  const pedagogyData =
    resultsData?.pedagogy || null;

  const handleResetFilters = () => {
    setAggregation("median");
    setShowDispersion(true);
    setXScale("linear");
    setRangeMin("");
    setRangeMax("");
  };

  const handleRangeMinChange = (
    value
  ) => {
    setRangeMin(value);

    if (
      value &&
      rangeMax &&
      Number(value) >
        Number(rangeMax)
    ) {
      setRangeMax(value);
    }
  };

  const handleRangeMaxChange = (
    value
  ) => {
    setRangeMax(value);

    if (
      value &&
      rangeMin &&
      Number(value) <
        Number(rangeMin)
    ) {
      setRangeMin(value);
    }
  };

  const handleGenerateAI = async () => {
    setAiLoading(true);
    setAiError("");

    try {
      const response = await axios.post(
        `${serverURL}api/executions/${codename}/ai-explanation`,
        {
          force: false,
        },
        {
          withCredentials: true,
        }
      );

      setAiExplanation(
        response.data || null
      );
    } catch (error) {
      console.error(
        "No se pudo generar la explicación con IA:",
        error
      );

      const code =
        error?.response?.data?.error?.code;

      if (code === "AI_NOT_CONFIGURED") {
        setAiError(
          "La IA aún no está configurada en el servidor. La interpretación basada en reglas sigue disponible."
        );
      } else if (
        code === "AI_OUTPUT_REJECTED"
      ) {
        setAiError(
          "La respuesta de IA fue descartada porque no superó las validaciones de consistencia."
        );
      } else {
        setAiError(
          "No fue posible generar la explicación con IA en este momento."
        );
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleDownload = async () => {
    if (downloadLoading) return;

    setDownloadLoading(true);
    setDownloadFeedback({
      kind: "",
      message: "",
    });

    try {
      await downloadAuthenticatedFile(
        `${serverURL}api/executions/${encodeURIComponent(
          codename
        )}/measurements/download`,
        `performance-system-${codename}.csv`
      );

      setDownloadFeedback({
        kind: "success",
        message:
          "CSV descargado correctamente.",
      });
    } catch (error) {
      console.error(
        "No se pudo descargar el CSV:",
        error
      );

      const status =
        error?.response?.status;

      let message =
        "No fue posible descargar el CSV en este momento.";

      if (!error?.response) {
        message =
          "No pudimos conectar con el servidor para descargar el CSV.";
      } else if (status === 403) {
        message =
          "Tu cuenta no tiene permisos para descargar este CSV.";
      } else if (status === 404) {
        message =
          "El CSV de esta ejecución ya no está disponible.";
      }

      setDownloadFeedback({
        kind: "error",
        message,
      });
    } finally {
      setDownloadLoading(false);
    }
  };

  if (isLoading) {
    return (
      <main className="results-page">
        <div className="results-shell">
          <InlineState
            type="loading"
            title="Cargando resultados"
            description="Preparando el dashboard de la ejecución."
          />
        </div>
      </main>
    );
  }

  if (loadError) {
    const stateTitle = {
      network: "No pudimos conectar con el servidor",
      forbidden: "No puedes abrir esta ejecución",
      "not-found": "Ejecución no encontrada",
      unavailable: "Resultado todavía no disponible",
      error: "No pudimos abrir esta ejecución",
    }[loadErrorType];

    return (
      <main className="results-page">
        <div className="results-shell">
          <AcademicBreadcrumbs
            currentUser={currentUser}
            page="result"
          />

          <InlineState
            type={loadErrorType}
            title={stateTitle}
            description={loadError}
            actionLabel="Reintentar"
            onAction={() => window.location.reload()}
          />

          <Link
            to={roleRootPath}
            className="results-secondary-button"
          >
            <ArrowLeft size={16} />
            Volver
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="results-page">
      <div className="results-shell">
        <AcademicBreadcrumbs
          currentUser={currentUser}
          page="result"
          submissionId={effectiveSubmissionId}
          sourceFilename={
            reproducibilityNavigationContext.sourceFilename
          }
          course={submissionNavigationContext?.course}
          courseId={submissionNavigationContext?.courseId}
        />

        <header className="results-header">
          <div className="results-header-top">
            <Link
              to={deterministicBackPath}
              className="results-back-button"
            >
              <ArrowLeft size={17} />
              Volver
            </Link>

            <div className="results-header-actions">
              {effectiveSubmissionId !== null && (
                <Link
                  to={`/submissions/${encodeURIComponent(
                    String(effectiveSubmissionId)
                  )}`}
                  className="results-secondary-button"
                >
                  <GitBranch size={14} />
                  Ver experimento
                </Link>
              )}

              <span className="results-status-chip">
                <CheckCircle2 size={14} />
                Análisis completado
              </span>

              <button
                type="button"
                className="results-download-button"
                onClick={handleDownload}
                disabled={downloadLoading}
              >
                <Download size={16} />
                {downloadLoading
                  ? "Descargando..."
                  : "Descargar CSV"}
              </button>
            </div>
          </div>

          {downloadFeedback.message && (
            <div
              className={
                `results-download-feedback results-download-feedback-${downloadFeedback.kind}`
              }
              role={
                downloadFeedback.kind === "error"
                  ? "alert"
                  : "status"
              }
            >
              {downloadFeedback.kind === "success"
                ? (
                  <CheckCircle2 size={15} />
                )
                : (
                  <Info size={15} />
                )}

              <span>
                {downloadFeedback.message}
              </span>
            </div>
          )}

          <div className="results-heading">
            <span className="results-eyebrow">
              Resultados de rendimiento
            </span>

            <h1>{displayName}</h1>

            <p>
              Explora cómo cambia el comportamiento
              del programa a medida que aumenta el
              tamaño de entrada.
            </p>
          </div>

          <ExecutionMetadata
            statusData={statusData}
            courseContext={submissionNavigationContext}
          />
        </header>

        <KpiOverview
          items={kpiItems}
          aggregation={aggregation}
          effectiveRange={effectiveRange}
        />

        <ReproducibilityPanel
          codename={codename}
          onContextChange={handleReproducibilityContextChange}
        />

        <PedagogicalOverview
          pedagogy={pedagogyData}
          aiExplanation={aiExplanation}
          aiLoading={aiLoading}
          aiError={aiError}
          onGenerateAI={handleGenerateAI}
        />

        <section className="results-dashboard-toolbar">
          <div
            className="results-tabs"
            role="tablist"
            aria-label="Categorías de métricas"
          >
            {DASHBOARD_CATEGORIES.map(
              (category) => {
                const count =
                  category.metrics.filter(
                    (metric) =>
                      availableMetrics.has(
                        metric
                      )
                  ).length;

                return (
                  <button
                    key={category.id}
                    type="button"
                    role="tab"
                    aria-selected={
                      activeCategory ===
                      category.id
                    }
                    className={`results-tab ${
                      activeCategory ===
                      category.id
                        ? "results-tab-active"
                        : ""
                    }`}
                    onClick={() =>
                      setActiveCategory(
                        category.id
                      )
                    }
                  >
                    {category.label}

                    {count > 0 && (
                      <span>{count}</span>
                    )}
                  </button>
                );
              }
            )}
          </div>

          <div className="results-toolbar-actions">
            <button
              type="button"
              className={`results-filter-button ${
                filtersOpen ||
                activeFilterCount > 0
                  ? "results-filter-button-active"
                  : ""
              }`}
              onClick={() =>
                setFiltersOpen(
                  !filtersOpen
                )
              }
              aria-expanded={filtersOpen}
            >
              <Filter size={15} />
              Filtros

              {activeFilterCount > 0 && (
                <span className="results-filter-count">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <label className="results-advanced-toggle">
              <input
                type="checkbox"
                checked={showAdvanced}
                onChange={(event) =>
                  setShowAdvanced(
                    event.target.checked
                  )
                }
              />

              <span className="results-toggle-track">
                <span className="results-toggle-thumb" />
              </span>

              <span>
                <SlidersHorizontal
                  size={15}
                />
                Métricas avanzadas
              </span>
            </label>
          </div>
        </section>

        {filtersOpen && (
          <ResultsFilters
            aggregation={aggregation}
            setAggregation={setAggregation}
            showDispersion={showDispersion}
            setShowDispersion={setShowDispersion}
            xScale={xScale}
            setXScale={setXScale}
            canUseLogScale={canUseLogScale}
            inputSizes={inputSizes}
            rangeMin={rangeMin}
            rangeMax={rangeMax}
            onRangeMinChange={
              handleRangeMinChange
            }
            onRangeMaxChange={
              handleRangeMaxChange
            }
            onReset={handleResetFilters}
            activeFilterCount={
              activeFilterCount
            }
          />
        )}

        {activeCategory === "summary" && (
          <section className="results-section-heading">
            <div>
              <span className="results-section-kicker">
                Vista principal
              </span>

              <h2>
                Métricas clave
              </h2>

              <p>
                Estas métricas ofrecen una primera
                lectura del tiempo, trabajo de CPU,
                memoria y flujo de control.
              </p>
            </div>

            {missingPrimaryCount > 0 && (
              <div className="results-availability-note">
                <Layers3 size={16} />

                <span>
                  {missingPrimaryCount}{" "}
                  {missingPrimaryCount === 1
                    ? "métrica principal no está disponible"
                    : "métricas principales no están disponibles"}{" "}
                  en esta ejecución.
                </span>
              </div>
            )}
          </section>
        )}

        {visibleMetrics.length > 0 ? (
          <section className="results-metric-grid">
            {visibleMetrics.map(
              ({
                metric,
                file,
                metricData,
              }) => (
                <MetricCard
                  key={metric}
                  metric={metric}
                  file={file}
                  metricData={metricData}
                  measurementContext={
                    resultsData?.execution
                      ?.measurement_context ||
                    null
                  }
                  pedagogyMetric={
                    pedagogyData?.metrics?.[
                      metric
                    ] || null
                  }
                  plotTheme={plotTheme}
                  aggregation={aggregation}
                  showDispersion={
                    effectiveDispersion
                  }
                  xScale={xScale}
                  inputRange={
                    effectiveRange
                  }
                  filesBaseURL={
                    filesBaseURL
                  }
                  expanded={
                    expandedMetric ===
                    metric
                  }
                  onToggleDescription={() =>
                    setExpandedMetric(
                      expandedMetric ===
                        metric
                        ? ""
                        : metric
                    )
                  }
                />
              )
            )}
          </section>
        ) : (
          <section className="results-empty-state">
            <BarChart3 size={24} />

            <div>
              <h2>
                No hay métricas disponibles
                en esta categoría
              </h2>

              <p>
                Esta ejecución no generó gráficos
                para las métricas seleccionadas.
              </p>
            </div>
          </section>
        )}

        <footer className="results-footer-note">
          <Info size={15} />

          <p>
            Las métricas disponibles se renderizan
            desde la API JSON. Cuando una medición no
            está disponible, el dashboard comunica su
            causa explícitamente en lugar de dibujar un
            gráfico vacío o asumir un valor cero.
          </p>
        </footer>
      </div>
    </main>
  );
}


function PedagogicalOverview({
  pedagogy,
  aiExplanation,
  aiLoading,
  aiError,
  onGenerateAI,
}) {
  const highlights =
    pedagogy?.summary?.highlights || [];

  if (highlights.length === 0) {
    return null;
  }

  const deterministic =
    pedagogy?.generation?.type ===
      "deterministic_rules" &&
    pedagogy?.generation?.uses_ai === false;

  return (
    <section
      className="results-pedagogy-overview"
      aria-labelledby="results-pedagogy-title"
    >
      <div className="results-pedagogy-heading">
        <div>
          <span className="results-section-kicker">
            Interpretación guiada
          </span>

          <h2 id="results-pedagogy-title">
            Qué muestran los resultados
          </h2>
        </div>

        {deterministic && (
          <span className="results-pedagogy-method">
            <CheckCircle2 size={14} />
            Basada en reglas reproducibles
          </span>
        )}
      </div>

      <div className="results-pedagogy-grid">
        {highlights
          .slice(0, 3)
          .map((message, index) => (
            <article
              key={`${message.metric}-${message.kind}-${index}`}
              className="results-pedagogy-highlight"
            >
              <div className="results-pedagogy-highlight-top">
                <span>
                  {getPedagogyMetricLabel(
                    message.metric
                  )}
                </span>

                <span className="results-pedagogy-kind">
                  {getPedagogyKindLabel(
                    message.kind
                  )}
                </span>
              </div>

              <p>
                {message.text}
              </p>
            </article>
          ))}
      </div>

      <div className="results-pedagogy-note">
        <Info size={14} />

        <span>
          Estas conclusiones describen únicamente
          las mediciones de esta ejecución. No
          califican por sí solas un algoritmo como
          bueno, malo, eficiente o ineficiente.
        </span>
      </div>

      <AIExplanationPanel
        explanation={aiExplanation}
        loading={aiLoading}
        error={aiError}
        onGenerate={onGenerateAI}
      />
    </section>
  );
}


function AIExplanationPanel({
  explanation,
  loading,
  error,
  onGenerate,
}) {
  const content =
    explanation?.content || null;

  return (
    <div className="results-ai-panel">
      <div className="results-ai-header">
        <div className="results-ai-title">
          <div className="results-ai-icon">
            <Sparkles size={17} />
          </div>

          <div>
            <span>
              Explicación complementaria
            </span>

            <strong>
              Asistente con IA
            </strong>
          </div>
        </div>

        <button
          type="button"
          className="results-ai-button"
          onClick={onGenerate}
          disabled={loading}
        >
          <Sparkles size={15} />

          {loading
            ? "Generando..."
            : content
            ? "Actualizar explicación"
            : "Generar explicación con IA"}
        </button>
      </div>

      {!content && !error && (
        <p className="results-ai-intro">
          La IA recibe únicamente el análisis
          estructurado y las conclusiones
          reproducibles del sistema. No recibe el
          código fuente ni el CSV bruto.
        </p>
      )}

      {error && (
        <div className="results-ai-error">
          <Info size={15} />
          <span>{error}</span>
        </div>
      )}

      {content && (
        <div className="results-ai-content">
          <div className="results-ai-summary">
            <span className="results-ai-badge">
              <Sparkles size={13} />
              IA · evidencia verificada
            </span>

            <p>
              {content.summary}
            </p>
          </div>

          {Array.isArray(
            content.observations
          ) &&
            content.observations.length >
              0 && (
              <div className="results-ai-observations">
                {content.observations.map(
                  (observation, index) => (
                    <article
                      key={`${observation.metric}-${observation.evidence_kind}-${index}`}
                    >
                      <div>
                        <strong>
                          {getPedagogyMetricLabel(
                            observation.metric
                          )}
                        </strong>

                        <span>
                          {getPedagogyKindLabel(
                            observation.evidence_kind
                          )}
                        </span>
                      </div>

                      <p>
                        {observation.text}
                      </p>
                    </article>
                  )
                )}
              </div>
            )}

          {Array.isArray(
            content.limitations
          ) &&
            content.limitations.length >
              0 && (
              <div className="results-ai-limitations">
                <strong>
                  Límites de esta lectura
                </strong>

                <ul>
                  {content.limitations.map(
                    (limitation, index) => (
                      <li key={index}>
                        {limitation}
                      </li>
                    )
                  )}
                </ul>
              </div>
            )}

          <div className="results-ai-takeaway">
            <strong>
              Para llevarte de esta ejecución
            </strong>

            <p>
              {content.student_takeaway}
            </p>
          </div>

          <div className="results-ai-meta">
            <span>
              Modelo:{" "}
              {explanation.model ||
                "configurado por servidor"}
            </span>

            <span>
              {explanation.cached
                ? "Resultado reutilizado desde caché"
                : "Generado para esta ejecución"}
            </span>

            <span>
              Código fuente enviado: no
            </span>
          </div>
        </div>
      )}
    </div>
  );
}


function ResultsFilters({
  aggregation,
  setAggregation,
  showDispersion,
  setShowDispersion,
  xScale,
  setXScale,
  canUseLogScale,
  inputSizes,
  rangeMin,
  rangeMax,
  onRangeMinChange,
  onRangeMaxChange,
  onReset,
  activeFilterCount,
}) {
  const multipleInputSizes =
    inputSizes.length > 1;

  return (
    <section className="results-filters-panel">
      <div className="results-filters-header">
        <div>
          <span className="results-section-kicker">
            Visualización
          </span>

          <h2>
            Filtros del análisis
          </h2>

          <p>
            Cambian únicamente la representación
            de los resultados; no modifican las
            mediciones originales.
          </p>
        </div>

        <button
          type="button"
          className="results-filter-reset"
          onClick={onReset}
          disabled={
            activeFilterCount === 0
          }
        >
          <RotateCcw size={14} />
          Restablecer
        </button>
      </div>

      <div className="results-filter-grid">
        <fieldset className="results-filter-group">
          <legend>Agregación</legend>

          <div className="results-segmented-control">
            <button
              type="button"
              className={
                aggregation === "mean"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setAggregation("mean")
              }
            >
              Media
            </button>

            <button
              type="button"
              className={
                aggregation === "median"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setAggregation("median")
              }
            >
              Mediana
            </button>
          </div>

          <small>
            Define el valor central mostrado en
            gráficos y KPIs.
          </small>
        </fieldset>

        <fieldset className="results-filter-group">
          <legend>Dispersión</legend>

          <label className="results-filter-check">
            <input
              type="checkbox"
              checked={
                showDispersion
              }
              onChange={(event) =>
                setShowDispersion(
                  event.target.checked
                )
              }
            />

            <span>
              {aggregation === "median"
                ? "Intervalo Q1–Q3"
                : "± desviación estándar"}
            </span>
          </label>

          <small>
            {aggregation === "median"
              ? "Muestra el 50 % central de las observaciones alrededor de la mediana."
              : "Muestra la desviación estándar muestral alrededor de la media."}
          </small>
        </fieldset>

        <fieldset className="results-filter-group">
          <legend>Escala horizontal</legend>

          <div className="results-segmented-control">
            <button
              type="button"
              className={
                xScale === "linear"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setXScale("linear")
              }
            >
              Lineal
            </button>

            <button
              type="button"
              className={
                xScale === "log"
                  ? "active"
                  : ""
              }
              disabled={
                !canUseLogScale
              }
              onClick={() =>
                setXScale("log")
              }
            >
              Log
            </button>
          </div>

          <small>
            Afecta solo al eje de tamaño de
            entrada.
          </small>
        </fieldset>

        <fieldset className="results-filter-group">
          <legend>Rango de entrada</legend>

          <div className="results-range-controls">
            <label>
              <span>Desde</span>

              <select
                value={rangeMin}
                disabled={
                  !multipleInputSizes
                }
                onChange={(event) =>
                  onRangeMinChange(
                    event.target.value
                  )
                }
              >
                <option value="">
                  Mínimo
                </option>

                {inputSizes.map(
                  (value) => (
                    <option
                      key={`min-${value}`}
                      value={value}
                    >
                      {value}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              <span>Hasta</span>

              <select
                value={rangeMax}
                disabled={
                  !multipleInputSizes
                }
                onChange={(event) =>
                  onRangeMaxChange(
                    event.target.value
                  )
                }
              >
                <option value="">
                  Máximo
                </option>

                {inputSizes.map(
                  (value) => (
                    <option
                      key={`max-${value}`}
                      value={value}
                    >
                      {value}
                    </option>
                  )
                )}
              </select>
            </label>
          </div>

          <small>
            {multipleInputSizes
              ? "Limita los puntos visibles sin alterar el CSV."
              : "Esta ejecución contiene un único tamaño de entrada."}
          </small>
        </fieldset>
      </div>
    </section>
  );
}


function KpiOverview({
  items,
  aggregation,
  effectiveRange,
}) {
  const aggregationLabel =
    aggregation === "median"
      ? "mediana"
      : "media";

  const rangeLabel =
    formatRangeLabel(
      effectiveRange
    );

  return (
    <section
      className="results-kpi-section"
      aria-labelledby="results-kpi-title"
    >
      <div className="results-kpi-heading">
        <div>
          <span className="results-section-kicker">
            Lectura rápida
          </span>

          <h2 id="results-kpi-title">
            Indicadores principales
          </h2>
        </div>

        <p>
          Valor de {aggregationLabel} en el mayor
          tamaño de entrada visible
          {rangeLabel
            ? ` · ${rangeLabel}`
            : ""}.
        </p>
      </div>

      <div className="results-kpi-grid">
        {items.map((item) => (
          <KpiCard
            key={item.metric}
            item={item}
          />
        ))}
      </div>
    </section>
  );
}


function KpiCard({ item }) {
  const Icon = item.icon;

  return (
    <article
      className={`results-kpi-card ${
        item.available
          ? ""
          : "results-kpi-card-unavailable"
      }`}
    >
      <div className="results-kpi-card-top">
        <div className="results-kpi-icon">
          <Icon size={17} />
        </div>

        <span className="results-kpi-label">
          {item.label}
        </span>
      </div>

      {item.available ? (
        <>
          <div className="results-kpi-value">
            {item.value}
          </div>

          <div className="results-kpi-context">
            <span>
              Tamaño {item.inputSize}
            </span>

            {item.dispersion && (
              <span>
                {item.dispersion}
              </span>
            )}
          </div>

          <p className="results-kpi-description">
            {item.description}
          </p>

          {item.sourceSummary && (
            <div className="results-kpi-source">
              {item.sourceSummary}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="results-kpi-value results-kpi-value-unavailable">
            No disponible
          </div>

          <p className="results-kpi-description">
            No se obtuvieron datos válidos para
            este indicador.
          </p>
        </>
      )}
    </article>
  );
}


function ExecutionMetadata({
  statusData,
  courseContext,
}) {
  const taskLabel =
    getTaskLabel(statusData?.task_type);

  const inputLabel =
    statusData?.input_size ??
    "—";

  const samplesLabel =
    statusData?.samples ??
    "—";
  const courseLabel = courseContext
    ? formatCourseLabel(courseContext.course)
    : null;
  const academicPeriod = courseContext
    ? formatAcademicPeriod(courseContext.course)
    : null;
  const courseDescription = courseContext
    ? academicPeriod || "Análisis personal"
    : null;

  return (
    <div className="results-metadata-grid">
      <MetadataCard
        label="Benchmark"
        value={taskLabel}
        description="Tipo de prueba ejecutada"
      />

      <MetadataCard
        label="Tamaño máximo"
        value={inputLabel}
        description="Límite de entrada configurado"
      />

      <MetadataCard
        label="Repeticiones"
        value={samplesLabel}
        description="Por punto de medición"
      />

      <MetadataCard
        label="Entorno"
        value="Administrado"
        description="Nodo configurado por Performance System"
      />

      {courseContext && (
        <MetadataCard
          label="Curso"
          value={courseLabel}
          description={courseDescription}
        />
      )}
    </div>
  );
}


function MetadataCard({
  label,
  value,
  description,
}) {
  return (
    <div className="results-metadata-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{description}</small>
    </div>
  );
}


function MetricCard({
  metric,
  file,
  metricData,
  measurementContext,
  pedagogyMetric,
  plotTheme,
  aggregation,
  showDispersion,
  xScale,
  inputRange,
  filesBaseURL,
  expanded,
  onToggleDescription,
}) {
  const presentation =
    getMetricPresentation(metric);

  const description =
    METRIC_DESCRIPTIONS[metric] ||
    "Esta métrica no tiene una descripción pedagógica configurada todavía.";

  return (
    <article className="results-metric-card">
      <header className="results-metric-card-header">
        <div>
          <span className="results-metric-eyebrow">
            {presentation.eyebrow}
          </span>

          <h3>
            {presentation.label}
          </h3>
        </div>

        <button
          type="button"
          className={`results-info-button ${
            expanded
              ? "results-info-button-active"
              : ""
          }`}
          onClick={onToggleDescription}
          aria-expanded={expanded}
          aria-label={`Explicar ${presentation.label}`}
        >
          <Info size={16} />
        </button>
      </header>

      {expanded && (
        <div className="results-metric-explanation">
          <div className="results-metric-explanation-block">
            <strong>Qué representa</strong>
            <p>{description}</p>
          </div>

          <MetricPedagogy
            pedagogyMetric={
              pedagogyMetric
            }
          />
        </div>
      )}

      {hasNativeMetricData(metricData) ? (
        <>
          {metricData?.status === "partial" && (
            <PartialAvailabilityNotice
              metricData={metricData}
            />
          )}

          <NativeMetricChart
            metric={metric}
            metricData={metricData}
            presentation={presentation}
            plotTheme={plotTheme}
            aggregation={aggregation}
            showDispersion={showDispersion}
            xScale={xScale}
            inputRange={inputRange}
          />
        </>
      ) : metricData ? (
        <MetricAvailabilityState
          metricData={metricData}
          measurementContext={
            measurementContext
          }
          presentation={presentation}
        />
      ) : file ? (
        <LegacyMetricChart
          file={file}
          filesBaseURL={filesBaseURL}
          title={presentation.label}
        />
      ) : (
        <MetricUnavailableState
          title={presentation.label}
        />
      )}

      <footer className="results-metric-card-footer">
        <span>
          {hasNativeMetricData(metricData)
            ? buildChartFooterText(
                aggregation,
                showDispersion,
                xScale,
                inputRange
              )
            : metricData
            ? buildAvailabilityFooter(
                metricData
              )
            : file
            ? "Compatibilidad legacy"
            : "Sin datos de visualización"}
        </span>

        <ChevronDown
          size={14}
          aria-hidden="true"
        />
      </footer>
    </article>
  );
}


function MetricPedagogy({
  pedagogyMetric,
}) {
  const messages =
    pedagogyMetric?.messages || [];

  const visibleMessages =
    messages
      .filter(
        (message) =>
          message.kind !==
          "availability"
      )
      .sort(
        (a, b) =>
          getPedagogyPriorityWeight(
            a.priority
          ) -
          getPedagogyPriorityWeight(
            b.priority
          )
      )
      .slice(0, 4);

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className="results-metric-pedagogy">
      <strong>
        Qué ocurrió en esta ejecución
      </strong>

      <div className="results-metric-pedagogy-list">
        {visibleMessages.map(
          (message, index) => (
            <div
              key={`${message.kind}-${index}`}
              className="results-metric-pedagogy-item"
            >
              <span className="results-metric-pedagogy-badge">
                {getPedagogyKindLabel(
                  message.kind
                )}
              </span>

              <p>
                {message.text}
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}


function NativeMetricChart({
  metric,
  metricData,
  presentation,
  plotTheme,
  aggregation,
  showDispersion,
  xScale,
  inputRange,
}) {
  const points =
    Array.isArray(metricData?.points)
      ? filterMetricPoints(
          metricData.points,
          inputRange
        )
      : [];

  const pointsBySource =
    points.reduce((groups, point) => {
      const source =
        point.source || "Ejecución";

      if (!groups[source]) {
        groups[source] = [];
      }

      groups[source].push(point);

      return groups;
    }, {});

  const traces =
    Object.entries(pointsBySource)
      .map(([source, sourcePoints]) => {
        const ordered =
          sourcePoints
            .slice()
            .sort(
              (a, b) =>
                Number(a.input_size) -
                Number(b.input_size)
            );

        const transformedValues =
          ordered.map((point) =>
            transformMetricValue(
              metric,
              point[
                aggregation
              ]
            )
          );

        const transformedStddev =
          ordered.map((point) =>
            transformMetricValue(
              metric,
              point.stddev || 0
            )
          );

        const transformedQ1 =
          ordered.map((point) =>
            transformMetricValue(
              metric,
              point.q1
            )
          );

        const transformedQ3 =
          ordered.map((point) =>
            transformMetricValue(
              metric,
              point.q3
            )
          );

        const upperDispersion =
          ordered.map((point, index) => {
            if (aggregation === "median") {
              const center = Number(transformedValues[index]);
              const upper = Number(transformedQ3[index]);
              return Number.isFinite(center) && Number.isFinite(upper)
                ? Math.max(0, upper - center)
                : 0;
            }

            return Number(transformedStddev[index]) || 0;
          });

        const lowerDispersion =
          ordered.map((point, index) => {
            if (aggregation === "median") {
              const center = Number(transformedValues[index]);
              const lower = Number(transformedQ1[index]);
              return Number.isFinite(center) && Number.isFinite(lower)
                ? Math.max(0, center - lower)
                : 0;
            }

            return Number(transformedStddev[index]) || 0;
          });

        return {
          type: "scatter",
          mode:
            ordered.length > 1
              ? "lines+markers"
              : "markers",
          name: source,
          x: ordered.map(
            (point) =>
              Number(point.input_size)
          ),
          y: transformedValues,
          error_y: {
            type: "data",
            symmetric: false,
            array: upperDispersion,
            arrayminus: lowerDispersion,
            visible:
              showDispersion,
          },
          marker: {
            size: 7,
          },
          line: {
            width: 2,
          },
          customdata: ordered.map(
            (point) => [
              formatMetricValue(
                metric,
                point[
                  aggregation
                ]
              ),
              formatMetricValue(
                metric,
                point.mean
              ),
              formatMetricValue(
                metric,
                point.median
              ),
              formatMetricValue(
                metric,
                point.stddev || 0
              ),
              formatMetricValue(
                metric,
                point.q1
              ),
              formatMetricValue(
                metric,
                point.q3
              ),
              Number(point.samples_valid),
              Number(point.samples_total),
              Number(
                point.iqr_outliers_detected || 0
              ),
            ]
          ),
          hovertemplate:
            `<b>Tamaño de entrada %{x}</b><br>` +
            `${aggregation === "median" ? "Mediana" : "Media"}: %{customdata[0]}<br>` +
            "Media: %{customdata[1]}<br>" +
            "Mediana: %{customdata[2]}<br>" +
            "Desv. estándar: %{customdata[3]}<br>" +
            "Q1: %{customdata[4]}<br>" +
            "Q3: %{customdata[5]}<br>" +
            "Muestras numéricas: %{customdata[6]}/%{customdata[7]}<br>" +
            "Outliers IQR detectados: %{customdata[8]}" +
            "<extra>%{fullData.name}</extra>",
        };
      });

  const finiteYValues =
    traces.reduce((values, trace) => {
      const ys = Array.isArray(trace.y)
        ? trace.y
        : [];

      ys.forEach((value) => {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          values.push(numeric);
        }
      });

      return values;
    }, []);

  const allValuesZero =
    finiteYValues.length > 0 &&
    finiteYValues.every((value) => value === 0);

  const yAxis = Object.assign(
    {},
    buildYAxisConfig(
      metric,
      presentation
    ),
    allValuesZero
      ? {
          range: [0, 1],
          tickmode: "array",
          tickvals: [0, 1],
          ticktext: ["0", "1"],
        }
      : {}
  );

  return (
    <div className="results-chart-frame results-chart-frame-native">
      <Plot
        data={traces}
        layout={{
          autosize: true,
          paper_bgcolor:
            "rgba(0,0,0,0)",
          plot_bgcolor:
            "rgba(0,0,0,0)",
          colorway:
            plotTheme.colorway,
          font: {
            color:
              plotTheme.textSecondary,
            family:
              plotTheme.fontFamily,
            size: 12,
          },
          margin: {
            l: 72,
            r: 24,
            t: 24,
            b: 58,
          },
          xaxis: applyAxisTheme(
            {
              title: {
                text: "Tamaño de entrada",
              },
              automargin: true,
              type:
                xScale === "log"
                  ? "log"
                  : "linear",
            },
            plotTheme
          ),
          yaxis: applyAxisTheme(
            yAxis,
            plotTheme
          ),
          hovermode: "closest",
          hoverlabel: {
            bgcolor:
              plotTheme.surfaceElevated,
            bordercolor:
              plotTheme.borderStrong,
            font: {
              color: plotTheme.text,
              family:
                plotTheme.fontFamily,
            },
          },
          legend: {
            font: {
              color:
                plotTheme.textSecondary,
            },
            bgcolor:
              "rgba(0,0,0,0)",
          },
          showlegend:
            traces.length > 1,
        }}
        config={{
          responsive: true,
          displaylogo: false,
        }}
        useResizeHandler
        className="results-native-plot"
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}


function LegacyMetricChart({
  file,
  filesBaseURL,
  title,
}) {
  return (
    <div className="results-chart-frame">
      <iframe
        src={`${filesBaseURL}${file}`}
        title={`Gráfico de ${title}`}
        loading="lazy"
      />
    </div>
  );
}


function PartialAvailabilityNotice({
  metricData,
}) {
  const availability =
    metricData?.availability || {};

  return (
    <div className="results-partial-notice">
      <Info size={15} />

      <span>
        Disponibilidad parcial:{" "}
        {availability.numeric || 0} de{" "}
        {availability.rows_total || 0} muestras
        contienen un valor numérico.
      </span>
    </div>
  );
}


function MetricAvailabilityState({
  metricData,
  measurementContext,
  presentation,
}) {
  const statusInfo =
    getMetricAvailabilityPresentation(
      metricData?.status
    );

  const summary =
    buildMetricAvailabilitySummary(
      metricData
    );

  const hardwareExplanation =
    buildHardwareAvailabilityExplanation(
      metricData
    );

  const environmentSummary =
    metricData?.hardware_context
      ? buildMeasurementContextSummary(
          measurementContext
        )
      : "";

  return (
    <div
      className={`results-availability-state results-availability-${statusInfo.tone}`}
    >
      <div className="results-availability-icon">
        <Info size={20} />
      </div>

      <div className="results-availability-content">
        <span className="results-availability-label">
          {statusInfo.label}
        </span>

        <strong>
          {presentation.label}
        </strong>

        <p>
          {statusInfo.description}
        </p>

        {hardwareExplanation && (
          <div className="results-availability-summary">
            <strong>
              Contexto de medición
            </strong>

            <div>
              {hardwareExplanation}
            </div>

            {environmentSummary && (
              <div>
                {environmentSummary}
              </div>
            )}
          </div>
        )}

        {summary && (
          <div className="results-availability-summary">
            {summary}
          </div>
        )}

        <small>
          La ausencia de una medición no se
          interpreta como un valor cero.
        </small>
      </div>
    </div>
  );
}


function buildHardwareAvailabilityExplanation(
  metricData
) {
  const context =
    metricData?.hardware_context;

  if (!context) {
    return "";
  }

  const event =
    context.event ||
    "el evento solicitado";

  const state =
    context.probe_state;

  if (state === "event_not_exposed") {
    return `El backend perf de este entorno no expone ${event}.`;
  }

  if (state === "not_supported") {
    return `El evento ${event} aparece expuesto por perf, pero la prueba de disponibilidad no pudo medirlo en este entorno.`;
  }

  if (state === "not_counted") {
    return `El evento ${event} fue reconocido, pero la prueba de disponibilidad no produjo un conteo válido.`;
  }

  if (state === "backend_error") {
    return `No fue posible verificar ${event} por un problema del backend de medición.`;
  }

  if (state === "no_numeric_sample") {
    return `La prueba de ${event} no produjo una muestra numérica válida.`;
  }

  if (state === "numeric") {
    return `La prueba de ${event} produjo una muestra numérica válida.`;
  }

  if (context.event_exposed === false) {
    return `El backend de medición no expone ${event} en este entorno.`;
  }

  return "";
}


function buildMeasurementContextSummary(
  measurementContext
) {
  if (!measurementContext) {
    return "";
  }

  const parts = [];
  const cpu =
    measurementContext.cpu || {};
  const backend =
    measurementContext.backend || {};

  if (cpu.model) {
    parts.push(cpu.model);
  }

  if (backend.version) {
    parts.push(backend.version);
  } else if (backend.name) {
    parts.push(backend.name);
  }

  if (backend.requested_scope) {
    parts.push(
      `scope solicitado: ${backend.requested_scope}`
    );
  }

  return parts.length > 0
    ? `Entorno observado: ${parts.join(" · ")}.`
    : "";
}

function getMetricAvailabilityPresentation(
  status
) {
  const map = {
    unsupported: {
      label: "No disponible",
      tone: "unsupported",
      description:
        "La medición no produjo muestras numéricas válidas en el entorno utilizado para esta ejecución.",
    },
    not_counted: {
      label: "No contabilizada",
      tone: "not-counted",
      description:
        "El evento fue reconocido, pero perf no pudo obtener un conteo válido durante esta ejecución.",
    },
    no_data: {
      label: "Sin datos válidos",
      tone: "no-data",
      description:
        "No se obtuvieron observaciones numéricas suficientes para representar esta métrica.",
    },
  };

  return (
    map[status] || {
      label: "No disponible",
      tone: "no-data",
      description:
        "Esta métrica no dispone de datos representables en la ejecución actual.",
    }
  );
}


function buildMetricAvailabilitySummary(
  metricData
) {
  const availability =
    metricData?.availability || {};

  const total =
    Number(
      availability.rows_total
    );

  if (!Number.isFinite(total) || total <= 0) {
    return "";
  }

  /*
   * CORE-06C-5A.1:
   * Cuando existe provenance real del evento energético, el resumen
   * debe describir probe_state y no inferir "hardware no soportado"
   * a partir del marcador agregado <not-supported>.
   */
  const probeState =
    metricData?.hardware_context
      ?.probe_state;

  if (probeState === "event_not_exposed") {
    return `${total}/${total} muestras no dispusieron de este evento en el backend de medición.`;
  }

  if (probeState === "not_supported") {
    return `${total}/${total} muestras no pudieron medir este evento en el entorno observado.`;
  }

  if (probeState === "not_counted") {
    return `${total}/${total} muestras no produjeron un conteo válido para este evento.`;
  }

  if (probeState === "backend_error") {
    return `No fue posible verificar la disponibilidad del evento para las ${total} muestras por un problema del backend de medición.`;
  }

  if (probeState === "no_numeric_sample") {
    return `${total}/${total} muestras quedaron sin una observación numérica válida para este evento.`;
  }

  if (
    metricData?.status === "unsupported"
  ) {
    return `${availability.unsupported || 0}/${total} muestras reportaron el evento como no disponible.`;
  }

  if (
    metricData?.status === "not_counted"
  ) {
    return `${availability.not_counted || 0}/${total} muestras no pudieron ser contabilizadas.`;
  }

  if (
    metricData?.status === "no_data"
  ) {
    return `${availability.missing || 0}/${total} muestras sin un valor numérico válido.`;
  }

  return "";
}


function buildAvailabilityFooter(
  metricData
) {
  const statusInfo =
    getMetricAvailabilityPresentation(
      metricData?.status
    );

  const provenance =
    metricData?.availability
      ?.provenance;

  const provenanceLabel = {
    metric_availability_sidecar:
      "procedencia preservada",
    raw_csv_fallback:
      "procedencia recuperada",
    combined_results:
      "CombinedResults",
  }[provenance];

  return provenanceLabel
    ? `${statusInfo.label} · ${provenanceLabel}`
    : statusInfo.label;
}


function MetricUnavailableState({
  title,
}) {
  return (
    <div className="results-native-chart-state">
      <BarChart3 size={22} />

      <div>
        <strong>
          {title} no disponible
        </strong>

        <p>
          No hay datos estructurados ni una
          visualización legacy para esta métrica.
        </p>
      </div>
    </div>
  );
}


function hasNativeMetricData(
  metricData
) {
  return (
    (
      metricData?.status === "available" ||
      metricData?.status === "partial"
    ) &&
    Array.isArray(metricData?.points) &&
    metricData.points.length > 0
  );
}


function transformMetricValue(
  metric,
  value
) {
  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  const kind =
    getMetricPresentation(metric)
      .displayKind;

  if (kind === "percentage") {
    return numeric * 100;
  }

  return numeric;
}


function formatMetricValue(
  metric,
  value
) {
  const numeric =
    transformMetricValue(
      metric,
      value
    );

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  const presentation =
    getMetricPresentation(metric);

  switch (
    presentation.displayKind
  ) {
    case "percentage":
      return `${formatFixed(numeric, 2)} %`;

    case "milliseconds":
      return `${formatAdaptive(numeric)} ms`;

    case "ratio":
      return formatFixed(numeric, 3);

    case "perMillion":
      return `${formatAdaptive(numeric)} / M instr.`;

    case "energy":
      return `${formatAdaptive(numeric)} J`;

    case "count":
      return formatCompactCount(numeric);

    default:
      return formatAdaptive(numeric);
  }
}


function buildYAxisConfig(
  metric,
  presentation
) {
  const kind =
    presentation?.displayKind ||
    getMetricPresentation(metric)
      .displayKind;

  const config = {
    title: {
      text:
        presentation?.axisTitle ||
        humanizeMetric(metric),
    },
    automargin: true,
    rangemode: "tozero",
  };

  if (kind === "percentage") {
    config.ticksuffix = "%";
    config.tickformat = ".2f";
  }

  if (kind === "count") {
    config.tickformat = ".3s";
    config.separatethousands = true;
  }

  return config;
}


function getMetricPresentation(
  metric
) {
  return (
    METRIC_PRESENTATION[metric] || {
      label: humanizeMetric(metric),
      eyebrow: "Métrica",
      axisTitle: humanizeMetric(metric),
      displayKind: "number",
    }
  );
}


function formatCompactCount(value) {
  const absolute =
    Math.abs(value);

  if (absolute < 1000) {
    return new Intl.NumberFormat(
      "es-CL",
      {
        maximumFractionDigits: 2,
      }
    ).format(value);
  }

  return new Intl.NumberFormat(
    "es-CL",
    {
      notation: "compact",
      maximumFractionDigits: 3,
    }
  ).format(value);
}


function formatAdaptive(value) {
  const absolute =
    Math.abs(value);

  if (
    absolute === 0 ||
    absolute >= 100
  ) {
    return formatFixed(value, 2);
  }

  if (absolute >= 1) {
    return formatFixed(value, 3);
  }

  return formatFixed(value, 4);
}


function formatFixed(
  value,
  decimals
) {
  return new Intl.NumberFormat(
    "es-CL",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    }
  ).format(value);
}


function usePlotTheme() {
  const [themeName, setThemeName] =
    useState(() =>
      document.documentElement.getAttribute(
        "data-theme"
      ) || "dark"
    );

  useEffect(() => {
    const root =
      document.documentElement;

    const syncTheme = () => {
      setThemeName(
        root.getAttribute(
          "data-theme"
        ) || "dark"
      );
    };

    const observer =
      new MutationObserver(
        (mutations) => {
          const themeChanged =
            mutations.some(
              (mutation) =>
                mutation.type ===
                  "attributes" &&
                mutation.attributeName ===
                  "data-theme"
            );

          if (themeChanged) {
            syncTheme();
          }
        }
      );

    observer.observe(root, {
      attributes: true,
      attributeFilter: [
        "data-theme",
      ],
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return useMemo(
    () =>
      readPlotThemeTokens(
        themeName
      ),
    [themeName]
  );
}


function readPlotThemeTokens(
  themeName
) {
  const styles =
    getComputedStyle(
      document.documentElement
    );

  const token = (
    name,
    fallback
  ) => {
    const value =
      styles
        .getPropertyValue(name)
        .trim();

    return value || fallback;
  };

  return {
    name: themeName,
    text:
      token(
        "--ps-text",
        themeName === "dark"
          ? "#f8fafc"
          : "#0f172a"
      ),
    textSecondary:
      token(
        "--ps-text-secondary",
        themeName === "dark"
          ? "#cbd5e1"
          : "#475569"
      ),
    textMuted:
      token(
        "--ps-text-muted",
        themeName === "dark"
          ? "#94a3b8"
          : "#64748b"
      ),
    border:
      token(
        "--ps-border",
        themeName === "dark"
          ? "#293548"
          : "#d7e0ea"
      ),
    borderStrong:
      token(
        "--ps-border-strong",
        themeName === "dark"
          ? "#3b4a60"
          : "#bcc8d6"
      ),
    divider:
      token(
        "--ps-divider",
        themeName === "dark"
          ? "rgba(148, 163, 184, 0.18)"
          : "rgba(100, 116, 139, 0.18)"
      ),
    surface:
      token(
        "--ps-surface",
        themeName === "dark"
          ? "#111827"
          : "#ffffff"
      ),
    surfaceElevated:
      token(
        "--ps-surface-elevated",
        themeName === "dark"
          ? "#1e293b"
          : "#ffffff"
      ),
    primary:
      token(
        "--ps-primary",
        themeName === "dark"
          ? "#3b82f6"
          : "#2563eb"
      ),
    accent:
      token(
        "--ps-accent",
        themeName === "dark"
          ? "#22d3ee"
          : "#0891b2"
      ),
    success:
      token(
        "--ps-success",
        themeName === "dark"
          ? "#10b981"
          : "#059669"
      ),
    warning:
      token(
        "--ps-warning",
        themeName === "dark"
          ? "#f59e0b"
          : "#d97706"
      ),
    danger:
      token(
        "--ps-danger",
        themeName === "dark"
          ? "#ef4444"
          : "#dc2626"
      ),
    info:
      token(
        "--ps-info",
        themeName === "dark"
          ? "#38bdf8"
          : "#0284c7"
      ),
    fontFamily:
      token(
        "--ps-font-sans",
        '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      ),
    colorway: [
      token(
        "--ps-primary",
        "#3b82f6"
      ),
      token(
        "--ps-accent",
        "#22d3ee"
      ),
      token(
        "--ps-success",
        "#10b981"
      ),
      token(
        "--ps-warning",
        "#f59e0b"
      ),
      token(
        "--ps-info",
        "#38bdf8"
      ),
      token(
        "--ps-danger",
        "#ef4444"
      ),
    ],
  };
}


function applyAxisTheme(
  axis,
  plotTheme
) {
  return Object.assign(
    {},
    axis,
    {
      color:
        plotTheme.textSecondary,
      gridcolor:
        plotTheme.divider,
      zerolinecolor:
        plotTheme.border,
      linecolor:
        plotTheme.border,
      tickcolor:
        plotTheme.borderStrong,
      tickfont: {
        color:
          plotTheme.textSecondary,
      },
      title: Object.assign(
        {},
        axis.title || {},
        {
          font: {
            color:
              plotTheme.textSecondary,
          },
        }
      ),
    }
  );
}


function collectInputSizes(
  resultsData
) {
  const values = [];

  Object.values(
    resultsData?.metrics || {}
  ).forEach((metricData) => {
    if (
      !Array.isArray(
        metricData?.points
      )
    ) {
      return;
    }

    metricData.points.forEach(
      (point) => {
        const numeric =
          Number(
            point.input_size
          );

        if (
          Number.isFinite(numeric)
        ) {
          values.push(numeric);
        }
      }
    );
  });

  return unique(values)
    .sort((a, b) => a - b);
}


function buildEffectiveRange(
  inputSizes,
  rangeMin,
  rangeMax
) {
  if (
    !Array.isArray(inputSizes) ||
    inputSizes.length === 0
  ) {
    return null;
  }

  const overallMin =
    inputSizes[0];

  const overallMax =
    inputSizes[
      inputSizes.length - 1
    ];

  const min =
    rangeMin === ""
      ? overallMin
      : Number(rangeMin);

  const max =
    rangeMax === ""
      ? overallMax
      : Number(rangeMax);

  return {
    min,
    max,
    isFiltered:
      min !== overallMin ||
      max !== overallMax,
  };
}


function filterMetricPoints(
  points,
  inputRange
) {
  if (
    !Array.isArray(points)
  ) {
    return [];
  }

  if (!inputRange) {
    return points;
  }

  return points.filter(
    (point) => {
      const inputSize =
        Number(
          point.input_size
        );

      return (
        Number.isFinite(
          inputSize
        ) &&
        inputSize >=
          inputRange.min &&
        inputSize <=
          inputRange.max
      );
    }
  );
}


function countActiveFilters({
  aggregation,
  showDispersion,
  xScale,
  rangeMin,
  rangeMax,
}) {
  let count = 0;

  if (aggregation !== "median") {
    count += 1;
  }

  if (!showDispersion) {
    count += 1;
  }

  if (xScale !== "linear") {
    count += 1;
  }

  if (
    rangeMin !== "" ||
    rangeMax !== ""
  ) {
    count += 1;
  }

  return count;
}


function formatRangeLabel(
  inputRange
) {
  if (
    !inputRange ||
    !inputRange.isFiltered
  ) {
    return "";
  }

  return `rango ${inputRange.min}–${inputRange.max}`;
}


function buildChartFooterText(
  aggregation,
  showDispersion,
  xScale,
  inputRange
) {
  const parts = [
    "Datos API",
    aggregation === "median"
      ? "mediana"
      : "media",
  ];

  if (showDispersion) {
    parts.push(
      aggregation === "median"
        ? "Q1–Q3"
        : "± desviación estándar"
    );
  }

  if (xScale === "log") {
    parts.push("escala log X");
  }

  if (
    inputRange &&
    inputRange.isFiltered
  ) {
    parts.push(
      `rango ${inputRange.min}–${inputRange.max}`
    );
  }

  return parts.join(" · ");
}


function buildKpiItems(
  resultsData,
  aggregation,
  showDispersion,
  inputRange
) {
  return KPI_DEFINITIONS.map(
    (definition) =>
      buildKpiItem(
        definition,
        resultsData?.metrics?.[
          definition.metric
        ],
        aggregation,
        showDispersion,
        inputRange
      )
  );
}


function buildKpiItem(
  definition,
  metricData,
  aggregation,
  showDispersion,
  inputRange
) {
  const points =
    metricData &&
    metricData.status === "available" &&
    Array.isArray(metricData.points)
      ? metricData.points
      : [];

  if (points.length === 0) {
    return Object.assign(
      {},
      definition,
      {
        available: false,
        value: "—",
        inputSize: "—",
        dispersion: "",
        sourceSummary: "",
      }
    );
  }

  const numericPoints =
    filterMetricPoints(
      points,
      inputRange
    ).filter((point) =>
      Number.isFinite(
        Number(point.input_size)
      ) &&
      Number.isFinite(
        Number(
          point[
            aggregation
          ]
        )
      )
    );

  if (numericPoints.length === 0) {
    return Object.assign(
      {},
      definition,
      {
        available: false,
        value: "—",
        inputSize: "—",
        dispersion: "",
        sourceSummary: "",
      }
    );
  }

  const maxInputSize =
    Math.max.apply(
      null,
      numericPoints.map(
        (point) =>
          Number(point.input_size)
      )
    );

  const maxPoints =
    numericPoints.filter(
      (point) =>
        Number(point.input_size) ===
        maxInputSize
    );

  const values =
    maxPoints
      .map((point) =>
        Number(
          point[
            aggregation
          ]
        )
      )
      .filter(Number.isFinite);

  if (values.length === 0) {
    return Object.assign(
      {},
      definition,
      {
        available: false,
        value: "—",
        inputSize: maxInputSize,
        dispersion: "",
        sourceSummary: "",
      }
    );
  }

  const metric =
    definition.metric;

  if (values.length === 1) {
    const point =
      maxPoints[0];

    return Object.assign(
      {},
      definition,
      {
        available: true,
        value:
          formatKpiValue(
            metric,
            point[
              aggregation
            ]
          ),
        inputSize:
          maxInputSize,
        dispersion:
          showDispersion
            ? aggregation === "median"
              ? formatKpiIqr(
                  metric,
                  point.q1,
                  point.q3
                )
              : formatKpiDispersion(
                  metric,
                  point.stddev
                )
            : "",
        sourceSummary:
          buildSingleSourceSummary(
            point
          ),
      }
    );
  }

  const min =
    Math.min.apply(null, values);

  const max =
    Math.max.apply(null, values);

  return Object.assign(
    {},
    definition,
    {
      available: true,
      value:
        `${formatKpiValue(
          metric,
          min
        )} – ${formatKpiValue(
          metric,
          max
        )}`,
      inputSize:
        maxInputSize,
      dispersion: "",
      sourceSummary:
        `${values.length} implementaciones`,
    }
  );
}


function formatKpiValue(
  metric,
  value
) {
  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  if (metric === "Instructions") {
    return formatScientificCount(
      numeric
    );
  }

  return formatMetricValue(
    metric,
    numeric
  );
}


function formatKpiIqr(
  metric,
  q1,
  q3
) {
  const lower = Number(q1);
  const upper = Number(q3);

  if (
    !Number.isFinite(lower) ||
    !Number.isFinite(upper)
  ) {
    return "";
  }

  return `Q1–Q3: ${formatKpiValue(
    metric,
    lower
  )} – ${formatKpiValue(
    metric,
    upper
  )}`;
}


function formatKpiDispersion(
  metric,
  stddev
) {
  const numeric =
    Number(stddev);

  if (
    !Number.isFinite(numeric)
  ) {
    return "";
  }

  if (metric === "Instructions") {
    return `± ${new Intl.NumberFormat(
      "es-CL",
      {
        maximumFractionDigits: 0,
      }
    ).format(
      Math.round(numeric)
    )} instr.`;
  }

  return `± ${formatMetricValue(
    metric,
    numeric
  )}`;
}


function formatScientificCount(
  value
) {
  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  const absolute =
    Math.abs(numeric);

  if (absolute < 1000) {
    return new Intl.NumberFormat(
      "es-CL",
      {
        maximumFractionDigits: 0,
      }
    ).format(numeric);
  }

  const exponent =
    Math.floor(
      Math.log10(absolute) / 3
    ) * 3;

  const coefficient =
    numeric /
    Math.pow(10, exponent);

  return `${formatFixed(
    coefficient,
    3
  )} × 10${toSuperscript(
    exponent
  )}`;
}


function toSuperscript(
  value
) {
  const map = {
    "-": "⁻",
    "0": "⁰",
    "1": "¹",
    "2": "²",
    "3": "³",
    "4": "⁴",
    "5": "⁵",
    "6": "⁶",
    "7": "⁷",
    "8": "⁸",
    "9": "⁹",
  };

  return String(value)
    .split("")
    .map((char) => map[char] || char)
    .join("");
}


function buildSingleSourceSummary(
  point
) {
  const valid =
    Number(
      point.samples_valid
    );

  const total =
    Number(
      point.samples_total
    );

  if (
    Number.isFinite(valid) &&
    Number.isFinite(total)
  ) {
    return `${valid}/${total} muestras válidas`;
  }

  return point.source || "";
}


function getPedagogyMetricLabel(
  metric
) {
  const presentation =
    getMetricPresentation(metric);

  return (
    presentation?.label ||
    metric ||
    "Métrica"
  );
}


function getPedagogyKindLabel(
  kind
) {
  const labels = {
    snapshot: "Valor observado",
    trend: "Tendencia",
    observed_scaling:
      "Escalamiento observado",
    outliers: "Variabilidad",
    coverage: "Cobertura",
    limitation: "Alcance",
    availability: "Disponibilidad",
  };

  return labels[kind] || "Análisis";
}


function getPedagogyPriorityWeight(
  priority
) {
  const weights = {
    primary: 0,
    secondary: 1,
    advanced: 2,
  };

  return Object.prototype.hasOwnProperty.call(
    weights,
    priority
  )
    ? weights[priority]
    : 3;
}


function getTaskLabel(taskType) {
  const task =
    String(taskType || "")
      .toUpperCase();

  if (task === "LCS") {
    return "Entrada de texto";
  }

  if (
    task === "CAMM" ||
    task === "CAMMR" ||
    task === "CAMMS" ||
    task === "CAMMSO"
  ) {
    return "Datos numéricos";
  }

  if (task === "SIZE") {
    return "Tamaño parametrizado";
  }

  return taskType || "—";
}


function belongsToCategory(
  metric,
  categoryId
) {
  const map = {
    performance: [
      "DurationTime",
      "TaskClock",
      "CpuClock",
      "Instructions",
      "CpuCycles",
      "IPC",
      "BranchMissRate",
      "CacheMissRate",
    ],
    cache: [
      "Cache",
      "L1D",
      "LLC",
    ],
    cpu: [
      "Instructions",
      "CpuCycles",
      "IPC",
      "Branches",
      "BranchMisses",
      "BranchMissRate",
      "BranchMissesPerMI",
      "TaskClock",
      "CpuClock",
    ],
    system: [
      "PageFault",
      "MajorFault",
    ],
    energy: [
      "Energy",
      "Power",
    ],
  };

  const patterns =
    map[categoryId] || [];

  return patterns.some(
    (pattern) =>
      metric.includes(pattern)
  );
}


function stripExtension(filename) {
  return String(filename)
    .replace(/\.[^/.]+$/, "");
}


function humanizeMetric(metric) {
  return String(metric)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ");
}


function unique(items) {
  return Array.from(
    new Set(items)
  );
}

export default RenderImage;
