import React, { useEffect, useMemo, useState } from "react";
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
  RotateCcw,
  SlidersHorizontal,
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
import {
  appendHistoricalExecution,
  buildComparisonInterpretation,
  buildComparisonPath,
  buildComparisonTraces,
  buildUniqueSeriesLabels,
  canAddHistoricalCandidate,
  COMPARISON_DIMENSIONS,
  comparisonDimensionPresentation,
  defaultComparisonMetric,
  filterHistoricalCandidates,
  formatHistoricalCandidateDate,
  historicalCandidatePresentation,
  humanMetricLabel,
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
    label: "Compatible",
    text: "Las ejecuciones cumplen el contrato de compatibilidad para las mediciones comunes mostradas.",
  },
  LIMITED: {
    icon: AlertTriangle,
    tone: "warning",
    label: "Comparación limitada",
    text: "La comparación es válida sólo para las dimensiones y mediciones comunes indicadas.",
  },
  INCOMPATIBLE: {
    icon: XCircle,
    tone: "danger",
    label: "Comparación incompatible",
    text: "Estas ejecuciones no cumplen el contrato necesario para superponer sus resultados de rendimiento.",
  },
});

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
    title: "Sesión no disponible",
    description: "Tu sesión ya no permite consultar esta comparación.",
  },
  403: {
    type: "forbidden",
    title: "Comparación restringida",
    description: "No tienes permisos para comparar una o más de estas ejecuciones.",
  },
  404: {
    type: "not-found",
    title: "Resultados no disponibles",
    description: "Una de las ejecuciones o sus resultados ya no está disponible.",
  },
  409: {
    type: "unavailable",
    title: "Resultados todavía no publicables",
    description: "Una de las ejecuciones todavía no tiene resultados publicables.",
  },
  422: {
    type: "error",
    title: "Resultados no comparables",
    description: "Los resultados no cumplen el contrato necesario para compararlos.",
  },
});

const roleFallbackPath = (currentUser) => {
  if (isAdminUser(currentUser)) return "/admin/users";
  if (isTeacherUser(currentUser)) return "/teacher/courses";
  return "/profile";
};

const requestErrorPresentation = (error) => {
  if (!error?.response) {
    return {
      type: "network",
      title: "Sin conexión con el servidor",
      description: "No pudimos conectar con el servidor.",
    };
  }

  return (
    REQUEST_ERRORS[error.response.status] || {
      type: "error",
      title: "No fue posible cargar la comparación",
      description: "No fue posible cargar la comparación.",
    }
  );
};

const candidateErrorPresentation = (error) => {
  if (!error?.response) {
    return {
      type: "network",
      title: "Sin conexión con el servidor",
      description: "No pudimos conectar con el servidor.",
    };
  }

  if ([401, 403].includes(error.response.status)) {
    return {
      type: "forbidden",
      title: "Historial no disponible",
      description:
        "Tu sesión no permite consultar ejecuciones históricas para esta selección.",
    };
  }

  return {
    type: "error",
    title: "No fue posible cargar el historial",
    description: "No fue posible cargar las ejecuciones históricas.",
  };
};

