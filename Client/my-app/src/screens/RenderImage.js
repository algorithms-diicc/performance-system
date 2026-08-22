import AcademicBreadcrumbs from "../components/AcademicBreadcrumbs";
import InlineState from "../components/InlineState";
import ReproducibilityPanel from "../components/ReproducibilityPanel";
import IndividualAIAnalysisPanel from "./components/IndividualAIAnalysisPanel";
import ResultsSectionNav from "./components/ResultsSectionNav";
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
import { useI18n } from "../i18n";
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

const localizedText = (
  t,
  key,
  fallback,
  params = {}
) => {
  if (typeof t !== "function") {
    return fallback;
  }

  const value = t(key, params);
  return value === key ? fallback : value;
};


function RenderImage({ currentUser }) {
  const { locale, t } = useI18n();
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
      key: "",
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
              "renderImage.errors.descriptions.network"
            );
          } else if (status === 403) {
            setLoadErrorType("forbidden");
            setLoadError(
              "renderImage.errors.descriptions.forbidden"
            );
          } else if (status === 404) {
            setLoadErrorType("not-found");
            setLoadError(
              "renderImage.errors.descriptions.notFound"
            );
          } else if (
            status === 409 ||
            status === 425
          ) {
            setLoadErrorType("unavailable");
            setLoadError(
              "renderImage.errors.descriptions.unavailable"
            );
          } else if (status === 401) {
            setLoadErrorType("forbidden");
            setLoadError(
              "renderImage.errors.descriptions.session"
            );
          } else {
            setLoadErrorType("error");
            setLoadError(
              "renderImage.errors.descriptions.generic"
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
          isOwner: Boolean(
            response.data?.permissions?.canViewPrivateMetadata ||
              response.data?.permissions?.canEditMetadata
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

    return t(
      "renderImage.executionFallback",
      { codename }
    );
  }, [
    location.state,
    statusData,
    codename,
    t,
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
        effectiveRange,
        locale,
        t
      ),
    [
      resultsData,
      aggregation,
      effectiveDispersion,
      effectiveRange,
      locale,
      t,
    ]
  );

  const pedagogyData =
    resultsData?.pedagogy || null;

  const aiLanguage =
    String(locale || "es")
      .toLowerCase()
      .startsWith("en")
      ? "en"
      : "es";

  useEffect(() => {
    setAiExplanation(null);
    setAiError("");
  }, [aiLanguage, codename]);

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
    if (aiLoading) return;

    setAiLoading(true);
    setAiError("");

    try {
      const response = await axios.post(
        `${serverURL}api/executions/${encodeURIComponent(
          codename
        )}/ai-explanation`,
        {
          force: Boolean(aiExplanation),
          language: aiLanguage,
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

      const errorKeys = {
        AI_NOT_CONFIGURED:
          "renderImageScientific.ai.errors.notConfigured",
        AI_OUTPUT_REJECTED:
          "renderImageScientific.ai.errors.outputRejected",
        AI_PROVIDER_ERROR:
          "renderImageScientific.ai.errors.provider",
        INVALID_AI_LANGUAGE:
          "renderImageScientific.ai.errors.invalidLanguage",
      };

      setAiError(
        errorKeys[code] ||
          "renderImageScientific.ai.errors.generic"
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleDownload = async () => {
    if (downloadLoading) return;

    setDownloadLoading(true);
    setDownloadFeedback({
      kind: "",
      key: "",
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
        key: "renderImage.download.success",
      });
    } catch (error) {
      console.error(
        "No se pudo descargar el CSV:",
        error
      );

      const status =
        error?.response?.status;

      let key =
        "renderImage.download.errors.generic";

      if (!error?.response) {
        key =
          "renderImage.download.errors.network";
      } else if (status === 403) {
        key =
          "renderImage.download.errors.forbidden";
      } else if (status === 404) {
        key =
          "renderImage.download.errors.notFound";
      }

      setDownloadFeedback({
        kind: "error",
        key,
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
            title={t("renderImage.loading.title")}
            description={t(
              "renderImage.loading.description"
            )}
          />
        </div>
      </main>
    );
  }

  if (loadError) {
    const stateTitle = {
      network: t(
        "renderImage.errors.titles.network"
      ),
      forbidden: t(
        "renderImage.errors.titles.forbidden"
      ),
      "not-found": t(
        "renderImage.errors.titles.notFound"
      ),
      unavailable: t(
        "renderImage.errors.titles.unavailable"
      ),
      error: t(
        "renderImage.errors.titles.generic"
      ),
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
            description={t(loadError)}
            actionLabel={t(
              "renderImage.common.retry"
            )}
            onAction={() => window.location.reload()}
          />

          <Link
            to={roleRootPath}
            className="results-secondary-button"
          >
            <ArrowLeft size={16} />
            {t("renderImage.common.back")}
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
          isOwner={submissionNavigationContext?.isOwner === true}
        />

        <header className="results-header">
          <div className="results-header-top">
            <Link
              to={deterministicBackPath}
              className="results-back-button"
            >
              <ArrowLeft size={17} />
              {t("renderImage.common.back")}
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
                  {t(
                    "renderImage.header.viewExperiment"
                  )}
                </Link>
              )}

              <span className="results-status-chip">
                <CheckCircle2 size={14} />
                {t(
                  "renderImage.header.analysisCompleted"
                )}
              </span>

              <button
                type="button"
                className="results-download-button"
                onClick={handleDownload}
                disabled={downloadLoading}
              >
                <Download size={16} />
                {downloadLoading
                  ? t(
                      "renderImage.download.downloading"
                    )
                  : t(
                      "renderImage.download.action"
                    )}
              </button>
            </div>
          </div>

          {downloadFeedback.key && (
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
                {t(downloadFeedback.key)}
              </span>
            </div>
          )}

          <div className="results-heading">
            <span className="results-eyebrow">
              {t("renderImage.header.eyebrow")}
            </span>

            <h1>{displayName}</h1>

            <p>
              {t("renderImage.header.description")}
            </p>
          </div>

          <ExecutionMetadata
            statusData={statusData}
            courseContext={submissionNavigationContext}
          />
        </header>

        <ResultsSectionNav />

        <section
          id="results-summary"
          className="results-major-section results-summary-section"
          aria-label={t("renderImage.sectionNavigation.summary")}
        >
          <KpiOverview
            items={kpiItems}
            aggregation={aggregation}
            effectiveRange={effectiveRange}
          />
        </section>

        <section
          id="results-interpretation"
          className="results-major-section results-interpretation-section"
          aria-label={t("renderImage.sectionNavigation.interpretation")}
        >
          <PedagogicalOverview
            pedagogy={pedagogyData}
            aiExplanation={aiExplanation}
            aiLoading={aiLoading}
            aiError={aiError}
            onGenerateAI={handleGenerateAI}
          />
        </section>

        <section
          id="results-metrics"
          className="results-major-section results-metrics-section"
          aria-label={t("renderImage.sectionNavigation.metrics")}
        >
          <section className="results-dashboard-toolbar">
          <div
            className="results-tabs"
            role="tablist"
            aria-label={t(
              "renderImage.categories.aria"
            )}
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
                    {t(
                      `renderImage.categories.${category.id}`
                    )}

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
              {t("renderImage.toolbar.filters")}

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
                {t(
                  "renderImage.toolbar.advancedMetrics"
                )}
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
                {t(
                  "renderImage.summary.eyebrow"
                )}
              </span>

              <h2>
                {t(
                  "renderImage.summary.title"
                )}
              </h2>

              <p>
                {t(
                  "renderImage.summary.description"
                )}
              </p>
            </div>

            {missingPrimaryCount > 0 && (
              <div className="results-availability-note">
                <Layers3 size={16} />

                <span>
                  {missingPrimaryCount === 1
                    ? t(
                        "renderImage.summary.missingPrimary.one",
                        { count: missingPrimaryCount }
                      )
                    : t(
                        "renderImage.summary.missingPrimary.other",
                        { count: missingPrimaryCount }
                      )}
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
                {t(
                  "renderImage.empty.title"
                )}
              </h2>

              <p>
                {t(
                  "renderImage.empty.description"
                )}
              </p>
            </div>
          </section>
        )}
        </section>

        <section
          id="results-reproducibility"
          className="results-major-section results-reproducibility-section"
          aria-label={t("renderImage.sectionNavigation.reproducibility")}
        >
          <ReproducibilityPanel
            codename={codename}
            onContextChange={handleReproducibilityContextChange}
          />
        </section>

        <footer className="results-footer-note">
          <Info size={15} />

          <p>
            {t("renderImage.footer.note")}
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
  const { locale, t } = useI18n();
  const overviewItems =
    buildPedagogyOverviewItems(pedagogy);

  if (overviewItems.length === 0) {
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
            {t(
              "renderImageScientific.pedagogy.eyebrow"
            )}
          </span>

          <h2 id="results-pedagogy-title">
            {t(
              "renderImageScientific.pedagogy.title"
            )}
          </h2>
        </div>

        {deterministic && (
          <span className="results-pedagogy-method">
            <CheckCircle2 size={14} />
            {t(
              "renderImageScientific.pedagogy.deterministic"
            )}
          </span>
        )}
      </div>

      <div className="results-pedagogy-grid">
        {overviewItems.map((item) => (
          <article
            key={item.metric}
            className="results-pedagogy-highlight"
          >
            <div className="results-pedagogy-highlight-top">
              <span>
                {getPedagogyMetricLabel(
                  item.metric,
                  t
                )}
              </span>
            </div>

            <div className="results-pedagogy-highlight-section">
              <strong>
                {t(
                  "renderImageScientific.pedagogy.whatItRepresents"
                )}
              </strong>
              <p>
                {getPedagogyMetricMeaning(
                  item.metric,
                  t
                )}
              </p>
            </div>

            <PedagogyEvidenceDisclosure
              item={item}
              t={t}
              locale={locale}
            />
          </article>
        ))}
      </div>

      <div className="results-pedagogy-note">
        <Info size={14} />

        <span>
          {t(
            "renderImageScientific.pedagogy.disclaimer"
          )}
        </span>
      </div>

      <IndividualAIAnalysisPanel
        explanation={aiExplanation}
        loading={aiLoading}
        errorKey={aiError}
        onGenerate={onGenerateAI}
      />
    </section>
  );
}


function PedagogyEvidenceDisclosure({
  item,
  t,
  locale,
}) {
  const [expanded, setExpanded] =
    useState(false);

  const panelId =
    `pedagogy-evidence-${String(
      item.metric
    ).replace(/[^A-Za-z0-9_-]/g, "-")}`;

  return (
    <div className="results-pedagogy-highlight-section results-pedagogy-disclosure">
      <button
        type="button"
        className="results-pedagogy-disclosure-button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() =>
          setExpanded(
            (current) => !current
          )
        }
      >
        <span className="results-pedagogy-disclosure-copy">
          <strong>
            {t(
              "renderImageScientific.pedagogy.metricHeading"
            )}
          </strong>
          <small>
            {t(
              "renderImageScientific.pedagogy.evidenceDisclosure.count",
              { count: item.messages.length }
            )}
          </small>
        </span>

        <span className="results-pedagogy-disclosure-action">
          {t(
            expanded
              ? "renderImageScientific.pedagogy.evidenceDisclosure.hide"
              : "renderImageScientific.pedagogy.evidenceDisclosure.show"
          )}
          <ChevronDown
            size={15}
            className={expanded ? "is-expanded" : ""}
            aria-hidden="true"
          />
        </span>
      </button>

      {!expanded && (
        <div
          className="results-pedagogy-evidence-chips"
          aria-hidden="true"
        >
          {item.messages.slice(0, 4).map(
            (message, index) => (
              <span
                key={`${message.message_code || message.kind}-${index}`}
              >
                {getPedagogyKindLabel(message.kind, t)}
              </span>
            )
          )}
        </div>
      )}

      <div
        id={panelId}
        className="results-pedagogy-observations"
        hidden={!expanded}
      >
        {item.messages.map(
          (message, index) => (
            <div
              key={`${message.message_code || message.kind}-${index}`}
              className="results-pedagogy-observation"
            >
              <span className="results-pedagogy-kind">
                {getPedagogyKindLabel(message.kind, t)}
              </span>
              <p>
                {formatPedagogyMessage(message, t, locale)}
              </p>
            </div>
          )
        )}
      </div>
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
  const { t } = useI18n();
  const multipleInputSizes =
    inputSizes.length > 1;

  return (
    <section className="results-filters-panel">
      <div className="results-filters-header">
        <div>
          <span className="results-section-kicker">
            {t("renderImage.filters.eyebrow")}
          </span>

          <h2>
            {t("renderImage.filters.title")}
          </h2>

          <p>
            {t("renderImage.filters.description")}
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
          {t("renderImage.filters.reset")}
        </button>
      </div>

      <div className="results-filter-grid">
        <fieldset className="results-filter-group">
          <legend>
            {t("renderImage.filters.aggregation")}
          </legend>

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
              {t("renderImage.filters.mean")}
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
              {t("renderImage.filters.median")}
            </button>
          </div>

          <small>
            {t(
              "renderImage.filters.aggregationHelp"
            )}
          </small>
        </fieldset>

        <fieldset className="results-filter-group">
          <legend>
            {t("renderImage.filters.dispersion")}
          </legend>

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
                ? t(
                    "renderImage.filters.iqrInterval"
                  )
                : t(
                    "renderImage.filters.stddevInterval"
                  )}
            </span>
          </label>

          <small>
            {aggregation === "median"
              ? t(
                  "renderImage.filters.iqrHelp"
                )
              : t(
                  "renderImage.filters.stddevHelp"
                )}
          </small>
        </fieldset>

        <fieldset className="results-filter-group">
          <legend>
            {t("renderImage.filters.horizontalScale")}
          </legend>

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
              {t("renderImage.filters.linear")}
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
            {t(
              "renderImage.filters.horizontalScaleHelp"
            )}
          </small>
        </fieldset>

        <fieldset className="results-filter-group">
          <legend>
            {t("renderImage.filters.inputRange")}
          </legend>

          <div className="results-range-controls">
            <label>
              <span>
                {t("renderImage.filters.from")}
              </span>

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
                  {t("renderImage.filters.minimum")}
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
              <span>
                {t("renderImage.filters.to")}
              </span>

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
                  {t("renderImage.filters.maximum")}
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
              ? t(
                  "renderImage.filters.rangeHelp"
                )
              : t(
                  "renderImage.filters.singleInputHelp"
                )}
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
  const { t } = useI18n();
  const aggregationLabel =
    aggregation === "median"
      ? t("renderImage.filters.median").toLowerCase()
      : t("renderImage.filters.mean").toLowerCase();

  const rangeLabel =
    formatRangeLabel(
      effectiveRange,
      t
    );

  const availableItems =
    items.filter(
      (item) => item.available
    );
  const availableCount =
    availableItems.length;
  const totalCount =
    items.length;
  const hasUnavailable =
    availableCount < totalCount;

  return (
    <section
      className="results-kpi-section"
      aria-labelledby="results-kpi-title"
    >
      <div className="results-kpi-heading">
        <div>
          <span className="results-section-kicker">
            {t("renderImage.kpiOverview.eyebrow")}
          </span>

          <h2 id="results-kpi-title">
            {t("renderImage.kpiOverview.title")}
          </h2>
        </div>

        <div className="results-kpi-heading-meta">
          <p>
            {t(
              "renderImage.kpiOverview.description",
              {
                aggregation: aggregationLabel,
                range: rangeLabel
                  ? ` · ${rangeLabel}`
                  : "",
              }
            )}
          </p>

          {hasUnavailable && (
            <div
              className="results-kpi-availability"
              role="status"
            >
              {t(
                "renderImage.kpiOverview.availabilitySummary",
                {
                  available: availableCount,
                  total: totalCount,
                }
              )}
            </div>
          )}
        </div>
      </div>

      {availableItems.length > 0 && (
        <div className="results-kpi-grid">
          {availableItems.map((item) => (
            <KpiCard
              key={item.metric}
              item={item}
            />
          ))}
        </div>
      )}
    </section>
  );
}


function KpiCard({ item }) {
  const { t } = useI18n();
  const Icon = item.icon;
  const label = t(
    `renderImage.kpis.${item.metric}.label`
  );
  const description = t(
    `renderImage.kpis.${item.metric}.description`
  );

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
          {label}
        </span>
      </div>

      {item.available ? (
        <>
          <div className="results-kpi-value">
            {item.value}
          </div>

          <div className="results-kpi-context">
            <span>
              {t(
                "renderImage.kpiCard.inputSize",
                { inputSize: item.inputSize }
              )}
            </span>

            {item.dispersion && (
              <span>
                {item.dispersion}
              </span>
            )}
          </div>

          <p className="results-kpi-description">
            {description}
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
            {t("renderImage.kpiCard.unavailable")}
          </div>

          <p className="results-kpi-description">
            {t(
              "renderImage.kpiCard.noValidData"
            )}
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
  const { t } = useI18n();
  const taskLabel =
    getTaskLabel(
      statusData?.task_type,
      t
    );

  const inputLabel =
    statusData?.input_size ??
    "—";

  const samplesLabel =
    statusData?.samples ??
    "—";
  const courseLabel = courseContext
    ? formatCourseLabel(
        courseContext.course,
        t("renderImage.metadata.noCourse")
      )
    : null;
  const academicPeriod = courseContext
    ? formatAcademicPeriod(
        courseContext.course,
        {
          periodLabel: t(
            "renderImage.metadata.period"
          ),
        }
      )
    : null;
  const courseDescription = courseContext
    ? academicPeriod ||
      t(
        "renderImage.metadata.personalAnalysis"
      )
    : null;

  return (
    <div className="results-metadata-grid">
      <MetadataCard
        label={t("renderImage.metadata.benchmark")}
        value={taskLabel}
        description={t(
          "renderImage.metadata.benchmarkDescription"
        )}
      />

      <MetadataCard
        label={t("renderImage.metadata.maxSize")}
        value={inputLabel}
        description={t(
          "renderImage.metadata.maxSizeDescription"
        )}
      />

      <MetadataCard
        label={t("renderImage.metadata.repetitions")}
        value={samplesLabel}
        description={t(
          "renderImage.metadata.repetitionsDescription"
        )}
      />

      <MetadataCard
        label={t("renderImage.metadata.environment")}
        value={t("renderImage.metadata.managed")}
        description={t(
          "renderImage.metadata.environmentDescription"
        )}
      />

      {courseContext && (
        <MetadataCard
          label={t("renderImage.metadata.course")}
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
  const { t } = useI18n();
  const presentation =
    getMetricPresentation(
      metric,
      t
    );

  const description =
    METRIC_DESCRIPTIONS[metric]
      ? localizedText(
          t,
          `renderImageScientific.metrics.${metric}.description`,
          METRIC_DESCRIPTIONS[metric]
        )
      : t(
          "renderImageScientific.metricCard.genericDescription"
        );

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
          aria-label={t(
            "renderImageScientific.metricCard.explainAria",
            { metric: presentation.label }
          )}
        >
          <Info size={16} />
        </button>
      </header>

      {expanded && (
        <div className="results-metric-explanation">
          <div className="results-metric-explanation-block">
            <strong>
              {t(
                "renderImageScientific.metricCard.represents"
              )}
            </strong>
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
                inputRange,
                t
              )
            : metricData
            ? buildAvailabilityFooter(
                metricData,
                t
              )
            : file
            ? t(
                "renderImageScientific.metricCard.legacyCompatibility"
              )
            : t(
                "renderImageScientific.metricCard.noVisualizationData"
              )}
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
  const { t } = useI18n();
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
        {t(
          "renderImageScientific.pedagogy.metricHeading"
        )}
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
                  message.kind,
                  t
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
  const { locale, t } = useI18n();
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
        point.source ||
        t(
          "renderImageScientific.chart.executionSeries"
        );

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

        const centralLabel =
          aggregation === "median"
            ? t(
                "renderImageScientific.chart.median"
              )
            : t(
                "renderImageScientific.chart.mean"
              );

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
                ],
                locale
              ),
              formatMetricValue(
                metric,
                point.mean,
                locale
              ),
              formatMetricValue(
                metric,
                point.median,
                locale
              ),
              formatMetricValue(
                metric,
                point.stddev || 0,
                locale
              ),
              formatMetricValue(
                metric,
                point.q1,
                locale
              ),
              formatMetricValue(
                metric,
                point.q3,
                locale
              ),
              Number(point.samples_valid),
              Number(point.samples_total),
              Number(
                point.iqr_outliers_detected || 0
              ),
            ]
          ),
          hovertemplate:
            `<b>${t(
              "renderImageScientific.chart.inputSize"
            )} %{x}</b><br>` +
            `${centralLabel}: %{customdata[0]}<br>` +
            `${t(
              "renderImageScientific.chart.mean"
            )}: %{customdata[1]}<br>` +
            `${t(
              "renderImageScientific.chart.median"
            )}: %{customdata[2]}<br>` +
            `${t(
              "renderImageScientific.chart.stddev"
            )}: %{customdata[3]}<br>` +
            "Q1: %{customdata[4]}<br>" +
            "Q3: %{customdata[5]}<br>" +
            `${t(
              "renderImageScientific.chart.numericSamples"
            )}: %{customdata[6]}/%{customdata[7]}<br>` +
            `${t(
              "renderImageScientific.chart.iqrOutliers"
            )}: %{customdata[8]}` +
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
                text: t(
                  "renderImageScientific.chart.inputSize"
                ),
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
  const { t } = useI18n();

  return (
    <div className="results-chart-frame">
      <iframe
        src={`${filesBaseURL}${file}`}
        title={t(
          "renderImageScientific.chart.legacyFrameTitle",
          { title }
        )}
        loading="lazy"
      />
    </div>
  );
}


function PartialAvailabilityNotice({
  metricData,
}) {
  const { t } = useI18n();
  const availability =
    metricData?.availability || {};

  return (
    <div className="results-partial-notice">
      <Info size={15} />

      <span>
        {t(
          "renderImageScientific.availability.partial",
          {
            numeric:
              availability.numeric || 0,
            total:
              availability.rows_total || 0,
          }
        )}
      </span>
    </div>
  );
}


function MetricAvailabilityState({
  metricData,
  measurementContext,
  presentation,
}) {
  const { t } = useI18n();
  const statusInfo =
    getMetricAvailabilityPresentation(
      metricData?.status,
      t
    );

  const summary =
    buildMetricAvailabilitySummary(
      metricData,
      t
    );

  const hardwareExplanation =
    buildHardwareAvailabilityExplanation(
      metricData,
      t
    );

  const environmentSummary =
    metricData?.hardware_context
      ? buildMeasurementContextSummary(
          measurementContext,
          t
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
              {t(
                "renderImageScientific.availability.measurementContext"
              )}
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
          {t(
            "renderImageScientific.availability.notZero"
          )}
        </small>
      </div>
    </div>
  );
}


function buildHardwareAvailabilityExplanation(
  metricData,
  t = null
) {
  const context =
    metricData?.hardware_context;

  if (!context) {
    return "";
  }

  const event =
    context.event ||
    localizedText(
      t,
      "renderImageScientific.hardware.requestedEvent",
      "el evento solicitado"
    );

  const state =
    context.probe_state;

  if (state === "permission_denied") {
    return localizedText(
      t,
      "renderImageScientific.hardware.permissionDenied",
      `El evento ${event} no pudo medirse porque el proceso de medición no tiene permisos suficientes para accederlo.`,
      { event }
    );
  }

  if (state === "event_not_exposed") {
    return localizedText(
      t,
      "renderImageScientific.hardware.eventNotExposed",
      `El backend perf de este entorno no expone ${event}.`,
      { event }
    );
  }

  if (state === "not_supported") {
    return localizedText(
      t,
      "renderImageScientific.hardware.notSupported",
      `El evento ${event} aparece expuesto por perf, pero la prueba de disponibilidad no pudo medirlo en este entorno.`,
      { event }
    );
  }

  if (state === "not_counted") {
    return localizedText(
      t,
      "renderImageScientific.hardware.notCounted",
      `El evento ${event} fue reconocido, pero la prueba de disponibilidad no produjo un conteo válido.`,
      { event }
    );
  }

  if (state === "backend_error") {
    return localizedText(
      t,
      "renderImageScientific.hardware.backendError",
      `No fue posible verificar ${event} por un problema del backend de medición.`,
      { event }
    );
  }

  if (state === "no_numeric_sample") {
    return localizedText(
      t,
      "renderImageScientific.hardware.noNumericSample",
      `La prueba de ${event} no produjo una muestra numérica válida.`,
      { event }
    );
  }

  if (state === "numeric") {
    return localizedText(
      t,
      "renderImageScientific.hardware.numeric",
      `La prueba de ${event} produjo una muestra numérica válida.`,
      { event }
    );
  }

  if (context.event_exposed === false) {
    return localizedText(
      t,
      "renderImageScientific.hardware.notExposedGeneric",
      `El backend de medición no expone ${event} en este entorno.`,
      { event }
    );
  }

  return "";
}


function buildMeasurementContextSummary(
  measurementContext,
  t = null
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
      localizedText(
        t,
        "renderImageScientific.hardware.requestedScope",
        `scope solicitado: ${backend.requested_scope}`,
        { scope: backend.requested_scope }
      )
    );
  }

  return parts.length > 0
    ? localizedText(
        t,
        "renderImageScientific.hardware.observedEnvironment",
        `Entorno observado: ${parts.join(" · ")}.`,
        { details: parts.join(" · ") }
      )
    : "";
}

function getMetricAvailabilityPresentation(
  status,
  t = null
) {
  const map = {
    permission_denied: {
      label: localizedText(
        t,
        "renderImageScientific.availability.statuses.permissionDenied.label",
        "Permiso insuficiente"
      ),
      tone: "permission-denied",
      description: localizedText(
        t,
        "renderImageScientific.availability.statuses.permissionDenied.description",
        "El proceso de medición no tuvo permisos suficientes para acceder al evento de rendimiento solicitado."
      ),
    },
    unsupported: {
      label: localizedText(
        t,
        "renderImageScientific.availability.statuses.unsupported.label",
        "No disponible"
      ),
      tone: "unsupported",
      description: localizedText(
        t,
        "renderImageScientific.availability.statuses.unsupported.description",
        "La medición no produjo muestras numéricas válidas en el entorno utilizado para esta ejecución."
      ),
    },
    not_counted: {
      label: localizedText(
        t,
        "renderImageScientific.availability.statuses.notCounted.label",
        "No contabilizada"
      ),
      tone: "not-counted",
      description: localizedText(
        t,
        "renderImageScientific.availability.statuses.notCounted.description",
        "El evento fue reconocido, pero perf no pudo obtener un conteo válido durante esta ejecución."
      ),
    },
    no_data: {
      label: localizedText(
        t,
        "renderImageScientific.availability.statuses.noData.label",
        "Sin datos válidos"
      ),
      tone: "no-data",
      description: localizedText(
        t,
        "renderImageScientific.availability.statuses.noData.description",
        "No se obtuvieron observaciones numéricas suficientes para representar esta métrica."
      ),
    },
  };

  return (
    map[status] || {
      label: localizedText(
        t,
        "renderImageScientific.availability.statuses.default.label",
        "No disponible"
      ),
      tone: "no-data",
      description: localizedText(
        t,
        "renderImageScientific.availability.statuses.default.description",
        "Esta métrica no dispone de datos representables en la ejecución actual."
      ),
    }
  );
}


function buildMetricAvailabilitySummary(
  metricData,
  t = null
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

  if (probeState === "permission_denied") {
    return localizedText(
      t,
      "renderImageScientific.availability.summary.permissionDenied",
      `${total}/${total} muestras no pudieron acceder al evento por permisos insuficientes del proceso de medición.`,
      { total }
    );
  }

  if (probeState === "event_not_exposed") {
    return localizedText(
      t,
      "renderImageScientific.availability.summary.eventNotExposed",
      `${total}/${total} muestras no dispusieron de este evento en el backend de medición.`,
      { total }
    );
  }

  if (probeState === "not_supported") {
    return localizedText(
      t,
      "renderImageScientific.availability.summary.notSupported",
      `${total}/${total} muestras no pudieron medir este evento en el entorno observado.`,
      { total }
    );
  }

  if (probeState === "not_counted") {
    return localizedText(
      t,
      "renderImageScientific.availability.summary.notCounted",
      `${total}/${total} muestras no produjeron un conteo válido para este evento.`,
      { total }
    );
  }

  if (probeState === "backend_error") {
    return localizedText(
      t,
      "renderImageScientific.availability.summary.backendError",
      `No fue posible verificar la disponibilidad del evento para las ${total} muestras por un problema del backend de medición.`,
      { total }
    );
  }

  if (probeState === "no_numeric_sample") {
    return localizedText(
      t,
      "renderImageScientific.availability.summary.noNumericSample",
      `${total}/${total} muestras quedaron sin una observación numérica válida para este evento.`,
      { total }
    );
  }

  if (
    metricData?.status === "permission_denied"
  ) {
    return localizedText(
      t,
      "renderImageScientific.availability.summary.permissionDeniedRows",
      `${availability.permission_denied || 0}/${total} muestras no pudieron acceder al evento por permisos insuficientes.`,
      {
        count: availability.permission_denied || 0,
        total,
      }
    );
  }

  if (
    metricData?.status === "unsupported"
  ) {
    return localizedText(
      t,
      "renderImageScientific.availability.summary.unsupported",
      `${availability.unsupported || 0}/${total} muestras reportaron el evento como no disponible.`,
      {
        count: availability.unsupported || 0,
        total,
      }
    );
  }

  if (
    metricData?.status === "not_counted"
  ) {
    return localizedText(
      t,
      "renderImageScientific.availability.summary.notCountedRows",
      `${availability.not_counted || 0}/${total} muestras no pudieron ser contabilizadas.`,
      {
        count: availability.not_counted || 0,
        total,
      }
    );
  }

  if (
    metricData?.status === "no_data"
  ) {
    return localizedText(
      t,
      "renderImageScientific.availability.summary.noData",
      `${availability.missing || 0}/${total} muestras sin un valor numérico válido.`,
      {
        count: availability.missing || 0,
        total,
      }
    );
  }

  return "";
}


function buildAvailabilityFooter(
  metricData,
  t = null
) {
  const statusInfo =
    getMetricAvailabilityPresentation(
      metricData?.status,
      t
    );

  const provenance =
    metricData?.availability
      ?.provenance;

  const provenanceFallback = {
    metric_availability_sidecar:
      "procedencia preservada",
    raw_csv_fallback:
      "procedencia recuperada",
    combined_results:
      "CombinedResults",
  }[provenance];

  const provenanceLabel =
    provenance === "combined_results"
      ? provenanceFallback
      : provenanceFallback
      ? localizedText(
          t,
          `renderImageScientific.availability.provenance.${provenance}`,
          provenanceFallback
        )
      : "";

  return provenanceLabel
    ? `${statusInfo.label} · ${provenanceLabel}`
    : statusInfo.label;
}


function MetricUnavailableState({
  title,
}) {
  const { t } = useI18n();

  return (
    <div className="results-native-chart-state">
      <BarChart3 size={22} />

      <div>
        <strong>
          {t(
            "renderImageScientific.availability.metricUnavailableTitle",
            { title }
          )}
        </strong>

        <p>
          {t(
            "renderImageScientific.availability.metricUnavailableDescription"
          )}
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
  value,
  locale = "es-CL"
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
      return `${formatFixed(
        numeric,
        2,
        locale
      )} %`;

    case "milliseconds":
      return `${formatAdaptive(
        numeric,
        locale
      )} ms`;

    case "ratio":
      return formatFixed(
        numeric,
        3,
        locale
      );

    case "perMillion":
      return `${formatAdaptive(
        numeric,
        locale
      )} / M instr.`;

    case "energy":
      return `${formatAdaptive(
        numeric,
        locale
      )} J`;

    case "count":
      return formatCompactCount(
        numeric,
        locale
      );

    default:
      return formatAdaptive(
        numeric,
        locale
      );
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
  metric,
  t = null
) {
  const fallback =
    METRIC_PRESENTATION[metric];

  if (!fallback) {
    const humanized =
      humanizeMetric(metric);

    return {
      label: humanized,
      eyebrow: localizedText(
        t,
        "renderImageScientific.metricCard.genericMetric",
        "Métrica"
      ),
      axisTitle: humanized,
      displayKind: "number",
    };
  }

  if (typeof t !== "function") {
    return fallback;
  }

  return {
    ...fallback,
    label: localizedText(
      t,
      `renderImageScientific.metrics.${metric}.label`,
      fallback.label
    ),
    eyebrow: localizedText(
      t,
      `renderImageScientific.metrics.${metric}.eyebrow`,
      fallback.eyebrow
    ),
    axisTitle: localizedText(
      t,
      `renderImageScientific.metrics.${metric}.axisTitle`,
      fallback.axisTitle
    ),
  };
}


function formatCompactCount(
  value,
  locale = "es-CL"
) {
  const absolute =
    Math.abs(value);

  if (absolute < 1000) {
    return new Intl.NumberFormat(
      locale,
      {
        maximumFractionDigits: 2,
      }
    ).format(value);
  }

  return new Intl.NumberFormat(
    locale,
    {
      notation: "compact",
      maximumFractionDigits: 3,
    }
  ).format(value);
}


function formatAdaptive(
  value,
  locale = "es-CL"
) {
  const absolute =
    Math.abs(value);

  if (
    absolute === 0 ||
    absolute >= 100
  ) {
    return formatFixed(
      value,
      2,
      locale
    );
  }

  if (absolute >= 1) {
    return formatFixed(
      value,
      3,
      locale
    );
  }

  return formatFixed(
    value,
    4,
    locale
  );
}


function formatFixed(
  value,
  decimals,
  locale = "es-CL"
) {
  return new Intl.NumberFormat(
    locale,
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
  inputRange,
  t
) {
  if (
    !inputRange ||
    !inputRange.isFiltered
  ) {
    return "";
  }

  return typeof t === "function"
    ? t(
        "renderImage.common.range",
        {
          min: inputRange.min,
          max: inputRange.max,
        }
      )
    : `rango ${inputRange.min}–${inputRange.max}`;
}


function buildChartFooterText(
  aggregation,
  showDispersion,
  xScale,
  inputRange,
  t = null
) {
  const parts = [
    localizedText(
      t,
      "renderImageScientific.footer.apiData",
      "Datos API"
    ),
    aggregation === "median"
      ? localizedText(
          t,
          "renderImageScientific.footer.median",
          "mediana"
        )
      : localizedText(
          t,
          "renderImageScientific.footer.mean",
          "media"
        ),
  ];

  if (showDispersion) {
    parts.push(
      aggregation === "median"
        ? "Q1–Q3"
        : localizedText(
            t,
            "renderImageScientific.footer.stddev",
            "± desviación estándar"
          )
    );
  }

  if (xScale === "log") {
    parts.push(
      localizedText(
        t,
        "renderImageScientific.footer.logScale",
        "escala log X"
      )
    );
  }

  if (
    inputRange &&
    inputRange.isFiltered
  ) {
    parts.push(
      localizedText(
        t,
        "renderImageScientific.footer.range",
        `rango ${inputRange.min}–${inputRange.max}`,
        {
          min: inputRange.min,
          max: inputRange.max,
        }
      )
    );
  }

  return parts.join(" · ");
}


function buildKpiItems(
  resultsData,
  aggregation,
  showDispersion,
  inputRange,
  locale = "es-CL",
  t = null
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
        inputRange,
        locale,
        t
      )
  );
}


function buildKpiItem(
  definition,
  metricData,
  aggregation,
  showDispersion,
  inputRange,
  locale = "es-CL",
  t = null
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
            ],
            locale
          ),
        inputSize:
          maxInputSize,
        dispersion:
          showDispersion
            ? aggregation === "median"
              ? formatKpiIqr(
                  metric,
                  point.q1,
                  point.q3,
                  locale
                )
              : formatKpiDispersion(
                  metric,
                  point.stddev,
                  locale
                )
            : "",
        sourceSummary:
          buildSingleSourceSummary(
            point,
            t
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
          min,
          locale
        )} – ${formatKpiValue(
          metric,
          max,
          locale
        )}`,
      inputSize:
        maxInputSize,
      dispersion: "",
      sourceSummary:
        typeof t === "function"
          ? t(
              values.length === 1
                ? "renderImage.kpiCard.implementations.one"
                : "renderImage.kpiCard.implementations.other",
              { count: values.length }
            )
          : `${values.length} implementaciones`,
    }
  );
}


function formatKpiValue(
  metric,
  value,
  locale = "es-CL"
) {
  const numeric =
    Number(value);

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  if (metric === "Instructions") {
    return formatScientificCount(
      numeric,
      locale
    );
  }

  return formatMetricValue(
    metric,
    numeric,
    locale
  );
}


function formatKpiIqr(
  metric,
  q1,
  q3,
  locale = "es-CL"
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
    lower,
    locale
  )} – ${formatKpiValue(
    metric,
    upper,
    locale
  )}`;
}


