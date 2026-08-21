import React from "react";
import {
  ChevronDown,
  Info,
} from "lucide-react";

import { useI18n } from "../../i18n";
import {
  COMPARISON_DIMENSIONS,
  comparisonDimensionLabel,
  comparisonDimensionPresentation,
  humanMetricLabel,
} from "../comparisonModel";

const issueCode = (issue) =>
  String(issue?.code || "").trim().toUpperCase();

const issueDimension = (issue) =>
  String(issue?.dimension || "").trim();

const issueMetric = (issue) =>
  String(issue?.metric || "").trim();

const localizedIssueMessage = (issue, t) => {
  const code = issueCode(issue);
  const key =
    `comparisonPage.auditDetails.issueMessages.${code}`;
  const translated = code ? t(key) : "";

  if (translated && translated !== key) {
    return translated;
  }

  return t("comparisonPage.auditDetails.unknownIssue", {
    code: code || "UNKNOWN",
  });
};

const localizedExclusionReason = (item, t) => {
  const code = String(item?.reasonCode || "")
    .trim()
    .toUpperCase();
  const key =
    `comparisonPage.auditDetails.excludedReasons.${code}`;
  const translated = code ? t(key) : "";

  if (translated && translated !== key) {
    return translated;
  }

  return t(
    "comparisonPage.auditDetails.unknownExclusion",
    {
      code: code || "UNKNOWN",
    }
  );
};

