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
  EXECUTION_STATE_OPTIONS,
  executionStateBadgeClass,
  executionStateLabel,
} from "./adminExecutionStateModel";

const PAGE_SIZE = 15;

const dateTimeFormatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "medium",
  timeStyle: "short",
});

async function fetchJson(url, options = {}) {
  return requestJson(
    url,
    {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    },
    {
      fallback: "No fue posible completar la operación solicitada.",
    }
  );
}

function formatDateTime(value) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  return dateTimeFormatter.format(parsed);
}

function formatDuration(value) {
  if (value === null || value === undefined) return "—";

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "—";

  if (numeric < 1000) {
    return `${Math.round(numeric)} ms`;
  }

  return `${(numeric / 1000).toFixed(2)} s`;
}

function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function userStatusClass(status) {
  return status === "Activo"
    ? "app-status-badge--success"
    : "app-status-badge--warning";
}

function activeExecutions(summary) {
  return (
    (summary?.queuedExecutions || 0) +
    (summary?.runningExecutions || 0) +
    (summary?.processingExecutions || 0)
  );
}

function Pagination({
  page,
  total,
  pageSize = PAGE_SIZE,
  onPageChange,
  disabled,
}) {
  const totalPages = Math.max(
    1,
    Math.ceil(total / pageSize)
  );
  const first =
    total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="admin-detail-pagination">
      <span>
        {total === 0 ? "0 registros" : `${first}–${last} de ${total}`}
      </span>

      <div className="admin-detail-pagination-controls">
        <button
          type="button"
          className="btn btn-sm admin-detail-secondary-button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={disabled || page <= 1}
        >
          Anterior
        </button>

        <span>
          Página {Math.min(page, totalPages)} de {totalPages}
        </span>

        <button
          type="button"
          className="btn btn-sm admin-detail-secondary-button"
          onClick={() =>
            onPageChange(Math.min(totalPages, page + 1))
          }
          disabled={
            disabled ||
            total === 0 ||
            page >= totalPages
          }
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}

