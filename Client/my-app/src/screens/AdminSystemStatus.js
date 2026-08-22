import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Activity,
  Cpu,
  Database,
  ListOrdered,
  RefreshCw,
  Settings2,
} from "lucide-react";

import {
  localizedRequestError,
  requestJson,
} from "../common/requestErrorModel";
import InlineState from "../components/InlineState";
import { useI18n } from "../i18n";
import { formatDateTime } from "../i18n/formatters";
import "./AdminSystemStatus.css";


const ENDPOINT = "/api/admin/system-status";

const PUBLIC_STATUSES = new Set([
  "AVAILABLE",
  "UNAVAILABLE",
  "UNKNOWN",
]);

const LOCK_SIGNALS = new Set([
  "LOCK_OBSERVED",
  "LOCK_NOT_OBSERVED",
  "UNKNOWN",
]);

const KNOWN_PROBE_STATES = new Set([
  "numeric",
  "permission_denied",
  "not_supported",
  "not_counted",
  "event_not_exposed",
  "backend_error",
  "no_numeric_sample",
]);


function statusTone(value, kind = "status") {
  if (kind === "lock") {
    return "neutral";
  }
  if (value === "AVAILABLE") {
    return "available";
  }
  if (value === "UNAVAILABLE") {
    return "unavailable";
  }
  return "neutral";
}


function StatusPill({ value, kind = "status", t }) {
  const allowed = kind === "lock" ? LOCK_SIGNALS : PUBLIC_STATUSES;
  const normalized = allowed.has(value) ? value : "UNKNOWN";
  const namespace = kind === "lock" ? "lockSignals" : "statuses";

  return (
    <span
      className={`admin-system-status__pill admin-system-status__pill--${statusTone(
        normalized,
        kind
      )}`}
    >
      {t(`adminSystemStatus.${namespace}.${normalized}`)}
    </span>
  );
}


function Field({ label, value, technical = false }) {
  return (
    <div className="admin-system-status__field">
      <dt>{label}</dt>
      <dd>{technical && value !== "—" ? <code>{value}</code> : value}</dd>
    </div>
  );
}


function CountCard({ label, value }) {
  return (
    <article className="admin-system-status__count">
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
    </article>
  );
}


function boolLabel(value, t) {
  if (value === true) return t("adminSystemStatus.boolean.yes");
  if (value === false) return t("adminSystemStatus.boolean.no");
  return t("adminSystemStatus.unavailable");
}


function probeStateLabel(value, t) {
  if (!value) return t("adminSystemStatus.unavailable");
  if (KNOWN_PROBE_STATES.has(value)) {
    return t(`adminSystemStatus.probeStates.${value}`);
  }
  return value;
}


function EnergyCard({ label, signal, t }) {
  const probeState = probeStateLabel(signal?.probeState, t);
  const unknownProbe = Boolean(
    signal?.probeState && !KNOWN_PROBE_STATES.has(signal.probeState)
  );

  return (
    <article className="admin-system-status__energy-card">
      <h3>{label}</h3>
      <dl>
        <Field
          label={t("adminSystemStatus.measurement.eventExposed")}
          value={boolLabel(signal?.eventExposed, t)}
        />
        <Field
          label={t("adminSystemStatus.measurement.probeState")}
          value={probeState}
          technical={unknownProbe}
        />
        <Field
          label={t("adminSystemStatus.measurement.measurementAvailable")}
          value={boolLabel(signal?.measurementAvailable, t)}
        />
      </dl>
    </article>
  );
}


