import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { NavLink, Outlet } from "react-router-dom";
import { requestJson } from "../common/requestErrorModel";
import { useI18n } from "../i18n";
import { AdminPendingRequestsContext } from "./adminPendingRequestsContext";
import "./AdminLayout.css";

const AdminLayout = () => {
  const { t } = useI18n();
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async (signal) => {
    try {
      const data = await requestJson(
        "/api/admin/access-requests?status=PENDING&page=1&page_size=1",
        {
          credentials: "include",
          signal,
        },
        {
          fallback:
            "No fue posible cargar las solicitudes pendientes.",
        }
      );
      const numericPending = Number(data?.summary?.pending);

      setPendingCount(
        Number.isFinite(numericPending) && numericPending > 0
          ? Math.floor(numericPending)
          : 0
      );
    } catch (error) {
      if (error?.name !== "AbortError") {
        // The navigation remains usable when this non-blocking count fails.
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    refreshPendingCount(controller.signal);

    return () => controller.abort();
  }, [refreshPendingCount]);

  const pendingContext = useMemo(
    () => ({
      pendingCount,
      setPendingCount,
      refreshPendingCount,
    }),
    [pendingCount, refreshPendingCount]
  );

  const pendingLabel = pendingCount === 1
    ? t("adminLayout.pending.one", { count: pendingCount })
    : t("adminLayout.pending.other", { count: pendingCount });

  return (
    <AdminPendingRequestsContext.Provider value={pendingContext}>
      <div className="admin-shell">
        <nav
          className="admin-shell-nav"
          aria-label={t("adminLayout.navAria")}
        >
          <NavLink to="/admin/users">
            {t("adminLayout.users")}
          </NavLink>
          <NavLink to="/admin/access-requests">
            <span>{t("adminLayout.accessRequests")}</span>
            {pendingCount > 0 && (
              <span
                className="admin-shell-nav__badge"
                aria-label={pendingLabel}
              >
                {pendingCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/admin/audit-log">
            {t("adminLayout.auditLog")}
          </NavLink>
          <NavLink to="/admin/system-status">
            {t("adminLayout.systemStatus")}
          </NavLink>
        </nav>
        <Outlet />
      </div>
    </AdminPendingRequestsContext.Provider>
  );
};

export default AdminLayout;
