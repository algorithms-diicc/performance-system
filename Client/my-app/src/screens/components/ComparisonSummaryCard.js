import React from "react";
import { Info } from "lucide-react";

import { useI18n } from "../../i18n";
import {
  buildUniqueSeriesLabels,
  humanMetricLabel,
} from "../comparisonModel";

const WIDTH = 260;
const HEIGHT = 78;
const PADDING = 7;

const formatValue = (
  value,
  unit,
  locale
) => {
  const numeric =
    typeof value === "number" &&
    Number.isFinite(value)
      ? value
      : null;

  if (numeric === null) {
    return "—";
  }

  const formatted = new Intl.NumberFormat(
    locale || "es-CL",
    {
      maximumSignificantDigits: 5,
    }
  ).format(numeric);
  const normalizedUnit =
    String(unit || "").trim();

  return normalizedUnit
    ? `${formatted} ${normalizedUnit}`
    : formatted;
};

export const buildSummarySparklineGeometry = (
  series
) => {
  const safeSeries = Array.isArray(series)
    ? series
    : [];
  const allPoints = safeSeries.flatMap(
    (item) =>
      Array.isArray(item?.points)
        ? item.points
        : []
  );

  if (!allPoints.length) {
    return [];
  }

  const xValues = allPoints
    .map((point) => Number(point?.inputSize))
    .filter(Number.isFinite);
  const yValues = allPoints
    .map((point) => Number(point?.value))
    .filter(Number.isFinite);

  if (!xValues.length || !yValues.length) {
    return [];
  }

  const minX = Math.min(...xValues);
  const maxX = Math.max(...xValues);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  const drawableWidth =
    WIDTH - 2 * PADDING;
  const drawableHeight =
    HEIGHT - 2 * PADDING;

  return safeSeries.map((item) => {
    const points = (
      Array.isArray(item?.points)
        ? item.points
        : []
    )
      .map((point) => {
        const xValue =
          Number(point?.inputSize);
        const yValue =
          Number(point?.value);

        if (
          !Number.isFinite(xValue) ||
          !Number.isFinite(yValue)
        ) {
          return null;
        }

        const x =
          minX === maxX
            ? WIDTH / 2
            : PADDING +
              ((xValue - minX) /
                (maxX - minX)) *
                drawableWidth;
        const y =
          minY === maxY
            ? HEIGHT / 2
            : PADDING +
              (1 -
                (yValue - minY) /
                  (maxY - minY)) *
                drawableHeight;

        return { x, y };
      })
      .filter(Boolean);

    return {
      points,
      polyline: points
        .map(
          (point) =>
            `${point.x.toFixed(2)},${point.y.toFixed(2)}`
        )
        .join(" "),
    };
  });
};

function ComparisonSummaryCard({ card }) {
  const { locale, t } = useI18n();

  if (!card?.available) {
    return (
      <article className="comparison-page__summary-card comparison-page__summary-card--unavailable">
        <div className="comparison-page__summary-card-header">
          <strong>
            {humanMetricLabel(
              card?.metric,
              t
            )}
          </strong>
          <span className="comparison-page__summary-availability comparison-page__summary-availability--unavailable">
            {t(
              "comparisonPage.summary.unavailableBadge"
            )}
          </span>
        </div>

        <div className="comparison-page__summary-unavailable">
          <Info
            size={18}
            aria-hidden="true"
          />
          <p>
            {t(
              "comparisonPage.summary.unavailableDescription"
            )}
          </p>
        </div>
      </article>
    );
  }

  const labels = buildUniqueSeriesLabels(
    card.series,
    t
  );
  const geometry =
    buildSummarySparklineGeometry(
      card.series
    );
  const metricLabel =
    humanMetricLabel(
      card.metric,
      t
    );
  const trendLabel = t(
    "comparisonPage.summary.trendAria",
    {
      metric: metricLabel,
    }
  );

  return (
    <article className="comparison-page__summary-card">
      <div className="comparison-page__summary-card-header">
        <strong>{metricLabel}</strong>
        <span className="comparison-page__summary-input">
          {t(
            "comparisonPage.summary.inputSize",
            {
              inputSize: card.inputSize,
            }
          )}
        </span>
      </div>

      <div className="comparison-page__summary-sparkline">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={trendLabel}
          preserveAspectRatio="none"
        >
          <title>{trendLabel}</title>
          <line
            className="comparison-page__summary-gridline"
            x1={PADDING}
            x2={WIDTH - PADDING}
            y1={HEIGHT - PADDING}
            y2={HEIGHT - PADDING}
          />
          {geometry.map(
            (item, index) =>
              item.points.length > 1 ? (
                <polyline
                  key={`line-${index}`}
                  className={`comparison-page__summary-line comparison-page__summary-line--${index % 4}`}
                  points={item.polyline}
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              ) : item.points.length === 1 ? (
                <circle
                  key={`point-${index}`}
                  className={`comparison-page__summary-point comparison-page__summary-point--${index % 4}`}
                  cx={item.points[0].x}
                  cy={item.points[0].y}
                  r="3.4"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null
          )}
        </svg>
      </div>

      <div className="comparison-page__summary-series">
        {card.series.map(
          (item, index) => (
            <div
              className="comparison-page__summary-row"
              key={`${
                item.publicId ||
                item.codename ||
                index
              }`}
            >
              <span className="comparison-page__summary-series-label">
                <span
                  className={`comparison-page__summary-swatch comparison-page__summary-swatch--${index % 4}`}
                  aria-hidden="true"
                />
                <span>{labels[index]}</span>
              </span>
              <strong>
                {formatValue(
                  item.value,
                  card.unit,
                  locale
                )}
              </strong>
            </div>
          )
        )}
      </div>

      <div className="comparison-page__summary-card-foot">
        {t(
          "comparisonPage.summary.reportedMedian"
        )}
      </div>
    </article>
  );
}

export default ComparisonSummaryCard;
