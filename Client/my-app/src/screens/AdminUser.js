import InlineState from "../components/InlineState";
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./AdminUser.css";
import {
  executionStateBadgeClass,
  executionStateLabel,
} from "./adminExecutionStateModel";

const ROLE_LABELS = {
  Student: "Estudiante",
  Teacher: "Profesor",
  Admin: "Administrador",
};

const PAGE_SIZES = [15, 25, 50];

const dateTimeFormatter = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "medium",
  timeStyle: "short",
});

function formatDateTime(value) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";

  return dateTimeFormatter.format(parsed);
}

function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || "Sin rol";
}

function getRoleClass(role) {
  if (role === "Admin") return "admin-user-role--admin";
  if (role === "Teacher") return "admin-user-role--teacher";
  return "admin-user-role--student";
}

function getUserStatusClass(status) {
  return status === "Activo"
    ? "app-status-badge--success"
    : "app-status-badge--warning";
}

function activeExecutionCount(user) {
  return (
    (user.queuedExecutions || 0) +
    (user.runningExecutions || 0) +
    (user.processingExecutions || 0)
  );
}

function userInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const AdminUser = () => {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("lastActivity");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    inactive: 0,
  });
  const [filteredTotal, setFilteredTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  const hasFilters =
    search.trim() !== "" || role !== "all" || status !== "all";

  useEffect(() => {
    setPage(1);
  }, [search, role, status, sortBy, pageSize]);

  useEffect(() => {
    const controller = new AbortController();

    const timer = window.setTimeout(
      async () => {
        try {
          setLoading(true);
          setError(null);

          const params = new URLSearchParams({
            page: String(page),
            page_size: String(pageSize),
            sort_by: sortBy,
            sort_dir: sortBy === "name" ? "asc" : "desc",
          });

          const trimmedSearch = search.trim();

          if (trimmedSearch) {
            params.set("search", trimmedSearch);
          }

          if (role !== "all") {
            params.set("role", role);
          }

          if (status !== "all") {
            params.set("status", status);
          }

          const response = await fetch(
            `/api/admin/users?${params.toString()}`,
            {
              credentials: "include",
              signal: controller.signal,
            }
          );

          if (!response.ok) {
            throw new Error(
              `Error HTTP ${response.status} al obtener usuarios`
            );
          }

          const data = await response.json();
          const items = Array.isArray(data.items) ? data.items : [];

          setUsers(items);
          setSummary({
            total: data.summary?.total ?? 0,
            active: data.summary?.active ?? 0,
            inactive: data.summary?.inactive ?? 0,
          });
          setFilteredTotal(
            data.total ??
              data.filteredTotal ??
              data.summary?.total ??
              items.length
          );
        } catch (err) {
          if (err.name === "AbortError") {
            return;
          }

          console.error("[AdminUser] Error al cargar usuarios:", err);
          setUsers([]);
          setFilteredTotal(0);
          setError(
            "No se pudo cargar la información de usuarios. " +
              "Puedes reintentar sin abandonar esta pantalla."
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
    search,
    role,
    status,
    sortBy,
    page,
    pageSize,
    reloadToken,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredTotal / pageSize)
  );

  const visibleRange = useMemo(() => {
    if (filteredTotal === 0) {
      return { first: 0, last: 0 };
    }

    return {
      first: (page - 1) * pageSize + 1,
      last: Math.min(page * pageSize, filteredTotal),
    };
  }, [filteredTotal, page, pageSize]);

  const handleClearFilters = () => {
    setSearch("");
    setRole("all");
    setStatus("all");
    setSortBy("lastActivity");
    setPage(1);
  };

  const handleRetry = () => {
    setReloadToken((value) => value + 1);
  };

  const goToPreviousPage = () => {
    setPage((current) => Math.max(1, current - 1));
  };

  const goToNextPage = () => {
    setPage((current) => Math.min(totalPages, current + 1));
  };

  return (
    <div className="app-page admin-page container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-xxl-11">
          <header className="admin-users-header">
            <div>
              <p className="admin-users-eyebrow mb-1">
                Administración
              </p>
              <h1 className="app-title admin-users-title mb-1">
                Usuarios
              </h1>
              <p className="admin-subtitle mb-0">
                Gestiona cuentas y revisa su actividad reciente en
                Performance System.
              </p>
            </div>
          </header>

          <section
            className="admin-summary-grid"
            aria-label="Resumen de usuarios"
          >
            <article className="admin-summary-card">
              <span className="admin-summary-label">Total</span>
              <strong>{summary.total}</strong>
              <span className="admin-summary-caption">
                usuarios registrados
              </span>
            </article>

            <article className="admin-summary-card">
              <span className="admin-summary-label">Activos</span>
              <strong>{summary.active}</strong>
              <span className="admin-summary-caption">
                con acceso habilitado
              </span>
            </article>

            <article className="admin-summary-card">
              <span className="admin-summary-label">Inactivos</span>
              <strong>{summary.inactive}</strong>
              <span className="admin-summary-caption">
                sin acceso habilitado
              </span>
            </article>

            <article className="admin-summary-card">
              <span className="admin-summary-label">
                {hasFilters ? "Resultados" : "Visibles"}
              </span>
              <strong>{filteredTotal}</strong>
              <span className="admin-summary-caption">
                {hasFilters
                  ? "coinciden con los filtros"
                  : "usuarios disponibles"}
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
                  Buscar
                </label>
                <input
                  id="admin-user-search"
                  type="search"
                  className="form-control"
                  placeholder="Nombre o correo institucional"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div>
                <label
                  className="form-label app-label-sm"
                  htmlFor="admin-role-filter"
                >
                  Rol
                </label>
                <select
                  id="admin-role-filter"
                  className="form-select"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="Student">Estudiante</option>
                  <option value="Teacher">Docente</option>
                  <option value="Admin">Administrador</option>
                </select>
              </div>

              <div>
                <label
                  className="form-label app-label-sm"
                  htmlFor="admin-status-filter"
                >
                  Estado
                </label>
                <select
                  id="admin-status-filter"
                  className="form-select"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="all">Todos</option>
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>

              <div>
                <label
                  className="form-label app-label-sm"
                  htmlFor="admin-sort-filter"
                >
                  Orden
                </label>
                <select
                  id="admin-sort-filter"
                  className="form-select"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                >
                  <option value="lastActivity">
                    Actividad reciente
                  </option>
                  <option value="name">Nombre</option>
                  <option value="createdAt">
                    Fecha de creación
                  </option>
                </select>
              </div>

              <button
                type="button"
                className="btn admin-clear-button"
                onClick={handleClearFilters}
                disabled={!hasFilters && sortBy === "lastActivity"}
              >
                Limpiar
              </button>
            </div>
          </section>

          <section className="admin-users-card">
            <div className="table-responsive">
              <table className="table align-middle admin-users-table mb-0">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Rol</th>
                    <th>Cuenta</th>
                    <th>Actividad</th>
                    <th>Última ejecución</th>
                    <th className="text-end">Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {loading && users.length === 0 && (
                    <tr>
                      <td colSpan="6" className="py-4">
                        <InlineState
                          type="loading"
                          title="Cargando usuarios"
                          description="Consultando el listado administrativo."
                          compact
                        />
                      </td>
                    </tr>
                  )}

                  {!loading && error && (
                    <tr>
                      <td colSpan="6" className="py-4">
                        <InlineState
                          type="error"
                          title="No pudimos cargar los usuarios"
                          description={error}
                          actionLabel="Reintentar"
                          onAction={handleRetry}
                          compact
                        />
                      </td>
                    </tr>
                  )}

                  {!error &&
                    users.map((user) => {
                      const activeExecutions =
                        activeExecutionCount(user);

                      return (
                        <tr key={user.id}>
                          <td>
                            <div className="admin-user-identity">
                              <div
                                className="admin-user-avatar"
                                aria-hidden="true"
                              >
                                {userInitials(user.name)}
                              </div>

                              <div className="admin-user-identity-copy">
                                <Link
                                  to={`/admin/users/${user.id}`}
                                  className="admin-user-name"
                                >
                                  {user.name || "Usuario sin nombre"}
                                </Link>
                                <span>{user.email || "Sin correo"}</span>
                                <small>
                                  Creado {formatDateTime(user.createdAt)}
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
                              {getRoleLabel(user.role)}
                            </span>
                          </td>

                          <td>
                            <span
                              className={`app-status-badge ${getUserStatusClass(
                                user.status
                              )}`}
                            >
                              {user.status || "Desconocido"}
                            </span>
                          </td>

                          <td>
                            <div className="admin-activity-main">
                              <strong>
                                {user.submissionsCount || 0}
                              </strong>{" "}
                              {(user.submissionsCount || 0) === 1
                                ? "envío"
                                : "envíos"}
                              <span aria-hidden="true"> · </span>
                              <strong>
                                {user.executionsCount || 0}
                              </strong>{" "}
                              {(user.executionsCount || 0) === 1
                                ? "ejecución"
                                : "ejecuciones"}
                            </div>
                            <div className="admin-activity-meta">
                              {user.completedExecutions || 0}{" "}
                              {(user.completedExecutions || 0) === 1
                                ? "completada"
                                : "completadas"}
                              <span aria-hidden="true"> · </span>
                              {user.failedExecutions || 0}{" "}
                              {(user.failedExecutions || 0) === 1
                                ? "fallida"
                                : "fallidas"}
                              {activeExecutions > 0 && (
                                <>
                                  <span aria-hidden="true"> · </span>
                                  {activeExecutions}{" "}
                                  {activeExecutions === 1
                                    ? "activa"
                                    : "activas"}
                                </>
                              )}
                            </div>
                          </td>

                          <td>
                            {user.lastExecutionState ? (
                              <div className="admin-last-execution">
                                <span
                                  className={`app-status-badge ${executionStateBadgeClass(
                                    user.lastExecutionState
                                  )}`}
                                >
                                  {executionStateLabel(
                                    user.lastExecutionState
                                  )}
                                </span>
                                <small>
                                  {formatDateTime(
                                    user.lastExecutionAt
                                  )}
                                </small>
                              </div>
                            ) : (
                              <span className="admin-empty-value">
                                Sin ejecuciones
                              </span>
                            )}
                          </td>

                          <td className="text-end">
                            <Link
                              to={`/admin/users/${user.id}`}
                              className="btn btn-sm admin-detail-button"
                            >
                              Ver usuario
                            </Link>
                          </td>
                        </tr>
                      );
                    })}

                  {!loading &&
                    !error &&
                    users.length === 0 && (
                      <tr>
                        <td colSpan="6" className="py-4">
                          <InlineState
                            type="empty"
                            title="No hay usuarios para mostrar"
                            description={
                              hasFilters
                                ? "No hay coincidencias con los filtros actuales."
                                : "Todavía no hay usuarios registrados."
                            }
                            actionLabel={
                              hasFilters ? "Limpiar filtros" : undefined
                            }
                            onAction={
                              hasFilters ? handleClearFilters : undefined
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
                    ? "0 usuarios"
                    : `${visibleRange.first}–${visibleRange.last} de ${filteredTotal}`}
                </span>

                <label>
                  <span>Filas</span>
                  <select
                    className="form-select form-select-sm"
                    value={pageSize}
                    onChange={(event) =>
                      setPageSize(Number(event.target.value))
                    }
                    aria-label="Cantidad de usuarios por página"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="admin-pagination-controls">
                <button
                  type="button"
                  className="btn btn-sm admin-page-button"
                  onClick={goToPreviousPage}
                  disabled={page <= 1 || loading}
                >
                  Anterior
                </button>

                <span>
                  Página {Math.min(page, totalPages)} de {totalPages}
                </span>

                <button
                  type="button"
                  className="btn btn-sm admin-page-button"
                  onClick={goToNextPage}
                  disabled={
                    page >= totalPages ||
                    filteredTotal === 0 ||
                    loading
                  }
                >
                  Siguiente
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
