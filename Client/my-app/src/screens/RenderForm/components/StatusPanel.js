// src/screens/RenderForm/components/StatusPanel.js
import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  FileCheck2,
  LoaderCircle,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";

import { useI18n } from "../../../i18n";

const PROGRESS_STEP_IDS = [
  "accepted",
  "queued",
  "preparing",
  "running",
  "processing",
  "completed",
];

function StatusPanel({
  fileList,
  messages,
  executionFiles,
  isSubmitting,
  allDone,
  allTerminal,
  hasError,
  submissionError,
  firstErrorMessage,
  pollingRequestError,
  summary,
  isSubmitDisabled,
  onGoToResults,
  onReset,
  onPrepareNewAnalysis,
  onPrepareRetry,
  onRetryPolling,
}) {
  const { t } = useI18n();
  const [showTechnicalDetails, setShowTechnicalDetails] =
    useState(false);

  const hasExecution =
    Array.isArray(fileList) && fileList.length > 0;

  const hasCompletedResults =
    Array.isArray(executionFiles) &&
    executionFiles.some(
      (execution) => execution?.resultsReady === true
    );

  const mode = getPanelMode({
    hasExecution,
    isSubmitting,
    allDone,
    allTerminal,
    hasError,
    hasCompletedResults,
    submissionError,
    pollingRequestError,
  });

  const progressIndex = useMemo(
    () =>
      getAggregateProgressIndex({
        fileList,
        messages,
        executionFiles,
        isSubmitting,
        allDone,
      }),
    [
      fileList,
      messages,
      executionFiles,
      isSubmitting,
      allDone,
    ]
  );

  const friendlyError =
    pollingRequestError ||
    submissionError ||
    getFriendlyErrorMessage(
      firstErrorMessage,
      t
    );

  const shared = { summary, t };

  return (
    <aside
      className={`rf-status-panel rf-status-panel-${mode}`}
    >
      {mode === "ready" && (
        <ReadyPanel
          {...shared}
          isSubmitDisabled={isSubmitDisabled}
          onReset={onReset}
        />
      )}

      {mode === "submitting" && (
        <SubmittingPanel {...shared} />
      )}

      {mode === "running" && (
        <RunningPanel
          {...shared}
          progressIndex={progressIndex}
          messages={messages}
          showTechnicalDetails={showTechnicalDetails}
          onToggleTechnical={() =>
            setShowTechnicalDetails((prev) => !prev)
          }
          onPrepareNewAnalysis={onPrepareNewAnalysis}
        />
      )}

      {mode === "completed" && (
        <CompletedPanel
          {...shared}
          messages={messages}
          showTechnicalDetails={showTechnicalDetails}
          onToggleTechnical={() =>
            setShowTechnicalDetails((prev) => !prev)
          }
          onGoToResults={onGoToResults}
          onReset={onReset}
        />
      )}

      {mode === "partial" && (
        <PartialPanel
          {...shared}
          messages={messages}
          showTechnicalDetails={showTechnicalDetails}
          onToggleTechnical={() =>
            setShowTechnicalDetails((prev) => !prev)
          }
          onGoToResults={onGoToResults}
          onReset={onReset}
        />
      )}

      {mode === "error" && (
        <ErrorPanel
          {...shared}
          message={friendlyError}
          messages={messages}
          showTechnicalDetails={showTechnicalDetails}
          onToggleTechnical={() =>
            setShowTechnicalDetails((prev) => !prev)
          }
          onPrepareRetry={onPrepareRetry}
          retryRequestOnly={Boolean(pollingRequestError)}
          onRetryRequest={onRetryPolling}
        />
      )}
    </aside>
  );
}

