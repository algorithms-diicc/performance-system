import React, {
  useEffect,
  useRef,
  useState,
} from "react";
import axios from "axios";
import {
  AlertTriangle,
  Download,
  FileCode2,
  Loader2,
  X,
} from "lucide-react";

import { serverURL } from "../common/Constants";
import { useI18n } from "../i18n";
import downloadAuthenticatedFile from "../utils/downloadAuthenticatedFile";

import "./SourceViewerModal.css";

const emptyViewerState = () => ({
  kind: "loading",
  messageKey: "sourceViewer.states.loading",
  trace: null,
  source: null,
});

const safeFilename = (
  value,
  fallback = "fuente.cpp"
) => {
  const normalized = String(value || "").replace(/\\/g, "/");
  return (
    normalized.split("/").filter(Boolean).pop() ||
    fallback
  );
};

const displayFilename = (
  value,
  fallback = "Fuente histórica"
) =>
  String(value || "").trim() || fallback;

const formatBytes = (
  value,
  locale = "es-CL",
  fallback = "No disponible"
) => {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return fallback;
  }
  if (bytes < 1024) return `${bytes} B`;

  const number = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  });

  if (bytes < 1024 * 1024) {
    return `${number.format(bytes / 1024)} KB`;
  }

  return `${number.format(
    bytes / (1024 * 1024)
  )} MB`;
};

const abbreviateSha = (
  value,
  fallback = "No disponible"
) => {
  const sha = String(value || "").trim();
  if (!sha) return fallback;
  return sha.length > 24
    ? `${sha.slice(0, 12)}…${sha.slice(-8)}`
    : sha;
};

const sourceErrorKey = (error) => {
  const status = error?.response?.status;

  if (!error?.response) {
    return "sourceViewer.errors.network";
  }
  if (status === 401 || status === 403) {
    return "sourceViewer.errors.session";
  }
  if (status === 404) {
    return "sourceViewer.errors.notFound";
  }
  if (status === 409 || status === 422) {
    return "sourceViewer.errors.integrity";
  }

  return "sourceViewer.errors.generic";
};

const sourcePreviewErrorKey = (error) =>
  error?.response?.status === 422
    ? "sourceViewer.errors.previewEncoding"
    : sourceErrorKey(error);

