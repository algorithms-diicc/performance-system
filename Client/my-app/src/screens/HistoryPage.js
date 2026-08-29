import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import {
  Archive,
  ArchiveRestore,
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
  Server,
  UploadCloud,
  XCircle,
} from "lucide-react";

import { requestJson } from "../common/requestErrorModel";
import { useI18n } from "../i18n";
import {
  formatAcademicPeriod,
  formatDateTime,
} from "../i18n/formatters";

import "./HistoryPage.css";

const PAGE_SIZE = 20;

const INITIAL_FILTERS = Object.freeze({
  status: "",
  benchmark: "",
  courseId: "",
  query: "",
  referenceOnly: false,
  archivedOnly: false,
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
  if (filters.referenceOnly) params.set("reference", "1");
  if (filters.archivedOnly) params.set("archived", "1");

  return `/api/submissions?${params.toString()}`;
};

const normalizeStringList = (value) =>
  Array.isArray(value)
    ? value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    : [];

const formatBenchmarkFamilies = (item, t) => {
  const families = normalizeStringList(item?.benchmarkFamilies);
  if (families.length > 0) return families.join(" · ");

  const benchmarks = normalizeStringList(item?.benchmarks);
  return benchmarks.length > 0
    ? benchmarks.join(" · ")
    : t("history.benchmarkUnavailable");
};

const sourcePreview = (item, t) => {
  const sources = normalizeStringList(item?.sourceFilenames);

  if (sources.length === 0) {
    return {
      text: t("history.sourcesUnavailable"),
      extra: null,
    };
  }

  const visible = sources.slice(0, 3);
  const remaining = sources.length - visible.length;

  return {
    text: visible.join(" · "),
    extra:
      remaining > 0
        ? t("history.moreSources", { count: remaining })
        : null,
  };
};

const courseLabel = (course, t) => {
  if (!course || typeof course !== "object") {
    return t("history.noCourse");
  }

  const code = String(course.code || "").trim();
  const name = String(course.name || "").trim();

  return (
    [code, name].filter(Boolean).join(" · ") ||
    t("history.noCourse")
  );
};

const aggregateStateLabel = (state, t) => {
  const normalized = String(state || "")
    .trim()
    .toUpperCase();

  const keys = {
    EMPTY: "history.states.empty",
    IN_PROGRESS: "history.states.inProgress",
    COMPLETED: "history.states.completed",
    PARTIAL: "history.states.partial",
    FAILED: "history.states.failed",
    CANCELLED: "history.states.cancelled",
  };

  return t(keys[normalized] || "history.states.empty");
};

const statusClass = (state) => {
  const normalized = String(state || "")
    .trim()
    .toUpperCase();

  if (normalized === "COMPLETED") {
    return "history-status--success";
  }
  if (normalized === "PARTIAL") {
    return "history-status--warning";
  }
  if (normalized === "FAILED") {
    return "history-status--danger";
  }
  if (normalized === "CANCELLED") {
    return "history-status--cancelled";
  }
  if (normalized === "IN_PROGRESS") {
    return "history-status--info";
  }

  return "history-status--neutral";
};

const HistoryPage = () => {
  const { locale, t } = useI18n();

  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [queryDraft, setQueryDraft] = useState("");
  const [courseOptions, setCourseOptions] = useState([]);
  const [archiveSavingId, setArchiveSavingId] = useState(null);
  const [archiveFeedback, setArchiveFeedback] = useState({
    submissionId: null,
    message: "",
  });

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const body = await requestJson(
        buildHistoryUrl(page, filters),
        { credentials: "include" },
        { fallback: t("history.errors.load") }
      );

      if (
        !body ||
        typeof body !== "object" ||
        !Array.isArray(body.items)
      ) {
        throw new Error(t("history.errors.incomplete"));
      }

      setItems(body.items);
      setTotal(Number(body.total || 0));
      setPageSize(Number(body.pageSize || PAGE_SIZE));
    } catch (loadError) {
      console.error(
        "Error cargando /api/submissions:",
        loadError
      );
      setItems([]);
      setError(
        loadError?.message ||
          t("history.errors.load")
      );
    } finally {
      setIsLoading(false);
    }
  }, [filters, page, t]);

  const loadFilterOptions = useCallback(async () => {
    try {
      const body = await requestJson(
        HISTORY_FILTER_OPTIONS_URL,
        { credentials: "include" },
        {
          fallback: t(
            "history.errors.filterOptions"
          ),
        }
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
  }, [t]);

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
            Math.max(
              1,
              Number(pageSize || PAGE_SIZE)
            )
        )
      ),
    [pageSize, total]
  );

  const canGoPrevious =
    page > 1 && !isLoading;
  const canGoNext =
    page < totalPages && !isLoading;

  const goPrevious = () => {
    if (!canGoPrevious) return;
    setPage((current) =>
      Math.max(1, current - 1)
    );
  };

  const goNext = () => {
    if (!canGoNext) return;
    setPage((current) =>
      Math.min(totalPages, current + 1)
    );
  };

  const handleSetArchived = async (item, archived) => {
    if (!item?.id || archiveSavingId !== null) return;
    setArchiveSavingId(item.id);
    setArchiveFeedback({ submissionId: null, message: "" });

    try {
      await requestJson(
        `/api/submissions/${encodeURIComponent(item.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archived }),
        },
        { fallback: t("history.errors.archive") }
      );

      if (items.length === 1 && page > 1) {
        setPage((current) => Math.max(1, current - 1));
      } else {
        await loadHistory();
      }
    } catch (mutationError) {
      setArchiveFeedback({
        submissionId: item.id,
        message: mutationError?.message || t("history.errors.archive"),
      });
    } finally {
      setArchiveSavingId(null);
    }
  };

  return (
    <div className="app-page history-page">
      <main className="history-main">
        <div className="history-container">
          <header className="history-header">
            <div>
              <span className="history-eyebrow">
                {t("history.eyebrow")}
              </span>
              <h1>{t("history.title")}</h1>
              <p>{t("history.description")}</p>
            </div>

            <Link
              to="/"
              className="history-button history-button--primary"
            >
              <UploadCloud
                size={18}
                aria-hidden="true"
              />
              {t("history.newAnalysis")}
            </Link>
          </header>

          <section
            className="history-filters"
            aria-label={t("history.filtersAria")}
          >
            <div className="history-filters__heading">
              <div>
                <span>
                  {t("history.filtersTitle")}
                </span>
                <small>
                  {t("history.filtersHint")}
                </small>
              </div>

              <button
                type="button"
                className="history-filter-clear"
                onClick={clearFilters}
                disabled={!hasActiveFilters}
              >
                <RotateCcw
                  size={15}
                  aria-hidden="true"
                />
                {t("history.clearFilters")}
              </button>
            </div>

            <form
              className="history-filter-search"
              role="search"
              onSubmit={submitQuery}
            >
              <label htmlFor="history-query">
                {t("history.search")}
                <span>
                  {t("history.searchHint")}
                </span>
              </label>

              <div className="history-filter-search__control">
                <Search
                  size={17}
                  aria-hidden="true"
                />
                <input
                  id="history-query"
                  type="search"
                  value={queryDraft}
                  maxLength={200}
                  placeholder={t(
                    "history.searchPlaceholder"
                  )}
                  onChange={(event) =>
                    setQueryDraft(
                      event.target.value
                    )
                  }
                />
                <button
                  type="submit"
                  className="history-button history-button--secondary"
                >
                  {t("history.search")}
                </button>
              </div>
            </form>

            <div className="history-filter-grid">
              <label>
                <span>{t("history.status")}</span>
                <select
                  aria-label={t(
                    "history.filterByStatus"
                  )}
                  value={filters.status}
                  onChange={(event) =>
                    updateFilter(
                      "status",
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    {t("history.allStatuses")}
                  </option>
                  <option value="EMPTY">
                    {t("history.states.empty")}
                  </option>
                  <option value="IN_PROGRESS">
                    {t(
                      "history.states.inProgress"
                    )}
                  </option>
                  <option value="COMPLETED">
                    {t(
                      "history.states.completed"
                    )}
                  </option>
                  <option value="PARTIAL">
                    {t("history.states.partial")}
                  </option>
                  <option value="FAILED">
                    {t("history.states.failed")}
                  </option>
                  <option value="CANCELLED">
                    {t("history.states.cancelled")}
                  </option>
                </select>
              </label>

              <label>
                <span>
                  {t("history.benchmark")}
                </span>
                <select
                  aria-label={t(
                    "history.filterByBenchmark"
                  )}
                  value={filters.benchmark}
                  onChange={(event) =>
                    updateFilter(
                      "benchmark",
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    {t(
                      "history.allBenchmarks"
                    )}
                  </option>
                  <option value="SIZE">
                    SIZE
                  </option>
                  <option value="LCS">
                    LCS
                  </option>
                  <option value="CAMM">
                    CAMM
                  </option>
                </select>
              </label>

              <label>
                <span>
                  {t("history.context")}
                </span>
                <select
                  aria-label={t(
                    "history.filterByCourse"
                  )}
                  value={filters.courseId}
                  onChange={(event) =>
                    updateFilter(
                      "courseId",
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    {t("history.allContexts")}
                  </option>
                  <option value="personal">
                    {t("history.personal")}
                  </option>
                  {courseOptions.map(
                    (course) => (
                      <option
                        key={course.id}
                        value={String(
                          course.id
                        )}
                      >
                        {courseLabel(
                          course,
                          t
                        )}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <label className="history-reference-filter">
              <input
                type="checkbox"
                checked={filters.referenceOnly}
                onChange={(event) =>
                  updateFilter(
                    "referenceOnly",
                    event.target.checked
                  )
                }
              />
              <span>{t("history.referencesOnly")}</span>
            </label>
            <label className="history-reference-filter">
              <input
                type="checkbox"
                checked={filters.archivedOnly}
                onChange={(event) =>
                  updateFilter("archivedOnly", event.target.checked)
                }
              />
              <span>{t("history.archivedOnly")}</span>
            </label>
            <small className="history-archive-hint">
              {t("history.archiveHint")}
            </small>
          </section>

          <section
            className="history-summary"
            aria-label={t("history.summaryAria")}
          >
            <div>
              <Archive
                size={19}
                aria-hidden="true"
              />
              <span>
                {hasActiveFilters
                  ? t("history.resultsFound")
                  : t(
                      "history.registeredExperiments"
                    )}
              </span>
              <strong>{total}</strong>
            </div>

            <div>
              <FolderOpen
                size={19}
                aria-hidden="true"
              />
              <span>{t("history.page")}</span>
              <strong>
                {page} {t("history.of")}{" "}
                {totalPages}
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
                <h2>
                  {t("history.loadingTitle")}
                </h2>
                <p>
                  {t("history.loadingText")}
                </p>
              </div>
            </section>
          ) : error ? (
            <section className="history-state-card history-state-card--error">
              <XCircle
                size={27}
                aria-hidden="true"
              />
              <div>
                <h2>
                  {t("history.loadErrorTitle")}
                </h2>
                <p>{error}</p>
                <button
                  type="button"
                  className="history-button history-button--primary"
                  onClick={loadHistory}
                >
                  <RefreshCw
                    size={17}
                    aria-hidden="true"
                  />
                  {t("history.retry")}
                </button>
              </div>
            </section>
          ) : items.length === 0 ? (
            <section className="history-state-card">
              <Archive
                size={28}
                aria-hidden="true"
              />
              <div>
                <h2>
                  {hasActiveFilters
                    ? t(
                        "history.emptyFilteredTitle"
                      )
                    : t("history.emptyTitle")}
                </h2>
                <p>
                  {hasActiveFilters
                    ? t(
                        "history.emptyFilteredText"
                      )
                    : t("history.emptyText")}
                </p>

                {hasActiveFilters ? (
                  <button
                    type="button"
                    className="history-button history-button--secondary"
                    onClick={clearFilters}
                  >
                    <RotateCcw
                      size={17}
                      aria-hidden="true"
                    />
                    {t(
                      "history.clearFilters"
                    )}
                  </button>
                ) : (
                  <Link
                    to="/"
                    className="history-button history-button--primary"
                  >
                    <UploadCloud
                      size={17}
                      aria-hidden="true"
                    />
                    {t(
                      "history.createFirstAnalysis"
                    )}
                  </Link>
                )}
              </div>
            </section>
          ) : (
            <>
              <section
                className="history-list"
                aria-label={t(
                  "history.experimentsAria"
                )}
              >
                {items.map((item) => {
                  const sources =
                    sourcePreview(item, t);
                  const measurementNodes =
                    normalizeStringList(
                      item?.measurementNodes
                    );
                  const hardwareProfiles =
                    normalizeStringList(
                      item?.hardwareProfiles
                    );
                  const hasRegisteredProvenance =
                    measurementNodes.length > 0 ||
                    hardwareProfiles.length > 0;
                  const coursePeriod =
                    formatAcademicPeriod(
                      item.course,
                      {
                        semesterLabel: t(
                          "history.semester"
                        ),
                        fallback: "",
                      }
                    );

                  return (
                    <article
                      key={item.id}
                      className="history-card"
                    >
                      <div className="history-card__top">
                        <div className="history-card__heading">
                          <span className="history-card__identifier">
                            {t(
                              "history.experimentNumber",
                              { id: item.id }
                            )}
                          </span>
                          <h2>
                            {String(
                              item.title || ""
                            ).trim() ||
                              t(
                                "history.untitledExperiment"
                              )}
                          </h2>
                        </div>

                        <div className="history-card__badges">
                          {item.isPinned && (
                            <span className="history-reference-badge">
                              <Pin
                                size={14}
                                aria-hidden="true"
                              />
                              {t(
                                "history.reference"
                              )}
                            </span>
                          )}
                          {item.archivedAt && (
                            <span className="history-status history-status--neutral">
                              {t("history.archived")}
                            </span>
                          )}

                          <span
                            className={[
                              "history-status",
                              statusClass(
                                item.aggregateState
                              ),
                            ].join(" ")}
                          >
                            {aggregateStateLabel(
                              item.aggregateState,
                              t
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="history-card__metadata">
                        <div>
                          <FileArchive
                            size={17}
                            aria-hidden="true"
                          />
                          <span>
                            {t("history.file")}
                          </span>
                          <strong>
                            {item.originalFilename ||
                              t(
                                "history.zipUnavailable"
                              )}
                          </strong>
                        </div>

                        <div>
                          <GraduationCap
                            size={17}
                            aria-hidden="true"
                          />
                          <span>
                            {t(
                              "history.context"
                            )}
                          </span>
                          <strong>
                            {courseLabel(
                              item.course,
                              t
                            )}
                          </strong>
                          {coursePeriod && (
                            <small>
                              {coursePeriod}
                            </small>
                          )}
                        </div>

                        <div>
                          <CalendarDays
                            size={17}
                            aria-hidden="true"
                          />
                          <span>
                            {t(
                              "history.lastActivity"
                            )}
                          </span>
                          <strong>
                            {formatDateTime(
                              item.activityAt ||
                                item.createdAt,
                              locale,
                              t(
                                "history.noRecord"
                              )
                            )}
                          </strong>
                        </div>
                      </div>

                      {hasRegisteredProvenance && (
                        <div
                          className="history-card__provenance"
                          role="group"
                          aria-label={t(
                            "history.registeredProvenance"
                          )}
                        >
                          {measurementNodes.length > 0 && (
                            <div>
                              <Server
                                size={17}
                                aria-hidden="true"
                              />
                              <span>
                                {t(
                                  "history.measurementNode"
                                )}
                              </span>
                              <strong>
                                {measurementNodes.join(
                                  " · "
                                )}
                              </strong>
                            </div>
                          )}

                          {hardwareProfiles.length > 0 && (
                            <div>
                              <Server
                                size={17}
                                aria-hidden="true"
                              />
                              <span>
                                {t(
                                  "history.registeredHardwareProfile"
                                )}
                              </span>
                              <strong>
                                {hardwareProfiles.join(
                                  " · "
                                )}
                              </strong>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="history-card__details">
                        <div>
                          <span>
                            {t(
                              "history.language"
                            )}
                          </span>
                          <strong>
                            {["C", "C++", "C/C++"].includes(item?.language)
                              ? item.language
                              : t(
                                  "history.languageUnavailable"
                                )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            {t(
                              "history.benchmark"
                            )}
                          </span>
                          <strong>
                            {formatBenchmarkFamilies(
                              item,
                              t
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>
                            {t(
                              "history.implementations"
                            )}
                          </span>
                          <strong>
                            {Number(
                              item.executionsCount ||
                                0
                            )}
                          </strong>
                        </div>

                        <div className="history-card__sources">
                          <span>
                            {t(
                              "history.sources"
                            )}
                          </span>
                          <strong>
                            {sources.text}
                          </strong>
                          {sources.extra && (
                            <small>
                              {sources.extra}
                            </small>
                          )}
                        </div>
                      </div>

                      <div className="history-card__actions">
                        <button
                          type="button"
                          className="history-button history-button--secondary"
                          onClick={() =>
                            handleSetArchived(item, !item.archivedAt)
                          }
                          disabled={archiveSavingId === item.id}
                        >
                          {item.archivedAt ? (
                            <ArchiveRestore size={16} aria-hidden="true" />
                          ) : (
                            <Archive size={16} aria-hidden="true" />
                          )}
                          {archiveSavingId === item.id
                            ? t("history.updating")
                            : item.archivedAt
                            ? t("history.restore")
                            : t("history.archive")}
                        </button>
                        <Link
                          to={`/submissions/${encodeURIComponent(
                            item.id
                          )}`}
                          className="history-button history-button--secondary"
                        >
                          {t(
                            "history.viewExperiment"
                          )}
                          <ArrowRight
                            size={16}
                            aria-hidden="true"
                          />
                        </Link>
                      </div>
                      {archiveFeedback.submissionId === item.id && (
                        <p className="history-archive-feedback" role="alert">
                          {archiveFeedback.message}
                        </p>
                      )}
                    </article>
                  );
                })}
              </section>

              <nav
                className="history-pagination"
                aria-label={t(
                  "history.paginationAria"
                )}
              >
                <button
                  type="button"
                  className="history-button history-button--secondary"
                  onClick={goPrevious}
                  disabled={!canGoPrevious}
                >
                  <ArrowLeft
                    size={16}
                    aria-hidden="true"
                  />
                  {t("history.previous")}
                </button>

                <span>
                  {t("history.page")}{" "}
                  <strong>{page}</strong>{" "}
                  {t("history.of")}{" "}
                  <strong>{totalPages}</strong>
                </span>

                <button
                  type="button"
                  className="history-button history-button--secondary"
                  onClick={goNext}
                  disabled={!canGoNext}
                >
                  {t("history.next")}
                  <ArrowRight
                    size={16}
                    aria-hidden="true"
                  />
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
