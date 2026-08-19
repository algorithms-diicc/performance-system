import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import axios from "axios";
import {
  useNavigate,
  useParams,
} from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Ban,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileArchive,
  FileCode2,
  Files,
  Fingerprint,
  Gauge,
  GraduationCap,
  GitCompareArrows,
  Pencil,
  RefreshCw,
  Save,
  Server,
  Star,
  X,
  XCircle,
} from "lucide-react";

import { serverURL } from "../common/Constants";
import AcademicBreadcrumbs from "../components/AcademicBreadcrumbs";
import InlineState from "../components/InlineState";
import SourceViewerModal from "../components/SourceViewerModal";
import downloadAuthenticatedFile from "../utils/downloadAuthenticatedFile";
import {
  SUBMISSION_AGGREGATE_LABELS,
  abbreviateArchiveSha256,
  canOpenExecutionResult,
  deriveSubmissionAggregateState,
  executionDisplayName,
  formatAcademicPeriod,
  formatBenchmark,
  formatCourseLabel,
  formatExecutionDuration,
  formatSubmissionDateTime,
  sortSubmissionExecutions,
} from "./submissionOverviewModel";
import {
  buildComparisonPath,
  comparisonIneligibilityReason,
  getEligibleExecutions,
  initialComparisonSelection,
  isComparisonEligibleExecution,
  MAX_COMPARISON_EXECUTIONS,
  orderSelectedExecutions,
  toggleComparisonSelection,
} from "./comparisonModel";
import {
  buildReuseSearch,
} from "./RenderForm/reuse/executionReuseModel";

import "./SubmissionOverviewPage.css";

const EMPTY_PERMISSIONS = {
  canEditMetadata: false,
  canViewPrivateMetadata: false,
};

const stateClassName = (state) =>
  [
    "submission-overview__status-badge",
    `submission-overview__status-badge--${String(
      state || "UNKNOWN"
    ).toLowerCase()}`,
  ].join(" ");

const errorStateFromRequest = (error) => {
  const status = error?.response?.status;

  if (!error?.response) return "network";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  return "error";
};

const metadataErrorMessage = (error, fallback) => {
  const payload = error?.response?.data;

  return (
    payload?.message ||
    payload?.error?.message ||
    (typeof payload?.error === "string" ? payload.error : "") ||
    fallback
  );
};

const hasOwn = (value, key) =>
  Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);

const resultAvailabilityLabel = (execution) => {
  if (execution?.resultAvailable === true) return "Disponible";

  if (
    ["QUEUED", "RUNNING", "PROCESSING"].includes(
      execution?.state
    )
  ) {
    return "Pendiente";
  }

  return "No disponible";
};

const SummaryCard = ({ icon: Icon, label, value, tone = "default" }) => (
  <article
    className={`submission-overview__summary-card submission-overview__summary-card--${tone}`}
  >
    <div className="submission-overview__summary-icon">
      <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
    </div>
    <div>
      <span>{label}</span>
      <strong>{value || 0}</strong>
    </div>
  </article>
);

const InformationItem = ({ icon: Icon, label, children, className = "" }) => (
  <div
    className={[
      "submission-overview__information-item",
      className,
    ]
      .filter(Boolean)
      .join(" ")}
  >
    <div className="submission-overview__information-icon">
      <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
    </div>
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  </div>
);

