import React from "react";
import { Info, Sparkles } from "lucide-react";

import { useI18n } from "../../i18n";

import "./ComparisonAIAnalysisPanel.css";


function providerLabel(provider, t) {
  if (provider === "mock") {
    return t("comparisonPage.ai.providers.mock");
  }
  if (provider === "openai") {
    return t("comparisonPage.ai.providers.openai");
  }
  return (
    provider ||
    t("comparisonPage.ai.providers.server")
  );
}


function MetricTag({ metric, metricLabel }) {
  if (!metric) return null;

  return (
    <span className="comparison-ai-tag">
      {metricLabel(metric)}
    </span>
  );
}


export default function ComparisonAIAnalysisPanel({
  explanation,
  loading,
  errorKey,
  onGenerate,
  available = true,
  unavailableKind = "",
  metricLabel = (metric) => metric || "—",
}) {
  const { t } = useI18n();

  const content =
    explanation?.content &&
    typeof explanation.content === "object"
      ? explanation.content
      : null;

  const patterns = Array.isArray(content?.patterns)
    ? content.patterns
    : [];
  const tradeoffs = Array.isArray(content?.tradeoffs)
    ? content.tradeoffs
    : [];
  const focus = Array.isArray(content?.focus)
    ? content.focus
    : [];
  const limitations = Array.isArray(content?.limitations)
    ? content.limitations
    : [];

  const simulated =
    explanation?.simulated === true ||
    explanation?.provider === "mock";

  const unavailable = available !== true;
  const unavailableBase =
    unavailableKind === "incompatible"
      ? "comparisonPage.ai.unavailable.incompatible"
      : "comparisonPage.ai.unavailable.noEvidence";

  return (
    <section
      id="comparison-ai"
      className="comparison-page__section comparison-page__major-section comparison-ai-panel"
      aria-labelledby="comparison-ai-title"
    >
      <header className="comparison-ai-header">
        <div className="comparison-ai-heading">
          <Sparkles size={20} aria-hidden="true" />
          <div>
            <span className="comparison-page__eyebrow">
              {t("comparisonPage.ai.eyebrow")}
            </span>
            <h2 id="comparison-ai-title">
              {t("comparisonPage.ai.title")}
            </h2>
          </div>
        </div>

        {!unavailable && (
          <button
            type="button"
            className="comparison-ai-action"
            onClick={onGenerate}
            disabled={loading}
          >
            <Sparkles size={15} aria-hidden="true" />
            {t(
              loading
                ? "comparisonPage.ai.actions.loading"
                : explanation
                  ? "comparisonPage.ai.actions.update"
                  : "comparisonPage.ai.actions.generate"
            )}
          </button>
        )}
      </header>

      <p className="comparison-ai-intro">
        {t("comparisonPage.ai.intro")}
      </p>

      <div className="comparison-ai-privacy">
        <Info size={16} aria-hidden="true" />
        <span>
          {t("comparisonPage.ai.privacy")}
        </span>
      </div>

      {unavailable ? (
        <div className="comparison-ai-state" role="status">
          <strong>
            {t(`${unavailableBase}.title`)}
          </strong>
          <p>
            {t(`${unavailableBase}.description`)}
          </p>
        </div>
      ) : (
        <>
          {errorKey && (
            <div
              className="comparison-ai-state comparison-ai-state--error"
              role="alert"
            >
              {t(errorKey)}
            </div>
          )}

          {loading && !content && (
            <div className="comparison-ai-state" role="status">
              {t("comparisonPage.ai.loading")}
            </div>
          )}

          {content && (
            <div className="comparison-ai-content">
              <div className="comparison-ai-status" role="status">
                {t(
                  simulated
                    ? "comparisonPage.ai.status.simulated"
                    : "comparisonPage.ai.status.generated"
                )}
              </div>

              <section className="comparison-ai-block comparison-ai-block--summary">
                <h3>
                  {t("comparisonPage.ai.sections.summary")}
                </h3>
                <p>
                  {content.summary ||
                    t("comparisonPage.ai.empty.summary")}
                </p>
              </section>

              <div className="comparison-ai-grid">
                <section className="comparison-ai-block">
                  <h3>
                    {t("comparisonPage.ai.sections.patterns")}
                  </h3>
                  {patterns.length > 0 ? (
                    <ul>
                      {patterns.map((item, index) => (
                        <li key={index}>
                          <MetricTag
                            metric={item?.metric}
                            metricLabel={metricLabel}
                          />
                          <p>{item?.text}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      {t("comparisonPage.ai.empty.patterns")}
                    </p>
                  )}
                </section>

                <section className="comparison-ai-block">
                  <h3>
                    {t("comparisonPage.ai.sections.tradeoffs")}
                  </h3>
                  {tradeoffs.length > 0 ? (
                    <ul>
                      {tradeoffs.map((item, index) => (
                        <li key={index}>
                          <div className="comparison-ai-tags">
                            {(Array.isArray(item?.metrics)
                              ? item.metrics
                              : []
                            ).map((metric) => (
                              <MetricTag
                                key={metric}
                                metric={metric}
                                metricLabel={metricLabel}
                              />
                            ))}
                          </div>
                          <p>{item?.text}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      {t("comparisonPage.ai.empty.tradeoffs")}
                    </p>
                  )}
                </section>

                <section className="comparison-ai-block">
                  <h3>
                    {t("comparisonPage.ai.sections.focus")}
                  </h3>
                  {focus.length > 0 ? (
                    <ul>
                      {focus.map((item, index) => (
                        <li key={index}>
                          <MetricTag
                            metric={item?.metric}
                            metricLabel={metricLabel}
                          />
                          <p>{item?.text}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      {t("comparisonPage.ai.empty.focus")}
                    </p>
                  )}
                </section>

                <section className="comparison-ai-block">
                  <h3>
                    {t("comparisonPage.ai.sections.limitations")}
                  </h3>
                  {limitations.length > 0 ? (
                    <ul>
                      {limitations.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>
                      {t("comparisonPage.ai.empty.limitations")}
                    </p>
                  )}
                </section>
              </div>

              <footer className="comparison-ai-meta">
                <span>
                  {t("comparisonPage.ai.meta.provider", {
                    provider: providerLabel(
                      explanation?.provider,
                      t
                    ),
                  })}
                </span>
                <span>
                  {t("comparisonPage.ai.meta.model", {
                    model:
                      explanation?.model ||
                      t("comparisonPage.ai.providers.server"),
                  })}
                </span>
                <span>
                  {t(
                    explanation?.cached
                      ? "comparisonPage.ai.status.cached"
                      : "comparisonPage.ai.status.fresh"
                  )}
                </span>
                {explanation?.source?.student_code_sent === false && (
                  <span>
                    {t("comparisonPage.ai.meta.codeNotSent")}
                  </span>
                )}
                {explanation?.source?.raw_csv_sent === false && (
                  <span>
                    {t("comparisonPage.ai.meta.csvNotSent")}
                  </span>
                )}
                {explanation?.source?.browser_metrics_trusted === false && (
                  <span>
                    {t(
                      "comparisonPage.ai.meta.browserMetricsNotTrusted"
                    )}
                  </span>
                )}
                {explanation?.source?.canonical_server_comparison === true && (
                  <span>
                    {t(
                      "comparisonPage.ai.meta.canonicalComparison"
                    )}
                  </span>
                )}
              </footer>
            </div>
          )}
        </>
      )}
    </section>
  );
}
