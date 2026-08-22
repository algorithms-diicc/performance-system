import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Archive,
  CheckCircle2,
  ChevronDown,
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
import {
  translate,
  useI18n,
} from "../i18n";
import downloadAuthenticatedFile from "../utils/downloadAuthenticatedFile";
import SourceViewerModal, {
  formatBytes,
  safeFilename,
} from "./SourceViewerModal";

import "./ReproducibilityPanel.css";

const INTEGRITY_KEYS = Object.freeze({
  verified: "verified",
  unavailable: "unavailable",
  unverified: "unverified",
  mismatch: "mismatch",
  invalid_reference: "invalidReference",
  invalid_archive: "invalidArchive",
});

const EXECUTION_STATE_KEYS = Object.freeze({
  QUEUED: "queued",
  RUNNING: "running",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

const resolveText = (
  t,
  key,
  params = {}
) =>
  typeof t === "function"
    ? t(key, params)
    : translate("es", key, params);

const displayValue = (
  value,
  {
    fallback = translate(
      "es",
      "reproducibilityPanel.common.unavailable"
    ),
    yes = translate(
      "es",
      "reproducibilityPanel.common.yes"
    ),
    no = translate(
      "es",
      "reproducibilityPanel.common.no"
    ),
  } = {}
) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value ? yes : no;
  }
  return String(value);
};

export const executionStateLabel = (
  value,
  t
) => {
  const normalized = String(value || "").trim().toUpperCase();
  const key = EXECUTION_STATE_KEYS[normalized];

  if (key) {
    return resolveText(
      t,
      `reproducibilityPanel.executionStates.${key}`
    );
  }

  return normalized || resolveText(
    t,
    "reproducibilityPanel.common.unavailable"
  );
};

const formatDateTime = (
  value,
  locale = "es-CL",
  fallback = translate(
    "es",
    "reproducibilityPanel.common.unavailable"
  )
) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  })
    .format(date)
    .replace(/[\s\u00a0\u202f]+/gu, " ")
    .trim();
};

const integrityLabel = (
  value,
  t
) => {
  const normalized = String(value || "").trim();
  const key = INTEGRITY_KEYS[normalized];

  if (!key) {
    return displayValue(value);
  }

  return resolveText(
    t,
    `reproducibilityPanel.integrity.${key}`
  );
};

const resourceLabel = (
  resourceKey,
  t
) =>
  resolveText(
    t,
    `reproducibilityPanel.resources.${resourceKey}`
  );

const requestStateMessage = (
  error,
  resourceKey,
  t
) => {
  const status = error?.response?.status;
  const resource = resourceLabel(
    resourceKey,
    t
  );

  if (!error?.response) {
    return resolveText(
      t,
      "reproducibilityPanel.requestErrors.network",
      { resource }
    );
  }
  if (status === 401 || status === 403) {
    return resolveText(
      t,
      "reproducibilityPanel.requestErrors.forbidden",
      { resource }
    );
  }
  if (status === 404) {
    return resolveText(
      t,
      "reproducibilityPanel.requestErrors.notFound",
      { resource }
    );
  }
  return resolveText(
    t,
    "reproducibilityPanel.requestErrors.generic",
    { resource }
  );
};

const downloadErrorMessage = (
  error,
  resourceKey,
  t
) => {
  const status = error?.response?.status;
  const resource = resourceLabel(
    resourceKey,
    t
  );

  if (!error?.response) {
    return resolveText(
      t,
      "reproducibilityPanel.downloadErrors.network",
      { resource }
    );
  }
  if (status === 401 || status === 403) {
    return resolveText(
      t,
      "reproducibilityPanel.downloadErrors.forbidden",
      { resource }
    );
  }
  if (
    status === 404 ||
    status === 409 ||
    status === 422
  ) {
    return resolveText(
      t,
      "reproducibilityPanel.downloadErrors.notFound",
      { resource }
    );
  }
  return resolveText(
    t,
    "reproducibilityPanel.downloadErrors.generic",
    { resource }
  );
};

const DataItem = ({
  label,
  value,
  code = false,
}) => {
  const { t } = useI18n();
  const fallback = t(
    "reproducibilityPanel.common.unavailable"
  );
  const displayed = displayValue(value, {
    fallback,
    yes: t("reproducibilityPanel.common.yes"),
    no: t("reproducibilityPanel.common.no"),
  });

  return (
    <div className="reproducibility-panel__data-item">
      <dt>{label}</dt>
      <dd
        className={
          displayed === fallback
            ? "is-unavailable"
            : ""
        }
      >
        {code ? <code>{displayed}</code> : displayed}
      </dd>
    </div>
  );
};

