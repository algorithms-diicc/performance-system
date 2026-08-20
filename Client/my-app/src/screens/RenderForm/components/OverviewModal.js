import { useI18n } from "../../../i18n";

function OverviewModal({
  visible,
  onCancel,
  onConfirm,
  isSubmitting,
  testName,
  fileName,
  taskTitle,
  taskId,
  inputSize,
  inputLimits,
  samples,
  sampleLimits,
  dataTypeLabel,
  dataType,
  environmentLabel,
  executionProfileLabel,
  executionProfileId,
  courseLabel,
  hasCourse,
  username,
}) {
  const { t } = useI18n();

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
    ? (translatedData !== translatedDataKey
        ? translatedData
        : dataTypeLabel)
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

  return (
    <div className="rf-modal-backdrop">
      <div className="rf-modal">
        <div className="rf-modal-header">
          <h3>{t("renderForm.overview.title")}</h3>
          <p>{t("renderForm.overview.description")}</p>
        </div>

        <div className="rf-modal-body">
          <div className="rf-modal-grid">
            <div className="rf-modal-section">
              <h4>{t("renderForm.overview.experiment")}</h4>
              <dl>
                <dt>{t("renderForm.overview.name")}</dt>
                <dd>{testName || t("renderForm.overview.unnamed")}</dd>

                <dt>{t("renderForm.overview.file")}</dt>
                <dd>{fileName || t("renderForm.overview.noFile")}</dd>

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

                <dt>{t("renderForm.overview.dataDistribution")}</dt>
                <dd>{resolvedDataType}</dd>
              </dl>
            </div>

            <div className="rf-modal-section">
              <h4>{t("renderForm.overview.measurement")}</h4>
              <dl>
                <dt>{t("renderForm.overview.environment")}</dt>
                <dd>
                  {t("renderForm.measurement.environmentName") ||
                    environmentLabel}
                </dd>

                <dt>{t("renderForm.overview.profile")}</dt>
                <dd>{resolvedProfile}</dd>

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
