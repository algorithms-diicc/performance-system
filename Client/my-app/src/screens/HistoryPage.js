import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  FileArchive,
  FolderOpen,
  GraduationCap,
  Pin,
  RefreshCw,
  RotateCcw,
  Search,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { requestJson } from "../common/requestErrorModel";
import {
  formatAcademicPeriod,
  formatCourseLabel,
} from "./submissionOverviewModel";

import "./HistoryPage.css";

const PAGE_SIZE = 20;

const INITIAL_FILTERS = Object.freeze({
  status: "",
  benchmark: "",
  courseId: "",
  query: "",
});

const HISTORY_FILTER_OPTIONS_URL =
  "/api/submissions/history-filter-options";

const buildHistoryUrl = (page, filters) => {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("page_size", String(PAGE_SIZE));

  if (filters.status) params.set("status", filters.status);
  if (filters.benchmark) params.set("benchmark", filters.benchmark);
  if (filters.courseId) params.set("course_id", filters.courseId);
  if (filters.query) params.set("q", filters.query);

  return `/api/submissions?${params.toString()}`;
};

const formatDateTime = (value) => {
  if (!value) return "Sin registro";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registro";

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const normalizeStringList = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];

const formatBenchmarkFamilies = (item) => {
  const families = normalizeStringList(item?.benchmarkFamilies);
  if (families.length > 0) return families.join(" · ");

  const benchmarks = normalizeStringList(item?.benchmarks);
  return benchmarks.length > 0
    ? benchmarks.join(" · ")
    : "Benchmark no informado";
};

const sourcePreview = (item) => {
  const sources = normalizeStringList(item?.sourceFilenames);

  if (sources.length === 0) {
    return {
      text: "Fuentes no disponibles",
      extra: null,
    };
  }

  const visible = sources.slice(0, 3);
  const remaining = sources.length - visible.length;

  return {
    text: visible.join(" · "),
    extra: remaining > 0 ? `+${remaining} más` : null,
  };
};

const statusClass = (state) => {
  const normalized = String(state || "").trim().toUpperCase();

  if (normalized === "COMPLETED") return "history-status--success";
  if (normalized === "PARTIAL") return "history-status--warning";
  if (normalized === "FAILED") return "history-status--danger";
  if (normalized === "IN_PROGRESS") return "history-status--info";

  return "history-status--neutral";
};