const Availability = ({
  available,
  label,
}) => {
  const { t } = useI18n();

  return (
    <span
      className={[
        "reproducibility-panel__availability",
        available
          ? "reproducibility-panel__availability--available"
          : "reproducibility-panel__availability--unavailable",
      ].join(" ")}
    >
      {available ? (
        <CheckCircle2 size={14} />
      ) : (
        <Archive size={14} />
      )}
      {label ||
        (available
          ? t(
              "reproducibilityPanel.availability.available"
            )
          : t(
              "reproducibilityPanel.availability.unavailable"
            ))}
    </span>
  );
};

const ArtifactCard = ({
  title,
  filename,
  sha,
  available,
  integrity,
  size,
}) => {
  const { locale, t } = useI18n();
  const fallback = t(
    "reproducibilityPanel.common.unavailable"
  );

  return (
    <article className="reproducibility-panel__artifact">
      <div className="reproducibility-panel__artifact-heading">
        <div>
          <span>{title}</span>
          <strong>
            {displayValue(filename, { fallback })}
          </strong>
        </div>
        <Availability
          available={available}
          label={
            integrity
              ? integrityLabel(integrity, t)
              : undefined
          }
        />
      </div>
      <dl>
        <DataItem
          label="SHA-256"
          value={sha}
          code
        />
        {size !== undefined && (
          <DataItem
            label={t(
              "reproducibilityPanel.fields.size"
            )}
            value={
              available
                ? formatBytes(
                    size,
                    locale,
                    fallback
                  )
                : fallback
            }
          />
        )}
      </dl>
    </article>
  );
};

