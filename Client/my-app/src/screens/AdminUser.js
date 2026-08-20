import InlineState from "../components/InlineState";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./AdminUser.css";

import {
  useI18n,
} from "../i18n";
import {
  formatDateTime,
} from "../i18n/formatters";

import {
  adminAccountStatusBadgeClass,
  adminAccountStatusLabel,
  adminRoleLabel,
  executionStateBadgeClass,
  localizedAdminUserLastExecutionLabel,
} from "./adminExecutionStateModel";


const PAGE_SIZES = [
  15,
  25,
  50,
];


function countKey(
  count,
  base
) {
  return `${base}.${
    Number(count) === 1
      ? "one"
      : "other"
  }`;
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


function adminUserErrorMessage(
  error,
  t
) {
  const status =
    Number(error?.status);

  if (
    !Number.isFinite(status)
  ) {
    return t(
      "adminUsers.errors.network"
    );
  }

  if (status === 401) {
    return t(
      "adminUsers.errors.session"
    );
  }

  if (status === 403) {
    return t(
      "adminUsers.errors.forbidden"
    );
  }

  if (status >= 500) {
    return t(
      "adminUsers.errors.service"
    );
  }

  return t(
    "adminUsers.errors.generic"
  );
}


function getRoleClass(
  role
) {
  if (role === "Admin") {
    return "admin-user-role--admin";
  }

  if (role === "Teacher") {
    return "admin-user-role--teacher";
  }

  return "admin-user-role--student";
}


function activeExecutionCount(
  user
) {
  return (
    (user.queuedExecutions || 0)
    + (user.runningExecutions || 0)
    + (user.processingExecutions || 0)
  );
}


function userInitials(
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


const AdminUser = () => {
  const {
    locale,
    t,
  } = useI18n();

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    role,
    setRole,
  ] = useState("all");

  const [
    status,
    setStatus,
  ] = useState("all");

  const [
    sortBy,
    setSortBy,
  ] = useState(
    "lastActivity"
  );

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    pageSize,
    setPageSize,
  ] = useState(15);

  const [
    users,
    setUsers,
  ] = useState([]);

  const [
    summary,
    setSummary,
  ] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });

  const [
    filteredTotal,
    setFilteredTotal,
  ] = useState(0);

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


  const hasFilters =
    search.trim() !== ""
    || role !== "all"
    || status !== "all";


  useEffect(() => {
    setPage(1);
  }, [
    search,
    role,
    status,
    sortBy,
    pageSize,
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
                  String(pageSize),
                sort_by:
                  sortBy,
                sort_dir:
                  sortBy === "name"
                    ? "asc"
                    : "desc",
              });

            const trimmedSearch =
              search.trim();

            if (trimmedSearch) {
              params.set(
                "search",
                trimmedSearch
              );
            }

            if (
              role !== "all"
            ) {
              params.set(
                "role",
                role
              );
            }

            if (
              status !== "all"
            ) {
              params.set(
                "status",
                status
              );
            }

            const response =
              await fetch(
                `/api/admin/users?${params.toString()}`,
                {
                  credentials:
                    "include",
                  signal:
                    controller.signal,
                }
              );

            if (
              !response.ok
            ) {
              const requestError =
                new Error(
                  `HTTP ${response.status}`
                );

              requestError.status =
                response.status;

              throw requestError;
            }

            const data =
              await response.json();

            const items =
              Array.isArray(
                data.items
              )
                ? data.items
                : [];

            setUsers(items);

            setSummary({
              total:
                data.summary?.total
                ?? 0,
              active:
                data.summary?.active
                ?? 0,
              inactive:
                data.summary?.inactive
                ?? 0,
            });

            setFilteredTotal(
              data.total
              ?? data.filteredTotal
              ?? data.summary?.total
              ?? items.length
            );
          } catch (err) {
            if (
              err.name
              === "AbortError"
            ) {
              return;
            }

            console.error(
              "[AdminUser] Error al cargar usuarios:",
              err
            );

            setUsers([]);
            setFilteredTotal(0);
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
    search,
    role,
    status,
    sortBy,
    page,
    pageSize,
    reloadToken,
  ]);


  const errorMessage =
    error
      ? adminUserErrorMessage(
          error,
          t
        )
      : "";


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredTotal
        / pageSize
      )
    );


  const visibleRange =
    useMemo(
      () => {
        if (
          filteredTotal === 0
        ) {
          return {
            first: 0,
            last: 0,
          };
        }

        return {
          first:
            (page - 1)
            * pageSize
            + 1,
          last:
            Math.min(
              page * pageSize,
              filteredTotal
            ),
        };
      },
      [
        filteredTotal,
        page,
        pageSize,
      ]
    );


  const handleClearFilters =
    () => {
      setSearch("");
      setRole("all");
      setStatus("all");
      setSortBy(
        "lastActivity"
      );
      setPage(1);
    };


  const handleRetry =
    () => {
      setReloadToken(
        (value) =>
          value + 1
      );
    };


  const goToPreviousPage =
    () => {
      setPage(
        (current) =>
          Math.max(
            1,
            current - 1
          )
      );
    };


  const goToNextPage =
    () => {
      setPage(
        (current) =>
          Math.min(
            totalPages,
            current + 1
          )
      );
    };


  return (
    <div className="app-page admin-page container-fluid py-4">

      <div className="row justify-content-center">

        <div className="col-12 col-xxl-11">

          <header className="admin-users-header">
            <div>

              <p className="admin-users-eyebrow mb-1">
                {t(
                  "adminUsers.header.eyebrow"
                )}
              </p>

              <h1 className="app-title admin-users-title mb-1">
                {t(
                  "adminUsers.header.title"
                )}
              </h1>

              <p className="admin-subtitle mb-0">
                {t(
                  "adminUsers.header.description"
                )}
              </p>

            </div>
          </header>


          <section
            className="admin-summary-grid"
            aria-label={t(
              "adminUsers.summary.aria"
            )}
          >

            <article className="admin-summary-card">
              <span className="admin-summary-label">
                {t(
                  "adminUsers.summary.total"
                )}
              </span>
              <strong>
                {formatInteger(
                  summary.total,
                  locale
                )}
              </strong>
              <span className="admin-summary-caption">
                {t(
                  "adminUsers.summary.totalCaption"
                )}
              </span>
            </article>


            <article className="admin-summary-card">
              <span className="admin-summary-label">
                {t(
                  "adminUsers.summary.active"
                )}
              </span>
              <strong>
                {formatInteger(
                  summary.active,
                  locale
                )}
              </strong>
              <span className="admin-summary-caption">
                {t(
                  "adminUsers.summary.activeCaption"
                )}
              </span>
            </article>


            <article className="admin-summary-card">
              <span className="admin-summary-label">
                {t(
                  "adminUsers.summary.inactive"
                )}
              </span>
              <strong>
                {formatInteger(
                  summary.inactive,
                  locale
                )}
              </strong>
              <span className="admin-summary-caption">
                {t(
                  "adminUsers.summary.inactiveCaption"
                )}
              </span>
            </article>


            <article className="admin-summary-card">
              <span className="admin-summary-label">
                {hasFilters
                  ? t(
                      "adminUsers.summary.results"
                    )
                  : t(
                      "adminUsers.summary.visible"
                    )}
              </span>

              <strong>
                {formatInteger(
                  filteredTotal,
                  locale
                )}
              </strong>

              <span className="admin-summary-caption">
                {hasFilters
                  ? t(
                      "adminUsers.summary.filteredCaption"
                    )
                  : t(
                      "adminUsers.summary.visibleCaption"
                    )}
              </span>
            </article>

          </section>


          <section className="admin-filter-panel">

            <div className="admin-filter-grid">

              <div className="admin-filter-search">

                <label
                  className="form-label app-label-sm"
                  htmlFor="admin-user-search"
                >
                  {t(
                    "adminUsers.filters.search"
                  )}
                </label>

                <input
                  id="admin-user-search"
                  type="search"
                  className="form-control"
                  placeholder={t(
                    "adminUsers.filters.searchPlaceholder"
                  )}
                  value={search}
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
                  className="form-label app-label-sm"
                  htmlFor="admin-role-filter"
                >
                  {t(
                    "adminUsers.filters.role"
                  )}
                </label>

                <select
                  id="admin-role-filter"
                  className="form-select"
                  value={role}
                  onChange={
                    (event) =>
                      setRole(
                        event.target.value
                      )
                  }
                >
                  <option value="all">
                    {t(
                      "adminUsers.filters.roleAll"
                    )}
                  </option>
                  <option value="Student">
                    {adminRoleLabel(
                      "Student",
                      t
                    )}
                  </option>
                  <option value="Teacher">
                    {adminRoleLabel(
                      "Teacher",
                      t
                    )}
                  </option>
                  <option value="Admin">
                    {adminRoleLabel(
                      "Admin",
                      t
                    )}
                  </option>
                </select>

              </div>


              <div>

                <label
                  className="form-label app-label-sm"
                  htmlFor="admin-status-filter"
                >
                  {t(
                    "adminUsers.filters.status"
                  )}
                </label>

                <select
                  id="admin-status-filter"
                  className="form-select"
                  value={status}
                  onChange={
                    (event) =>
                      setStatus(
                        event.target.value
                      )
                  }
                >
                  <option value="all">
                    {t(
                      "adminUsers.filters.statusAll"
                    )}
                  </option>
                  <option value="active">
                    {adminAccountStatusLabel(
                      true,
                      t
                    )}
                  </option>
                  <option value="inactive">
                    {adminAccountStatusLabel(
                      false,
                      t
                    )}
                  </option>
                </select>

              </div>


              <div>

                <label
                  className="form-label app-label-sm"
                  htmlFor="admin-sort-filter"
                >
                  {t(
                    "adminUsers.filters.sort"
                  )}
                </label>

                <select
                  id="admin-sort-filter"
                  className="form-select"
                  value={sortBy}
                  onChange={
                    (event) =>
                      setSortBy(
                        event.target.value
                      )
                  }
                >
                  <option value="lastActivity">
                    {t(
                      "adminUsers.filters.sortRecent"
                    )}
                  </option>
                  <option value="name">
                    {t(
                      "adminUsers.filters.sortName"
                    )}
                  </option>
                  <option value="createdAt">
                    {t(
                      "adminUsers.filters.sortCreated"
                    )}
                  </option>
                </select>

              </div>


              <button
                type="button"
                className="btn admin-clear-button"
                onClick={
                  handleClearFilters
                }
                disabled={
                  !hasFilters
                  && sortBy
                    === "lastActivity"
                }
              >
                {t(
                  "adminUsers.filters.clear"
                )}
              </button>

            </div>

          </section>


          <section className="admin-users-card">

            <div className="table-responsive">

              <table className="table align-middle admin-users-table mb-0">

                <thead>
                  <tr>
                    <th>
                      {t(
                        "adminUsers.table.user"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUsers.table.role"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUsers.table.account"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUsers.table.activity"
                      )}
                    </th>
                    <th>
                      {t(
                        "adminUsers.table.lastExecution"
                      )}
                    </th>
                    <th className="text-end">
                      {t(
                        "adminUsers.table.action"
                      )}
                    </th>
                  </tr>
                </thead>


                <tbody>

                  {loading
                    && users.length === 0
                    && (
                      <tr>
                        <td
                          colSpan="6"
                          className="py-4"
                        >
                          <InlineState
                            type="loading"
                            title={t(
                              "adminUsers.loading.title"
                            )}
                            description={t(
                              "adminUsers.loading.description"
                            )}
                            compact
                          />
                        </td>
                      </tr>
                    )}


                  {!loading
                    && error
                    && (
                      <tr>
                        <td
                          colSpan="6"
                          className="py-4"
                        >
                          <InlineState
                            type="error"
                            title={t(
                              "adminUsers.errors.title"
                            )}
                            description={
                              errorMessage
                            }
                            actionLabel={t(
                              "adminUsers.actions.retry"
                            )}
                            onAction={
                              handleRetry
                            }
                            compact
                          />
                        </td>
                      </tr>
                    )}


                  {!error
                    && users.map(
                      (user) => {
                        const activeExecutions =
                          activeExecutionCount(
                            user
                          );

                        return (
                          <tr key={user.id}>

                            <td>
                              <div className="admin-user-identity">

                                <div
                                  className="admin-user-avatar"
                                  aria-hidden="true"
                                >
                                  {userInitials(
                                    user.name
                                  )}
                                </div>


                                <div className="admin-user-identity-copy">

                                  <Link
                                    to={`/admin/users/${user.id}`}
                                    className="admin-user-name"
                                  >
                                    {user.name
                                      || t(
                                        "adminUsers.fallbacks.name"
                                      )}
                                  </Link>

                                  <span>
                                    {user.email
                                      || t(
                                        "adminUsers.fallbacks.email"
                                      )}
                                  </span>

                                  <small>
                                    {t(
                                      "adminUsers.created",
                                      {
                                        date:
                                          formatDateTime(
                                            user.createdAt,
                                            locale,
                                            t(
                                              "adminUsers.fallbacks.unavailable"
                                            )
                                          ),
                                      }
                                    )}
                                  </small>

                                </div>

                              </div>
                            </td>


                            <td>
                              <span
                                className={`admin-user-role ${getRoleClass(
                                  user.role
                                )}`}
                              >
                                {adminRoleLabel(
                                  user.role,
                                  t
                                )}
                              </span>
                            </td>


                            <td>
                              <span
                                className={`app-status-badge ${adminAccountStatusBadgeClass(
                                  user.isActive
                                )}`}
                              >
                                {adminAccountStatusLabel(
                                  user.isActive,
                                  t
                                )}
                              </span>
                            </td>


                            <td>

                              <div className="admin-activity-main">

                                {t(
                                  countKey(
                                    user.submissionsCount
                                      || 0,
                                    "adminUsers.activity.submissions"
                                  ),
                                  {
                                    count:
                                      formatInteger(
                                        user.submissionsCount
                                          || 0,
                                        locale
                                      ),
                                  }
                                )}

                                <span aria-hidden="true">
                                  {" · "}
                                </span>

                                {t(
                                  countKey(
                                    user.executionsCount
                                      || 0,
                                    "adminUsers.activity.executions"
                                  ),
                                  {
                                    count:
                                      formatInteger(
                                        user.executionsCount
                                          || 0,
                                        locale
                                      ),
                                  }
                                )}

                              </div>


                              <div className="admin-activity-meta">

                                {t(
                                  countKey(
                                    user.completedExecutions
                                      || 0,
                                    "adminUsers.activity.completed"
                                  ),
                                  {
                                    count:
                                      formatInteger(
                                        user.completedExecutions
                                          || 0,
                                        locale
                                      ),
                                  }
                                )}

                                <span aria-hidden="true">
                                  {" · "}
                                </span>

                                {t(
                                  countKey(
                                    user.failedExecutions
                                      || 0,
                                    "adminUsers.activity.failed"
                                  ),
                                  {
                                    count:
                                      formatInteger(
                                        user.failedExecutions
                                          || 0,
                                        locale
                                      ),
                                  }
                                )}

                                {activeExecutions
                                  > 0
                                  && (
                                    <>
                                      <span aria-hidden="true">
                                        {" · "}
                                      </span>

                                      {t(
                                        countKey(
                                          activeExecutions,
                                          "adminUsers.activity.active"
                                        ),
                                        {
                                          count:
                                            formatInteger(
                                              activeExecutions,
                                              locale
                                            ),
                                        }
                                      )}
                                    </>
                                  )}

                              </div>

                            </td>


                            <td>

                              {user.lastExecutionState
                                ? (
                                    <div className="admin-last-execution">

                                      <span
                                        className={`app-status-badge ${executionStateBadgeClass(
                                          user.lastExecutionState
                                        )}`}
                                      >
                                        {localizedAdminUserLastExecutionLabel(
                                          user,
                                          t
                                        )}
                                      </span>

                                      <small>
                                        {formatDateTime(
                                          user.lastExecutionAt,
                                          locale,
                                          t(
                                            "adminUsers.fallbacks.unavailable"
                                          )
                                        )}
                                      </small>

                                    </div>
                                  )
                                : (
                                    <span className="admin-empty-value">
                                      {localizedAdminUserLastExecutionLabel(
                                        user,
                                        t
                                      )}
                                    </span>
                                  )}

                            </td>


                            <td className="text-end">
                              <Link
                                to={`/admin/users/${user.id}`}
                                className="btn btn-sm admin-detail-button"
                              >
                                {t(
                                  "adminUsers.actions.viewUser"
                                )}
                              </Link>
                            </td>

                          </tr>
                        );
                      }
                    )}


                  {!loading
                    && !error
                    && users.length === 0
                    && (
                      <tr>
                        <td
                          colSpan="6"
                          className="py-4"
                        >
                          <InlineState
                            type="empty"
                            title={t(
                              "adminUsers.empty.title"
                            )}
                            description={
                              hasFilters
                                ? t(
                                    "adminUsers.empty.filtered"
                                  )
                                : t(
                                    "adminUsers.empty.unfiltered"
                                  )
                            }
                            actionLabel={
                              hasFilters
                                ? t(
                                    "adminUsers.actions.clearFilters"
                                  )
                                : undefined
                            }
                            onAction={
                              hasFilters
                                ? handleClearFilters
                                : undefined
                            }
                            compact
                          />
                        </td>
                      </tr>
                    )}

                </tbody>

              </table>

            </div>


            <footer className="admin-pagination">

              <div className="admin-pagination-summary">

                <span>
                  {filteredTotal === 0
                    ? t(
                        "adminUsers.pagination.zero"
                      )
                    : t(
                        "adminUsers.pagination.range",
                        {
                          first:
                            formatInteger(
                              visibleRange.first,
                              locale
                            ),
                          last:
                            formatInteger(
                              visibleRange.last,
                              locale
                            ),
                          total:
                            formatInteger(
                              filteredTotal,
                              locale
                            ),
                        }
                      )}
                </span>


                <label>

                  <span>
                    {t(
                      "adminUsers.pagination.rows"
                    )}
                  </span>

                  <select
                    className="form-select form-select-sm"
                    value={
                      pageSize
                    }
                    onChange={
                      (event) =>
                        setPageSize(
                          Number(
                            event.target.value
                          )
                        )
                    }
                    aria-label={t(
                      "adminUsers.pagination.pageSizeAria"
                    )}
                  >
                    {PAGE_SIZES.map(
                      (size) => (
                        <option
                          key={size}
                          value={size}
                        >
                          {size}
                        </option>
                      )
                    )}
                  </select>

                </label>

              </div>


              <div className="admin-pagination-controls">

                <button
                  type="button"
                  className="btn btn-sm admin-page-button"
                  onClick={
                    goToPreviousPage
                  }
                  disabled={
                    page <= 1
                    || loading
                  }
                >
                  {t(
                    "adminUsers.actions.previous"
                  )}
                </button>


                <span>
                  {t(
                    "adminUsers.pagination.page",
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
                  className="btn btn-sm admin-page-button"
                  onClick={
                    goToNextPage
                  }
                  disabled={
                    page
                      >= totalPages
                    || filteredTotal
                      === 0
                    || loading
                  }
                >
                  {t(
                    "adminUsers.actions.next"
                  )}
                </button>

              </div>

            </footer>

          </section>

        </div>

      </div>

    </div>
  );
};


export default AdminUser;
