import React, { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Info } from "lucide-react";

import { useI18n } from "../../i18n";
import { humanMetricLabel } from "../comparisonModel";

const TARGET_ORDER = [
  "DurationTime",
  "IPC",
  "CacheMissRate",
  "BranchMissRate",
  "EnergyPkg",
];

const EMPTY_SERIES = [];

const finiteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : null;

const formatNumber = (value, locale) => {
  const number = finiteNumber(value);
  if (number === null) return "—";
  return new Intl.NumberFormat(
    locale === "en" ? "en-US" : "es-CL",
    { maximumSignificantDigits: 5 }
  ).format(number);
};

const formatValue = (value, unit, locale) => {
  const formatted = formatNumber(value, locale);
  if (formatted === "—") return formatted;
  return unit ? `${formatted} ${unit}` : formatted;
};

const metricMeaning = (metric, t) =>
  t(`comparisonModel.metrics.${metric}.interpretation`);

const seriesLabels = (series, t) => {
  const raw = (Array.isArray(series) ? series : []).map(
    (item, index) =>
      String(
        item?.source_filename ||
          item?.codename ||
          t("comparisonPage.pedagogy.implementation", {
            index: index + 1,
          })
      ).trim()
  );
  const counts = raw.reduce((result, label) => {
    result[label] = (result[label] || 0) + 1;
    return result;
  }, {});

  return raw.map((label, index) => {
    if (counts[label] <= 1) return label;
    const codename = String(series?.[index]?.codename || "").trim();
    return codename && codename !== label
      ? `${label} · ${codename}`
      : `${label} · ${index + 1}`;
  });
};

const directionLabel = (direction, t) =>
  t(
    `comparisonPage.pedagogy.directions.${
      ["increased", "decreased", "unchanged"].includes(direction)
        ? direction
        : "unavailable"
    }`
  );

