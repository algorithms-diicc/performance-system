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
  RotateCcw,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";

const PROGRESS_STEPS = [
  {
    id: "accepted",
    label: "Solicitud registrada",
    description: "El servidor recibió la solicitud del análisis.",
  },
  {
    id: "queued",
    label: "En cola",
    description: "El código espera su turno de ejecución.",
  },
  {
    id: "preparing",
    label: "Preparando ejecución",
    description: "Se prepara el código y el entorno de medición.",
  },
  {
    id: "running",
    label: "Ejecutando mediciones",
    description: "El benchmark está realizando las mediciones.",
  },
  {
    id: "processing",
    label: "Procesando resultados",
    description: "Se consolidan las métricas obtenidas.",
  },
  {
    id: "completed",
    label: "Resultados disponibles",
    description: "El análisis ya puede ser consultado.",
  },
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
  onPrepareRetry,
  onRetryPolling,
}) {
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
    getFriendlyErrorMessage(
      submissionError || firstErrorMessage
    );

  return (
    <aside
      className={`rf-status-panel rf-status-panel-${mode}`}
    >
      {mode === "ready" && (
        <ReadyPanel
          summary={summary}
          isSubmitDisabled={isSubmitDisabled}
          onReset={onReset}
        />
      )}

      {mode === "submitting" && (
        <SubmittingPanel summary={summary} />
      )}

      {mode === "running" && (
        <RunningPanel
          summary={summary}
          progressIndex={progressIndex}
          messages={messages}
          showTechnicalDetails={showTechnicalDetails}
          onToggleTechnical={() =>
            setShowTechnicalDetails((prev) => !prev)
          }
        />
      )}

      {mode === "completed" && (
        <CompletedPanel
          summary={summary}
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
          summary={summary}
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
          summary={summary}
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
}) {
  const ready = !isSubmitDisabled;

  return (
    <>
      <PanelHeader
        kicker="Resumen"
        title="Resumen del experimento"
        description="Comprueba la configuración principal antes de iniciar el análisis."
        icon={<SlidersHorizontal size={20} />}
      />

      <SummaryList summary={summary} />

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
              ? "Configuración lista"
              : "Configuración pendiente"}
          </strong>

          <p>
            {ready
              ? "Puedes revisar el resumen detallado y confirmar la ejecución."
              : "Completa los campos obligatorios para habilitar la ejecución."}
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
          Revisar y ejecutar
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={onReset}
        >
          <RotateCcw size={15} />
          Limpiar configuración
        </button>
      </div>

      <p className="rf-status-hint">
        Antes de enviar el código verás el overview detallado
        para confirmar los parámetros.
      </p>
    </>
  );
}

function SubmittingPanel({ summary }) {
  return (
    <>
      <PanelHeader
        kicker="Iniciando"
        title="Enviando análisis"
        description="Estamos registrando el experimento en el servidor."
        icon={
          <LoaderCircle
            className="rf-spin"
            size={20}
          />
        }
      />

      <CompactExecutionSummary summary={summary} />

      <div className="rf-submitting-state">
        <LoaderCircle
          className="rf-spin"
          size={22}
        />

        <div>
          <strong>Registrando solicitud</strong>
          <p>
            Este paso suele tardar solo unos segundos.
          </p>
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
}) {
  return (
    <>
      <PanelHeader
        kicker="En ejecución"
        title="Analizando tu código"
        description="El experimento está avanzando por las distintas etapas de medición."
        icon={
          <Activity
            className="rf-status-pulse"
            size={20}
          />
        }
        chip={{
          label: "En curso",
          className:
            "status-chip status-chip-running",
        }}
      />

      <CompactExecutionSummary summary={summary} />

      <ProgressStepper
        progressIndex={progressIndex}
      />

      <TechnicalDetails
        messages={messages}
        open={showTechnicalDetails}
        onToggle={onToggleTechnical}
      />

      <p className="rf-status-hint rf-status-hint-running">
        Puedes mantener esta vista abierta mientras se ejecuta
        el benchmark. La recuperación después de recargar la
        página se implementará en la fase de persistencia.
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
}) {
  return (
    <>
      <PanelHeader
        kicker="Completado"
        title="Análisis completado"
        description="Las mediciones fueron procesadas correctamente."
        icon={<CheckCircle2 size={20} />}
        chip={{
          label: "Resultados listos",
          className:
            "status-chip status-chip-done",
        }}
      />

      <div className="rf-completion-callout">
        <CheckCircle2 size={22} />

        <div>
          <strong>Resultados disponibles</strong>
          <p>
            Ya puedes revisar las métricas y visualizaciones
            generadas para este experimento.
          </p>
        </div>
      </div>

      <CompactExecutionSummary summary={summary} />

      <div className="rf-status-actions">
        <button
          type="button"
          className="submit-button"
          onClick={onGoToResults}
        >
          <BarChart3 size={17} />
          Ver resultados
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={onReset}
        >
          <RotateCcw size={15} />
          Nuevo análisis
        </button>
      </div>

      <TechnicalDetails
        messages={messages}
        open={showTechnicalDetails}
        onToggle={onToggleTechnical}
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
}) {
  return (
    <>
      <PanelHeader
        kicker="Parcial"
        title="Análisis parcialmente completado"
        description="Algunas implementaciones terminaron correctamente y otras requieren revisión."
        icon={<AlertTriangle size={20} />}
        chip={{
          label: "Resultados parciales",
          className:
            "status-chip status-chip-error",
        }}
      />

      <div className="rf-error-callout">
        <AlertTriangle size={22} />

        <div>
          <strong>Hay resultados disponibles</strong>
          <p>
            Puedes revisar las ejecuciones completadas sin repetir
            las que ya finalizaron correctamente. El experimento
            mostrará también qué implementación falló.
          </p>
        </div>
      </div>

      <CompactExecutionSummary summary={summary} />

      <div className="rf-status-actions">
        <button
          type="button"
          className="submit-button"
          onClick={onGoToResults}
        >
          <BarChart3 size={17} />
          Ver resultados disponibles
        </button>

        <button
          type="button"
          className="secondary-button"
          onClick={onReset}
        >
          <RotateCcw size={15} />
          Nuevo análisis
        </button>
      </div>

      <TechnicalDetails
        messages={messages}
        open={showTechnicalDetails}
        onToggle={onToggleTechnical}
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
}) {
  return (
    <>
      <PanelHeader
        kicker="Incidencia"
        title="No se pudo completar"
        description="La ejecución terminó con un problema que requiere revisión."
        icon={<AlertTriangle size={20} />}
        chip={{
          label: "Requiere revisión",
          className:
            "status-chip status-chip-error",
        }}
      />

      <div className="rf-error-callout">
        <AlertTriangle size={22} />

        <div>
          <strong>El análisis no finalizó correctamente</strong>
          <p>{message}</p>
        </div>
      </div>

      <CompactExecutionSummary summary={summary} />

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
            ? "Reintentar consulta"
            : "Revisar y volver a intentar"}
        </button>
      </div>

      <TechnicalDetails
        messages={messages}
        open={showTechnicalDetails}
        onToggle={onToggleTechnical}
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

function SummaryList({ summary }) {
  const rows = [
    {
      label: "Código",
      value:
        summary?.fileName ||
        "Selecciona un archivo .zip",
      muted: !summary?.fileName,
    },
    {
      label: "Benchmark",
      value:
        summary?.taskTitle ||
        "Selecciona un benchmark",
      muted: !summary?.taskTitle,
    },
    {
      label: "Tamaño máximo",
      value:
        summary?.inputSizeLabel || "—",
    },
    {
      label: "Repeticiones",
      value:
        summary?.samplesLabel || "—",
    },
    {
      label: "Perfil",
      value:
        summary?.profileLabel || "—",
    },
    {
      label: "Entorno",
      value:
        summary?.environmentLabel || "—",
    },
  ];

  if (
    summary?.dataTypeLabel &&
    summary.dataTypeLabel !== "No aplica"
  ) {
    rows.splice(2, 0, {
      label: "Datos",
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

function CompactExecutionSummary({ summary }) {
  return (
    <div className="rf-execution-compact">
      <div className="rf-execution-compact-icon">
        <FileCheck2 size={18} />
      </div>

      <div className="rf-execution-compact-copy">
        <strong>
          {summary?.fileName || "Código enviado"}
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

function ProgressStepper({ progressIndex }) {
  return (
    <div className="rf-progress-stepper">
      {PROGRESS_STEPS.map((step, index) => {
        const state =
          index < progressIndex
            ? "done"
            : index === progressIndex
            ? "active"
            : "pending";

        return (
          <div
            key={step.id}
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
              <strong>{step.label}</strong>
              <span>{step.description}</span>
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
          Detalles técnicos
          {hasMessages ? "" : " (sin mensajes aún)"}
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
                  {group.originalName ||
                    group.codename}
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
                              "Mensaje sin contenido"}
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
              El servidor todavía no ha publicado
              mensajes adicionales.
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
    return PROGRESS_STEPS.length - 1;
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

  /**
   * Para ZIP con varios .cpp mostramos la etapa del archivo
   * menos avanzado. Así el panel no aparenta que toda la tanda
   * terminó cuando todavía queda un archivo en cola.
   */
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

function getFriendlyErrorMessage(rawMessage) {
  const text = String(rawMessage || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!text) {
    return (
      "Revisa el código y la configuración del experimento. " +
      "Los detalles técnicos pueden aportar información adicional."
    );
  }

  if (
    text.includes("compilacion") ||
    text.includes("compilation")
  ) {
    return (
      "El código no pudo compilarse correctamente. " +
      "Revisa los errores del compilador antes de volver a ejecutar."
    );
  }

  if (
    text.includes("timeout") ||
    text.includes("tiempo limite")
  ) {
    return (
      "La ejecución superó el tiempo máximo permitido. " +
      "Revisa el algoritmo o utiliza una configuración de entrada menor."
    );
  }

  if (
    text.includes("no se genero") ||
    text.includes("resultados")
  ) {
    return (
      "La ejecución terminó sin generar los resultados esperados. " +
      "Revisa los detalles técnicos antes de intentar nuevamente."
    );
  }

  return (
    "El servidor informó un problema durante la ejecución. " +
    "Revisa los detalles técnicos y corrige el código o la configuración."
  );
}

function classifyTechnicalMessage(text) {
  const t = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    t.includes("resultados listos") ||
    t.includes("compilacion exitosa") ||
    t.includes("recibido correctamente")
  ) {
    return "success";
  }

  if (
    t.includes("timeout") ||
    t.includes("tiempo limite") ||
    t.includes("error de compilacion") ||
    t.includes("error en ejecucion") ||
    t.includes("error ejecucion") ||
    t.includes("no se genero") ||
    t.includes("no se pudo") ||
    t.includes("fallo inesperado") ||
    t.includes("❌")
  ) {
    return "error";
  }

  if (
    t.includes("warning") ||
    t.includes("aviso") ||
    t.includes("⚠")
  ) {
    return "warning";
  }

  return "info";
}

export default StatusPanel;
