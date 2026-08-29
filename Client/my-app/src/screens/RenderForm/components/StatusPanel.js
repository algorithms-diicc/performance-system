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
  "running",
  "processing",
  "completed",
];

const TECHNICAL_EVENT_ICONS = {
  accepted: FileCheck2,
  queued: Clock3,
  running: Activity,
  processing: Settings2,
  completed: CheckCircle2,
  failed: AlertTriangle,
  cancelled: Circle,
};

const EXECUTION_STATE_ICONS = {
  QUEUED: Clock3,
  RUNNING: Activity,
  PROCESSING: Settings2,
  COMPLETED: CheckCircle2,
  FAILED: AlertTriangle,
  CANCELLED: Circle,
};

function StatusPanel({
  fileList,
  messages,
  executionFiles,
  isSubmitting,
  allDone,
  allTerminal,
  hasError,
  hasFailure,
  hasCancelled,
  submissionError,
  firstErrorMessage,
  pollingRequestError,
  summary,
  isSubmitDisabled,
  requirements = [],
  onGoToResults,
  onReset,
  onPrepareNewAnalysis,
  onPrepareRetry,
  onRetryPolling,
  cancellationState = {},
  onCancelExecution,
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

  const failurePresent =
    hasFailure === true || hasError === true;

  const mode = getPanelMode({
    hasExecution,
    isSubmitting,
    allDone,
    allTerminal,
    hasFailure: failurePresent,
    hasCancelled,
    hasCompletedResults,
    submissionError,
    pollingRequestError,
  });

  const progressIndex = useMemo(
    () =>
      getSingleExecutionProgressIndex({
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
          requirements={requirements}
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
          executionFiles={executionFiles}
          showTechnicalDetails={showTechnicalDetails}
          onToggleTechnical={() =>
            setShowTechnicalDetails((prev) => !prev)
          }
          onPrepareNewAnalysis={onPrepareNewAnalysis}
          cancellationState={cancellationState}
          onCancelExecution={onCancelExecution}
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
          executionFiles={executionFiles}
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
          executionFiles={executionFiles}
          hasFailure={failurePresent}
        />
      )}

      {mode === "cancelled" && (
        <CancelledPanel
          {...shared}
          messages={messages}
          executionFiles={executionFiles}
          showTechnicalDetails={showTechnicalDetails}
          onToggleTechnical={() =>
            setShowTechnicalDetails((prev) => !prev)
          }
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
          executionFiles={executionFiles}
        />
      )}
    </aside>
  );
}

function ReadyPanel({
  summary,
  isSubmitDisabled,
  requirements,
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

          {!ready && requirements.length > 0 && (
            <ul className="rf-readiness-requirements">
              {requirements.map((requirement) => (
                <li key={requirement}>
                  {t(
                    `renderForm.workflow.ready.requirements.${requirement}`
                  )}
                </li>
              ))}
            </ul>
          )}
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
  executionFiles,
  showTechnicalDetails,
  onToggleTechnical,
  onPrepareNewAnalysis,
  cancellationState,
  onCancelExecution,
  t,
}) {
  const multipleExecutions =
    Array.isArray(executionFiles) && executionFiles.length >= 2;

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

      {multipleExecutions ? (
        <ExecutionStatusList
          executionFiles={executionFiles}
          cancellationState={cancellationState}
          onCancelExecution={onCancelExecution}
          t={t}
        />
      ) : (
        <>
          <QueuePositions executionFiles={executionFiles} t={t} />

          <ProgressStepper
            progressIndex={progressIndex}
            t={t}
          />

          <SingleExecutionCancellation
            executionFiles={executionFiles}
            cancellationState={cancellationState}
            onCancelExecution={onCancelExecution}
            t={t}
          />
        </>
      )}

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
  executionFiles,
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

      <TerminalExecutionStatusList
        executionFiles={executionFiles}
        t={t}
      />

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
  executionFiles,
  hasFailure,
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
          hasFailure
            ? "renderForm.workflow.partial.description"
            : "renderForm.workflow.partial.cancelledDescription"
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
            {t(
              hasFailure
                ? "renderForm.workflow.partial.calloutTitle"
                : "renderForm.workflow.partial.cancelledCalloutTitle"
            )}
          </strong>
          <p>
            {t(
              hasFailure
                ? "renderForm.workflow.partial.calloutText"
                : "renderForm.workflow.partial.cancelledCalloutText"
            )}
          </p>
        </div>
      </div>

      <CompactExecutionSummary summary={summary} t={t} />

      <TerminalExecutionStatusList
        executionFiles={executionFiles}
        t={t}
      />

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

function CancelledPanel({
  summary,
  messages,
  executionFiles,
  showTechnicalDetails,
  onToggleTechnical,
  onReset,
  t,
}) {
  return (
    <>
      <PanelHeader
        kicker={t("renderForm.workflow.cancelled.kicker")}
        title={t("renderForm.workflow.cancelled.title")}
        description={t(
          "renderForm.workflow.cancelled.description"
        )}
        icon={<Circle size={20} />}
        chip={{
          label: t("renderForm.workflow.cancelled.chip"),
          className: "status-chip",
        }}
      />

      <CompactExecutionSummary summary={summary} t={t} />

      <TerminalExecutionStatusList
        executionFiles={executionFiles}
        t={t}
      />

      <div className="rf-status-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onReset}
        >
          <RotateCcw size={15} />
          {t("renderForm.workflow.cancelled.newAnalysis")}
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
  executionFiles,
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

      <TerminalExecutionStatusList
        executionFiles={executionFiles}
        t={t}
      />

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

function QueuePositions({ executionFiles, t }) {
  const queued = Array.isArray(executionFiles)
    ? executionFiles.filter(
        (execution) =>
          execution?.state === "QUEUED" &&
          (Number.isInteger(execution?.queuePosition) ||
            (Number.isInteger(execution?.queueAhead) &&
              execution.queueAhead >= 0))
      )
    : [];

  if (queued.length === 0) return null;

  return (
    <section
      className="rf-queue-positions"
      aria-label={t("renderForm.workflow.queue.title")}
    >
      <div className="rf-queue-heading">
        <Clock3 size={17} aria-hidden="true" />
        <strong>{t("renderForm.workflow.queue.title")}</strong>
      </div>

      <ul>
        {queued.map((execution) => (
          <li key={execution.publicId || execution.codename}>
            <span>
              {execution.originalName || execution.codename}
            </span>
            <strong>
              {queuePositionText(execution, t)}
            </strong>
          </li>
        ))}
      </ul>

      <p>{t("renderForm.workflow.queue.explanation")}</p>
    </section>
  );
}

function executionStateKey(state) {
  const normalized = String(state || "").toUpperCase();
  const keys = {
    QUEUED: "queued",
    RUNNING: "running",
    PROCESSING: "processing",
    COMPLETED: "completed",
    FAILED: "failed",
    CANCELLED: "cancelled",
  };

  return `renderForm.workflow.executionStates.${
    keys[normalized] || "unknown"
  }`;
}

function queuePositionText(execution, t) {
  if (String(execution?.state || "").toUpperCase() !== "QUEUED") {
    return "";
  }

  const explicitPosition = Number(execution?.queuePosition);
  const queueAhead = Number(execution?.queueAhead);
  const position =
    Number.isInteger(explicitPosition) && explicitPosition >= 1
      ? explicitPosition
      : Number.isInteger(queueAhead) && queueAhead >= 0
      ? queueAhead + 1
      : null;

  if (position === 1) {
    return t("renderForm.workflow.executionQueue.next");
  }

  if (position && position > 1) {
    return t("renderForm.workflow.executionQueue.position", {
      position,
    });
  }

  return "";
}

function ExecutionCancelAction({
  execution,
  cancellationState,
  onCancelExecution,
  t,
}) {
  const publicId = execution?.publicId;
  const state = String(execution?.state || "").toUpperCase();
  const request = publicId
    ? cancellationState?.[publicId] || {}
    : {};
  const canCancel = Boolean(
    publicId &&
      state === "QUEUED" &&
      execution?.canCancel === true &&
      typeof onCancelExecution === "function"
  );

  if (!canCancel && !request.messageKey) {
    return null;
  }

  const name = execution?.originalName || execution?.codename || "";

  return (
    <div className="rf-execution-cancellation">
      {canCancel && (
        <button
          type="button"
          className="secondary-button rf-execution-cancel-button"
          disabled={request.pending === true}
          onClick={() => onCancelExecution(execution)}
          aria-label={t(
            "renderForm.workflow.cancellation.actionFor",
            { name }
          )}
        >
          {request.pending === true
            ? t("renderForm.workflow.cancellation.pending")
            : t("renderForm.workflow.cancellation.action")}
        </button>
      )}

      {request.messageKey && (
        <span className="rf-execution-cancel-feedback" role="alert">
          {t(request.messageKey)}
        </span>
      )}
    </div>
  );
}

const EXECUTION_PROGRESS_STATES = [
  "QUEUED",
  "RUNNING",
  "PROCESSING",
  "COMPLETED",
];


function ExecutionMiniStepper({
  state,
  name,
  t,
}) {
  const normalized = String(state || "").toUpperCase();
  const currentIndex =
    EXECUTION_PROGRESS_STATES.indexOf(normalized);

  if (currentIndex < 0) {
    return (
      <strong>{t(executionStateKey(normalized))}</strong>
    );
  }

  return (
    <ol
      className={`rf-execution-mini-progress rf-execution-mini-progress-${normalized.toLowerCase()}`}
      aria-label={t(
        "renderForm.workflow.executionList.progressAria",
        { name }
      )}
    >
      {EXECUTION_PROGRESS_STATES.map(
        (stepState, index) => {
          const stepKind =
            index < currentIndex
              ? "done"
              : index === currentIndex
              ? "active"
              : "pending";

          return (
            <li
              key={stepState}
              className={`rf-execution-mini-step rf-execution-mini-step-${stepKind}`}
              aria-current={
                stepKind === "active"
                  ? "step"
                  : undefined
              }
            >
              <span
                className="rf-execution-mini-marker"
                aria-hidden="true"
              />
              <span className="rf-execution-mini-label">
                {t(executionStateKey(stepState))}
              </span>
            </li>
          );
        }
      )}
    </ol>
  );
}


function ExecutionStatusList({
  executionFiles,
  cancellationState = {},
  onCancelExecution,
  t,
}) {
  if (!Array.isArray(executionFiles) || executionFiles.length === 0) {
    return null;
  }

  return (
    <section
      className="rf-execution-status-list"
      aria-label={t("renderForm.workflow.executionList.title")}
    >
      <strong className="rf-execution-status-list-title">
        {t("renderForm.workflow.executionList.title")}
      </strong>

      <ul>
        {executionFiles.map((execution) => {
          const state = String(execution?.state || "").toUpperCase();
          const StateIcon = EXECUTION_STATE_ICONS[state] || Circle;
          const queueText = queuePositionText(execution, t);

          return (
            <li
              key={execution.publicId || execution.codename}
              className={`rf-execution-status-row rf-execution-status-row-${
                state.toLowerCase() || "unknown"
              }`}
            >
              <StateIcon size={16} aria-hidden="true" />

              <div className="rf-execution-status-main">
                <span
                  className="rf-execution-status-name"
                  title={
                    execution.originalName ||
                    execution.codename
                  }
                >
                  {execution.originalName || execution.codename}
                </span>

                {(execution.measurementNode?.displayName ||
                  execution.hardwareProfile) && (
                  <span className="rf-execution-provenance">
                    {execution.measurementNode?.displayName && (
                      <span>
                        {t(
                          "renderForm.workflow.executionList.node",
                          {
                            node:
                              execution.measurementNode
                                .displayName,
                          }
                        )}
                      </span>
                    )}

                    {execution.hardwareProfile && (
                      <span>
                        {t(
                          "renderForm.workflow.executionList.registeredProfile",
                          {
                            profile:
                              execution.hardwareProfile,
                          }
                        )}
                      </span>
                    )}
                  </span>
                )}
              </div>

              <span className="rf-execution-status-value">
                <ExecutionMiniStepper
                  state={state}
                  name={
                    execution.originalName ||
                    execution.codename
                  }
                  t={t}
                />
                {queueText && <small>{queueText}</small>}
              </span>

              <ExecutionCancelAction
                execution={execution}
                cancellationState={cancellationState}
                onCancelExecution={onCancelExecution}
                t={t}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SingleExecutionCancellation(props) {
  const execution = Array.isArray(props.executionFiles)
    ? props.executionFiles[0]
    : null;

  if (!execution) return null;

  return (
    <div className="rf-single-execution-cancellation">
      <ExecutionCancelAction
        execution={execution}
        cancellationState={props.cancellationState}
        onCancelExecution={props.onCancelExecution}
        t={props.t}
      />
    </div>
  );
}

function TerminalExecutionStatusList({ executionFiles, t }) {
  if (!Array.isArray(executionFiles) || executionFiles.length < 2) {
    return null;
  }

  return (
    <ExecutionStatusList
      executionFiles={executionFiles}
      t={t}
    />
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
                        classifyTechnicalEvent(entry);
                      const EventIcon =
                        TECHNICAL_EVENT_ICONS[entry?.key];
                      const eventText =
                        resolveTechnicalEventText(entry, t);

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

                          <span className="rf-technical-message">
                            {EventIcon && (
                              <EventIcon size={13} aria-hidden="true" />
                            )}
                            {eventText}
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
  hasFailure,
  hasCancelled,
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
    (hasFailure || hasCancelled) &&
    hasCompletedResults
  ) {
    return "partial";
  }

  if (allTerminal && hasFailure) {
    return "error";
  }

  if (allTerminal && hasCancelled) {
    return "cancelled";
  }

  return "running";
}

function getSingleExecutionProgressIndex({
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
    fileList.length !== 1
  ) {
    return isSubmitting ? 0 : 0;
  }

  const groups =
    Array.isArray(messages) ? messages : [];

  const files =
    Array.isArray(executionFiles)
      ? executionFiles
      : [];

  const code = fileList[0];
  const group = groups.find(
    (item) => item.codename === code
  );
  const file = files.find(
    (item) => item.codename === code
  );

  return getFileProgressIndex({ group, file });
}

function getFileProgressIndex({ group, file }) {
  if (file?.resultsReady) {
    return 4;
  }

  const status = String(
    file?.state || file?.status || group?.state || group?.status || ""
  ).toUpperCase();

  const eventKeys = new Set(
    (group?.messages || [])
      .map((entry) => entry?.key)
      .filter(Boolean)
  );

  if (
    status === "COMPLETED"
  ) {
    return 4;
  }

  if (
    status === "DONE" ||
    status === "PROCESSING" ||
    eventKeys.has("processing")
  ) {
    return 3;
  }

  if (
    status === "RUNNING" ||
    eventKeys.has("running")
  ) {
    return 2;
  }

  if (
    status.includes("QUEUE") ||
    eventKeys.has("queued")
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

function resolveTechnicalEventText(entry, t) {
  const key = String(entry?.key || "").trim();

  if (!key) {
    return (
      entry?.msg ||
      t("renderForm.workflow.technical.messageWithoutContent")
    );
  }

  if (key === "failed" && entry?.message) {
    return t("renderForm.workflow.events.failedWithMessage", {
      message: entry.message,
    });
  }

  const translationKey = `renderForm.workflow.events.${key}`;
  const translated = t(translationKey);

  return translated === translationKey
    ? t("renderForm.workflow.technical.messageWithoutContent")
    : translated;
}

function classifyTechnicalEvent(entry) {
  if (entry?.key === "completed") return "success";
  if (entry?.key === "failed") return "error";
  if (entry?.key === "cancelled") return "cancelled";
  return "info";
}

export default StatusPanel;