const ReproducibilityPanel = ({ codename, onContextChange }) => {
  const { locale, t } = useI18n();
  const [manifest, setManifest] = useState(null);
  const [manifestLoading, setManifestLoading] = useState(true);
  const [manifestError, setManifestError] = useState(null);
  const [trace, setTrace] = useState(null);
  const [traceLoading, setTraceLoading] = useState(true);
  const [traceError, setTraceError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [copyFeedbackKey, setCopyFeedbackKey] = useState("");
  const [downloadState, setDownloadState] = useState({
    key: "",
    kind: "",
    resourceKey: "",
    error: null,
  });

  const encodedCodename = useMemo(
    () => encodeURIComponent(String(codename || "")),
    [codename]
  );

  useEffect(() => {
    let active = true;

    setManifest(null);
    setManifestLoading(true);
    setManifestError(null);
    setTrace(null);
    setTraceLoading(true);
    setTraceError(null);
    setExpanded(false);
    setViewerOpen(false);
    setCopyFeedbackKey("");
    setDownloadState({
      key: "",
      kind: "",
      resourceKey: "",
      error: null,
    });

    axios
      .get(`${serverURL}api/executions/${encodedCodename}/manifest`, {
        withCredentials: true,
      })
      .then((response) => {
        if (active) setManifest(response.data || null);
      })
      .catch((error) => {
        if (active) {
          setManifestError(error);
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
          setTraceError(error);
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

  const copyText = async (
    value,
    successKey
  ) => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(
          "Clipboard API unavailable"
        );
      }
      await navigator.clipboard.writeText(
        String(value)
      );
      setCopyFeedbackKey(successKey);
    } catch {
      setCopyFeedbackKey(
        "reproducibilityPanel.copy.error"
      );
    }
  };

  const handleCopyLink = () => {
    const canonicalURL =
      `${window.location.origin}/code/${encodedCodename}`;
    return copyText(
      canonicalURL,
      "reproducibilityPanel.copy.linkSuccess"
    );
  };

  const handleDownload = async ({
    key,
    path,
    filename,
    resourceKey,
  }) => {
    if (downloadState.key) return;

    setDownloadState({
      key,
      kind: "",
      resourceKey,
      error: null,
    });
    try {
      await downloadAuthenticatedFile(
        `${serverURL}api/executions/${encodedCodename}/${path}`,
        filename
      );
      setDownloadState({
        key: "",
        kind: "success",
        resourceKey,
        error: null,
      });
    } catch (error) {
      setDownloadState({
        key: "",
        kind: "error",
        resourceKey,
        error,
      });
    }
  };

  const copyFeedback = copyFeedbackKey
    ? t(copyFeedbackKey)
    : "";

  const downloadFeedback =
    downloadState.kind === "success"
      ? t(
          "reproducibilityPanel.download.success",
          {
            resource: resourceLabel(
              downloadState.resourceKey,
              t
            ),
          }
        )
      : downloadState.kind === "error"
      ? downloadErrorMessage(
          downloadState.error,
          downloadState.resourceKey,
          t
        )
      : "";

  return (
    <section
      className={[
        "reproducibility-panel",
        expanded
          ? "reproducibility-panel--expanded"
          : "reproducibility-panel--collapsed",
      ].join(" ")}
      aria-labelledby="reproducibility-title"
    >
      <header className="reproducibility-panel__header">
        <div>
          <span className="reproducibility-panel__eyebrow">
            {t("reproducibilityPanel.header.eyebrow")}
          </span>
          <h2 id="reproducibility-title">
            {t("reproducibilityPanel.header.title")}
          </h2>
          <p>
            {t("reproducibilityPanel.header.description")}
          </p>
        </div>

        <div className="reproducibility-panel__header-actions">
          <Fingerprint size={22} aria-hidden="true" />
          <button
            type="button"
            className="reproducibility-panel__toggle"
            aria-expanded={expanded}
            aria-controls="reproducibility-content"
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronDown size={16} aria-hidden="true" />
            <span>
              {t(
                expanded
                  ? "reproducibilityPanel.disclosure.collapse"
                  : "reproducibilityPanel.disclosure.expand"
              )}
            </span>
          </button>
        </div>
      </header>

      <div
        id="reproducibility-content"
        className="reproducibility-panel__body"
        hidden={!expanded}
      >
      {(manifestLoading || traceLoading) && (
        <div className="reproducibility-panel__loading" role="status">
          <Loader2 aria-hidden="true" />
          {t("reproducibilityPanel.loading")}
        </div>
      )}

      {(manifestError || traceError) && (
        <div className="reproducibility-panel__partial-state">
          {manifestError && (
            <p role="alert">
              {requestStateMessage(
                manifestError,
                "manifest",
                t
              )}
            </p>
          )}
          {traceError && (
            <p role="alert">
              {requestStateMessage(
                traceError,
                "provenance",
                t
              )}
            </p>
          )}
          <span>
            {t(
              "reproducibilityPanel.partial.scientificResultsRemain"
            )}
          </span>
        </div>
      )}

      {(manifest || trace) && (
        <>
          <div className="reproducibility-panel__identity">
            <div className="reproducibility-panel__source-title">
              <Code2 size={22} aria-hidden="true" />
              <div>
                <span>
                  {t("reproducibilityPanel.source.title")}
                </span>
                <h3>
                  {displayValue(
                    visibleSourceFilename,
                    {
                      fallback: t(
                        "reproducibilityPanel.common.unavailable"
                      ),
                    }
                  )}
                </h3>
              </div>
            </div>

            <dl className="reproducibility-panel__identity-grid">
              <DataItem label="Public ID" value={publicId} code />
              <DataItem
                label={t("reproducibilityPanel.fields.technicalId")}
                value={visibleCodename}
                code
              />
              <DataItem
                label={t("reproducibilityPanel.fields.state")}
                value={executionStateLabel(execution.state, t)}
              />
              <DataItem
                label={t("reproducibilityPanel.fields.created")}
                value={formatDateTime(
                  execution.createdAt,
                  locale,
                  t("reproducibilityPanel.common.unavailable")
                )}
              />
              <DataItem
                label={t("reproducibilityPanel.fields.finished")}
                value={formatDateTime(
                  execution.finishedAt,
                  locale,
                  t("reproducibilityPanel.common.unavailable")
                )}
              />
            </dl>

            <div className="reproducibility-panel__copy-actions">
              <button
                type="button"
                onClick={() =>
                  copyText(
                    publicId,
                    "reproducibilityPanel.copy.publicIdSuccess"
                  )
                }
                disabled={!publicId}
              >
                <ClipboardCopy size={15} aria-hidden="true" />
                {t("reproducibilityPanel.copy.idAction")}
              </button>
              <button type="button" onClick={handleCopyLink}>
                <Link2 size={15} aria-hidden="true" />
                {t("reproducibilityPanel.copy.linkAction")}
              </button>
              {copyFeedback && (
                <span role="status">
                  {copyFeedback}
                </span>
              )}
            </div>
          </div>

          {manifest && (
            <div className="reproducibility-panel__sections">
              <article className="reproducibility-panel__block">
                <div className="reproducibility-panel__block-title">
                  <Settings2 size={18} aria-hidden="true" />
                  <h3>
                    {t("reproducibilityPanel.configuration.title")}
                  </h3>
                </div>
                <dl>
                  <DataItem label="Benchmark" value={execution.benchmark} />
                  <DataItem
                    label={t("reproducibilityPanel.fields.profile")}
                    value={execution.profile}
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.inputSize")}
                    value={configuration.inputSize}
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.samples")}
                    value={configuration.samples}
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.compilerFlags")}
                    value={configuration.compilerFlags}
                    code
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.points")}
                    value={measurement.points}
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.samplesPerPoint")}
                    value={measurement.samplesPerPoint}
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.warmupRounds")}
                    value={measurement.warmupRounds}
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.perfScope")}
                    value={measurement.perfScope}
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.eventFallback")}
                    value={measurement.singleEventFallback}
                  />
                </dl>
              </article>

              <article className="reproducibility-panel__block">
                <div className="reproducibility-panel__block-title">
                  <Cpu size={18} aria-hidden="true" />
                  <div>
                    <h3>
                      {t("reproducibilityPanel.hardware.title")}
                    </h3>
                    <span>
                      {t("reproducibilityPanel.hardware.note")}
                    </span>
                  </div>
                </div>
                <dl>
                  <DataItem
                    label={t("reproducibilityPanel.fields.cpuVendor")}
                    value={cpu.vendor}
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.cpuModel")}
                    value={cpu.model}
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.architecture")}
                    value={cpu.architecture}
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.logicalCpus")}
                    value={cpu.logicalCpus}
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.backend")}
                    value={measurementBackend.name}
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.version")}
                    value={measurementBackend.version}
                  />
                  <DataItem
                    label={t("reproducibilityPanel.fields.requestedScope")}
                    value={measurementBackend.requestedScope}
                  />
                  <DataItem label="perf_event_paranoid" value={measurementBackend.perfEventParanoid} />
                </dl>
              </article>
            </div>
          )}

          <div className="reproducibility-panel__artifacts">
            <ArtifactCard
              title={t("reproducibilityPanel.artifacts.source")}
              filename={visibleSourceFilename}
              sha={source.sha256}
              size={source.sizeBytes}
              available={source.available === true}
            />
            <ArtifactCard
              title={t("reproducibilityPanel.artifacts.measurements")}
              filename={measurements.filename || "CombinedResults.csv"}
              sha={measurements.sha256}
              size={measurements.sizeBytes}
              available={measurements.available === true}
            />
            <ArtifactCard
              title={t("reproducibilityPanel.artifacts.originalArchive")}
              filename={archive.originalFilename}
              sha={archive.sha256}
              available={archive.available === true}
              integrity={archive.integrity}
            />
          </div>

          <div
            className="reproducibility-panel__actions"
            aria-label={t(
              "reproducibilityPanel.actions.aria"
            )}
          >
            <button
              type="button"
              onClick={() => setViewerOpen(true)}
              disabled={!canViewSource}
            >
              <Code2 size={16} aria-hidden="true" />
              {t("reproducibilityPanel.actions.viewCode")}
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
                  resourceKey: "source",
                })
              }
              disabled={!canDownloadSource || Boolean(downloadState.key)}
            >
              <Download size={16} aria-hidden="true" />
              {downloadState.key === "source"
                ? t("reproducibilityPanel.actions.downloading")
                : t("reproducibilityPanel.actions.downloadSource")}
            </button>
            <button
              type="button"
              onClick={() =>
                handleDownload({
                  key: "manifest",
                  path: "manifest/download",
                  filename: `performance-system-${visibleCodename}-manifest.json`,
                  resourceKey: "manifestJson",
                })
              }
              disabled={!manifest || Boolean(downloadState.key)}
            >
              <FileJson2 size={16} aria-hidden="true" />
              {downloadState.key === "manifest"
                ? t("reproducibilityPanel.actions.downloading")
                : t("reproducibilityPanel.actions.downloadManifest")}
            </button>
            <button
              type="button"
              onClick={() =>
                handleDownload({
                  key: "measurements",
                  path: "measurements/download",
                  filename: `performance-system-${visibleCodename}.csv`,
                  resourceKey: "csv",
                })
              }
              disabled={!canDownloadMeasurements || Boolean(downloadState.key)}
            >
              <HardDriveDownload size={16} aria-hidden="true" />
              {downloadState.key === "measurements"
                ? t("reproducibilityPanel.actions.downloading")
                : t("reproducibilityPanel.actions.downloadCsv")}
            </button>
            <button
              type="button"
              onClick={() =>
                handleDownload({
                  key: "bundle",
                  path: "bundle",
                  filename: `performance-system-${visibleCodename}-bundle.zip`,
                  resourceKey: "bundle",
                })
              }
              disabled={!canDownloadBundle || Boolean(downloadState.key)}
            >
              <PackageCheck size={16} aria-hidden="true" />
              {downloadState.key === "bundle"
                ? t("reproducibilityPanel.actions.downloading")
                : t("reproducibilityPanel.actions.downloadBundle")}
            </button>
          </div>

          {downloadFeedback && (
            <div
              className={`reproducibility-panel__feedback reproducibility-panel__feedback--${downloadState.kind}`}
              role={downloadState.kind === "error" ? "alert" : "status"}
            >
              <Clipboard size={15} aria-hidden="true" />
              {downloadFeedback}
            </div>
          )}
        </>
      )}

      </div>

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
