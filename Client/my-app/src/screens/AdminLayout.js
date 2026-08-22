import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useI18n } from "../i18n";
import "./AdminLayout.css";

const AdminLayout = () => {
  const { t } = useI18n();

  return (
    <div className="admin-shell">
      <nav
        className="admin-shell-nav"
        aria-label={t("adminLayout.navAria")}
      >
        <NavLink to="/admin/users">
          {t("adminLayout.users")}
        </NavLink>
        <NavLink to="/admin/access-requests">
          {t("adminLayout.accessRequests")}
        </NavLink>
        <NavLink to="/admin/audit-log">
          {t("adminLayout.auditLog")}
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
};

export default AdminLayout;
