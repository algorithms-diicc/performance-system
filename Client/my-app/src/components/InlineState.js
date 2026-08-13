import React from "react";
import {
  AlertCircle,
  Ban,
  FileQuestion,
  Inbox,
  Loader2,
  RefreshCw,
  WifiOff,
} from "lucide-react";

import "./InlineState.css";

const CONFIG = {
  loading: {
    icon: Loader2,
    tone: "primary",
    defaultTitle: "Cargando información",
  },
  empty: {
    icon: Inbox,
    tone: "neutral",
    defaultTitle: "No hay información para mostrar",
  },
  unavailable: {
    icon: AlertCircle,
    tone: "neutral",
    defaultTitle: "Contenido no disponible",
  },
  "not-found": {
    icon: FileQuestion,
    tone: "warning",
    defaultTitle: "Recurso no encontrado",
  },
  forbidden: {
    icon: Ban,
    tone: "warning",
    defaultTitle: "Acceso restringido",
  },
  network: {
    icon: WifiOff,
    tone: "danger",
    defaultTitle: "No pudimos conectar con el servidor",
  },
  error: {
    icon: AlertCircle,
    tone: "danger",
    defaultTitle: "Ocurrió un error",
  },
};

const InlineState = ({
  type = "empty",
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}) => {
  const config = CONFIG[type] || CONFIG.error;
  const Icon = config.icon;

  return (
    <div
      className={[
        "inline-state",
        `inline-state--${config.tone}`,
        compact ? "inline-state--compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role={type === "loading" ? "status" : undefined}
      aria-live={type === "loading" ? "polite" : undefined}
    >
      <div className="inline-state__icon">
        <Icon
          size={compact ? 19 : 23}
          strokeWidth={1.9}
          className={type === "loading" ? "inline-state__spin" : ""}
        />
      </div>

      <div className="inline-state__body">
        <strong>{title || config.defaultTitle}</strong>

        {description && <p>{description}</p>}

        {actionLabel && onAction && (
          <button
            type="button"
            className="inline-state__action"
            onClick={onAction}
          >
            <RefreshCw size={15} />
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default InlineState;
