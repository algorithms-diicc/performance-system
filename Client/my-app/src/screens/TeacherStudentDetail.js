import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import InlineState
  from "../components/InlineState";

import {
  useI18n,
} from "../i18n";

import {
  coursePeriod,
  formatDateTime,
  teacherApi,
  teacherRequestErrorMessage,
} from "./teacherApi";

import "./TeacherDashboard.css";


const PAGE_SIZE = 15;


function formatDuration(
  value,
  locale = "es-CL",
  fallback = "—"
) {
  if (
    value === null ||
    value === undefined
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
    return `${Math.round(numeric)} ms`;
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


function stateLabel(
  value,
  t = null,
  fallback = "—"
) {
  const state =
    String(value || "")
      .trim()
      .toUpperCase();

  const keys = {
    QUEUED:
      "teacherStudentDetail.states.queued",
    RUNNING:
      "teacherStudentDetail.states.running",
    PROCESSING:
      "teacherStudentDetail.states.processing",
    COMPLETED:
      "teacherStudentDetail.states.completed",
    FAILED:
      "teacherStudentDetail.states.failed",
    CANCELLED:
      "teacherStudentDetail.states.cancelled",
  };

  const legacy = {
    QUEUED: "En cola",
    RUNNING: "Ejecutando",
    PROCESSING: "Procesando",
    COMPLETED: "Completada",
    FAILED: "Fallida",
    CANCELLED: "Cancelada",
  };

  if (
    typeof t === "function"
    && keys[state]
  ) {
    return t(
      keys[state]
    );
  }

  return legacy[state]
    || state
    || fallback;
}


function submissionStatusLabel(
  submission,
  t
) {
  const executions =
    Number(
      submission?.executions || 0
    );
  const completed =
    Number(
      submission?.completed || 0
    );
  const failed =
    Number(
      submission?.failed || 0
    );
  const active =
    Number(
      submission?.queued || 0
    )
    + Number(
      submission?.running || 0
    )
    + Number(
      submission?.processing || 0
    );

  if (executions === 0) {
    return t(
      "teacherStudentDetail.submissions.status.noExecutions"
    );
  }
  if (active > 0) {
    return t(
      "teacherStudentDetail.submissions.status.active"
    );
  }
  if (
    completed > 0
    && failed === 0
  ) {
    return t(
      "teacherStudentDetail.submissions.status.completed"
    );
  }
  if (
    failed > 0
    && completed === 0
  ) {
    return t(
      "teacherStudentDetail.submissions.status.failed"
    );
  }
  if (
    completed > 0
    && failed > 0
  ) {
    return t(
      "teacherStudentDetail.submissions.status.mixed"
    );
  }

  return t(
    "teacherStudentDetail.submissions.status.unknown"
  );
}


function stateClass(value) {
  const state =
    String(value || "")
      .trim()
      .toUpperCase();

  if (state === "COMPLETED") {
    return "teacher-execution-state teacher-execution-state--success";
  }

  if (state === "FAILED") {
    return "teacher-execution-state teacher-execution-state--danger";
  }

  if (
    state === "QUEUED" ||
    state === "RUNNING" ||
    state === "PROCESSING"
  ) {
    return "teacher-execution-state teacher-execution-state--active";
  }

  return "teacher-execution-state";
}


function Pagination({
  page,
  total,
  onPageChange,
  disabled,
}) {
  const {
    t,
  } = useI18n();

  const totalPages =
    Math.max(
      1,
      Math.ceil(total / PAGE_SIZE)
    );

  return (
    <footer className="teacher-pagination">

      <span>
        {t(
          total === 1
            ? "teacherStudentDetail.pagination.records.one"
            : "teacherStudentDetail.pagination.records.other",
          {
            count: total,
          }
        )}
      </span>

      <div>

        <button
          type="button"
          className="btn btn-sm teacher-row-button"
          disabled={disabled || page <= 1}
          onClick={() =>
            onPageChange(
              Math.max(1, page - 1)
            )
          }
        >
          {t(
            "teacherStudentDetail.actions.previous"
          )}
        </button>

        <span>
          {t(
            "teacherStudentDetail.pagination.page",
            {
              page,
              total:
                totalPages,
            }
          )}
        </span>

        <button
          type="button"
          className="btn btn-sm teacher-row-button"
          disabled={
            disabled ||
            page >= totalPages
          }
          onClick={() =>
            onPageChange(
              Math.min(
                totalPages,
                page + 1
              )
            )
          }
        >
          {t(
            "teacherStudentDetail.actions.next"
          )}
        </button>

      </div>

    </footer>
  );
}


function ExecutionDetailModal({
  courseId,
  userId,
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
    if (!executionId) {
      return undefined;
    }

    const controller =
      new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const data =
          await teacherApi(
            `/api/teacher/courses/${courseId}/students/${userId}/executions/${executionId}`,
            {
              signal:
                controller.signal,
            }
          );

        setDetail(
          data.execution || null
        );
      } catch (err) {
        if (
          err.name === "AbortError"
        ) {
          return;
        }

        setError(err);
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    })();

    return () =>
      controller.abort();
  }, [
    courseId,
    userId,
    executionId,
  ]);


  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
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


  if (!executionId) {
    return null;
  }

  const measurement =
    detail?.executionConfig?.measurement || {};

  const hardware =
    detail?.hardwareSnapshot || {};

  const node =
    hardware.node || {};

  const hardwareMeasurement =
    hardware.measurement || {};

  const errorMessage =
    error
      ? teacherRequestErrorMessage(
          error,
          t,
          {
            fallbackKey:
              "teacherStudentDetail.modal.errors.load",
          }
        )
      : "";


  return (
    <div
      className="teacher-execution-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className="teacher-execution-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="teacher-execution-title"
      >

        <header className="teacher-execution-modal-header">

          <div>
            <p>
              {t(
                "teacherStudentDetail.modal.eyebrow"
              )}
            </p>
            <h2 id="teacher-execution-title">
              {t(
                "teacherStudentDetail.modal.title",
                {
                  id:
                    executionId,
                }
              )}
            </h2>
          </div>

          <button
            type="button"
            className="teacher-execution-modal-close"
            onClick={onClose}
            aria-label={t(
              "teacherStudentDetail.modal.closeAria"
            )}
          >
            ×
          </button>

        </header>


        <div className="teacher-execution-modal-body">

          {loading && (
            <InlineState
              type="loading"
              title={t(
                "teacherStudentDetail.modal.loading"
              )}
              compact
            />
          )}

          {error && (
            <InlineState
              type="error"
              title={t(
                "teacherStudentDetail.modal.errors.title"
              )}
              description={
                errorMessage
              }
              compact
            />
          )}

          {!loading &&
            !error &&
            detail && (
              <>

                <div className="teacher-execution-modal-summary">

                  <div>
                    <span>
                      {t(
                        "teacherStudentDetail.modal.summary.source"
                      )}
                    </span>
                    <strong>
                      {detail.originalFilename ||
                        detail.codename ||
                        t(
                          "teacherStudentDetail.executions.sourceFallback"
                        )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t(
                        "teacherStudentDetail.modal.summary.submission"
                      )}
                    </span>
                    <strong>
                      {detail.submissionTitle ||
                        `#${detail.submissionId}`}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t(
                        "teacherStudentDetail.modal.summary.benchmark"
                      )}
                    </span>
                    <strong>
                      {detail.benchmark ||
                        t(
                          "teacherStudentDetail.common.unavailable"
                        )}
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t(
                        "teacherStudentDetail.modal.summary.state"
                      )}
                    </span>
                    <strong>
                      <span
                        className={stateClass(
                          detail.state
                        )}
                      >
                        {stateLabel(
                          detail.state,
                          t,
                          t(
                            "teacherStudentDetail.common.unavailable"
                          )
                        )}
                      </span>
                    </strong>
                  </div>

                  <div>
                    <span>
                      {t(
                        "teacherStudentDetail.modal.summary.duration"
                      )}
                    </span>
                    <strong>
                      {formatDuration(
                        detail.durationMs,
                        locale,
                        t(
                          "teacherStudentDetail.common.unavailable"
                        )
                      )}
                    </strong>
                  </div>

                </div>


                <div className="teacher-execution-detail-grid">

                  <article>
                    <h3>
                      {t(
                        "teacherStudentDetail.modal.configuration.title"
                      )}
                    </h3>

                    <dl>

                      <div>
                        <dt>
                          {t(
                            "teacherStudentDetail.modal.configuration.input"
                          )}
                        </dt>
                        <dd>
                          {detail.inputSize ??
                            t(
                              "teacherStudentDetail.common.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "teacherStudentDetail.modal.configuration.samplesPerPoint"
                          )}
                        </dt>
                        <dd>
                          {measurement.samples_per_point ??
                            detail.samples ??
                            t(
                              "teacherStudentDetail.common.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "teacherStudentDetail.modal.configuration.points"
                          )}
                        </dt>
                        <dd>
                          {measurement.points ??
                            t(
                              "teacherStudentDetail.common.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "teacherStudentDetail.modal.configuration.warmup"
                          )}
                        </dt>
                        <dd>
                          {measurement.warmup_rounds ??
                            t(
                              "teacherStudentDetail.common.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "teacherStudentDetail.modal.configuration.profile"
                          )}
                        </dt>
                        <dd>
                          {detail.executionProfile ||
                            t(
                              "teacherStudentDetail.common.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "teacherStudentDetail.modal.configuration.compilation"
                          )}
                        </dt>
                        <dd>
                          {detail.executionConfig?.compiler_flags ||
                            t(
                              "teacherStudentDetail.common.unavailable"
                            )}
                        </dd>
                      </div>

                    </dl>
                  </article>


                  <article>
                    <h3>
                      {t(
                        "teacherStudentDetail.modal.hardware.title"
                      )}
                    </h3>

                    <dl>

                      <div>
                        <dt>
                          {t(
                            "teacherStudentDetail.modal.hardware.cpu"
                          )}
                        </dt>
                        <dd>
                          {detail.hardwareProfile ||
                            node.cpu_model ||
                            t(
                              "teacherStudentDetail.common.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "teacherStudentDetail.modal.hardware.architecture"
                          )}
                        </dt>
                        <dd>
                          {node.architecture ||
                            t(
                              "teacherStudentDetail.common.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "teacherStudentDetail.modal.hardware.logicalCpus"
                          )}
                        </dt>
                        <dd>
                          {node.logical_cpus ??
                            t(
                              "teacherStudentDetail.common.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "teacherStudentDetail.modal.hardware.backend"
                          )}
                        </dt>
                        <dd>
                          {hardwareMeasurement.backend ||
                            t(
                              "teacherStudentDetail.common.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "teacherStudentDetail.modal.hardware.scope"
                          )}
                        </dt>
                        <dd>
                          {hardwareMeasurement.requested_perf_scope ||
                            measurement.perf_scope ||
                            t(
                              "teacherStudentDetail.common.unavailable"
                            )}
                        </dd>
                      </div>

                      <div>
                        <dt>
                          {t(
                            "teacherStudentDetail.modal.hardware.result"
                          )}
                        </dt>
                        <dd>
                          {detail.resultAvailable
                            ? t(
                                "teacherStudentDetail.modal.hardware.available"
                              )
                            : t(
                                "teacherStudentDetail.modal.hardware.unavailable"
                              )}
                        </dd>
                      </div>

                    </dl>
                  </article>

                </div>


                {detail.failure && (
                  <article className="teacher-execution-failure">

                    <h3>
                      {t(
                        "teacherStudentDetail.modal.failure.title"
                      )}
                    </h3>

                    <strong>
                      {detail.failure.code ||
                        t(
                          "teacherStudentDetail.modal.failure.noCode"
                        )}
                    </strong>

                    <p>
                      {detail.failure.message ||
                        t(
                          "teacherStudentDetail.modal.failure.noMessage"
                        )}
                    </p>

                  </article>
                )}

              </>
            )}

        </div>


        <footer className="teacher-execution-modal-footer">

          <button
            type="button"
            className="btn teacher-secondary-button"
            onClick={onClose}
          >
            {t(
              "teacherStudentDetail.actions.close"
            )}
          </button>

          <div className="teacher-execution-modal-actions">
            {detail?.submissionId !== null &&
              detail?.submissionId !== undefined && (
                <Link
                  to={`/submissions/${encodeURIComponent(
                    String(detail.submissionId)
                  )}`}
                  className="btn teacher-secondary-button"
                >
                  {t(
                    "teacherStudentDetail.actions.viewExperiment"
                  )}
                </Link>
              )}

            {detail?.resultAvailable &&
              detail?.codename && (
              <Link
                to={`/code/${detail.codename}`}
                className="btn teacher-primary-button"
              >
                {t(
                  "teacherStudentDetail.actions.viewResults"
                )}
              </Link>
            )}
          </div>

        </footer>

      </section>
    </div>
  );
}


