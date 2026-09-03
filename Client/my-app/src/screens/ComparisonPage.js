import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import Plot from "react-plotly.js";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  History,
  Info,
  Plus,
  X,
  XCircle,
} from "lucide-react";

import { serverURL } from "../common/Constants";
import {
  isAdminUser,
  isTeacherUser,
} from "../common/userAccessModel";
import AcademicBreadcrumbs from "../components/AcademicBreadcrumbs";
import InlineState from "../components/InlineState";
import { useI18n } from "../i18n";
import ComparisonSectionNav from "./components/ComparisonSectionNav";
import ComparisonSummaryCard from "./components/ComparisonSummaryCard";
import ComparisonMetricCard from "./components/ComparisonMetricCard";
import ComparisonFiltersPanel from "./components/ComparisonFiltersPanel";
import ComparisonPedagogyPanel from "./components/ComparisonPedagogyPanel";
import ComparisonAIAnalysisPanel from "./components/ComparisonAIAnalysisPanel";
import ComparisonAuditPanel from "./components/ComparisonAuditPanel";
import {
  appendHistoricalExecution,
  buildComparisonInterpretation,
  buildComparisonPath,
  buildComparisonSummaryCards,
  buildComparisonMetricCategories,
  buildComparisonTraces,
  buildUniqueSeriesLabels,
  canAddHistoricalCandidate,
  TARGET_METRICS,
  comparisonStatusVariant,
  defaultComparisonMetric,
  filterHistoricalCandidates,
  formatHistoricalCandidateDate,
  historicalCandidatePresentation,
  humanMetricLabel,
  localizedCandidateReason,
  normalizeInputRange,
  orderCommonMetrics,
  parseExecutionQuery,
  removeComparisonExecution,
} from "./comparisonModel";

import "./ComparisonPage.css";

const EMPTY_OBJECT = Object.freeze({});

const STATUS_PRESENTATION = Object.freeze({
  COMPATIBLE: {
    icon: CheckCircle2,
    tone: "success",
    labelKey: "comparisonPage.status.compatible.label",
    textKey: "comparisonPage.status.compatible.text",
  },
  LIMITED_METRIC_COVERAGE: {
    icon: CheckCircle2,
    tone: "info",
    labelKey:
      "comparisonPage.status.limitedCoverage.label",
    textKey:
      "comparisonPage.status.limitedCoverage.text",
  },
  LIMITED: {
    icon: AlertTriangle,
    tone: "warning",
    labelKey: "comparisonPage.status.limited.label",
    textKey: "comparisonPage.status.limited.text",
  },
  INCOMPATIBLE: {
    icon: XCircle,
    tone: "danger",
    labelKey: "comparisonPage.status.incompatible.label",
    textKey: "comparisonPage.status.incompatible.text",
  },
});

const comparisonStatusPresentation = (
  status,
  t
) => {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();
  const base =
    STATUS_PRESENTATION[normalized] ||
    STATUS_PRESENTATION.INCOMPATIBLE;

  return {
    ...base,
    label: t(base.labelKey),
    text: t(base.textKey),
  };
};

const CANDIDATE_STATUS_ICONS = Object.freeze({
  COMPATIBLE: CheckCircle2,
  LIMITED: AlertTriangle,
  INCOMPATIBLE: XCircle,
  UNAVAILABLE: Info,
});

const candidateStatusIcon = (status) =>
  CANDIDATE_STATUS_ICONS[
    String(status || "").trim().toUpperCase()
  ] || Info;

const REQUEST_ERRORS = Object.freeze({
  401: {
    type: "forbidden",
    key: "unauthorized",
  },
  403: {
    type: "forbidden",
    key: "forbidden",
  },
  404: {
    type: "not-found",
    key: "notFound",
  },
  409: {
    type: "unavailable",
    key: "notReady",
  },
  422: {
    type: "error",
    key: "notComparable",
  },
});

const roleFallbackPath = (currentUser) => {
  if (isAdminUser(currentUser)) return "/admin/users";
  if (isTeacherUser(currentUser)) return "/teacher/courses";
  return "/profile";
};

const localizedError = (
  type,
  key,
  t
) => ({
  type,
  title: t(
    `comparisonPage.requestErrors.${key}.title`
  ),
  description: t(
    `comparisonPage.requestErrors.${key}.description`
  ),
});

const requestErrorPresentation = (
  error,
  t
) => {
  if (!error?.response) {
    return localizedError(
      "network",
      "network",
      t
    );
  }

  const configured =
    REQUEST_ERRORS[error.response.status];

  if (configured) {
    return localizedError(
      configured.type,
      configured.key,
      t
    );
  }

  return localizedError(
    "error",
    "generic",
    t
  );
};

const candidateErrorPresentation = (
  error,
  t
) => {
  if (!error?.response) {
    return {
      type: "network",
      title: t(
        "comparisonPage.candidateErrors.network.title"
      ),
      description: t(
        "comparisonPage.candidateErrors.network.description"
      ),
    };
  }

  if ([401, 403].includes(error.response.status)) {
    return {
      type: "forbidden",
      title: t(
        "comparisonPage.candidateErrors.forbidden.title"
      ),
      description: t(
        "comparisonPage.candidateErrors.forbidden.description"
      ),
    };
  }

  return {
    type: "error",
    title: t(
      "comparisonPage.candidateErrors.generic.title"
    ),
    description: t(
      "comparisonPage.candidateErrors.generic.description"
    ),
  };
};

