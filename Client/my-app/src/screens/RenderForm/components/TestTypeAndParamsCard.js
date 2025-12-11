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
  taskSubtitles,
  taskIcons,
  taskBadges,
  paramLimits,
}) {
  const getLimits = (taskId, field) =>
    paramLimits?.[taskId]?.[field] || null;

  /**
   * Stepper para samples (+ / -) respetando los límites y el step del test.
   */
  const handleSamplesStep = (direction, limitsSamples) => {
    const current =
      typeof samples === "number" && !Number.isNaN(samples)
        ? samples
        : limitsSamples?.min ?? 1;

    if (!limitsSamples) {
      const next =
        direction === "inc" ? current + 1 : Math.max(1, current - 1);
      onSamplesChange({ target: { value: next } });
      return;
    }

    const step = limitsSamples.step ?? 1;
    let next =
      direction === "inc"
        ? current + step
        : current - step;

    if (next < limitsSamples.min) next = limitsSamples.min;
    if (next > limitsSamples.max) next = limitsSamples.max;

    onSamplesChange({ target: { value: next } });
  };

  /**
   * Número de incrementos N a partir de inputSize y los límites del test.
   *
   * Contrato:
   * - minSize = paramLimits[taskId].inputSize.min
   * - maxSizeRaw = clamp(inputSize, minSize, maxPermitido)
   * - targetIncrements = 10 (modo equilibrado)
   * - baseStep = paramLimits[taskId].inputSize.step
   * - rawStep = (maxSizeRaw - minSize) / (targetIncrements - 1)
   * - step = max(baseStep, round(rawStep / baseStep) * baseStep)
   * - N = floor((maxSizeRaw - minSize) / step) + 1
   */
  const TARGET_INCREMENTS = 10;

  const computeIncrements = (taskId, currentInputSize) => {
    const limitsInput = paramLimits?.[taskId]?.inputSize;
    if (!limitsInput) return 0;

    if (
      currentInputSize === "" ||
      currentInputSize === null ||
      currentInputSize === undefined
    ) {
      return 0;
    }

    let maxSizeRaw = Number(currentInputSize);
    if (Number.isNaN(maxSizeRaw)) return 0;

    const minSize = limitsInput.min ?? 1;
    const maxAllowed = limitsInput.max ?? maxSizeRaw;

    // Clamp al rango permitido
    if (maxSizeRaw < minSize) maxSizeRaw = minSize;
    if (maxSizeRaw > maxAllowed) maxSizeRaw = maxAllowed;

    const delta = maxSizeRaw - minSize;
    if (delta <= 0) {
      // Solo un tamaño posible
      return 1;
    }

    const baseStep = limitsInput.step || 1;
    const targetIncrements = TARGET_INCREMENTS;
    if (targetIncrements <= 1) {
      return 1;
    }

    const rawStep = delta / (targetIncrements - 1);
    let k = Math.round(rawStep / baseStep);
    if (k < 1) k = 1;

    const step = k * baseStep;

    const n = Math.floor(delta / step) + 1;
    return Math.max(1, n);
  };

  return (
    <div className="rf-row">
      <section className="rf-panel">
        <label className="form-label">
          <span className="label-icon">🧪</span>
          Tipo de test y parámetros
        </label>

        <div className="test-options">
          {tasks.map((task) => {
            const isSelected = selectedTaskType === task.id;
            const limitsInput = getLimits(task.id, "inputSize");
            const limitsSamples = getLimits(task.id, "samples");

            const increments = isSelected
              ? computeIncrements(task.id, inputSize)
              : null;

            const hasValidNumbers =
              isSelected &&
              typeof samples === "number" &&
              !Number.isNaN(samples) &&
              typeof increments === "number" &&
              increments > 0;

            const totalExecutions =
              hasValidNumbers ? increments * samples : null;

            return (
              <div
                key={task.id}
                className={`test-option ${isSelected ? "selected" : ""}`}
              >
                {/* Header: cambia el tipo de test */}
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
                        <span className="test-option-icon">
                          {taskIcons[task.id]}
                        </span>
                        <span className="test-title">
                          {task.title}
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
                      {task.description}
                    </p>

                    <div className="test-params-grid">
                      {/* Tamaño máximo de entrada */}
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
                          value={inputSize === "" ? "" : inputSize}
                          onChange={onInputSizeChange}
                          min={limitsInput?.min ?? 1}
                          max={limitsInput?.max}
                        />

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

                        <div className="param-suggestions">
                          {(inputSizePresets[task.id] || []).map(
                            (preset) => (
                              <button
                                key={preset}
                                type="button"
                                className="param-chip"
                                onClick={() =>
                                  // reutilizamos la lógica del slider
                                  onInputSizeSliderChange({
                                    target: { value: preset },
                                  })
                                }
                              >
                                {preset}
                              </button>
                            )
                          )}
                        </div>

                        {paramErrors.inputSize && (
                          <p className="param-error">
                            {paramErrors.inputSize}
                          </p>
                        )}
                      </div>

                      {/* Repeticiones por incremento */}
                      <div className="param-group">
                        <label className="param-label">
                          Repeticiones por incremento
                        </label>

                        <div className="param-input-with-stepper">
                          <button
                            type="button"
                            className="stepper-button"
                            onClick={() =>
                              handleSamplesStep("dec", limitsSamples)
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
                            value={samples === "" ? "" : samples}
                            onChange={onSamplesChange}
                            min={limitsSamples?.min ?? 1}
                            max={limitsSamples?.max}
                          />
                          <button
                            type="button"
                            className="stepper-button"
                            onClick={() =>
                              handleSamplesStep("inc", limitsSamples)
                            }
                            aria-label="Aumentar repeticiones"
                          >
                            +
                          </button>
                        </div>

                        {limitsSamples && (
                          <div className="param-range-wrapper">
                            <input
                              type="range"
                              className="param-range"
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

                        <div className="param-suggestions">
                          {samplesPresets.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              className="param-chip"
                              onClick={() =>
                                onSamplesSliderChange({
                                  target: { value: preset },
                                })
                              }
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        {paramErrors.samples && (
                          <p className="param-error">
                            {paramErrors.samples}
                          </p>
                        )}
                      </div>

                      {/* Opciones específicas de CAMM */}
                      {task.id === "camm" && (
                        <div className="param-group param-group-full">
                          <label className="param-label">
                            Tipo de datos (CAMM)
                          </label>
                          <div className="data-options">
                            {numericalInputOptions.map((option) => (
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
                                  {option.label}
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Resumen dinámico de ejecuciones */}
                    {totalExecutions !== null && (
                      <div className="param-summary">
                        <p>
                          Tendrás{" "}
                          <strong>{increments}</strong>{" "}
                          incrementos de tamaño ×{" "}
                          <strong>{samples}</strong>{" "}
                          repeticiones ={" "}
                          <strong>{totalExecutions}</strong>{" "}
                          ejecuciones totales.
                        </p>
                      </div>
                    )}
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
