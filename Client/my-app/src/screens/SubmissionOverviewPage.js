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
  History,
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
import { useI18n } from "../i18n";
import downloadAuthenticatedFile from "../utils/downloadAuthenticatedFile";
import {
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
import {
  buildRepeatSearch,
} from "./RenderForm/repeat/submissionRepeatModel";

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

const metadataErrorState = (error, key) => {
  const payload = error?.response?.data;
  const rawText =
    payload?.message ||
    payload?.error?.message ||
    (typeof payload?.error === "string"
      ? payload.error
      : "");

  return {
    key,
    rawText: String(rawText || "").trim(),
  };
};

const localizedStoredMessage = (
  value,
  language,
  t
) => {
  if (!value) return "";

  if (typeof value === "string") {
    return t(value);
  }

  const localized = t(
    value.key,
    value.params || {}
  );

  return language === "es" && value.rawText
    ? value.rawText
    : localized;
};

const hasOwn = (value, key) =>
  Boolean(value) &&
  Object.prototype.hasOwnProperty.call(
    value,
    key
  );

const resultAvailabilityKey = (execution) => {
  if (execution?.resultAvailable === true) {
    return "submissionOverview.results.available";
  }

  if (
    ["QUEUED", "RUNNING", "PROCESSING"].includes(
      String(execution?.state || "").toUpperCase()
    )
  ) {
    return "submissionOverview.results.pending";
  }

  return "submissionOverview.results.unavailable";
};

const executionStateKey = (state) => {
  const normalized = String(state || "")
    .trim()
    .toUpperCase();

  const keys = {
    QUEUED: "submissionOverview.executionStates.queued",
    RUNNING: "submissionOverview.executionStates.running",
    PROCESSING:
      "submissionOverview.executionStates.processing",
    COMPLETED:
      "submissionOverview.executionStates.completed",
    FAILED: "submissionOverview.executionStates.failed",
    CANCELLED:
      "submissionOverview.executionStates.cancelled",
  };

  return (
    keys[normalized] ||
    "submissionOverview.executionStates.unknown"
  );
};

const aggregateStateKey = (state) => {
  const normalized = String(state || "")
    .trim()
    .toUpperCase();

  const keys = {
    IN_PROGRESS:
      "submissionOverview.aggregateStates.inProgress",
    COMPLETED:
      "submissionOverview.aggregateStates.completed",
    PARTIAL:
      "submissionOverview.aggregateStates.partial",
    FAILED:
      "submissionOverview.aggregateStates.failed",
    CANCELLED:
      "submissionOverview.aggregateStates.cancelled",
    EMPTY:
      "submissionOverview.aggregateStates.empty",
  };

  return (
    keys[normalized] ||
    "submissionOverview.aggregateStates.unknown"
  );
};

const referenceStatusKey = (status) => {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  return [
    "compatible",
    "limited",
    "incompatible",
    "unavailable",
  ].includes(normalized)
    ? `comparisonModel.historicalStatuses.${normalized}`
    : "comparisonModel.historicalStatuses.unavailable";
};

const comparisonIneligibilityKey = (
  execution
) => {
  const state = String(execution?.state || "")
    .trim()
    .toUpperCase();

  if (state !== "COMPLETED") {
    if (state === "FAILED") {
      return "submissionOverview.comparison.reasons.failed";
    }
    if (
      ["QUEUED", "RUNNING", "PROCESSING"].includes(
        state
      )
    ) {
      return "submissionOverview.comparison.reasons.inProgress";
    }
    return "submissionOverview.comparison.reasons.notCompleted";
  }

  if (execution?.resultAvailable !== true) {
    return "submissionOverview.comparison.reasons.noResults";
  }

  if (!String(execution?.codename || "").trim()) {
    return "submissionOverview.comparison.reasons.invalidId";
  }

  return "";
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
  const { language, locale, t } = useI18n();

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
  const [metadataError, setMetadataError] = useState(null);
  const [metadataFeedback, setMetadataFeedback] =
    useState("");
  const [copyFeedback, setCopyFeedback] = useState("");
  const [archiveContext, setArchiveContext] = useState({
    loading: false,
    trace: null,
    errorKey: "",
  });
  const [archiveDownload, setArchiveDownload] = useState({
    loading: false,
    kind: "",
    messageKey: "",
  });
  const [sourceViewer, setSourceViewer] = useState({
    open: false,
    codename: "",
  });
  const [comparisonMode, setComparisonMode] = useState(false);
  const [comparisonSelection, setComparisonSelection] = useState([]);
  const [comparisonFeedback, setComparisonFeedback] = useState("");
  const [referenceState, setReferenceState] = useState({
    open: false,
    execution: null,
    kind: "idle",
    items: [],
    errorKey: "",
  });
  const [previousState, setPreviousState] = useState({
    codename: "",
    kind: "idle",
    messageKey: "",
  });

  const encodedSubmissionId = encodeURIComponent(
    String(submissionId || "")
  );
  const submissionEndpoint = `${serverURL}api/submissions/${encodedSubmissionId}`;

  const loadSubmission = useCallback(async () => {
    setLoading(true);
    setRequestError(null);
    setMetadataError(null);
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
      setReferenceState({
        open: false,
        execution: null,
        kind: "idle",
        items: [],
        errorKey: "",
      });
      setPreviousState({
        codename: "",
        kind: "idle",
        messageKey: "",
      });
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
        "submissionOverview.comparison.maxFeedback"
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

  const handleOpenReferenceCandidates = async (execution) => {
    const codename = String(execution?.codename || "").trim();
    if (!codename || !permissions.canEditMetadata) return;

    setReferenceState({
      open: true,
      execution,
      kind: "loading",
      items: [],
      errorKey: "",
    });

    try {
      const response = await axios.post(
        `${serverURL}api/comparisons/reference-candidates`,
        { execution: codename },
        { withCredentials: true }
      );

      setReferenceState({
        open: true,
        execution,
        kind: "success",
        items: Array.isArray(response.data?.items)
          ? response.data.items
          : [],
        errorKey: "",
      });
    } catch (error) {
      setReferenceState({
        open: true,
        execution,
        kind: "error",
        items: [],
        errorKey:
          error?.response?.status === 403
            ? "submissionOverview.reference.errors.forbidden"
            : "submissionOverview.reference.errors.load",
      });
    }
  };

  const handlePreviousCompatible = async (execution) => {
    const codename = String(execution?.codename || "").trim();
    if (!codename || previousState.kind === "loading") return;

    setPreviousState({
      codename,
      kind: "loading",
      messageKey: "",
    });

    try {
      const response = await axios.post(
        `${serverURL}api/comparisons/previous-compatible`,
        { execution: codename },
        { withCredentials: true }
      );
      const candidate = response.data?.candidate || null;
      const candidateCodename = String(
        candidate?.codename || ""
      ).trim();

      if (candidateCodename && candidate?.selectable === true) {
        setPreviousState({
          codename: "",
          kind: "idle",
          messageKey: "",
        });
        navigate(
          buildComparisonPath([codename, candidateCodename])
        );
        return;
      }

      setPreviousState({
        codename,
        kind: "empty",
        messageKey: "submissionOverview.previous.none",
      });
    } catch {
      setPreviousState({
        codename,
        kind: "error",
        messageKey: "submissionOverview.previous.error",
      });
    }
  };

  useEffect(() => {
    const traceExecution = orderedExecutions.find(
      (execution) => String(execution?.codename || "").trim()
    );

    if (loading || !traceExecution?.codename) {
      setArchiveContext({ loading: false, trace: null, errorKey: "" });
      return undefined;
    }

    let active = true;
    setArchiveContext({ loading: true, trace: null, errorKey: "" });
    setArchiveDownload({ loading: false, kind: "", messageKey: "" });

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
            errorKey: "",
          });
        }
      })
      .catch(() => {
        if (active) {
          setArchiveContext({
            loading: false,
            trace: null,
            errorKey:
              "submissionOverview.archive.verifyError",
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
    setMetadataError(null);
    setMetadataFeedback("");
    setIsEditingNote(true);
  };

  const handleCancelNote = () => {
    setNoteDraft(
      typeof submission?.note === "string" ? submission.note : ""
    );
    setMetadataError(null);
    setIsEditingNote(false);
  };

  const handleSaveNote = async () => {
    if (!permissions.canEditMetadata || noteSaving) return;

    setNoteSaving(true);
    setMetadataError(null);
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
      setMetadataFeedback(
        "submissionOverview.feedback.noteSaved"
      );
    } catch (error) {
      setMetadataError(
        metadataErrorState(
          error,
          "submissionOverview.errors.noteSave"
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
    setMetadataError(null);
    setMetadataFeedback("");

    try {
      await patchMetadata({ isPinned: nextPinned });
      setMetadataFeedback(
        nextPinned
          ? "submissionOverview.feedback.pinned"
          : "submissionOverview.feedback.unpinned"
      );
    } catch (error) {
      setMetadataError(
        metadataErrorState(
          error,
          "submissionOverview.errors.referenceUpdate"
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
      setCopyFeedback(
        "submissionOverview.feedback.shaCopied"
      );
    } catch {
      setCopyFeedback(
        "submissionOverview.feedback.shaCopyFailed"
      );
    }
  };

  const handleArchiveDownload = async () => {
    if (archiveDownload.loading) return;

    setArchiveDownload({
      loading: true,
      kind: "",
      messageKey: "",
    });

    try {
      await downloadAuthenticatedFile(
        `${submissionEndpoint}/archive`,
        submission?.originalFilename ||
          `submission-${submission?.id}.zip`
      );

      setArchiveDownload({
        loading: false,
        kind: "success",
        messageKey:
          "submissionOverview.archive.downloadSuccess",
      });
    } catch (error) {
      const status = error?.response?.status;
      let messageKey =
        "submissionOverview.archive.downloadError";

      if (!error?.response) {
        messageKey =
          "submissionOverview.archive.downloadNetwork";
      } else if (
        status === 401 ||
        status === 403
      ) {
        messageKey =
          "submissionOverview.archive.downloadSession";
      } else if (
        [404, 409, 422].includes(status)
      ) {
        messageKey =
          "submissionOverview.archive.unavailable";
      }

      setArchiveDownload({
        loading: false,
        kind: "error",
        messageKey,
      });
    }
  };

  if (loading) {
    return (
      <main className="submission-overview">
        <div className="submission-overview__container submission-overview__state-container">
          <InlineState
            type="loading"
            title={t(
              "submissionOverview.states.loadingTitle"
            )}
            description={t(
              "submissionOverview.states.loadingDescription"
            )}
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
            title={t(
              "submissionOverview.states.errorTitle"
            )}
            description={t(
              "submissionOverview.states.errorDescription"
            )}
            actionLabel={t(
              "submissionOverview.actions.retry"
            )}
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
            title={t(
              "submissionOverview.states.notFoundTitle"
            )}
            description={t(
              "submissionOverview.states.notFoundDescription"
            )}
          />
        </div>
      </main>
    );
  }

  const courseLabel = formatCourseLabel(
    submission.course,
    t("submissionOverview.fallbacks.noCourse")
  );
  const academicPeriod = formatAcademicPeriod(
    submission.course,
    {
      periodLabel: t(
        "submissionOverview.labels.period"
      ),
    }
  );
  const createdAtLabel = formatSubmissionDateTime(
    submission.createdAt,
    locale,
    t("submissionOverview.fallbacks.unavailable")
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
    archiveTrace?.submission?.archive?.available ===
      true
  );
  const metadataErrorText =
    localizedStoredMessage(
      metadataError,
      language,
      t
    );
  const metadataFeedbackText =
    metadataFeedback
      ? t(metadataFeedback)
      : "";
  const copyFeedbackText = copyFeedback
    ? t(copyFeedback)
    : "";
  const archiveDownloadMessage =
    archiveDownload.messageKey
      ? t(archiveDownload.messageKey)
      : "";
  const comparisonFeedbackText =
    comparisonFeedback
      ? t(comparisonFeedback)
      : "";

  return (
    <main className="submission-overview">
      <div className="submission-overview__container">
        <AcademicBreadcrumbs
          currentUser={currentUser}
          page="submission"
          submissionId={submission.id}
          course={submission.course}
          courseId={submission.courseId}
          isOwner={permissions.canViewPrivateMetadata === true}
        />

        <header className="submission-overview__header">
          <div className="submission-overview__header-copy">
            <span className="submission-overview__eyebrow">
              {t(
                "submissionOverview.header.experimentNumber",
                { id: submission.id }
              )}
            </span>
            <h1>
              {submission.title ||
                t(
                  "submissionOverview.fallbacks.untitledExperiment"
                )}
            </h1>
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
            {t(aggregateStateKey(aggregateState))}
          </span>
        </header>

        <section
          className="submission-overview__card submission-overview__information"
          aria-labelledby="submission-information-title"
        >
          <div className="submission-overview__section-heading">
            <div>
              <span className="submission-overview__eyebrow">
                {t(
                  "submissionOverview.information.eyebrow"
                )}
              </span>
              <h2 id="submission-information-title">
                {t(
                  "submissionOverview.information.title"
                )}
              </h2>
            </div>
            <FileArchive size={22} strokeWidth={1.8} aria-hidden="true" />
          </div>

          {archiveContext.loading && (
            <span
              className="submission-overview__archive-status"
              role="status"
            >
              {t(
                "submissionOverview.archive.verifying"
              )}
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
                  ? t(
                      "submissionOverview.archive.downloading"
                    )
                  : t(
                      "submissionOverview.archive.downloadAction"
                    )}
              </button>
              <button
                type="button"
                className="submission-overview__button submission-overview__button--primary"
                onClick={() =>
                  navigate(
                    `/${buildRepeatSearch(submission.id)}`
                  )
                }
              >
                <RefreshCw size={16} strokeWidth={2} aria-hidden="true" />
                {t("submissionOverview.actions.repeatExperiment")}
              </button>
            </div>
          )}

          {canDownloadArchive && !archiveAvailable && (
            <span className="submission-overview__archive-status">
              {t(
                "submissionOverview.archive.unavailable"
              )}
            </span>
          )}

          {archiveContext.errorKey &&
            permissions.canEditMetadata && (
              <span className="submission-overview__archive-status">
                {t(archiveContext.errorKey)}
              </span>
            )}

          {archiveDownloadMessage && (
            <div
              className={`submission-overview__archive-feedback submission-overview__archive-feedback--${archiveDownload.kind}`}
              role={
                archiveDownload.kind === "error"
                  ? "alert"
                  : "status"
              }
            >
              {archiveDownloadMessage}
            </div>
          )}

          <dl className="submission-overview__information-grid">
            <InformationItem
              icon={FileArchive}
              label={t(
                "submissionOverview.labels.originalArchive"
              )}
            >
              {submission.originalFilename ||
                t(
                  "submissionOverview.fallbacks.unavailable"
                )}
            </InformationItem>

            <InformationItem
              icon={CalendarDays}
              label={t(
                "submissionOverview.labels.created"
              )}
            >
              {createdAtLabel}
            </InformationItem>

            <InformationItem
              icon={GraduationCap}
              label={t(
                "submissionOverview.labels.course"
              )}
            >
              <span>{courseLabel}</span>
              {academicPeriod && (
                <small>{academicPeriod}</small>
              )}
            </InformationItem>

            <InformationItem
              icon={Fingerprint}
              label="SHA-256"
              className="submission-overview__information-item--sha"
            >
              <div className="submission-overview__sha">
                <code title={archiveSha256 || undefined}>
                  {abbreviateArchiveSha256(
                    archiveSha256,
                    t(
                      "submissionOverview.fallbacks.unavailable"
                    )
                  )}
                </code>
                {archiveSha256 && (
                  <button
                    type="button"
                    className="submission-overview__icon-action"
                    onClick={handleCopySha}
                    aria-label={t(
                      "submissionOverview.actions.copySha"
                    )}
                    title={t(
                      "submissionOverview.actions.copySha"
                    )}
                  >
                    <Copy size={16} strokeWidth={1.9} aria-hidden="true" />
                  </button>
                )}
                {copyFeedbackText && (
                  <span
                    className="submission-overview__copy-feedback"
                    role="status"
                  >
                    {copyFeedbackText}
                  </span>
                )}
              </div>
            </InformationItem>

            <InformationItem
              icon={Files}
              label={t(
                "submissionOverview.labels.implementations"
              )}
            >
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
                  {t(
                    "submissionOverview.personal.eyebrow"
                  )}
                </span>
                <h2 id="submission-personal-title">
                  {t(
                    "submissionOverview.personal.title"
                  )}
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
                    ? t(
                        "submissionOverview.personal.updating"
                      )
                    : isPinned
                    ? t(
                        "submissionOverview.personal.reference"
                      )
                    : t(
                        "submissionOverview.personal.markReference"
                      )}
                </button>
              )}
            </div>

            <div className="submission-overview__note">
              {isEditingNote && permissions.canEditMetadata ? (
                <>
                  <label htmlFor="submission-personal-note">
                    {t(
                      "submissionOverview.personal.note"
                    )}
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
                      {t(
                        "submissionOverview.personal.characters",
                        {
                          count: noteDraft.length,
                          max: 500,
                        }
                      )}
                    </span>
                    <div className="submission-overview__note-actions">
                      <button
                        type="button"
                        className="submission-overview__button submission-overview__button--ghost"
                        onClick={handleCancelNote}
                        disabled={noteSaving}
                      >
                        <X
                          size={16}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        {t(
                          "submissionOverview.actions.cancel"
                        )}
                      </button>
                      <button
                        type="button"
                        className="submission-overview__button submission-overview__button--primary"
                        onClick={handleSaveNote}
                        disabled={noteSaving}
                      >
                        <Save
                          size={16}
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                        {noteSaving
                          ? t(
                              "submissionOverview.personal.saving"
                            )
                          : t(
                              "submissionOverview.actions.save"
                            )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="submission-overview__note-heading">
                    <h3>
                      {t(
                        "submissionOverview.personal.note"
                      )}
                    </h3>
                    {permissions.canEditMetadata && (
                      <button
                        type="button"
                        className="submission-overview__text-action"
                        onClick={handleEditNote}
                      >
                        <Pencil
                          size={15}
                          strokeWidth={1.9}
                          aria-hidden="true"
                        />
                        {t(
                          "submissionOverview.actions.edit"
                        )}
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
                    {noteValue ||
                      t(
                        "submissionOverview.personal.noNote"
                      )}
                  </p>
                </>
              )}
            </div>

            {metadataErrorText && (
              <div
                className="submission-overview__metadata-feedback submission-overview__metadata-feedback--error"
                role="alert"
              >
                <AlertTriangle
                  size={17}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {metadataErrorText}
              </div>
            )}

            {metadataFeedbackText &&
              !metadataErrorText && (
                <div
                  className="submission-overview__metadata-feedback submission-overview__metadata-feedback--success"
                  role="status"
                >
                  <CheckCircle2
                    size={17}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {metadataFeedbackText}
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
                {t(
                  "submissionOverview.summary.eyebrow"
                )}
              </span>
              <h2 id="submission-summary-title">
                {t(
                  "submissionOverview.summary.title"
                )}
              </h2>
            </div>
          </div>

          <div className="submission-overview__summary-grid">
            <SummaryCard
              icon={Activity}
              label={t(
                "submissionOverview.summary.executions"
              )}
              value={summary?.executionsCount}
            />
            <SummaryCard
              icon={CheckCircle2}
              label={t(
                "submissionOverview.summary.completed"
              )}
              value={summary?.completedExecutions}
              tone="success"
            />
            <SummaryCard
              icon={XCircle}
              label={t(
                "submissionOverview.summary.failed"
              )}
              value={summary?.failedExecutions}
              tone="danger"
            />
            <SummaryCard
              icon={Ban}
              label={t(
                "submissionOverview.summary.cancelled"
              )}
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
                {t(
                  "submissionOverview.implementations.eyebrow"
                )}
              </span>
              <h2 id="submission-implementations-title">
                {t(
                  "submissionOverview.implementations.title"
                )}
              </h2>
              <p>
                {t(
                  "submissionOverview.implementations.description"
                )}
              </p>
              <p className="submission-overview__hierarchy-note">
                {t(
                  "submissionOverview.implementations.hierarchy"
                )}
              </p>
            </div>

            <div className="submission-overview__implementation-heading-actions">
              <button
                type="button"
                className="submission-overview__button submission-overview__button--secondary"
                onClick={loadSubmission}
              >
                <RefreshCw
                  size={16}
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {t(
                  "submissionOverview.actions.refreshStates"
                )}
              </button>
              {!comparisonMode && (
                <button
                  type="button"
                  className="submission-overview__button submission-overview__button--primary"
                  onClick={handleStartComparison}
                  disabled={eligibleComparisonExecutions.length < 2}
                >
                  <GitCompareArrows
                    size={16}
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  {t(
                    "submissionOverview.actions.compareImplementations"
                  )}
                </button>
              )}
            </div>
          </div>

          {eligibleComparisonExecutions.length < 2 &&
            orderedExecutions.length > 0 && (
              <p
                className="submission-overview__comparison-unavailable"
                role="status"
              >
                {t(
                  "submissionOverview.comparison.needTwo"
                )}
              </p>
            )}

          {comparisonMode && (
            <div
              className="submission-overview__comparison-panel"
              role="region"
              aria-label={t(
                "submissionOverview.comparison.regionAria"
              )}
            >
              <div>
                <strong>
                  {t(
                    "submissionOverview.comparison.title"
                  )}
                </strong>
                <p>
                  {eligibleComparisonExecutions.length >
                  4
                    ? t(
                        "submissionOverview.comparison.selectRange"
                      )
                    : t(
                        "submissionOverview.comparison.preselected"
                      )}
                </p>
                {comparisonFeedbackText && (
                  <p
                    className="submission-overview__comparison-feedback"
                    role="status"
                  >
                    {comparisonFeedbackText}
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
                  {t(
                    "submissionOverview.comparison.compareSelected",
                    {
                      count:
                        comparisonSelection.length,
                    }
                  )}
                </button>
                <button
                  type="button"
                  className="submission-overview__button submission-overview__button--ghost"
                  onClick={handleCancelComparison}
                >
                  {t(
                    "submissionOverview.actions.cancel"
                  )}
                </button>
              </div>
            </div>
          )}

          {referenceState.open && (
            <div
              className="submission-overview__reference-panel"
              role="region"
              aria-label={t(
                "submissionOverview.reference.regionAria"
              )}
            >
              <div className="submission-overview__reference-heading">
                <div>
                  <strong>
                    {t("submissionOverview.reference.title")}
                  </strong>
                  <p>
                    {t("submissionOverview.reference.description", {
                      name: executionDisplayName(
                        referenceState.execution,
                        t(
                          "submissionOverview.fallbacks.unnamedFile"
                        )
                      ),
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  className="submission-overview__button submission-overview__button--ghost"
                  onClick={() =>
                    setReferenceState({
                      open: false,
                      execution: null,
                      kind: "idle",
                      items: [],
                      errorKey: "",
                    })
                  }
                >
                  {t("submissionOverview.actions.close")}
                </button>
              </div>

              {referenceState.kind === "loading" ? (
                <p role="status">
                  {t("submissionOverview.reference.loading")}
                </p>
              ) : referenceState.kind === "error" ? (
                <p role="alert">
                  {t(referenceState.errorKey)}
                </p>
              ) : referenceState.items.length === 0 ? (
                <p role="status">
                  {t("submissionOverview.reference.empty")}
                </p>
              ) : (
                <ul className="submission-overview__reference-list">
                  {referenceState.items.map((candidate) => (
                    <li key={candidate.codename}>
                      <div>
                        <strong>
                          {candidate.sourceFilename ||
                            candidate.submissionTitle ||
                            candidate.codename}
                        </strong>
                        <span>
                          {t(referenceStatusKey(candidate.status))}
                        </span>
                        {candidate.reason && <p>{candidate.reason}</p>}
                      </div>
                      <button
                        type="button"
                        className="submission-overview__button submission-overview__button--secondary"
                        disabled={candidate.selectable !== true}
                        onClick={() =>
                          navigate(
                            buildComparisonPath([
                              referenceState.execution.codename,
                              candidate.codename,
                            ])
                          )
                        }
                      >
                        {t("submissionOverview.reference.compare")}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {orderedExecutions.length === 0 ? (
            <InlineState
              type="empty"
              title={t(
                "submissionOverview.states.emptyTitle"
              )}
              description={t(
                "submissionOverview.states.emptyDescription"
              )}
            />
          ) : (
            <div className="submission-overview__execution-list">
              {orderedExecutions.map((execution) => {
                const failure = execution.failure;
                const displayName =
                  executionDisplayName(
                    execution,
                    t(
                      "submissionOverview.fallbacks.unnamedFile"
                    )
                  );
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
                            {t(
                              "submissionOverview.comparison.selectFile",
                              { name: displayName }
                            )}
                          </label>
                        ) : (
                          <span>
                            {t(
                              "submissionOverview.comparison.notEligible",
                              {
                                reason: t(
                                  comparisonIneligibilityKey(
                                    execution
                                  )
                                ),
                              }
                            )}
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
                            {t(
                              "submissionOverview.execution.sourceMarker"
                            )}
                          </span>
                          <h3>{displayName}</h3>
                          {execution.codename && (
                            <span className="submission-overview__codename">
                              {t(
                                "submissionOverview.execution.technicalId"
                              )}:{" "}
                              <code>
                                {execution.codename}
                              </code>
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={stateClassName(
                          execution.state
                        )}
                      >
                        {t(
                          executionStateKey(
                            execution.state
                          )
                        )}
                      </span>
                    </div>

                    <dl className="submission-overview__execution-metadata">
                      <div>
                        <Gauge size={17} strokeWidth={1.9} aria-hidden="true" />
                        <dt>
                          {t(
                            "submissionOverview.labels.benchmark"
                          )}
                        </dt>
                        <dd>
                          {formatBenchmark(
                            execution.benchmark,
                            t(
                              "submissionOverview.fallbacks.notReported"
                            )
                          )}
                        </dd>
                      </div>
                      <div>
                        <Clock3 size={17} strokeWidth={1.9} aria-hidden="true" />
                        <dt>
                          {t(
                            "submissionOverview.labels.duration"
                          )}
                        </dt>
                        <dd>
                          {formatExecutionDuration(
                            execution.durationMs,
                            locale,
                            t(
                              "submissionOverview.fallbacks.noData"
                            )
                          )}
                        </dd>
                      </div>
                      <div>
                        <FileArchive size={17} strokeWidth={1.9} aria-hidden="true" />
                        <dt>
                          {t(
                            "submissionOverview.labels.result"
                          )}
                        </dt>
                        <dd
                          className={
                            execution.resultAvailable
                              ? "submission-overview__result-available"
                              : ""
                          }
                        >
                          {t(
                            resultAvailabilityKey(
                              execution
                            )
                          )}
                        </dd>
                      </div>
                      {execution.hardwareProfile && (
                        <div>
                          <Server size={17} strokeWidth={1.9} aria-hidden="true" />
                          <dt>
                            {t(
                              "submissionOverview.labels.environment"
                            )}
                          </dt>
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
                            {t(
                              "submissionOverview.failure.title"
                            )}
                          </strong>
                          <p>
                            {failure?.message ||
                              t(
                                "submissionOverview.failure.noDetail"
                              )}
                          </p>
                          {(failure?.stage || failure?.code) && (
                            <dl>
                              {failure?.stage && (
                                <div>
                                  <dt>
                                    {t(
                                      "submissionOverview.failure.stage"
                                    )}
                                  </dt>
                                  <dd>{failure.stage}</dd>
                                </div>
                              )}
                              {failure?.code && (
                                <div>
                                  <dt>
                                    {t(
                                      "submissionOverview.failure.code"
                                    )}
                                  </dt>
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
                          ? t(
                              "submissionOverview.execution.record",
                              {
                                id: execution.publicId,
                              }
                            )
                          : t(
                              "submissionOverview.execution.executionNumber",
                              {
                                id:
                                  execution.executionId ||
                                  "—",
                              }
                            )}
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
                            <Eye
                              size={16}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            {t(
                              "submissionOverview.actions.viewCode"
                            )}
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
                            {t(
                              "submissionOverview.actions.reuseConfiguration"
                            )}
                          </button>
                        )}

                        {canOpenResult &&
                          permissions.canEditMetadata && (
                            <button
                              type="button"
                              className="submission-overview__button submission-overview__button--secondary"
                              onClick={() =>
                                handleOpenReferenceCandidates(execution)
                              }
                            >
                              <Star
                                size={16}
                                strokeWidth={2}
                                aria-hidden="true"
                              />
                              {t(
                                "submissionOverview.actions.compareReference"
                              )}
                            </button>
                          )}

                        {canOpenResult && (
                          <button
                            type="button"
                            className="submission-overview__button submission-overview__button--secondary"
                            onClick={() =>
                              handlePreviousCompatible(execution)
                            }
                            disabled={
                              previousState.kind === "loading"
                            }
                          >
                            <History
                              size={16}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                            {previousState.kind === "loading" &&
                            previousState.codename === execution.codename
                              ? t(
                                  "submissionOverview.previous.loading"
                                )
                              : t(
                                  "submissionOverview.actions.comparePrevious"
                                )}
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
                            {t(
                              "submissionOverview.actions.viewResult"
                            )}
                            <ExternalLink
                              size={16}
                              strokeWidth={2}
                              aria-hidden="true"
                            />
                          </button>
                        )}
                      </div>
                    </div>
                    {previousState.codename === execution.codename &&
                      previousState.messageKey && (
                        <p
                          className="submission-overview__shortcut-feedback"
                          role={
                            previousState.kind === "error"
                              ? "alert"
                              : "status"
                          }
                        >
                          {t(previousState.messageKey)}
                        </p>
                      )}
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