function AuditSummaryChip({
  value,
  label,
  tone = "neutral",
}) {
  return (
    <span
      className={`comparison-page__audit-summary-chip comparison-page__audit-summary-chip--${tone}`}
    >
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}

function AuditIssue({ issue, severity }) {
  const { t } = useI18n();
  const dimension = issueDimension(issue);
  const metric = issueMetric(issue);
  const meta = [
    dimension
      ? comparisonDimensionLabel(dimension, t)
      : null,
    metric ? humanMetricLabel(metric, t) : null,
  ].filter(Boolean);

  return (
    <article
      className={`comparison-page__audit-issue comparison-page__audit-issue--${severity}`}
    >
      <div className="comparison-page__audit-issue-heading">
        <span>
          {t(
            severity === "danger"
              ? "comparisonPage.observations.blocker"
              : "comparisonPage.observations.limitation"
          )}
        </span>
        {issueCode(issue) && (
          <code>{issueCode(issue)}</code>
        )}
      </div>
      {meta.length > 0 && (
        <p className="comparison-page__audit-issue-meta">
          {meta.join(" · ")}
        </p>
      )}
      <p>{localizedIssueMessage(issue, t)}</p>
    </article>
  );
}

function ComparisonAuditPanel({
  compatibility,
  open,
  onToggle,
}) {
  const { t } = useI18n();
  const source =
    compatibility &&
    typeof compatibility === "object"
      ? compatibility
      : {};

  const blockers = Array.isArray(source.blockers)
    ? source.blockers
    : [];
  const warnings = Array.isArray(source.warnings)
    ? source.warnings
    : [];
  const excludedMetrics = Array.isArray(
    source.excludedMetrics
  )
    ? source.excludedMetrics
    : [];

  const excludedMetricNames = new Set(
    excludedMetrics
      .map((item) =>
        String(item?.metric || "").trim()
      )
      .filter(Boolean)
  );

  const scopeWarnings = warnings.filter(
    (issue) => issueDimension(issue) !== "metrics"
  );
  const metricWarnings = warnings.filter(
    (issue) =>
      issueDimension(issue) === "metrics" &&
      !excludedMetricNames.has(issueMetric(issue))
  );
  const visibleWarningCount =
    scopeWarnings.length + metricWarnings.length;

  const dimensions = COMPARISON_DIMENSIONS.filter(
    ([key]) =>
      source?.dimensions?.[key] &&
      typeof source.dimensions[key] === "object"
  );

  const hasObservations =
    blockers.length > 0 || scopeWarnings.length > 0;
  const hasCoverage =
    metricWarnings.length > 0 ||
    excludedMetrics.length > 0;

  return (
    <section
      id="comparison-audit"
      className="comparison-page__section comparison-page__audit comparison-page__major-section"
      aria-labelledby="comparison-audit-title"
    >
      <div className="comparison-page__audit-header">
        <div className="comparison-page__audit-header-main">
          <span className="comparison-page__eyebrow">
            {t("comparisonPage.audit.eyebrow")}
          </span>
          <h2 id="comparison-audit-title">
            {t("comparisonPage.audit.title")}
          </h2>
          <p className="comparison-page__section-description">
            {t("comparisonPage.audit.description")}
          </p>

          <div
            className="comparison-page__audit-summary"
            aria-label={t(
              "comparisonPage.auditDetails.summaryAria"
            )}
          >
            <AuditSummaryChip
              value={dimensions.length}
              label={t(
                "comparisonPage.auditDetails.summary.dimensions"
              )}
            />
            <AuditSummaryChip
              value={blockers.length}
              label={t(
                "comparisonPage.auditDetails.summary.blockers"
              )}
              tone={
                blockers.length > 0
                  ? "danger"
                  : "neutral"
              }
            />
            <AuditSummaryChip
              value={visibleWarningCount}
              label={t(
                "comparisonPage.auditDetails.summary.warnings"
              )}
              tone={
                visibleWarningCount > 0
                  ? "warning"
                  : "neutral"
              }
            />
            <AuditSummaryChip
              value={excludedMetrics.length}
              label={t(
                "comparisonPage.auditDetails.summary.excluded"
              )}
              tone={
                excludedMetrics.length > 0
                  ? "info"
                  : "neutral"
              }
            />
          </div>
        </div>

        <button
          type="button"
          className="comparison-page__button comparison-page__button--secondary comparison-page__audit-toggle"
          aria-expanded={open}
          aria-controls="comparison-audit-body"
          onClick={onToggle}
        >
          {t(
            open
              ? "comparisonPage.audit.hide"
              : "comparisonPage.audit.show"
          )}
          <ChevronDown
            size={16}
            className={open ? "is-expanded" : ""}
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        id="comparison-audit-body"
        className="comparison-page__audit-body"
        hidden={!open}
      >
        <section
          className="comparison-page__audit-group"
          aria-labelledby="comparison-dimensions-title"
        >
          <div className="comparison-page__audit-group-heading">
            <div>
              <span className="comparison-page__eyebrow">
                {t("comparisonPage.dimensions.eyebrow")}
              </span>
              <h3 id="comparison-dimensions-title">
                {t("comparisonPage.dimensions.title")}
              </h3>
            </div>
            <span className="comparison-page__audit-group-count">
              {dimensions.length}
            </span>
          </div>

          <dl className="comparison-page__dimension-grid">
            {dimensions.map(([key]) => {
              const presentation =
                comparisonDimensionPresentation(
                  source.dimensions?.[key]?.status,
                  t
                );
              return (
                <div
                  className="comparison-page__dimension"
                  key={key}
                >
                  <dt>
                    {comparisonDimensionLabel(key, t)}
                  </dt>
                  <dd
                    className={`comparison-page__dimension-value comparison-page__dimension-value--${presentation.tone}`}
                  >
                    {presentation.label}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>

        {hasObservations && (
          <section
            className="comparison-page__audit-group"
            aria-labelledby="comparison-observations-title"
          >
            <div className="comparison-page__audit-group-heading">
              <div>
                <span className="comparison-page__eyebrow">
                  {t(
                    "comparisonPage.observations.eyebrow"
                  )}
                </span>
                <h3 id="comparison-observations-title">
                  {t(
                    "comparisonPage.observations.title"
                  )}
                </h3>
              </div>
              <span className="comparison-page__audit-group-count">
                {blockers.length +
                  scopeWarnings.length}
              </span>
            </div>

            <div className="comparison-page__audit-issues">
              {blockers.map((issue, index) => (
                <AuditIssue
                  key={`blocker-${issueCode(
                    issue
                  )}-${index}`}
                  issue={issue}
                  severity="danger"
                />
              ))}
              {scopeWarnings.map((issue, index) => (
                <AuditIssue
                  key={`warning-${issueCode(
                    issue
                  )}-${index}`}
                  issue={issue}
                  severity="warning"
                />
              ))}
            </div>
          </section>
        )}

        {hasCoverage && (
          <section
            className="comparison-page__audit-group"
            aria-labelledby="comparison-excluded-title"
          >
            <div className="comparison-page__audit-group-heading">
              <div>
                <span className="comparison-page__eyebrow">
                  {t(
                    "comparisonPage.excluded.eyebrow"
                  )}
                </span>
                <h3 id="comparison-excluded-title">
                  {t(
                    "comparisonPage.excluded.title"
                  )}
                </h3>
              </div>
              <span className="comparison-page__audit-group-count">
                {metricWarnings.length +
                  excludedMetrics.length}
              </span>
            </div>

            {metricWarnings.length > 0 && (
              <div className="comparison-page__audit-issues comparison-page__audit-issues--coverage">
                {metricWarnings.map(
                  (issue, index) => (
                    <AuditIssue
                      key={`metric-warning-${issueCode(
                        issue
                      )}-${issueMetric(
                        issue
                      )}-${index}`}
                      issue={issue}
                      severity="warning"
                    />
                  )
                )}
              </div>
            )}

            {excludedMetrics.length > 0 && (
              <ul className="comparison-page__audit-excluded-list">
                {excludedMetrics.map(
                  (item, index) => (
                    <li
                      key={`${item?.metric || "metric"}-${index}`}
                    >
                      <div>
                        <strong>
                          {humanMetricLabel(
                            item?.metric,
                            t
                          )}
                        </strong>
                        <p>
                          {localizedExclusionReason(
                            item,
                            t
                          )}
                        </p>
                      </div>
                      {item?.reasonCode && (
                        <code>
                          {String(
                            item.reasonCode
                          ).toUpperCase()}
                        </code>
                      )}
                    </li>
                  )
                )}
              </ul>
            )}
          </section>
        )}

        {!hasObservations && !hasCoverage && (
          <div className="comparison-page__audit-clean">
            <Info size={16} aria-hidden="true" />
            <p>
              {t(
                "comparisonPage.auditDetails.noAdditionalFindings"
              )}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export default ComparisonAuditPanel;
