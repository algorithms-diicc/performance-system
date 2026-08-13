import React from "react";
import { Link } from "react-router-dom";
import {
  FileQuestion,
  Home,
  RefreshCw,
  ServerCrash,
  ShieldAlert,
} from "lucide-react";

import "./SystemStatePage.css";

const STATE_CONFIG = {
  "404": {
    eyebrow: "Navegación",
    title: "Página no encontrada",
    description:
      "La dirección que intentaste abrir no corresponde a una vista disponible de Performance System.",
    helper:
      "Revisa la URL o vuelve al inicio para continuar trabajando.",
    icon: FileQuestion,
    tone: "primary",
    primaryLabel: "Volver al inicio",
    primaryTo: "/",
    secondaryLabel: "Cómo funciona",
    secondaryTo: "/tutorial",
  },
  "403": {
    eyebrow: "Acceso restringido",
    title: "No tienes permisos para acceder",
    description:
      "Tu cuenta está autenticada, pero el rol actual no permite abrir esta sección.",
    helper:
      "Si crees que deberías tener acceso, verifica la cuenta utilizada o consulta con el administrador del sistema.",
    icon: ShieldAlert,
    tone: "warning",
    primaryLabel: "Volver al inicio",
    primaryTo: "/",
    secondaryLabel: "Mi perfil",
    secondaryTo: "/profile",
  },
  "500": {
    eyebrow: "Error del sistema",
    title: "Ocurrió un error inesperado",
    description:
      "Performance System no pudo completar la operación o renderizar esta vista correctamente.",
    helper:
      "Puedes reintentar. Si el problema persiste, conserva el contexto de la operación para facilitar su diagnóstico.",
    icon: ServerCrash,
    tone: "danger",
    primaryLabel: "Reintentar",
    primaryAction: "reload",
    secondaryLabel: "Volver al inicio",
    secondaryTo: "/",
  },
};

const SystemStatePage = ({
  statusCode = "404",
  title,
  description,
  helper,
}) => {
  const normalizedStatus = String(statusCode);
  const config =
    STATE_CONFIG[normalizedStatus] || STATE_CONFIG["500"];

  const Icon = config.icon;

  const resolvedTitle = title || config.title;
  const resolvedDescription = description || config.description;
  const resolvedHelper = helper || config.helper;

  const handlePrimaryAction = () => {
    if (config.primaryAction === "reload") {
      window.location.reload();
    }
  };

  return (
    <div
      className={`app-page system-state-page system-state-page--${config.tone}`}
    >
      <main className="system-state-main">
        <section
          className="system-state-card"
          aria-labelledby="system-state-title"
        >
          <div className="system-state-code" aria-hidden="true">
            {normalizedStatus}
          </div>

          <div className="system-state-icon">
            <Icon size={32} strokeWidth={1.8} />
          </div>

          <span className="system-state-eyebrow">
            {config.eyebrow}
          </span>

          <h1 id="system-state-title">
            {resolvedTitle}
          </h1>

          <p className="system-state-description">
            {resolvedDescription}
          </p>

          <p className="system-state-helper">
            {resolvedHelper}
          </p>

          <div className="system-state-actions">
            {config.primaryTo ? (
              <Link
                to={config.primaryTo}
                className="system-state-button system-state-button--primary"
              >
                <Home size={17} />
                {config.primaryLabel}
              </Link>
            ) : (
              <button
                type="button"
                className="system-state-button system-state-button--primary"
                onClick={handlePrimaryAction}
              >
                <RefreshCw size={17} />
                {config.primaryLabel}
              </button>
            )}

            {config.secondaryTo && (
              <Link
                to={config.secondaryTo}
                className="system-state-button system-state-button--secondary"
              >
                {config.secondaryLabel}
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
};

export default SystemStatePage;
