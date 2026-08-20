import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import Plot from "react-plotly.js";

import InlineState
  from "../components/InlineState";

import {
  useI18n,
} from "../i18n";

import {
  teacherApi,
  teacherRequestErrorMessage,
} from "./teacherApi";


const CHART_CONFIG = {
  displayModeBar: false,
  responsive: true,
};

const COLORS = {
  primary: "#3b82f6",
  cyan: "#06b6d4",
  amber: "#f59e0b",
  emerald: "#10b981",
};


function formatChartDate(
  value,
  locale,
  fallback = "—"
) {
  if (!value) {
    return fallback;
  }

  const parsed =
    new Date(
      `${value}T00:00:00`
    );

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      day: "2-digit",
      month: "short",
    }
  )
    .format(parsed);
}


function participationLabel(
  item,
  t
) {
  const key =
    String(
      item?.key || ""
    ).trim();

  const keys = {
    zero:
      "teacherCourseAnalytics.charts.participation.buckets.zero",
    oneToFour:
      "teacherCourseAnalytics.charts.participation.buckets.oneToFour",
    fiveToNine:
      "teacherCourseAnalytics.charts.participation.buckets.fiveToNine",
    tenOrMore:
      "teacherCourseAnalytics.charts.participation.buckets.tenOrMore",
  };

  return keys[key]
    ? t(keys[key])
    : (
        item?.label ||
        key ||
        "—"
      );
}


function readChartTheme() {
  const fallback = {
    text: "#64748b",
    grid:
      "rgba(100, 116, 139, 0.18)",
  };

  if (
    typeof window === "undefined"
    || typeof document === "undefined"
  ) {
    return fallback;
  }

  const styles =
    window.getComputedStyle(
      document.documentElement
    );

  return {
    text:
      styles.getPropertyValue(
        "--ps-text-secondary"
      ).trim()
      || fallback.text,
    grid:
      styles.getPropertyValue(
        "--ps-divider"
      ).trim()
      || fallback.grid,
  };
}


function ChartCard({
  className = "",
  title,
  description,
  children,
}) {
  return (
    <article
      className={`teacher-chart-card ${className}`.trim()}
    >
      <header>
        <h3>{title}</h3>
        <p>{description}</p>
      </header>

      <div className="teacher-chart-frame">
        {children}
      </div>
    </article>
  );
}


function EmptyChart({
  children,
}) {
  const { t } = useI18n();

  return (
    <div className="teacher-chart-empty">
      <strong>
        {t(
          "teacherCourseAnalytics.empty.title"
        )}
      </strong>
      <span>{children}</span>
    </div>
  );
}


