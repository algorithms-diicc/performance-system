import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./AdminUser.css";
// ❌ Ya no usamos mockUsers
// import mockUsers from "../common/mockUsers";

const AdminUser = () => {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [sortBy, setSortBy] = useState("lastActivity");

  const [showFilters, setShowFilters] = useState(true);

  // Datos reales desde el backend
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    blocked: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ===========================
  // Helpers de UI / mapeos
  // ===========================
  const getRoleLabel = (role) => {
    // Backend: "Student" / "Teacher" / "Admin"
    // UI: "Estudiante" / "Docente" / "Administrador"
    switch (role) {
      case "Student":
        return "Estudiante";
      case "Teacher":
        return "Docente";
      case "Admin":
        return "Administrador";
      default:
        return role || "Estudiante";
    }
  };

  const getStatusClass = (status) => {
    if (status === "Activo") return "app-status-badge--success";
    if (status === "Bloqueado") return "app-status-badge--error";
    return "app-status-badge--warning";
  };

  const getRolePillClass = (roleLabel) => {
    switch (roleLabel) {
      case "Administrador":
        return "app-role-pill--admin";
      case "Docente":
        return "app-role-pill--teacher";
      case "Estudiante":
      default:
        return "app-role-pill--student";
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setRole("all");
    setStatus("all");
    setSortBy("lastActivity");
  };

  // ===========================
  // Fetch a /api/admin/users
  // ===========================
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/admin/users", {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error(
            `Error HTTP ${res.status} al obtener usuarios desde el servidor`
          );
        }

        const data = await res.json();

        setUsers(Array.isArray(data.items) ? data.items : []);
        setSummary({
          total: data.summary?.total ?? 0,
          active: data.summary?.active ?? 0,
          inactive: data.summary?.inactive ?? 0,
          blocked: data.summary?.blocked ?? 0,
        });
      } catch (err) {
        console.error("[AdminUser] Error al cargar usuarios:", err);
        setError(
          "No se pudo cargar la información de usuarios. Intenta nuevamente en unos minutos. " +
            "Si el problema persiste, contacta al soporte de Performance System."
        );
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // ===========================
  // Filtros y orden en memoria
  // ===========================
  const filteredUsers = useMemo(() => {
    // Enriquecemos los usuarios con roleLabel (para no recalcular en el render)
    let data = users.map((u) => ({
      ...u,
      roleLabel: getRoleLabel(u.role),
    }));

    if (search.trim() !== "") {
      const q = search.toLowerCase();
      data = data.filter(
        (u) =>
          (u.name && u.name.toLowerCase().includes(q)) ||
          (u.email && u.email.toLowerCase().includes(q))
      );
    }

    if (role !== "all") {
      data = data.filter((u) => u.roleLabel === role);
    }

    if (status !== "all") {
      data = data.filter((u) => u.status === status);
    }

    // Orden
    data.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return (a.name || "").localeCompare(b.name || "");
        case "createdAt": {
          const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return da - db;
        }
        case "lastActivity":
        default: {
          const da = a.lastExecutionAt
            ? new Date(a.lastExecutionAt).getTime()
            : 0;
          const db = b.lastExecutionAt
            ? new Date(b.lastExecutionAt).getTime()
            : 0;
          // Queremos la última actividad primero (desc)
          return db - da;
        }
      }
    });

    return data;
  }, [users, search, role, status, sortBy]);

  const totalUsers = summary.total;
  const activeUsers = summary.active;
  const blockedUsers = summary.blocked;

  // ===========================
  // Render
  // ===========================
  return (
    <div className="app-page admin-page container-fluid py-4">
      <div className="row justify-content-center">
        <div className="col-12 col-xxl-10">
          {/* Header */}
          <div className="d-flex flex-wrap justify-content-between align-items-start mb-3 gap-2">
            <div>
              <h2 className="app-title mb-1">Administración de usuarios</h2>
              <p className="admin-subtitle mb-0">
                Vista general de cuentas, actividad y estado dentro del sistema.
              </p>
            </div>

            <div className="d-flex flex-wrap gap-2 align-items-center justify-content-end">
              {/* Botón mostrar/ocultar filtros */}
              <button
                type="button"
                className="btn btn-sm admin-filters-toggle-btn"
                onClick={() => setShowFilters((prev) => !prev)}
              >
                <span className="admin-filters-toggle-icon">⚙️</span>
                <span className="d-none d-sm-inline">
                  {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
                </span>
                <span className="d-inline d-sm-none">
                  {showFilters ? "Ocultar" : "Filtros"}
                </span>
              </button>

              {/* Badges resumen */}
              <div className="badge-summary">
                <span className="summary-label">Total usuarios</span>
                <span className="summary-value">{totalUsers}</span>
              </div>
              <div className="badge-summary badge-summary-success">
                <span className="summary-label">Activos</span>
                <span className="summary-value">{activeUsers}</span>
              </div>
              <div className="badge-summary badge-summary-warning">
                <span className="summary-label">Bloqueados</span>
                <span className="summary-value">{blockedUsers}</span>
              </div>
            </div>
          </div>

          {/* Alerta de error (si el backend falló) */}
          {error && (
            <div className="alert alert-danger admin-error-alert mb-3">
              {error}
            </div>
          )}

          {/* Filtros (colapsables) */}
          {showFilters && (
            <div className="card app-card admin-card mb-3 admin-filters-card">
              <div className="card-body">
                <div className="row g-3 align-items-end">
                  <div className="col-12 col-md-5 col-lg-4">
                    <label className="form-label app-label-sm mb-1">
                      Buscar por nombre o correo
                    </label>
                    <div className="admin-input-with-icon">
                      <span className="admin-input-icon">🔍</span>
                      <input
                        type="text"
                        className="form-control form-control-sm admin-input"
                        placeholder="Ej: ana.martinez@inf.udec.cl"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>

                  <div className="col-6 col-md-3 col-lg-2">
                    <label className="form-label app-label-sm mb-1">
                      Rol
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      disabled={loading}
                    >
                      <option value="all">Todos</option>
                      <option value="Estudiante">Estudiante</option>
                      <option value="Docente">Docente</option>
                      <option value="Administrador">Administrador</option>
                    </select>
                  </div>

                  <div className="col-6 col-md-3 col-lg-2">
                    <label className="form-label app-label-sm mb-1">
                      Estado
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      disabled={loading}
                    >
                      <option value="all">Todos</option>
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                      <option value="Bloqueado">Bloqueado</option>
                    </select>
                  </div>

                  <div className="col-6 col-md-3 col-lg-2">
                    <label className="form-label app-label-sm mb-1">
                      Ordenar por
                    </label>
                    <select
                      className="form-select form-select-sm"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      disabled={loading}
                    >
                      <option value="lastActivity">Última actividad</option>
                      <option value="name">Nombre</option>
                      <option value="createdAt">Fecha creación</option>
                    </select>
                  </div>

                  <div className="col-6 col-md-3 col-lg-2 text-md-end">
                    <button
                      type="button"
                      className="btn btn-sm admin-btn-clear-filters"
                      onClick={handleClearFilters}
                      disabled={loading}
                    >
                      <span className="admin-clear-icon">🧹</span>
                      <span className="d-none d-sm-inline">
                        Limpiar filtros
                      </span>
                      <span className="d-inline d-sm-none">Limpiar</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabla de usuarios */}
          <div className="card app-card admin-card">
            <div className="card-body p-0">
              <div className="table-responsive app-table-wrapper admin-table-wrapper">
                <table className="table align-middle app-table admin-table mb-0">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th className="text-center">Rol</th>
                      <th className="text-center">Estado</th>
                      <th className="text-center">Submissions</th>
                      <th className="text-center">Última ejecución</th>
                      <th className="text-end">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Estado cargando */}
                    {loading && (
                      <tr>
                        <td colSpan="7" className="text-center py-4">
                          <span className="admin-meta">
                            Cargando información de usuarios...
                          </span>
                        </td>
                      </tr>
                    )}

                    {/* Error pero sin datos */}
                    {!loading && error && filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan="7" className="text-center py-4">
                          <span className="admin-meta">
                            No se pudieron cargar los usuarios. Intenta
                            nuevamente más tarde.
                          </span>
                        </td>
                      </tr>
                    )}

                    {/* Datos normales */}
                    {!loading &&
                      !error &&
                      filteredUsers.map((user) => (
                        <tr key={user.id}>
                          <td>
                            <div className="d-flex flex-column">
                              <span className="fw-semibold admin-text-main">
                                {user.name}
                              </span>
                              <span className="admin-meta small">
                                Creado: {user.createdAt}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className="small admin-text-main">
                              {user.email}
                            </span>
                          </td>
                          <td className="text-center">
                            <span
                              className={`app-role-pill ${getRolePillClass(
                                user.roleLabel
                              )}`}
                            >
                              {user.roleLabel}
                            </span>
                          </td>
                          <td className="text-center">
                            <span
                              className={`app-status-badge ${getStatusClass(
                                user.status
                              )}`}
                            >
                              {user.status}
                            </span>
                          </td>
                          <td className="text-center">
                            <div className="small">
                              <span className="fw-semibold admin-text-main">
                                {user.submissionsCount}
                              </span>
                              <span className="admin-meta">
                                {" "}
                                ({user.passedCount} ok / {user.failedCount} err)
                              </span>
                            </div>
                          </td>
                          <td className="text-center">
                            <div className="d-flex flex-column small">
                              <span className="admin-text-main">
                                {user.lastExecutionStatus}
                              </span>
                              <span className="admin-meta">
                                {user.lastExecutionAt}
                              </span>
                            </div>
                          </td>
                          <td className="text-end">
                            <div className="btn-group btn-group-sm">
                              <Link
                                to={`/admin/users/${user.id}`}
                                className="btn btn-light btn-sm admin-btn-light"
                              >
                                Ver detalle
                              </Link>
                              <button
                                className="btn btn-outline-secondary btn-sm admin-btn-outline"
                                type="button"
                                onClick={() =>
                                  console.log(
                                    "Re-ejecutar (mock) usuario",
                                    user.id
                                  )
                                }
                              >
                                Re-ejecutar (mock)
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                    {/* Sin resultados con filtros */}
                    {!loading &&
                      !error &&
                      filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan="7" className="text-center py-4">
                            <span className="admin-meta">
                              No se encontraron usuarios con los filtros
                              seleccionados.
                            </span>
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              </div>

              {/* Footer tabla */}
              <div className="admin-table-footer small px-3 py-2">
                Mostrando {filteredUsers.length} de {totalUsers} usuarios.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUser;
