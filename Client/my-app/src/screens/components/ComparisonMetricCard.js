import React from "react";
import Plot from "react-plotly.js";

import { useI18n } from "../../i18n";
import {
  buildComparisonTraces,
  humanMetricLabel,
} from "../comparisonModel";
import {
  buildPlotExportConfig,
} from "../plotExportModel";

function ComparisonMetricCard({
  metric,
  metricData,
  aggregation,
  showDispersion,
  minimum,
  maximum,
  xScale = "linear",
  plotTheme,
}) {
  const { t } = useI18n();
  const traces = buildComparisonTraces({
    metricData,
    aggregation,
    showDispersion,
    minimum,
    maximum,
    t,
  });
  const hasPoints = traces.some(
    (trace) => Array.isArray(trace?.y) && trace.y.length > 0
  );
  const label = humanMetricLabel(metric, t);
  const unit = String(metricData?.unit || "").trim();

  return (
    <article className="comparison-page__metric-card">
      <header className="comparison-page__metric-card-header">
        <div>
          <span className="comparison-page__metric-card-eyebrow">
            {t("comparisonPage.explorer.metricEyebrow")}
          </span>
          <h3>{label}</h3>
        </div>
        {unit && (
          <span className="comparison-page__metric-unit">{unit}</span>
        )}
      </header>

      {!hasPoints ? (
        <div className="comparison-page__metric-empty">
          {t("comparisonPage.explorer.noPoints")}
        </div>
      ) : (
        <div
          className="comparison-page__metric-plot"
          role="img"
          aria-label={t("comparisonPage.explorer.plotAria", { metric: label })}
        >
          <Plot
            data={traces}
            layout={{
              autosize: true,
              paper_bgcolor: plotTheme.surface,
              plot_bgcolor: plotTheme.surface,
              colorway: plotTheme.colorway,
              font: {
                color: plotTheme.textSecondary,
                family: plotTheme.fontFamily,
                size: 11,
              },
              margin: { l: 62, r: 18, t: 18, b: 62 },
              xaxis: {
                type:
                  xScale === "log"
                    ? "log"
                    : "linear",
                title: { text: "InputSize" },
                automargin: true,
                gridcolor: plotTheme.divider,
                linecolor: plotTheme.borderStrong,
                tickfont: { color: plotTheme.textSecondary },
                titlefont: { color: plotTheme.text },
              },
              yaxis: {
                title: { text: unit || label },
                automargin: true,
                gridcolor: plotTheme.divider,
                zerolinecolor: plotTheme.borderStrong,
                linecolor: plotTheme.borderStrong,
                tickfont: { color: plotTheme.textSecondary },
                titlefont: { color: plotTheme.text },
              },
              legend: {
                orientation: "h",
                x: 0,
                y: -0.2,
                font: { color: plotTheme.textSecondary },
                bgcolor: plotTheme.surface,
              },
              showlegend: true,
            }}
            config={buildPlotExportConfig({
                scope: "comparison",
                label,
              })}
            useResizeHandler
            className="comparison-page__metric-plot-element"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      )}
    </article>
  );
}

export default ComparisonMetricCard;
