import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  AlertTriangle,
  Download,
  FileCode2,
  Loader2,
  X,
} from "lucide-react";

import { serverURL } from "../common/Constants";
import downloadAuthenticatedFile from "../utils/downloadAuthenticatedFile";

import "./SourceViewerModal.css";

const EMPTY_STATE = {
  kind: "loading",
  message: "Consultando la fuente histórica…",
  trace: null,
  source: null,
};

const safeFilename = (value) => {
  const normalized = String(value || "").replace(/\\/g, "/");
  return normalized.split("/").filter(Boolean).pop() || "fuente.cpp";
};

const displayFilename = (value) =>
  String(value || "").trim() || "Fuente histórica";

const formatBytes = (value) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "No disponible";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toLocaleString("es-CL", {
      maximumFractionDigits: 1,
    })} KB`;
  }
  return `${(bytes / (1024 * 1024)).toLocaleString("es-CL", {
    maximumFractionDigits: 1,
  })} MB`;
};

const abbreviateSha = (value) => {
  const sha = String(value || "").trim();
  if (!sha) return "No disponible";
  return sha.length > 24
    ? `${sha.slice(0, 12)}…${sha.slice(-8)}`
    : sha;
};

const sourceErrorMessage = (error) => {
  const status = error?.response?.status;
  if (!error?.response) {
    return "No pudimos conectar con el servidor para recuperar la fuente.";
  }
  if (status === 401 || status === 403) {
    return "Tu sesión no permite consultar esta fuente histórica.";
  }
  if (status === 404) {
    return "La fuente histórica no está disponible para esta ejecución.";
  }
  if (status === 409 || status === 422) {
    return "La fuente histórica no superó las comprobaciones de disponibilidad e integridad.";
  }
  return "No fue posible recuperar la fuente histórica en este momento.";
};

const sourcePreviewErrorMessage = (error) => {
  if (error?.response?.status === 422) {
    return "La vista previa no puede mostrarse porque la fuente histórica no utiliza codificación UTF-8 válida. Aún puedes descargar el archivo original.";
  }
  return sourceErrorMessage(error);
};

const SourceViewerModal = ({
  open,
  codename,
  trace: suppliedTrace = null,
  onClose,
}) => {
  const [viewerState, setViewerState] = useState(EMPTY_STATE);
  const [downloadState, setDownloadState] = useState({
    loading: false,
    message: "",
    kind: "",
  });
  const closeButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    previousFocusRef.current = document.activeElement;
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !codename) return undefined;

    let active = true;
    const encodedCodename = encodeURIComponent(codename);

    setViewerState(EMPTY_STATE);
    setDownloadState({ loading: false, message: "", kind: "" });

    const loadSource = async () => {
      let tracePayload = suppliedTrace;

      try {
        tracePayload = tracePayload || (
          await axios.get(
            `${serverURL}api/executions/${encodedCodename}/trace`,
            { withCredentials: true }
          )
        ).data;
      } catch (error) {
        if (!active) return;
        setViewerState({
          kind: "error",
          message: sourceErrorMessage(error),
          trace: null,
          source: null,
        });
        return;
      }

      if (!active) return;

      const canView = tracePayload?.permissions?.canViewSource === true;
      const available =
        tracePayload?.execution?.source?.available === true;

      if (!canView) {
        setViewerState({
          kind: "forbidden",
          message: "Tu cuenta no tiene permiso para visualizar esta fuente.",
          trace: tracePayload,
          source: null,
        });
        return;
      }

      if (!available) {
        setViewerState({
          kind: "unavailable",
          message: "La fuente histórica no está disponible para esta ejecución.",
          trace: tracePayload,
          source: null,
        });
        return;
      }

      try {
        const sourceResponse = await axios.get(
          `${serverURL}api/executions/${encodedCodename}/source`,
          { withCredentials: true }
        );

        if (!active) return;

        setViewerState({
          kind: "ready",
          message: "",
          trace: tracePayload,
          source: sourceResponse.data?.source || null,
        });
      } catch (error) {
        if (!active) return;
        setViewerState({
          kind: "error",
          message: sourcePreviewErrorMessage(error),
          trace: tracePayload,
          source: null,
        });
      }
    };

    loadSource();

    return () => {
      active = false;
    };
  }, [open, codename, suppliedTrace]);

  if (!open) return null;

  const source = viewerState.source;
  const trace = viewerState.trace;
  const canDownload = Boolean(
    trace?.permissions?.canDownloadSource === true &&
      trace?.execution?.source?.available === true
  );

  const handleDownload = async () => {
    if (!canDownload || downloadState.loading) return;

    setDownloadState({ loading: true, message: "", kind: "" });
    try {
      await downloadAuthenticatedFile(
        `${serverURL}api/executions/${encodeURIComponent(
          codename
        )}/source/download`,
        safeFilename(
          source?.filename || trace?.execution?.source?.filename
        )
      );
      setDownloadState({
        loading: false,
        kind: "success",
        message: "Fuente descargada correctamente.",
      });
    } catch (error) {
      setDownloadState({
        loading: false,
        kind: "error",
        message: sourceErrorMessage(error),
      });
    }
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      className="source-viewer__backdrop"
      onMouseDown={handleBackdropClick}
      data-testid="source-viewer-backdrop"
    >
      <section
        className="source-viewer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-viewer-title"
        aria-describedby="source-viewer-description"
      >
        <header className="source-viewer__header">
          <div className="source-viewer__heading">
            <span className="source-viewer__marker">
              <FileCode2 size={15} aria-hidden="true" />
              Fuente de esta ejecución
            </span>
            <h2 id="source-viewer-title">
              {displayFilename(
                source?.filename ||
                  trace?.execution?.source?.filename
              )}
            </h2>
            <p id="source-viewer-description">
              Vista histórica de solo lectura
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="source-viewer__close"
            onClick={onClose}
            aria-label="Cerrar visor de código"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {viewerState.kind === "ready" && source ? (
          <>
            <dl className="source-viewer__metadata">
              <div>
                <dt>SHA-256</dt>
                <dd>
                  <code title={source.sha256 || undefined}>
                    {abbreviateSha(source.sha256)}
                  </code>
                </dd>
              </div>
              <div>
                <dt>Tamaño</dt>
                <dd>{formatBytes(source.sizeBytes)}</dd>
              </div>
            </dl>

            <div className="source-viewer__code-region" tabIndex="0">
              <pre>
                <code>{String(source.content ?? "")}</code>
              </pre>
            </div>
          </>
        ) : (
          <div
            className={`source-viewer__state source-viewer__state--${viewerState.kind}`}
            role={viewerState.kind === "loading" ? "status" : "alert"}
          >
            {viewerState.kind === "loading" ? (
              <Loader2 className="source-viewer__spinner" aria-hidden="true" />
            ) : (
              <AlertTriangle aria-hidden="true" />
            )}
            <p>{viewerState.message}</p>
          </div>
        )}

        <footer className="source-viewer__footer">
          <div aria-live="polite">
            {downloadState.message && (
              <span
                className={`source-viewer__feedback source-viewer__feedback--${downloadState.kind}`}
                role={downloadState.kind === "error" ? "alert" : "status"}
              >
                {downloadState.message}
              </span>
            )}
          </div>
          <div className="source-viewer__actions">
            <button
              type="button"
              className="source-viewer__button source-viewer__button--secondary"
              onClick={onClose}
            >
              Cerrar
            </button>
            {canDownload && (
              <button
                type="button"
                className="source-viewer__button source-viewer__button--primary"
                onClick={handleDownload}
                disabled={downloadState.loading}
              >
                <Download size={16} aria-hidden="true" />
                {downloadState.loading ? "Descargando…" : "Descargar .cpp"}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
};

export { abbreviateSha, displayFilename, formatBytes, safeFilename };
export default SourceViewerModal;