function ComparisonPedagogyCard({ item, scopeInputSizes }) {
  const { locale, t } = useI18n();
  const [expanded, setExpanded] = useState(false);

  const observationSeries = Array.isArray(item?.observation?.series)
    ? item.observation.series
    : EMPTY_SERIES;
  const trendSeries = Array.isArray(item?.trend?.series)
    ? item.trend.series
    : [];
  const variabilitySeries = Array.isArray(item?.variability?.series)
    ? item.variability.series
    : [];
  const labels = useMemo(
    () => seriesLabels(observationSeries, t),
    [observationSeries, t]
  );

  const metricInputSizes = Array.isArray(item?.common_input_sizes)
    ? item.common_input_sizes
    : [];
  const hasPartialMetricCoverage =
    scopeInputSizes.length > 0 &&
    metricInputSizes.length > 0 &&
    metricInputSizes.length < scopeInputSizes.length;
  const hasSpecificLimitations =
    Array.isArray(item?.specific_issues) &&
    item.specific_issues.length > 0;
  const detailSections =
    2 + (hasPartialMetricCoverage || hasSpecificLimitations ? 1 : 0);
  const panelId = `comparison-pedagogy-${String(
    item?.metric || "metric"
  ).replace(/[^A-Za-z0-9_-]/g, "-")}`;

  return (
    <article className="comparison-page__pedagogy-card">
      <div className="comparison-page__pedagogy-card-header">
        <div>
          <span className="comparison-page__pedagogy-card-eyebrow">
            {t("comparisonPage.pedagogy.metric")}
          </span>
          <h3>{humanMetricLabel(item.metric, t)}</h3>
        </div>
        {item?.unit && (
          <span className="comparison-page__pedagogy-unit">
            {item.unit}
          </span>
        )}
      </div>

      <div className="comparison-page__pedagogy-block">
        <strong>{t("comparisonPage.pedagogy.whatItRepresents")}</strong>
        <p>{metricMeaning(item.metric, t)}</p>
      </div>

      <div className="comparison-page__pedagogy-block">
        <strong>{t("comparisonPage.pedagogy.whatWasObserved")}</strong>
        <p className="comparison-page__pedagogy-observation-title">
          {t("comparisonPage.pedagogy.observedAt", {
            inputSize: item?.observation?.input_size,
          })}
        </p>
        <div className="comparison-page__pedagogy-values">
          {observationSeries.map((series, index) => (
            <div
              key={`${series?.public_id || series?.codename || index}`}
              className="comparison-page__pedagogy-value-row"
            >
              <span>{labels[index]}</span>
              <strong>
                {formatValue(series?.median, item?.unit, locale)}
              </strong>
            </div>
          ))}
        </div>
      </div>

      <div className="comparison-page__pedagogy-disclosure">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((value) => !value)}
        >
          <span>
            <strong>{t("comparisonPage.pedagogy.details")}</strong>
            <small>
              {t("comparisonPage.pedagogy.detailsHint", {
                count: detailSections,
              })}
            </small>
          </span>
          <span className="comparison-page__pedagogy-disclosure-action">
            {t(
              expanded
                ? "comparisonPage.pedagogy.hide"
                : "comparisonPage.pedagogy.show"
            )}
            <ChevronDown
              size={15}
              className={expanded ? "is-expanded" : ""}
              aria-hidden="true"
            />
          </span>
        </button>

        {expanded && (
          <div
            id={panelId}
            className="comparison-page__pedagogy-details"
          >
            <section>
              <strong>{t("comparisonPage.pedagogy.trend")}</strong>
              {Number(item?.trend?.points_available) <= 1 ? (
                <p>{t("comparisonPage.pedagogy.noTrend")}</p>
              ) : (
                <div className="comparison-page__pedagogy-detail-list">
                  {trendSeries.map((series, index) => (
                    <p
                      key={`trend-${
                        series?.public_id || series?.codename || index
                      }`}
                    >
                      <b>
                        {labels[index] ||
                          series?.source_filename ||
                          series?.codename}
                      </b>
                      {" — "}
                      {t("comparisonPage.pedagogy.trendLine", {
                        firstInput: series?.first?.input_size,
                        lastInput: series?.last?.input_size,
                        direction: directionLabel(
                          series?.median_direction,
                          t
                        ),
                        firstValue: formatValue(
                          series?.first?.median,
                          item?.unit,
                          locale
                        ),
                        lastValue: formatValue(
                          series?.last?.median,
                          item?.unit,
                          locale
                        ),
                      })}
                    </p>
                  ))}
                </div>
              )}
            </section>

            <section>
              <strong>{t("comparisonPage.pedagogy.variability")}</strong>
              <div className="comparison-page__pedagogy-detail-list">
                {variabilitySeries.map((series, index) => {
                  const q1 = finiteNumber(series?.q1);
                  const q3 = finiteNumber(series?.q3);
                  const stddev = finiteNumber(series?.stddev);
                  const available =
                    q1 !== null || q3 !== null || stddev !== null;

                  return (
                    <p
                      key={`variability-${
                        series?.public_id || series?.codename || index
                      }`}
                    >
                      <b>
                        {labels[index] ||
                          series?.source_filename ||
                          series?.codename}
                      </b>
                      {" — "}
                      {available
                        ? t("comparisonPage.pedagogy.variabilityLine", {
                            inputSize:
                              item?.variability?.input_size,
                            q1: formatValue(q1, item?.unit, locale),
                            q3: formatValue(q3, item?.unit, locale),
                            stddev: formatValue(
                              stddev,
                              item?.unit,
                              locale
                            ),
                          })
                        : t(
                            "comparisonPage.pedagogy.variabilityUnavailable"
                          )}
                    </p>
                  );
                })}
              </div>
            </section>

            {(hasPartialMetricCoverage || hasSpecificLimitations) && (
              <section>
                <strong>
                  {t("comparisonPage.pedagogy.limitations")}
                </strong>
                {hasPartialMetricCoverage && (
                  <p>
                    {t(
                      "comparisonPage.pedagogy.partialMetricCoverage",
                      {
                        metricCount: metricInputSizes.length,
                        scopeCount: scopeInputSizes.length,
                      }
                    )}
                  </p>
                )}
                {hasSpecificLimitations && (
                  <p>
                    {t("comparisonPage.pedagogy.metricWarnings", {
                      count: item.specific_issues.length,
                    })}
                  </p>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function ComparisonPedagogyPanel({ pedagogy }) {
  const { t } = useI18n();

  const metricMap =
    pedagogy?.metrics && typeof pedagogy.metrics === "object"
      ? pedagogy.metrics
      : {};
  const scopeInputSizes = Array.isArray(
    pedagogy?.scope?.common_input_sizes
  )
    ? pedagogy.scope.common_input_sizes
    : [];
  const issues = Array.isArray(pedagogy?.limitations?.issues)
    ? pedagogy.limitations.issues
    : [];
  const excludedMetrics = Array.isArray(
    pedagogy?.limitations?.excluded_metrics
  )
    ? pedagogy.limitations.excluded_metrics
    : [];

  const items = TARGET_ORDER.map((metric) => metricMap[metric])
    .filter(Boolean)
    .map((item) => ({
      ...item,
      specific_issues: issues.filter(
        (issue) => issue?.metric === item?.metric
      ),
    }));

  if (items.length === 0) return null;

  const hasScopeLimitations =
    issues.length > 0 || excludedMetrics.length > 0;
  const excludedLabels = excludedMetrics
    .map((item) => item?.metric)
    .filter(Boolean)
    .map((metric) => humanMetricLabel(metric, t));

  return (
    <section
      id="comparison-interpretation"
      className="comparison-page__section comparison-page__pedagogy comparison-page__major-section"
      aria-labelledby="comparison-pedagogy-title"
    >
      <div className="comparison-page__section-heading comparison-page__pedagogy-heading">
        <div>
          <span className="comparison-page__eyebrow">
            {t("comparisonPage.pedagogy.eyebrow")}
          </span>
          <h2 id="comparison-pedagogy-title">
            {t("comparisonPage.pedagogy.title")}
          </h2>
          <p className="comparison-page__section-description">
            {t("comparisonPage.pedagogy.description")}
          </p>
        </div>
        <span className="comparison-page__pedagogy-method">
          <CheckCircle2 size={14} aria-hidden="true" />
          {t("comparisonPage.pedagogy.deterministic")}
        </span>
      </div>

      {hasScopeLimitations && (
        <div className="comparison-page__pedagogy-scope">
          <Info size={16} aria-hidden="true" />
          <div>
            <strong>{t("comparisonPage.pedagogy.scopeTitle")}</strong>
            <p>{t("comparisonPage.pedagogy.scopeText")}</p>
            {excludedLabels.length > 0 && (
              <small>
                {t("comparisonPage.pedagogy.excludedMetrics", {
                  metrics: excludedLabels.join(", "),
                })}
              </small>
            )}
          </div>
        </div>
      )}

      <div className="comparison-page__pedagogy-grid">
        {items.map((item) => (
          <ComparisonPedagogyCard
            key={item.metric}
            item={item}
            scopeInputSizes={scopeInputSizes}
          />
        ))}
      </div>

      <div className="comparison-page__pedagogy-principle">
        <Info size={14} aria-hidden="true" />
        <span>{t("comparisonPage.pedagogy.principle")}</span>
      </div>
    </section>
  );
}

export default ComparisonPedagogyPanel;
