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
  coursePeriod,
  formatDateTime,
  teacherApi,
} from "./teacherApi";

import "./TeacherDashboard.css";


const PAGE_SIZE = 15;


function formatDuration(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "—";
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "—";
  }

  if (numeric < 1000) {
    return `${Math.round(numeric)} ms`;
  }

  return `${(numeric / 1000).toFixed(2)} s`;
}


function stateLabel(value) {
  const state =
    String(value || "")
      .trim()
      .toUpperCase();

  const labels = {
    QUEUED: "En cola",
    RUNNING: "Ejecutando",
    PROCESSING: "Procesando",
    COMPLETED: "Completada",
    FAILED: "Fallida",
    CANCELLED: "Cancelada",
  };

  return labels[state] || state || "—";
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
  const totalPages =
    Math.max(
      1,
      Math.ceil(total / PAGE_SIZE)
    );

  return (
    <footer className="teacher-pagination">

      <span>
        {total} {total === 1 ? "registro" : "registros"}
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
          Anterior
        </button>

        <span>
          Página {page} de {totalPages}
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
          Siguiente
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

        setError(
          err.message ||
          "No fue posible cargar el detalle."
        );
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
            <p>Detalle técnico</p>
            <h2 id="teacher-execution-title">
              Ejecución #{executionId}
            </h2>
          </div>

          <button
            type="button"
            className="teacher-execution-modal-close"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ×
          </button>

        </header>


        <div className="teacher-execution-modal-body">

          {loading && (
            <InlineState
              type="loading"
              title="Cargando detalle"
              compact
            />
          )}

          {error && (
            <InlineState
              type="error"
              title="No pudimos cargar la ejecución"
              description={error}
              compact
            />
          )}

          {!loading &&
            !error &&
            detail && (
              <>

                <div className="teacher-execution-modal-summary">

                  <div>
                    <span>Submission</span>
                    <strong>
                      {detail.submissionTitle ||
                        `#${detail.submissionId}`}
                    </strong>
                  </div>

                  <div>
                    <span>Benchmark</span>
                    <strong>
                      {detail.benchmark || "—"}
                    </strong>
                  </div>

                  <div>
                    <span>Estado</span>
                    <strong>
                      <span
                        className={stateClass(
                          detail.state
                        )}
                      >
                        {detail.stateLabel ||
                          stateLabel(
                            detail.state
                          )}
                      </span>
                    </strong>
                  </div>

                  <div>
                    <span>Duración</span>
                    <strong>
                      {formatDuration(
                        detail.durationMs
                      )}
                    </strong>
                  </div>

                </div>


                <div className="teacher-execution-detail-grid">

                  <article>
                    <h3>Configuración</h3>

                    <dl>

                      <div>
                        <dt>Input máximo</dt>
                        <dd>
                          {detail.inputSize ?? "—"}
                        </dd>
                      </div>

                      <div>
                        <dt>Muestras/punto</dt>
                        <dd>
                          {measurement.samples_per_point ??
                            detail.samples ??
                            "—"}
                        </dd>
                      </div>

                      <div>
                        <dt>Puntos</dt>
                        <dd>
                          {measurement.points ?? "—"}
                        </dd>
                      </div>

                      <div>
                        <dt>Warmup</dt>
                        <dd>
                          {measurement.warmup_rounds ?? "—"}
                        </dd>
                      </div>

                      <div>
                        <dt>Perfil</dt>
                        <dd>
                          {detail.executionProfile || "—"}
                        </dd>
                      </div>

                      <div>
                        <dt>Compilación</dt>
                        <dd>
                          {detail.executionConfig?.compiler_flags ||
                            "—"}
                        </dd>
                      </div>

                    </dl>
                  </article>


                  <article>
                    <h3>Hardware y medición</h3>

                    <dl>

                      <div>
                        <dt>CPU</dt>
                        <dd>
                          {node.cpu_model ||
                            detail.hardwareProfile ||
                            "—"}
                        </dd>
                      </div>

                      <div>
                        <dt>Arquitectura</dt>
                        <dd>
                          {node.architecture || "—"}
                        </dd>
                      </div>

                      <div>
                        <dt>CPU lógicas</dt>
                        <dd>
                          {node.logical_cpus ?? "—"}
                        </dd>
                      </div>

                      <div>
                        <dt>Backend</dt>
                        <dd>
                          {hardwareMeasurement.backend ||
                            "—"}
                        </dd>
                      </div>

                      <div>
                        <dt>Scope</dt>
                        <dd>
                          {hardwareMeasurement.requested_perf_scope ||
                            measurement.perf_scope ||
                            "—"}
                        </dd>
                      </div>

                      <div>
                        <dt>Resultado</dt>
                        <dd>
                          {detail.resultAvailable
                            ? "Disponible"
                            : "No disponible"}
                        </dd>
                      </div>

                    </dl>
                  </article>

                </div>


                {detail.failure && (
                  <article className="teacher-execution-failure">

                    <h3>Fallo registrado</h3>

                    <strong>
                      {detail.failure.code ||
                        "Sin código"}
                    </strong>

                    <p>
                      {detail.failure.message ||
                        "Sin mensaje adicional."}
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
            Cerrar
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
                  Ver experimento
                </Link>
              )}

            {detail?.resultAvailable &&
              detail?.codename && (
              <Link
                to={`/code/${detail.codename}`}
                className="btn teacher-primary-button"
              >
                Ver resultados
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
          err.message ||
          "No fue posible cargar la ficha."
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
              err.message ||
              "No fue posible cargar las ejecuciones."
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
              err.message ||
              "No fue posible cargar los envíos."
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
            title="Cargando ficha del estudiante"
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
            title="No pudimos cargar la ficha"
            description={profileError}
            actionLabel="Reintentar"
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
            ← Volver al curso
          </Link>
        </div>


        <header className="teacher-student-detail-header">

          <div>

            <p className="teacher-eyebrow">
              Estudiante del curso
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
                  ? "En el curso"
                  : "Retirado"}
              </span>

            </div>

          </div>


          <div className="teacher-student-meta">

            <div>
              <span>
                Última actividad
              </span>
              <strong>
                {formatDateTime(
                  summary?.lastActivityAt
                )}
              </strong>
            </div>

            <div>
              <span>
                Último acceso
              </span>
              <strong>
                {formatDateTime(
                  profile.lastLogin
                )}
              </strong>
            </div>

          </div>

        </header>


        <section className="teacher-summary-grid teacher-summary-grid--student">

          <article>
            <span>Envíos</span>
            <strong>
              {summary?.submissions || 0}
            </strong>
          </article>

          <article>
            <span>Ejecuciones</span>
            <strong>
              {summary?.executions || 0}
            </strong>
          </article>

          <article>
            <span>Completadas</span>
            <strong>
              {summary?.completedExecutions || 0}
            </strong>
          </article>

          <article>
            <span>Fallidas</span>
            <strong>
              {summary?.failedExecutions || 0}
            </strong>
          </article>

          <article>
            <span>Activas</span>
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
            >
              Ejecuciones
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
            >
              Envíos
            </button>

          </div>


          {activeTab === "executions" && (
            <>

              <div className="teacher-student-detail-toolbar">

                <div>

                  <label
                    htmlFor="teacher-student-execution-search"
                  >
                    Buscar ejecución
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
                    placeholder="Título de la entrega"
                  />

                </div>


                <div>

                  <label
                    htmlFor="teacher-student-execution-state"
                  >
                    Estado
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
                      Todos
                    </option>
                    <option value="QUEUED">
                      En cola
                    </option>
                    <option value="RUNNING">
                      Ejecutando
                    </option>
                    <option value="PROCESSING">
                      Procesando
                    </option>
                    <option value="COMPLETED">
                      Completadas
                    </option>
                    <option value="FAILED">
                      Fallidas
                    </option>
                    <option value="CANCELLED">
                      Canceladas
                    </option>
                  </select>

                </div>

              </div>


              {executionError && (
                <InlineState
                  type="error"
                  title="No pudimos cargar las ejecuciones"
                  description={executionError}
                  compact
                />
              )}


              {!executionError &&
                loadingExecutions &&
                executions.length === 0 && (
                  <InlineState
                    type="loading"
                    title="Cargando ejecuciones"
                    compact
                  />
                )}


              {!executionError &&
                !loadingExecutions &&
                executions.length === 0 && (
                  <InlineState
                    type="empty"
                    title="Sin ejecuciones en este curso"
                    description="No existen ejecuciones que coincidan con los filtros actuales."
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
                              Ejecución
                            </th>
                            <th>
                              Envío
                            </th>
                            <th>
                              Estado
                            </th>
                            <th>
                              Duración
                            </th>
                            <th>
                              Hardware
                            </th>
                            <th>
                              Actualizada
                            </th>
                            <th className="text-end">
                              Detalle
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
                                    <small>
                                      {execution.codename ||
                                        "Sin codename"}
                                    </small>
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
                                          `Envío #${execution.submissionId}`}
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
                                      {execution.stateLabel ||
                                        stateLabel(
                                          execution.state
                                        )}
                                    </span>
                                  </td>

                                  <td>
                                    {formatDuration(
                                      execution.durationMs
                                    )}
                                  </td>

                                  <td>
                                    {execution.hardwareProfile ||
                                      "—"}
                                  </td>

                                  <td>
                                    {formatDateTime(
                                      updatedAt
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
                                      Ver detalle
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
                    Buscar envío
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
                    placeholder="Título de la entrega"
                  />

                </div>

              </div>


              {submissionError && (
                <InlineState
                  type="error"
                  title="No pudimos cargar los envíos"
                  description={submissionError}
                  compact
                />
              )}


              {!submissionError &&
                loadingSubmissions &&
                submissions.length === 0 && (
                  <InlineState
                    type="loading"
                    title="Cargando envíos"
                    compact
                  />
                )}


              {!submissionError &&
                !loadingSubmissions &&
                submissions.length === 0 && (
                  <InlineState
                    type="empty"
                    title="Sin envíos en este curso"
                    description="Este estudiante todavía no tiene envíos asociados a esta instancia académica."
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
                              Envío
                            </th>
                            <th>
                              Estado
                            </th>
                            <th>
                              Ejec.
                            </th>
                            <th>
                              Completadas
                            </th>
                            <th>
                              Fallidas
                            </th>
                            <th>
                              Activas
                            </th>
                            <th>
                              Creado
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
                                          `Envío #${submission.id}`}
                                      </strong>
                                      <small>
                                        ID {submission.id}
                                      </small>
                                    </Link>
                                  </td>

                                  <td>
                                    <span className="teacher-submission-status">
                                      {submission.status ||
                                        "—"}
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
                                      submission.createdAt
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
