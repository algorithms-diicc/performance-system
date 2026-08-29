// src/screens/RenderForm/components/MeasurementAndProfileSection.js

import React from "react";
import {
  Activity,
  Gauge,
  ServerCog,
  SlidersHorizontal,
  Scale,
  Zap,
} from "lucide-react";

import { useI18n } from "../../../i18n";

const profileIcons = {
  rapido: Zap,
  equilibrado: Scale,
  exhaustivo: Activity,
  personalizado: SlidersHorizontal,
};

const profileText = (profile, field, t) => {
  const id = String(
    profile?.id || ""
  ).trim();

  if (!id) {
    return profile?.[field] || "";
  }

  const key =
    `renderForm.measurement.profiles.${id}.${field}`;

  const translated = t(key);

  return translated === key
    ? profile?.[field] || ""
    : translated;
};

function MeasurementAndProfileSection({
  executionProfiles,
  executionProfile,
  onExecutionProfileChange,
  measurementNodeMode = "AUTO",
  measurementNodes = [],
  measurementNodesLoading = false,
  measurementNodesError = false,
  selectedMeasurementNodeKey = "",
  onMeasurementNodeModeChange,
  onMeasurementNodeChange,
  onRetryMeasurementNodes,
}) {
  const { t } = useI18n();

  const normalizedMode =
    String(
      measurementNodeMode || "AUTO"
    ).toUpperCase();

  const selectedNode =
    measurementNodes.find(
      (node) =>
        String(node?.nodeKey) ===
        String(selectedMeasurementNodeKey)
    ) || null;

  return (
    <div className="rf-row rf-row-two">
      <section className="rf-panel">
        <div className="form-label">
          <ServerCog
            size={18}
            strokeWidth={1.9}
          />
          {t(
            "renderForm.measurement.environmentLabel"
          )}
        </div>

        <p className="profile-section-help">
          {t(
            "renderForm.measurement.targetHelp"
          )}
        </p>

        <div
          className="measurement-mode-options"
          role="radiogroup"
          aria-label={t(
            "renderForm.measurement.nodeModeGroupAria"
          )}
        >
          <label
            className={
              `machine-option ${
                normalizedMode === "AUTO"
                  ? "selected"
                  : ""
              }`
            }
          >
            <input
              type="radio"
              name="measurementNodeMode"
              value="AUTO"
              checked={
                normalizedMode === "AUTO"
              }
              onChange={() =>
                onMeasurementNodeModeChange(
                  "AUTO"
                )
              }
              aria-label={t(
                "renderForm.measurement.autoModeAria"
              )}
            />

            <div className="machine-option-header">
              <span className="machine-name">
                {t(
                  "renderForm.measurement.environmentName"
                )}
              </span>

              <span className="environment-badge">
                {t(
                  "renderForm.measurement.automaticBadge"
                )}
              </span>
            </div>

            <p className="machine-description">
              {t(
                "renderForm.measurement.environmentDescription"
              )}
            </p>

            <div className="environment-note">
              <Gauge
                size={15}
                strokeWidth={1.9}
              />
              <span>
                {t(
                  "renderForm.measurement.environmentNote"
                )}
              </span>
            </div>
          </label>

          <label
            className={
              `machine-option ${
                normalizedMode === "PINNED"
                  ? "selected"
                  : ""
              }`
            }
          >
            <input
              type="radio"
              name="measurementNodeMode"
              value="PINNED"
              checked={
                normalizedMode === "PINNED"
              }
              onChange={() =>
                onMeasurementNodeModeChange(
                  "PINNED"
                )
              }
              aria-label={t(
                "renderForm.measurement.pinnedModeAria"
              )}
            />

            <div className="machine-option-header">
              <span className="machine-name">
                {t(
                  "renderForm.measurement.pinnedModeTitle"
                )}
              </span>

              <span className="profile-badge">
                {t(
                  "renderForm.measurement.pinnedModeBadge"
                )}
              </span>
            </div>

            <p className="machine-description">
              {t(
                "renderForm.measurement.pinnedModeHelp"
              )}
            </p>
          </label>
        </div>

        {normalizedMode === "PINNED" && (
          <div
            className="measurement-node-picker"
            data-testid="measurement-node-picker"
          >
            {measurementNodesLoading && (
              <p
                className="form-help-text"
                role="status"
              >
                {t(
                  "renderForm.measurement.nodeLoading"
                )}
              </p>
            )}

            {!measurementNodesLoading &&
              measurementNodesError && (
                <div
                  className="measurement-node-error"
                  role="alert"
                >
                  <span>
                    {t(
                      "renderForm.measurement.nodeLoadError"
                    )}
                  </span>

                  <button
                    type="button"
                    className="rf-course-context-retry"
                    onClick={
                      onRetryMeasurementNodes
                    }
                  >
                    {t(
                      "renderForm.measurement.nodeRetry"
                    )}
                  </button>
                </div>
              )}

            {!measurementNodesLoading &&
              !measurementNodesError &&
              measurementNodes.length === 0 && (
                <p className="form-help-text">
                  {t(
                    "renderForm.measurement.noNodes"
                  )}
                </p>
              )}

            {!measurementNodesLoading &&
              !measurementNodesError &&
              measurementNodes.length > 0 && (
                <>
                  <label
                    className="form-label"
                    htmlFor="measurement-node-select"
                  >
                    {t(
                      "renderForm.measurement.nodeLabel"
                    )}
                  </label>

                  <select
                    id="measurement-node-select"
                    className="form-input"
                    value={
                      selectedMeasurementNodeKey
                    }
                    onChange={(event) =>
                      onMeasurementNodeChange(
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      {t(
                        "renderForm.measurement.nodePlaceholder"
                      )}
                    </option>

                    {measurementNodes.map(
                      (node) => (
                        <option
                          key={node.nodeKey}
                          value={node.nodeKey}
                        >
                          {node.displayName}
                          {" · "}
                          {
                            node.hardwareProfile
                              ?.name
                          }
                          {node.validationOnly
                            ? ` · ${t(
                                "renderForm.measurement.validationOnly"
                              )}`
                            : ""}
                        </option>
                      )
                    )}
                  </select>
                </>
              )}

            {selectedNode && (
              <div className="measurement-node-summary">
                <strong>
                  {selectedNode.displayName}
                </strong>

                <span>
                  {t(
                    "renderForm.measurement.nodeProfile",
                    {
                      profile:
                        selectedNode
                          .hardwareProfile
                          ?.name || "—",
                    }
                  )}
                </span>

                <small>
                  {t(
                    "renderForm.measurement.pinnedNoFallback"
                  )}
                </small>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rf-panel">
        <div className="form-label">
          <Gauge
            size={18}
            strokeWidth={1.9}
          />
          {t(
            "renderForm.measurement.profileLabel"
          )}
        </div>

        <p className="profile-section-help">
          {t(
            "renderForm.measurement.profileHelp"
          )}
        </p>

        <div
          className="execution-options"
          role="radiogroup"
          aria-label={t(
            "renderForm.measurement.profileLabel"
          )}
        >
          {executionProfiles.map(
            (profile) => {
              const ProfileIcon =
                profileIcons[profile.id] ||
                Gauge;

              return (
                <label
                  key={profile.id}
                  className={
                    `execution-option ${
                      executionProfile ===
                      profile.id
                        ? "selected"
                        : ""
                    }`
                  }
                >
                  <input
                    type="radio"
                    name="executionProfile"
                    value={profile.id}
                    checked={
                      executionProfile ===
                      profile.id
                    }
                    onChange={(event) =>
                      onExecutionProfileChange(
                        event.target.value
                      )
                    }
                  />

                  <div className="execution-body">
                    <div className="execution-profile-heading">
                      <span className="execution-name">
                        <ProfileIcon
                          size={15}
                          strokeWidth={1.9}
                        />
                        {profileText(
                          profile,
                          "name",
                          t
                        )}
                      </span>

                      {profile.badge && (
                        <span className="profile-badge">
                          {profileText(
                            profile,
                            "badge",
                            t
                          )}
                        </span>
                      )}
                    </div>

                    <span className="execution-description">
                      {profileText(
                        profile,
                        "description",
                        t
                      )}
                    </span>

                    <span className="execution-profile-meta">
                      {typeof profile.samples ===
                      "number"
                        ? t(
                            "renderForm.measurement.repetitions",
                            {
                              count:
                                profile.samples,
                            }
                          )
                        : t(
                            "renderForm.measurement.manualRepetitions"
                          )}
                    </span>
                  </div>
                </label>
              );
            }
          )}
        </div>
      </section>
    </div>
  );
}

export default MeasurementAndProfileSection;
