import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import "./AdminLayout.css";

const AdminLayout = () => (
  <div className="admin-shell">
    <nav className="admin-shell-nav" aria-label="Secciones de administración">
      <NavLink to="/admin/users">Usuarios</NavLink>
      <NavLink to="/admin/access-requests">Solicitudes</NavLink>
      <NavLink to="/admin/audit-log">Auditoría</NavLink>
    </nav>
    <Outlet />
  </div>
);

export default AdminLayout;
