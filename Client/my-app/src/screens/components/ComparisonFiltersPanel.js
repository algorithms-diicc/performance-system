import React from "react";
import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useI18n } from "../../i18n";

function ComparisonFiltersPanel({
  aggregation,
  onAggregationChange,
  showDispersion,
  onDispersionChange,
  xScale,
  onXScaleChange,
  canUseLogScale,
  inputRange,
  onRangeChange,
  onReset,
  activeFilterCount,
}) {
  const { t } = useI18n();
  const domain = Array.isArray(inputRange?.domain)
    ? inputRange.domain
    : [];
  const multipleInputSizes = domain.length > 1;

  const handleMinimum = (value) => {
    const minimum = Number(value);
    const maximum =
      inputRange?.maximum !== null &&
      inputRange?.maximum !== undefined &&
      minimum > inputRange.maximum
        ? minimum
        : inputRange?.maximum;
    onRangeChange({ minimum, maximum });
  };

  const handleMaximum = (value) => {
    const maximum = Number(value);
    const minimum =
      inputRange?.minimum !== null &&
      inputRange?.minimum !== undefined &&
      maximum < inputRange.minimum
        ? maximum
        : inputRange?.minimum;
    onRangeChange({ minimum, maximum });
  };

  return (
    <section
      className="comparison-page__filters-panel"
      aria-labelledby="comparison-filters-title"
    >
      <div className="comparison-page__filters-header">
        <div>
          <span className="comparison-page__eyebrow">
            {t("comparisonPage.filters.eyebrow")}
          </span>
          <h3 id="comparison-filters-title">
            {t("comparisonPage.filters.title")}
          </h3>
          <p>{t("comparisonPage.filters.description")}</p>
        </div>
        <div className="comparison-page__filters-actions">
          <span className="comparison-page__filters-count" aria-live="polite">
            {t("comparisonPage.filters.activeCount", {
              count: activeFilterCount,
            })}
          </span>
          <button
            type="button"
            className="comparison-page__filters-reset"
            onClick={onReset}
            disabled={activeFilterCount === 0}
          >
            <RotateCcw size={14} aria-hidden="true" />
            {t("comparisonPage.filters.reset")}
          </button>
        </div>
      </div>

      <div className="comparison-page__filter-grid">
        <fieldset className="comparison-page__filter-group">
          <legend>{t("comparisonPage.filters.aggregation")}</legend>
          <div className="comparison-page__segmented-control">
            {[
              ["median", "median"],
              ["mean", "mean"],
            ].map(([value, key]) => (
              <label
                key={value}
                className={
                  aggregation === value
                    ? "comparison-page__segment comparison-page__segment--active"
                    : "comparison-page__segment"
                }
              >
                <input
                  type="radio"
                  name="comparison-filter-aggregation"
                  value={value}
                  checked={aggregation === value}
                  onChange={() => onAggregationChange(value)}
                />
                <span>{t(`comparisonPage.filters.${key}`)}</span>
              </label>
            ))}
          </div>
          <small>{t("comparisonPage.filters.aggregationHelp")}</small>
        </fieldset>

        <fieldset className="comparison-page__filter-group">
          <legend>{t("comparisonPage.filters.dispersion")}</legend>
          <label className="comparison-page__filter-check">
            <input
              type="checkbox"
              checked={showDispersion}
              onChange={(event) =>
                onDispersionChange(event.target.checked)
              }
            />
            <span>{t("comparisonPage.filters.showDispersion")}</span>
          </label>
          <small>
            {t(
              aggregation === "mean"
                ? "comparisonPage.filters.dispersionMeanHelp"
                : "comparisonPage.filters.dispersionMedianHelp"
            )}
          </small>
        </fieldset>

        <fieldset className="comparison-page__filter-group">
          <legend>{t("comparisonPage.filters.horizontalScale")}</legend>
          <div className="comparison-page__segmented-control">
            <label
              className={
                xScale === "linear"
                  ? "comparison-page__segment comparison-page__segment--active"
                  : "comparison-page__segment"
              }
            >
              <input
                type="radio"
                name="comparison-filter-x-scale"
                value="linear"
                checked={xScale === "linear"}
                onChange={() => onXScaleChange("linear")}
              />
              <span>{t("comparisonPage.filters.linear")}</span>
            </label>
            <label
              className={
                xScale === "log"
                  ? "comparison-page__segment comparison-page__segment--active"
                  : "comparison-page__segment"
              }
            >
              <input
                type="radio"
                name="comparison-filter-x-scale"
                value="log"
                checked={xScale === "log"}
                disabled={!canUseLogScale}
                onChange={() => onXScaleChange("log")}
              />
              <span>{t("comparisonPage.filters.logarithmic")}</span>
            </label>
          </div>
          <small>
            {canUseLogScale
              ? t("comparisonPage.filters.horizontalScaleHelp")
              : t("comparisonPage.filters.logUnavailable")}
          </small>
        </fieldset>

        <fieldset className="comparison-page__filter-group">
          <legend>{t("comparisonPage.filters.inputRange")}</legend>
          <div className="comparison-page__range-controls">
            <SlidersHorizontal size={16} aria-hidden="true" />
            <label>
              <span>{t("comparisonPage.chart.minimumInputSize")}</span>
              <select
                value={inputRange?.minimum ?? ""}
                disabled={!multipleInputSizes}
                onChange={(event) =>
                  handleMinimum(event.target.value)
                }
              >
                {domain.map((inputSize) => (
                  <option
                    key={`comparison-filter-min-${inputSize}`}
                    value={inputSize}
                  >
                    {inputSize}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("comparisonPage.chart.maximumInputSize")}</span>
              <select
                value={inputRange?.maximum ?? ""}
                disabled={!multipleInputSizes}
                onChange={(event) =>
                  handleMaximum(event.target.value)
                }
              >
                {domain.map((inputSize) => (
                  <option
                    key={`comparison-filter-max-${inputSize}`}
                    value={inputSize}
                  >
                    {inputSize}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="comparison-page__range-reset"
              disabled={!multipleInputSizes}
              onClick={() =>
                onRangeChange({
                  minimum: null,
                  maximum: null,
                })
              }
            >
              {t("comparisonPage.chart.resetRange")}
            </button>
          </div>
          <small>{t("comparisonPage.filters.rangeHelp")}</small>
        </fieldset>
      </div>
    </section>
  );
}

export default ComparisonFiltersPanel;
