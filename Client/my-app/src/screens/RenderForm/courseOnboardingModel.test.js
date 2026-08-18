import {
  requestedCourseIdFromSearch,
  resolveCourseQuerySelection,
} from "./courseOnboardingModel";

const courses = [
  { id: 9, code: "CC4102" },
  { id: 12, code: "CC5101" },
];

describe("courseOnboardingModel", () => {
  test("has no effect when the URL does not request a course", () => {
    expect(requestedCourseIdFromSearch("")).toBeNull();
    expect(resolveCourseQuerySelection("", courses)).toBeNull();
  });

  test("accepts one positive course id only when it is authorized", () => {
    expect(
      requestedCourseIdFromSearch("?course=12")
    ).toBe("12");
    expect(
      resolveCourseQuerySelection("?course=12", courses)
    ).toBe("12");
  });

  test("rejects a syntactically valid but unauthorized course id", () => {
    expect(
      resolveCourseQuerySelection("?course=999", courses)
    ).toBe("");
  });

  test.each([
    ["?course=abc"],
    ["?course=0"],
    ["?course=-9"],
    ["?course=9&course=12"],
  ])("rejects an invalid or ambiguous course query: %s", (search) => {
    expect(requestedCourseIdFromSearch(search)).toBe("");
    expect(resolveCourseQuerySelection(search, courses)).toBe("");
  });

  test("execution recovery has precedence over a course suggestion", () => {
    expect(
      requestedCourseIdFromSearch(
        "?course=9&execution=uuid-1"
      )
    ).toBeNull();
    expect(
      resolveCourseQuerySelection(
        "?course=9&execution=uuid-1",
        courses
      )
    ).toBeNull();
  });

  test("ignores an empty execution parameter but keeps a valid course", () => {
    expect(
      resolveCourseQuerySelection(
        "?execution=&course=9",
        courses
      )
    ).toBe("9");
  });

  test("normalizes harmless surrounding whitespace in the course value", () => {
    expect(
      resolveCourseQuerySelection(
        "?course=%209%20",
        courses
      )
    ).toBe("9");
  });
});