export default function TeacherStudentDetail() {
  const {
    courseId,
    userId,
  } = useParams();

  const {
    locale,
    t,
  } = useI18n();

  const [
    profile,
    setProfile,
  ] = useState(null);

  const [
    course,
    setCourse,
  ] = useState(null);

  const [
    summary,
    setSummary,
  ] = useState(null);

  const [
    activeTab,
    setActiveTab,
  ] = useState("executions");

  const [
    loadingProfile,
    setLoadingProfile,
  ] = useState(true);

  const [
    profileError,
    setProfileError,
  ] = useState(null);

  const [
    reloadProfile,
    setReloadProfile,
  ] = useState(0);

  const [
    executions,
    setExecutions,
  ] = useState([]);

  const [
    executionTotal,
    setExecutionTotal,
  ] = useState(0);

  const [
    executionPage,
    setExecutionPage,
  ] = useState(1);

  const [
    executionStatus,
    setExecutionStatus,
  ] = useState("all");

  const [
    executionSearch,
    setExecutionSearch,
  ] = useState("");

  const [
    loadingExecutions,
    setLoadingExecutions,
  ] = useState(true);

  const [
    executionError,
    setExecutionError,
  ] = useState(null);

  const [
    submissions,
    setSubmissions,
  ] = useState([]);

  const [
    submissionTotal,
    setSubmissionTotal,
  ] = useState(0);

  const [
    submissionPage,
    setSubmissionPage,
  ] = useState(1);

  const [
    submissionSearch,
    setSubmissionSearch,
  ] = useState("");

  const [
    loadingSubmissions,
    setLoadingSubmissions,
  ] = useState(true);

  const [
    submissionError,
    setSubmissionError,
  ] = useState(null);

  const [
    selectedExecutionId,
    setSelectedExecutionId,
  ] = useState(null);


  useEffect(() => {
    const controller =
      new AbortController();

    (async () => {
      try {
        setLoadingProfile(true);
        setProfileError(null);

        const data =
          await teacherApi(
            `/api/teacher/courses/${courseId}/students/${userId}`,
            {
              signal:
                controller.signal,
            }
          );

        setProfile(
          data.profile || null
        );

        setCourse(
          data.course || null
        );

        setSummary(
          data.summary || null
        );
      } catch (err) {
        if (
          err.name === "AbortError"
        ) {
          return;
        }

        setProfileError(
          err
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoadingProfile(false);
        }
      }
    })();

    return () =>
      controller.abort();
  }, [
    courseId,
    userId,
    reloadProfile,
  ]);


  useEffect(() => {
    setExecutionPage(1);
  }, [
    executionStatus,
    executionSearch,
  ]);


  useEffect(() => {
    if (
      activeTab !== "executions"
    ) {
      return undefined;
    }

    const controller =
      new AbortController();

    const timer =
      window.setTimeout(
        async () => {
          try {
            setLoadingExecutions(true);
            setExecutionError(null);

            const params =
              new URLSearchParams({
                page:
                  String(
                    executionPage
                  ),
                page_size:
                  String(PAGE_SIZE),
              });

            if (
              executionStatus !== "all"
            ) {
              params.set(
                "status",
                executionStatus
              );
            }

            if (
              executionSearch.trim()
            ) {
              params.set(
                "problem",
                executionSearch.trim()
              );
            }

            const data =
              await teacherApi(
                `/api/teacher/courses/${courseId}/students/${userId}/executions?${params.toString()}`,
                {
                  signal:
                    controller.signal,
                }
              );

            setExecutions(
              Array.isArray(data.items)
                ? data.items
                : []
            );

            setExecutionTotal(
              data.total || 0
            );
          } catch (err) {
            if (
              err.name === "AbortError"
            ) {
              return;
            }

            setExecutions([]);
            setExecutionTotal(0);

            setExecutionError(
              err
            );
          } finally {
            if (
              !controller.signal.aborted
            ) {
              setLoadingExecutions(false);
            }
          }
        },
        executionSearch.trim()
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
    activeTab,
    courseId,
    userId,
    executionPage,
    executionStatus,
    executionSearch,
  ]);


  useEffect(() => {
    setSubmissionPage(1);
  }, [submissionSearch]);


  useEffect(() => {
    if (
      activeTab !== "submissions"
    ) {
      return undefined;
    }

    const controller =
      new AbortController();

    const timer =
      window.setTimeout(
        async () => {
          try {
            setLoadingSubmissions(true);
            setSubmissionError(null);

            const params =
              new URLSearchParams({
                page:
                  String(
                    submissionPage
                  ),
                page_size:
                  String(PAGE_SIZE),
              });

            if (
              submissionSearch.trim()
            ) {
              params.set(
                "problem",
                submissionSearch.trim()
              );
            }

            const data =
              await teacherApi(
                `/api/teacher/courses/${courseId}/students/${userId}/submissions?${params.toString()}`,
                {
                  signal:
                    controller.signal,
                }
              );

            setSubmissions(
              Array.isArray(data.items)
                ? data.items
                : []
            );

            setSubmissionTotal(
              data.total || 0
            );
          } catch (err) {
            if (
              err.name === "AbortError"
            ) {
              return;
            }

            setSubmissions([]);
            setSubmissionTotal(0);

            setSubmissionError(
              err
            );
          } finally {
            if (
              !controller.signal.aborted
            ) {
              setLoadingSubmissions(false);
            }
          }
        },
        submissionSearch.trim()
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
    activeTab,
    courseId,
    userId,
    submissionPage,
    submissionSearch,
  ]);


  const profileErrorMessage =
    profileError
      ? teacherRequestErrorMessage(
          profileError,
          t,
          {
            fallbackKey:
              "teacherStudentDetail.profile.errors.load",
          }
        )
      : "";

  const executionErrorMessage =
    executionError
      ? teacherRequestErrorMessage(
          executionError,
          t,
          {
            fallbackKey:
              "teacherStudentDetail.executions.errors.load",
          }
        )
      : "";


  const submissionErrorMessage =
    submissionError
      ? teacherRequestErrorMessage(
          submissionError,
          t,
          {
            fallbackKey:
              "teacherStudentDetail.submissions.errors.load",
          }
        )
      : "";


  const activeExecutions =
    useMemo(
      () =>
        (summary?.queuedExecutions || 0)
        + (summary?.runningExecutions || 0)
        + (summary?.processingExecutions || 0),
      [summary]
    );


  if (
    loadingProfile &&
    !profile
  ) {
    return (
      <main className="teacher-page">
        <div className="teacher-page-inner">
          <InlineState
            type="loading"
            title={t("teacherStudentDetail.profile.loading")}
            compact
          />
        </div>
      </main>
    );
  }


  if (
    profileError &&
    !profile
  ) {
    return (
      <main className="teacher-page">
        <div className="teacher-page-inner">
          <InlineState
            type="error"
            title={t("teacherStudentDetail.profile.errors.title")}
            description={profileErrorMessage}
            actionLabel={t("teacherStudentDetail.actions.retry")}
            onAction={() =>
              setReloadProfile(
                (value) =>
                  value + 1
              )
            }
            compact
          />
        </div>
      </main>
    );
  }


  if (
    !profile ||
    !course
  ) {
    return null;
  }


  return (
    <main className="teacher-page">

      <div className="teacher-page-inner">

        <div className="teacher-back-row">
          <Link
            to={`/teacher/courses/${courseId}`}
            className="teacher-back-link"
          >
            {t("teacherStudentDetail.actions.back")}
          </Link>
        </div>


        <header className="teacher-student-detail-header">

          <div>

            <p className="teacher-eyebrow">
              {t("teacherStudentDetail.profile.eyebrow")}
            </p>

            <h1>
              {profile.fullName}
            </h1>

            <p>
              {profile.email}
            </p>

            <div className="teacher-student-context">

              <span>
                {course.code}
              </span>

              <span>
                {coursePeriod(course)}
              </span>

              <span
                className={
                  profile.membership?.isActive
                    ? "teacher-status teacher-status--active"
                    : "teacher-status teacher-status--historic"
                }
              >
                {profile.membership?.isActive
                  ? t("teacherStudentDetail.profile.membership.active")
                  : t("teacherStudentDetail.profile.membership.removed")}
              </span>

            </div>

          </div>


          <div className="teacher-student-meta">

            <div>
              <span>
                {t("teacherStudentDetail.profile.lastActivity")}
              </span>
              <strong>
                {formatDateTime(
                  summary?.lastActivityAt,
                  locale,
                  t("teacherStudentDetail.common.unavailable")
                )}
              </strong>
            </div>

            <div>
              <span>
                {t("teacherStudentDetail.profile.lastAccess")}
              </span>
              <strong>
                {formatDateTime(
                  profile.lastLogin,
                  locale,
                  t("teacherStudentDetail.common.unavailable")
                )}
              </strong>
            </div>

          </div>

        </header>


        <section className="teacher-summary-grid teacher-summary-grid--student">

          <article>
            <span>{t("teacherStudentDetail.summary.submissions")}</span>
            <strong>
              {summary?.submissions || 0}
            </strong>
          </article>

          <article>
            <span>{t("teacherStudentDetail.summary.executions")}</span>
            <strong>
              {summary?.executions || 0}
            </strong>
          </article>

          <article>
            <span>{t("teacherStudentDetail.summary.completed")}</span>
            <strong>
              {summary?.completedExecutions || 0}
            </strong>
          </article>

          <article>
            <span>{t("teacherStudentDetail.summary.failed")}</span>
            <strong>
              {summary?.failedExecutions || 0}
            </strong>
          </article>

          <article>
            <span>{t("teacherStudentDetail.summary.active")}</span>
            <strong>
              {activeExecutions}
            </strong>
          </article>

        </section>


        <section className="teacher-panel">

          <div className="teacher-student-tabs">

            <button
              type="button"
              className={
                activeTab === "executions"
                  ? "is-active"
                  : ""
              }
              onClick={() =>
                setActiveTab(
                  "executions"
                )
              }
              aria-pressed={
                activeTab === "executions"
              }
            >
              {t("teacherStudentDetail.tabs.executions")}
            </button>

            <button
              type="button"
              className={
                activeTab === "submissions"
                  ? "is-active"
                  : ""
              }
              onClick={() =>
                setActiveTab(
                  "submissions"
                )
              }
              aria-pressed={
                activeTab === "submissions"
              }
            >
              {t("teacherStudentDetail.tabs.submissions")}
            </button>

          </div>


          {activeTab === "executions" && (
            <>

              <div className="teacher-student-detail-toolbar">

                <div>

                  <label
                    htmlFor="teacher-student-execution-search"
                  >
                    {t("teacherStudentDetail.executions.searchLabel")}
                  </label>

                  <input
                    id="teacher-student-execution-search"
                    className="form-control"
                    value={
                      executionSearch
                    }
                    onChange={(event) =>
                      setExecutionSearch(
                        event.target.value
                      )
                    }
                    placeholder={t(
                      "teacherStudentDetail.executions.searchPlaceholder"
                    )}
                  />

                </div>


                <div>

                  <label
                    htmlFor="teacher-student-execution-state"
                  >
                    {t("teacherStudentDetail.executions.statusLabel")}
                  </label>

                  <select
                    id="teacher-student-execution-state"
                    className="form-select"
                    value={
                      executionStatus
                    }
                    onChange={(event) =>
                      setExecutionStatus(
                        event.target.value
                      )
                    }
                  >
                    <option value="all">
                      {t("teacherStudentDetail.executions.statusAll")}
                    </option>
                    <option value="QUEUED">
                      {t("teacherStudentDetail.states.queued")}
                    </option>
                    <option value="RUNNING">
                      {t("teacherStudentDetail.states.running")}
                    </option>
                    <option value="PROCESSING">
                      {t("teacherStudentDetail.states.processing")}
                    </option>
                    <option value="COMPLETED">
                      {t("teacherStudentDetail.states.completed")}
                    </option>
                    <option value="FAILED">
                      {t("teacherStudentDetail.states.failed")}
                    </option>
                    <option value="CANCELLED">
                      {t("teacherStudentDetail.states.cancelled")}
                    </option>
                  </select>

                </div>

              </div>


              {executionError && (
                <InlineState
                  type="error"
                  title={t("teacherStudentDetail.executions.errors.title")}
                  description={executionErrorMessage}
                  compact
                />
              )}


              {!executionError &&
                loadingExecutions &&
                executions.length === 0 && (
                  <InlineState
                    type="loading"
                    title={t("teacherStudentDetail.executions.loading")}
                    compact
                  />
                )}


              {!executionError &&
                !loadingExecutions &&
                executions.length === 0 && (
                  <InlineState
                    type="empty"
                    title={t("teacherStudentDetail.executions.emptyTitle")}
                    description={t("teacherStudentDetail.executions.emptyDescription")}
                    compact
                  />
                )}


              {!executionError &&
                executions.length > 0 && (
                  <>

                    <div className="table-responsive">

                      <table className="table teacher-student-table align-middle mb-0">

                        <thead>
                          <tr>
                            <th>
                              {t("teacherStudentDetail.executions.table.execution")}
                            </th>
                            <th>
                              {t("teacherStudentDetail.executions.table.source")}
                            </th>
                            <th>
                              {t("teacherStudentDetail.executions.table.submission")}
                            </th>
                            <th>
                              {t("teacherStudentDetail.executions.table.state")}
                            </th>
                            <th>
                              {t("teacherStudentDetail.executions.table.duration")}
                            </th>
                            <th>
                              {t("teacherStudentDetail.executions.table.hardware")}
                            </th>
                            <th>
                              {t("teacherStudentDetail.executions.table.updated")}
                            </th>
                            <th className="text-end">
                              {t("teacherStudentDetail.executions.table.detail")}
                            </th>
                          </tr>
                        </thead>

                        <tbody>

                          {executions.map(
                            (execution) => {

                              const updatedAt =
                                execution.finishedAt ||
                                execution.processingAt ||
                                execution.startedAt;

                              return (
                                <tr
                                  key={
                                    execution.executionId
                                  }
                                >

                                  <td>
                                    <strong>
                                      #{execution.executionId}
                                    </strong>
                                  </td>

                                  <td>
                                    <div className="teacher-execution-source">
                                      <strong>
                                        {execution.originalFilename ||
                                          execution.codename ||
                                          t("teacherStudentDetail.executions.sourceFallback")}
                                      </strong>
                                      {execution.codename &&
                                        execution.codename !== execution.originalFilename && (
                                          <small>{execution.codename}</small>
                                        )}
                                    </div>
                                  </td>

                                  <td>
                                    <Link
                                      to={`/submissions/${encodeURIComponent(
                                        String(execution.submissionId)
                                      )}`}
                                      className="teacher-submission-link"
                                    >
                                      <strong>
                                        {execution.submissionTitle ||
                                          t(
                                            "teacherStudentDetail.executions.submissionFallback",
                                            {
                                              id:
                                                execution.submissionId,
                                            }
                                          )}
                                      </strong>
                                      <small>
                                        ID {execution.submissionId}
                                      </small>
                                    </Link>
                                  </td>

                                  <td>
                                    <span
                                      className={stateClass(
                                        execution.state
                                      )}
                                    >
                                      {stateLabel(
                                        execution.state,
                                        t,
                                        t("teacherStudentDetail.common.unavailable")
                                      )}
                                    </span>
                                  </td>

                                  <td>
                                    {formatDuration(
                                      execution.durationMs,
                                      locale,
                                      t("teacherStudentDetail.common.unavailable")
                                    )}
                                  </td>

                                  <td>
                                    {execution.hardwareProfile ||
                                      t("teacherStudentDetail.common.unavailable")}
                                  </td>

                                  <td>
                                    {formatDateTime(
                                      updatedAt,
                                      locale,
                                      t("teacherStudentDetail.common.unavailable")
                                    )}
                                  </td>

                                  <td className="text-end">
                                    <button
                                      type="button"
                                      className="btn btn-sm teacher-row-button teacher-row-button--profile"
                                      onClick={() =>
                                        setSelectedExecutionId(
                                          execution.executionId
                                        )
                                      }
                                    >
                                      {t("teacherStudentDetail.actions.viewDetail")}
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
                        executionPage
                      }
                      total={
                        executionTotal
                      }
                      onPageChange={
                        setExecutionPage
                      }
                      disabled={
                        loadingExecutions
                      }
                    />

                  </>
                )}

            </>
          )}


          {activeTab === "submissions" && (
            <>

              <div className="teacher-student-detail-toolbar teacher-student-detail-toolbar--single">

                <div>

                  <label
                    htmlFor="teacher-student-submission-search"
                  >
                    {t(
                      "teacherStudentDetail.submissions.searchLabel"
                    )}
                  </label>

                  <input
                    id="teacher-student-submission-search"
                    className="form-control"
                    value={
                      submissionSearch
                    }
                    onChange={(event) =>
                      setSubmissionSearch(
                        event.target.value
                      )
                    }
                    placeholder={t(
                      "teacherStudentDetail.submissions.searchPlaceholder"
                    )}
                  />

                </div>

              </div>


              {submissionError && (
                <InlineState
                  type="error"
                  title={t(
                    "teacherStudentDetail.submissions.errors.title"
                  )}
                  description={
                    submissionErrorMessage
                  }
                  compact
                />
              )}


              {!submissionError &&
                loadingSubmissions &&
                submissions.length === 0 && (
                  <InlineState
                    type="loading"
                    title={t(
                      "teacherStudentDetail.submissions.loading"
                    )}
                    compact
                  />
                )}


              {!submissionError &&
                !loadingSubmissions &&
                submissions.length === 0 && (
                  <InlineState
                    type="empty"
                    title={t(
                      "teacherStudentDetail.submissions.emptyTitle"
                    )}
                    description={t(
                      "teacherStudentDetail.submissions.emptyDescription"
                    )}
                    compact
                  />
                )}


              {!submissionError &&
                submissions.length > 0 && (
                  <>

                    <div className="table-responsive">

                      <table className="table teacher-student-table align-middle mb-0">

                        <thead>
                          <tr>
                            <th>
                              {t(
                                "teacherStudentDetail.submissions.table.submission"
                              )}
                            </th>
                            <th>
                              {t(
                                "teacherStudentDetail.submissions.table.status"
                              )}
                            </th>
                            <th>
                              {t(
                                "teacherStudentDetail.submissions.table.executions"
                              )}
                            </th>
                            <th>
                              {t(
                                "teacherStudentDetail.submissions.table.completed"
                              )}
                            </th>
                            <th>
                              {t(
                                "teacherStudentDetail.submissions.table.failed"
                              )}
                            </th>
                            <th>
                              {t(
                                "teacherStudentDetail.submissions.table.active"
                              )}
                            </th>
                            <th>
                              {t(
                                "teacherStudentDetail.submissions.table.created"
                              )}
                            </th>
                          </tr>
                        </thead>

                        <tbody>

                          {submissions.map(
                            (submission) => {

                              const active =
                                (submission.queued || 0)
                                + (submission.running || 0)
                                + (submission.processing || 0);

                              return (
                                <tr
                                  key={
                                    submission.id
                                  }
                                >

                                  <td>
                                    <Link
                                      to={`/submissions/${encodeURIComponent(
                                        String(submission.id)
                                      )}`}
                                      className="teacher-submission-link"
                                    >
                                      <strong>
                                        {submission.title ||
                                          t(
                                            "teacherStudentDetail.submissions.fallback",
                                            {
                                              id:
                                                submission.id,
                                            }
                                          )}
                                      </strong>
                                      <small>
                                        ID {submission.id}
                                      </small>
                                    </Link>
                                  </td>

                                  <td>
                                    <span className="teacher-submission-status">
                                      {submissionStatusLabel(
                                        submission,
                                        t
                                      )}
                                    </span>
                                  </td>

                                  <td>
                                    {submission.executions ||
                                      0}
                                  </td>

                                  <td>
                                    {submission.completed ||
                                      0}
                                  </td>

                                  <td>
                                    {submission.failed ||
                                      0}
                                  </td>

                                  <td>
                                    {active}
                                  </td>

                                  <td>
                                    {formatDateTime(
                                      submission.createdAt,
                                      locale,
                                      t(
                                        "teacherStudentDetail.common.unavailable"
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
                        submissionPage
                      }
                      total={
                        submissionTotal
                      }
                      onPageChange={
                        setSubmissionPage
                      }
                      disabled={
                        loadingSubmissions
                      }
                    />

                  </>
                )}

            </>
          )}

        </section>

      </div>


      <ExecutionDetailModal
        courseId={courseId}
        userId={userId}
        executionId={
          selectedExecutionId
        }
        onClose={() =>
          setSelectedExecutionId(
            null
          )
        }
      />

    </main>
  );
}
