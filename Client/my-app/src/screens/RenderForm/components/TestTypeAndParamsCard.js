// src/screens/RenderForm/components/TestTypeAndParamsCard.js
import React from "react";

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
  samplesPresets,
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
  const getLimits = (taskId, field) =>
    paramLimits?.[taskId]?.[field] || null;

  const handleSamplesStep = (direction, limitsSamples) => {
    const current =
      typeof samples === "number" && !Number.isNaN(samples)
        ? samples
        : limitsSamples?.min ?? 1;

    if (!limitsSamples) {
      const next =
        direction === "inc"
          ? current + 1
          : Math.max(1, current - 1);

      onSamplesChange({
        target: { value: next },
      });

      return;
    }

    const step = limitsSamples.step ?? 1;

    let next =
      direction === "inc"
        ? current + step
        : current - step;

    if (next < limitsSamples.min) {
      next = limitsSamples.min;
    }

    if (next > limitsSamples.max) {
      next = limitsSamples.max;
    }

    onSamplesChange({
      target: { value: next },
    });
  };

  return (
    <div className="rf-row">
      <section className="rf-panel">
        <div className="form-label">
          <span className="label-icon">🧪</span>
          Tipo de benchmark y parámetros
        </div>

        <p className="benchmark-section-help">
          Selecciona el tipo de entrada que mejor representa el algoritmo que
          quieres analizar. Performance System utilizará el benchmark asociado
          para generar los distintos puntos de medición.
        </p>

        <div className="test-options">
          {tasks.map((task) => {
            const isSelected =
              selectedTaskType === task.id;

            const limitsInput =
              getLimits(task.id, "inputSize");

            const limitsSamples =
              getLimits(task.id, "samples");

            return (
              <div
                key={task.id}
                className={`test-option ${
                  isSelected ? "selected" : ""
                }`}
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
                      onChange={() =>
                        onTaskChange(task.id)
                      }
                    />

                    <div className="test-option-texts">
                      <div className="test-title-row">
                        <span className="test-option-icon">
                          {taskIcons[task.id]}
                        </span>

                        <span className="test-title">
                          {taskDisplayNames[task.id] ||
                            task.title}
                        </span>
                      </div>

                      <p className="test-subtitle">
                        {taskSubtitles[task.id]}
                      </p>
                    </div>
                  </div>

                  <div className="test-option-meta">
                    <span className="test-badge">
                      {taskBadges[task.id]}
                    </span>
                  </div>
                </div>

                {isSelected && (
                  <div className="test-details">
                    <p className="test-description">
                      {taskDescriptions[task.id] ||
                        task.description}
                    </p>

                    <div className="test-params-grid">
                      <div className="param-group">
                        <label className="param-label">
                          Tamaño máximo de entrada
                        </label>

                        <input
                          type="number"
                          className={`param-input ${
                            paramErrors.inputSize
                              ? "param-input-error"
                              : ""
                          }`}
                          value={
                            inputSize === ""
                              ? ""
                              : inputSize
                          }
                          onChange={onInputSizeChange}
                          min={limitsInput?.min ?? 1}
                          max={limitsInput?.max}
                        />

                        <p className="param-context-help">
                          {inputSizeHelp[task.id]}
                        </p>

                        {limitsInput && (
                          <div className="param-range-wrapper">
                            <input
                              type="range"
                              className="param-range"
                              min={limitsInput.min}
                              max={limitsInput.max}
                              step={limitsInput.step}
                              value={
                                typeof inputSize ===
                                  "number" &&
                                !Number.isNaN(inputSize)
                                  ? inputSize
                                  : limitsInput.min
                              }
                              onChange={
                                onInputSizeSliderChange
                              }
                            />

                            <div className="param-range-labels">
                              <span>{limitsInput.min}</span>
                              <span>{limitsInput.max}</span>
                            </div>
                          </div>
                        )}

                        <div className="param-suggestions">
                          {(
                            inputSizePresets[task.id] ||
                            []
                          ).map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              className="param-chip"
                              onClick={() =>
                                onInputSizeSliderChange({
                                  target: {
                                    value: preset,
                                  },
                                })
                              }
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        {paramErrors.inputSize && (
                          <p className="param-error">
                            {paramErrors.inputSize}
                          </p>
                        )}
                      </div>

                      <div className="param-group">
                        <label className="param-label">
                          Repeticiones por punto de
                          medición
                        </label>

                        <div className="param-input-with-stepper">
                          <button
                            type="button"
                            className="stepper-button"
                            onClick={() =>
                              handleSamplesStep(
                                "dec",
                                limitsSamples
                              )
                            }
                            aria-label="Disminuir repeticiones"
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
                            value={
                              samples === ""
                                ? ""
                                : samples
                            }
                            onChange={onSamplesChange}
                            min={
                              limitsSamples?.min ?? 1
                            }
                            max={limitsSamples?.max}
                          />

                          <button
                            type="button"
                            className="stepper-button"
                            onClick={() =>
                              handleSamplesStep(
                                "inc",
                                limitsSamples
                              )
                            }
                            aria-label="Aumentar repeticiones"
                          >
                            +
                          </button>
                        </div>

                        <p className="param-context-help">
                          El perfil actual es{" "}
                          <strong>
                            {executionProfile}
                          </strong>
                          . Si modificas este valor
                          manualmente, el perfil cambia a
                          Personalizado.
                        </p>

                        {limitsSamples && (
                          <div className="param-range-wrapper">
                            <input
                              type="range"
                              className="param-range"
                              min={limitsSamples.min}
                              max={limitsSamples.max}
                              step={limitsSamples.step}
                              value={
                                typeof samples ===
                                  "number" &&
                                !Number.isNaN(samples)
                                  ? samples
                                  : limitsSamples.min
                              }
                              onChange={
                                onSamplesSliderChange
                              }
                            />

                            <div className="param-range-labels">
                              <span>
                                {limitsSamples.min}
                              </span>
                              <span>
                                {limitsSamples.max}
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="param-suggestions">
                          {samplesPresets.map(
                            (preset) => (
                              <button
                                key={preset}
                                type="button"
                                className="param-chip"
                                onClick={() =>
                                  onSamplesSliderChange({
                                    target: {
                                      value: preset,
                                    },
                                  })
                                }
                              >
                                {preset}
                              </button>
                            )
                          )}
                        </div>

                        {paramErrors.samples && (
                          <p className="param-error">
                            {paramErrors.samples}
                          </p>
                        )}
                      </div>

                      {task.id === "camm" && (
                        <div className="param-group param-group-full">
                          <label className="param-label">
                            Distribución de los datos
                          </label>

                          <p className="param-context-help">
                            Define cómo se organiza el conjunto
                            numérico que recibirá el algoritmo.
                          </p>

                          <div className="data-options">
                            {numericalInputOptions.map(
                              (option) => (
                                <label
                                  key={option.value}
                                  className="data-option"
                                >
                                  <input
                                    type="radio"
                                    name="dataType"
                                    value={option.value}
                                    onChange={(e) =>
                                      onDataTypeChange(
                                        e.target.value
                                      )
                                    }
                                    checked={
                                      dataType ===
                                      option.value
                                    }
                                    className="data-radio"
                                  />

                                  <span className="data-label">
                                    {option.label}
                                  </span>
                                </label>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="param-summary">
                      <p>
                        <strong>
                          Cómo se ejecutará:
                        </strong>{" "}
                        el motor generará varios puntos de
                        medición hasta el tamaño máximo
                        seleccionado y repetirá cada punto{" "}
                        <strong>{samples}</strong>{" "}
                        {samples === 1
                          ? "vez"
                          : "veces"}.
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