// src/screens/RenderForm/components/StatusPanel.js
import React from "react";

function StatusPanel({ fileList, messages, statusChip, check, onGoToResults }) {
  const totalFiles = Array.isArray(fileList) ? fileList.length : 0;
  const hasExecutions = totalFiles > 0;
  const hasMessages = Array.isArray(messages) && messages.length > 0;

  return (
    <aside className="rf-status-panel">
      <header className="rf-status-header">
        <span className="rf-step-kicker">Paso 2</span>
        <h2 className="rf-status-title">Estado del código</h2>
        <p className="rf-status-description">
          Revisa cómo avanza la compilación y ejecución de cada archivo del test.
        </p>

        {statusChip && (
          <span className={statusChip.className}>{statusChip.label}</span>
        )}
      </header>

      <div className="rf-status-summary">
        {hasExecutions ? (
          <span className="rf-status-counter">
            {totalFiles} archivo{totalFiles !== 1 ? "s" : ""} en esta ejecución
          </span>
        ) : (
          <span className="rf-status-counter rf-status-counter-empty">
            Aún no has ejecutado ningún experimento.
          </span>
        )}
      </div>

      <div className="rf-status-messages">
        {hasMessages ? (
          messages.map((group) => (
            <div key={group.codename} className="status-group">
              <div className="status-group-header">
                <span className="status-group-filename">
                  {group.originalName || group.codename}
                </span>
              </div>
              <ul className="status-group-list">
                {group.messages.map((entry, idx) => {
                  const { level, icon } = classifyMessage(entry.msg || "");
                  return (
                    <li
                      key={entry.time || `${group.codename}-${idx}`}
                      className={`status-entry status-entry-${level}`}
                    >
                      <span className="status-entry-icon">{icon}</span>
                      <span className="status-entry-time">
                        [{entry.time || "--:--:--"}]
                      </span>
                      <span className="status-entry-text">
                        {entry.msg}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        ) : (
          <p className="status-empty">
            {hasExecutions
              ? "Aún no hay mensajes de compilación o ejecución para mostrar."
              : "Configura un experimento a la izquierda y ejecútalo para ver aquí el progreso."}
          </p>
        )}
      </div>

      <div className="rf-status-footer">
        <button
          type="button"
          className={`secondary-button ${
            check || !hasExecutions ? "secondary-button-disabled" : ""
          }`}
          onClick={onGoToResults}
          disabled={check || !hasExecutions}
        >
          Ver estadísticas
        </button>
        <p className="rf-status-hint">
          Podrás acceder al detalle de métricas una vez que todos los archivos
          tengan resultados.
        </p>
      </div>
    </aside>
  );
}

/**
 * Clasifica un mensaje del backend en nivel / icono.
 * Esto se usa para colorear cada línea del panel.
 */
function classifyMessage(text) {
  const t = text.toLowerCase();

  if (t.includes("✅ resultados listos") || t.includes("resultados listos")) {
    return { level: "success", icon: "✅" };
  }

  if (t.includes("timeout") || t.includes("tiempo límite excedido")) {
    return { level: "error", icon: "⏱️" };
  }

  if (
    t.includes("compilación") ||
    t.includes("compilation") ||
    t.includes("error de compilación")
  ) {
    return { level: "error", icon: "🧱" };
  }

  if (t.includes("warning") || t.includes("aviso")) {
    return { level: "warning", icon: "⚠️" };
  }

  if (t.includes("error") || t.includes("❌")) {
    return { level: "error", icon: "❌" };
  }

  return { level: "info", icon: "ℹ️" };
}

export default StatusPanel;
