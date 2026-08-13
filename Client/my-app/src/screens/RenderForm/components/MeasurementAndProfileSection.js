// src/screens/RenderForm/components/MeasurementAndProfileSection.js

import React from "react";
import {
  ServerCog,
  Gauge,
  Zap,
  Scale,
  Activity,
  SlidersHorizontal,
} from "lucide-react";

const profileIcons = {
  rapido: Zap,
  equilibrado: Scale,
  exhaustivo: Activity,
  personalizado: SlidersHorizontal,
};

function MeasurementAndProfileSection({
  executionEnvironment,
  executionProfiles,
  executionProfile,
  onExecutionProfileChange,
}) {
  return (
    <div className="rf-row rf-row-two">
      <section className="rf-panel">
        <div className="form-label">
          <ServerCog size={18} strokeWidth={1.9} />
          Entorno de ejecución
        </div>

        <div className="machine-options">
          <div className="machine-option selected machine-option-static">
            <div className="machine-option-header">
              <span className="machine-name">
                {executionEnvironment.name}
              </span>

              <span className="environment-badge">
                {executionEnvironment.badge}
              </span>
            </div>

            <p className="machine-description">
              {executionEnvironment.description}
            </p>

            <div className="environment-note">
              <Gauge size={15} strokeWidth={1.9} />
              <span>{executionEnvironment.note}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rf-panel">
        <div className="form-label">
          <Gauge size={18} strokeWidth={1.9} />
          Perfil de medición
        </div>

        <p className="profile-section-help">
          Define cuántas veces se repite cada punto de medición. Más
          repeticiones suelen entregar resultados más estables, pero aumentan
          el tiempo total del experimento.
        </p>

        <div className="execution-options">
          {executionProfiles.map((profile) => {
            const ProfileIcon =
              profileIcons[profile.id] || Gauge;

            return (
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
                  onChange={(e) =>
                    onExecutionProfileChange(e.target.value)
                  }
                />

                <div className="execution-body">
                  <div className="execution-profile-heading">
                    <span className="execution-name">
                      <ProfileIcon size={15} strokeWidth={1.9} />
                      {profile.name}
                    </span>

                    {profile.badge && (
                      <span className="profile-badge">
                        {profile.badge}
                      </span>
                    )}
                  </div>

                  <span className="execution-description">
                    {profile.description}
                  </span>

                  <span className="execution-profile-meta">
                    {typeof profile.samples === "number"
                      ? `${profile.samples} repeticiones por punto`
                      : "Repeticiones definidas manualmente"}
                  </span>
                </div>
              </label>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default MeasurementAndProfileSection;