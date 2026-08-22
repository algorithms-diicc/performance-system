// src/screens/RenderForm/components/TestTypeAndParamsCard.js
import React from "react";
import {
  Binary,
  FileText,
  FlaskConical,
  Ruler,
} from "lucide-react";

import { useI18n } from "../../../i18n";

const defaultTaskIcons = {
  lcs: FileText,
  camm: Binary,
  size: Ruler,
};

const profileIdFromValue = (value) => {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const known = {
    rapido: "rapido",
    equilibrado: "equilibrado",
    exhaustivo: "exhaustivo",
    personalizado: "personalizado",
    quick: "rapido",
    balanced: "equilibrado",
    exhaustive: "exhaustivo",
    custom: "personalizado",
  };

  return known[normalized] || normalized;
};

function TestTypeAndParamsCard({
  tasks,
  selectedTaskType,
  onTaskChange,
  inputSize,
  samples,
  onInputSizeChange,
  onInputSizeSliderChange,
  onSamplesChange,
  onSamplesSliderChange,
  paramErrors,
  inputSizePresets,
  numericalInputOptions,
  dataType,
  onDataTypeChange,
  taskDisplayNames,
  taskSubtitles,
  taskDescriptions,
  taskIcons,
  taskBadges,
  inputSizeHelp,
  paramLimits,
  executionProfile,
}) {
  const { t } = useI18n();

  const getLimits = (taskId, field) =>
    paramLimits?.[taskId]?.[field] || null;

  const taskText = (task, field, fallback) => {
    const key = `renderForm.benchmark.tasks.${task.id}.${field}`;
    const translated = t(key);
    return translated === key ? fallback : translated;
  };

  const profileId = profileIdFromValue(executionProfile);
  const profileKey =
    `renderForm.measurement.profiles.${profileId}.name`;
  const translatedProfile = t(profileKey);
  const profileLabel =
    translatedProfile === profileKey
      ? executionProfile
      : translatedProfile;
  const isCustomProfile = profileId === "personalizado";

  const handleSamplesStep = (direction, limitsSamples) => {
    const current =
      typeof samples === "number" && !Number.isNaN(samples)
        ? samples
        : limitsSamples?.min ?? 1;

    if (!limitsSamples) {
      const next = direction === "inc" ? current + 1 : Math.max(1, current - 1);
      onSamplesChange({ target: { value: next } });
      return;
    }

    const step = limitsSamples.step ?? 1;
    let next = direction === "inc" ? current + step : current - step;

    if (next < limitsSamples.min) next = limitsSamples.min;
    if (next > limitsSamples.max) next = limitsSamples.max;

    onSamplesChange({ target: { value: next } });
  };

  return (
    <div className="rf-row">
      <section className="rf-panel">
        <div className="form-label">
          <span className="label-icon" aria-hidden="true">
            <FlaskConical />
          </span>
          {t("renderForm.benchmark.sectionLabel")}
        </div>

        <p className="benchmark-section-help">
          {t("renderForm.benchmark.sectionHelp")}
        </p>

        <div className="test-options">
          {tasks.map((task) => {
            const isSelected = selectedTaskType === task.id;
            const DefaultTaskIcon = defaultTaskIcons[task.id];
            const taskIcon = taskIcons?.[task.id];
            const limitsInput = getLimits(task.id, "inputSize");
            const limitsSamples = getLimits(task.id, "samples");
            const recommendedInputValues =
              inputSizePresets[task.id] || [];
            const recommendedInputMax =
              recommendedInputValues.length > 0
                ? Math.max(...recommendedInputValues)
                : null;
            const numericInputSize = Number(inputSize);
            const exceedsRecommendedInput =
              inputSize !== "" &&
              Number.isFinite(numericInputSize) &&
              recommendedInputMax !== null &&
              numericInputSize > recommendedInputMax;

            return (
              <div
                key={task.id}
                className={`test-option ${isSelected ? "selected" : ""}`}
              >
                <div
                  className="test-option-header"
                  onClick={() => onTaskChange(task.id)}
                >
                  <div className="test-option-main">
                    <input
                      type="radio"
                      className="test-radio"
                      name="taskToggle"
                      checked={isSelected}
                      onChange={() => onTaskChange(task.id)}
                    />

                    <div className="test-option-texts">
                      <div className="test-title-row">
                        <span
                          className="test-option-icon"
                          aria-hidden="true"
                        >
                          {taskIcon ||
                            (DefaultTaskIcon && <DefaultTaskIcon />)}
                        </span>
                        <span className="test-title">
                          {taskText(
                            task,
                            "name",
                            taskDisplayNames[task.id] || task.title
                          )}
                        </span>
                      </div>

                      <p className="test-subtitle">
                        {taskText(
                          task,
                          "subtitle",
                          taskSubtitles[task.id]
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="test-option-meta">
                    <span className="test-badge">
                      {taskText(
                        task,
                        "badge",
                        taskBadges[task.id]
                      )}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <div className="test-details">
                    <p className="test-description">
                      {taskText(
                        task,
                        "description",
                        taskDescriptions[task.id] || task.description
                      )}
                    </p>

                    <div className="test-params-grid">
                      <div className="param-group">
                        <label className="param-label">
                          {t("renderForm.benchmark.maxInput")}
                        </label>

                        <input
                          type="number"
                          className={`param-input ${
                            paramErrors.inputSize ? "param-input-error" : ""
                          }`}
                          value={inputSize === "" ? "" : inputSize}
                          onChange={onInputSizeChange}
                          min={limitsInput?.min ?? 1}
                          max={limitsInput?.max}
                        />

                        <p className="param-context-help">
                          {taskText(
                            task,
                            "inputHelp",
                            inputSizeHelp[task.id]
                          )}
                        </p>

                        {limitsInput && (
                          <p className="param-range-contract">
                            {t(
                              "renderForm.benchmark.allowedRange",
                              {
                                min: limitsInput.min,
                                max: limitsInput.max,
                              }
                            )}
                          </p>
                        )}

                        {limitsInput && (
                          <div className="param-range-wrapper">
                            <input
                              type="range"
                              className="param-range"
                              min={limitsInput.min}
                              max={limitsInput.max}
                              step={limitsInput.step}
                              value={
                                typeof inputSize === "number" &&
                                !Number.isNaN(inputSize)
                                  ? inputSize
                                  : limitsInput.min
                              }
                              onChange={onInputSizeSliderChange}
                            />
                            <div className="param-range-labels">
                              <span>{limitsInput.min}</span>
                              <span>{limitsInput.max}</span>
                            </div>
                          </div>
                        )}

                        {recommendedInputValues.length > 0 && (
                          <div className="param-suggestions-block">
                            <span className="param-suggestions-label">
                              {t(
                                "renderForm.benchmark.recommendedValues"
                              )}
                            </span>

                            <div className="param-suggestions">
                              {recommendedInputValues.map((preset) => (
                                <button
                                  key={preset}
                                  type="button"
                                  className="param-chip"
                                  onClick={() =>
                                    onInputSizeSliderChange({
                                      target: { value: preset },
                                    })
                                  }
                                >
                                  {preset}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {exceedsRecommendedInput && (
                          <div
                            className="param-advisory"
                            role="status"
                          >
                            <strong>
                              {t(
                                "renderForm.benchmark.advancedInputTitle"
                              )}
                            </strong>
                            <span>
                              {t(
                                "renderForm.benchmark.advancedInputWarning",
                                {
                                  recommendedMax:
                                    recommendedInputMax,
                                }
                              )}
                            </span>
                          </div>
                        )}

                        {paramErrors.inputSize && (
                          <p className="param-error">
                            {paramErrors.inputSize}
                          </p>
                        )}
                      </div>

                      <div className="param-group">
                        <label className="param-label">
                          {t("renderForm.benchmark.repetitionsPerPoint")}
                        </label>

                        {isCustomProfile ? (
                          <>
                            <div className="param-input-with-stepper">
                              <button
                                type="button"
                                className="stepper-button"
                                onClick={() =>
                                  handleSamplesStep("dec", limitsSamples)
                                }
                                aria-label={t(
                                  "renderForm.benchmark.decreaseRepetitions"
                                )}
                              >
                                −
                              </button>

                              <input
                                type="number"
                                className={`param-input ${
                                  paramErrors.samples
                                    ? "param-input-error"
                                    : ""
                                }`}
                                value={samples === "" ? "" : samples}
                                onChange={onSamplesChange}
                                min={limitsSamples?.min ?? 1}
                                max={limitsSamples?.max ?? 100}
                                step={limitsSamples?.step ?? 1}
                              />

                              <button
                                type="button"
                                className="stepper-button"
                                onClick={() =>
                                  handleSamplesStep("inc", limitsSamples)
                                }
                                aria-label={t(
                                  "renderForm.benchmark.increaseRepetitions"
                                )}
                              >
                                +
                              </button>
                            </div>

                            <p className="param-context-help">
                              {t(
                                "renderForm.benchmark.customProfileHelp"
                              )}
                            </p>

                            {limitsSamples && (
                              <div className="param-range-wrapper">
                                <input
                                  type="range"
                                  className="param-range"
                                  aria-label={t(
                                    "renderForm.benchmark.repetitionsSlider"
                                  )}
                                  min={limitsSamples.min}
                                  max={limitsSamples.max}
                                  step={limitsSamples.step}
                                  value={
                                    typeof samples === "number" &&
                                    !Number.isNaN(samples)
                                      ? samples
                                      : limitsSamples.min
                                  }
                                  onChange={onSamplesSliderChange}
                                />
                                <div className="param-range-labels">
                                  <span>{limitsSamples.min}</span>
                                  <span>{limitsSamples.max}</span>
                                </div>
                              </div>
                            )}

                            {paramErrors.samples && (
                              <p className="param-error">
                                {paramErrors.samples}
                              </p>
                            )}
                          </>
                        ) : (
                          <div
                            className="param-readonly-value"
                            data-testid="fixed-profile-samples"
                          >
                            <strong>
                              {t("renderForm.measurement.repetitions", {
                                count: samples,
                              })}
                            </strong>
                            <span>
                              {t(
                                "renderForm.benchmark.fixedByProfile",
                                { profile: profileLabel }
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      {task.id === "camm" && (
                        <div className="param-group param-group-full">
                          <label className="param-label">
                            {t("renderForm.benchmark.dataDistribution")}
                          </label>

                          <p className="param-context-help">
                            {t("renderForm.benchmark.dataDistributionHelp")}
                          </p>

                          <div className="data-options">
                            {numericalInputOptions.map((option) => {
                              const key =
                                `renderForm.benchmark.dataTypes.${option.value}`;
                              const translated = t(key);
                              const label =
                                translated === key
                                  ? option.label
                                  : translated;

                              return (
                                <label
                                  key={option.value}
                                  className="data-option"
                                >
                                  <input
                                    type="radio"
                                    name="dataType"
                                    value={option.value}
                                    onChange={(e) =>
                                      onDataTypeChange(e.target.value)
                                    }
                                    checked={dataType === option.value}
                                    className="data-radio"
                                  />
                                  <span className="data-label">
                                    {label}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="param-summary">
                      <p>
                        {t("renderForm.benchmark.executionSummary", {
                          count: samples,
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default TestTypeAndParamsCard;