function ProfileOverview({ profile, summary }) {
  const active = activeExecutions(summary);

  return (
    <section className="admin-user-overview">
      <div className="admin-user-overview-main">
        <div className="admin-user-detail-avatar" aria-hidden="true">
          {initials(profile.fullName)}
        </div>

        <div className="admin-user-overview-copy">
          <div className="admin-user-overview-heading">
            <div>
              <h2>{profile.fullName}</h2>
              <p>{profile.email}</p>
            </div>

            <div className="admin-user-overview-badges">
              <span className="admin-user-role-chip">
                {profile.role}
              </span>
              <span
                className={`app-status-badge ${userStatusClass(
                  profile.status
                )}`}
              >
                {profile.status}
              </span>
            </div>
          </div>

          <dl className="admin-user-overview-meta">
            <div>
              <dt>ID</dt>
              <dd>{profile.id}</dd>
            </div>
            <div>
              <dt>Creado</dt>
              <dd>{formatDateTime(profile.createdAt)}</dd>
            </div>
            <div>
              <dt>Última sesión</dt>
              <dd>{formatDateTime(profile.lastLogin)}</dd>
            </div>
            <div>
              <dt>Última actividad</dt>
              <dd>{formatDateTime(summary.lastExecutionAt)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="admin-user-kpis">
        <article>
          <span>Envíos</span>
          <strong>{summary.submissionsCount || 0}</strong>
        </article>
        <article>
          <span>Ejecuciones</span>
          <strong>{summary.executionsCount || 0}</strong>
        </article>
        <article>
          <span>Completadas</span>
          <strong>{summary.completedExecutions || 0}</strong>
        </article>
        <article>
          <span>Fallidas</span>
          <strong>{summary.failedExecutions || 0}</strong>
        </article>
        <article>
          <span>Activas</span>
          <strong>{active}</strong>
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
        active ? "admin-detail-tab--active" : ""
      }`}
      onClick={onClick}
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
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(
    summary?.executionsCount || 0
  );
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [status, search]);

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(
      async () => {
        try {
          setLoading(true);
          setError(null);

          const params = new URLSearchParams({
            page: String(page),
            page_size: String(PAGE_SIZE),
          });

          if (status !== "all") {
            params.set("status", status);
          }

          if (search.trim()) {
            params.set("problem", search.trim());
          }

          const data = await fetchJson(
            `/api/admin/users/${userId}/executions?${params.toString()}`,
            { signal: controller.signal }
          );

          setItems(
            Array.isArray(data.items) ? data.items : []
          );
          setTotal(data.total ?? 0);
        } catch (err) {
          if (err.name === "AbortError") return;

          console.error(
            "[AdminUserDetail] Error cargando ejecuciones:",
            err
          );
          setError(
            err.message ||
              "No se pudieron cargar las ejecuciones."
          );
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      },
      search.trim() ? 250 : 0
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    userId,
    page,
    status,
    search,
    reloadToken,
  ]);

  const clearFilters = () => {
    setSearch("");
    setStatus("all");
    setPage(1);
  };

  return (
    <div>
      <div className="admin-detail-section-header">
        <div>
          <h3>Ejecuciones</h3>
          <p>
            Historial técnico basado en los estados canónicos de
            ejecución.
          </p>
        </div>

        <div className="admin-detail-inline-kpis">
          <span>
            <strong>{summary?.completedExecutions || 0}</strong>
            completadas
          </span>
          <span>
            <strong>{summary?.failedExecutions || 0}</strong>
            fallidas
          </span>
          <span>
            <strong>{activeExecutions(summary)}</strong>
            activas
          </span>
        </div>
      </div>

      <div className="admin-detail-toolbar">
        <div className="admin-detail-search">
          <label htmlFor="admin-execution-search">
            Buscar submission
          </label>
          <input
            id="admin-execution-search"
            className="form-control"
            type="search"
            placeholder="Ej. LCS, SIZE, CAMMR..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <div>
          <label htmlFor="admin-execution-status">
            Estado
          </label>
          <select
            id="admin-execution-status"
            className="form-select"
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
          >
            {EXECUTION_STATE_OPTIONS.map((option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="btn admin-detail-secondary-button"
          onClick={clearFilters}
          disabled={
            status === "all" && search.trim() === ""
          }
        >
          Limpiar
        </button>
      </div>

      {error && (
        <InlineState
          type="error"
          title="No pudimos cargar las ejecuciones"
          description={error}
          actionLabel="Reintentar"
          onAction={() =>
            setReloadToken((value) => value + 1)
          }
          compact
        />
      )}

      {!error && loading && items.length === 0 && (
        <InlineState
          type="loading"
          title="Cargando ejecuciones"
          description="Consultando el historial del usuario."
          compact
        />
      )}

      {!error && !loading && items.length === 0 && (
        <InlineState
          type="empty"
          title="No hay ejecuciones para mostrar"
          description={
            status !== "all" || search.trim()
              ? "No hay coincidencias con los filtros actuales."
              : "Este usuario todavía no tiene ejecuciones registradas."
          }
          actionLabel={
            status !== "all" || search.trim()
              ? "Limpiar filtros"
              : undefined
          }
          onAction={
            status !== "all" || search.trim()
              ? clearFilters
              : undefined
          }
          compact
        />
      )}

      {!error && items.length > 0 && (
        <>
          <div className="table-responsive admin-detail-table-shell">
            <table className="table align-middle admin-detail-table mb-0">
              <thead>
                <tr>
                  <th>Ejecución</th>
                  <th>Submission</th>
                  <th>Estado</th>
                  <th>Duración</th>
                  <th>Hardware</th>
                  <th>Actualizada</th>
                  <th className="text-end">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {items.map((execution) => {
                  const state = String(
                    execution.state || ""
                  ).toUpperCase();
                  const updatedAt =
                    execution.finishedAt ||
                    execution.processingAt ||
                    execution.startedAt;

                  return (
                    <tr key={execution.executionId}>
                      <td>
                        <div className="admin-detail-primary-cell">
                          <strong>
                            #{execution.executionId}
                          </strong>
                          <span>
                            {execution.codename || "Sin codename"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="admin-detail-primary-cell">
                          <strong>
                            {execution.submissionTitle ||
                              `Submission #${execution.submissionId}`}
                          </strong>
                          <span>
                            ID {execution.submissionId}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`app-status-badge ${executionStateBadgeClass(
                            state
                          )}`}
                        >
                          {execution.stateLabel ||
                            executionStateLabel(state)}
                        </span>
                      </td>
                      <td>
                        {formatDuration(
                          execution.durationMs
                        )}
                      </td>
                      <td>
                        {execution.hardwareProfile || "—"}
                      </td>
                      <td>{formatDateTime(updatedAt)}</td>
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
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            total={total}
            onPageChange={setPage}
            disabled={loading}
          />
        </>
      )}
    </div>
  );
}

