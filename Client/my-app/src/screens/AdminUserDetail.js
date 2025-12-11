import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import "./AdminUserDetail.css";

/**
 * =====================================================
 * Helpers genéricos (fetch JSON + formateo de fechas)
 * =====================================================
 */

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    // Puede que no haya body JSON (500 HTML, etc.)
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      data?.message ||
      `Error ${response.status} al llamar a la API.`;
    const error = new Error(message);
    error.status = response.status;
    error.code = data?.error?.code;
    error.raw = data;
    throw error;
  }

  return data;
}

function formatDateTime(value) {
  if (!value) return "—";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  } catch {
    return value;
  }
}

/**
 * =====================================================
 * Helpers visuales para badges de estado
 * =====================================================
 */

const getExecutionStatusClass = (status) => {
  if (status === "Aprobado") return "app-status-badge--success";
  if (status === "Rechazado") return "app-status-badge--warning";
  if (status === "Error") return "app-status-badge--error";
  return "";
};

const getUserStatusClass = (status) => {
  if (status === "Activo") return "app-status-badge--success";
  if (status === "Bloqueado") return "app-status-badge--error";
  return "app-status-badge--warning";
};

/**
 * =====================================================
 * Componentes auxiliares de UI (perfil, tabs, etc.)
 * =====================================================
 */

/**
 * Tarjeta lateral de perfil de usuario (columna izquierda)
 * Usa los datos ya adaptados desde el backend.
 */
