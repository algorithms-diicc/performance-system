import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ClipboardList,
  MessageSquareText,
} from "lucide-react";

import { serverURL } from "./Constants";
import { useI18n } from "../i18n";

import "./NotificationsMenu.css";


const MAX_VISIBLE_UNREAD = 99;


const notificationIcon = (kind) => {
  if (kind === "TEACHER_FEEDBACK") {
    return MessageSquareText;
  }
  if (kind === "PROTOCOL_PUBLISHED") {
    return ClipboardList;
  }
  return AlertTriangle;
};


const notificationTarget = (item) => {
  const submissionId = item?.submission?.id;
  if (submissionId) {
    return `/submissions/${encodeURIComponent(submissionId)}`;
  }

  if (
    item?.kind === "PROTOCOL_PUBLISHED" &&
    item?.protocol?.id
  ) {
    return "/protocols";
  }

  return "";
};


const notificationCopy = (item, t) => {
  const kind = String(item?.kind || "").toUpperCase();

  if (kind === "EXECUTION_FAILED") {
    return {
      title: t("notifications.kinds.executionFailed.title"),
      description: t(
        "notifications.kinds.executionFailed.description",
        {
          experiment:
            item?.submission?.title ||
            t("notifications.fallbacks.experiment"),
          code:
            item?.execution?.errorCode ||
            t("notifications.fallbacks.error"),
        }
      ),
    };
  }

  if (kind === "TEACHER_FEEDBACK") {
    return {
      title: t("notifications.kinds.teacherFeedback.title"),
      description: t(
        "notifications.kinds.teacherFeedback.description",
        {
          actor:
            item?.actor?.fullName ||
            t("notifications.fallbacks.teacher"),
          experiment:
            item?.submission?.title ||
            t("notifications.fallbacks.experiment"),
        }
      ),
    };
  }

  if (kind === "PROTOCOL_PUBLISHED") {
    return {
      title: t("notifications.kinds.protocolPublished.title"),
      description: t(
        "notifications.kinds.protocolPublished.description",
        {
          protocol:
            item?.protocol?.title ||
            t("notifications.fallbacks.protocol"),
          course:
            item?.protocol?.course?.code ||
            item?.protocol?.course?.name ||
            t("notifications.fallbacks.course"),
        }
      ),
    };
  }

  return {
    title: t("notifications.kinds.generic.title"),
    description: t("notifications.kinds.generic.description"),
  };
};