const SourceViewerModal = ({
  open,
  codename,
  trace: suppliedTrace = null,
  onClose,
}) => {
  const { locale, t } = useI18n();
  const [viewerState, setViewerState] = useState(
    emptyViewerState
  );
  const [downloadState, setDownloadState] = useState({
    loading: false,
    messageKey: "",
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
      document.removeEventListener(
        "keydown",
        onKeyDown
      );
      previousFocusRef.current?.focus?.();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !codename) return undefined;

    let active = true;
    const encodedCodename =
      encodeURIComponent(codename);

    setViewerState(emptyViewerState());
    setDownloadState({
      loading: false,
      messageKey: "",
      kind: "",
    });

    const loadSource = async () => {
      let tracePayload = suppliedTrace;

      try {
        tracePayload =
          tracePayload ||
          (
            await axios.get(
              `${serverURL}api/executions/${encodedCodename}/trace`,
              { withCredentials: true }
            )
          ).data;
      } catch (error) {
        if (!active) return;
        setViewerState({
          kind: "error",
          messageKey: sourceErrorKey(error),
          trace: null,
          source: null,
        });
        return;
      }

      if (!active) return;

      const canView =
        tracePayload?.permissions?.canViewSource ===
        true;
      const available =
        tracePayload?.execution?.source?.available ===
        true;

      if (!canView) {
        setViewerState({
          kind: "forbidden",
          messageKey:
            "sourceViewer.errors.forbidden",
          trace: tracePayload,
          source: null,
        });
        return;
      }

      if (!available) {
        setViewerState({
          kind: "unavailable",
          messageKey:
            "sourceViewer.errors.notFound",
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
          messageKey: "",
          trace: tracePayload,
          source:
            sourceResponse.data?.source || null,
        });
      } catch (error) {
        if (!active) return;
        setViewerState({
          kind: "error",
          messageKey:
            sourcePreviewErrorKey(error),
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
    if (!canDownload || downloadState.loading) {
      return;
    }

    setDownloadState({
      loading: true,
      messageKey: "",
      kind: "",
    });

    try {
      await downloadAuthenticatedFile(
        `${serverURL}api/executions/${encodeURIComponent(
          codename
        )}/source/download`,
        safeFilename(
          source?.filename ||
            trace?.execution?.source?.filename,
          t("sourceViewer.fallbackDownloadFilename")
        )
      );
      setDownloadState({
        loading: false,
        kind: "success",
        messageKey:
          "sourceViewer.download.success",
      });
    } catch (error) {
      setDownloadState({
        loading: false,
        kind: "error",
        messageKey: sourceErrorKey(error),
      });
    }
  };

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const visibleFilename = displayFilename(
    source?.filename ||
      trace?.execution?.source?.filename,
    t("sourceViewer.fallbackSource")
  );

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
              <FileCode2
                size={15}
                aria-hidden="true"
              />
              {t("sourceViewer.marker")}
            </span>
            <h2 id="source-viewer-title">
              {visibleFilename}
            </h2>
            <p id="source-viewer-description">
              {t("sourceViewer.readOnly")}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            className="source-viewer__close"
            onClick={onClose}
            aria-label={t(
              "sourceViewer.closeAria"
            )}
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
                  <code
                    title={
                      source.sha256 || undefined
                    }
                  >
                    {abbreviateSha(
                      source.sha256,
                      t("sourceViewer.unavailable")
                    )}
                  </code>
                </dd>
              </div>
              <div>
                <dt>{t("sourceViewer.size")}</dt>
                <dd>
                  {formatBytes(
                    source.sizeBytes,
                    locale,
                    t("sourceViewer.unavailable")
                  )}
                </dd>
              </div>
            </dl>

            <div
              className="source-viewer__code-region"
              tabIndex="0"
            >
              <pre>
                <code>
                  {String(source.content ?? "")}
                </code>
              </pre>
            </div>
          </>
        ) : (
          <div
            className={`source-viewer__state source-viewer__state--${viewerState.kind}`}
            role={
              viewerState.kind === "loading"
                ? "status"
                : "alert"
            }
          >
            {viewerState.kind === "loading" ? (
              <Loader2
                className="source-viewer__spinner"
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle aria-hidden="true" />
            )}
            <p>
              {viewerState.messageKey
                ? t(viewerState.messageKey)
                : ""}
            </p>
          </div>
        )}

        <footer className="source-viewer__footer">
          <div aria-live="polite">
            {downloadState.messageKey && (
              <span
                className={`source-viewer__feedback source-viewer__feedback--${downloadState.kind}`}
                role={
                  downloadState.kind === "error"
                    ? "alert"
                    : "status"
                }
              >
                {t(downloadState.messageKey)}
              </span>
            )}
          </div>

          <div className="source-viewer__actions">
            <button
              type="button"
              className="source-viewer__button source-viewer__button--secondary"
              onClick={onClose}
            >
              {t("sourceViewer.close")}
            </button>

            {canDownload && (
              <button
                type="button"
                className="source-viewer__button source-viewer__button--primary"
                onClick={handleDownload}
                disabled={downloadState.loading}
              >
                <Download
                  size={16}
                  aria-hidden="true"
                />
                {downloadState.loading
                  ? t(
                      "sourceViewer.download.downloading"
                    )
                  : t(
                      "sourceViewer.download.action"
                    )}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
};

export {
  abbreviateSha,
  displayFilename,
  formatBytes,
  safeFilename,
};
export default SourceViewerModal;