const HistoryPage = () => {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [queryDraft, setQueryDraft] = useState("");
  const [courseOptions, setCourseOptions] = useState([]);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const body = await requestJson(
        buildHistoryUrl(page, filters),
        { credentials: "include" },
        { fallback: "No fue posible cargar tu historial." }
      );

      if (
        !body ||
        typeof body !== "object" ||
        !Array.isArray(body.items)
      ) {
        throw new Error("El servidor devolvió un historial incompleto.");
      }

      setItems(body.items);
      setTotal(Number(body.total || 0));
      setPageSize(Number(body.pageSize || PAGE_SIZE));
    } catch (loadError) {
      console.error("Error cargando /api/submissions:", loadError);
      setItems([]);
      setError(
        loadError?.message || "No fue posible cargar tu historial."
      );
    } finally {
      setIsLoading(false);
    }
  }, [filters, page]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const body = await requestJson(
        HISTORY_FILTER_OPTIONS_URL,
        { credentials: "include" },
        { fallback: "No fue posible cargar los cursos del historial." }
      );

      setCourseOptions(
        Array.isArray(body?.courses)
          ? body.courses
          : []
      );
    } catch (loadError) {
      console.error(
        "Error cargando opciones de filtros del historial:",
        loadError
      );
      setCourseOptions([]);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  const hasActiveFilters = useMemo(
    () => Object.values(filters).some(Boolean),
    [filters]
  );

  const updateFilter = (name, value) => {
    setPage(1);
    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const submitQuery = (event) => {
    event.preventDefault();
    updateFilter("query", queryDraft.trim());
  };

  const clearFilters = () => {
    setPage(1);
    setQueryDraft("");
    setFilters(INITIAL_FILTERS);
  };

  const totalPages = useMemo(
    () =>
      Math.max(
        1,
        Math.ceil(
          Math.max(0, Number(total || 0)) /
            Math.max(1, Number(pageSize || PAGE_SIZE))
        )
      ),
    [pageSize, total]
  );

  const canGoPrevious = page > 1 && !isLoading;
  const canGoNext = page < totalPages && !isLoading;

  const goPrevious = () => {
    if (!canGoPrevious) return;
    setPage((current) => Math.max(1, current - 1));
  };

  const goNext = () => {
    if (!canGoNext) return;
    setPage((current) => Math.min(totalPages, current + 1));
  };

  return (
    <div className="app-page history-page">
      <main className="history-main">
        <div className="history-container">
          <header className="history-header">
            <div>
              <span className="history-eyebrow">Trabajo persistido</span>
              <h1>Historial</h1>
              <p>
                Recupera tus experimentos anteriores y vuelve a sus
                ejecuciones, resultados y trazabilidad.
              </p>
            </div>

            <Link to="/" className="history-button history-button--primary">
              <UploadCloud size={18} aria-hidden="true" />
              Nuevo análisis
            </Link>
          </header>

          <section
            className="history-filters"
            aria-label="Filtros del historial"
          >
            <div className="history-filters__heading">
              <div>
                <span>Filtrar experimentos</span>
                <small>
                  Los filtros se aplican sobre todo tu historial, antes de
                  paginar los resultados.
                </small>
              </div>

              <button
                type="button"
                className="history-filter-clear"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                <RotateCcw size={15} aria-hidden="true" />
                Limpiar filtros
              </button>
            </div>

            <form
              className="history-filter-search"
              role="search"
              onSubmit={submitQuery}
            >
              <label htmlFor="history-query">
                Buscar
                <span>
                  Título, archivo ZIP o fuente C/C++
                </span>
              </label>

              <div className="history-filter-search__control">
                <Search size={17} aria-hidden="true" />
                <input
                  id="history-query"
                  type="search"
                  value={queryDraft}
                  maxLength={200}
                  placeholder="Ej. ordenamiento, sorting.zip, merge.cpp"
                  onChange={(event) => setQueryDraft(event.target.value)}
                />
                <button
                  type="submit"
                  className="history-button history-button--secondary"
                >
                  Buscar
                </button>
              </div>
            </form>

            <div className="history-filter-grid">
              <label>
                <span>Estado</span>
                <select
                  aria-label="Filtrar por estado"
                  value={filters.status}
                  onChange={(event) =>
                    updateFilter("status", event.target.value)
                  }
                >
                  <option value="">Todos los estados</option>
                  <option value="EMPTY">Sin ejecuciones</option>
                  <option value="IN_PROGRESS">En progreso</option>
                  <option value="COMPLETED">Completado</option>
                  <option value="PARTIAL">Parcial</option>
                  <option value="FAILED">Error</option>
                </select>
              </label>

              <label>
                <span>Benchmark</span>
                <select
                  aria-label="Filtrar por benchmark"
                  value={filters.benchmark}
                  onChange={(event) =>
                    updateFilter("benchmark", event.target.value)
                  }
                >
                  <option value="">Todos los benchmarks</option>
                  <option value="SIZE">SIZE</option>
                  <option value="LCS">LCS</option>
                  <option value="CAMM">CAMM</option>
                </select>
              </label>

              <label>
                <span>Contexto</span>
                <select
                  aria-label="Filtrar por curso"
                  value={filters.courseId}
                  onChange={(event) =>
                    updateFilter("courseId", event.target.value)
                  }
                >
                  <option value="">Todos los contextos</option>
                  <option value="personal">Personal</option>
                  {courseOptions.map((course) => (
                    <option
                      key={course.id}
                      value={String(course.id)}
                    >
                      {formatCourseLabel(course)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section
            className="history-summary"
            aria-label="Resumen del historial"
          >
            <div>
              <Archive size={19} aria-hidden="true" />
              <span>
                {hasActiveFilters
                  ? "Resultados encontrados"
                  : "Experimentos registrados"}
              </span>
              <strong>{total}</strong>
            </div>

            <div>
              <FolderOpen size={19} aria-hidden="true" />
              <span>Página</span>
              <strong>
                {page} de {totalPages}
              </strong>
            </div>
          </section>

          {isLoading ? (
            <section
              className="history-state-card"
              role="status"
              aria-live="polite"
            >
              <RefreshCw
                size={24}
                className="history-spinner"
                aria-hidden="true"
              />
              <div>
                <h2>Cargando historial</h2>
                <p>Consultando tus experimentos persistidos.</p>
              </div>
            </section>
          ) : error ? (
            <section className="history-state-card history-state-card--error">
              <XCircle size={27} aria-hidden="true" />
              <div>
                <h2>No pudimos cargar tu historial</h2>
                <p>{error}</p>
                <button
                  type="button"
                  className="history-button history-button--primary"
                  onClick={loadHistory}
                >
                  <RefreshCw size={17} aria-hidden="true" />
                  Reintentar
                </button>
              </div>
            </section>
          ) : items.length === 0 ? (
            <section className="history-state-card">
              <Archive size={28} aria-hidden="true" />
              <div>
                <h2>
                  {hasActiveFilters
                    ? "No encontramos experimentos"
                    : "Aún no tienes experimentos registrados"}
                </h2>
                <p>
                  {hasActiveFilters
                    ? "Prueba con otros criterios o limpia los filtros para volver a ver todo tu historial."
                    : "Cuando ejecutes un análisis, aparecerá aquí para que puedas revisarlo posteriormente."}
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    className="history-button history-button--secondary"
                    onClick={clearFilters}
                  >
                    <RotateCcw size={17} aria-hidden="true" />
                    Limpiar filtros
                  </button>
                ) : (
                  <Link
                    to="/"
                    className="history-button history-button--primary"
                  >
                    <UploadCloud size={17} aria-hidden="true" />
                    Crear primer análisis
                  </Link>
                )}
              </div>
            </section>
          ) : (
            <>
              <section
                className="history-list"
                aria-label="Experimentos"
              >
                {items.map((item) => {
                  const sources = sourcePreview(item);
                  const coursePeriod = formatAcademicPeriod(item.course);

                  return (
                    <article
                      key={item.id}
                      className="history-card"
                    >
                      <div className="history-card__top">
                        <div className="history-card__heading">
                          <span className="history-card__identifier">
                            Experimento #{item.id}
                          </span>
                          <h2>
                            {String(item.title || "").trim() ||
                              "Experimento sin título"}
                          </h2>
                        </div>

                        <div className="history-card__badges">
                          {item.isPinned && (
                            <span className="history-reference-badge">
                              <Pin size={14} aria-hidden="true" />
                              Referencia
                            </span>
                          )}

                          <span
                            className={[
                              "history-status",
                              statusClass(item.aggregateState),
                            ].join(" ")}
                          >
                            {item.aggregateStateLabel ||
                              "Sin ejecuciones"}
                          </span>
                        </div>
                      </div>

                      <div className="history-card__metadata">
                        <div>
                          <FileArchive size={17} aria-hidden="true" />
                          <span>Archivo</span>
                          <strong>
                            {item.originalFilename ||
                              "ZIP no disponible"}
                          </strong>
                        </div>

                        <div>
                          <GraduationCap size={17} aria-hidden="true" />
                          <span>Contexto</span>
                          <strong>{formatCourseLabel(item.course)}</strong>
                          {coursePeriod && <small>{coursePeriod}</small>}
                        </div>

                        <div>
                          <CalendarDays size={17} aria-hidden="true" />
                          <span>Última actividad</span>
                          <strong>
                            {formatDateTime(
                              item.activityAt || item.createdAt
                            )}
                          </strong>
                        </div>
                      </div>

                      <div className="history-card__details">
                        <div>
                          <span>Benchmark</span>
                          <strong>{formatBenchmarkFamilies(item)}</strong>
                        </div>

                        <div>
                          <span>Implementaciones</span>
                          <strong>
                            {Number(item.executionsCount || 0)}
                          </strong>
                        </div>

                        <div className="history-card__sources">
                          <span>Fuentes</span>
                          <strong>{sources.text}</strong>
                          {sources.extra && <small>{sources.extra}</small>}
                        </div>
                      </div>

                      <div className="history-card__actions">
                        <Link
                          to={`/submissions/${encodeURIComponent(item.id)}`}
                          className="history-button history-button--secondary"
                        >
                          Ver experimento
                          <ArrowRight size={16} aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </section>

              <nav
                className="history-pagination"
                aria-label="Paginación del historial"
              >
                <button
                  type="button"
                  className="history-button history-button--secondary"
                  onClick={goPrevious}
                  disabled={!canGoPrevious}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Anterior
                </button>

                <span>
                  Página <strong>{page}</strong> de{" "}
                  <strong>{totalPages}</strong>
                </span>

                <button
                  type="button"
                  className="history-button history-button--secondary"
                  onClick={goNext}
                  disabled={!canGoNext}
                >
                  Siguiente
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </nav>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default HistoryPage;