const NotificationsMenu = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const rootRef = useRef(null);
  const mountedRef = useRef(true);

  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [state, setState] = useState("idle");

  const requestJson = useCallback(async (path, options = {}) => {
    if (typeof fetch !== "function") {
      return null;
    }

    const response = await fetch(
      `${serverURL}${path}`,
      {
        credentials: "include",
        ...options,
      }
    );

    if (!response.ok) {
      const error = new Error(
        `Notifications request failed with ${response.status}`
      );
      error.status = response.status;
      throw error;
    }

    return response.json();
  }, []);

  const loadNotifications = useCallback(async () => {
    if (typeof fetch !== "function") {
      return;
    }

    setState("loading");

    try {
      const payload = await requestJson(
        "api/notifications?page_size=25"
      );

      if (!mountedRef.current) {
        return;
      }

      setItems(
        Array.isArray(payload?.items)
          ? payload.items
          : []
      );
      setUnreadCount(
        Number(payload?.unreadCount || 0)
      );
      setState("ready");
    } catch {
      if (!mountedRef.current) {
        return;
      }
      setState("error");
    }
  }, [requestJson]);

  useEffect(() => {
    mountedRef.current = true;
    loadNotifications();

    return () => {
      mountedRef.current = false;
    };
  }, [loadNotifications]);

  useEffect(() => {
    const handleMouseDown = (event) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleMouseDown
      );
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, []);

  const badge = useMemo(() => {
    if (unreadCount <= 0) return "";
    return unreadCount > MAX_VISIBLE_UNREAD
      ? `${MAX_VISIBLE_UNREAD}+`
      : String(unreadCount);
  }, [unreadCount]);

  const markRead = async (item) => {
    if (!item?.id || item?.isRead) {
      return;
    }

    try {
      await requestJson(
        `api/notifications/${encodeURIComponent(item.id)}/read`,
        { method: "POST" }
      );

      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id
            ? { ...candidate, isRead: true }
            : candidate
        )
      );
      setUnreadCount((current) =>
        Math.max(0, current - 1)
      );
    } catch {
      // Abrir el destino sigue siendo útil aunque no se pueda persistir
      // el estado de lectura.
    }
  };

  const handleOpenItem = async (item) => {
    await markRead(item);

    const target = notificationTarget(item);
    setIsOpen(false);

    if (target) {
      navigate(target);
    }
  };

  const handleReadAll = async () => {
    if (unreadCount <= 0) {
      return;
    }

    try {
      await requestJson(
        "api/notifications/read-all",
        { method: "POST" }
      );

      setItems((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
        }))
      );
      setUnreadCount(0);
    } catch {
      setState("error");
    }
  };

  return (
    <div
      ref={rootRef}
      className="notifications-menu"
    >
      <button
        type="button"
        className="app-navbar-icon-button notifications-menu__trigger"
        aria-label={t("notifications.open")}
        title={t("notifications.open")}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((current) => !current)}
      >
        <Bell
          size={19}
          strokeWidth={1.9}
          aria-hidden="true"
        />
        {badge && (
          <span
            className="notifications-menu__badge"
            aria-label={t(
              "notifications.unreadCount",
              { count: unreadCount }
            )}
          >
            {badge}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          className="notifications-menu__panel"
          aria-label={t("notifications.title")}
        >
          <header className="notifications-menu__header">
            <div>
              <span className="notifications-menu__eyebrow">
                {t("notifications.eyebrow")}
              </span>
              <h2>{t("notifications.title")}</h2>
            </div>

            <button
              type="button"
              className="notifications-menu__read-all"
              onClick={handleReadAll}
              disabled={unreadCount <= 0}
            >
              <CheckCheck
                size={16}
                strokeWidth={1.9}
                aria-hidden="true"
              />
              {t("notifications.readAll")}
            </button>
          </header>

          <div className="notifications-menu__content">
            {state === "loading" && (
              <p className="notifications-menu__state">
                {t("notifications.loading")}
              </p>
            )}

            {state === "error" && (
              <div
                className="notifications-menu__state notifications-menu__state--error"
                role="alert"
              >
                <span>
                  {t("notifications.error")}
                </span>
                <button
                  type="button"
                  onClick={loadNotifications}
                >
                  {t("notifications.retry")}
                </button>
              </div>
            )}

            {state !== "loading" &&
              state !== "error" &&
              items.length === 0 && (
                <p className="notifications-menu__state">
                  {t("notifications.empty")}
                </p>
              )}

            {state !== "loading" &&
              items.map((item) => {
                const Icon = notificationIcon(
                  item.kind
                );
                const copy = notificationCopy(
                  item,
                  t
                );

                return (
                  <button
                    type="button"
                    key={item.id}
                    className={[
                      "notifications-menu__item",
                      item.isRead
                        ? "notifications-menu__item--read"
                        : "notifications-menu__item--unread",
                    ].join(" ")}
                    onClick={() =>
                      handleOpenItem(item)
                    }
                  >
                    <span className="notifications-menu__item-icon">
                      <Icon
                        size={18}
                        strokeWidth={1.9}
                        aria-hidden="true"
                      />
                    </span>

                    <span className="notifications-menu__item-copy">
                      <strong>{copy.title}</strong>
                      <span>{copy.description}</span>
                      {item.kind === "TEACHER_FEEDBACK" &&
                        item?.feedback?.preview && (
                          <small>
                            {item.feedback.preview}
                          </small>
                        )}
                    </span>

                    {!item.isRead && (
                      <span
                        className="notifications-menu__dot"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
          </div>
        </section>
      )}
    </div>
  );
};


export default NotificationsMenu;
