// src/screens/RenderForm/components/MeasurementAndProfileSection.js
import React from "react";

function MeasurementAndProfileSection({
  machineOptions,
  selectedMachine,
  onMachineChange,
  executionProfiles,
  executionProfile,
  onExecutionProfileChange,
}) {
  return (
    <div className="rf-row rf-row-two">
      <section className="rf-panel">
        <label className="form-label">
          <span className="label-icon">🖥️</span>
          Sistema de medición
        </label>
        <div className="machine-options">
          {machineOptions.map((m) => (
            <button
              type="button"
              key={m.id}
              className={`machine-option ${
                selectedMachine === m.id ? "selected" : ""
              }`}
              onClick={() => !m.disabled && onMachineChange(m.id)}
              disabled={m.disabled}
            >
              <div className="machine-option-header">
                <span className="machine-name">{m.name}</span>
              </div>
              <p className="machine-description">
                {m.description}
                {m.disabled && " (no disponible en esta versión)"}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="rf-panel">
        <label className="form-label">
          <span className="label-icon">⚙️</span>
          Perfil de ejecución
        </label>
        <div className="execution-options">
          {executionProfiles.map((profile) => (
            <label
              key={profile.id}
              className={`execution-option ${
                executionProfile === profile.id ? "selected" : ""
              }`}
            >
              <input
                type="radio"
                name="executionProfile"
                value={profile.id}
                checked={executionProfile === profile.id}
                onChange={(e) => onExecutionProfileChange(e.target.value)}
              />
              <div className="execution-body">
                <span className="execution-name">
                  {profile.name}
                </span>
                <span className="execution-description">
                  {profile.description}
                </span>
              </div>
            </label>
          ))}
        </div>
      </section>
    </div>
  );
}

export default MeasurementAndProfileSection;