export default function AdminSystemStatus() {
  const {
    language,
    locale,
    t,
  } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const activeController = useRef(null);

  const loadStatus = useCallback(async () => {
    if (activeController.current) {
      activeController.current.abort();
    }

    const controller = new AbortController();
    activeController.current = controller;
    setLoading(true);
    setError(null);

    try {
      const response = await requestJson(
        ENDPOINT,
        {
          credentials: "include",
          signal: controller.signal,
        },
        {
          fallback: "No fue posible consultar el estado del sistema.",
        }
      );

      if (!controller.signal.aborted) {
        setData(response);
      }
    } catch (requestError) {
      if (requestError?.name !== "AbortError") {
        setError(requestError);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadStatus();

    return () => {
      if (activeController.current) {
        activeController.current.abort();
      }
    };
  }, [loadStatus]);

  const unavailable = t("adminSystemStatus.unavailable");
  const formatTimestamp = (value) =>
    formatDateTime(value, locale, unavailable);
  const errorMessage = error
    ? localizedRequestError(error, t, {
        language,
        fallbackKey: "adminSystemStatus.states.errorDescription",
      })
    : "";

  const queue = data?.queue || {};
  const runtime = data?.runtime || {};
  const signals = data?.processSignals || {};
  const measurement = data?.measurementEnvironment || {};
  const energy = measurement?.energy || {};
  const executionMode = ["local", "remote", "unknown"].includes(
    runtime.executionMode
  )
    ? t(`adminSystemStatus.modes.${runtime.executionMode}`)
    : unavailable;

  return (
    <main className="admin-system-status">
      <header className="admin-system-status__header">
        <div>
          <p className="admin-system-status__eyebrow">
            {t("adminSystemStatus.eyebrow")}
          </p>
          <h1>{t("adminSystemStatus.title")}</h1>
          <p>{t("adminSystemStatus.description")}</p>
        </div>
        <button
          type="button"
          className="admin-system-status__refresh"
          onClick={loadStatus}
          disabled={loading}
        >
          <RefreshCw
            size={16}
            className={loading ? "admin-system-status__spin" : ""}
          />
          {loading
            ? t("adminSystemStatus.actions.refreshing")
            : t("adminSystemStatus.actions.refresh")}
        </button>
      </header>

      {loading && !data && (
        <InlineState
          type="loading"
          title={t("adminSystemStatus.states.loadingTitle")}
          description={t("adminSystemStatus.states.loadingDescription")}
        />
      )}

      {error && (
        <div className="admin-system-status__error" role="alert">
          <div>
            <strong>{t("adminSystemStatus.states.errorTitle")}</strong>
            <p>{errorMessage}</p>
          </div>
          <button type="button" onClick={loadStatus} disabled={loading}>
            {t("adminSystemStatus.actions.retry")}
          </button>
        </div>
      )}

      {data && (
        <div className="admin-system-status__sections">
          <section className="admin-system-status__section">
            <div className="admin-system-status__section-heading">
              <Activity size={19} />
              <h2>{t("adminSystemStatus.sections.system")}</h2>
            </div>
            <div className="admin-system-status__system-grid">
              <article>
                <span>{t("adminSystemStatus.system.backend")}</span>
                <StatusPill value={data?.backend?.status} t={t} />
              </article>
              <article>
                <span>{t("adminSystemStatus.system.database")}</span>
                <StatusPill value={data?.database?.status} t={t} />
              </article>
              <article>
                <span>{t("adminSystemStatus.system.checkedAt")}</span>
                <strong>{formatTimestamp(data?.checkedAt)}</strong>
              </article>
            </div>
          </section>

          <section className="admin-system-status__section">
            <div className="admin-system-status__section-heading">
              <ListOrdered size={19} />
              <h2>{t("adminSystemStatus.sections.queue")}</h2>
            </div>
            <div className="admin-system-status__counts">
              <CountCard label={t("adminSystemStatus.queue.queued")} value={queue.queued} />
              <CountCard label={t("adminSystemStatus.queue.running")} value={queue.running} />
              <CountCard label={t("adminSystemStatus.queue.processing")} value={queue.processing} />
              <CountCard label={t("adminSystemStatus.queue.staleActive")} value={queue.staleActive} />
            </div>
            <dl className="admin-system-status__fields">
              <Field
                label={t("adminSystemStatus.queue.oldestQueuedAt")}
                value={formatTimestamp(queue.oldestQueuedAt)}
              />
              <Field
                label={t("adminSystemStatus.queue.latestCompletedAt")}
                value={formatTimestamp(queue.latestCompletedAt)}
              />
              <Field
                label={t("adminSystemStatus.queue.latestFailedAt")}
                value={formatTimestamp(queue.latestFailedAt)}
              />
            </dl>
            <p className="admin-system-status__helper">
              {t("adminSystemStatus.queue.failedHelper")}
            </p>
          </section>

          <section className="admin-system-status__section">
            <div className="admin-system-status__section-heading">
              <Database size={19} />
              <h2>{t("adminSystemStatus.sections.processes")}</h2>
            </div>
            <div className="admin-system-status__process-grid">
              <article>
                <span>{t("adminSystemStatus.processes.dispatcher")}</span>
                <StatusPill
                  value={signals?.dispatcher?.signal}
                  kind="lock"
                  t={t}
                />
              </article>
              <article>
                <span>{t("adminSystemStatus.processes.watchdog")}</span>
                <StatusPill
                  value={signals?.watchdog?.signal}
                  kind="lock"
                  t={t}
                />
              </article>
            </div>
            <p className="admin-system-status__helper">
              {t("adminSystemStatus.processes.lockHelper")}
            </p>
          </section>

          <section className="admin-system-status__section">
            <div className="admin-system-status__section-heading">
              <Settings2 size={19} />
              <h2>{t("adminSystemStatus.sections.runtime")}</h2>
            </div>
            <dl className="admin-system-status__fields admin-system-status__fields--three">
              <Field
                label={t("adminSystemStatus.runtime.executionMode")}
                value={executionMode}
              />
              <Field
                label={t("adminSystemStatus.runtime.heartbeatSeconds")}
                value={
                  runtime.heartbeatSeconds ?? unavailable
                }
                technical={runtime.heartbeatSeconds != null}
              />
              <Field
                label={t("adminSystemStatus.runtime.activeStaleSeconds")}
                value={
                  runtime.activeStaleSeconds ?? unavailable
                }
                technical={runtime.activeStaleSeconds != null}
              />
            </dl>
            <p className="admin-system-status__helper">
              {t("adminSystemStatus.runtime.helper")}
            </p>
          </section>

          <section className="admin-system-status__section admin-system-status__section--wide">
            <div className="admin-system-status__section-heading">
              <Cpu size={19} />
              <h2>{t("adminSystemStatus.sections.measurement")}</h2>
            </div>
            <p className="admin-system-status__history-warning">
              {t("adminSystemStatus.measurement.historicalWarning")}
            </p>
            <dl className="admin-system-status__fields admin-system-status__fields--measurement">
              <Field
                label={t("adminSystemStatus.measurement.observedAt")}
                value={formatTimestamp(measurement.observedAt)}
              />
              <Field
                label={t("adminSystemStatus.measurement.schemaVersion")}
                value={measurement.snapshotSchemaVersion ?? unavailable}
                technical={measurement.snapshotSchemaVersion != null}
              />
              <Field
                label={t("adminSystemStatus.measurement.cpuModel")}
                value={measurement.cpuModel ?? unavailable}
                technical={measurement.cpuModel != null}
              />
              <Field
                label={t("adminSystemStatus.measurement.architecture")}
                value={measurement.architecture ?? unavailable}
                technical={measurement.architecture != null}
              />
              <Field
                label={t("adminSystemStatus.measurement.logicalCpus")}
                value={measurement.logicalCpus ?? unavailable}
                technical={measurement.logicalCpus != null}
              />
              <Field
                label={t("adminSystemStatus.measurement.perfVersion")}
                value={measurement.perfVersion ?? unavailable}
                technical={measurement.perfVersion != null}
              />
              <Field
                label={t("adminSystemStatus.measurement.perfEventParanoid")}
                value={measurement.perfEventParanoid ?? unavailable}
                technical={measurement.perfEventParanoid != null}
              />
            </dl>
            <div className="admin-system-status__energy-grid">
              <EnergyCard
                label={t("adminSystemStatus.measurement.energyPackage")}
                signal={energy.package}
                t={t}
              />
              <EnergyCard
                label={t("adminSystemStatus.measurement.energyCores")}
                signal={energy.cores}
                t={t}
              />
              <EnergyCard
                label={t("adminSystemStatus.measurement.energyRam")}
                signal={energy.ram}
                t={t}
              />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
