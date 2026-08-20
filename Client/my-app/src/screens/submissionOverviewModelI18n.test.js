import {
  abbreviateArchiveSha256,
  executionDisplayName,
  formatAcademicPeriod,
  formatBenchmark,
  formatCourseLabel,
  formatExecutionDuration,
  formatSubmissionDateTime,
} from "./submissionOverviewModel";

describe("submissionOverviewModel locale-aware presentation", () => {
  test("formats duration with the requested locale and fallback", () => {
    expect(
      formatExecutionDuration(
        1250,
        "en-US",
        "No data"
      )
    ).toBe("1.25 s");

    expect(
      formatExecutionDuration(
        null,
        "en-US",
        "No data"
      )
    ).toBe("No data");
  });

  test("accepts localized fallbacks without changing source data", () => {
    expect(
      executionDisplayName(
        {},
        "Unnamed file"
      )
    ).toBe("Unnamed file");

    expect(
      formatCourseLabel(
        null,
        "No associated course"
      )
    ).toBe("No associated course");

    expect(
      formatBenchmark(
        null,
        "Not reported"
      )
    ).toBe("Not reported");

    expect(
      abbreviateArchiveSha256(
        null,
        "Unavailable"
      )
    ).toBe("Unavailable");
  });

  test("formats period and date with caller-provided presentation settings", () => {
    const course = {
      academicYear: 2026,
      academicTerm: 1,
    };

    expect(
      formatAcademicPeriod(course, {
        periodLabel: "Period",
      })
    ).toBe("Period 2026-1");

    expect(
      formatSubmissionDateTime(
        "invalid-date",
        "en-US",
        "Unavailable"
      )
    ).toBe("Unavailable");

    expect(
      formatSubmissionDateTime(
        "2026-08-17T12:00:00Z",
        "en-US",
        "Unavailable"
      )
    ).not.toBe("Unavailable");
  });
});