const SubmissionOverviewPage = ({ currentUser }) => {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [summary, setSummary] = useState(null);
  const [permissions, setPermissions] = useState(EMPTY_PERMISSIONS);
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState(null);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [pinSaving, setPinSaving] = useState(false);
  const [metadataError, setMetadataError] = useState("");
  const [metadataFeedback, setMetadataFeedback] = useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [archiveContext, setArchiveContext] = useState({
    loading: false,
    trace: null,
    error: "",
  });
  const [archiveDownload, setArchiveDownload] = useState({
    loading: false,
    kind: "",
    message: "",
  });
  const [sourceViewer, setSourceViewer] = useState({
    open: false,
    codename: "",
  });
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonSelection, setComparisonSelection] = useState([]);
  const [comparisonFeedback, setComparisonFeedback] = useState("");

  const encodedSubmissionId = encodeURIComponent(
    String(submissionId || "")
  );
  const submissionEndpoint = `${serverURL}api/submissions/${encodedSubmissionId}`;

  const loadSubmission = useCallback(async () => {
    setLoading(true);
    setRequestError(null);
    setMetadataError("");
    setMetadataFeedback("");

    try {
      const [detailResponse, executionsResponse] = await Promise.all([
        axios.get(submissionEndpoint, {
          withCredentials: true,
        }),
        axios.get(`${submissionEndpoint}/executions`, {
          withCredentials: true,
          params: {
            page: 1,
            page_size: 200,
          },
        }),
      ]);

      const nextSubmission =
        detailResponse.data?.submission || null;

      setSubmission(nextSubmission);
      setSummary(detailResponse.data?.summary || {});
      setPermissions(
        detailResponse.data?.permissions || EMPTY_PERMISSIONS
      );
      setExecutions(
        Array.isArray(executionsResponse.data?.items)
          ? executionsResponse.data.items
          : []
      );
      setNoteDraft(
        typeof nextSubmission?.note === "string"
          ? nextSubmission.note
          : ""
      );
      setIsEditingNote(false);
      setCopyFeedback("");
      setComparisonMode(false);
      setComparisonSelection([]);
      setComparisonFeedback("");
    } catch (error) {
      console.error("Error cargando Submission overview:", error);
      setRequestError(error);
      setSubmission(null);
      setSummary(null);
      setPermissions(EMPTY_PERMISSIONS);
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  }, [submissionEndpoint]);

  useEffect(() => {
    loadSubmission();
  }, [loadSubmission]);

  const patchMetadata = useCallback(
    async (payload) => {
      const response = await axios.patch(
        submissionEndpoint,
        payload,
        { withCredentials: true }
      );

      setSubmission((current) => ({
        ...current,
        ...response.data,
      }));

      return response.data || {};
    },
    [submissionEndpoint]
  );

  const orderedExecutions = useMemo(
    () => sortSubmissionExecutions(executions),
    [executions]
  );

  const eligibleComparisonExecutions = useMemo(
    () => getEligibleExecutions(orderedExecutions),
    [orderedExecutions]
  );

  const aggregateState = useMemo(
    () => deriveSubmissionAggregateState(summary || {}),
    [summary]
  );

  const handleStartComparison = () => {
    if (eligibleComparisonExecutions.length < 2) return;

    setComparisonSelection(initialComparisonSelection(orderedExecutions));
    setComparisonFeedback("");
    setComparisonMode(true);
  };

  const handleCancelComparison = () => {
    setComparisonMode(false);
    setComparisonSelection([]);
    setComparisonFeedback("");
  };

  const handleToggleComparison = (execution) => {
    if (!isComparisonEligibleExecution(execution)) return;

    const codename = String(execution.codename).trim();
    const alreadySelected = comparisonSelection.includes(codename);

    if (
      !alreadySelected &&
      comparisonSelection.length >= MAX_COMPARISON_EXECUTIONS
    ) {
      setComparisonFeedback(
        "Puedes comparar como máximo cuatro implementaciones. Deselecciona una para habilitar otro cupo."
      );
      return;
    }

    setComparisonSelection((current) =>
      toggleComparisonSelection(current, codename)
    );
    setComparisonFeedback("");
  };

  const handleOpenComparison = () => {
    const orderedSelection = orderSelectedExecutions(
      orderedExecutions,
      comparisonSelection
    );

    if (orderedSelection.length < 2 || orderedSelection.length > 4) return;
    navigate(buildComparisonPath(orderedSelection));
  };

  useEffect(() => {
    const traceExecution = orderedExecutions.find(
      (execution) => String(execution?.codename || "").trim()
    );

    if (loading || !traceExecution?.codename) {
      setArchiveContext({ loading: false, trace: null, error: "" });
      return undefined;
    }

    let active = true;
    setArchiveContext({ loading: true, trace: null, error: "" });
    setArchiveDownload({ loading: false, kind: "", message: "" });

    axios
      .get(
        `${serverURL}api/executions/${encodeURIComponent(
          traceExecution.codename
        )}/trace`,
        { withCredentials: true }
      )
      .then((response) => {
        if (active) {
          setArchiveContext({
            loading: false,
            trace: response.data || null,
            error: "",
          });
        }
      })
      .catch(() => {
        if (active) {
          setArchiveContext({
            loading: false,
            trace: null,
            error: "No fue posible verificar la disponibilidad del archivo original.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [loading, orderedExecutions]);

  const handleEditNote = () => {
    setNoteDraft(
      typeof submission?.note === "string" ? submission.note : ""
    );
    setMetadataError("");
    setMetadataFeedback("");
    setIsEditingNote(true);
  };

  const handleCancelNote = () => {
    setNoteDraft(
      typeof submission?.note === "string" ? submission.note : ""
    );
    setMetadataError("");
    setIsEditingNote(false);
  };

  const handleSaveNote = async () => {
    if (!permissions.canEditMetadata || noteSaving) return;

    setNoteSaving(true);
    setMetadataError("");
    setMetadataFeedback("");

    try {
      const updated = await patchMetadata({ note: noteDraft });
      const normalizedNote = hasOwn(updated, "note")
        ? updated.note
        : submission?.note;

      setNoteDraft(
        typeof normalizedNote === "string" ? normalizedNote : ""
      );
      setIsEditingNote(false);
      setMetadataFeedback("Nota personal guardada.");
    } catch (error) {
      setMetadataError(
        metadataErrorMessage(
          error,
          "No fue posible guardar la nota. Revisa el contenido y vuelve a intentarlo."
        )
      );
    } finally {
      setNoteSaving(false);
    }
  };

  const handleTogglePinned = async () => {
    if (!permissions.canEditMetadata || pinSaving) return;

    const nextPinned = !Boolean(submission?.isPinned);
    setPinSaving(true);
    setMetadataError("");
    setMetadataFeedback("");

    try {
      await patchMetadata({ isPinned: nextPinned });
      setMetadataFeedback(
        nextPinned
          ? "Experimento marcado como referencia."
          : "Experimento removido de referencias."
      );
    } catch (error) {
      setMetadataError(
        metadataErrorMessage(
          error,
          "No fue posible actualizar la referencia. Vuelve a intentarlo."
        )
      );
    } finally {
      setPinSaving(false);
    }
  };

  const handleCopySha = async () => {
    const archiveSha256 = String(
      submission?.archiveSha256 || ""
    ).trim();

    if (!archiveSha256) return;

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API no disponible");
      }

      await navigator.clipboard.writeText(archiveSha256);
      setCopyFeedback("SHA copiado");
    } catch {
      setCopyFeedback("No se pudo copiar");
    }
  };

  const handleArchiveDownload = async () => {
    if (archiveDownload.loading) return;

    setArchiveDownload({ loading: true, kind: "", message: "" });
    try {
      await downloadAuthenticatedFile(
        `${submissionEndpoint}/archive`,
        submission?.originalFilename || `submission-${submission?.id}.zip`
      );
      setArchiveDownload({
        loading: false,
        kind: "success",
        message: "ZIP original descargado correctamente.",
      });
    } catch (error) {
      const status = error?.response?.status;
      let message = "No fue posible descargar el ZIP original.";

      if (!error?.response) {
        message = "No pudimos conectar para descargar el ZIP original.";
      } else if (status === 401 || status === 403) {
        message = "Tu sesión no permite descargar el ZIP original.";
      } else if ([404, 409, 422].includes(status)) {
        message = "El archivo original no está disponible.";
      }

      setArchiveDownload({
        loading: false,
        kind: "error",
        message,
      });
    }
  };

  if (loading) {
    return (
      <main className="submission-overview">
        <div className="submission-overview__container submission-overview__state-container">
          <InlineState
            type="loading"
            title="Cargando experimento"
            description="Consultando su metadata y el estado de las implementaciones."
          />
        </div>
      </main>
    );
  }

  if (requestError) {
    return (
      <main className="submission-overview">
        <div className="submission-overview__container submission-overview__state-container">
          <InlineState
            type={errorStateFromRequest(requestError)}
            title="No fue posible cargar el experimento"
            description="Revisa tu sesión o vuelve a intentar la consulta."
            actionLabel="Reintentar"
            onAction={loadSubmission}
          />
        </div>
      </main>
    );
  }

  if (!submission) {
    return (
      <main className="submission-overview">
        <div className="submission-overview__container submission-overview__state-container">
          <InlineState
            type="not-found"
            title="Experimento no disponible"
            description="No se encontró información para esta Submission."
          />
        </div>
      </main>
    );
  }

  const courseLabel = formatCourseLabel(submission.course);
  const academicPeriod = formatAcademicPeriod(submission.course);
  const createdAtLabel = formatSubmissionDateTime(
    submission.createdAt
  );
  const archiveSha256 = String(
    submission.archiveSha256 || ""
  ).trim();
  const showPrivateMetadata = Boolean(
    permissions.canViewPrivateMetadata ||
      permissions.canEditMetadata
  );
  const noteValue = hasOwn(submission, "note")
    ? String(submission.note || "").trim()
    : "";
  const isPinned = hasOwn(submission, "isPinned")
    ? Boolean(submission.isPinned)
    : false;
  const archiveTrace = archiveContext.trace;
  const canDownloadArchive = Boolean(
    archiveTrace?.permissions?.canDownloadArchive === true
  );
  const archiveAvailable = Boolean(
    archiveTrace?.submission?.archive?.available === true
  );

  return (
    <main className="submission-overview">
      <div className="submission-overview__container">
        <AcademicBreadcrumbs
          currentUser={currentUser}
          page="submission"
          submissionId={submission.id}
          course={submission.course}
          courseId={submission.courseId}
        />

        <header className="submission-overview__header">
          <div className="submission-overview__header-copy">
            <span className="submission-overview__eyebrow">
              Experimento #{submission.id}
            </span>
            <h1>{submission.title || "Experimento sin título"}</h1>
            <div className="submission-overview__header-metadata">
              <span>
                <GraduationCap
                  size={16}
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
                {courseLabel}
              </span>
              <span>
                <CalendarDays
                  size={16}
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
                {createdAtLabel}
              </span>
            </div>
            {academicPeriod && (
              <span className="submission-overview__period">
                {academicPeriod}
              </span>
            )}
          </div>

          <span className={stateClassName(aggregateState)}>
            {SUBMISSION_AGGREGATE_LABELS[aggregateState] ||
              aggregateState}
          </span>
        </header>

        <section
          className="submission-overview__card submission-overview__information"
          aria-labelledby="submission-information-title"
        >
          <div className="submission-overview__section-heading">
            <div>
              <span className="submission-overview__eyebrow">
                Procedencia
              </span>
              <h2 id="submission-information-title">
                Información del experimento
              </h2>
            </div>
            <FileArchive size={22} strokeWidth={1.8} aria-hidden="true" />
          </div>

          {archiveContext.loading && (
            <span className="submission-overview__archive-status" role="status">
              Verificando archivo original…
            </span>
          )}

          {canDownloadArchive && archiveAvailable && (
            <div className="submission-overview__archive-actions">
              <button
                type="button"
                className="submission-overview__button submission-overview__button--secondary"
                onClick={handleArchiveDownload}
                disabled={archiveDownload.loading}
              >
                <Download size={16} strokeWidth={2} aria-hidden="true" />
                {archiveDownload.loading
                  ? "Descargando…"
                  : "Descargar ZIP original"}
              </button>
            </div>
          )}

          {canDownloadArchive && !archiveAvailable && (
            <span className="submission-overview__archive-status">
              Archivo original no disponible
            </span>
          )}

          {archiveContext.error && permissions.canEditMetadata && (
            <span className="submission-overview__archive-status">
              {archiveContext.error}
            </span>
          )}

          {archiveDownload.message && (
            <div
              className={`submission-overview__archive-feedback submission-overview__archive-feedback--${archiveDownload.kind}`}
              role={archiveDownload.kind === "error" ? "alert" : "status"}
            >
              {archiveDownload.message}
            </div>
          )}

          <dl className="submission-overview__information-grid">
            <InformationItem icon={FileArchive} label="Archivo original">
              {submission.originalFilename || "No disponible"}
            </InformationItem>

            <InformationItem icon={CalendarDays} label="Creado">
              {createdAtLabel}
            </InformationItem>

            <InformationItem icon={GraduationCap} label="Curso">
              <span>{courseLabel}</span>
              {academicPeriod && <small>{academicPeriod}</small>}
            </InformationItem>

            <InformationItem
              icon={Fingerprint}
              label="SHA-256"
              className="submission-overview__information-item--sha"
            >
              <div className="submission-overview__sha">
                <code title={archiveSha256 || undefined}>
                  {abbreviateArchiveSha256(archiveSha256)}
                </code>
                {archiveSha256 && (
                  <button
                    type="button"
                    className="submission-overview__icon-action"
                    onClick={handleCopySha}
                    aria-label="Copiar SHA-256 completo"
                    title="Copiar SHA-256 completo"
                  >
                    <Copy size={16} strokeWidth={1.9} aria-hidden="true" />
                  </button>
                )}
                {copyFeedback && (
                  <span className="submission-overview__copy-feedback" role="status">
                    {copyFeedback}
                  </span>
                )}
              </div>
            </InformationItem>

            <InformationItem icon={Files} label="Implementaciones">
              {summary?.executionsCount || 0}
            </InformationItem>
          </dl>
        </section>

        {showPrivateMetadata && (
          <section
            className="submission-overview__card submission-overview__personal"
            aria-labelledby="submission-personal-title"
          >
            <div className="submission-overview__personal-heading">
              <div>
                <span className="submission-overview__eyebrow">
                  Solo tú
                </span>
                <h2 id="submission-personal-title">
                  Metadata personal
                </h2>
              </div>

              {permissions.canEditMetadata && (
                <button
                  type="button"
                  className={[
                    "submission-overview__reference-action",
                    isPinned
                      ? "submission-overview__reference-action--active"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={handleTogglePinned}
                  disabled={pinSaving}
                  aria-pressed={isPinned}
                >
                  <Star
                    size={17}
                    strokeWidth={1.9}
                    fill={isPinned ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                  {pinSaving
                    ? "Actualizando…"
                    : isPinned
                    ? "Referencia"
                    : "Marcar como referencia"}
                </button>
              )}
            </div>

            <div className="submission-overview__note">
              {isEditingNote && permissions.canEditMetadata ? (
                <>
                  <label htmlFor="submission-personal-note">
                    Nota personal
                  </label>
                  <textarea
                    id="submission-personal-note"
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    maxLength={500}
                    rows={5}
                    disabled={noteSaving}
                    aria-describedby="submission-note-count"
                  />
                  <div className="submission-overview__note-editor-footer">
                    <span id="submission-note-count">
                      {noteDraft.length}/500 caracteres
                    </span>
                    <div className="submission-overview__note-actions">
                      <button
                        type="button"
                        className="submission-overview__button submission-overview__button--ghost"
                        onClick={handleCancelNote}
                        disabled={noteSaving}
                      >
                        <X size={16} strokeWidth={2} aria-hidden="true" />
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="submission-overview__button submission-overview__button--primary"
                        onClick={handleSaveNote}
                        disabled={noteSaving}
                      >
                        <Save size={16} strokeWidth={2} aria-hidden="true" />
                        {noteSaving ? "Guardando…" : "Guardar"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="submission-overview__note-heading">
                    <h3>Nota personal</h3>
                    {permissions.canEditMetadata && (
                      <button
                        type="button"
                        className="submission-overview__text-action"
                        onClick={handleEditNote}
                      >
                        <Pencil size={15} strokeWidth={1.9} aria-hidden="true" />
                        Editar
                      </button>
                    )}
                  </div>
                  <p
                    className={
                      noteValue
                        ? "submission-overview__note-value"
                        : "submission-overview__note-empty"
                    }
                  >
                    {noteValue || "Sin nota personal"}
                  </p>
                </>
              )}
            </div>

            {metadataError && (
              <div
                className="submission-overview__metadata-feedback submission-overview__metadata-feedback--error"
                role="alert"
              >
                <AlertTriangle size={17} strokeWidth={2} aria-hidden="true" />
                {metadataError}
              </div>
            )}

            {metadataFeedback && !metadataError && (
              <div
                className="submission-overview__metadata-feedback submission-overview__metadata-feedback--success"
                role="status"
              >
                <CheckCircle2 size={17} strokeWidth={2} aria-hidden="true" />
                {metadataFeedback}
              </div>
            )}
          </section>
        )}

        <section
          className="submission-overview__summary-section"
          aria-labelledby="submission-summary-title"
        >
          <div className="submission-overview__section-heading submission-overview__section-heading--outside">
            <div>
              <span className="submission-overview__eyebrow">
                Estado agregado
              </span>
              <h2 id="submission-summary-title">Resumen</h2>
            </div>
          </div>

          <div className="submission-overview__summary-grid">
            <SummaryCard
              icon={Activity}
              label="Ejecuciones"
              value={summary?.executionsCount}
            />
            <SummaryCard
              icon={CheckCircle2}
              label="Completadas"
              value={summary?.completedExecutions}
              tone="success"
            />
            <SummaryCard
              icon={XCircle}
              label="Con error"
              value={summary?.failedExecutions}
              tone="danger"
            />
            <SummaryCard
              icon={Ban}
              label="Canceladas"
              value={summary?.cancelledExecutions}
              tone="neutral"
            />
          </div>
        </section>

        <section
          className="submission-overview__card submission-overview__implementations"
          aria-labelledby="submission-implementations-title"
        >
          <div className="submission-overview__implementations-heading">
            <div>
              <span className="submission-overview__eyebrow">
                Código fuente
              </span>
              <h2 id="submission-implementations-title">
                Implementaciones
              </h2>
              <p>
                Cada archivo C++ conserva su propia ejecución y resultados
                independientes.
              </p>
            </div>

            <div className="submission-overview__implementation-heading-actions">
              <button
                type="button"
                className="submission-overview__button submission-overview__button--secondary"
                onClick={loadSubmission}
              >
                <RefreshCw size={16} strokeWidth={2} aria-hidden="true" />
                Actualizar estados
              </button>
              {!comparisonMode && (
                <button
                  type="button"
                  className="submission-overview__button submission-overview__button--primary"
                  onClick={handleStartComparison}
                  disabled={eligibleComparisonExecutions.length < 2}
                >
                  <GitCompareArrows size={16} strokeWidth={2} aria-hidden="true" />
                  Comparar implementaciones
                </button>
              )}
            </div>
          </div>

          {eligibleComparisonExecutions.length < 2 &&
            orderedExecutions.length > 0 && (
              <p className="submission-overview__comparison-unavailable" role="status">
                Se necesitan al menos dos implementaciones completadas con resultados.
              </p>
            )}

          {comparisonMode && (
            <div
              className="submission-overview__comparison-panel"
              role="region"
              aria-label="Selección de implementaciones para comparar"
            >
              <div>
                <strong>Selecciona implementaciones comparables</strong>
                <p>
                  {eligibleComparisonExecutions.length > 4
                    ? "Selecciona entre 2 y 4 implementaciones."
                    : "Las implementaciones elegibles están preseleccionadas. Puedes ajustar la selección antes de continuar."}
                </p>
                {comparisonFeedback && (
                  <p className="submission-overview__comparison-feedback" role="status">
                    {comparisonFeedback}
                  </p>
                )}
              </div>
              <div className="submission-overview__comparison-actions">
                <button
                  type="button"
                  className="submission-overview__button submission-overview__button--primary"
                  onClick={handleOpenComparison}
                  disabled={comparisonSelection.length < 2}
                >
                  Comparar seleccionadas ({comparisonSelection.length})
                </button>
                <button
                  type="button"
                  className="submission-overview__button submission-overview__button--ghost"
                  onClick={handleCancelComparison}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {orderedExecutions.length === 0 ? (
            <InlineState
              type="empty"
              title="Sin ejecuciones"
              description="Este experimento todavía no registra implementaciones ejecutables."
            />
          ) : (
            <div className="submission-overview__execution-list">
              {orderedExecutions.map((execution) => {
                const failure = execution.failure;
                const displayName = executionDisplayName(execution);
                const canOpenResult = canOpenExecutionResult(execution);
                const comparisonEligible =
                  isComparisonEligibleExecution(execution);
                const comparisonSelected = comparisonSelection.includes(
                  String(execution.codename || "").trim()
                );
                const comparisonAtLimit =
                  comparisonSelection.length >= MAX_COMPARISON_EXECUTIONS;

                return (
                  <article
                    className={[
                      "submission-overview__execution",
                      comparisonMode && comparisonSelected
                        ? "submission-overview__execution--selected"
                        : "",
                      comparisonMode && !comparisonEligible
                        ? "submission-overview__execution--ineligible"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    key={
                      execution.executionId ||
                      execution.publicId ||
                      execution.codename
                    }
                  >
                    {comparisonMode && (
                      <div className="submission-overview__comparison-choice">
                        {comparisonEligible ? (
                          <label>
                            <input
                              type="checkbox"
                              checked={comparisonSelected}
                              disabled={comparisonAtLimit && !comparisonSelected}
                              onChange={() => handleToggleComparison(execution)}
                            />
                            Seleccionar {displayName}
                          </label>
                        ) : (
                          <span>
                            No participa: {comparisonIneligibilityReason(execution)}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="submission-overview__execution-main">
                      <div className="submission-overview__execution-title">
                        <div className="submission-overview__file-icon">
                          <FileCode2
                            size={21}
                            strokeWidth={1.8}
                            aria-hidden="true"
                          />
                        </div>
                        <div>
                          <span className="submission-overview__source-marker">
                            Fuente de esta ejecución
                          </span>
                          <h3>{displayName}</h3>
                          {execution.codename && (
                            <span className="submission-overview__codename">
                              ID técnico: <code>{execution.codename}</code>
                            </span>
                          )}
                        </div>
                      </div>

                      <span className={stateClassName(execution.state)}>
                        {execution.stateLabel ||
                          execution.statusLabel ||
                          execution.state ||
                          "Desconocido"}
                      </span>
                    </div>

                    <dl className="submission-overview__execution-metadata">
                      <div>
                        <Gauge size={17} strokeWidth={1.9} aria-hidden="true" />
                        <dt>Benchmark</dt>
                        <dd>{formatBenchmark(execution.benchmark)}</dd>
                      </div>
                      <div>
                        <Clock3 size={17} strokeWidth={1.9} aria-hidden="true" />
                        <dt>Duración</dt>
                        <dd>{formatExecutionDuration(execution.durationMs)}</dd>
                      </div>
                      <div>
                        <FileArchive size={17} strokeWidth={1.9} aria-hidden="true" />
                        <dt>Resultado</dt>
                        <dd
                          className={
                            execution.resultAvailable
                              ? "submission-overview__result-available"
                              : ""
                          }
                        >
                          {resultAvailabilityLabel(execution)}
                        </dd>
                      </div>
                      {execution.hardwareProfile && (
                        <div>
                          <Server size={17} strokeWidth={1.9} aria-hidden="true" />
                          <dt>Entorno</dt>
                          <dd>{execution.hardwareProfile}</dd>
                        </div>
                      )}
                    </dl>

                    {execution.state === "FAILED" && (
                      <div className="submission-overview__failure">
                        <AlertTriangle
                          size={20}
                          strokeWidth={1.9}
                          aria-hidden="true"
                        />
                        <div>
                          <strong>
                            La implementación no pudo completar el análisis.
                          </strong>
                          <p>
                            {failure?.message ||
                              "El servidor no entregó más detalle del fallo."}
                          </p>
                          {(failure?.stage || failure?.code) && (
                            <dl>
                              {failure?.stage && (
                                <div>
                                  <dt>Etapa</dt>
                                  <dd>{failure.stage}</dd>
                                </div>
                              )}
                              {failure?.code && (
                                <div>
                                  <dt>Código</dt>
                                  <dd>{failure.code}</dd>
                                </div>
                              )}
                            </dl>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="submission-overview__execution-footer">
                      <span>
                        {execution.publicId
                          ? `Registro ${execution.publicId}`
                          : `Execution #${execution.executionId || "—"}`}
                      </span>

                      <div className="submission-overview__execution-actions">
                        {execution.codename && (
                          <button
                            type="button"
                            className="submission-overview__button submission-overview__button--secondary"
                            onClick={() =>
                              setSourceViewer({
                                open: true,
                                codename: execution.codename,
                              })
                            }
                          >
                            <Eye size={16} strokeWidth={2} aria-hidden="true" />
                            Ver código
                          </button>
                        )}

                        {permissions.canEditMetadata &&
                          execution.publicId && (
                          <button
                            type="button"
                            className="submission-overview__button submission-overview__button--secondary"
                            onClick={() =>
                              navigate(
                                `/${buildReuseSearch(
                                  execution.publicId
                                )}`
                              )
                            }
                          >
                            <RefreshCw
                              size={16}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            Reutilizar configuración
                          </button>
                        )}

                        {canOpenResult && (
                          <button
                            type="button"
                            className="submission-overview__button submission-overview__button--primary"
                            onClick={() =>
                              navigate(
                                `/code/${encodeURIComponent(
                                  execution.codename
                                )}`
                              )
                            }
                          >
                            Ver resultado
                            <ExternalLink
                              size={16}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <SourceViewerModal
          open={sourceViewer.open}
          codename={sourceViewer.codename}
          onClose={() => setSourceViewer({ open: false, codename: "" })}
        />
      </div>
    </main>
  );
};

export default SubmissionOverviewPage;