function ReadyPanel({
  summary,
  isSubmitDisabled,
  onReset,
  t,
}) {
  const ready = !isSubmitDisabled;

  return (
    <>
      <PanelHeader
        kicker={t("renderForm.workflow.ready.kicker")}
        title={t("renderForm.workflow.ready.title")}
        description={t(
          "renderForm.workflow.ready.description"
        )}
        icon={<SlidersHorizontal size={20} />}
      />

      <SummaryList summary={summary} t={t} />

      <div
        className={`rf-readiness ${
          ready
            ? "rf-readiness-ready"
            : "rf-readiness-pending"
        }`}
      >
        <div className="rf-readiness-icon">
          {ready ? (
            <CheckCircle2 size={18} />
          ) : (
            <Clock3 size={18} />
          )}
        </div>

        <div>
          <strong>
            {ready
              ? t("renderForm.workflow.ready.readyTitle")
              : t("renderForm.workflow.ready.pendingTitle")}
          </strong>

          <p>
            {ready
              ? t("renderForm.workflow.ready.readyText")
              : t("renderForm.workflow.ready.pendingText")}
          </p>
        </div>
      </div>

      <div className="rf-status-actions">
        <button
          type="submit"
          className="submit-button"
          disabled={isSubmitDisabled}
        >
          <Play size={16} />
          {t("renderForm.workflow.ready.review")}
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={onReset}
        >
          <RotateCcw size={15} />
          {t("renderForm.workflow.ready.clear")}
        </button>
      </div>

      <p className="rf-status-hint">
        {t("renderForm.workflow.ready.hint")}
      </p>
    </>
  );
}

function SubmittingPanel({ summary, t }) {
  return (
    <>
      <PanelHeader
        kicker={t("renderForm.workflow.submitting.kicker")}
        title={t("renderForm.workflow.submitting.title")}
        description={t(
          "renderForm.workflow.submitting.description"
        )}
        icon={
          <LoaderCircle
            className="rf-spin"
            size={20}
          />
        }
      />

      <CompactExecutionSummary summary={summary} t={t} />

      <div className="rf-submitting-state">
        <LoaderCircle
          className="rf-spin"
          size={22}
        />

        <div>
          <strong>
            {t("renderForm.workflow.submitting.registering")}
          </strong>
          <p>{t("renderForm.workflow.submitting.hint")}</p>
        </div>
      </div>
    </>
  );
}

function RunningPanel({
  summary,
  progressIndex,
  messages,
  showTechnicalDetails,
  onToggleTechnical,
  onPrepareNewAnalysis,
  t,
}) {
  return (
    <>
      <PanelHeader
        kicker={t("renderForm.workflow.running.kicker")}
        title={t("renderForm.workflow.running.title")}
        description={t(
          "renderForm.workflow.running.description"
        )}
        icon={
          <Activity
            className="rf-status-pulse"
            size={20}
          />
        }
        chip={{
          label: t("renderForm.workflow.running.chip"),
          className:
            "status-chip status-chip-running",
        }}
      />

      <CompactExecutionSummary summary={summary} t={t} />

      <ProgressStepper
        progressIndex={progressIndex}
        t={t}
      />

      <TechnicalDetails
        messages={messages}
        open={showTechnicalDetails}
        onToggle={onToggleTechnical}
        t={t}
      />

      <div className="rf-status-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onPrepareNewAnalysis}
        >
          <Plus size={15} />
          {t("renderForm.workflow.running.prepareAnother")}
        </button>
      </div>

      <p className="rf-status-hint rf-status-hint-running">
        {t("renderForm.workflow.running.hint")}
      </p>

      <p className="rf-status-hint">
        {t("renderForm.workflow.running.prepareAnotherHint")}
      </p>
    </>
  );
}

function CompletedPanel({
  summary,
  messages,
  showTechnicalDetails,
  onToggleTechnical,
  onGoToResults,
  onReset,
  t,
}) {
  return (
    <>
      <PanelHeader
        kicker={t("renderForm.workflow.completed.kicker")}
        title={t("renderForm.workflow.completed.title")}
        description={t(
          "renderForm.workflow.completed.description"
        )}
        icon={<CheckCircle2 size={20} />}
        chip={{
          label: t("renderForm.workflow.completed.chip"),
          className: "status-chip status-chip-done",
        }}
      />

      <div className="rf-completion-callout">
        <CheckCircle2 size={22} />

        <div>
          <strong>
            {t(
              "renderForm.workflow.completed.calloutTitle"
            )}
          </strong>
          <p>
            {t(
              "renderForm.workflow.completed.calloutText"
            )}
          </p>
        </div>
      </div>

      <CompactExecutionSummary summary={summary} t={t} />

      <div className="rf-status-actions">
        <button
          type="button"
          className="submit-button"
          onClick={onGoToResults}
        >
          <BarChart3 size={17} />
          {t("renderForm.workflow.completed.viewResults")}
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={onReset}
        >
          <RotateCcw size={15} />
          {t("renderForm.workflow.completed.newAnalysis")}
        </button>
      </div>

      <TechnicalDetails
        messages={messages}
        open={showTechnicalDetails}
        onToggle={onToggleTechnical}
        t={t}
      />
    </>
  );
}

