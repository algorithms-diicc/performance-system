import {
  buildComparisonSummaryCards,
  buildComparisonMetricCategories,
  comparisonStatusVariant,
} from "./comparisonModel";


const point = (
  inputSize,
  median,
  mean = median
) => ({
  inputSize,
  median,
  mean,
});


describe(
  "comparison deterministic dashboard summary",
  () => {
    test(
      "keeps five target slots and preserves reported median trends without ranking",
      () => {
        const cards =
          buildComparisonSummaryCards(
            {
              DurationTime: {
                unit: "ms",
                commonInputSizes: [
                  100,
                  300,
                ],
                series: [
                  {
                    codename: "exec-a",
                    sourceFilename: "a.cpp",
                    points: [
                      point(100, 1.2, 1.4),
                      point(300, 4.8, 5.1),
                    ],
                  },
                  {
                    codename: "exec-b",
                    sourceFilename: "b.cpp",
                    points: [
                      point(100, 1.1, 1.3),
                      point(300, 5.2, 5.4),
                    ],
                  },
                ],
              },
            },
            {
              excludedMetrics: [
                {
                  metric: "EnergyPkg",
                  reasonCode:
                    "TARGET_METRIC_UNAVAILABLE",
                },
              ],
            }
          );

        expect(
          cards.map((card) => card.metric)
        ).toEqual([
          "DurationTime",
          "IPC",
          "CacheMissRate",
          "BranchMissRate",
          "EnergyPkg",
        ]);
        expect(cards[0]).toMatchObject({
          metric: "DurationTime",
          available: true,
          unit: "ms",
          inputSize: 300,
          domain: [100, 300],
        });
        expect(
          cards[0].series[0]
        ).toMatchObject({
          codename: "exec-a",
          value: 4.8,
          points: [
            {
              inputSize: 100,
              value: 1.2,
            },
            {
              inputSize: 300,
              value: 4.8,
            },
          ],
        });
        expect(cards[0]).not.toHaveProperty(
          "winner"
        );
        expect(cards[4]).toEqual({
          metric: "EnergyPkg",
          available: false,
          unit: "",
          inputSize: null,
          domain: [],
          series: [],
          reasonCode:
            "TARGET_METRIC_UNAVAILABLE",
        });
      }
    );

    test(
      "marks a target unavailable when any implementation lacks a common median",
      () => {
        const cards =
          buildComparisonSummaryCards({
            IPC: {
              unit: "ratio",
              commonInputSizes: [100],
              series: [
                {
                  codename: "a",
                  points: [
                    point(100, 2),
                  ],
                },
                {
                  codename: "b",
                  points: [
                    {
                      inputSize: 100,
                      median: null,
                    },
                  ],
                },
              ],
            },
          });

        const ipc = cards.find(
          (card) => card.metric === "IPC"
        );
        expect(ipc.available).toBe(false);
        expect(ipc.series).toEqual([]);
      }
    );

    test(
      "distinguishes metric-only partial coverage from broader limited scope",
      () => {
        expect(
          comparisonStatusVariant({
            status: "LIMITED",
            blockers: [],
            warnings: [
              {
                code:
                  "TARGET_METRIC_UNAVAILABLE",
                dimension: "metrics",
              },
              {
                code:
                  "METRIC_PARTIAL_COVERAGE",
                dimension: "metrics",
              },
            ],
          })
        ).toBe(
          "LIMITED_METRIC_COVERAGE"
        );

        expect(
          comparisonStatusVariant({
            status: "LIMITED",
            blockers: [],
            warnings: [
              {
                code:
                  "PARTIAL_INPUT_OVERLAP",
                dimension: "inputSizes",
              },
            ],
          })
        ).toBe("LIMITED");

        expect(
          comparisonStatusVariant({
            status: "COMPATIBLE",
          })
        ).toBe("COMPATIBLE");
        expect(
          comparisonStatusVariant({
            status: "INCOMPATIBLE",
          })
        ).toBe("INCOMPATIBLE");
      }
    );
  }
);

describe("comparison metric category explorer", () => {
  test("preserves all common metrics through semantic categories", () => {
    const categories = buildComparisonMetricCategories([
      "DurationTime", "IPC", "CacheMisses", "EnergyPkg", "CustomCounter",
    ]);
    const byId = Object.fromEntries(
      categories.map((category) => [category.id, category.metrics])
    );

    expect(byId.primary).toEqual(["DurationTime", "IPC", "EnergyPkg"]);
    expect(byId.performance).toEqual(["DurationTime", "IPC"]);
    expect(byId.cache).toEqual(["CacheMisses"]);
    expect(byId.cpu).toEqual(["IPC"]);
    expect(byId.energy).toEqual(["EnergyPkg"]);
    expect(byId.other).toEqual(["CustomCounter"]);
  });

  test("omits Other when every common metric is categorized", () => {
    const categories = buildComparisonMetricCategories([
      "DurationTime", "IPC",
    ]);
    expect(
      categories.some((category) => category.id === "other")
    ).toBe(false);
  });
});

