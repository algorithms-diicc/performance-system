import { translate } from "../i18n";
import {
  buildComparisonInterpretation,
  buildComparisonTraces,
  comparisonDimensionLabel,
  comparisonDimensionPresentation,
  comparisonIneligibilityReason,
  formatHistoricalCandidateDate,
  historicalCandidatePresentation,
  humanMetricLabel,
  parseExecutionQuery,
} from "./comparisonModel";

const tEn = (key, params) =>
  translate("en", key, params);

const metricData = {
  unit: "ms",
  commonInputSizes: [100, 200],
  series: [
    {
      sourceFilename: null,
      points: [
        {
          inputSize: 100,
          median: 10,
          mean: 11,
          q1: 8,
          q3: 13,
          stddev: 1.5,
          samplesValid: 9,
          samplesTotal: 10,
          iqrOutliersDetected: 1,
        },
      ],
    },
  ],
};

describe("comparisonModel i18n presentation", () => {
  test("localizes URL validation without changing its validity contract", () => {
    const params = new URLSearchParams();
    params.append("execution", "only-one");

    expect(
      parseExecutionQuery(params, tEn)
    ).toEqual({
      valid: false,
      executions: ["only-one"],
      reason:
        "The URL must include between 2 and 4 implementations.",
    });
  });

  test("localizes candidate, dimension and ineligibility presentation from stable states", () => {
    expect(
      historicalCandidatePresentation(
        "LIMITED",
        tEn
      )
    ).toMatchObject({
      label: "Limited",
      tone: "warning",
      selectable: true,
    });

    expect(
      comparisonDimensionLabel(
        "compilerFlags",
        tEn
      )
    ).toBe("Compiler flags");

    expect(
      comparisonDimensionPresentation(
        "PARTIAL",
        tEn
      )
    ).toEqual({
      label: "Limited",
      tone: "warning",
    });

    expect(
      comparisonIneligibilityReason(
        {
          state: "RUNNING",
          resultAvailable: false,
          codename: "exec-a",
        },
        tEn
      )
    ).toBe(
      "The execution is still in progress."
    );
  });

  test("localizes metric pedagogy without changing scientific selection logic", () => {
    expect(
      humanMetricLabel(
        "DurationTime",
        tEn
      )
    ).toBe("Execution time");

    const messages =
      buildComparisonInterpretation({
        compatibility: {
          status: "COMPATIBLE",
          blockers: [],
          warnings: [],
          dimensions: {
            inputSizes: { status: "MATCH" },
          },
          commonInputSizes: [100, 200],
          excludedMetrics: [],
        },
        selectedMetric: "DurationTime",
        metricData,
        showDispersion: false,
        t: tEn,
      });

    expect(messages).toEqual([
      "Lower values represent lower observed execution time across the compared input sizes.",
    ]);
  });

  test("localizes trace chrome while preserving exact measured values and dispersion", () => {
    const [trace] = buildComparisonTraces({
      metricData,
      aggregation: "median",
      showDispersion: true,
      t: tEn,
    });

    expect(trace.name).toBe(
      "Implementation 1"
    );
    expect(trace.x).toEqual([100]);
    expect(trace.y).toEqual([10]);
    expect(trace.error_y).toMatchObject({
      symmetric: false,
      array: [3],
      arrayminus: [2],
    });
    expect(trace.hovertemplate).toContain(
      "Median: %{y} ms"
    );
    expect(trace.hovertemplate).toContain(
      "Std. deviation: %{customdata[5]}"
    );
    expect(trace.hovertemplate).toContain(
      "Valid samples: %{customdata[6]}/%{customdata[7]}"
    );
  });

  test("formats historical dates with caller locale and fallback", () => {
    expect(
      formatHistoricalCandidateDate(
        "invalid",
        "en-US",
        "Date unavailable"
      )
    ).toBe("Date unavailable");

    const formatted =
      formatHistoricalCandidateDate(
        "2026-08-18T12:00:00Z",
        "en-US",
        "Date unavailable"
      );

    expect(formatted).not.toBe(
      "Date unavailable"
    );
    expect(formatted).not.toMatch(
      /[\u00a0\u202f]/u
    );
  });
});