const UserProfileCard = ({ profile, summary, mode = "admin" }) => {
  const initial =
    profile.fullName && profile.fullName.length > 0
      ? profile.fullName.charAt(0).toUpperCase()
      : "?";

  return (
    <div className="card app-card admin-card h-100">
      <div className="card-body d-flex flex-column">
        <h5 className="card-title mb-3">Perfil</h5>

        <div className="user-detail-avatar mb-3">
          <span>{initial}</span>
        </div>

        <h4 className="mb-1 user-detail-name">{profile.fullName}</h4>
        <p className="text-muted mb-3 small user-detail-email">
          {profile.email}
        </p>

        <div className="mb-3">
          <span className="badge rounded-pill bg-light text-dark me-2">
            {profile.role}
          </span>
          <span className="badge rounded-pill bg-primary-subtle text-primary-emphasis">
            ID: {profile.id}
          </span>
        </div>

        <dl className="row small mb-0 user-detail-meta">
          <dt className="col-5 text-muted">Estado</dt>
          <dd className="col-7 mb-1">
            <span
              className={`app-status-badge ${getUserStatusClass(
                profile.status
              )}`}
            >
              {profile.status}
            </span>
          </dd>

          <dt className="col-5 text-muted">Creado</dt>
          <dd className="col-7 mb-1">{profile.createdAt}</dd>

          <dt className="col-5 text-muted">Últ. sesión</dt>
          <dd className="col-7 mb-1">{profile.lastLogin}</dd>

          <dt className="col-5 text-muted">Últ. ejecución</dt>
          <dd className="col-7 mb-1">{profile.lastExecutionAt}</dd>

          <dt className="col-5 text-muted">Submissions</dt>
          <dd className="col-7 mb-1">
            {summary.totalSubmissions} (
            {summary.passedCount} ok / {summary.failedCount} err)
          </dd>

          <dt className="col-5 text-muted">Estado ejecuciones</dt>
          <dd className="col-7 mb-1">{summary.lastExecutionStatus}</dd>
        </dl>

        <hr className="my-3" />

        {/* Acciones contexto admin / self */}
        <div className="d-grid gap-2 mt-auto">
          {mode === "admin" && (
            <>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
              >
                Ver como estudiante (mock)
              </button>
              <button type="button" className="btn btn-outline-danger btn-sm">
                Bloquear usuario (mock)
              </button>
            </>
          )}

          {mode === "self" && (
            <button type="button" className="btn btn-outline-secondary btn-sm">
              Editar preferencias (mock)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Tabs superiores para cambiar entre Ejecuciones / Submissions / Historial
 */
const UserDetailTabs = ({ activeTab, onChangeTab }) => {
  return (
    <ul className="nav nav-tabs app-tabs mb-3">
      <li className="nav-item">
        <button
          type="button"
          className={`nav-link ${
            activeTab === "executions" ? "active" : ""
          }`.trim()}
          onClick={() => onChangeTab("executions")}
        >
          Ejecuciones
        </button>
      </li>
      <li className="nav-item">
        <button
          type="button"
          className={`nav-link ${
            activeTab === "submissions" ? "active" : ""
          }`.trim()}
          onClick={() => onChangeTab("submissions")}
        >
          Submissions
        </button>
      </li>
      <li className="nav-item">
        <button
          type="button"
          className={`nav-link ${
            activeTab === "history" ? "active" : ""
          }`.trim()}
          onClick={() => onChangeTab("history")}
        >
          Historial
        </button>
      </li>
    </ul>
  );
};

/**
 * Tab de ejecuciones: filtros + tabla + resumen compactos.
 * Recibe los datos ya filtrados desde el componente padre.
 */
const ExecutionsTab = ({
  executions,
  totalExecutions,
  stats,
  statusFilter,
  setStatusFilter,
  problemFilter,
  setProblemFilter,
  onClearFilters,
  onOpenExecutionModal,
  isLoading,
  error,
}) => {
  return (
    <div className="d-flex flex-column h-100">
      {/* Header + resumen */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h5 className="card-title mb-1">Ejecuciones recientes</h5>
          <p className="text-muted small mb-0">
            Resumen de ejecuciones LCS / CAMM asociadas al usuario.
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2 text-end">
          <div className="badge-summary badge-summary-compact">
            <span className="summary-label">Total</span>
            <span className="summary-value">{stats.total}</span>
          </div>
          <div className="badge-summary badge-summary-compact badge-summary-success">
            <span className="summary-label">Aprobadas</span>
            <span className="summary-value">{stats.approved}</span>
          </div>
          <div className="badge-summary badge-summary-compact badge-summary-warning">
            <span className="summary-label">Rechazadas</span>
            <span className="summary-value">{stats.rejected}</span>
          </div>
          <div className="badge-summary badge-summary-compact badge-summary-error">
            <span className="summary-label">Errores</span>
            <span className="summary-value">{stats.errors}</span>
          </div>
        </div>
      </div>

      {/* Estado de carga / error */}
      {isLoading && (
        <div className="alert alert-secondary app-alert-sm mb-2">
          Cargando ejecuciones...
        </div>
      )}
      {error && (
        <div className="alert alert-danger app-alert-sm mb-2">
          {error}
        </div>
      )}

      {/* Filtros */}
      <div className="row g-2 align-items-end mb-3">
        <div className="col-12 col-md-6">
          <label className="form-label app-label-sm mb-1">
            Filtrar por nombre de problema / submission
          </label>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Ej: LCS, CAMM..."
            value={problemFilter}
            onChange={(e) => setProblemFilter(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="col-6 col-md-3">
          <label className="form-label app-label-sm mb-1">Estado</label>
          <select
            className="form-select form-select-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            disabled={isLoading}
          >
            <option value="all">Todos</option>
            <option value="Aprobado">Aprobado</option>
            <option value="Rechazado">Rechazado</option>
            <option value="Error">Error</option>
          </select>
        </div>
        <div className="col-6 col-md-3 text-md-end">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onClearFilters}
            disabled={isLoading && executions.length === 0}
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="table-responsive app-table-wrapper admin-table-wrapper flex-grow-1">
        <table className="table table-hover align-middle app-table admin-table mb-0">
          <thead>
            <tr>
              <th>ID</th>
              <th>Submission / Problema</th>
              <th className="text-center">Estado</th>
              <th className="text-center">Duración (ms)</th>
              <th className="text-center">Energía</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {executions.map((e) => (
              <tr key={e.id}>
                <td className="small text-muted">#{e.id}</td>
                <td>
                  <div className="d-flex flex-column">
                    <span className="fw-semibold">{e.problem}</span>
                    <span className="text-muted small">{e.date}</span>
                  </div>
                </td>
                <td className="text-center">
                  <span
                    className={`app-status-badge ${getExecutionStatusClass(
                      e.status
                    )}`}
                  >
                    {e.status}
                  </span>
                </td>
                <td className="text-center">{e.durationMs ?? "—"}</td>
                <td className="text-center">{e.energy}</td>
                <td className="text-end">
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => onOpenExecutionModal(e)}
                    >
                      Resumen
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      disabled
                    >
                      Re-ejecutar (mock)
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => onOpenExecutionModal(e)}
                    >
                      Ver detalle
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!isLoading && executions.length === 0 && !error && (
              <tr>
                <td colSpan="6" className="text-center py-4">
                  <span className="text-muted small">
                    No hay ejecuciones que coincidan con los filtros actuales.
                  </span>
                </td>
              </tr>
            )}

            {isLoading && executions.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-4">
                  <span className="text-muted small">
                    Cargando ejecuciones...
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer tabla */}
      <div className="admin-table-footer text-muted small px-2 pt-2">
        Mostrando {executions.length} de {totalExecutions} ejecuciones.
      </div>
    </div>
  );
};

/**
 * Tab de submissions del usuario
 */
const SubmissionsTab = ({ submissions, isLoading, error }) => {
  const total = submissions.length;

  return (
    <div className="d-flex flex-column h-100">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h5 className="card-title mb-1">Submissions del usuario</h5>
          <p className="text-muted small mb-0">
            Entregas realizadas por el usuario, agrupando sus ejecuciones.
          </p>
        </div>
        <div className="text-end">
          <div className="badge-summary badge-summary-compact">
            <span className="summary-label">Total</span>
            <span className="summary-value">{total}</span>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="alert alert-secondary app-alert-sm mb-2">
          Cargando submissions...
        </div>
      )}
      {error && (
        <div className="alert alert-danger app-alert-sm mb-2">
          {error}
        </div>
      )}

      <div className="table-responsive app-table-wrapper admin-table-wrapper flex-grow-1">
        <table className="table table-hover align-middle app-table admin-table mb-0">
          <thead>
            <tr>
              <th>ID</th>
              <th>Problema</th>
              <th>Título</th>
              <th className="text-center">Estado</th>
              <th className="text-center">Fecha</th>
              <th className="text-end">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id}>
                <td className="small text-muted">#{s.id}</td>
                <td>{s.problem}</td>
                <td>
                  <span className="fw-semibold">{s.title}</span>
                </td>
                <td className="text-center">
                  <span className="badge rounded-pill bg-light text-dark">
                    {s.status}
                  </span>
                </td>
                <td className="text-center">{s.date}</td>
                <td className="text-end">
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      disabled
                    >
                      Ver ejecuciones (mock)
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      disabled
                    >
                      Re-ejecutar (mock)
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!isLoading && submissions.length === 0 && !error && (
              <tr>
                <td colSpan="6" className="text-center py-4">
                  <span className="text-muted small">
                    Este usuario aún no tiene submissions registrados.
                  </span>
                </td>
              </tr>
            )}

            {isLoading && submissions.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center py-4">
                  <span className="text-muted small">
                    Cargando submissions...
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-table-footer text-muted small px-2 pt-2">
        Mostrando {total} submissions.
      </div>
    </div>
  );
};

/**
 * Tab de historial (audit_log)
 */
const AuditLogTab = ({ auditLog, isLoading, error }) => {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="d-flex flex-column h-100">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <div>
          <h5 className="card-title mb-1">Historial de acciones</h5>
          <p className="text-muted small mb-0">
            Actividad registrada del usuario en la plataforma.
          </p>
        </div>
        <div className="text-end">
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={() => setShowFilters((prev) => !prev)}
          >
            {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="alert alert-secondary app-alert-sm mb-2">
          Cargando historial...
        </div>
      )}
      {error && (
        <div className="alert alert-danger app-alert-sm mb-2">
          {error}
        </div>
      )}

      {/* Acordeón simple para filtros (mock) */}
      {showFilters && (
        <div className="mb-3">
          <div className="card app-card app-card-subtle">
            <div className="card-body py-2">
              <div className="row g-2 align-items-end">
                <div className="col-12 col-md-4">
                  <label className="form-label app-label-sm mb-1">
                    Acción
                  </label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Ej: login, create_submission..."
                    disabled
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label app-label-sm mb-1">
                    Desde
                  </label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    disabled
                  />
                </div>
                <div className="col-6 col-md-3">
                  <label className="form-label app-label-sm mb-1">Hasta</label>
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    disabled
                  />
                </div>
                <div className="col-12 col-md-2 text-md-end">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled
                  >
                    Aplicar (mock)
                  </button>
                </div>
              </div>
              <p className="text-muted small mb-0 mt-2">
                Estos filtros son de demostración. Se conectarán a{" "}
                <code>/api/admin/users/:id/audit-log</code> si se requiere en
                el futuro.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Timeline / lista */}
      <div className="flex-grow-1 app-timeline-wrapper">
        <ul className="list-group list-group-flush app-timeline-list">
          {auditLog.map((item) => (
            <li
              key={item.id}
              className="list-group-item app-timeline-item d-flex align-items-start"
            >
              <div className="app-timeline-dot me-3 mt-1" />
              <div className="flex-grow-1">
                <div className="d-flex justify-content-between align-items-center">
                  <span className="fw-semibold small">{item.action}</span>
                  <span className="text-muted small">{item.createdAt}</span>
                </div>
                <p className="mb-0 small">{item.description}</p>
              </div>
            </li>
          ))}

          {!isLoading && auditLog.length === 0 && !error && (
            <li className="list-group-item text-center py-4">
              <span className="text-muted small">
                No hay acciones registradas para este usuario.
              </span>
            </li>
          )}

          {isLoading && auditLog.length === 0 && (
            <li className="list-group-item text-center py-4">
              <span className="text-muted small">Cargando historial...</span>
            </li>
          )}
        </ul>
      </div>

      <div className="admin-table-footer text-muted small px-2 pt-2">
        Mostrando {auditLog.length} acciones.
      </div>
    </div>
  );
};

/**
 * Modal de detalle de ejecución (por ahora usando los datos ya cargados en la tabla)
 */
const ExecutionDetailModal = ({ show, execution, onClose }) => {
  if (!show || !execution) return null;

  const handleBackdropClick = (e) => {
    if (e.target.classList.contains("app-modal-backdrop")) {
      onClose();
    }
  };

  return (
    <div
      className="modal fade show d-block app-modal-backdrop"
      tabIndex="-1"
      role="dialog"
      onClick={handleBackdropClick}
    >
      <div
        className="modal-dialog modal-lg modal-dialog-centered"
        role="document"
      >
        <div className="modal-content app-modal">
          <div className="modal-header">
            <h5 className="modal-title">
              Detalle de ejecución #{execution.id}
            </h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            />
          </div>
          <div className="modal-body">
            <div className="mb-3">
              <h6 className="mb-1">{execution.problem}</h6>
              <p className="text-muted small mb-0">{execution.date}</p>
            </div>

            <div className="row small mb-3">
              <div className="col-6 col-md-3">
                <div className="text-muted">Estado</div>
                <div>
                  <span
                    className={`app-status-badge ${getExecutionStatusClass(
                      execution.status
                    )}`}
                  >
                    {execution.status}
                  </span>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="text-muted">Duración</div>
                <div>{execution.durationMs ?? "—"} ms</div>
              </div>
              <div className="col-6 col-md-3 mt-2 mt-md-0">
                <div className="text-muted">Energía (mock)</div>
                <div>{execution.energy}</div>
              </div>
              <div className="col-6 col-md-3 mt-2 mt-md-0">
                <div className="text-muted">Hardware (mock)</div>
                <div>{execution.hardwareProfile || "—"}</div>
              </div>
            </div>

            <hr />

            <div className="mb-3">
              <h6 className="mb-2">Resumen automático (mock)</h6>
              <p className="small mb-0">
                En esta ejecución, el tiempo de respuesta fue{" "}
                <strong>{execution.durationMs ?? "—"} ms</strong> con un
                consumo de energía clasificado como{" "}
                <strong>{execution.energy}</strong>. Más adelante, aquí se
                integrará una explicación generada por IA, comparando esta
                ejecución con otras del mismo problema y con los promedios del
                curso.
              </p>
            </div>

            <div className="mb-0">
              <h6 className="mb-2">Métricas técnicas (mock)</h6>
              <div className="row small">
                <div className="col-6 col-md-3">
                  <div className="text-muted">CPU time</div>
                  <div>—</div>
                </div>
                <div className="col-6 col-md-3">
                  <div className="text-muted">Memoria máx.</div>
                  <div>—</div>
                </div>
                <div className="col-6 col-md-3 mt-2 mt-md-0">
                  <div className="text-muted">Energy (J)</div>
                  <div>—</div>
                </div>
                <div className="col-6 col-md-3 mt-2 mt-md-0">
                  <div className="text-muted">Cache misses</div>
                  <div>—</div>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={onClose}
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * =====================================================
 * Componente principal: AdminUserDetail
 * - Carga datos desde la API
 * - Maneja tabs, filtros, errores y modal
 * =====================================================
 */

const AdminUserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Perfil + resumen de actividad
  const [userProfile, setUserProfile] = useState(null);
  const [userSummary, setUserSummary] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState(null);

  // Datos de las tabs
  const [executions, setExecutions] = useState([]);
  const [executionsLoading, setExecutionsLoading] = useState(false);
  const [executionsError, setExecutionsError] = useState(null);

  const [submissions, setSubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState(null);

  const [auditLog, setAuditLog] = useState([]);
  const [auditLogLoading, setAuditLogLoading] = useState(false);
  const [auditLogError, setAuditLogError] = useState(null);

  // Flags para evitar recargar cada vez que vuelves a la tab
  const [hasLoadedExecutions, setHasLoadedExecutions] = useState(false);
  const [hasLoadedSubmissions, setHasLoadedSubmissions] = useState(false);
  const [hasLoadedAuditLog, setHasLoadedAuditLog] = useState(false);

  // UI: tab activa, filtros de ejecuciones, modal
  const [activeTab, setActiveTab] = useState("executions");
  const [statusFilter, setStatusFilter] = useState("all");
  const [problemFilter, setProblemFilter] = useState("");
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);

  /**
   * Cuando cambia el id de usuario, reseteamos datos de tabs y flags
   */
  useEffect(() => {
    setExecutions([]);
    setSubmissions([]);
    setAuditLog([]);
    setHasLoadedExecutions(false);
    setHasLoadedSubmissions(false);
    setHasLoadedAuditLog(false);
    setActiveTab("executions");
    setStatusFilter("all");
    setProblemFilter("");
  }, [id]);

  /**
   * Carga perfil + resumen desde /api/admin/users/:id
   */
  useEffect(() => {
    if (!id) return;

    setProfileLoading(true);
    setProfileError(null);

    fetchJson(`/api/admin/users/${id}`)
      .then((data) => {
        const rawProfile = data.profile || {};
        const rawSummary = data.summary || {};

        const mappedProfile = {
          id: rawProfile.id,
          fullName: rawProfile.full_name || rawProfile.fullName || "—",
          email: rawProfile.email || "—",
          role: rawProfile.role || rawProfile.role_name || "—",
          status:
            rawProfile.statusLabel ||
            (rawProfile.isActive ? "Activo" : "Inactivo"),
          createdAt: formatDateTime(rawProfile.createdAt),
          lastLogin: formatDateTime(rawProfile.lastLogin),
          lastExecutionAt: formatDateTime(rawSummary.lastExecutionAt),
        };

        const mappedSummary = {
          totalSubmissions: rawSummary.submissionsCount || 0,
          totalExecutions: rawSummary.executionsCount || 0,
          passedCount: rawSummary.okExecutions || 0,
          failedCount:
            (rawSummary.timeoutExecutions || 0) +
            (rawSummary.errorExecutions || 0),
          lastExecutionStatus:
            rawSummary.lastExecutionStatus || "Sin ejecuciones",
          okExecutions: rawSummary.okExecutions || 0,
          timeoutExecutions: rawSummary.timeoutExecutions || 0,
          errorExecutions: rawSummary.errorExecutions || 0,
        };

        setUserProfile(mappedProfile);
        setUserSummary(mappedSummary);
      })
      .catch((err) => {
        console.error("Error cargando perfil de admin user:", err);
        setProfileError(
          err.message ||
            "No se pudo cargar el perfil del usuario. Intenta nuevamente más tarde."
        );
      })
      .finally(() => {
        setProfileLoading(false);
      });
  }, [id]);

  /**
   * Carga ejecuciones de /api/admin/users/:id/executions
   */
  const loadExecutions = () => {
    if (!id) return;
    setExecutionsLoading(true);
    setExecutionsError(null);

    fetchJson(`/api/admin/users/${id}/executions?page=1&page_size=100`)
      .then((data) => {
        const items = data.items || [];
        const mapped = items.map((e) => ({
          id: e.executionId,
          submissionId: e.submissionId,
          problem: e.submissionTitle || `Submission #${e.submissionId}`,
          status: e.status,
          rawStatus: e.rawStatus,
          date: formatDateTime(e.finishedAt || e.startedAt),
          durationMs: e.durationMs,
          energy: "N/A", // Se integrará con métricas de energía más adelante
          hardwareProfile: e.hardwareProfile,
        }));
        setExecutions(mapped);
        setHasLoadedExecutions(true);
      })
      .catch((err) => {
        console.error("Error cargando ejecuciones de admin user:", err);
        setExecutionsError(
          err.message ||
            "No se pudieron cargar las ejecuciones. Intenta nuevamente más tarde."
        );
      })
      .finally(() => {
        setExecutionsLoading(false);
      });
  };

  /**
   * Carga submissions de /api/admin/users/:id/submissions
   */
  const loadSubmissions = () => {
    if (!id) return;
    setSubmissionsLoading(true);
    setSubmissionsError(null);

    fetchJson(`/api/admin/users/${id}/submissions?page=1&page_size=100`)
      .then((data) => {
        const items = data.items || [];
        const mapped = items.map((s) => ({
          id: s.id,
          title: s.title,
          problem: s.problem || s.title || "—",
          status: s.status,
          date: formatDateTime(s.createdAt),
          okExecutions: s.okExecutions || 0,
          timeoutExecutions: s.timeoutExecutions || 0,
          errorExecutions: s.errorExecutions || 0,
        }));
        setSubmissions(mapped);
        setHasLoadedSubmissions(true);
      })
      .catch((err) => {
        console.error("Error cargando submissions de admin user:", err);
        setSubmissionsError(
          err.message ||
            "No se pudieron cargar los submissions. Intenta nuevamente más tarde."
        );
      })
      .finally(() => {
        setSubmissionsLoading(false);
      });
  };

  /**
   * Carga historial (audit_log) de /api/admin/users/:id/audit-log
   */
  const loadAuditLog = () => {
    if (!id) return;
    setAuditLogLoading(true);
    setAuditLogError(null);

    fetchJson(`/api/admin/users/${id}/audit-log?page=1&page_size=100`)
      .then((data) => {
        const items = data.items || [];
        const mapped = items.map((item) => ({
          id: item.id,
          action: item.action,
          description: item.description,
          createdAt: formatDateTime(item.createdAt),
        }));
        setAuditLog(mapped);
        setHasLoadedAuditLog(true);
      })
      .catch((err) => {
        console.error("Error cargando audit_log de admin user:", err);
        setAuditLogError(
          err.message ||
            "No se pudo cargar el historial de acciones. Intenta nuevamente más tarde."
        );
      })
      .finally(() => {
        setAuditLogLoading(false);
      });
  };

  /**
   * Efecto: cuando cambia la tab activa, se carga el dataset correspondiente,
   * pero sólo la primera vez que entras a cada tab (usando flags hasLoaded*).
   */
  useEffect(() => {
    if (!id) return;

    if (activeTab === "executions" && !hasLoadedExecutions) {
      loadExecutions();
    } else if (activeTab === "submissions" && !hasLoadedSubmissions) {
      loadSubmissions();
    } else if (activeTab === "history" && !hasLoadedAuditLog) {
      loadAuditLog();
    }
  }, [
    activeTab,
    id,
    hasLoadedExecutions,
    hasLoadedSubmissions,
    hasLoadedAuditLog,
  ]);

  /**
   * Filtros de ejecuciones (status + texto problema/submission)
   */
  const filteredExecutions = useMemo(() => {
    let data = [...executions];

    if (statusFilter !== "all") {
      data = data.filter((e) => e.status === statusFilter);
    }

    if (problemFilter.trim() !== "") {
      const q = problemFilter.toLowerCase();
      data = data.filter((e) => e.problem.toLowerCase().includes(q));
    }

    return data;
  }, [executions, statusFilter, problemFilter]);

  const handleClearFilters = () => {
    setStatusFilter("all");
    setProblemFilter("");
  };

  const handleOpenExecutionModal = (execution) => {
    setSelectedExecution(execution);
    setShowExecutionModal(true);
  };

  const handleCloseExecutionModal = () => {
    setShowExecutionModal(false);
    setSelectedExecution(null);
  };

  const executionStats = useMemo(() => {
    if (!userSummary) {
      return { total: 0, approved: 0, rejected: 0, errors: 0 };
    }
    return {
      total: userSummary.totalExecutions || 0,
      approved: userSummary.okExecutions || 0,
      rejected: userSummary.timeoutExecutions || 0,
      errors: userSummary.errorExecutions || 0,
    };
  }, [userSummary]);

  // Caso "fatal": no hay perfil y ya terminó la carga → mostramos error grande
  if (!userProfile && !profileLoading && profileError) {
    return (
      <div className="app-page admin-page admin-user-detail-page container-fluid py-4">
        <div className="row justify-content-center">
          <div className="col-12 col-xxl-8">
            <button
              type="button"
              className="btn btn-link p-0 mb-2 small text-decoration-none"
              onClick={() => navigate(-1)}
            >
              ← Volver a administración de usuarios
            </button>

            <h2 className="app-title mb-2">Detalle de usuario</h2>
            <div className="alert alert-danger app-alert-sm">
              {profileError}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const lastActivity =
    userProfile?.lastExecutionAt || userProfile?.lastLogin || "—";

  return (
    <div className="app-page admin-page admin-user-detail-page container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-xxl-10">
          {/* Header */}
          <div className="d-flex flex-wrap justify-content-between align-items-start mb-3 gap-2">
            <div>
              <button
                type="button"
                className="btn btn-link p-0 mb-2 small text-decoration-none"
                onClick={() => navigate(-1)}
              >
                ← Volver a administración de usuarios
              </button>
              <h2 className="app-title mb-1">Detalle de usuario</h2>
              <p className="text-muted mb-0 admin-user-detail-subtitle">
                Información consolidada del usuario y sus ejecuciones,
                submissions e historial.
              </p>
            </div>

            <div className="text-end admin-user-detail-meta">
              {userProfile && (
                <>
                  <span
                    className={`app-status-badge ${getUserStatusClass(
                      userProfile.status
                    )} mb-1`}
                  >
                    {userProfile.status}
                  </span>
                  <div className="small text-muted">
                    Última actividad: {lastActivity}
                  </div>
                </>
              )}

              {profileLoading && (
                <div className="small text-muted">
                  Cargando perfil de usuario...
                </div>
              )}
            </div>
          </div>

          {/* Si aún está cargando perfil, mostramos esqueletos simples */}
          {profileLoading && !userProfile && (
            <div className="row g-3">
              <div className="col-lg-4">
                <div className="card app-card admin-card skeleton-card" />
              </div>
              <div className="col-lg-8">
                <div className="card app-card admin-card skeleton-card" />
              </div>
            </div>
          )}

          {/* Contenido principal cuando ya hay perfil */}
          {userProfile && userSummary && (
            <div className="row g-3">
              {/* Columna izquierda: perfil */}
              <div className="col-lg-4">
                <UserProfileCard
                  profile={userProfile}
                  summary={userSummary}
                />
              </div>

              {/* Columna derecha: tabs */}
              <div className="col-lg-8">
                <div className="card app-card admin-card h-100 d-flex flex-column">
                  <div className="card-body d-flex flex-column">
                    {/* Tabs */}
                    <UserDetailTabs
                      activeTab={activeTab}
                      onChangeTab={setActiveTab}
                    />

                    {/* Contenido de tabs (3 panes siempre montados) */}
                    <div className="tab-content flex-grow-1 mt-3">
                      <div
                        className={`tab-pane h-100 ${
                          activeTab === "executions" ? "active" : "d-none"
                        }`}
                      >
                        <ExecutionsTab
                          executions={filteredExecutions}
                          totalExecutions={
                            userSummary.totalExecutions || executions.length
                          }
                          stats={executionStats}
                          statusFilter={statusFilter}
                          setStatusFilter={setStatusFilter}
                          problemFilter={problemFilter}
                          setProblemFilter={setProblemFilter}
                          onClearFilters={handleClearFilters}
                          onOpenExecutionModal={handleOpenExecutionModal}
                          isLoading={executionsLoading}
                          error={executionsError}
                        />
                      </div>

                      <div
                        className={`tab-pane h-100 ${
                          activeTab === "submissions" ? "active" : "d-none"
                        }`}
                      >
                        <SubmissionsTab
                          submissions={submissions}
                          isLoading={submissionsLoading}
                          error={submissionsError}
                        />
                      </div>

                      <div
                        className={`tab-pane h-100 ${
                          activeTab === "history" ? "active" : "d-none"
                        }`}
                      >
                        <AuditLogTab
                          auditLog={auditLog}
                          isLoading={auditLogLoading}
                          error={auditLogError}
                        />
                      </div>
                    </div>

                    {/* Footer acciones inferiores */}
                    <div className="mt-3 d-flex justify-content-between align-items-center">
                      <span className="small text-muted">
                        Vista conectada a la API de administración de usuarios.
                      </span>
                      <Link
                        to="/admin/users"
                        className="btn btn-outline-secondary btn-sm"
                      >
                        Volver al listado de usuarios
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
              {/* fin col derecha */}
            </div>
          )}
        </div>
      </div>

      {/* Modal de detalle de ejecución */}
      <ExecutionDetailModal
        show={showExecutionModal}
        execution={selectedExecution}
        onClose={handleCloseExecutionModal}
      />
    </div>
  );
};

export default AdminUserDetail;
