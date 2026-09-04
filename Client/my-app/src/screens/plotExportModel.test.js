import {
  buildPlotExportConfig,
  sanitizePlotExportSegment,
} from "./plotExportModel";


describe("plotExportModel", () => {
  test.each([
    [
      " Duración total (ms) ",
      "duracion-total-ms",
    ],
    [
      "Instructions / Cycle",
      "instructions-cycle",
    ],
    [
      "Energía Pkg.",
      "energia-pkg",
    ],
  ])(
    "sanitizes %s as %s",
    (value, expected) => {
      expect(
        sanitizePlotExportSegment(value)
      ).toBe(expected);
    }
  );

  test("uses a stable fallback for empty or symbolic labels", () => {
    expect(
      sanitizePlotExportSegment("")
    ).toBe("chart");
    expect(
      sanitizePlotExportSegment("⚡")
    ).toBe("chart");
  });

  test("builds a named high-resolution PNG configuration", () => {
    expect(
      buildPlotExportConfig({
        scope: "comparison",
        label: "Duración total (ms)",
      })
    ).toEqual({
      responsive: true,
      displaylogo: false,
      toImageButtonOptions: {
        format: "png",
        filename:
          "performance-system-comparison-duracion-total-ms",
        scale: 2,
      },
    });
  });
});