function PartialPanel({
  summary,
  messages,
  showTechnicalDetails,
  onToggleTechnical,
  onGoToResults,
  onReset,
  t,
}) {
  return (
    <>
      <PanelHeader
        kicker={t("renderForm.workflow.partial.kicker")}
        title={t("renderForm.workflow.partial.title")}
        description={t(
          "renderForm.workflow.partial.description"
        )}
        icon={<AlertTriangle size={20} />}
        chip={{
          label: t("renderForm.workflow.partial.chip"),
          className: "status-chip status-chip-error",
        }}
      />

      <div className="rf-error-callout">
        <AlertTriangle size={22} />

        <div>
          <strong>
            {t("renderForm.workflow.partial.calloutTitle")}
          </strong>
          <p>
            {t("renderForm.workflow.partial.calloutText")}
          </p>
        </div>
      </div>

      <CompactExecutionSummary summary={summary} t={t} />

      <div className="rf-status-actions">
        <button
          type="button"
          className="submit-button"
          onClick={onGoToResults}
        >
          <BarChart3 size={17} />
          {t("renderForm.workflow.partial.viewResults")}
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={onReset}
        >
          <RotateCcw size={15} />
          {t("renderForm.workflow.partial.newAnalysis")}
        </button>
      </div>

      <TechnicalDetails
        messages={messages}
        open={showTechnicalDetails}
        onToggle={onToggleTechnical}
        t={t}
      />
    </>
  );
}

function ErrorPanel({
  summary,
  message,
  messages,
  showTechnicalDetails,
  onToggleTechnical,
  onPrepareRetry,
  retryRequestOnly,
  onRetryRequest,
  t,
}) {
  return (
    <>
      <PanelHeader
        kicker={t("renderForm.workflow.error.kicker")}
        title={t("renderForm.workflow.error.title")}
        description={t(
          "renderForm.workflow.error.description"
        )}
        icon={<AlertTriangle size={20} />}
        chip={{
          label: t("renderForm.workflow.error.chip"),
          className: "status-chip status-chip-error",
        }}
      />

      <div className="rf-error-callout">
        <AlertTriangle size={22} />

        <div>
          <strong>
            {t("renderForm.workflow.error.calloutTitle")}
          </strong>
          <p>{message}</p>
        </div>
      </div>

      <CompactExecutionSummary summary={summary} t={t} />

      <div className="rf-status-actions">
        <button
          type="button"
          className="submit-button"
          onClick={
            retryRequestOnly
              ? onRetryRequest
              : onPrepareRetry
          }
        >
          {retryRequestOnly ? (
            <RotateCcw size={16} />
          ) : (
            <Settings2 size={16} />
          )}
          {retryRequestOnly
            ? t("renderForm.workflow.error.retryRequest")
            : t("renderForm.workflow.error.reviewRetry")}
        </button>
      </div>

      <TechnicalDetails
        messages={messages}
        open={showTechnicalDetails}
        onToggle={onToggleTechnical}
        t={t}
      />
    </>
  );
}

function PanelHeader({
  kicker,
  title,
  description,
  icon,
  chip,
}) {
  return (
    <header className="rf-status-header">
      <div className="rf-status-heading-row">
        <div className="rf-status-heading-icon">
          {icon}
        </div>

        <div className="rf-status-heading-copy">
          <span className="rf-step-kicker">
            {kicker}
          </span>

          <h2 className="rf-status-title">
            {title}
          </h2>
        </div>
      </div>

      <p className="rf-status-description">
        {description}
      </p>

      {chip && (
        <span className={chip.className}>
          {chip.label}
        </span>
      )}
    </header>
  );
}