const comparisonContext = (
  executions,
  currentUser,
  t
) => {
  const items = Array.isArray(executions)
    ? executions
    : [];
  const firstId = items[0]?.submissionId;
  const sameSubmission =
    items.length > 0 &&
    firstId !== null &&
    firstId !== undefined &&
    items.every(
      (execution) =>
        String(execution?.submissionId) ===
        String(firstId)
    );

  if (sameSubmission) {
    const title = String(
      items[0]?.submissionTitle || ""
    ).trim();
    const experimentLabel = t(
      "comparisonPage.context.experimentNumber",
      { id: firstId }
    );

    return {
      description: `${experimentLabel}${
        title ? ` · ${title}` : ""
      }`,
      backPath:
        `/submissions/${encodeURIComponent(
          String(firstId)
        )}`,
      backLabel: t(
        "comparisonPage.context.backExperiment"
      ),
      submissionId: firstId,
    };
  }

  return {
    description: t(
      "comparisonPage.context.differentExperiments"
    ),
    backPath: roleFallbackPath(currentUser),
    backLabel: t("comparisonPage.actions.back"),
    submissionId: null,
  };
};

const readPlotThemeTokens = (themeName) => {
  const styles = getComputedStyle(document.documentElement);
  const token = (name, fallback) =>
    styles.getPropertyValue(name).trim() || fallback;

  return {
    text: token("--ps-text", themeName === "dark" ? "#f8fafc" : "#0f172a"),
    textSecondary: token(
      "--ps-text-secondary",
      themeName === "dark" ? "#cbd5e1" : "#475569"
    ),
    divider: token(
      "--ps-divider",
      themeName === "dark"
        ? "rgba(148, 163, 184, 0.18)"
        : "rgba(100, 116, 139, 0.18)"
    ),
    borderStrong: token(
      "--ps-border-strong",
      themeName === "dark" ? "#3b4a60" : "#bcc8d6"
    ),
    surfaceElevated: token(
      "--ps-surface-elevated",
      themeName === "dark" ? "#1e293b" : "#ffffff"
    ),
    fontFamily: token(
      "--ps-font-sans",
      '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    ),
    colorway: [
      token("--ps-primary", "#3b82f6"),
      token("--ps-accent", "#22d3ee"),
      token("--ps-success", "#10b981"),
      token("--ps-warning", "#f59e0b"),
    ],
  };
};

const usePlotTheme = () => {
  const [themeName, setThemeName] = useState(
    () => document.documentElement.getAttribute("data-theme") || "dark"
  );

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver((mutations) => {
      if (
        mutations.some(
          (mutation) =>
            mutation.type === "attributes" &&
            mutation.attributeName === "data-theme"
        )
      ) {
        setThemeName(root.getAttribute("data-theme") || "dark");
      }
    });

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return useMemo(() => readPlotThemeTokens(themeName), [themeName]);
};

const ComparisonPage = ({ currentUser }) => {
  const { locale, t } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryKey = searchParams.toString();
  const query = useMemo(
    () =>
      parseExecutionQuery(
        new URLSearchParams(queryKey),
        t
      ),
    [queryKey, t]
  );
  const [requestVersion, setRequestVersion] = useState(0);
  const [requestState, setRequestState] = useState({
    kind: "loading",
    data: null,
    error: null,
  });
  const [selectedMetric, setSelectedMetric] = useState("");
  const [activeMetricCategory, setActiveMetricCategory] = useState("primary");
  const [aggregation, setAggregation] = useState("median");
  const [showDispersion, setShowDispersion] = useState(true);
  const [xScale, setXScale] = useState("linear");
  const [range, setRange] = useState({ minimum: null, maximum: null });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [candidateRequestVersion, setCandidateRequestVersion] = useState(0);
  const [candidateState, setCandidateState] = useState({
    kind: "idle",
    data: null,
    error: null,
  });
  const [showIncompatible, setShowIncompatible] = useState(false);
  const [breadcrumbContext, setBreadcrumbContext] = useState(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [aiState, setAiState] = useState({
    kind: "idle",
    data: null,
    errorKey: "",
  });
  const aiRequestSerial = useRef(0);
  const plotTheme = usePlotTheme();
  const fallbackPath = roleFallbackPath(currentUser);
  const aiLanguage =
    String(locale || "es")
      .toLowerCase()
      .startsWith("en")
      ? "en"
      : "es";

  useEffect(() => {
    const requestQuery = parseExecutionQuery(new URLSearchParams(queryKey));

    if (!requestQuery.valid) {
      setRequestState({ kind: "invalid", data: null, error: null });
      return undefined;
    }

    let active = true;
    setRequestState({ kind: "loading", data: null, error: null });

    axios
      .post(
        `${serverURL}api/comparisons`,
        { executions: requestQuery.executions },
        { withCredentials: true }
      )
      .then((response) => {
        if (active) {
          setRequestState({
            kind: "success",
            data: response.data || {},
            error: null,
          });
        }
      })
      .catch((error) => {
        if (active) {
          setRequestState({ kind: "error", data: null, error });
        }
      });

    return () => {
      active = false;
    };
  }, [queryKey, requestVersion]);

  useEffect(() => {
    setHistoryOpen(false);
    setCandidateState({ kind: "idle", data: null, error: null });
    setShowIncompatible(false);
  }, [queryKey]);

  useEffect(() => {
    aiRequestSerial.current += 1;
    setAiState({
      kind: "idle",
      data: null,
      errorKey: "",
    });
  }, [queryKey, aiLanguage, requestVersion]);

  useEffect(() => {
    if (!historyOpen) return undefined;

    const requestQuery = parseExecutionQuery(new URLSearchParams(queryKey));
    if (
      !requestQuery.valid ||
      requestQuery.executions.length < 2 ||
      requestQuery.executions.length > 3
    ) {
      return undefined;
    }

    let active = true;
    setCandidateState({ kind: "loading", data: null, error: null });
    axios
      .post(
        `${serverURL}api/comparisons/candidates`,
        { executions: requestQuery.executions },
        { withCredentials: true }
      )
      .then((response) => {
        if (active) {
          setCandidateState({
            kind: "success",
            data: response.data || {},
            error: null,
          });
        }
      })
      .catch((error) => {
        if (active) {
          setCandidateState({ kind: "error", data: null, error });
        }
      });

    return () => {
      active = false;
    };
  }, [historyOpen, candidateRequestVersion, queryKey]);

  const data = requestState.data || EMPTY_OBJECT;
  const compatibility =
    data.compatibility && typeof data.compatibility === "object"
      ? data.compatibility
      : EMPTY_OBJECT;
  const metrics =
    data.metrics && typeof data.metrics === "object"
      ? data.metrics
      : EMPTY_OBJECT;
  const orderedMetrics = useMemo(
    () => orderCommonMetrics(compatibility.commonMetrics, metrics),
    [compatibility.commonMetrics, metrics]
  );
  const metricCategories = useMemo(
    () => buildComparisonMetricCategories(orderedMetrics),
    [orderedMetrics]
  );
  const activeCategory =
    metricCategories.find(
      (category) => category.id === activeMetricCategory
    ) ||
    metricCategories[0] ||
    null;
  const visibleCategoryMetrics =
    activeCategory?.metrics || [];

  useEffect(() => {
    if (
      metricCategories.length > 0 &&
      !metricCategories.some(
        (category) => category.id === activeMetricCategory
      )
    ) {
      setActiveMetricCategory(metricCategories[0].id);
    }
  }, [metricCategories, activeMetricCategory]);

  const fallbackMetric = defaultComparisonMetric(
    compatibility.commonMetrics,
    metrics
  );
  const activeMetric = orderedMetrics.includes(selectedMetric)
    ? selectedMetric
    : fallbackMetric;
  const metricData = metrics[activeMetric] || null;
  const normalizedRange = normalizeInputRange(
    compatibility.commonInputSizes,
    range.minimum,
    range.maximum
  );
  const canUseLogScale =
    normalizedRange.domain.length > 0 &&
    normalizedRange.domain.every(
      (value) => value > 0
    );
  const rangeIsActive =
    normalizedRange.domain.length > 0 &&
    (
      normalizedRange.minimum !== normalizedRange.domain[0] ||
      normalizedRange.maximum !==
        normalizedRange.domain[normalizedRange.domain.length - 1]
    );
  const activeFilterCount = [
    aggregation !== "median",
    showDispersion !== true,
    xScale !== "linear",
    rangeIsActive,
  ].filter(Boolean).length;

  useEffect(() => {
    if (xScale === "log" && !canUseLogScale) {
      setXScale("linear");
    }
  }, [xScale, canUseLogScale]);

  const resetComparisonFilters = () => {
    setAggregation("median");
    setShowDispersion(true);
    setXScale("linear");
    setRange({
      minimum: null,
      maximum: null,
    });
  };
  const traces = buildComparisonTraces({
    metricData,
    aggregation,
    showDispersion,
    minimum: normalizedRange.minimum,
    maximum: normalizedRange.maximum,
    t,
  });
  const hasChartPoints = traces.some(
    (trace) => trace.y.length > 0
  );
  const status = String(
    compatibility.status || ""
  ).toUpperCase();
  const statusVariant =
    comparisonStatusVariant(
      compatibility
    );
  const statusPresentation =
    comparisonStatusPresentation(
      statusVariant,
      t
    );
  const StatusIcon = statusPresentation.icon;

  useEffect(() => {
    if (
      ["COMPATIBLE", "LIMITED", "INCOMPATIBLE"].includes(
        status
      )
    ) {
      setAuditOpen(
        status === "INCOMPATIBLE" ||
          (
            status === "LIMITED" &&
            statusVariant !==
              "LIMITED_METRIC_COVERAGE"
          )
      );
    }
  }, [
    status,
    statusVariant,
    queryKey,
  ]);

  const canRenderCharts = [
    "COMPATIBLE",
    "LIMITED",
  ].includes(status);
  const executions = Array.isArray(data.executions)
    ? data.executions
    : [];
  const executionLabels =
    buildUniqueSeriesLabels(executions, t);
  const context = comparisonContext(
    executions,
    currentUser,
    t
  );

  useEffect(() => {
    let active = true;
    setBreadcrumbContext(null);

    if (!context.submissionId) {
      return () => {
        active = false;
      };
    }

    axios
      .get(
        `${serverURL}api/submissions/${encodeURIComponent(
          String(context.submissionId)
        )}`,
        { withCredentials: true }
      )
      .then((response) => {
        if (!active) return;
        const submission = response.data?.submission || null;
        if (!submission) return;

        setBreadcrumbContext({
          course: submission.course || null,
          courseId:
            submission.courseId ?? submission.course?.id ?? null,
          isOwner: Boolean(
            response.data?.permissions?.canViewPrivateMetadata ||
              response.data?.permissions?.canEditMetadata
          ),
        });
      })
      .catch(() => {
        if (active) setBreadcrumbContext(null);
      });

    return () => {
      active = false;
    };
  }, [context.submissionId]);
  const structuredPedagogy =
    data?.pedagogy?.generation
      ?.presentation_contract ===
      "language-neutral-comparison-evidence-v1" &&
    data?.pedagogy?.metrics &&
    typeof data.pedagogy.metrics === "object" &&
    Object.keys(data.pedagogy.metrics).length > 0
      ? data.pedagogy
      : null;
  const interpretationMessages =
    structuredPedagogy
      ? []
      : buildComparisonInterpretation({
          compatibility,
          selectedMetric: activeMetric,
          metricData,
          aggregation,
          showDispersion,
          t,
        });
  const canBrowseHistorical =
    ["COMPATIBLE", "LIMITED"].includes(status) &&
    query.executions.length >= 2 &&
    query.executions.length <= 3;
  const candidateItems = Array.isArray(candidateState.data?.items)
    ? candidateState.data.items
    : [];
  const visibleCandidates = filterHistoricalCandidates(
    candidateItems,
    showIncompatible
  );
  const hasNonSelectableCandidates = candidateItems.some(
    (item) =>
      !["COMPATIBLE", "LIMITED"].includes(
        String(item?.status || "").toUpperCase()
      )
  );
  const summaryCards =
    buildComparisonSummaryCards(
      metrics,
      compatibility
    );
  const summaryAvailableCount =
    summaryCards.filter(
      (card) => card.available
    ).length;

  const aiAvailable =
    canRenderCharts &&
    orderedMetrics.length > 0;

  const aiUnavailableKind =
    status === "INCOMPATIBLE"
      ? "incompatible"
      : aiAvailable
        ? ""
        : "noEvidence";

  const handleGenerateComparisonAI = async () => {
    if (!aiAvailable || aiState.kind === "loading") return;

    const previous = aiState.data;
    const serial = aiRequestSerial.current + 1;
    aiRequestSerial.current = serial;

    setAiState({
      kind: "loading",
      data: previous,
      errorKey: "",
    });

    try {
      const response = await axios.post(
        `${serverURL}api/comparisons/ai-explanation`,
        {
          executions: query.executions,
          language: aiLanguage,
          force: Boolean(previous),
        },
        { withCredentials: true }
      );

      if (aiRequestSerial.current !== serial) {
        return;
      }

      setAiState({
        kind: "success",
        data: response.data || {},
        errorKey: "",
      });
    } catch (error) {
      if (aiRequestSerial.current !== serial) {
        return;
      }

      const code = error?.response?.data?.error?.code;
      const statusCode = error?.response?.status;

      const byCode = {
        AI_NOT_CONFIGURED:
          "comparisonPage.ai.errors.notConfigured",
        AI_OUTPUT_REJECTED:
          "comparisonPage.ai.errors.outputRejected",
        AI_PROVIDER_ERROR:
          "comparisonPage.ai.errors.provider",
        AI_PROVIDER_TIMEOUT:
          "comparisonPage.ai.errors.timeout",
        INVALID_AI_LANGUAGE:
          "comparisonPage.ai.errors.invalidLanguage",
        COMPARISON_AI_UNAVAILABLE:
          "comparisonPage.ai.errors.unavailable",
      };

      let errorKey =
        byCode[code] ||
        "comparisonPage.ai.errors.generic";

      if (!error?.response) {
        errorKey =
          "comparisonPage.ai.errors.network";
      } else if (statusCode === 401) {
        errorKey =
          "comparisonPage.ai.errors.unauthorized";
      } else if (statusCode === 403) {
        errorKey =
          "comparisonPage.ai.errors.forbidden";
      } else if (statusCode === 504) {
        errorKey =
          "comparisonPage.ai.errors.timeout";
      } else if (statusCode === 502 && !code) {
        errorKey =
          "comparisonPage.ai.errors.provider";
      }

      setAiState({
        kind: "error",
        data: previous,
        errorKey,
      });
    }
  };

  if (!query.valid) {
    return (
      <main className="comparison-page">
        <div className="comparison-page__container comparison-page__state">
          <InlineState
            type="unavailable"
            title={t(
              "comparisonPage.states.invalid.title"
            )}
            description={query.reason}
          />
          <button
            type="button"
            className="comparison-page__button comparison-page__button--secondary"
            onClick={() => navigate(fallbackPath)}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {t("comparisonPage.actions.back")}
          </button>
        </div>
      </main>
    );
  }

  if (requestState.kind === "loading") {
    return (
      <main className="comparison-page">
        <div className="comparison-page__container comparison-page__state">
          <InlineState
            type="loading"
            title={t(
              "comparisonPage.states.loading.title"
            )}
            description={t(
              "comparisonPage.states.loading.description"
            )}
          />
        </div>
      </main>
    );
  }

  if (requestState.kind === "error") {
    const error = requestErrorPresentation(
      requestState.error,
      t
    );
    return (
      <main className="comparison-page">
        <div className="comparison-page__container comparison-page__state">
          <InlineState
            type={error.type}
            title={error.title}
            description={error.description}
            actionLabel={t(
              "comparisonPage.actions.retry"
            )}
            onAction={() =>
              setRequestVersion(
                (value) => value + 1
              )
            }
          />
          <button
            type="button"
            className="comparison-page__button comparison-page__button--secondary"
            onClick={() => navigate(fallbackPath)}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {t("comparisonPage.actions.back")}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="comparison-page">
      <div className="comparison-page__container">
        <div className="comparison-page__breadcrumbs">
          <AcademicBreadcrumbs
            currentUser={currentUser}
            page="comparison"
            submissionId={context.submissionId}
            course={breadcrumbContext?.course}
            courseId={breadcrumbContext?.courseId}
            isOwner={breadcrumbContext?.isOwner === true}
          />
        </div>
        <header className="comparison-page__header">
          <div>
            <span className="comparison-page__eyebrow">
              {t(
                "comparisonPage.header.eyebrow"
              )}
            </span>
            <h1>
              {t("comparisonPage.header.title")}
            </h1>
            <p className="comparison-page__selection-count">
              {t(
                "comparisonPage.header.selectionCount",
                { count: executions.length }
              )}
            </p>
            <p className="comparison-page__context">
              {context.description}
            </p>
          </div>
          <Link
            className="comparison-page__button comparison-page__button--secondary"
            to={context.backPath}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {context.backLabel}
          </Link>
        </header>

        <section
          className={`comparison-page__status comparison-page__status--${statusPresentation.tone}`}
          role={status === "INCOMPATIBLE" ? "alert" : "status"}
          aria-labelledby="comparison-status-title"
        >
          <StatusIcon size={21} strokeWidth={1.9} aria-hidden="true" />
          <div>
            <strong id="comparison-status-title">{statusPresentation.label}</strong>
            <p>{statusPresentation.text}</p>
          </div>
        </section>

        <ComparisonSectionNav />

        <section
          id="comparison-implementations"
          className="comparison-page__section comparison-page__major-section"
          aria-labelledby="comparison-implementations-title"
        >
          <div className="comparison-page__section-heading comparison-page__section-heading--actions">
            <div>
              <span className="comparison-page__eyebrow">
                {t(
                  "comparisonPage.implementations.eyebrow"
                )}
              </span>
              <h2 id="comparison-implementations-title">
                {t(
                  "comparisonPage.implementations.title"
                )}
              </h2>
            </div>
            <button
              type="button"
              className="comparison-page__button comparison-page__button--secondary"
              disabled={!canBrowseHistorical}
              aria-expanded={historyOpen}
              aria-controls="comparison-history-panel"
              onClick={() =>
                setHistoryOpen(
                  (value) => !value
                )
              }
            >
              {historyOpen ? (
                <X size={16} aria-hidden="true" />
              ) : (
                <History
                  size={16}
                  aria-hidden="true"
                />
              )}
              {query.executions.length >= 4
                ? t(
                    "comparisonPage.implementations.maxFour"
                  )
                : historyOpen
                ? t(
                    "comparisonPage.implementations.closeHistory"
                  )
                : t(
                    "comparisonPage.implementations.addHistorical"
                  )}
            </button>
          </div>
          <div className="comparison-page__implementation-grid">
            {executions.map((execution, index) => (
              <article
                className="comparison-page__implementation"
                key={execution?.publicId || execution?.codename || index}
              >
                <span className="comparison-page__series-index">{index + 1}</span>
                <div className="comparison-page__implementation-content">
                  <div className="comparison-page__implementation-title">
                    <h3>{executionLabels[index]}</h3>
                    {query.executions.length > 2 &&
                      execution?.codename && (
                        <button
                          type="button"
                          className="comparison-page__remove-button"
                          aria-label={t(
                            "comparisonPage.implementations.removeAria",
                            {
                              name:
                                executionLabels[
                                  index
                                ],
                            }
                          )}
                          onClick={() => {
                            const nextExecutions =
                              removeComparisonExecution(
                                query.executions,
                                execution.codename
                              );
                            navigate(
                              buildComparisonPath(
                                nextExecutions
                              )
                            );
                          }}
                        >
                          <X
                            size={14}
                            aria-hidden="true"
                          />
                          {t(
                            "comparisonPage.actions.remove"
                          )}
                        </button>
                      )}
                  </div>
                  <dl>
                    <div>
                      <dt>Benchmark</dt>
                      <dd>
                        {execution?.benchmark ||
                          t(
                            "comparisonPage.common.notVerifiable"
                          )}
                      </dd>
                    </div>
                    <div>
                      <dt>
                        {t(
                          "comparisonPage.common.profile"
                        )}
                      </dt>
                      <dd>
                        {execution?.profile ||
                          t(
                            "comparisonPage.common.notVerifiable"
                          )}
                      </dd>
                    </div>
                    {execution?.compilerFlags && (
                      <div>
                        <dt>
                          {t(
                            "comparisonPage.common.compilerFlags"
                          )}
                        </dt>
                        <dd>
                          {execution.compilerFlags}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              </article>
            ))}
          </div>
        </section>

        {historyOpen && (
          <section
            id="comparison-history-panel"
            className="comparison-page__section comparison-page__history"
            aria-labelledby="comparison-history-title"
          >
            <div className="comparison-page__section-heading comparison-page__section-heading--actions">
              <div>
                <span className="comparison-page__eyebrow">
                  {t(
                    "comparisonPage.history.eyebrow"
                  )}
                </span>
                <h2 id="comparison-history-title">
                  {t(
                    "comparisonPage.history.title"
                  )}
                </h2>
                <p>
                  {t(
                    "comparisonPage.history.description"
                  )}
                </p>
              </div>
              {candidateState.kind ===
                "success" &&
                hasNonSelectableCandidates && (
                  <label className="comparison-page__check-control">
                    <input
                      type="checkbox"
                      checked={
                        showIncompatible
                      }
                      onChange={(event) =>
                        setShowIncompatible(
                          event.target.checked
                        )
                      }
                    />
                    {t(
                      "comparisonPage.history.showIncompatible"
                    )}
                  </label>
                )}
            </div>

            {candidateState.kind ===
              "loading" && (
              <InlineState
                type="loading"
                title={t(
                  "comparisonPage.history.loading.title"
                )}
                description={t(
                  "comparisonPage.history.loading.description"
                )}
                compact
              />
            )}

            {candidateState.kind ===
              "error" &&
              (() => {
                const error =
                  candidateErrorPresentation(
                    candidateState.error,
                    t
                  );
                return (
                  <InlineState
                    type={error.type}
                    title={error.title}
                    description={
                      error.description
                    }
                    actionLabel={t(
                      "comparisonPage.actions.retry"
                    )}
                    onAction={() =>
                      setCandidateRequestVersion(
                        (value) =>
                          value + 1
                      )
                    }
                    compact
                  />
                );
              })()}

            {candidateState.kind ===
              "success" &&
              visibleCandidates.length === 0 && (
                <InlineState
                  type="unavailable"
                  title={t(
                    "comparisonPage.history.empty.title"
                  )}
                  description={t(
                    "comparisonPage.history.empty.description"
                  )}
                  compact
                />
              )}

            {candidateState.kind === "success" &&
              visibleCandidates.length > 0 && (
                <div className="comparison-page__candidate-grid">
                  {visibleCandidates.map((candidate, index) => {
                    const presentation =
                      historicalCandidatePresentation(
                        candidate?.status,
                        t
                      );
                    const CandidateStatusIcon = candidateStatusIcon(
                      candidate?.status
                    );
                    const alreadySelected = query.executions.includes(
                      String(candidate?.codename || "").trim()
                    );
                    const canAdd = canAddHistoricalCandidate(
                      candidate,
                      query.executions
                    );
                    const filename =
                      String(
                        candidate?.sourceFilename ||
                          ""
                      ).trim() ||
                      t(
                        "comparisonPage.history.candidateFallback",
                        { index: index + 1 }
                      );
                    const sourceLanguage = ["C", "C++"].includes(
                      candidate?.sourceLanguage
                    )
                      ? candidate.sourceLanguage
                      : "";
                    const compiler = ["gcc", "g++"].includes(
                      candidate?.compiler
                    )
                      ? candidate.compiler
                      : "";
                    const candidateLabel = [
                      filename,
                      sourceLanguage,
                      compiler,
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    const experimentId = candidate?.submissionId;
                    const experimentTitle = String(
                      candidate?.submissionTitle || ""
                    ).trim();
                    const candidateReason =
                      localizedCandidateReason(
                        candidate,
                        t
                      );

                    return (
                      <article
                        className="comparison-page__candidate"
                        key={candidate?.publicId || candidate?.codename || index}
                      >
                        <div className="comparison-page__candidate-header">
                          <h3>{candidateLabel}</h3>
                          <span
                            className={`comparison-page__candidate-status comparison-page__candidate-status--${presentation.tone}`}
                          >
                            <CandidateStatusIcon
                              size={13}
                              strokeWidth={2.2}
                              aria-hidden="true"
                            />
                            {presentation.label}
                          </span>
                        </div>
                        <p className="comparison-page__candidate-experiment">
                          {experimentId !==
                            null &&
                          experimentId !==
                            undefined
                            ? t(
                                "comparisonPage.context.experimentNumber",
                                {
                                  id: experimentId,
                                }
                              )
                            : t(
                                "comparisonPage.context.experiment"
                              )}
                          {experimentTitle
                            ? ` · ${experimentTitle}`
                            : ""}
                        </p>
                        <dl>
                          <div>
                            <dt>
                              {t(
                                "comparisonPage.history.date"
                              )}
                            </dt>
                            <dd>
                              {formatHistoricalCandidateDate(
                                candidate?.createdAt,
                                locale,
                                t(
                                  "comparisonModel.historicalDateUnavailable"
                                )
                              )}
                            </dd>
                          </div>
                          <div>
                            <dt>
                              Benchmark
                            </dt>
                            <dd>
                              {candidate?.benchmark ||
                                t(
                                  "comparisonPage.common.notVerifiable"
                                )}
                            </dd>
                          </div>
                          <div>
                            <dt>
                              {t(
                                "comparisonPage.common.profile"
                              )}
                            </dt>
                            <dd>
                              {candidate?.profile ||
                                t(
                                  "comparisonPage.common.notVerifiable"
                                )}
                            </dd>
                          </div>
                        </dl>
                        {candidateReason && (
                          <p className="comparison-page__candidate-reason">
                            {candidateReason}
                          </p>
                        )}
                        <button
                          type="button"
                          className="comparison-page__button comparison-page__button--primary"
                          disabled={!canAdd}
                          onClick={() => {
                            const nextExecutions = appendHistoricalExecution(
                              query.executions,
                              candidate.codename
                            );
                            if (
                              nextExecutions.length ===
                              query.executions.length + 1
                            ) {
                              navigate(buildComparisonPath(nextExecutions));
                            }
                          }}
                        >
                          <Plus size={15} aria-hidden="true" />
                          {alreadySelected
                            ? t(
                                "comparisonPage.history.alreadySelected"
                              )
                            : canAdd
                            ? t(
                                "comparisonPage.actions.add"
                              )
                            : t(
                                "comparisonPage.history.cannotAdd"
                              )}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}

            {candidateState.kind === "success" &&
              candidateState.data?.truncated === true && (
                <p
                  className="comparison-page__history-note"
                  role="status"
                >
                  {t(
                    "comparisonPage.history.truncated"
                  )}
                </p>
              )}
          </section>
        )}

        {canRenderCharts && (
          <section
            id="comparison-summary"
            className="comparison-page__section comparison-page__summary comparison-page__major-section"
            aria-labelledby="comparison-summary-title"
          >
            <div className="comparison-page__section-heading comparison-page__summary-heading">
              <div>
                <span className="comparison-page__eyebrow">
                  {t(
                    "comparisonPage.summary.eyebrow"
                  )}
                </span>
                <h2 id="comparison-summary-title">
                  {t(
                    "comparisonPage.summary.title"
                  )}
                </h2>
                <p className="comparison-page__section-description">
                  {t(
                    "comparisonPage.summary.description"
                  )}
                </p>
              </div>

              <div
                className="comparison-page__summary-coverage"
                role="status"
              >
                <strong>
                  {summaryAvailableCount}/
                  {TARGET_METRICS.length}
                </strong>
                <span>
                  {t(
                    "comparisonPage.summary.coverageLabel"
                  )}
                </span>
              </div>
            </div>

            <div className="comparison-page__summary-grid">
              {summaryCards.map((card) => (
                <ComparisonSummaryCard
                  key={card.metric}
                  card={card}
                />
              ))}
            </div>

            <div className="comparison-page__summary-note">
              <Info
                size={15}
                aria-hidden="true"
              />
              <span>
                {t(
                  "comparisonPage.summary.noRanking"
                )}
              </span>
            </div>
          </section>
        )}

        {structuredPedagogy ? (
          <ComparisonPedagogyPanel
            pedagogy={structuredPedagogy}
          />
        ) : (
          interpretationMessages.length > 0 && (
            <section
              id="comparison-interpretation"
              className="comparison-page__section comparison-page__guidance comparison-page__major-section"
              aria-labelledby="comparison-guidance-title"
            >
              <div className="comparison-page__section-heading comparison-page__guidance-heading">
                <div>
                  <span className="comparison-page__eyebrow">
                    {t(
                      "comparisonPage.guidance.eyebrow"
                    )}
                  </span>
                  <h2 id="comparison-guidance-title">
                    {t(
                      "comparisonPage.guidance.title"
                    )}
                  </h2>
                </div>
                <Info
                  size={23}
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
              </div>
              <ul>
                {interpretationMessages.map(
                  (message) => (
                    <li key={message}>{message}</li>
                  )
                )}
              </ul>
            </section>
          )
        )}

        <ComparisonAIAnalysisPanel
          explanation={aiState.data}
          loading={aiState.kind === "loading"}
          errorKey={aiState.errorKey}
          available={aiAvailable}
          unavailableKind={aiUnavailableKind}
          onGenerate={handleGenerateComparisonAI}
          metricLabel={(metric) =>
            humanMetricLabel(metric, t)
          }
        />

        {canRenderCharts && (
          <section
            id="comparison-metrics"
            className="comparison-page__section comparison-page__chart-section comparison-page__major-section"
            aria-labelledby="comparison-chart-title"
          >
            <div className="comparison-page__section-heading comparison-page__chart-heading">
              <div>
                <span className="comparison-page__eyebrow">
                  {t(
                    "comparisonPage.chart.eyebrow"
                  )}
                </span>
                <h2 id="comparison-chart-title">
                  {t(
                    "comparisonPage.chart.title"
                  )}
                </h2>
              </div>
              <BarChart3
                size={25}
                strokeWidth={1.8}
                aria-hidden="true"
              />
            </div>

            {!activeMetric ? (
              <InlineState
                type="unavailable"
                title={t(
                  "comparisonPage.chart.noMetrics.title"
                )}
                description={t(
                  "comparisonPage.chart.noMetrics.description"
                )}
              />
            ) : (
              <>

                <ComparisonFiltersPanel
                  aggregation={aggregation}
                  onAggregationChange={setAggregation}
                  showDispersion={showDispersion}
                  onDispersionChange={setShowDispersion}
                  xScale={xScale}
                  onXScaleChange={setXScale}
                  canUseLogScale={canUseLogScale}
                  inputRange={normalizedRange}
                  onRangeChange={setRange}
                  onReset={resetComparisonFilters}
                  activeFilterCount={activeFilterCount}
                />

                <div className="comparison-page__metric-explorer">
                  <div
                    className="comparison-page__metric-tabs"
                    role="tablist"
                    aria-label={t("comparisonPage.explorer.categoriesAria")}
                  >
                    {metricCategories.map((category) => (
                      <button
                        key={category.id}
                        type="button"
                        role="tab"
                        aria-selected={
                          activeMetricCategory === category.id
                        }
                        className={`comparison-page__metric-tab ${
                          activeMetricCategory === category.id
                            ? "comparison-page__metric-tab--active"
                            : ""
                        }`}
                        onClick={() =>
                          setActiveMetricCategory(category.id)
                        }
                      >
                        <span>
                          {t(
                            `comparisonPage.explorer.categories.${category.id}`
                          )}
                        </span>
                        <span
                          className="comparison-page__metric-tab-count"
                          aria-hidden="true"
                        >
                          {category.metrics.length}
                        </span>
                      </button>
                    ))}
                  </div>

                  {visibleCategoryMetrics.length > 0 ? (
                    <div className="comparison-page__metric-grid">
                      {visibleCategoryMetrics.map((metric) => (
                        <ComparisonMetricCard
                          key={metric}
                          metric={metric}
                          metricData={metrics[metric]}
                          aggregation={aggregation}
                          showDispersion={showDispersion}
                          minimum={normalizedRange.minimum}
                          maximum={normalizedRange.maximum}
                          xScale={xScale}
                          plotTheme={plotTheme}
                        />
                      ))}
                    </div>
                  ) : (
                    <InlineState
                      type="unavailable"
                      title={t("comparisonPage.explorer.empty.title")}
                      description={t(
                        "comparisonPage.explorer.empty.description"
                      )}
                      compact
                    />
                  )}
                </div>

                <details className="comparison-page__detail-panel">
                  <summary className="comparison-page__detail-summary">
                    <span>
                      {t("comparisonPage.explorer.detailInspector")}
                    </span>
                    <small>
                      {t("comparisonPage.explorer.detailInspectorHint")}
                    </small>
                  </summary>

                <div className="comparison-page__inspector-controls">
                  <label className="comparison-page__control">
                    <span>
                      {t("comparisonPage.chart.metric")}
                    </span>
                    <select
                      value={activeMetric}
                      onChange={(event) =>
                        setSelectedMetric(event.target.value)
                      }
                    >
                      {orderedMetrics.map((metric) => (
                        <option value={metric} key={metric}>
                          {humanMetricLabel(metric, t)}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>



                <div className="comparison-page__chart-context">
                  <h3>
                    {humanMetricLabel(
                      activeMetric,
                      t
                    )}
                  </h3>
                  <p>
                    {t(
                      "comparisonPage.chart.axisContext",
                      {
                        aggregation:
                          aggregation ===
                          "median"
                            ? t(
                                "comparisonPage.chart.medianLower"
                              )
                            : t(
                                "comparisonPage.chart.meanLower"
                              ),
                        unit: metricData?.unit
                          ? ` (${metricData.unit})`
                          : "",
                      }
                    )}
                    {showDispersion
                      ? aggregation ===
                        "median"
                        ? t(
                            "comparisonPage.chart.dispersionIqr"
                          )
                        : t(
                            "comparisonPage.chart.dispersionStddev"
                          )
                      : t(
                          "comparisonPage.chart.dispersionHidden"
                        )}
                  </p>
                </div>

                {!hasChartPoints ? (
                  <InlineState
                    type="unavailable"
                    title={t(
                      "comparisonPage.chart.noPoints.title"
                    )}
                    description={t(
                      "comparisonPage.chart.noPoints.description"
                    )}
                    compact
                  />
                ) : (
                  <div
                    className="comparison-page__plot"
                    role="img"
                    aria-label={t(
                      "comparisonPage.chart.plotAria",
                      {
                        metric:
                          humanMetricLabel(
                            activeMetric,
                            t
                          ),
                      }
                    )}
                  >
                    <Plot
                      data={traces}
                      layout={{
                        autosize: true,
                        paper_bgcolor: "rgba(0,0,0,0)",
                        plot_bgcolor: "rgba(0,0,0,0)",
                        colorway: plotTheme.colorway,
                        font: {
                          color: plotTheme.textSecondary,
                          family: plotTheme.fontFamily,
                          size: 12,
                        },
                        margin: { l: 72, r: 24, t: 24, b: 80 },
                        xaxis: {
                          type: xScale === "log" ? "log" : "linear",
                          title: { text: "InputSize" },
                          automargin: true,
                          gridcolor: plotTheme.divider,
                          linecolor: plotTheme.borderStrong,
                          tickfont: { color: plotTheme.textSecondary },
                          titlefont: { color: plotTheme.text },
                        },
                        yaxis: {
                          title: {
                            text:
                              metricData?.unit
                                ? `${humanMetricLabel(
                                    activeMetric,
                                    t
                                  )} (${metricData.unit})`
                                : humanMetricLabel(
                                    activeMetric,
                                    t
                                  ),
                          },
                          automargin: true,
                          gridcolor: plotTheme.divider,
                          linecolor: plotTheme.borderStrong,
                          tickfont: { color: plotTheme.textSecondary },
                          titlefont: { color: plotTheme.text },
                        },
                        hovermode: "closest",
                        hoverlabel: {
                          bgcolor: plotTheme.surfaceElevated,
                          bordercolor: plotTheme.borderStrong,
                          font: {
                            color: plotTheme.text,
                            family: plotTheme.fontFamily,
                          },
                        },
                        legend: {
                          orientation: "h",
                          x: 0,
                          y: -0.2,
                          font: { color: plotTheme.textSecondary },
                          bgcolor: "rgba(0,0,0,0)",
                        },
                        showlegend: true,
                      }}
                      config={{ responsive: true, displaylogo: false }}
                      useResizeHandler
                      className="comparison-page__plot-element"
                      style={{ width: "100%", height: "100%" }}
                    />
                  </div>
                )}
                </details>
              </>
            )}
</section>
        )}
        <ComparisonAuditPanel
          compatibility={compatibility}
          open={auditOpen}
          onToggle={() =>
            setAuditOpen((value) => !value)
          }
        />

      </div>
    </main>
  );
};

export default ComparisonPage;