const comparisonContext = (executions, currentUser) => {
  const items = Array.isArray(executions) ? executions : [];
  const firstId = items[0]?.submissionId;
  const sameSubmission =
    items.length > 0 &&
    firstId !== null &&
    firstId !== undefined &&
    items.every(
      (execution) => String(execution?.submissionId) === String(firstId)
    );

  if (sameSubmission) {
    const title = String(items[0]?.submissionTitle || "").trim();
    return {
      description: `Experimento #${firstId}${title ? ` · ${title}` : ""}`,
      backPath: `/submissions/${encodeURIComponent(String(firstId))}`,
      backLabel: "Volver al experimento",
      submissionId: firstId,
    };
  }

  return {
    description: "Ejecuciones de distintos experimentos",
    backPath: roleFallbackPath(currentUser),
    backLabel: "Volver",
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryKey = searchParams.toString();
  const query = useMemo(
    () => parseExecutionQuery(new URLSearchParams(queryKey)),
    [queryKey]
  );
  const [requestVersion, setRequestVersion] = useState(0);
  const [requestState, setRequestState] = useState({
    kind: "loading",
    data: null,
    error: null,
  });
  const [selectedMetric, setSelectedMetric] = useState("");
  const [aggregation, setAggregation] = useState("median");
  const [showDispersion, setShowDispersion] = useState(true);
  const [range, setRange] = useState({ minimum: null, maximum: null });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [candidateRequestVersion, setCandidateRequestVersion] = useState(0);
  const [candidateState, setCandidateState] = useState({
    kind: "idle",
    data: null,
    error: null,
  });
  const [showIncompatible, setShowIncompatible] = useState(false);
  const plotTheme = usePlotTheme();
  const fallbackPath = roleFallbackPath(currentUser);

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
  const fallbackMetric = defaultComparisonMetric(
    compatibility.commonMetrics,
    metrics
  );
  const activeMetric = orderedMetrics.includes(selectedMetric)
    ? selectedMetric
    : fallbackMetric;
  const metricData = metrics[activeMetric] || null;
  const normalizedRange = normalizeInputRange(
    metricData?.commonInputSizes,
    range.minimum,
    range.maximum
  );
  const traces = buildComparisonTraces({
    metricData,
    aggregation,
    showDispersion,
    minimum: normalizedRange.minimum,
    maximum: normalizedRange.maximum,
  });
  const hasChartPoints = traces.some((trace) => trace.y.length > 0);
  const status = String(compatibility.status || "").toUpperCase();
  const statusPresentation =
    STATUS_PRESENTATION[status] || STATUS_PRESENTATION.INCOMPATIBLE;
  const StatusIcon = statusPresentation.icon;
  const canRenderCharts = ["COMPATIBLE", "LIMITED"].includes(status);
  const executions = Array.isArray(data.executions) ? data.executions : [];
  const executionLabels = buildUniqueSeriesLabels(executions);
  const context = comparisonContext(executions, currentUser);
  const interpretationMessages = buildComparisonInterpretation({
    compatibility,
    selectedMetric: activeMetric,
    metricData,
    aggregation,
    showDispersion,
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

  if (!query.valid) {
    return (
      <main className="comparison-page">
        <div className="comparison-page__container comparison-page__state">
          <InlineState
            type="unavailable"
            title="Comparación no válida"
            description={query.reason}
          />
          <button
            type="button"
            className="comparison-page__button comparison-page__button--secondary"
            onClick={() => navigate(fallbackPath)}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Volver
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
            title="Cargando comparación"
            description="Estamos reuniendo los resultados estructurados de las implementaciones seleccionadas."
          />
        </div>
      </main>
    );
  }

  if (requestState.kind === "error") {
    const error = requestErrorPresentation(requestState.error);
    return (
      <main className="comparison-page">
        <div className="comparison-page__container comparison-page__state">
          <InlineState
            type={error.type}
            title={error.title}
            description={error.description}
            actionLabel="Reintentar"
            onAction={() => setRequestVersion((value) => value + 1)}
          />
          <button
            type="button"
            className="comparison-page__button comparison-page__button--secondary"
            onClick={() => navigate(fallbackPath)}
          >
            <ArrowLeft size={16} aria-hidden="true" />
            Volver
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
          />
        </div>
        <header className="comparison-page__header">
          <div>
            <span className="comparison-page__eyebrow">Análisis comparativo</span>
            <h1>Comparación de implementaciones</h1>
            <p className="comparison-page__selection-count">
              {executions.length} implementaciones seleccionadas
            </p>
            <p className="comparison-page__context">{context.description}</p>
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

        <section
          className="comparison-page__section"
          aria-labelledby="comparison-implementations-title"
        >
          <div className="comparison-page__section-heading comparison-page__section-heading--actions">
            <div>
              <span className="comparison-page__eyebrow">Series</span>
              <h2 id="comparison-implementations-title">Implementaciones</h2>
            </div>
            <button
              type="button"
              className="comparison-page__button comparison-page__button--secondary"
              disabled={!canBrowseHistorical}
              aria-expanded={historyOpen}
              aria-controls="comparison-history-panel"
              onClick={() => setHistoryOpen((value) => !value)}
            >
              {historyOpen ? (
                <X size={16} aria-hidden="true" />
              ) : (
                <History size={16} aria-hidden="true" />
              )}
              {query.executions.length >= 4
                ? "Máximo 4 implementaciones"
                : historyOpen
                ? "Cerrar historial"
                : "Agregar ejecución histórica"}
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
                    {query.executions.length > 2 && execution?.codename && (
                      <button
                        type="button"
                        className="comparison-page__remove-button"
                        aria-label={`Quitar ${executionLabels[index]}`}
                        onClick={() => {
                          const nextExecutions = removeComparisonExecution(
                            query.executions,
                            execution.codename
                          );
                          navigate(buildComparisonPath(nextExecutions));
                        }}
                      >
                        <X size={14} aria-hidden="true" />
                        Quitar
                      </button>
                    )}
                  </div>
                  <dl>
                    <div>
                      <dt>Benchmark</dt>
                      <dd>{execution?.benchmark || "No verificable"}</dd>
                    </div>
                    <div>
                      <dt>Perfil</dt>
                      <dd>{execution?.profile || "No verificable"}</dd>
                    </div>
                    {execution?.compilerFlags && (
                      <div>
                        <dt>Flags del compilador</dt>
                        <dd>{execution.compilerFlags}</dd>
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
                <span className="comparison-page__eyebrow">Historial accesible</span>
                <h2 id="comparison-history-title">Ejecuciones históricas</h2>
                <p>
                  Cada opción se evalúa junto a toda la selección actual antes
                  de poder agregarla.
                </p>
              </div>
              {candidateState.kind === "success" && hasNonSelectableCandidates && (
                <label className="comparison-page__check-control">
                  <input
                    type="checkbox"
                    checked={showIncompatible}
                    onChange={(event) =>
                      setShowIncompatible(event.target.checked)
                    }
                  />
                  Mostrar incompatibles
                </label>
              )}
            </div>

            {candidateState.kind === "loading" && (
              <InlineState
                type="loading"
                title="Buscando ejecuciones históricas"
                description="Estamos verificando compatibilidad y permisos para la selección actual."
                compact
              />
            )}

            {candidateState.kind === "error" && (() => {
              const error = candidateErrorPresentation(candidateState.error);
              return (
                <InlineState
                  type={error.type}
                  title={error.title}
                  description={error.description}
                  actionLabel="Reintentar"
                  onAction={() =>
                    setCandidateRequestVersion((value) => value + 1)
                  }
                  compact
                />
              );
            })()}

            {candidateState.kind === "success" &&
              visibleCandidates.length === 0 && (
                <InlineState
                  type="unavailable"
                  title="Sin ejecuciones compatibles"
                  description="No encontramos ejecuciones históricas compatibles con la selección actual."
                  compact
                />
              )}

            {candidateState.kind === "success" &&
              visibleCandidates.length > 0 && (
                <div className="comparison-page__candidate-grid">
                  {visibleCandidates.map((candidate, index) => {
                    const presentation = historicalCandidatePresentation(
                      candidate?.status
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
                      String(candidate?.sourceFilename || "").trim() ||
                      `Implementación histórica ${index + 1}`;
                    const experimentId = candidate?.submissionId;
                    const experimentTitle = String(
                      candidate?.submissionTitle || ""
                    ).trim();

                    return (
                      <article
                        className="comparison-page__candidate"
                        key={candidate?.publicId || candidate?.codename || index}
                      >
                        <div className="comparison-page__candidate-header">
                          <h3>{filename}</h3>
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
                          {experimentId !== null && experimentId !== undefined
                            ? `Experimento #${experimentId}`
                            : "Experimento"}
                          {experimentTitle ? ` · ${experimentTitle}` : ""}
                        </p>
                        <dl>
                          <div>
                            <dt>Fecha</dt>
                            <dd>{formatHistoricalCandidateDate(candidate?.createdAt)}</dd>
                          </div>
                          <div>
                            <dt>Benchmark</dt>
                            <dd>{candidate?.benchmark || "No verificable"}</dd>
                          </div>
                          <div>
                            <dt>Perfil</dt>
                            <dd>{candidate?.profile || "No verificable"}</dd>
                          </div>
                        </dl>
                        {candidate?.reason && (
                          <p className="comparison-page__candidate-reason">
                            {candidate.reason}
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
                            ? "Ya seleccionada"
                            : canAdd
                            ? "Agregar"
                            : "No se puede agregar"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}

            {candidateState.kind === "success" &&
              candidateState.data?.truncated === true && (
                <p className="comparison-page__history-note" role="status">
                  Se muestran las ejecuciones recientes disponibles dentro del
                  límite de búsqueda.
                </p>
              )}
          </section>
        )}

        <section
          className="comparison-page__section"
          aria-labelledby="comparison-dimensions-title"
        >
          <div className="comparison-page__section-heading">
            <span className="comparison-page__eyebrow">Contrato científico</span>
            <h2 id="comparison-dimensions-title">Compatibilidad por dimensión</h2>
          </div>
          <dl className="comparison-page__dimension-grid">
            {COMPARISON_DIMENSIONS.map(([key, label]) => {
              const presentation = comparisonDimensionPresentation(
                compatibility.dimensions?.[key]?.status
              );
              return (
                <div className="comparison-page__dimension" key={key}>
                  <dt>{label}</dt>
                  <dd className={`comparison-page__dimension-value comparison-page__dimension-value--${presentation.tone}`}>
                    {presentation.label}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>

        {(Array.isArray(compatibility.blockers) &&
          compatibility.blockers.length > 0) ||
        (Array.isArray(compatibility.warnings) &&
          compatibility.warnings.length > 0) ? (
          <section
            className="comparison-page__section"
            aria-labelledby="comparison-observations-title"
          >
            <div className="comparison-page__section-heading">
              <span className="comparison-page__eyebrow">Alcance</span>
              <h2 id="comparison-observations-title">Observaciones</h2>
            </div>
            <div className="comparison-page__issues">
              {Array.isArray(compatibility.blockers) &&
                compatibility.blockers.map((issue, index) => (
                  <div className="comparison-page__issue comparison-page__issue--danger" key={`blocker-${index}`}>
                    <strong>Bloqueo de compatibilidad</strong>
                    <p>{issue?.message || "Dimensión incompatible."}</p>
                  </div>
                ))}
              {Array.isArray(compatibility.warnings) &&
                compatibility.warnings.map((issue, index) => (
                  <div className="comparison-page__issue comparison-page__issue--warning" key={`warning-${index}`}>
                    <strong>Limitación</strong>
                    <p>{issue?.message || "Comparación con alcance limitado."}</p>
                  </div>
                ))}
            </div>
          </section>
        ) : null}

        {Array.isArray(compatibility.excludedMetrics) &&
          compatibility.excludedMetrics.length > 0 && (
            <section
              className="comparison-page__section comparison-page__excluded"
              aria-labelledby="comparison-excluded-title"
            >
              <div className="comparison-page__section-heading">
                <span className="comparison-page__eyebrow">Cobertura</span>
                <h2 id="comparison-excluded-title">Métricas no comparables</h2>
              </div>
              <ul>
                {compatibility.excludedMetrics.map((item, index) => (
                  <li key={`${item?.metric || "metric"}-${index}`}>
                    <strong>{humanMetricLabel(item?.metric)}</strong>
                    <span>{item?.message || "No está disponible de forma común."}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

        {interpretationMessages.length > 0 && (
          <section
            className="comparison-page__section comparison-page__guidance"
            aria-labelledby="comparison-guidance-title"
          >
            <div className="comparison-page__section-heading comparison-page__guidance-heading">
              <div>
                <span className="comparison-page__eyebrow">Lectura prudente</span>
                <h2 id="comparison-guidance-title">
                  Cómo interpretar esta comparación
                </h2>
              </div>
              <Info size={23} strokeWidth={1.9} aria-hidden="true" />
            </div>
            <ul>
              {interpretationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </section>
        )}

        {canRenderCharts && (
          <section
            className="comparison-page__section comparison-page__chart-section"
            aria-labelledby="comparison-chart-title"
          >
            <div className="comparison-page__section-heading comparison-page__chart-heading">
              <div>
                <span className="comparison-page__eyebrow">Mediciones comunes</span>
                <h2 id="comparison-chart-title">Resultados superpuestos</h2>
              </div>
              <BarChart3 size={25} strokeWidth={1.8} aria-hidden="true" />
            </div>

            {!activeMetric ? (
              <InlineState
                type="unavailable"
                title="Sin métricas comparables"
                description="La respuesta no contiene una métrica común disponible para graficar."
              />
            ) : (
              <>
                <div className="comparison-page__controls">
                  <label className="comparison-page__control">
                    <span>Métrica</span>
                    <select
                      value={activeMetric}
                      onChange={(event) => {
                        setSelectedMetric(event.target.value);
                        setRange({ minimum: null, maximum: null });
                      }}
                    >
                      {orderedMetrics.map((metric) => (
                        <option value={metric} key={metric}>
                          {humanMetricLabel(metric)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <fieldset className="comparison-page__aggregation">
                    <legend>Agregación</legend>
                    <label>
                      <input
                        type="radio"
                        name="comparison-aggregation"
                        value="median"
                        checked={aggregation === "median"}
                        onChange={() => setAggregation("median")}
                      />
                      Mediana
                    </label>
                    <label>
                      <input
                        type="radio"
                        name="comparison-aggregation"
                        value="mean"
                        checked={aggregation === "mean"}
                        onChange={() => setAggregation("mean")}
                      />
                      Media
                    </label>
                  </fieldset>

                  <label className="comparison-page__check-control">
                    <input
                      type="checkbox"
                      checked={showDispersion}
                      onChange={(event) => setShowDispersion(event.target.checked)}
                    />
                    Mostrar dispersión
                  </label>
                </div>

                <div className="comparison-page__range" role="group" aria-label="Rango de InputSize">
                  <SlidersHorizontal size={18} strokeWidth={1.9} aria-hidden="true" />
                  <label>
                    <span>InputSize mínimo</span>
                    <select
                      value={normalizedRange.minimum ?? ""}
                      disabled={normalizedRange.domain.length <= 1}
                      onChange={(event) => {
                        const minimum = Number(event.target.value);
                        setRange((current) => ({
                          ...current,
                          minimum,
                        }));
                      }}
                    >
                      {normalizedRange.domain.map((inputSize) => (
                        <option value={inputSize} key={`min-${inputSize}`}>
                          {inputSize}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>InputSize máximo</span>
                    <select
                      value={normalizedRange.maximum ?? ""}
                      disabled={normalizedRange.domain.length <= 1}
                      onChange={(event) => {
                        const maximum = Number(event.target.value);
                        setRange((current) => ({
                          ...current,
                          maximum,
                        }));
                      }}
                    >
                      {normalizedRange.domain.map((inputSize) => (
                        <option value={inputSize} key={`max-${inputSize}`}>
                          {inputSize}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="comparison-page__button comparison-page__button--secondary"
                    onClick={() => setRange({ minimum: null, maximum: null })}
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                    Restablecer rango
                  </button>
                </div>

                <div className="comparison-page__chart-context">
                  <h3>{humanMetricLabel(activeMetric)}</h3>
                  <p>
                    Eje X: InputSize. Eje Y: {aggregation === "median" ? "mediana" : "media"}
                    {metricData?.unit ? ` (${metricData.unit})` : ""}.
                    {showDispersion
                      ? aggregation === "median"
                        ? " Dispersión Q1–Q3."
                        : " Dispersión mediante desviación estándar."
                      : " Dispersión oculta."}
                  </p>
                </div>

                {!hasChartPoints ? (
                  <InlineState
                    type="unavailable"
                    title="Sin puntos para este rango"
                    description="No hay valores centrales disponibles en el rango seleccionado."
                    compact
                  />
                ) : (
                  <div
                    className="comparison-page__plot"
                    role="img"
                    aria-label={`Gráfico comparativo de ${humanMetricLabel(activeMetric)}`}
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
                          title: { text: "InputSize" },
                          automargin: true,
                          gridcolor: plotTheme.divider,
                          linecolor: plotTheme.borderStrong,
                          tickfont: { color: plotTheme.textSecondary },
                          titlefont: { color: plotTheme.text },
                        },
                        yaxis: {
                          title: {
                            text: metricData?.unit
                              ? `${humanMetricLabel(activeMetric)} (${metricData.unit})`
                              : humanMetricLabel(activeMetric),
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
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
};

export default ComparisonPage;
