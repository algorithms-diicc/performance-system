import {
  useEffect,
  useRef,
} from "react";

import { useI18n } from "../../../i18n";

const formatOperationalTimeout = (seconds, t) => {
  const numeric = Number(seconds);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return "—";
  }

  const minutes = numeric / 60;

  if (Number.isInteger(minutes)) {
    return t("renderForm.overview.timeoutValueMinutes", {
      seconds: numeric,
      minutes,
    });
  }

  return t("renderForm.overview.timeoutValueSeconds", {
    seconds: numeric,
  });
};

function OverviewModal({
  visible,
  onCancel,
  onConfirm,
  isSubmitting,
  testName,
  fileName,
  fileMeta,
  taskTitle,
  taskId,
  inputSize,
  inputLimits,
  samples,
  sampleLimits,
  dataTypeLabel,
  dataType,
  environmentLabel,
  measurementNodeMode = "AUTO",
  measurementNodeLabel = "",
  measurementHardwareProfileLabel = "",
  executionProfileLabel,
  executionProfileId,
  courseLabel,
  hasCourse,
  username,
}) {
  const { t } = useI18n();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!visible) {
      return undefined;
    }

    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;

    if (dialog) {
      dialog.focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (
        event.key !== "Tab" ||
        !dialog
      ) {
        return;
      }

      const focusable = Array.from(
        dialog.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(
        (element) =>
          !element.hasAttribute("hidden") &&
          element.getAttribute("aria-hidden") !== "true"
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last =
        focusable[focusable.length - 1];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown
      );

      if (
        previousFocus &&
        typeof previousFocus.focus ===
          "function"
      ) {
        previousFocus.focus();
      }
    };
  }, [visible, onCancel]);

  if (!visible) return null;

  const translatedTaskKey =
    `renderForm.benchmark.tasks.${taskId}.name`;
  const translatedTask = taskId ? t(translatedTaskKey) : "";
  const resolvedTaskTitle =
    taskId && translatedTask !== translatedTaskKey
      ? translatedTask
      : taskTitle || "-";

  const translatedDataKey =
    `renderForm.benchmark.dataTypes.${dataType}`;
  const translatedData = dataType ? t(translatedDataKey) : "";
  const resolvedDataType = dataType
    ? (
        translatedData !== translatedDataKey
          ? translatedData
          : dataTypeLabel
      )
    : t("renderForm.benchmark.notApplicable");

  const translatedProfileKey =
    `renderForm.measurement.profiles.${executionProfileId}.name`;
  const translatedProfile = executionProfileId
    ? t(translatedProfileKey)
    : "";
  const resolvedProfile =
    executionProfileId && translatedProfile !== translatedProfileKey
      ? translatedProfile
      : executionProfileLabel;

  const sourceCount = Math.max(
    0,
    Number(fileMeta?.sourceCount) || 0
  );
  const cCount = Math.max(
    0,
    Number(fileMeta?.cCount) || 0
  );
  const cppCount = Math.max(
    0,
    Number(fileMeta?.cppCount) || 0
  );
  const sourceSample = Array.isArray(fileMeta?.sourceSample)
    ? fileMeta.sourceSample.slice(0, 5)
    : [];
  const additionalSources = Math.max(
    0,
    sourceCount - sourceSample.length
  );

  const normalizedMode =
    String(measurementNodeMode || "AUTO")
      .trim()
      .toUpperCase() === "PINNED"
      ? "PINNED"
      : "AUTO";

  const hasPolicy =
    inputLimits &&
    Number.isFinite(Number(inputLimits.min)) &&
    Number.isFinite(Number(inputLimits.max));

  const recommendedMax =
    hasPolicy &&
    Number.isFinite(Number(inputLimits.recommendedMax))
      ? Number(inputLimits.recommendedMax)
      : null;

  const hardMax =
    hasPolicy
      ? Number(inputLimits.max)
      : null;

  const numericInput = Number(inputSize);

  const advancedInput =
    recommendedMax !== null &&
    Number.isFinite(numericInput) &&
    numericInput > recommendedMax &&
    numericInput <= hardMax;

  return (
    <div className="rf-modal-backdrop">
      <div
        ref={dialogRef}
        className="rf-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rf-overview-title"
        aria-describedby="rf-overview-description"
        tabIndex={-1}
      >
        <div className="rf-modal-header">
          <h3 id="rf-overview-title">
            {t("renderForm.overview.title")}
          </h3>
          <p id="rf-overview-description">
            {t("renderForm.overview.description")}
          </p>
        </div>

        <div className="rf-modal-body">
          <div className="rf-modal-grid">
            <div className="rf-modal-section">
              <h4>{t("renderForm.overview.experiment")}</h4>
              <dl>
                <dt>{t("renderForm.overview.name")}</dt>
                <dd>
                  {testName || t("renderForm.overview.unnamed")}
                </dd>

                <dt>{t("renderForm.overview.file")}</dt>
                <dd>
                  {fileName || t("renderForm.overview.noFile")}
                </dd>

                {fileMeta && (
                  <>
                    <dt>
                      {t("renderForm.overview.implementations")}
                    </dt>
                    <dd>
                      {t("renderForm.upload.sourceSummary", {
                        count: sourceCount,
                        c: cCount,
                        cpp: cppCount,
                      })}
                    </dd>

                    {sourceSample.length > 0 && (
                      <>
                        <dt>{t("renderForm.overview.sources")}</dt>
                        <dd>
                          <ul className="rf-overview-source-list">
                            {sourceSample.map((source) => (
                              <li key={source}>{source}</li>
                            ))}
                            {additionalSources > 0 && (
                              <li>
                                {t("renderForm.overview.moreSources", {
                                  count: additionalSources,
                                })}
                              </li>
                            )}
                          </ul>
                        </dd>
                      </>
                    )}
                  </>
                )}

                <dt>{t("renderForm.overview.benchmark")}</dt>
                <dd>{resolvedTaskTitle}</dd>
              </dl>
            </div>

            <div className="rf-modal-section">
              <h4>{t("renderForm.overview.parameters")}</h4>
              <dl>
                <dt>{t("renderForm.overview.maxSize")}</dt>
                <dd>
                  {inputSize}
                  {inputLimits
                    ? ` (${t("renderForm.overview.range", {
                        min: inputLimits.min,
                        max: inputLimits.max,
                      })})`
                    : ""}
                </dd>

                <dt>{t("renderForm.overview.repetitions")}</dt>
                <dd>
                  {samples}
                  {sampleLimits
                    ? ` (${t("renderForm.overview.range", {
                        min: sampleLimits.min,
                        max: sampleLimits.max,
                      })})`
                    : ""}
                </dd>

                <dt>
                  {t("renderForm.overview.dataDistribution")}
                </dt>
                <dd>{resolvedDataType}</dd>
              </dl>

              {advancedInput && (
                <p className="rf-status-hint" role="note">
                  {t("renderForm.overview.advancedInput", {
                    input: numericInput,
                    recommended: recommendedMax,
                    hardMax,
                  })}
                </p>
              )}
            </div>

            <div className="rf-modal-section">
              <h4>{t("renderForm.overview.measurement")}</h4>

              <dl>
                <dt>{t("renderForm.overview.environment")}</dt>
                <dd>
                  {environmentLabel ||
                    t("renderForm.measurement.environmentName")}
                </dd>

                <dt>{t("renderForm.overview.selectionMode")}</dt>
                <dd>
                  {normalizedMode === "PINNED"
                    ? t("renderForm.overview.pinnedMode")
                    : t("renderForm.overview.autoMode")}
                </dd>

                <dt>{t("renderForm.overview.node")}</dt>
                <dd>
                  {normalizedMode === "PINNED"
                    ? measurementNodeLabel || "—"
                    : t("renderForm.overview.autoNodePending")}
                </dd>

                {normalizedMode === "PINNED" &&
                  measurementHardwareProfileLabel && (
                    <>
                      <dt>
                        {t(
                          "renderForm.overview.registeredHardwareProfile"
                        )}
                      </dt>
                      <dd>{measurementHardwareProfileLabel}</dd>
                    </>
                  )}

                <dt>{t("renderForm.overview.profile")}</dt>
                <dd>{resolvedProfile}</dd>
              </dl>

              <dl>
                <dt>{t("renderForm.overview.course")}</dt>
                <dd>
                  {hasCourse
                    ? courseLabel
                    : t("renderForm.overview.noCourse")}
                </dd>

                <dt>{t("renderForm.overview.user")}</dt>
                <dd>
                  {username ||
                    t("renderForm.overview.authenticatedSession")}
                </dd>
              </dl>
            </div>
          </div>

          {hasPolicy && (
            <section className="rf-modal-section rf-modal-policy-section">
              <h4>{t("renderForm.overview.effectivePolicy")}</h4>

              <dl className="rf-modal-policy-grid">
                <div>
                  <dt>{t("renderForm.overview.minimumInput")}</dt>
                  <dd>{inputLimits.min}</dd>
                </div>
                <div>
                  <dt>{t("renderForm.overview.defaultInput")}</dt>
                  <dd>{inputLimits.defaultValue}</dd>
                </div>
                <div>
                  <dt>{t("renderForm.overview.recommendedMaxInput")}</dt>
                  <dd>{inputLimits.recommendedMax}</dd>
                </div>
                <div>
                  <dt>{t("renderForm.overview.hardMaxInput")}</dt>
                  <dd>{inputLimits.max}</dd>
                </div>
                <div>
                  <dt>{t("renderForm.overview.inputStep")}</dt>
                  <dd>{inputLimits.step}</dd>
                </div>
                <div>
                  <dt>{t("renderForm.overview.operationalTimeout")}</dt>
                  <dd>
                    {formatOperationalTimeout(
                      inputLimits.operationalTimeoutSeconds,
                      t
                    )}
                  </dd>
                </div>
              </dl>

              <div className="rf-modal-policy-notes">
                <p className="rf-status-hint">
                  {t("renderForm.overview.hardMaxHelp", {
                    hardMax: inputLimits.max,
                  })}
                </p>

                <p className="rf-status-hint">
                  {t("renderForm.overview.timeoutHelp")}
                </p>
              </div>
            </section>
          )}
        </div>

        <div className="rf-modal-footer">
          <button
            type="button"
            className="rf-modal-secondary"
            onClick={onCancel}
          >
            {t("renderForm.overview.back")}
          </button>

          <button
            type="button"
            className="rf-modal-primary"
            onClick={onConfirm}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t("renderForm.overview.sending")
              : t("renderForm.overview.confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default OverviewModal;