export default function TeacherCourseAnalytics({
  courseId,
  reloadToken,
}) {
  const {
    locale,
    t,
  } = useI18n();

  const [
    analytics,
    setAnalytics,
  ] = useState(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);

  const [
    requestToken,
    setRequestToken,
  ] = useState(0);

  const [
    chartTheme,
    setChartTheme,
  ] = useState(
    () => readChartTheme()
  );


  useEffect(() => {
    const root =
      document.documentElement;

    const observer =
      new MutationObserver(
        (mutations) => {
          if (
            mutations.some(
              (mutation) =>
                mutation.attributeName
                === "data-theme"
            )
          ) {
            setChartTheme(
              readChartTheme()
            );
          }
        }
      );

    observer.observe(
      root,
      {
        attributes: true,
        attributeFilter: [
          "data-theme",
        ],
      }
    );

    return () =>
      observer.disconnect();
  }, []);


  useEffect(() => {
    const controller =
      new AbortController();

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const data =
          await teacherApi(
            `/api/teacher/courses/${courseId}/analytics`,
            {
              signal:
                controller.signal,
            }
          );

        setAnalytics(data);
      } catch (err) {
        if (
          err.name === "AbortError"
        ) {
          return;
        }

        setAnalytics(null);
        setError(err);
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoading(false);
        }
      }
    })();

    return () =>
      controller.abort();
  }, [
    courseId,
    reloadToken,
    requestToken,
  ]);


  const baseLayout =
    useMemo(
      () => ({
        autosize: true,
        paper_bgcolor:
          "rgba(0, 0, 0, 0)",
        plot_bgcolor:
          "rgba(0, 0, 0, 0)",
        font: {
          color:
            chartTheme.text,
          family:
            "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
          size: 12,
        },
        margin: {
          l: 48,
          r: 20,
          t: 14,
          b: 48,
        },
        showlegend: false,
        hoverlabel: {
          namelength: -1,
        },
      }),
      [chartTheme]
    );


  if (
    loading
    && !analytics
  ) {
    return (
      <section className="teacher-panel">
        <InlineState
          type="loading"
          title={t(
            "teacherCourseAnalytics.loading"
          )}
          compact
        />
      </section>
    );
  }


  if (
    error
    && !analytics
  ) {
    return (
      <section className="teacher-panel">
        <InlineState
          type="error"
          title={t(
            "teacherCourseAnalytics.errors.title"
          )}
          description={
            teacherRequestErrorMessage(
              error,
              t,
              {
                fallbackKey:
                  "teacherCourseAnalytics.errors.load",
              }
            )
          }
          actionLabel={t(
            "teacherCommon.actions.retry"
          )}
          onAction={() =>
            setRequestToken(
              (value) => value + 1
            )
          }
          compact
        />
      </section>
    );
  }


  if (!analytics) {
    return null;
  }


  const kpis =
    analytics.kpis || {};

  const participation =
    Array.isArray(
      analytics.participation
    )
      ? analytics.participation
      : [];

  const benchmarks =
    Array.isArray(
      analytics.benchmarks
    )
      ? analytics.benchmarks
      : [];

  const activity =
    Array.isArray(
      analytics.activity?.items
    )
      ? analytics.activity.items
      : [];

  const benchmarkTotal =
    benchmarks.reduce(
      (total, item) =>
        total
        + Number(
          item.executions || 0
        ),
      0
    );

  const usedBenchmarks =
    benchmarks.filter(
      (item) =>
        Number(
          item.executions || 0
        ) > 0
    );

  const benchmarkColors = {
    LCS: COLORS.primary,
    CAMM: COLORS.cyan,
    SIZE: COLORS.amber,
  };

  const activityTotal =
    activity.reduce(
      (total, item) =>
        total
        + Number(
          item.executions || 0
        ),
      0
    );

  const rateFormatter =
    new Intl.NumberFormat(
      locale,
      {
        maximumFractionDigits: 1,
      }
    );


  return (
    <section
      className="teacher-analytics"
      aria-labelledby="teacher-analytics-title"
    >
      <div className="teacher-analytics-heading">
        <div>
          <p className="teacher-eyebrow">
            {t(
              "teacherCourseAnalytics.header.eyebrow"
            )}
          </p>
          <h2 id="teacher-analytics-title">
            {t(
              "teacherCourseAnalytics.header.title"
            )}
          </h2>
          <p>
            {t(
              "teacherCourseAnalytics.header.description"
            )}
          </p>
        </div>
      </div>


      <div className="teacher-summary-grid teacher-summary-grid--analytics">
        <article>
          <span>
            {t(
              "teacherCourseAnalytics.kpis.activeStudents"
            )}
          </span>
          <strong>
            {kpis.activeStudents || 0}
          </strong>
        </article>

        <article>
          <span>
            {t(
              "teacherCourseAnalytics.kpis.submissions"
            )}
          </span>
          <strong>
            {kpis.submissions || 0}
          </strong>
        </article>

        <article>
          <span>
            {t(
              "teacherCourseAnalytics.kpis.executions"
            )}
          </span>
          <strong>
            {kpis.executions || 0}
          </strong>
        </article>

        <article>
          <span>
            {t(
              "teacherCourseAnalytics.kpis.completionRate"
            )}
          </span>
          <strong>
            {rateFormatter.format(
              kpis.completionRate || 0
            )}
            <small>%</small>
          </strong>
        </article>
      </div>


      <div className="teacher-analytics-grid">
        <ChartCard
          title={t(
            "teacherCourseAnalytics.charts.participation.title"
          )}
          description={t(
            "teacherCourseAnalytics.charts.participation.description"
          )}
        >
          {(kpis.activeStudents || 0) > 0 ? (
            <Plot
              data={[
                {
                  type: "bar",
                  x: participation.map(
                    (item) =>
                      participationLabel(
                        item,
                        t
                      )
                  ),
                  y: participation.map(
                    (item) => item.students
                  ),
                  text: participation.map(
                    (item) => item.students
                  ),
                  textposition:
                    "outside",
                  cliponaxis: false,
                  marker: {
                    color:
                      COLORS.primary,
                    line: {
                      color:
                        "rgba(255, 255, 255, 0.18)",
                      width: 1,
                    },
                  },
                  hovertemplate:
                    t(
                      "teacherCourseAnalytics.charts.participation.hover"
                    ),
                },
              ]}
              layout={{
                ...baseLayout,
                height: 290,
                xaxis: {
                  fixedrange: true,
                  tickfont: {
                    color:
                      chartTheme.text,
                  },
                },
                yaxis: {
                  fixedrange: true,
                  rangemode:
                    "tozero",
                  tickmode:
                    "linear",
                  dtick: 1,
                  gridcolor:
                    chartTheme.grid,
                  zerolinecolor:
                    chartTheme.grid,
                  tickfont: {
                    color:
                      chartTheme.text,
                  },
                  title: {
                    text:
                      t(
                        "teacherCourseAnalytics.axes.students"
                      ),
                    font: {
                      color:
                        chartTheme.text,
                    },
                  },
                },
              }}
              config={CHART_CONFIG}
              useResizeHandler
              className="teacher-plot"
              style={{
                width: "100%",
                height: "100%",
              }}
            />
          ) : (
            <EmptyChart>
              {t(
                "teacherCourseAnalytics.charts.participation.empty"
              )}
            </EmptyChart>
          )}
        </ChartCard>


        <ChartCard
          title={t(
            "teacherCourseAnalytics.charts.benchmarks.title"
          )}
          description={t(
            "teacherCourseAnalytics.charts.benchmarks.description"
          )}
        >
          {benchmarkTotal > 0 ? (
            <Plot
              data={[
                {
                  type: "pie",
                  labels:
                    usedBenchmarks.map(
                      (item) =>
                        item.label
                    ),
                  values:
                    usedBenchmarks.map(
                      (item) =>
                        item.executions
                    ),
                  hole: 0.62,
                  sort: false,
                  direction:
                    "clockwise",
                  marker: {
                    colors:
                      usedBenchmarks.map(
                        (item) =>
                          benchmarkColors[
                            item.key
                          ]
                          || COLORS.primary
                      ),
                    line: {
                      color:
                        "rgba(255, 255, 255, 0.22)",
                      width: 1,
                    },
                  },
                  textinfo:
                    "percent",
                  hovertemplate:
                    t(
                      "teacherCourseAnalytics.charts.benchmarks.hover"
                    ),
                },
              ]}
              layout={{
                ...baseLayout,
                height: 290,
                margin: {
                  l: 20,
                  r: 20,
                  t: 8,
                  b: 54,
                },
                showlegend: true,
                legend: {
                  orientation: "h",
                  x: 0.5,
                  xanchor:
                    "center",
                  y: -0.06,
                  font: {
                    color:
                      chartTheme.text,
                  },
                },
              }}
              config={CHART_CONFIG}
              useResizeHandler
              className="teacher-plot"
              style={{
                width: "100%",
                height: "100%",
              }}
            />
          ) : (
            <EmptyChart>
              {t(
                "teacherCourseAnalytics.charts.benchmarks.empty"
              )}
            </EmptyChart>
          )}
        </ChartCard>


        <ChartCard
          className="teacher-chart-card--wide"
          title={t(
            "teacherCourseAnalytics.charts.activity.title"
          )}
          description={t(
            "teacherCourseAnalytics.charts.activity.description"
          )}
        >
          {activityTotal > 0 ? (
            <Plot
              data={[
                {
                  type:
                    "scatter",
                  mode:
                    "lines+markers",
                  x:
                    activity.map(
                      (item) =>
                        item.date
                    ),
                  y:
                    activity.map(
                      (item) =>
                        item.executions
                    ),
                  line: {
                    color:
                      COLORS.emerald,
                    width: 3,
                    shape:
                      "linear",
                  },
                  marker: {
                    color:
                      COLORS.emerald,
                    size: 6,
                  },
                  fill:
                    "tozeroy",
                  fillcolor:
                    "rgba(16, 185, 129, 0.12)",
                  hovertemplate:
                    t(
                      "teacherCourseAnalytics.charts.activity.hover"
                    ),
                },
              ]}
              layout={{
                ...baseLayout,
                height: 300,
                xaxis: {
                  fixedrange: true,
                  gridcolor:
                    chartTheme.grid,
                  tickfont: {
                    color:
                      chartTheme.text,
                  },
                  tickformat:
                    "%d %b",
                  nticks: 8,
                },
                yaxis: {
                  fixedrange: true,
                  rangemode:
                    "tozero",
                  tickmode:
                    "linear",
                  dtick: 1,
                  gridcolor:
                    chartTheme.grid,
                  zerolinecolor:
                    chartTheme.grid,
                  tickfont: {
                    color:
                      chartTheme.text,
                  },
                  title: {
                    text:
                      t(
                        "teacherCourseAnalytics.axes.executions"
                      ),
                    font: {
                      color:
                        chartTheme.text,
                    },
                  },
                },
              }}
              config={CHART_CONFIG}
              useResizeHandler
              className="teacher-plot"
              style={{
                width: "100%",
                height: "100%",
              }}
            />
          ) : (
            <EmptyChart>
              {t(
                "teacherCourseAnalytics.charts.activity.empty"
              )}
            </EmptyChart>
          )}

          {activity.length > 0 && (
            <p className="teacher-chart-period">
              {formatChartDate(
                analytics.activity
                  ?.startDate,
                locale,
                t(
                  "teacherCourseAnalytics.common.unavailable"
                )
              )}
              {" — "}
              {formatChartDate(
                analytics.activity
                  ?.endDate,
                locale,
                t(
                  "teacherCourseAnalytics.common.unavailable"
                )
              )}
            </p>
          )}
        </ChartCard>
      </div>
    </section>
  );
}