function SummaryList({ summary, t }) {
  const rows = [
    {
      label: t("renderForm.workflow.summary.code"),
      value:
        summary?.fileName ||
        t("renderForm.workflow.summary.selectFile"),
      muted: !summary?.fileName,
    },
    {
      label: t("renderForm.workflow.summary.benchmark"),
      value:
        summary?.taskTitle ||
        t("renderForm.workflow.summary.selectBenchmark"),
      muted: !summary?.taskTitle,
    },
    {
      label: t("renderForm.workflow.summary.maxSize"),
      value: summary?.inputSizeLabel || "—",
    },
    {
      label: t("renderForm.workflow.summary.repetitions"),
      value: summary?.samplesLabel || "—",
    },
    {
      label: t("renderForm.workflow.summary.profile"),
      value: summary?.profileLabel || "—",
    },
    {
      label: t("renderForm.workflow.summary.environment"),
      value: summary?.environmentLabel || "—",
    },
  ];

  if (
    summary?.dataTypeLabel &&
    summary.dataTypeLabel !==
      t("renderForm.benchmark.notApplicable")
  ) {
    rows.splice(2, 0, {
      label: t("renderForm.workflow.summary.data"),
      value: summary.dataTypeLabel,
    });
  }

  return (
    <dl className="rf-live-summary">
      {rows.map((row) => (
        <div
          className="rf-live-summary-row"
          key={row.label}
        >
          <dt>{row.label}</dt>
          <dd
            className={
              row.muted
                ? "rf-live-summary-muted"
                : ""
            }
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function CompactExecutionSummary({ summary, t }) {
  return (
    <div className="rf-execution-compact">
      <div className="rf-execution-compact-icon">
        <FileCheck2 size={18} />
      </div>

      <div className="rf-execution-compact-copy">
        <strong>
          {summary?.fileName ||
            t("renderForm.workflow.summary.sentCode")}
        </strong>

        <span>
          {[
            summary?.taskTitle,
            summary?.inputSizeLabel,
            summary?.samplesLabel,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
    </div>
  );
}

function ProgressStepper({ progressIndex, t }) {
  return (
    <div className="rf-progress-stepper">
      {PROGRESS_STEP_IDS.map((stepId, index) => {
        const state =
          index < progressIndex
            ? "done"
            : index === progressIndex
            ? "active"
            : "pending";

        return (
          <div
            key={stepId}
            className={`rf-progress-step rf-progress-step-${state}`}
          >
            <div className="rf-progress-marker">
              {state === "done" && (
                <Check size={14} strokeWidth={2.4} />
              )}

              {state === "active" && (
                <LoaderCircle
                  className="rf-spin"
                  size={14}
                  strokeWidth={2.2}
                />
              )}

              {state === "pending" && (
                <Circle size={12} strokeWidth={1.8} />
              )}
            </div>

            <div className="rf-progress-copy">
              <strong>
                {t(
                  `renderForm.workflow.progress.${stepId}.label`
                )}
              </strong>
              <span>
                {t(
                  `renderForm.workflow.progress.${stepId}.description`
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TechnicalDetails({
  messages,
  open,
  onToggle,
  t,
}) {
  const hasMessages =
    Array.isArray(messages) &&
    messages.some(
      (group) =>
        Array.isArray(group.messages) &&
        group.messages.length > 0
    );

  return (
    <div className="rf-technical-details">
      <button
        type="button"
        className="rf-technical-toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>
          {t("renderForm.workflow.technical.title")}
          {hasMessages
            ? ""
            : t(
                "renderForm.workflow.technical.noMessagesYet"
              )}
        </span>

        <ChevronDown
          size={16}
          className={
            open
              ? "rf-technical-chevron-open"
              : ""
          }
        />
      </button>

      {open && (
        <div className="rf-technical-body">
          {hasMessages ? (
            messages.map((group) => (
              <div
                key={group.codename}
                className="rf-technical-group"
              >
                <strong>
                  {group.originalName || group.codename}
                </strong>

                <ul>
                  {(group.messages || []).map(
                    (entry, index) => {
                      const classification =
                        classifyTechnicalMessage(
                          entry?.msg || ""
                        );

                      return (
                        <li
                          key={
                            entry?.time ||
                            `${group.codename}-${index}`
                          }
                          className={`rf-technical-entry rf-technical-entry-${classification}`}
                        >
                          <span className="rf-technical-time">
                            {entry?.time
                              ? `[${entry.time}]`
                              : ""}
                          </span>

                          <span>
                            {entry?.msg ||
                              t(
                                "renderForm.workflow.technical.messageWithoutContent"
                              )}
                          </span>
                        </li>
                      );
                    }
                  )}
                </ul>
              </div>
            ))
          ) : (
            <p className="rf-technical-empty">
              {t("renderForm.workflow.technical.empty")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function getPanelMode({
  hasExecution,
  isSubmitting,
  allDone,
  allTerminal,
  hasError,
  hasCompletedResults,
  submissionError,
  pollingRequestError,
}) {
  if (submissionError || pollingRequestError) {
    return "error";
  }

  if (!hasExecution && isSubmitting) {
    return "submitting";
  }

  if (!hasExecution) {
    return "ready";
  }

  if (allDone) {
    return "completed";
  }

  if (
    allTerminal &&
    hasError &&
    hasCompletedResults
  ) {
    return "partial";
  }

  if (allTerminal && hasError) {
    return "error";
  }

  return "running";
}

function getAggregateProgressIndex({
  fileList,
  messages,
  executionFiles,
  isSubmitting,
  allDone,
}) {
  if (allDone) {
    return PROGRESS_STEP_IDS.length - 1;
  }

  if (
    !Array.isArray(fileList) ||
    fileList.length === 0
  ) {
    return isSubmitting ? 0 : 0;
  }

  const groups =
    Array.isArray(messages) ? messages : [];

  const files =
    Array.isArray(executionFiles)
      ? executionFiles
      : [];

  const indexes = fileList.map((code) => {
    const group = groups.find(
      (item) => item.codename === code
    );

    const file = files.find(
      (item) => item.codename === code
    );

    return getFileProgressIndex({
      group,
      file,
    });
  });

  return Math.min(...indexes);
}

function getFileProgressIndex({ group, file }) {
  if (file?.resultsReady) {
    return 5;
  }

  const status = String(
    file?.status || group?.status || ""
  ).toUpperCase();

  const text = (group?.messages || [])
    .map((entry) => entry?.msg || "")
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    status === "DONE" ||
    text.includes("procesando resultado") ||
    text.includes("procesando metrica") ||
    text.includes("generando resultado") ||
    text.includes("resultado csv") ||
    text.includes("csv guardado") ||
    text.includes("grafico")
  ) {
    return 4;
  }

  if (
    text.includes("enviando test al slave") ||
    text.includes("ejecutando test") ||
    text.includes("ejecutando benchmark") ||
    text.includes("ejecutando script")
  ) {
    return 3;
  }

  if (
    text.includes("archivo recibido correctamente") ||
    text.includes("preparando") ||
    text.includes("compilando")
  ) {
    return 2;
  }

  if (
    status.includes("QUEUE") ||
    text.includes("cola")
  ) {
    return 1;
  }

  return 0;
}

function getFriendlyErrorMessage(rawMessage, t) {
  const text = String(rawMessage || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!text) {
    return t("renderForm.workflow.friendlyErrors.default");
  }

  if (
    text.includes("compilacion") ||
    text.includes("compilation")
  ) {
    return t(
      "renderForm.workflow.friendlyErrors.compilation"
    );
  }

  if (
    text.includes("timeout") ||
    text.includes("tiempo limite")
  ) {
    return t("renderForm.workflow.friendlyErrors.timeout");
  }

  if (
    text.includes("no se genero") ||
    text.includes("did not generate") ||
    text.includes("resultados") ||
    text.includes("results")
  ) {
    return t("renderForm.workflow.friendlyErrors.results");
  }

  return t("renderForm.workflow.friendlyErrors.server");
}

function classifyTechnicalMessage(text) {
  const value = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    value.includes("resultados listos") ||
    value.includes("compilacion exitosa") ||
    value.includes("recibido correctamente")
  ) {
    return "success";
  }

  if (
    value.includes("timeout") ||
    value.includes("tiempo limite") ||
    value.includes("error de compilacion") ||
    value.includes("error en ejecucion") ||
    value.includes("error ejecucion") ||
    value.includes("no se genero") ||
    value.includes("no se pudo") ||
    value.includes("fallo inesperado") ||
    value.includes("❌")
  ) {
    return "error";
  }

  if (
    value.includes("warning") ||
    value.includes("aviso") ||
    value.includes("⚠")
  ) {
    return "warning";
  }

  return "info";
}

export default StatusPanel;
