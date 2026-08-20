import {
  formatAcademicPeriod,
  formatDateTime,
  formatDuration,
} from "./formatters";

describe("i18n formatters", () => {
  test("formats academic periods with a caller-provided label", () => {
    const course = {
      academicYear: 2026,
      academicTerm: 2,
    };

    expect(
      formatAcademicPeriod(course, {
        semesterLabel: "Semestre",
      })
    ).toBe("2026 · Semestre 2");

    expect(
      formatAcademicPeriod(course, {
        semesterLabel: "Semester",
      })
    ).toBe("2026 · Semester 2");
  });

  test("uses the supplied fallback for missing dates", () => {
    expect(
      formatDateTime(null, "en-US", "No record")
    ).toBe("No record");
  });

  test("formats technical duration units without translating them", () => {
    expect(
      formatDuration(1250, "en-US", "No data")
    ).toBe("1.3 s");
  });
});
