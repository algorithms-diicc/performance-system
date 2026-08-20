import InlineState from "../components/InlineState";
import { requestJson } from "../common/requestErrorModel";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";
import "./AdminUserDetail.css";

import {
  useI18n,
} from "../i18n";
import {
  formatDateTime as formatLocalizedDateTime,
} from "../i18n/formatters";

import {
  adminAccountStatusBadgeClass,
  adminAccountStatusLabel,
  adminRoleLabel,
  executionStateBadgeClass,
  localizedExecutionStateLabel,
  localizedExecutionStateOptions,
} from "./adminExecutionStateModel";


const PAGE_SIZE = 15;


async function fetchJson(
  url,
  options = {}
) {
  return requestJson(
    url,
    {
      credentials:
        "include",
      headers: {
        "Content-Type":
          "application/json",
        ...(options.headers || {}),
      },
      ...options,
    },
    {
      fallback:
        "No fue posible completar la operación solicitada.",
    }
  );
}


function formatDateTime(
  value,
  locale = "es-CL",
  fallback = "—"
) {
  return formatLocalizedDateTime(
    value,
    locale,
    fallback
  );
}


function formatDuration(
  value,
  locale = "es-CL",
  fallback = "—"
) {
  if (
    value === null
    || value === undefined
  ) {
    return fallback;
  }

  const numeric =
    Number(value);

  if (
    !Number.isFinite(
      numeric
    )
  ) {
    return fallback;
  }

  if (numeric < 1000) {
    return `${Math.round(
      numeric
    )} ms`;
  }

  const number =
    new Intl.NumberFormat(
      locale,
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );

  return `${number.format(
    numeric / 1000
  )} s`;
}


function formatInteger(
  value,
  locale
) {
  const numeric =
    Number(value);

  return new Intl.NumberFormat(
    locale,
    {
      maximumFractionDigits: 0,
    }
  ).format(
    Number.isFinite(numeric)
      ? numeric
      : 0
  );
}


function adminDetailErrorMessage(
  error,
  t,
  fallbackKey
) {
  if (
    error?.name === "AbortError"
  ) {
    return "";
  }

  const status =
    Number(error?.status);

  if (
    error?.code === "NETWORK_ERROR"
    || !Number.isFinite(status)
  ) {
    return t(
      "adminUserDetail.errors.network"
    );
  }

  if (status === 401) {
    return t(
      "adminUserDetail.errors.session"
    );
  }

  if (status === 403) {
    return t(
      "adminUserDetail.errors.forbidden"
    );
  }

  if (status === 404) {
    return t(
      "adminUserDetail.errors.notFound"
    );
  }

  if (status >= 500) {
    return t(
      "adminUserDetail.errors.service"
    );
  }

  return t(fallbackKey);
}


