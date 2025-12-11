import React, { useEffect, useState } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "./Navbar.css";
import { Link, useLocation, useNavigate } from "react-router-dom";

function Navbar({ tasksState }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // ================================
  //  Tema (dark / light)
  // ================================
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return "dark";
    return localStorage.getItem("ps-theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ps-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // ================================
  //  Cargar info del usuario
  // ================================
  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
        });

        if (!res.ok) {
          setUser(null);
          return;
        }

        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Error al obtener /api/auth/me:", err);
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    };

    fetchMe();
  }, []);

  // ================================
  //  Ítems del menú central
  // ================================
  const navItems = [
    {
      path: "/",
      label: "Subir código",
      icon: "＋",
      variant: "primary", // acción principal
    },
    {
      path: "/tutorial",
      label: "¿Cómo funciona?",
      icon: "",
      variant: "secondary", // ayuda
    },
  ];

  const isActive = (itemPath) => {
    if (itemPath === "/") return location.pathname === "/";
    return location.pathname.startsWith(itemPath);
  };

  const toggleUserMenu = () => setIsUserMenuOpen((prev) => !prev);
  const closeUserMenu = () => setIsUserMenuOpen(false);

  const getInitials = (fullName, email) => {
    if (fullName && fullName.trim().length > 0) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length === 1) return parts[0][0].toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    if (email) return email[0].toUpperCase();
    return "?";
  };

  const isAdmin = user?.role_id === 2;

  // ================================
  //  Notificaciones (solicitudes acceso)
  // ================================
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  // TODO: conectar con /api/admin/access-requests/summary cuando exista.

  // ================================
  //  Logout
  // ================================
  const handleLogout = async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.warn("Error al cerrar sesión (ignorable por ahora):", err);
    } finally {
      // Limpieza visual: cerramos menú y vamos al login
      closeUserMenu();
      navigate("/login", { replace: true });
    }
  };

  // ================================
  //  Render
  // ================================
  const initials = getInitials(user?.full_name, user?.email);
  const displayName = user?.full_name || "Usuario invitado";
  const displayEmail = user?.email || "";

  return (
    <nav className="navbar navbar-expand-lg app-navbar shadow-sm">
      <div className="container-fluid app-navbar-inner">
        {/* Brand izquierda */}
        <Link
          to="/"
          className="navbar-brand d-flex align-items-center app-navbar-brand"
        >
          <img
            src="/iconSP.png"
            alt="Logo"
            width="34"
            height="34"
            className="d-inline-block align-top me-2 app-navbar-logo"
          />
          <span className="app-navbar-brand-text">Performance System</span>
        </Link>

        {/* Botón colapsable (mobile) */}
        <button
          className="navbar-toggler app-navbar-toggler"
          type="button"
          onClick={closeUserMenu}
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="collapse navbar-collapse app-navbar-collapse show">
          {/* Menú central */}
          <ul className="navbar-nav mx-auto align-items-center gap-2 app-navbar-menu">
            {navItems.map((item) => {
              const active = isActive(item.path);
              const extraClass =
                item.variant === "primary"
                  ? "app-nav-link-primary"
                  : "app-nav-link-secondary";

              return (
                <li
                  key={item.path}
                  className={`nav-item ${
                    active ? "app-nav-item-active" : ""
                  }`}
                >
                  <Link
                    to={item.path}
                    className={`nav-link app-nav-link ${extraClass}`}
                  >
                    {item.icon && (
                      <span
                        className="app-nav-link-icon"
                        aria-hidden="true"
                      >
                        {item.icon}
                      </span>
                    )}
                    <span className="app-nav-link-label">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Zona derecha: toggle tema + notificaciones + usuario */}
          <div className="d-flex align-items-center app-navbar-right">
            {/* Toggle tema */}
            <button
              type="button"
              className="app-theme-toggle-btn me-2"
              onClick={toggleTheme}
              aria-label="Cambiar tema"
            >
              {theme === "dark" ? "☾" : "☀"}
            </button>

            {/* Campana de notificaciones (solo admin, visual por ahora) */}
            {isAdmin && (
              <button
                type="button"
                className="app-navbar-notifications-btn me-2"
                onClick={() => {
                  // Más adelante se conectará a una vista o modal
                  // dedicado a solicitudes de acceso.
                  navigate("/admin/access-requests");
                }}
                aria-label="Solicitudes de acceso pendientes"
              >
                <span
                  className="app-navbar-notifications-icon"
                  aria-hidden="true"
                >
                  🔔
                </span>
                {typeof pendingRequestsCount === "number" &&
                  pendingRequestsCount > 0 && (
                    <span className="app-navbar-notifications-badge">
                      {pendingRequestsCount > 9
                        ? "9+"
                        : pendingRequestsCount}
                    </span>
                  )}
              </button>
            )}

            {/* Menú de usuario */}
            <div className="app-user-menu-wrapper">
              <button
                className="app-user-menu-toggle d-flex align-items-center"
                type="button"
                onClick={toggleUserMenu}
                disabled={loadingUser}
              >
                <div className="app-user-avatar d-flex align-items-center justify-content-center me-2">
                  {initials}
                </div>

                <div className="app-user-info d-none d-md-flex flex-column text-start me-1">
                  <span className="app-user-name">
                    {loadingUser ? "Cargando..." : displayName}
                  </span>
                  {displayEmail && (
                    <span className="app-user-email">{displayEmail}</span>
                  )}
                </div>

                <span
                  className={`app-user-menu-icon ${
                    isUserMenuOpen ? "rotate" : ""
                  }`}
                >
                  ▾
                </span>
              </button>

              {/* Dropdown */}
              <div
                className={`dropdown-menu dropdown-menu-end app-user-dropdown-menu ${
                  isUserMenuOpen ? "show" : ""
                }`}
              >
                {/* Resumen de sesión */}
                <div className="app-user-dropdown-header">
                  <div className="app-user-dropdown-avatar">{initials}</div>
                  <div className="app-user-dropdown-info">
                    <div className="app-user-dropdown-name">
                      {displayName}
                    </div>
                    {displayEmail && (
                      <div className="app-user-dropdown-email">
                        {displayEmail}
                      </div>
                    )}
                    <div className="app-user-dropdown-role">
                      {isAdmin ? "Administrador" : "Estudiante"}
                    </div>
                  </div>
                </div>

                <div className="dropdown-divider" />

                {/* Opciones según rol */}
                {isAdmin ? (
                  <>
                    <button
                      type="button"
                      className="dropdown-item app-user-dropdown-item"
                      onClick={() => {
                        closeUserMenu();
                        navigate("/admin/users");
                      }}
                    >
                      <span className="app-user-dropdown-icon">📊</span>
                      <span>Panel de administración</span>
                    </button>

                    <button
                      type="button"
                      className="dropdown-item app-user-dropdown-item app-user-dropdown-item-disabled"
                      disabled
                    >
                      <span className="app-user-dropdown-icon">🧪</span>
                      <span>Pruebas / ejecuciones</span>
                      <span className="app-user-badge-soon">
                        Próximamente
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="dropdown-item app-user-dropdown-item"
                      onClick={() => {
                        closeUserMenu();
                        navigate("/taskpage");
                      }}
                    >
                      <span className="app-user-dropdown-icon">🧪</span>
                      <span>Mis pruebas</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="dropdown-item app-user-dropdown-item"
                  onClick={() => {
                    closeUserMenu();
                    // Aquí podrías ir a una vista de perfil cuando exista
                    console.log("Ir a Mi perfil (pendiente)");
                  }}
                >
                  <span className="app-user-dropdown-icon">👤</span>
                  <span>Mi perfil</span>
                </button>

                <div className="dropdown-divider" />

                <button
                  type="button"
                  className="dropdown-item app-user-dropdown-item app-user-dropdown-item-logout"
                  onClick={handleLogout}
                >
                  <span className="app-user-dropdown-icon">⏻</span>
                  <span>Cerrar sesión</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