function formatKpiDispersion(
  metric,
  stddev,
  locale = "es-CL"
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
      locale,
      {
        maximumFractionDigits: 0,
      }
    ).format(
      Math.round(numeric)
    )} instr.`;
  }

  return `± ${formatMetricValue(
    metric,
    numeric,
    locale
  )}`;
}


function formatScientificCount(
  value,
  locale = "es-CL"
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
      locale,
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
    3,
    locale
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
  point,
  t = null
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
    return typeof t === "function"
      ? t(
          "renderImage.kpiCard.validSamples",
          { valid, total }
        )
      : `${valid}/${total} muestras válidas`;
  }

  return point.source || "";
}


function buildPedagogyOverviewItems(
  pedagogy
) {
  const summary =
    pedagogy?.summary || {};
  const metrics =
    pedagogy?.metrics || {};
  const highlights =
    summary.highlights || [];

  const declared =
    Array.isArray(
      summary.primary_metrics_available
    )
      ? summary.primary_metrics_available
      : [];

  const fallback =
    highlights
      .map((message) => message?.metric)
      .filter(Boolean);

  const metricNames =
    Array.from(
      new Set([
        ...declared,
        ...fallback,
      ])
    ).slice(0, 3);

  return metricNames
    .map((metric) => {
      const metricMessages =
        Array.isArray(
          metrics?.[metric]?.messages
        )
          ? metrics[metric].messages
          : [];

      const fallbackMessages =
        highlights.filter(
          (message) =>
            message?.metric === metric
        );

      return {
        metric,
        messages:
          selectPedagogyMessages(
            metricMessages.length > 0
              ? metricMessages
              : fallbackMessages
          ),
      };
    })
    .filter(
      (item) =>
        item.messages.length > 0
    );
}


function selectPedagogyMessages(
  messages
) {
  const preferredKinds = [
    "snapshot",
    "trend",
    "outliers",
    "coverage",
    "limitation",
    "availability",
    "observed_scaling",
  ];

  const selected = [];

  preferredKinds.forEach((kind) => {
    const message =
      messages.find(
        (candidate) =>
          candidate?.kind === kind
      );

    if (message) {
      selected.push(message);
    }
  });

  return selected.slice(0, 5);
}


function getPedagogyMetricMeaning(
  metric,
  t = null
) {
  const presentation =
    getMetricPresentation(
      metric,
      t
    );

  const description =
    presentation?.description || "";

  if (!description) {
    return localizedText(
      t,
      "renderImageScientific.pedagogy.meaningFallback",
      "Métrica experimental observada durante la ejecución."
    );
  }

  return String(description)
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean)[0];
}


function formatPedagogyMessage(
  message,
  t = null,
  locale = "es-CL"
) {
  if (!message) {
    return "";
  }

  const evidence =
    message.evidence || {};
  const code =
    message.message_code ||
    message.kind;
  const metric =
    message.metric;
  const metricLabel =
    getPedagogyMetricLabel(
      metric,
      t
    );

  const metricValue = (value) =>
    formatKpiValue(
      metric,
      value,
      locale
    );

  const number = (
    value,
    maximumFractionDigits = 3
  ) => {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      return "—";
    }

    return new Intl.NumberFormat(
      locale,
      {
        maximumFractionDigits,
      }
    ).format(numeric);
  };

  const percent = (value) => {
    const numeric = Number(value);

    if (!Number.isFinite(numeric)) {
      return "—";
    }

    return new Intl.NumberFormat(
      locale,
      {
        maximumFractionDigits: 2,
      }
    ).format(numeric * 100) + " %";
  };

  if (code === "snapshot") {
    const parts = [
      t(
        "renderImageScientific.pedagogy.messages.snapshot.base",
        {
          metric: metricLabel,
          inputSize: number(
            evidence.input_size,
            0
          ),
          median: metricValue(
            evidence.median
          ),
        }
      ),
    ];

    if (
      evidence.q1 !== null &&
      evidence.q1 !== undefined &&
      evidence.q3 !== null &&
      evidence.q3 !== undefined
    ) {
      parts.push(
        t(
          "renderImageScientific.pedagogy.messages.snapshot.iqr",
          {
            q1: metricValue(evidence.q1),
            q3: metricValue(evidence.q3),
          }
        )
      );
    }

    if (
      evidence.mean !== null &&
      evidence.mean !== undefined
    ) {
      parts.push(
        t(
          "renderImageScientific.pedagogy.messages.snapshot.mean",
          {
            mean: metricValue(
              evidence.mean
            ),
          }
        )
      );
    }

    if (
      evidence.stddev !== null &&
      evidence.stddev !== undefined
    ) {
      parts.push(
        t(
          "renderImageScientific.pedagogy.messages.snapshot.stddev",
          {
            stddev: metricValue(
              evidence.stddev
            ),
          }
        )
      );
    }

    if (
      evidence.coefficient_of_variation !== null &&
      evidence.coefficient_of_variation !== undefined
    ) {
      parts.push(
        t(
          "renderImageScientific.pedagogy.messages.snapshot.cv",
          {
            cv: percent(
              evidence.coefficient_of_variation
            ),
          }
        )
      );
    }

    return parts.join(" ");
  }

  if (code === "trend") {
    const first =
      evidence.first || {};
    const last =
      evidence.last || {};
    const parts = [
      t(
        "renderImageScientific.pedagogy.messages.trend.base",
        {
          metric: metricLabel,
          firstInput: number(
            first.input_size,
            0
          ),
          lastInput: number(
            last.input_size,
            0
          ),
          firstValue: metricValue(
            first.median
          ),
          lastValue: metricValue(
            last.median
          ),
        }
      ),
    ];

    const relative =
      Number(
        evidence.relative_change
      );

    if (Number.isFinite(relative)) {
      const key =
        relative > 0
          ? "increase"
          : relative < 0
          ? "decrease"
          : "noChange";

      parts.push(
        t(
          `renderImageScientific.pedagogy.messages.trend.${key}`,
          {
            change: percent(
              Math.abs(relative)
            ),
          }
        )
      );
    }

    const pairwise =
      evidence.pairwise || {};
    const comparisons =
      Number(
        pairwise.comparisons
      );

    if (
      Number.isFinite(comparisons) &&
      comparisons > 0
    ) {
      parts.push(
        t(
          "renderImageScientific.pedagogy.messages.trend.pairwise",
          {
            comparisons,
            increasing:
              pairwise.increasing || 0,
            decreasing:
              pairwise.decreasing || 0,
            unchanged:
              pairwise.unchanged || 0,
          }
        )
      );
    }

    return parts.join(" ");
  }

  if (code === "observed_scaling") {
    return t(
      "renderImageScientific.pedagogy.messages.observedScaling",
      {
        metric: metricLabel,
        exponent: number(
          evidence.exponent,
          3
        ),
        rSquared: number(
          evidence.r_squared,
          3
        ),
      }
    );
  }

  if (code === "outliers_detected") {
    const parts = [
      t(
        "renderImageScientific.pedagogy.messages.outliers.detected",
        {
          detected:
            evidence.iqr_outliers_detected || 0,
          evaluated:
            evidence.samples_evaluated || 0,
          rate: percent(
            evidence.iqr_outlier_rate || 0
          ),
        }
      ),
    ];

    if (Number(evidence.groups_total) > 0) {
      parts.push(
        t(
          "renderImageScientific.pedagogy.messages.outliers.groups",
          {
            diagnostic:
              evidence.iqr_diagnostic_groups || 0,
            total:
              evidence.groups_total || 0,
          }
        )
      );
    }

    return parts.join(" ");
  }

  if (code === "outliers_insufficient") {
    return t(
      "renderImageScientific.pedagogy.messages.outliers.insufficient"
    );
  }

  if (code === "single_input_limitation") {
    return t(
      "renderImageScientific.pedagogy.messages.singleInputLimitation"
    );
  }

  if (code === "partial_coverage") {
    return t(
      "renderImageScientific.pedagogy.messages.partialCoverage",
      {
        numeric:
          evidence.numeric_rows || 0,
        total:
          evidence.rows_total || 0,
      }
    );
  }

  if (code === "availability_permission_denied") {
    return t(
      "renderImageScientific.pedagogy.messages.availability.permissionDenied"
    );
  }

  if (code === "availability_unsupported") {
    return t(
      "renderImageScientific.pedagogy.messages.availability.unsupported"
    );
  }

  if (code === "availability_not_counted") {
    return t(
      "renderImageScientific.pedagogy.messages.availability.notCounted"
    );
  }

  if (code === "availability_no_numeric") {
    return t(
      "renderImageScientific.pedagogy.messages.availability.noNumeric"
    );
  }

  return message.text || t(
    "renderImageScientific.pedagogy.messages.fallback"
  );
}


function getPedagogyMetricLabel(
  metric,
  t = null
) {
  const presentation =
    getMetricPresentation(
      metric,
      t
    );

  return (
    presentation?.label ||
    metric ||
    localizedText(
      t,
      "renderImageScientific.metricCard.genericMetric",
      "Métrica"
    )
  );
}


function getPedagogyKindLabel(
  kind,
  t = null
) {
  const labels = {
    snapshot: [
      "renderImageScientific.pedagogy.kinds.snapshot",
      "Valor observado",
    ],
    trend: [
      "renderImageScientific.pedagogy.kinds.trend",
      "Tendencia observada",
    ],
    observed_scaling: [
      "renderImageScientific.pedagogy.kinds.observedScaling",
      "Escalamiento observado",
    ],
    outliers: [
      "renderImageScientific.pedagogy.kinds.outliers",
      "Variabilidad",
    ],
    coverage: [
      "renderImageScientific.pedagogy.kinds.coverage",
      "Cobertura",
    ],
    limitation: [
      "renderImageScientific.pedagogy.kinds.limitation",
      "Alcance",
    ],
    availability: [
      "renderImageScientific.pedagogy.kinds.availability",
      "Disponibilidad",
    ],
  };

  const entry = labels[kind];

  return entry
    ? localizedText(
        t,
        entry[0],
        entry[1]
      )
    : localizedText(
        t,
        "renderImageScientific.pedagogy.kinds.analysis",
        "Análisis"
      );
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


function getTaskLabel(
  taskType,
  t = null
) {
  const task =
    String(taskType || "")
      .toUpperCase();

  if (task === "LCS") {
    return typeof t === "function"
      ? t("renderImage.metadata.tasks.lcs")
      : "Entrada de texto";
  }

  if (
    task === "CAMM" ||
    task === "CAMMR" ||
    task === "CAMMS" ||
    task === "CAMMSO"
  ) {
    return typeof t === "function"
      ? t("renderImage.metadata.tasks.numeric")
      : "Datos numéricos";
  }

  if (task === "SIZE") {
    return typeof t === "function"
      ? t("renderImage.metadata.tasks.size")
      : "Tamaño parametrizado";
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