function initials(
  name
) {
  const parts =
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length === 0
  ) {
    return "?";
  }

  if (
    parts.length === 1
  ) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`
    .toUpperCase();
}


function activeExecutions(
  summary
) {
  return (
    (summary?.queuedExecutions || 0)
    + (summary?.runningExecutions || 0)
    + (summary?.processingExecutions || 0)
  );
}


function Pagination({
  page,
  total,
  pageSize = PAGE_SIZE,
  onPageChange,
  disabled,
}) {
  const {
    locale,
    t,
  } = useI18n();

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total / pageSize
      )
    );

  const first =
    total === 0
      ? 0
      : (
          (page - 1)
          * pageSize
          + 1
        );

  const last =
    Math.min(
      page * pageSize,
      total
    );

  return (
    <div className="admin-detail-pagination">

      <span>
        {total === 0
          ? t(
              "adminUserDetail.pagination.zero"
            )
          : t(
              "adminUserDetail.pagination.range",
              {
                first:
                  formatInteger(
                    first,
                    locale
                  ),
                last:
                  formatInteger(
                    last,
                    locale
                  ),
                total:
                  formatInteger(
                    total,
                    locale
                  ),
              }
            )}
      </span>


      <div className="admin-detail-pagination-controls">

        <button
          type="button"
          className="btn btn-sm admin-detail-secondary-button"
          onClick={() =>
            onPageChange(
              Math.max(
                1,
                page - 1
              )
            )
          }
          disabled={
            disabled
            || page <= 1
          }
        >
          {t(
            "adminUserDetail.actions.previous"
          )}
        </button>


        <span>
          {t(
            "adminUserDetail.pagination.page",
            {
              page:
                formatInteger(
                  Math.min(
                    page,
                    totalPages
                  ),
                  locale
                ),
              total:
                formatInteger(
                  totalPages,
                  locale
                ),
            }
          )}
        </span>


        <button
          type="button"
          className="btn btn-sm admin-detail-secondary-button"
          onClick={() =>
            onPageChange(
              Math.min(
                totalPages,
                page + 1
              )
            )
          }
          disabled={
            disabled
            || total === 0
            || page
              >= totalPages
          }
        >
          {t(
            "adminUserDetail.actions.next"
          )}
        </button>

      </div>

    </div>
  );
}


function ProfileOverview({
  profile,
  summary,
}) {
  const {
    locale,
    t,
  } = useI18n();

  const active =
    activeExecutions(
      summary
    );

  const displayName =
    profile.fullName
    || t(
      "adminUserDetail.fallbacks.name"
    );

  return (
    <section className="admin-user-overview">

      <div className="admin-user-overview-main">

        <div
          className="admin-user-detail-avatar"
          aria-hidden="true"
        >
          {initials(
            displayName
          )}
        </div>


        <div className="admin-user-overview-copy">

          <div className="admin-user-overview-heading">

            <div>
              <h2>
                {displayName}
              </h2>
              <p>
                {profile.email
                  || t(
                    "adminUserDetail.fallbacks.email"
                  )}
              </p>
            </div>


            <div className="admin-user-overview-badges">

              <span className="admin-user-role-chip">
                {adminRoleLabel(
                  profile.role,
                  t
                )}
              </span>

              <span
                className={`app-status-badge ${adminAccountStatusBadgeClass(
                  profile.isActive
                )}`}
              >
                {adminAccountStatusLabel(
                  profile.isActive,
                  t
                )}
              </span>

            </div>

          </div>


          <dl className="admin-user-overview-meta">

            <div>
              <dt>ID</dt>
              <dd>
                {profile.id
                  ?? t(
                    "adminUserDetail.fallbacks.unavailable"
                  )}
              </dd>
            </div>

            <div>
              <dt>
                {t(
                  "adminUserDetail.profile.created"
                )}
              </dt>
              <dd>
                {formatDateTime(
                  profile.createdAt,
                  locale,
                  t(
                    "adminUserDetail.fallbacks.unavailable"
                  )
                )}
              </dd>
            </div>

            <div>
              <dt>
                {t(
                  "adminUserDetail.profile.lastLogin"
                )}
              </dt>
              <dd>
                {formatDateTime(
                  profile.lastLogin,
                  locale,
                  t(
                    "adminUserDetail.fallbacks.unavailable"
                  )
                )}
              </dd>
            </div>

            <div>
              <dt>
                {t(
                  "adminUserDetail.profile.lastActivity"
                )}
              </dt>
              <dd>
                {formatDateTime(
                  summary.lastExecutionAt,
                  locale,
                  t(
                    "adminUserDetail.fallbacks.unavailable"
                  )
                )}
              </dd>
            </div>

          </dl>

        </div>

      </div>


      <div className="admin-user-kpis">

        <article>
          <span>
            {t(
              "adminUserDetail.summary.submissions"
            )}
          </span>
          <strong>
            {formatInteger(
              summary.submissionsCount
                || 0,
              locale
            )}
          </strong>
        </article>

        <article>
          <span>
            {t(
              "adminUserDetail.summary.executions"
            )}
          </span>
          <strong>
            {formatInteger(
              summary.executionsCount
                || 0,
              locale
            )}
          </strong>
        </article>

        <article>
          <span>
            {t(
              "adminUserDetail.summary.completed"
            )}
          </span>
          <strong>
            {formatInteger(
              summary.completedExecutions
                || 0,
              locale
            )}
          </strong>
        </article>

        <article>
          <span>
            {t(
              "adminUserDetail.summary.failed"
            )}
          </span>
          <strong>
            {formatInteger(
              summary.failedExecutions
                || 0,
              locale
            )}
          </strong>
        </article>

        <article>
          <span>
            {t(
              "adminUserDetail.summary.active"
            )}
          </span>
          <strong>
            {formatInteger(
              active,
              locale
            )}
          </strong>
        </article>

      </div>

    </section>
  );
}


function TabButton({
  active,
  children,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`admin-detail-tab ${
        active
          ? "admin-detail-tab--active"
          : ""
      }`}
      onClick={
        onClick
      }
      aria-pressed={
        active
      }
    >
      {children}
    </button>
  );
}


function ExecutionsTab({
  userId,
  summary,
  onOpenDetail,
}) {
  const {
    locale,
    t,
  } = useI18n();

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    total,
    setTotal,
  ] = useState(
    summary?.executionsCount
      || 0
  );

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    status,
    setStatus,
  ] = useState("all");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    reloadToken,
    setReloadToken,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);


  useEffect(() => {
    setPage(1);
  }, [
    status,
    search,
  ]);


  useEffect(() => {
    const controller =
      new AbortController();

    const timer =
      window.setTimeout(
        async () => {
          try {
            setLoading(true);
            setError(null);

            const params =
              new URLSearchParams({
                page:
                  String(page),
                page_size:
                  String(
                    PAGE_SIZE
                  ),
              });

            if (
              status !== "all"
            ) {
              params.set(
                "status",
                status
              );
            }

            if (
              search.trim()
            ) {
              params.set(
                "problem",
                search.trim()
              );
            }

            const data =
              await fetchJson(
                `/api/admin/users/${userId}/executions?${params.toString()}`,
                {
                  signal:
                    controller.signal,
                }
              );

            setItems(
              Array.isArray(
                data.items
              )
                ? data.items
                : []
            );

            setTotal(
              data.total
              ?? 0
            );
          } catch (err) {
            if (
              err.name
              === "AbortError"
            ) {
              return;
            }

            console.error(
              "[AdminUserDetail] Error cargando ejecuciones:",
              err
            );

            setError(err);
          } finally {
            if (
              !controller
                .signal
                .aborted
            ) {
              setLoading(false);
            }
          }
        },
        search.trim()
          ? 250
          : 0
      );

    return () => {
      window.clearTimeout(
        timer
      );

      controller.abort();
    };
  }, [
    userId,
    page,
    status,
    search,
    reloadToken,
  ]);


  const clearFilters =
    () => {
      setSearch("");
      setStatus("all");
      setPage(1);
    };


  const errorMessage =
    error
      ? adminDetailErrorMessage(
          error,
          t,
          "adminUserDetail.executions.errors.load"
        )
      : "";


  const stateOptions =
    localizedExecutionStateOptions(
      t
    );


  return (
    <div>

      <div className="admin-detail-section-header">

        <div>
          <h3>
            {t(
              "adminUserDetail.executions.title"
            )}
          </h3>
          <p>
            {t(
              "adminUserDetail.executions.description"
            )}
          </p>
        </div>


        <div className="admin-detail-inline-kpis">

          <span>
            <strong>
              {formatInteger(
                summary?.completedExecutions
                  || 0,
                locale
              )}
            </strong>
            {" "}
            {t(
              "adminUserDetail.executions.kpis.completed"
            )}
          </span>

          <span>
            <strong>
              {formatInteger(
                summary?.failedExecutions
                  || 0,
                locale
              )}
            </strong>
            {" "}
            {t(
              "adminUserDetail.executions.kpis.failed"
            )}
          </span>

          <span>
            <strong>
              {formatInteger(
                activeExecutions(
                  summary
                ),
                locale
              )}
            </strong>
            {" "}
            {t(
              "adminUserDetail.executions.kpis.active"
            )}
          </span>

        </div>

      </div>


      <div className="admin-detail-toolbar">

        <div className="admin-detail-search">

          <label
            htmlFor="admin-execution-search"
          >
            {t(
              "adminUserDetail.executions.searchLabel"
            )}
          </label>

          <input
            id="admin-execution-search"
            className="form-control"
            type="search"
            placeholder={t(
              "adminUserDetail.executions.searchPlaceholder"
            )}
            value={
              search
            }
            onChange={
              (event) =>
                setSearch(
                  event.target.value
                )
            }
          />

        </div>


        <div>

          <label
            htmlFor="admin-execution-status"
          >
            {t(
              "adminUserDetail.executions.statusLabel"
            )}
          </label>

          <select
            id="admin-execution-status"
            className="form-select"
            value={
              status
            }
            onChange={
              (event) =>
                setStatus(
                  event.target.value
                )
            }
          >
            {stateOptions.map(
              (option) => (
                <option
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {option.label}
                </option>
              )
            )}
          </select>

        </div>


        <button
          type="button"
          className="btn admin-detail-secondary-button"
          onClick={
            clearFilters
          }
          disabled={
            status === "all"
            && search.trim()
              === ""
          }
        >
          {t(
            "adminUserDetail.actions.clearFilters"
          )}
        </button>

      </div>


      {error && (
        <InlineState
          type="error"
          title={t(
            "adminUserDetail.executions.errors.title"
          )}
          description={
            errorMessage
          }
          actionLabel={t(
            "adminUserDetail.actions.retry"
          )}
          onAction={() =>
            setReloadToken(
              (value) =>
                value + 1
            )
          }
          compact
        />
      )}


      {!error
        && loading
        && items.length === 0
        && (
          <InlineState
            type="loading"
            title={t(
              "adminUserDetail.executions.loading.title"
            )}
            description={t(
              "adminUserDetail.executions.loading.description"
            )}
            compact
          />
        )}


      {!error
        && !loading
        && items.length === 0
        && (
          <InlineState
            type="empty"
            title={t(
              "adminUserDetail.executions.empty.title"
            )}
            description={
              status !== "all"
                || search.trim()
                ? t(
                    "adminUserDetail.executions.empty.filtered"
                  )
                : t(
                    "adminUserDetail.executions.empty.unfiltered"
                  )
            }
            actionLabel={
              status !== "all"
                || search.trim()
                ? t(
                    "adminUserDetail.actions.clearFilters"
                  )
                : undefined
            }
            onAction={
              status !== "all"
                || search.trim()
                ? clearFilters
                : undefined
            }
            compact
          />
        )}


      {!error
        && items.length > 0
        && (
          <>

            <div className="table-responsive admin-detail-table-shell">

              <table className="table align-middle admin-detail-table mb-0">

                <thead>
                  <tr>
                    <th>
                      {t(
                        "adminUserDetail.executions.table.execution"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUserDetail.executions.table.submission"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUserDetail.executions.table.state"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUserDetail.executions.table.duration"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUserDetail.executions.table.hardware"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUserDetail.executions.table.updated"
                      )}
                    </th>
                    <th className="text-end">
                      {t(
                        "adminUserDetail.executions.table.detail"
                      )}
                    </th>
                  </tr>
                </thead>


                <tbody>

                  {items.map(
                    (execution) => {
                      const state =
                        String(
                          execution.state
                            || ""
                        )
                          .toUpperCase();

                      const updatedAt =
                        execution.finishedAt
                        || execution.processingAt
                        || execution.startedAt;

                      return (
                        <tr
                          key={
                            execution.executionId
                          }
                        >

                          <td>
                            <div className="admin-detail-primary-cell">
                              <strong>
                                #{execution.executionId}
                              </strong>
                              <span>
                                {execution.codename
                                  || t(
                                    "adminUserDetail.executions.noCodename"
                                  )}
                              </span>
                            </div>
                          </td>


                          <td>
                            <Link
                              to={`/submissions/${encodeURIComponent(
                                String(
                                  execution.submissionId
                                )
                              )}`}
                              className="admin-detail-primary-cell admin-detail-submission-link"
                            >
                              <strong>
                                {execution.submissionTitle
                                  || t(
                                    "adminUserDetail.executions.submissionFallback",
                                    {
                                      id:
                                        execution.submissionId,
                                    }
                                  )}
                              </strong>
                              <span>
                                ID {execution.submissionId}
                              </span>
                            </Link>
                          </td>


                          <td>
                            <span
                              className={`app-status-badge ${executionStateBadgeClass(
                                state
                              )}`}
                            >
                              {localizedExecutionStateLabel(
                                state,
                                t,
                                t(
                                  "adminUserDetail.fallbacks.unavailable"
                                )
                              )}
                            </span>
                          </td>


                          <td>
                            {formatDuration(
                              execution.durationMs,
                              locale,
                              t(
                                "adminUserDetail.fallbacks.unavailable"
                              )
                            )}
                          </td>


                          <td>
                            {execution.hardwareProfile
                              || t(
                                "adminUserDetail.fallbacks.unavailable"
                              )}
                          </td>


                          <td>
                            {formatDateTime(
                              updatedAt,
                              locale,
                              t(
                                "adminUserDetail.fallbacks.unavailable"
                              )
                            )}
                          </td>


                          <td className="text-end">
                            <button
                              type="button"
                              className="btn btn-sm admin-detail-primary-button"
                              onClick={() =>
                                onOpenDetail(
                                  execution.executionId
                                )
                              }
                            >
                              {t(
                                "adminUserDetail.actions.viewDetail"
                              )}
                            </button>
                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>


            <Pagination
              page={
                page
              }
              total={
                total
              }
              onPageChange={
                setPage
              }
              disabled={
                loading
              }
            />

          </>
        )}

    </div>
  );
}


function submissionStatusLabel(
  submission,
  t
) {
  const completed =
    Number(
      submission?.completedExecutions
      || 0
    );

  const failed =
    Number(
      submission?.failedExecutions
      || 0
    );

  if (
    completed > 0
    && failed === 0
  ) {
    return t(
      "adminUserDetail.submissions.status.approved"
    );
  }

  if (
    completed === 0
    && failed > 0
  ) {
    return t(
      "adminUserDetail.submissions.status.errors"
    );
  }

  if (
    completed > 0
    && failed > 0
  ) {
    return t(
      "adminUserDetail.submissions.status.mixed"
    );
  }

  return t(
    "adminUserDetail.submissions.status.review"
  );
}


function SubmissionsTab({
  userId,
}) {
  const {
    locale,
    t,
  } = useI18n();

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    total,
    setTotal,
  ] = useState(0);

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    reloadToken,
    setReloadToken,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const controller =
      new AbortController();

    const timer =
      window.setTimeout(
        async () => {
          try {
            setLoading(true);
            setError(null);

            const params =
              new URLSearchParams({
                page:
                  String(page),
                page_size:
                  String(
                    PAGE_SIZE
                  ),
              });

            if (
              search.trim()
            ) {
              params.set(
                "problem",
                search.trim()
              );
            }

            const data =
              await fetchJson(
                `/api/admin/users/${userId}/submissions?${params.toString()}`,
                {
                  signal:
                    controller.signal,
                }
              );

            setItems(
              Array.isArray(
                data.items
              )
                ? data.items
                : []
            );

            setTotal(
              data.total
              ?? 0
            );
          } catch (err) {
            if (
              err.name
              === "AbortError"
            ) {
              return;
            }

            console.error(
              "[AdminUserDetail] Error cargando submissions:",
              err
            );

            setError(err);
          } finally {
            if (
              !controller
                .signal
                .aborted
            ) {
              setLoading(false);
            }
          }
        },
        search.trim()
          ? 250
          : 0
      );

    return () => {
      window.clearTimeout(
        timer
      );

      controller.abort();
    };
  }, [
    userId,
    page,
    search,
    reloadToken,
  ]);

  const errorMessage =
    error
      ? adminDetailErrorMessage(
          error,
          t,
          "adminUserDetail.submissions.errors.load"
        )
      : "";

  return (
    <div>

      <div className="admin-detail-section-header">
        <div>
          <h3>
            {t(
              "adminUserDetail.submissions.title"
            )}
          </h3>
          <p>
            {t(
              "adminUserDetail.submissions.description"
            )}
          </p>
        </div>

        <span className="admin-detail-total-chip">
          {t(
            "adminUserDetail.submissions.total",
            {
              count:
                formatInteger(
                  total,
                  locale
                ),
            }
          )}
        </span>
      </div>

      <div className="admin-detail-toolbar admin-detail-toolbar--compact">
        <div className="admin-detail-search">
          <label
            htmlFor="admin-submission-search"
          >
            {t(
              "adminUserDetail.submissions.searchLabel"
            )}
          </label>

          <input
            id="admin-submission-search"
            className="form-control"
            type="search"
            placeholder={t(
              "adminUserDetail.submissions.searchPlaceholder"
            )}
            value={
              search
            }
            onChange={
              (event) =>
                setSearch(
                  event.target.value
                )
            }
          />
        </div>

        <button
          type="button"
          className="btn admin-detail-secondary-button"
          onClick={() =>
            setSearch("")
          }
          disabled={
            !search.trim()
          }
        >
          {t(
            "adminUserDetail.actions.clearSearch"
          )}
        </button>
      </div>

      {error && (
        <InlineState
          type="error"
          title={t(
            "adminUserDetail.submissions.errors.title"
          )}
          description={
            errorMessage
          }
          actionLabel={t(
            "adminUserDetail.actions.retry"
          )}
          onAction={() =>
            setReloadToken(
              (value) =>
                value + 1
            )
          }
          compact
        />
      )}

      {!error
        && loading
        && items.length === 0
        && (
          <InlineState
            type="loading"
            title={t(
              "adminUserDetail.submissions.loading.title"
            )}
            description={t(
              "adminUserDetail.submissions.loading.description"
            )}
            compact
          />
        )}

      {!error
        && !loading
        && items.length === 0
        && (
          <InlineState
            type="empty"
            title={t(
              "adminUserDetail.submissions.empty.title"
            )}
            description={
              search.trim()
                ? t(
                    "adminUserDetail.submissions.empty.filtered"
                  )
                : t(
                    "adminUserDetail.submissions.empty.unfiltered"
                  )
            }
            actionLabel={
              search.trim()
                ? t(
                    "adminUserDetail.actions.clearSearch"
                  )
                : undefined
            }
            onAction={
              search.trim()
                ? () =>
                    setSearch("")
                : undefined
            }
            compact
          />
        )}

      {!error
        && items.length > 0
        && (
          <>
            <div className="table-responsive admin-detail-table-shell">
              <table className="table align-middle admin-detail-table mb-0">
                <thead>
                  <tr>
                    <th>
                      {t(
                        "adminUserDetail.submissions.table.submission"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUserDetail.submissions.table.status"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUserDetail.submissions.table.executions"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUserDetail.submissions.table.completed"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUserDetail.submissions.table.failed"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUserDetail.submissions.table.active"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUserDetail.submissions.table.created"
                      )}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {items.map(
                    (submission) => {
                      const active =
                        (submission.queuedExecutions
                          || 0)
                        + (submission.runningExecutions
                          || 0)
                        + (submission.processingExecutions
                          || 0);

                      return (
                        <tr
                          key={
                            submission.id
                          }
                        >
                          <td>
                            <Link
                              to={`/submissions/${encodeURIComponent(
                                String(
                                  submission.id
                                )
                              )}`}
                              className="admin-detail-primary-cell admin-detail-submission-link"
                            >
                              <strong>
                                {submission.title
                                  || t(
                                    "adminUserDetail.submissions.fallback",
                                    {
                                      id:
                                        submission.id,
                                    }
                                  )}
                              </strong>
                              <span>
                                ID {submission.id}
                              </span>
                            </Link>
                          </td>

                          <td>
                            <span className="admin-submission-status">
                              {submissionStatusLabel(
                                submission,
                                t
                              )}
                            </span>
                          </td>

                          <td>
                            {formatInteger(
                              submission.executionsCount
                                || 0,
                              locale
                            )}
                          </td>

                          <td>
                            {formatInteger(
                              submission.completedExecutions
                                || 0,
                              locale
                            )}
                          </td>

                          <td>
                            {formatInteger(
                              submission.failedExecutions
                                || 0,
                              locale
                            )}
                          </td>

                          <td>
                            {formatInteger(
                              active,
                              locale
                            )}
                          </td>

                          <td>
                            {formatDateTime(
                              submission.createdAt,
                              locale,
                              t(
                                "adminUserDetail.fallbacks.unavailable"
                              )
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              page={
                page
              }
              total={
                total
              }
              onPageChange={
                setPage
              }
              disabled={
                loading
              }
            />
          </>
        )}
    </div>
  );
}


function AuditTab({
  userId,
}) {
  const {
    locale,
    t,
  } = useI18n();

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    total,
    setTotal,
  ] = useState(0);

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    reloadToken,
    setReloadToken,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);

  useEffect(() => {
    const controller =
      new AbortController();

    const load =
      async () => {
        try {
          setLoading(true);
          setError(null);

          const params =
            new URLSearchParams({
              page:
                String(page),
              page_size:
                String(
                  PAGE_SIZE
                ),
            });

          const data =
            await fetchJson(
              `/api/admin/users/${userId}/audit-log?${params.toString()}`,
              {
                signal:
                  controller.signal,
              }
            );

          setItems(
            Array.isArray(
              data.items
            )
              ? data.items
              : []
          );

          setTotal(
            data.total
            ?? 0
          );
        } catch (err) {
          if (
            err.name
            === "AbortError"
          ) {
            return;
          }

          console.error(
            "[AdminUserDetail] Error cargando auditoría:",
            err
          );

          setError(err);
        } finally {
          if (
            !controller
              .signal
              .aborted
          ) {
            setLoading(false);
          }
        }
      };

    load();

    return () =>
      controller.abort();
  }, [
    userId,
    page,
    reloadToken,
  ]);

  const errorMessage =
    error
      ? adminDetailErrorMessage(
          error,
          t,
          "adminUserDetail.audit.errors.load"
        )
      : "";

  return (
    <div>
      <div className="admin-detail-section-header">
        <div>
          <h3>
            {t(
              "adminUserDetail.audit.title"
            )}
          </h3>
          <p>
            {t(
              "adminUserDetail.audit.description"
            )}
          </p>
        </div>

        <span className="admin-detail-total-chip">
          {t(
            "adminUserDetail.audit.total",
            {
              count:
                formatInteger(
                  total,
                  locale
                ),
            }
          )}
        </span>
      </div>

      {error && (
        <InlineState
          type="error"
          title={t(
            "adminUserDetail.audit.errors.title"
          )}
          description={
            errorMessage
          }
          actionLabel={t(
            "adminUserDetail.actions.retry"
          )}
          onAction={() =>
            setReloadToken(
              (value) =>
                value + 1
            )
          }
          compact
        />
      )}

      {!error
        && loading
        && items.length === 0
        && (
          <InlineState
            type="loading"
            title={t(
              "adminUserDetail.audit.loading.title"
            )}
            description={t(
              "adminUserDetail.audit.loading.description"
            )}
            compact
          />
        )}

      {!error
        && !loading
        && items.length === 0
        && (
          <InlineState
            type="empty"
            title={t(
              "adminUserDetail.audit.empty.title"
            )}
            description={t(
              "adminUserDetail.audit.empty.description"
            )}
            compact
          />
        )}

      {!error
        && items.length > 0
        && (
          <>
            <div className="admin-audit-list">
              {items.map(
                (item) => (
                  <article
                    key={
                      item.id
                    }
                    className="admin-audit-item"
                  >
                    <div
                      className="admin-audit-marker"
                      aria-hidden="true"
                    />

                    <div>
                      <div className="admin-audit-item-heading">
                        <strong>
                          {item.action
                            || t(
                              "adminUserDetail.audit.fallbackAction"
                            )}
                        </strong>

                        <span>
                          {formatDateTime(
                            item.createdAt,
                            locale,
                            t(
                              "adminUserDetail.fallbacks.unavailable"
                            )
                          )}
                        </span>
                      </div>

                      <p>
                        {item.description
                          || t(
                            "adminUserDetail.audit.fallbackDescription"
                          )}
                      </p>
                    </div>
                  </article>
                )
              )}
            </div>

            <Pagination
              page={
                page
              }
              total={
                total
              }
              onPageChange={
                setPage
              }
              disabled={
                loading
              }
            />
          </>
        )}
    </div>
  );
}


function ExecutionDetailModal({
  executionId,
  onClose,
}) {
  const {
    locale,
    t,
  } = useI18n();

  const [
    detail,
    setDetail,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);

  useEffect(() => {
    if (
      !executionId
    ) {
      return undefined;
    }

    const controller =
      new AbortController();

    const load =
      async () => {
        try {
          setLoading(true);
          setError(null);
          setDetail(null);

          const data =
            await fetchJson(
              `/api/admin/executions/${executionId}`,
              {
                signal:
                  controller.signal,
              }
            );

          setDetail(
            data.execution
            || null
          );
        } catch (err) {
          if (
            err.name
            === "AbortError"
          ) {
            return;
          }

          console.error(
            "[AdminUserDetail] Error cargando detalle de ejecución:",
            err
          );

          setError(err);
        } finally {
          if (
            !controller
              .signal
              .aborted
          ) {
            setLoading(false);
          }
        }
      };

    load();

    return () =>
      controller.abort();
  }, [executionId]);

  useEffect(() => {
    const onKeyDown =
      (event) => {
        if (
          event.key
          === "Escape"
        ) {
          onClose();
        }
      };

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () =>
      window.removeEventListener(
        "keydown",
        onKeyDown
      );
  }, [onClose]);

  if (
    !executionId
  ) {
    return null;
  }

  const state =
    String(
      detail?.state
      || ""
    )
      .toUpperCase();

  const measurement =
    detail?.executionConfig
      ?.measurement
    || {};

  const hardware =
    detail?.hardwareSnapshot
    || {};

  const node =
    hardware.node
    || {};

  const hardwareMeasurement =
    hardware.measurement
    || {};

  const failure =
    detail?.failure
    || null;

  const errorMessage =
    error
      ? adminDetailErrorMessage(
          error,
          t,
          "adminUserDetail.modal.errors.load"
        )
      : "";

  return (
    <div
      className="admin-execution-modal-backdrop"
      role="presentation"
      onMouseDown={
        (event) => {
          if (
            event.target
            === event.currentTarget
          ) {
            onClose();
          }
        }
      }
    >
      <section
        className="admin-execution-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-execution-modal-title"
      >
        <header className="admin-execution-modal-header">
          <div>
            <p>
              {t(
                "adminUserDetail.modal.eyebrow"
              )}
            </p>
            <h2 id="admin-execution-modal-title">
              {t(
                "adminUserDetail.modal.title",
                {
                  id:
                    executionId,
                }
              )}
            </h2>
          </div>

          <button
            type="button"
            className="admin-execution-modal-close"
            onClick={
              onClose
            }
            aria-label={t(
              "adminUserDetail.modal.closeAria"
            )}
          >
            ×
          </button>
        </header>

        <div className="admin-execution-modal-body">
          {loading && (
            <InlineState
              type="loading"
              title={t(
                "adminUserDetail.modal.loading.title"
              )}
              description={t(
                "adminUserDetail.modal.loading.description"
              )}
              compact
            />
          )}

          {error && (
            <InlineState
              type="error"
              title={t(
                "adminUserDetail.modal.errors.title"
              )}
              description={
                errorMessage
              }
              compact
            />
          )}

          {!loading
            && !error
            && detail
            && (
              <>
                <div className="admin-execution-modal-summary">
                  <div>
                    <span>
                      {t(
                        "adminUserDetail.modal.summary.submission"
                      )}
                    </span>
                    <strong>
                      {detail.submissionTitle
                        || t(
                          "adminUserDetail.modal.submissionFallback",
                          {
                            id:
                              detail.submissionId,
                          }
                        )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t(
                        "adminUserDetail.modal.summary.benchmark"
                      )}
                    </span>
                    <strong>
                      {detail.benchmark
                        || t(
                          "adminUserDetail.fallbacks.unavailable"
                        )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t(
                        "adminUserDetail.modal.summary.state"
                      )}
                    </span>
                    <strong>
                      <span
                        className={`app-status-badge ${executionStateBadgeClass(
                          state
                        )}`}
                      >
                        {localizedExecutionStateLabel(
                          state,
                          t,
                          t(
                            "adminUserDetail.fallbacks.unavailable"
                          )
                        )}
                      </span>
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t(
                        "adminUserDetail.modal.summary.duration"
                      )}
                    </span>
                    <strong>
                      {formatDuration(
                        detail.durationMs,
                        locale,
                        t(
                          "adminUserDetail.fallbacks.unavailable"
                        )
                      )}
                    </strong>
                  </div>
                </div>

                <div className="admin-execution-detail-grid">
                  <article>
                    <h3>
                      {t(
                        "adminUserDetail.modal.configuration.title"
                      )}
                    </h3>

                    <dl>
                      <div>
                        <dt>
                          {t(
                            "adminUserDetail.modal.configuration.input"
                          )}
                        </dt>
                        <dd>
                          {detail.inputSize
                            ?? t(
                              "adminUserDetail.fallbacks.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "adminUserDetail.modal.configuration.samplesPerPoint"
                          )}
                        </dt>
                        <dd>
                          {measurement.samples_per_point
                            ?? detail.samples
                            ?? t(
                              "adminUserDetail.fallbacks.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "adminUserDetail.modal.configuration.points"
                          )}
                        </dt>
                        <dd>
                          {measurement.points
                            ?? t(
                              "adminUserDetail.fallbacks.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "adminUserDetail.modal.configuration.warmup"
                          )}
                        </dt>
                        <dd>
                          {measurement.warmup_rounds
                            ?? t(
                              "adminUserDetail.fallbacks.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "adminUserDetail.modal.configuration.profile"
                          )}
                        </dt>
                        <dd>
                          {detail.executionProfile
                            || t(
                              "adminUserDetail.fallbacks.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "adminUserDetail.modal.configuration.compilation"
                          )}
                        </dt>
                        <dd>
                          {detail.executionConfig
                            ?.compiler_flags
                            || t(
                              "adminUserDetail.fallbacks.unavailable"
                            )}
                        </dd>
                      </div>
                    </dl>
                  </article>

                  <article>
                    <h3>
                      {t(
                        "adminUserDetail.modal.hardware.title"
                      )}
                    </h3>

                    <dl>
                      <div>
                        <dt>
                          {t(
                            "adminUserDetail.modal.hardware.cpu"
                          )}
                        </dt>
                        <dd>
                          {node.cpu_model
                            || detail.hardwareProfile
                            || t(
                              "adminUserDetail.fallbacks.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "adminUserDetail.modal.hardware.architecture"
                          )}
                        </dt>
                        <dd>
                          {node.architecture
                            || t(
                              "adminUserDetail.fallbacks.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "adminUserDetail.modal.hardware.logicalCpus"
                          )}
                        </dt>
                        <dd>
                          {node.logical_cpus
                            ?? t(
                              "adminUserDetail.fallbacks.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "adminUserDetail.modal.hardware.backend"
                          )}
                        </dt>
                        <dd>
                          {hardwareMeasurement.backend
                            || t(
                              "adminUserDetail.fallbacks.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "adminUserDetail.modal.hardware.scope"
                          )}
                        </dt>
                        <dd>
                          {hardwareMeasurement.requested_perf_scope
                            || measurement.perf_scope
                            || t(
                              "adminUserDetail.fallbacks.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "adminUserDetail.modal.hardware.result"
                          )}
                        </dt>
                        <dd>
                          {detail.resultAvailable
                            ? t(
                                "adminUserDetail.modal.hardware.available"
                              )
                            : t(
                                "adminUserDetail.modal.hardware.unavailable"
                              )}
                        </dd>
                      </div>
                    </dl>
                  </article>
                </div>

                {failure && (
                  <article className="admin-execution-failure">
                    <h3>
                      {t(
                        "adminUserDetail.modal.failure.title"
                      )}
                    </h3>

                    <div>
                      <strong>
                        {failure.code
                          || t(
                            "adminUserDetail.modal.failure.noCode"
                          )}
                      </strong>

                      <span>
                        {failure.stage
                          || t(
                            "adminUserDetail.modal.failure.unknownStage"
                          )}
                      </span>
                    </div>

                    <p>
                      {failure.message
                        || t(
                          "adminUserDetail.modal.failure.noMessage"
                        )}
                    </p>
                  </article>
                )}

                <div className="admin-execution-timestamps">
                  <span>
                    {t(
                      "adminUserDetail.modal.timestamps.started",
                      {
                        date:
                          formatDateTime(
                            detail.startedAt,
                            locale,
                            t(
                              "adminUserDetail.fallbacks.unavailable"
                            )
                          ),
                      }
                    )}
                  </span>

                  <span>
                    {t(
                      "adminUserDetail.modal.timestamps.processing",
                      {
                        date:
                          formatDateTime(
                            detail.processingAt,
                            locale,
                            t(
                              "adminUserDetail.fallbacks.unavailable"
                            )
                          ),
                      }
                    )}
                  </span>

                  <span>
                    {t(
                      "adminUserDetail.modal.timestamps.finished",
                      {
                        date:
                          formatDateTime(
                            detail.finishedAt,
                            locale,
                            t(
                              "adminUserDetail.fallbacks.unavailable"
                            )
                          ),
                      }
                    )}
                  </span>
                </div>
              </>
            )}
        </div>

        <footer className="admin-execution-modal-footer">
          <button
            type="button"
            className="btn admin-detail-secondary-button"
            onClick={
              onClose
            }
          >
            {t(
              "adminUserDetail.actions.close"
            )}
          </button>

          <div className="admin-execution-modal-actions">
            {detail?.submissionId
              !== null
              && detail?.submissionId
                !== undefined
              && (
                <Link
                  to={`/submissions/${encodeURIComponent(
                    String(
                      detail.submissionId
                    )
                  )}`}
                  className="btn admin-detail-secondary-button"
                >
                  {t(
                    "adminUserDetail.actions.viewExperiment"
                  )}
                </Link>
              )}

            {detail?.resultAvailable
              && detail?.codename
              && (
                <Link
                  to={`/code/${detail.codename}`}
                  className="btn admin-detail-primary-button"
                >
                  {t(
                    "adminUserDetail.actions.viewResults"
                  )}
                </Link>
              )}
          </div>
        </footer>
      </section>
    </div>
  );
}


const AdminUserDetail = () => {
  const {
    id,
  } = useParams();

  const navigate =
    useNavigate();

  const {
    locale,
    t,
  } = useI18n();

  const [
    activeTab,
    setActiveTab,
  ] = useState(
    "executions"
  );

  const [
    profile,
    setProfile,
  ] = useState(null);

  const [
    summary,
    setSummary,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);

  const [
    reloadToken,
    setReloadToken,
  ] = useState(0);

  const [
    executionId,
    setExecutionId,
  ] = useState(null);


  const closeExecutionDetail =
    useCallback(
      () => {
        setExecutionId(null);
      },
      []
    );


  useEffect(() => {
    if (!id) {
      return undefined;
    }

    const controller =
      new AbortController();

    const load =
      async () => {
        try {
          setLoading(true);
          setError(null);

          const data =
            await fetchJson(
              `/api/admin/users/${id}`,
              {
                signal:
                  controller.signal,
              }
            );

          const rawProfile =
            data.profile || {};

          const rawSummary =
            data.summary || {};

          setProfile({
            id:
              rawProfile.id,
            fullName:
              rawProfile.full_name
              || rawProfile.fullName
              || "",
            email:
              rawProfile.email
              || "",
            role:
              rawProfile.role
              || rawProfile.role_name
              || "",
            isActive:
              typeof rawProfile.isActive
                === "boolean"
                ? rawProfile.isActive
                : null,
            createdAt:
              rawProfile.createdAt,
            lastLogin:
              rawProfile.lastLogin,
          });

          setSummary({
            submissionsCount:
              rawSummary.submissionsCount
              || 0,
            executionsCount:
              rawSummary.executionsCount
              || 0,
            completedExecutions:
              rawSummary.completedExecutions
              || rawSummary.okExecutions
              || 0,
            failedExecutions:
              rawSummary.failedExecutions
              || (
                (rawSummary.timeoutExecutions
                  || 0)
                + (rawSummary.errorExecutions
                  || 0)
              ),
            queuedExecutions:
              rawSummary.queuedExecutions
              || 0,
            runningExecutions:
              rawSummary.runningExecutions
              || 0,
            processingExecutions:
              rawSummary.processingExecutions
              || 0,
            cancelledExecutions:
              rawSummary.cancelledExecutions
              || 0,
            lastExecutionAt:
              rawSummary.lastExecutionAt
              || null,
          });
        } catch (err) {
          if (
            err.name
            === "AbortError"
          ) {
            return;
          }

          console.error(
            "[AdminUserDetail] Error cargando perfil:",
            err
          );

          setError(err);
        } finally {
          if (
            !controller
              .signal
              .aborted
          ) {
            setLoading(false);
          }
        }
      };

    load();

    return () =>
      controller.abort();
  }, [
    id,
    reloadToken,
  ]);


  useEffect(() => {
    setActiveTab(
      "executions"
    );
    setExecutionId(null);
  }, [id]);


  const tabs =
    useMemo(
      () => [
        {
          value:
            "executions",
          label:
            t(
              "adminUserDetail.tabs.executions"
            ),
          count:
            summary?.executionsCount
            || 0,
        },
        {
          value:
            "submissions",
          label:
            t(
              "adminUserDetail.tabs.submissions"
            ),
          count:
            summary?.submissionsCount
            || 0,
        },
        {
          value:
            "audit",
          label:
            t(
              "adminUserDetail.tabs.audit"
            ),
          count:
            null,
        },
      ],
      [
        summary,
        t,
      ]
    );


  const errorMessage =
    error
      ? adminDetailErrorMessage(
          error,
          t,
          "adminUserDetail.errors.load"
        )
      : "";


  return (
    <div className="app-page admin-page admin-user-detail-page container-fluid py-4">

      <div className="row justify-content-center">

        <div className="col-12 col-xxl-11">

          <header className="admin-user-detail-header">

            <div>

              <button
                type="button"
                className="admin-detail-back"
                onClick={() =>
                  navigate(
                    "/admin/users"
                  )
                }
              >
                {t(
                  "adminUserDetail.actions.back"
                )}
              </button>

              <p className="admin-user-detail-eyebrow">
                {t(
                  "adminUserDetail.header.eyebrow"
                )}
              </p>

              <h1>
                {t(
                  "adminUserDetail.header.title"
                )}
              </h1>

              <p>
                {t(
                  "adminUserDetail.header.description"
                )}
              </p>

            </div>

          </header>


          {loading
            && !profile
            && (
              <InlineState
                type="loading"
                title={t(
                  "adminUserDetail.loading.title"
                )}
                description={t(
                  "adminUserDetail.loading.description"
                )}
              />
            )}


          {error
            && !profile
            && (
              <InlineState
                type="error"
                title={t(
                  "adminUserDetail.errors.title"
                )}
                description={
                  errorMessage
                }
                actionLabel={t(
                  "adminUserDetail.actions.retry"
                )}
                onAction={() =>
                  setReloadToken(
                    (value) =>
                      value + 1
                  )
                }
              />
            )}


          {profile
            && summary
            && (
              <>

                <ProfileOverview
                  profile={
                    profile
                  }
                  summary={
                    summary
                  }
                />


                <section className="admin-user-detail-content">

                  <nav
                    className="admin-detail-tabs"
                    aria-label={t(
                      "adminUserDetail.tabs.aria"
                    )}
                  >

                    {tabs.map(
                      (tab) => (
                        <TabButton
                          key={
                            tab.value
                          }
                          active={
                            activeTab
                              === tab.value
                          }
                          onClick={() =>
                            setActiveTab(
                              tab.value
                            )
                          }
                        >
                          <span>
                            {tab.label}
                          </span>

                          {tab.count
                            !== null
                            && (
                              <span className="admin-detail-tab-count">
                                {formatInteger(
                                  tab.count,
                                  locale
                                )}
                              </span>
                            )}
                        </TabButton>
                      )
                    )}

                  </nav>


                  <div className="admin-detail-tab-panel">

                    {activeTab
                      === "executions"
                      && (
                        <ExecutionsTab
                          userId={
                            id
                          }
                          summary={
                            summary
                          }
                          onOpenDetail={
                            setExecutionId
                          }
                        />
                      )}


                    {activeTab
                      === "submissions"
                      && (
                        <SubmissionsTab
                          userId={
                            id
                          }
                        />
                      )}


                    {activeTab
                      === "audit"
                      && (
                        <AuditTab
                          userId={
                            id
                          }
                        />
                      )}

                  </div>

                </section>

              </>
            )}

        </div>

      </div>


      <ExecutionDetailModal
        executionId={
          executionId
        }
        onClose={
          closeExecutionDetail
        }
      />

    </div>
  );
};


export default AdminUserDetail;
