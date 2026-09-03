import React from "react";
import {
  Info,
  LoaderCircle,
  Sparkles,
} from "lucide-react";

import { useI18n } from "../../i18n";

import "./IndividualAIAnalysisPanel.css";


const EVIDENCE_KEYS = {
  snapshot: "snapshot",
  trend: "trend",
  observed_scaling: "observedScaling",
  outliers: "outliers",
  coverage: "coverage",
  limitation: "limitation",
  availability: "availability",
};


function translatedOr(
  t,
  key,
  fallback,
  params = {}
) {
  const value = t(key, params);
  return value === key
    ? fallback
    : value;
}


function metricLabel(metric, t) {
  return translatedOr(
    t,
    `renderImageScientific.ai.metrics.${metric}`,
    metric || "—"
  );
}


function evidenceLabel(kind, t) {
  const key =
    EVIDENCE_KEYS[kind];

  if (!key) {
    return kind || "—";
  }

  return translatedOr(
    t,
    `renderImageScientific.ai.evidenceKinds.${key}`,
    kind
  );
}


function providerLabel(provider, t) {
  if (provider === "mock") {
    return t(
      "renderImageScientific.ai.providers.mock"
    );
  }

  if (provider === "openai") {
    return t(
      "renderImageScientific.ai.providers.openai"
    );
  }

  if (provider) {
    return provider;
  }

  return t(
    "renderImageScientific.ai.providers.server"
  );
}


export default function IndividualAIAnalysisPanel({
  explanation,
  loading,
  errorKey,
  onGenerate,
}) {
  const { t } = useI18n();

  const content =
    explanation?.content || null;

  const observations =
    Array.isArray(content?.observations)
      ? content.observations
      : [];

  const limitations =
    Array.isArray(content?.limitations)
      ? content.limitations
      : [];

  const simulated =
    explanation?.simulated === true ||
    explanation?.provider === "mock";

  const errorText =
    errorKey
      ? translatedOr(
          t,
          errorKey,
          t(
            "renderImageScientific.ai.errors.generic"
          )
        )
      : "";

  return (
    <section
      className="individual-ai-panel"
      aria-labelledby="individual-ai-title"
      aria-busy={loading}
    >
      <header className="individual-ai-header">
        <div className="individual-ai-heading">
          <div
            className="individual-ai-icon"
            aria-hidden="true"
          >
            <Sparkles size={18} />
          </div>

          <div>
            <span className="individual-ai-eyebrow">
              {t(
                "renderImageScientific.ai.eyebrow"
              )}
            </span>

            <h2 id="individual-ai-title">
              {t(
                "renderImageScientific.ai.title"
              )}
            </h2>
          </div>
        </div>

        <button
          type="button"
          className="individual-ai-action"
          onClick={onGenerate}
          disabled={loading}
        >
          {loading ? (
            <LoaderCircle
              size={15}
              className="individual-ai-spinner"
              aria-hidden="true"
            />
          ) : (
            <Sparkles
              size={15}
              aria-hidden="true"
            />
          )}

          {loading
            ? t(
                "renderImageScientific.ai.actions.loading"
              )
            : content
            ? t(
                "renderImageScientific.ai.actions.update"
              )
            : t(
                "renderImageScientific.ai.actions.generate"
              )}
        </button>
      </header>

      {loading && (
        <div
          className="individual-ai-loading"
          role="status"
          aria-live="polite"
        >
          <LoaderCircle
            size={17}
            className="individual-ai-spinner"
            aria-hidden="true"
          />
          <span>
            {t("renderImageScientific.ai.actions.loading")}
          </span>
        </div>
      )}

      {!content && !errorText && (
        <div className="individual-ai-intro">
          <p>
            {t(
              "renderImageScientific.ai.intro"
            )}
          </p>

          <span>
            {t(
              "renderImageScientific.ai.privacy"
            )}
          </span>
        </div>
      )}

      {errorText && (
        <div
          className="individual-ai-error"
          role="alert"
        >
          <Info
            size={16}
            aria-hidden="true"
          />

          <span>{errorText}</span>
        </div>
      )}

      {content && (
        <div className="individual-ai-content">
          <div
            className={
              simulated
                ? "individual-ai-mode individual-ai-mode-simulated"
                : "individual-ai-mode individual-ai-mode-real"
            }
            role="status"
          >
            <Sparkles
              size={14}
              aria-hidden="true"
            />

            {simulated
              ? t(
                  "renderImageScientific.ai.status.simulated"
                )
              : t(
                  "renderImageScientific.ai.status.generated"
                )}
          </div>

          <section className="individual-ai-section individual-ai-summary">
            <h3>
              {t(
                "renderImageScientific.ai.sections.summary"
              )}
            </h3>

            <p>{content.summary}</p>
          </section>

          <section className="individual-ai-section">
            <h3>
              {t(
                "renderImageScientific.ai.sections.patterns"
              )}
            </h3>

            {observations.length > 0 ? (
              <div className="individual-ai-patterns">
                {observations.map(
                  (observation, index) => (
                    <article
                      key={`${observation.metric}-${observation.evidence_kind}-${index}`}
                    >
                      <div className="individual-ai-pattern-meta">
                        <strong>
                          {metricLabel(
                            observation.metric,
                            t
                          )}
                        </strong>

                        <span>
                          {evidenceLabel(
                            observation.evidence_kind,
                            t
                          )}
                        </span>
                      </div>

                      <p>
                        {observation.text}
                      </p>
                    </article>
                  )
                )}
              </div>
            ) : (
              <p className="individual-ai-empty">
                {t(
                  "renderImageScientific.ai.emptyPatterns"
                )}
              </p>
            )}
          </section>

          <section className="individual-ai-section individual-ai-takeaway">
            <h3>
              {t(
                "renderImageScientific.ai.sections.observe"
              )}
            </h3>

            <p>
              {content.student_takeaway}
            </p>
          </section>

          <section className="individual-ai-section individual-ai-limitations">
            <h3>
              {t(
                "renderImageScientific.ai.sections.limitations"
              )}
            </h3>

            {limitations.length > 0 ? (
              <ul>
                {limitations.map(
                  (limitation, index) => (
                    <li key={index}>
                      {limitation}
                    </li>
                  )
                )}
              </ul>
            ) : (
              <p className="individual-ai-empty">
                {t(
                  "renderImageScientific.ai.emptyLimitations"
                )}
              </p>
            )}
          </section>

          <footer className="individual-ai-meta">
            <span>
              {t(
                "renderImageScientific.ai.meta.provider",
                {
                  provider: providerLabel(
                    explanation?.provider,
                    t
                  ),
                }
              )}
            </span>

            <span>
              {t(
                "renderImageScientific.ai.meta.model",
                {
                  model:
                    explanation?.model ||
                    t(
                      "renderImageScientific.ai.providers.server"
                    ),
                }
              )}
            </span>

            <span>
              {explanation?.cached
                ? t(
                    "renderImageScientific.ai.status.cached"
                  )
                : t(
                    "renderImageScientific.ai.status.fresh"
                  )}
            </span>

            <span>
              {t(
                "renderImageScientific.ai.meta.codeNotSent"
              )}
            </span>

            <span>
              {t(
                "renderImageScientific.ai.meta.csvNotSent"
              )}
            </span>
          </footer>
        </div>
      )}
    </section>
  );
}
