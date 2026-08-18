import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Archive,
  CheckCircle2,
  Clipboard,
  ClipboardCopy,
  Code2,
  Cpu,
  Download,
  FileJson2,
  Fingerprint,
  HardDriveDownload,
  Link2,
  Loader2,
  PackageCheck,
  Settings2,
} from "lucide-react";

import { serverURL } from "../common/Constants";
import downloadAuthenticatedFile from "../utils/downloadAuthenticatedFile";
import SourceViewerModal, {
  formatBytes,
  safeFilename,
} from "./SourceViewerModal";

import "./ReproducibilityPanel.css";

const FALLBACK = "No disponible";

const INTEGRITY_LABELS = {
  verified: "Verificado",
  unavailable: "No disponible",
  unverified: "Sin verificar",
  mismatch: "No coincide",
  invalid_reference: "Referencia inválida",
  invalid_archive: "ZIP inválido",
};

const displayValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return FALLBACK;
  }
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return String(value);
};

const formatDateTime = (value) => {
  if (!value) return FALLBACK;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return FALLBACK;

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  })
    .format(date)
    .replace(/[\s\u00a0\u202f]+/gu, " ")
    .trim();
};

const integrityLabel = (value) =>
  INTEGRITY_LABELS[value] || displayValue(value);

const requestStateMessage = (error, resource) => {
  const status = error?.response?.status;
  if (!error?.response) {
    return `No fue posible conectar para cargar ${resource}.`;
  }
  if (status === 401 || status === 403) {
    return `Tu sesión no permite consultar ${resource}.`;
  }
  if (status === 404) {
    return `${resource} no está disponible para esta ejecución.`;
  }
  return `No fue posible cargar ${resource}.`;
};

const downloadErrorMessage = (error, label) => {
  const status = error?.response?.status;
  if (!error?.response) {
    return `No pudimos conectar para descargar ${label}.`;
  }
  if (status === 401 || status === 403) {
    return `Tu sesión no permite descargar ${label}.`;
  }
  if (status === 404 || status === 409 || status === 422) {
    return `${label} no está disponible para esta ejecución.`;
  }
  return `No fue posible descargar ${label}.`;
};

const DataItem = ({ label, value, code = false }) => (
  <div className="reproducibility-panel__data-item">
    <dt>{label}</dt>
    <dd className={displayValue(value) === FALLBACK ? "is-unavailable" : ""}>
      {code ? <code>{displayValue(value)}</code> : displayValue(value)}
    </dd>
  </div>
);

const Availability = ({ available, label }) => (
  <span
    className={[
      "reproducibility-panel__availability",
      available
        ? "reproducibility-panel__availability--available"
        : "reproducibility-panel__availability--unavailable",
    ].join(" ")}
  >
    {available ? <CheckCircle2 size={14} /> : <Archive size={14} />}
    {label || (available ? "Disponible" : "No disponible")}
  </span>
);

const ArtifactCard = ({ title, filename, sha, available, integrity, size }) => (
  <article className="reproducibility-panel__artifact">
    <div className="reproducibility-panel__artifact-heading">
      <div>
        <span>{title}</span>
        <strong>{displayValue(filename)}</strong>
      </div>
      <Availability
        available={available}
        label={integrity ? integrityLabel(integrity) : undefined}
      />
    </div>
    <dl>
      <DataItem label="SHA-256" value={sha} code />
      {size !== undefined && (
        <DataItem
          label="Tamaño"
          value={available ? formatBytes(size) : FALLBACK}
        />
      )}
    </dl>
  </article>
);

