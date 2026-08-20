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

import { useI18n } from "../../../i18n";

const profileIcons = {
  rapido: Zap,
  equilibrado: Scale,
  exhaustivo: Activity,
  personalizado: SlidersHorizontal,
};

const profileText = (profile, field, t) => {
  const id = String(profile?.id || "").trim();
  if (!id) return profile?.[field] || "";

  const key = `renderForm.measurement.profiles.${id}.${field}`;
  const translated = t(key);

  return translated === key
    ? profile?.[field] || ""
    : translated;
};

function MeasurementAndProfileSection({
  executionEnvironment,
  executionProfiles,
  executionProfile,
  onExecutionProfileChange,
}) {
  const { t } = useI18n();

  return (
    <div className="rf-row rf-row-two">
      <section className="rf-panel">
        <div className="form-label">
          <ServerCog size={18} strokeWidth={1.9} />
          {t("renderForm.measurement.environmentLabel")}
        </div>

        <div className="machine-options">
          <div className="machine-option selected machine-option-static">
            <div className="machine-option-header">
              <span className="machine-name">
                {t("renderForm.measurement.environmentName")}
              </span>

              <span className="environment-badge">
                {t("renderForm.measurement.automaticBadge")}
              </span>
            </div>

            <p className="machine-description">
              {t("renderForm.measurement.environmentDescription")}
            </p>

            <div className="environment-note">
              <Gauge size={15} strokeWidth={1.9} />
              <span>
                {t("renderForm.measurement.environmentNote")}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rf-panel">
        <div className="form-label">
          <Gauge size={18} strokeWidth={1.9} />
          {t("renderForm.measurement.profileLabel")}
        </div>

        <p className="profile-section-help">
          {t("renderForm.measurement.profileHelp")}
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
                      {profileText(profile, "name", t)}
                    </span>

                    {profile.badge && (
                      <span className="profile-badge">
                        {profileText(profile, "badge", t)}
                      </span>
                    )}
                  </div>

                  <span className="execution-description">
                    {profileText(profile, "description", t)}
                  </span>

                  <span className="execution-profile-meta">
                    {typeof profile.samples === "number"
                      ? t("renderForm.measurement.repetitions", {
                          count: profile.samples,
                        })
                      : t(
                          "renderForm.measurement.manualRepetitions"
                        )}
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