function SubmissionsTab({ userId }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(
      async () => {
        try {
          setLoading(true);
          setError(null);

          const params = new URLSearchParams({
            page: String(page),
            page_size: String(PAGE_SIZE),
          });

          if (search.trim()) {
            params.set("problem", search.trim());
          }

          const data = await fetchJson(
            `/api/admin/users/${userId}/submissions?${params.toString()}`,
            { signal: controller.signal }
          );

          setItems(
            Array.isArray(data.items) ? data.items : []
          );
          setTotal(data.total ?? 0);
        } catch (err) {
          if (err.name === "AbortError") return;

          console.error(
            "[AdminUserDetail] Error cargando submissions:",
            err
          );
          setError(
            err.message ||
              "No se pudieron cargar los submissions."
          );
        } finally {
          if (!controller.signal.aborted) {
            setLoading(false);
          }
        }
      },
      search.trim() ? 250 : 0
    );

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [userId, page, search, reloadToken]);

  return (
    <div>
      <div className="admin-detail-section-header">
        <div>
          <h3>Submissions</h3>
          <p>
            Entregas del usuario y distribución de sus ejecuciones.
          </p>
        </div>
        <span className="admin-detail-total-chip">
          {total} total
        </span>
      </div>

      <div className="admin-detail-toolbar admin-detail-toolbar--compact">
        <div className="admin-detail-search">
          <label htmlFor="admin-submission-search">
            Buscar submission
          </label>
          <input
            id="admin-submission-search"
            className="form-control"
            type="search"
            placeholder="Título de la entrega"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <button
          type="button"
          className="btn admin-detail-secondary-button"
          onClick={() => setSearch("")}
          disabled={!search.trim()}
        >
          Limpiar
        </button>
      </div>

      {error && (
        <InlineState
          type="error"
          title="No pudimos cargar los submissions"
          description={error}
          actionLabel="Reintentar"
          onAction={() =>
            setReloadToken((value) => value + 1)
          }
          compact
        />
      )}

      {!error && loading && items.length === 0 && (
        <InlineState
          type="loading"
          title="Cargando submissions"
          description="Consultando las entregas del usuario."
          compact
        />
      )}

      {!error && !loading && items.length === 0 && (
        <InlineState
          type="empty"
          title="No hay submissions para mostrar"
          description={
            search.trim()
              ? "No hay coincidencias con la búsqueda actual."
              : "Este usuario todavía no tiene submissions registrados."
          }
          actionLabel={
            search.trim() ? "Limpiar búsqueda" : undefined
          }
          onAction={
            search.trim()
              ? () => setSearch("")
              : undefined
          }
          compact
        />
      )}

      {!error && items.length > 0 && (
        <>
          <div className="table-responsive admin-detail-table-shell">
            <table className="table align-middle admin-detail-table mb-0">
              <thead>
                <tr>
                  <th>Submission</th>
                  <th>Estado</th>
                  <th>Ejecuciones</th>
                  <th>Completadas</th>
                  <th>Fallidas</th>
                  <th>Activas</th>
                  <th>Creado</th>
                </tr>
              </thead>
              <tbody>
                {items.map((submission) => {
                  const active =
                    (submission.queuedExecutions || 0) +
                    (submission.runningExecutions || 0) +
                    (submission.processingExecutions || 0);

                  return (
                    <tr key={submission.id}>
                      <td>
                        <div className="admin-detail-primary-cell">
                          <strong>
                            {submission.title ||
                              `Submission #${submission.id}`}
                          </strong>
                          <span>ID {submission.id}</span>
                        </div>
                      </td>
                      <td>
                        <span className="admin-submission-status">
                          {submission.status || "—"}
                        </span>
                      </td>
                      <td>{submission.executionsCount || 0}</td>
                      <td>{submission.completedExecutions || 0}</td>
                      <td>{submission.failedExecutions || 0}</td>
                      <td>{active}</td>
                      <td>
                        {formatDateTime(
                          submission.createdAt
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            total={total}
            onPageChange={setPage}
            disabled={loading}
          />
        </>
      )}
    </div>
  );
}

function AuditTab({ userId }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [reloadToken, setReloadToken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: String(page),
          page_size: String(PAGE_SIZE),
        });

        const data = await fetchJson(
          `/api/admin/users/${userId}/audit-log?${params.toString()}`,
          { signal: controller.signal }
        );

        setItems(
          Array.isArray(data.items) ? data.items : []
        );
        setTotal(data.total ?? 0);
      } catch (err) {
        if (err.name === "AbortError") return;

        console.error(
          "[AdminUserDetail] Error cargando auditoría:",
          err
        );
        setError(
          err.message ||
            "No se pudo cargar el historial de acciones."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [userId, page, reloadToken]);

  return (
    <div>
      <div className="admin-detail-section-header">
        <div>
          <h3>Actividad</h3>
          <p>
            Acciones persistidas en el registro de auditoría.
          </p>
        </div>
        <span className="admin-detail-total-chip">
          {total} eventos
        </span>
      </div>

      {error && (
        <InlineState
          type="error"
          title="No pudimos cargar la actividad"
          description={error}
          actionLabel="Reintentar"
          onAction={() =>
            setReloadToken((value) => value + 1)
          }
          compact
        />
      )}

      {!error && loading && items.length === 0 && (
        <InlineState
          type="loading"
          title="Cargando actividad"
          description="Consultando el registro de auditoría."
          compact
        />
      )}

      {!error && !loading && items.length === 0 && (
        <InlineState
          type="empty"
          title="Sin actividad registrada"
          description="No existen eventos de auditoría asociados a este usuario."
          compact
        />
      )}

      {!error && items.length > 0 && (
        <>
          <div className="admin-audit-list">
            {items.map((item) => (
              <article
                key={item.id}
                className="admin-audit-item"
              >
                <div className="admin-audit-marker" aria-hidden="true" />
                <div>
                  <div className="admin-audit-item-heading">
                    <strong>{item.action || "Acción"}</strong>
                    <span>
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  <p>
                    {item.description ||
                      "Sin descripción registrada."}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <Pagination
            page={page}
            total={total}
            onPageChange={setPage}
            disabled={loading}
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
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!executionId) return undefined;

    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setDetail(null);

        const data = await fetchJson(
          `/api/admin/executions/${executionId}`,
          { signal: controller.signal }
        );

        setDetail(data.execution || null);
      } catch (err) {
        if (err.name === "AbortError") return;

        console.error(
          "[AdminUserDetail] Error cargando detalle de ejecución:",
          err
        );
        setError(
          err.message ||
            "No se pudo cargar el detalle de la ejecución."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [executionId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () =>
      window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!executionId) return null;

  const state = String(detail?.state || "").toUpperCase();
  const measurement =
    detail?.executionConfig?.measurement || {};
  const hardware = detail?.hardwareSnapshot || {};
  const node = hardware.node || {};
  const hardwareMeasurement = hardware.measurement || {};
  const failure = detail?.failure || null;

  return (
    <div
      className="admin-execution-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className="admin-execution-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-execution-modal-title"
      >
        <header className="admin-execution-modal-header">
          <div>
            <p>Detalle técnico</p>
            <h2 id="admin-execution-modal-title">
              Ejecución #{executionId}
            </h2>
          </div>

          <button
            type="button"
            className="admin-execution-modal-close"
            onClick={onClose}
            aria-label="Cerrar detalle"
          >
            ×
          </button>
        </header>

        <div className="admin-execution-modal-body">
          {loading && (
            <InlineState
              type="loading"
              title="Cargando detalle"
              description="Consultando la ejecución canónica."
              compact
            />
          )}

          {error && (
            <InlineState
              type="error"
              title="No pudimos cargar el detalle"
              description={error}
              compact
            />
          )}

          {!loading && !error && detail && (
            <>
              <div className="admin-execution-modal-summary">
                <div>
                  <span>Submission</span>
                  <strong>
                    {detail.submissionTitle ||
                      `Submission #${detail.submissionId}`}
                  </strong>
                </div>
                <div>
                  <span>Benchmark</span>
                  <strong>{detail.benchmark || "—"}</strong>
                </div>
                <div>
                  <span>Estado</span>
                  <strong>
                    <span
                      className={`app-status-badge ${executionStateBadgeClass(
                        state
                      )}`}
                    >
                      {detail.stateLabel ||
                        executionStateLabel(state)}
                    </span>
                  </strong>
                </div>
                <div>
                  <span>Duración</span>
                  <strong>
                    {formatDuration(detail.durationMs)}
                  </strong>
                </div>
              </div>

              <div className="admin-execution-detail-grid">
                <article>
                  <h3>Configuración</h3>
                  <dl>
                    <div>
                      <dt>Input máximo</dt>
                      <dd>{detail.inputSize ?? "—"}</dd>
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
                      <dd>{measurement.points ?? "—"}</dd>
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
                      <dd>{node.architecture || "—"}</dd>
                    </div>
                    <div>
                      <dt>CPU lógicas</dt>
                      <dd>{node.logical_cpus ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Backend</dt>
                      <dd>
                        {hardwareMeasurement.backend || "—"}
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

              {failure && (
                <article className="admin-execution-failure">
                  <h3>Fallo registrado</h3>
                  <div>
                    <strong>
                      {failure.code || "Sin código"}
                    </strong>
                    <span>
                      {failure.stage || "Etapa desconocida"}
                    </span>
                  </div>
                  <p>
                    {failure.message ||
                      "Sin mensaje adicional."}
                  </p>
                </article>
              )}

              <div className="admin-execution-timestamps">
                <span>
                  Iniciada {formatDateTime(detail.startedAt)}
                </span>
                <span>
                  Procesando {formatDateTime(detail.processingAt)}
                </span>
                <span>
                  Finalizada {formatDateTime(detail.finishedAt)}
                </span>
              </div>
            </>
          )}
        </div>

        <footer className="admin-execution-modal-footer">
          <button
            type="button"
            className="btn admin-detail-secondary-button"
            onClick={onClose}
          >
            Cerrar
          </button>

          {detail?.resultAvailable &&
            detail?.codename && (
              <Link
                to={`/code/${detail.codename}`}
                className="btn admin-detail-primary-button"
              >
                Ver resultados
              </Link>
            )}
        </footer>
      </section>
    </div>
  );
}

const AdminUserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] =
    useState("executions");
  const [profile, setProfile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [executionId, setExecutionId] =
    useState(null);

  const closeExecutionDetail = useCallback(() => {
    setExecutionId(null);
  }, []);

  useEffect(() => {
    if (!id) return undefined;

    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await fetchJson(
          `/api/admin/users/${id}`,
          { signal: controller.signal }
        );

        const rawProfile = data.profile || {};
        const rawSummary = data.summary || {};

        setProfile({
          id: rawProfile.id,
          fullName:
            rawProfile.full_name ||
            rawProfile.fullName ||
            "Usuario sin nombre",
          email: rawProfile.email || "—",
          role:
            rawProfile.role ||
            rawProfile.role_name ||
            "Sin rol",
          status:
            rawProfile.statusLabel ||
            (rawProfile.isActive
              ? "Activo"
              : "Inactivo"),
          createdAt: rawProfile.createdAt,
          lastLogin: rawProfile.lastLogin,
        });

        setSummary({
          submissionsCount:
            rawSummary.submissionsCount || 0,
          executionsCount:
            rawSummary.executionsCount || 0,
          completedExecutions:
            rawSummary.completedExecutions ||
            rawSummary.okExecutions ||
            0,
          failedExecutions:
            rawSummary.failedExecutions ||
            ((rawSummary.timeoutExecutions || 0) +
              (rawSummary.errorExecutions || 0)),
          queuedExecutions:
            rawSummary.queuedExecutions || 0,
          runningExecutions:
            rawSummary.runningExecutions || 0,
          processingExecutions:
            rawSummary.processingExecutions || 0,
          cancelledExecutions:
            rawSummary.cancelledExecutions || 0,
          lastExecutionAt:
            rawSummary.lastExecutionAt || null,
        });
      } catch (err) {
        if (err.name === "AbortError") return;

        console.error(
          "[AdminUserDetail] Error cargando perfil:",
          err
        );
        setError(
          err.message ||
            "No se pudo cargar el perfil del usuario."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [id, reloadToken]);

  useEffect(() => {
    setActiveTab("executions");
    setExecutionId(null);
  }, [id]);

  const tabs = useMemo(
    () => [
      {
        value: "executions",
        label: "Ejecuciones",
        count: summary?.executionsCount || 0,
      },
      {
        value: "submissions",
        label: "Submissions",
        count: summary?.submissionsCount || 0,
      },
      {
        value: "audit",
        label: "Actividad",
        count: null,
      },
    ],
    [summary]
  );

  return (
    <div className="app-page admin-page admin-user-detail-page container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-xxl-11">
          <header className="admin-user-detail-header">
            <div>
              <button
                type="button"
                className="admin-detail-back"
                onClick={() => navigate("/admin/users")}
              >
                ← Volver a usuarios
              </button>
              <p className="admin-user-detail-eyebrow">
                Administración
              </p>
              <h1>Detalle de usuario</h1>
              <p>
                Perfil, entregas, ejecuciones y actividad
                administrativa.
              </p>
            </div>
          </header>

          {loading && !profile && (
            <InlineState
              type="loading"
              title="Cargando usuario"
              description="Consultando perfil y actividad."
            />
          )}

          {error && !profile && (
            <InlineState
              type="error"
              title="No pudimos cargar el usuario"
              description={error}
              actionLabel="Reintentar"
              onAction={() =>
                setReloadToken((value) => value + 1)
              }
            />
          )}

          {profile && summary && (
            <>
              <ProfileOverview
                profile={profile}
                summary={summary}
              />

              <section className="admin-user-detail-content">
                <nav
                  className="admin-detail-tabs"
                  aria-label="Detalle administrativo"
                >
                  {tabs.map((tab) => (
                    <TabButton
                      key={tab.value}
                      active={activeTab === tab.value}
                      onClick={() =>
                        setActiveTab(tab.value)
                      }
                    >
                      <span>{tab.label}</span>
                      {tab.count !== null && (
                        <span className="admin-detail-tab-count">
                          {tab.count}
                        </span>
                      )}
                    </TabButton>
                  ))}
                </nav>

                <div className="admin-detail-tab-panel">
                  {activeTab === "executions" && (
                    <ExecutionsTab
                      userId={id}
                      summary={summary}
                      onOpenDetail={setExecutionId}
                    />
                  )}

                  {activeTab === "submissions" && (
                    <SubmissionsTab userId={id} />
                  )}

                  {activeTab === "audit" && (
                    <AuditTab userId={id} />
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <ExecutionDetailModal
        executionId={executionId}
        onClose={closeExecutionDetail}
      />
    </div>
  );
};

export default AdminUserDetail;
