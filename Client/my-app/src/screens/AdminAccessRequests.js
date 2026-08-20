import InlineState from "../components/InlineState";
import {
  localizedRequestError,
  requestJson,
} from "../common/requestErrorModel";
import React, {
  useEffect,
  useState,
} from "react";
import "./AdminOps.css";

import {
  useI18n,
} from "../i18n";
import {
  formatDateTime,
} from "../i18n/formatters";

import {
  adminRoleLabel,
} from "./adminExecutionStateModel";


const PAGE_SIZE = 20;


async function api(
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
      },
      ...options,
    },
    {
      fallback:
        "No fue posible procesar la solicitud.",
    }
  );
}


function statusLabel(
  status,
  t
) {
  const normalized =
    String(status || "")
      .toUpperCase();

  const keys = {
    PENDING:
      "adminAccessRequests.status.pending",
    APPROVED:
      "adminAccessRequests.status.approved",
    REJECTED:
      "adminAccessRequests.status.rejected",
  };

  return keys[normalized]
    ? t(keys[normalized])
    : (
        normalized
        || t(
          "adminAccessRequests.fallbacks.unknownStatus"
        )
      );
}


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


export default function AdminAccessRequests() {
  const {
    language,
    locale,
    t,
  } = useI18n();

  const [
    status,
    setStatus,
  ] = useState(
    "PENDING"
  );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    summary,
    setSummary,
  ] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });

  const [
    total,
    setTotal,
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
    reload,
    setReload,
  ] = useState(0);


  useEffect(
    () =>
      setPage(1),
    [
      status,
      search,
    ]
  );


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
                status,
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
                "search",
                search.trim()
              );
            }

            const data =
              await api(
                `/api/admin/access-requests?${params.toString()}`,
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

            setSummary(
              data.summary
              || {
                pending: 0,
                approved: 0,
                rejected: 0,
              }
            );

            setTotal(
              data.total
              || 0
            );
          } catch (err) {
            if (
              err.name
              !== "AbortError"
            ) {
              setError(err);
              setItems([]);
            }
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
    status,
    search,
    page,
    reload,
  ]);


  const errorMessage =
    error
      ? localizedRequestError(
          error,
          t,
          {
            language,
            fallbackKey:
              "adminAccessRequests.errors.load",
          }
        )
      : "";


  const resolve =
    async (
      item,
      mode
    ) => {
      const confirmMessage =
        mode === "approve"
          ? t(
              "adminAccessRequests.confirm.approve",
              {
                id:
                  item.id,
              }
            )
          : t(
              "adminAccessRequests.confirm.reject",
              {
                id:
                  item.id,
              }
            );

      if (
        !window.confirm(
          confirmMessage
        )
      ) {
        return;
      }

      let body = {};

      if (
        mode === "reject"
      ) {
        const reason =
          window.prompt(
            t(
              "adminAccessRequests.prompt.rejectReason"
            ),
            ""
          )
          || "";

        body = {
          reason,
        };
      }

      try {
        await api(
          `/api/admin/access-requests/${item.id}/${mode}`,
          {
            method: "POST",
            body:
              JSON.stringify(
                body
              ),
          }
        );

        setReload(
          (value) =>
            value + 1
        );
      } catch (err) {
        window.alert(
          localizedRequestError(
            err,
            t,
            {
              language,
              fallbackKey:
                "adminAccessRequests.errors.resolve",
            }
          )
        );
      }
    };


  const pages =
    Math.max(
      1,
      Math.ceil(
        total / PAGE_SIZE
      )
    );


  return (
    <div className="app-page admin-page admin-ops-page container-fluid py-4">

      <div className="row justify-content-center">

        <div className="col-12 col-xxl-11">

          <header className="admin-ops-header">
            <p>
              {t(
                "adminAccessRequests.header.eyebrow"
              )}
            </p>
            <h1>
              {t(
                "adminAccessRequests.header.title"
              )}
            </h1>
            <span>
              {t(
                "adminAccessRequests.header.description"
              )}
            </span>
          </header>


          <section
            className="admin-ops-summary"
            aria-label={t(
              "adminAccessRequests.summary.aria"
            )}
          >

            <button
              type="button"
              onClick={() =>
                setStatus(
                  "PENDING"
                )
              }
              className={
                status
                  === "PENDING"
                  ? "active"
                  : ""
              }
              aria-pressed={
                status
                  === "PENDING"
              }
            >
              <span>
                {t(
                  "adminAccessRequests.summary.pending"
                )}
              </span>
              <strong>
                {formatInteger(
                  summary.pending
                    || 0,
                  locale
                )}
              </strong>
            </button>


            <button
              type="button"
              onClick={() =>
                setStatus(
                  "APPROVED"
                )
              }
              className={
                status
                  === "APPROVED"
                  ? "active"
                  : ""
              }
              aria-pressed={
                status
                  === "APPROVED"
              }
            >
              <span>
                {t(
                  "adminAccessRequests.summary.approved"
                )}
              </span>
              <strong>
                {formatInteger(
                  summary.approved
                    || 0,
                  locale
                )}
              </strong>
            </button>


            <button
              type="button"
              onClick={() =>
                setStatus(
                  "REJECTED"
                )
              }
              className={
                status
                  === "REJECTED"
                  ? "active"
                  : ""
              }
              aria-pressed={
                status
                  === "REJECTED"
              }
            >
              <span>
                {t(
                  "adminAccessRequests.summary.rejected"
                )}
              </span>
              <strong>
                {formatInteger(
                  summary.rejected
                    || 0,
                  locale
                )}
              </strong>
            </button>

          </section>


          <section className="admin-ops-filter">

            <div>
              <label
                htmlFor="admin-access-search"
              >
                {t(
                  "adminAccessRequests.filters.search"
                )}
              </label>

              <input
                id="admin-access-search"
                className="form-control"
                value={
                  search
                }
                onChange={
                  (event) =>
                    setSearch(
                      event.target.value
                    )
                }
                placeholder={t(
                  "adminAccessRequests.filters.searchPlaceholder"
                )}
              />
            </div>


            <div>
              <label
                htmlFor="admin-access-status"
              >
                {t(
                  "adminAccessRequests.filters.status"
                )}
              </label>

              <select
                id="admin-access-status"
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
                <option value="PENDING">
                  {t(
                    "adminAccessRequests.status.pendingPlural"
                  )}
                </option>
                <option value="APPROVED">
                  {t(
                    "adminAccessRequests.status.approvedPlural"
                  )}
                </option>
                <option value="REJECTED">
                  {t(
                    "adminAccessRequests.status.rejectedPlural"
                  )}
                </option>
                <option value="ALL">
                  {t(
                    "adminAccessRequests.status.all"
                  )}
                </option>
              </select>
            </div>

          </section>


          <section className="admin-ops-card">

            {loading
              && items.length
                === 0
              && (
                <div className="admin-ops-state">
                  <InlineState
                    type="loading"
                    title={t(
                      "adminAccessRequests.loading.title"
                    )}
                    compact
                  />
                </div>
              )}


            {error && (
              <div className="admin-ops-state">
                <InlineState
                  type="error"
                  title={t(
                    "adminAccessRequests.errors.title"
                  )}
                  description={
                    errorMessage
                  }
                  actionLabel={t(
                    "adminAccessRequests.actions.retry"
                  )}
                  onAction={() =>
                    setReload(
                      (value) =>
                        value + 1
                    )
                  }
                  compact
                />
              </div>
            )}


            {!loading
              && !error
              && items.length
                === 0
              && (
                <div className="admin-ops-state">
                  <InlineState
                    type="empty"
                    title={t(
                      "adminAccessRequests.empty.title"
                    )}
                    compact
                  />
                </div>
              )}


            {!error
              && items.length
                > 0
              && (
                <>

                  <div className="table-responsive">

                    <table className="table admin-ops-table align-middle mb-0">

                      <thead>
                        <tr>
                          <th>
                            {t(
                              "adminAccessRequests.table.user"
                            )}
                          </th>
                          <th>
                            {t(
                              "adminAccessRequests.table.role"
                            )}
                          </th>
                          <th>
                            {t(
                              "adminAccessRequests.table.course"
                            )}
                          </th>
                          <th>
                            {t(
                              "adminAccessRequests.table.status"
                            )}
                          </th>
                          <th>
                            {t(
                              "adminAccessRequests.table.date"
                            )}
                          </th>
                          <th className="text-end">
                            {t(
                              "adminAccessRequests.table.action"
                            )}
                          </th>
                        </tr>
                      </thead>


                      <tbody>

                        {items.map(
                          (item) => (
                            <tr
                              key={
                                item.id
                              }
                            >

                              <td>
                                <strong>
                                  {item.user
                                    ?.fullName
                                    || t(
                                      "adminAccessRequests.fallbacks.unavailable"
                                    )}
                                </strong>
                                <small>
                                  {item.user
                                    ?.email
                                    || t(
                                      "adminAccessRequests.fallbacks.unavailable"
                                    )}
                                </small>
                              </td>


                              <td>
                                {adminRoleLabel(
                                  item.user
                                    ?.roleName,
                                  t
                                )}

                                {item.message
                                  && (
                                    <small>
                                      {item.message}
                                    </small>
                                  )}
                              </td>


                              <td>
                                <strong>
                                  {item.courseCode
                                    || t(
                                      "adminAccessRequests.fallbacks.unavailable"
                                    )}
                                </strong>
                                <small>
                                  {item.professorEmail
                                    || t(
                                      "adminAccessRequests.fallbacks.unavailable"
                                    )}
                                </small>
                              </td>


                              <td>
                                <span className="admin-ops-status">
                                  {statusLabel(
                                    item.status,
                                    t
                                  )}
                                </span>
                              </td>


                              <td>
                                {formatDateTime(
                                  item.createdAt,
                                  locale,
                                  t(
                                    "adminAccessRequests.fallbacks.unavailable"
                                  )
                                )}
                              </td>


                              <td className="text-end">

                                {item.status
                                  === "PENDING"
                                  ? (
                                      <div className="admin-ops-actions">

                                        <button
                                          type="button"
                                          className="btn btn-sm admin-ops-approve"
                                          onClick={() =>
                                            resolve(
                                              item,
                                              "approve"
                                            )
                                          }
                                        >
                                          {t(
                                            "adminAccessRequests.actions.approve"
                                          )}
                                        </button>

                                        <button
                                          type="button"
                                          className="btn btn-sm admin-ops-reject"
                                          onClick={() =>
                                            resolve(
                                              item,
                                              "reject"
                                            )
                                          }
                                        >
                                          {t(
                                            "adminAccessRequests.actions.reject"
                                          )}
                                        </button>

                                      </div>
                                    )
                                  : (
                                      <small>
                                        {item.resolvedBy
                                          ?.fullName
                                          || t(
                                            "adminAccessRequests.resolution.resolved"
                                          )}
                                      </small>
                                    )}

                              </td>

                            </tr>
                          )
                        )}

                      </tbody>

                    </table>

                  </div>


                  <footer className="admin-ops-pagination">

                    <span>
                      {t(
                        countKey(
                          total,
                          "adminAccessRequests.pagination.requests"
                        ),
                        {
                          count:
                            formatInteger(
                              total,
                              locale
                            ),
                        }
                      )}
                    </span>


                    <div>

                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={
                          page <= 1
                          || loading
                        }
                        onClick={() =>
                          setPage(
                            (value) =>
                              Math.max(
                                1,
                                value - 1
                              )
                          )
                        }
                      >
                        {t(
                          "adminAccessRequests.actions.previous"
                        )}
                      </button>


                      <span>
                        {t(
                          "adminAccessRequests.pagination.page",
                          {
                            page:
                              formatInteger(
                                page,
                                locale
                              ),
                            total:
                              formatInteger(
                                pages,
                                locale
                              ),
                          }
                        )}
                      </span>


                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={
                          page >= pages
                          || loading
                        }
                        onClick={() =>
                          setPage(
                            (value) =>
                              Math.min(
                                pages,
                                value + 1
                              )
                          )
                        }
                      >
                        {t(
                          "adminAccessRequests.actions.next"
                        )}
                      </button>

                    </div>

                  </footer>

                </>
              )}

          </section>

        </div>

      </div>

    </div>
  );
}
