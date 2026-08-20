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


const PAGE_SIZE = 25;


async function api(
  url,
  options = {}
) {
  return requestJson(
    url,
    {
      credentials:
        "include",
      ...options,
    },
    {
      fallback:
        "No fue posible cargar la auditoría.",
    }
  );
}


function countKey(
  count
) {
  return `adminAuditLog.pagination.events.${
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


export default function AdminAuditLog() {
  const {
    language,
    locale,
    t,
  } = useI18n();

  const [
    action,
    setAction,
  ] = useState("");

  const [
    from,
    setFrom,
  ] = useState("");

  const [
    to,
    setTo,
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
      action,
      from,
      to,
    ]
  );


  useEffect(() => {
    const controller =
      new AbortController();

    (async () => {
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
          action.trim()
        ) {
          params.set(
            "action",
            action.trim()
          );
        }

        if (from) {
          params.set(
            "from",
            from
          );
        }

        if (to) {
          params.set(
            "to",
            `${to}T23:59:59.999999`
          );
        }

        const data =
          await api(
            `/api/admin/audit-log?${params.toString()}`,
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
    })();

    return () =>
      controller.abort();
  }, [
    action,
    from,
    to,
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
              "adminAuditLog.errors.load",
          }
        )
      : "";


  const pages =
    Math.max(
      1,
      Math.ceil(
        total / PAGE_SIZE
      )
    );


  const hasFilters =
    Boolean(
      action
      || from
      || to
    );


  const clearFilters =
    () => {
      setAction("");
      setFrom("");
      setTo("");
    };


  return (
    <div className="app-page admin-page admin-ops-page container-fluid py-4">

      <div className="row justify-content-center">

        <div className="col-12 col-xxl-11">

          <header className="admin-ops-header">
            <p>
              {t(
                "adminAuditLog.header.eyebrow"
              )}
            </p>
            <h1>
              {t(
                "adminAuditLog.header.title"
              )}
            </h1>
            <span>
              {t(
                "adminAuditLog.header.description"
              )}
            </span>
          </header>


          <section className="admin-ops-filter admin-ops-filter--audit">

            <div>
              <label
                htmlFor="admin-audit-action"
              >
                {t(
                  "adminAuditLog.filters.action"
                )}
              </label>

              <input
                id="admin-audit-action"
                className="form-control"
                value={
                  action
                }
                onChange={
                  (event) =>
                    setAction(
                      event.target.value
                    )
                }
                placeholder={t(
                  "adminAuditLog.filters.actionPlaceholder"
                )}
              />
            </div>


            <div>
              <label
                htmlFor="admin-audit-from"
              >
                {t(
                  "adminAuditLog.filters.from"
                )}
              </label>

              <input
                id="admin-audit-from"
                className="form-control"
                type="date"
                value={
                  from
                }
                onChange={
                  (event) =>
                    setFrom(
                      event.target.value
                    )
                }
              />
            </div>


            <div>
              <label
                htmlFor="admin-audit-to"
              >
                {t(
                  "adminAuditLog.filters.to"
                )}
              </label>

              <input
                id="admin-audit-to"
                className="form-control"
                type="date"
                min={
                  from
                  || undefined
                }
                value={
                  to
                }
                onChange={
                  (event) =>
                    setTo(
                      event.target.value
                    )
                }
              />
            </div>


            <button
              type="button"
              className="btn"
              disabled={
                !hasFilters
              }
              onClick={
                clearFilters
              }
            >
              {t(
                "adminAuditLog.actions.clear"
              )}
            </button>

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
                      "adminAuditLog.loading.title"
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
                    "adminAuditLog.errors.title"
                  )}
                  description={
                    errorMessage
                  }
                  actionLabel={t(
                    "adminAuditLog.actions.retry"
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
                      "adminAuditLog.empty.title"
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

                  <div className="admin-audit-list">

                    {items.map(
                      (item) => (
                        <article
                          key={
                            item.id
                          }
                          className="admin-audit-row"
                        >

                          <div>
                            <strong>
                              {item.action
                                || t(
                                  "adminAuditLog.fallbacks.action"
                                )}
                            </strong>

                            <time>
                              {formatDateTime(
                                item.createdAt,
                                locale,
                                t(
                                  "adminAuditLog.fallbacks.unavailable"
                                )
                              )}
                            </time>
                          </div>


                          <p>
                            {item.description
                              || t(
                                "adminAuditLog.fallbacks.description"
                              )}
                          </p>


                          <small>
                            {item.userName
                              || t(
                                "adminAuditLog.fallbacks.user"
                              )}
                            {" · "}
                            {item.userEmail
                              || t(
                                "adminAuditLog.fallbacks.unavailable"
                              )}
                            {item.userId
                              ? ` · ID ${item.userId}`
                              : ""}
                          </small>

                        </article>
                      )
                    )}

                  </div>


                  <footer className="admin-ops-pagination">

                    <span>
                      {t(
                        countKey(
                          total
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
                          "adminAuditLog.actions.previous"
                        )}
                      </button>


                      <span>
                        {t(
                          "adminAuditLog.pagination.page",
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
                          "adminAuditLog.actions.next"
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