const ReproducibilityPanel = ({ codename, onContextChange }) => {
  const [manifest, setManifest] = useState(null);
  const [manifestLoading, setManifestLoading] = useState(true);
  const [manifestError, setManifestError] = useState("");
  const [trace, setTrace] = useState(null);
  const [traceLoading, setTraceLoading] = useState(true);
  const [traceError, setTraceError] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState("");
  const [downloadState, setDownloadState] = useState({
    key: "",
    kind: "",
    message: "",
  });

  const encodedCodename = useMemo(
    () => encodeURIComponent(String(codename || "")),
    [codename]
  );

  useEffect(() => {
    let active = true;

    setManifest(null);
    setManifestLoading(true);
    setManifestError("");
    setTrace(null);
    setTraceLoading(true);
    setTraceError("");
    setViewerOpen(false);
    setCopyFeedback("");
    setDownloadState({ key: "", kind: "", message: "" });

    axios
      .get(`${serverURL}api/executions/${encodedCodename}/manifest`, {
        withCredentials: true,
      })
      .then((response) => {
        if (active) setManifest(response.data || null);
      })
      .catch((error) => {
        if (active) {
          setManifestError(requestStateMessage(error, "el manifest"));
        }
      })
      .finally(() => {
        if (active) setManifestLoading(false);
      });

    axios
      .get(`${serverURL}api/executions/${encodedCodename}/trace`, {
        withCredentials: true,
      })
      .then((response) => {
        if (active) setTrace(response.data || null);
      })
      .catch((error) => {
        if (active) {
          setTraceError(requestStateMessage(error, "la procedencia"));
        }
      })
      .finally(() => {
        if (active) setTraceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [encodedCodename]);

  const execution = manifest?.execution || {};
  const source = manifest?.source || trace?.execution?.source || {};
  const configuration = manifest?.configuration || {};
  const measurement = configuration.measurement || {};
  const environment = manifest?.environmentObserved || {};
  const cpu = environment.cpu || {};
  const measurementBackend = environment.measurementBackend || {};
  const measurements = manifest?.artifacts?.measurements || {};
  const archive = manifest?.submission?.archive || trace?.submission?.archive || {};

  const canViewSource = Boolean(
    trace?.permissions?.canViewSource === true &&
      trace?.execution?.source?.available === true
  );
  const canDownloadSource = Boolean(
    trace?.permissions?.canDownloadSource === true &&
      trace?.execution?.source?.available === true
  );
  const canDownloadMeasurements = measurements.available === true;
  const canDownloadBundle = Boolean(
    source.available === true && measurements.available === true
  );

  const publicId = execution.publicId || trace?.execution?.publicId;
  const visibleCodename = execution.codename || trace?.execution?.codename || codename;
  const sourceFilename = source.filename || trace?.execution?.source?.filename;
  const visibleSourceFilename = sourceFilename || null;
  const rawNavigationSubmissionId =
    manifest?.submission?.id ?? trace?.submission?.id;
  const numericNavigationSubmissionId = Number(
    rawNavigationSubmissionId
  );
  const navigationSubmissionId =
    Number.isInteger(numericNavigationSubmissionId) &&
    numericNavigationSubmissionId > 0
      ? numericNavigationSubmissionId
      : null;
  const normalizedNavigationSourceFilename = String(
    sourceFilename || ""
  ).trim();
  const navigationSourceFilename = normalizedNavigationSourceFilename
    ? safeFilename(normalizedNavigationSourceFilename)
    : null;

  useEffect(() => {
    if (typeof onContextChange !== "function") return;

    onContextChange({
      submissionId: navigationSubmissionId,
      sourceFilename: navigationSourceFilename,
    });
  }, [
    onContextChange,
    navigationSubmissionId,
    navigationSourceFilename,
  ]);

  const copyText = async (value, successMessage) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API no disponible");
      }
      await navigator.clipboard.writeText(String(value));
      setCopyFeedback(successMessage);
    } catch {
      setCopyFeedback("No se pudo copiar");
    }
  };

  const handleCopyLink = () => {
    const canonicalURL = `${window.location.origin}/code/${encodedCodename}`;
    return copyText(canonicalURL, "Enlace copiado");
  };

  const handleDownload = async ({ key, path, filename, label }) => {
    if (downloadState.key) return;

    setDownloadState({ key, kind: "", message: "" });
    try {
      await downloadAuthenticatedFile(
        `${serverURL}api/executions/${encodedCodename}/${path}`,
        filename
      );
      setDownloadState({
        key: "",
        kind: "success",
        message: `${label} descargado correctamente.`,
      });
    } catch (error) {
      setDownloadState({
        key: "",
        kind: "error",
        message: downloadErrorMessage(error, label),
      });
    }
  };

  return (
    <section
      className="reproducibility-panel"
      aria-labelledby="reproducibility-title"
    >
      <header className="reproducibility-panel__header">
        <div>
          <span className="reproducibility-panel__eyebrow">
            Identidad experimental
          </span>
          <h2 id="reproducibility-title">Reproducibilidad</h2>
          <p>
            Procedencia, configuración y artefactos verificables de esta ejecución.
          </p>
        </div>
        <Fingerprint size={24} aria-hidden="true" />
      </header>

      {(manifestLoading || traceLoading) && (
        <div className="reproducibility-panel__loading" role="status">
          <Loader2 aria-hidden="true" />
          Cargando identidad reproducible…
        </div>
      )}

      {(manifestError || traceError) && (
        <div className="reproducibility-panel__partial-state">
          {manifestError && <p role="alert">{manifestError}</p>}
          {traceError && <p role="alert">{traceError}</p>}
          <span>Los resultados científicos permanecen disponibles.</span>
        </div>
      )}

      {(manifest || trace) && (
        <>
          <div className="reproducibility-panel__identity">
            <div className="reproducibility-panel__source-title">
              <Code2 size={22} aria-hidden="true" />
              <div>
                <span>Fuente de esta ejecución</span>
                <h3>{displayValue(visibleSourceFilename)}</h3>
              </div>
            </div>

            <dl className="reproducibility-panel__identity-grid">
              <DataItem label="Public ID" value={publicId} code />
              <DataItem label="ID técnico" value={visibleCodename} code />
              <DataItem label="Estado" value={execution.state} />
              <DataItem
                label="Creada"
                value={formatDateTime(execution.createdAt)}
              />
              <DataItem
                label="Finalizada"
                value={formatDateTime(execution.finishedAt)}
              />
            </dl>

            <div className="reproducibility-panel__copy-actions">
              <button
                type="button"
                onClick={() => copyText(publicId, "Public ID copiado")}
                disabled={!publicId}
              >
                <ClipboardCopy size={15} aria-hidden="true" />
                Copiar ID
              </button>
              <button type="button" onClick={handleCopyLink}>
                <Link2 size={15} aria-hidden="true" />
                Copiar enlace
              </button>
              {copyFeedback && <span role="status">{copyFeedback}</span>}
            </div>
          </div>

          {manifest && (
            <div className="reproducibility-panel__sections">
              <article className="reproducibility-panel__block">
                <div className="reproducibility-panel__block-title">
                  <Settings2 size={18} aria-hidden="true" />
                  <h3>Configuración</h3>
                </div>
                <dl>
                  <DataItem label="Benchmark" value={execution.benchmark} />
                  <DataItem label="Perfil" value={execution.profile} />
                  <DataItem label="Tamaño de entrada" value={configuration.inputSize} />
                  <DataItem label="Muestras" value={configuration.samples} />
                  <DataItem label="Flags del compilador" value={configuration.compilerFlags} code />
                  <DataItem label="Puntos" value={measurement.points} />
                  <DataItem label="Muestras por punto" value={measurement.samplesPerPoint} />
                  <DataItem label="Warmup rounds" value={measurement.warmupRounds} />
                  <DataItem label="Ámbito perf" value={measurement.perfScope} />
                  <DataItem label="Fallback por evento" value={measurement.singleEventFallback} />
                </dl>
              </article>

              <article className="reproducibility-panel__block">
                <div className="reproducibility-panel__block-title">
                  <Cpu size={18} aria-hidden="true" />
                  <div>
                    <h3>Hardware observado durante la ejecución</h3>
                    <span>No representa el perfil solicitado.</span>
                  </div>
                </div>
                <dl>
                  <DataItem label="Fabricante CPU" value={cpu.vendor} />
                  <DataItem label="Modelo CPU" value={cpu.model} />
                  <DataItem label="Arquitectura" value={cpu.architecture} />
                  <DataItem label="CPU lógicas" value={cpu.logicalCpus} />
                  <DataItem label="Backend" value={measurementBackend.name} />
                  <DataItem label="Versión" value={measurementBackend.version} />
                  <DataItem label="Ámbito solicitado" value={measurementBackend.requestedScope} />
                  <DataItem label="perf_event_paranoid" value={measurementBackend.perfEventParanoid} />
                </dl>
              </article>
            </div>
          )}

          <div className="reproducibility-panel__artifacts">
            <ArtifactCard
              title="Fuente"
              filename={visibleSourceFilename}
              sha={source.sha256}
              size={source.sizeBytes}
              available={source.available === true}
            />
            <ArtifactCard
              title="Mediciones"
              filename={measurements.filename || "CombinedResults.csv"}
              sha={measurements.sha256}
              size={measurements.sizeBytes}
              available={measurements.available === true}
            />
            <ArtifactCard
              title="Archivo original"
              filename={archive.originalFilename}
              sha={archive.sha256}
              available={archive.available === true}
              integrity={archive.integrity}
            />
          </div>

          <div className="reproducibility-panel__actions" aria-label="Acciones de reproducibilidad">
            <button
              type="button"
              onClick={() => setViewerOpen(true)}
              disabled={!canViewSource}
            >
              <Code2 size={16} aria-hidden="true" />
              Ver código
            </button>
            <button
              type="button"
              onClick={() =>
                handleDownload({
                  key: "source",
                  path: "source/download",
                  filename: sourceFilename
                    ? safeFilename(sourceFilename)
                    : "fuente.cpp",
                  label: "La fuente",
                })
              }
              disabled={!canDownloadSource || Boolean(downloadState.key)}
            >
              <Download size={16} aria-hidden="true" />
              {downloadState.key === "source" ? "Descargando…" : "Descargar fuente .cpp"}
            </button>
            <button
              type="button"
              onClick={() =>
                handleDownload({
                  key: "manifest",
                  path: "manifest/download",
                  filename: `performance-system-${visibleCodename}-manifest.json`,
                  label: "El manifest JSON",
                })
              }
              disabled={!manifest || Boolean(downloadState.key)}
            >
              <FileJson2 size={16} aria-hidden="true" />
              {downloadState.key === "manifest" ? "Descargando…" : "Descargar manifest JSON"}
            </button>
            <button
              type="button"
              onClick={() =>
                handleDownload({
                  key: "measurements",
                  path: "measurements/download",
                  filename: `performance-system-${visibleCodename}.csv`,
                  label: "El CSV",
                })
              }
              disabled={!canDownloadMeasurements || Boolean(downloadState.key)}
            >
              <HardDriveDownload size={16} aria-hidden="true" />
              {downloadState.key === "measurements" ? "Descargando…" : "Descargar CSV"}
            </button>
            <button
              type="button"
              onClick={() =>
                handleDownload({
                  key: "bundle",
                  path: "bundle",
                  filename: `performance-system-${visibleCodename}-bundle.zip`,
                  label: "El paquete reproducible",
                })
              }
              disabled={!canDownloadBundle || Boolean(downloadState.key)}
            >
              <PackageCheck size={16} aria-hidden="true" />
              {downloadState.key === "bundle" ? "Descargando…" : "Descargar paquete reproducible"}
            </button>
          </div>

          {downloadState.message && (
            <div
              className={`reproducibility-panel__feedback reproducibility-panel__feedback--${downloadState.kind}`}
              role={downloadState.kind === "error" ? "alert" : "status"}
            >
              <Clipboard size={15} aria-hidden="true" />
              {downloadState.message}
            </div>
          )}
        </>
      )}

      <SourceViewerModal
        open={viewerOpen}
        codename={codename}
        trace={trace}
        onClose={() => setViewerOpen(false)}
      />
    </section>
  );
};

export {
  displayValue,
  downloadErrorMessage,
  formatDateTime,
  integrityLabel,
  requestStateMessage,
};
export default ReproducibilityPanel;
