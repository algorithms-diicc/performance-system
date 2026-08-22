import {
  EXECUTION_PROFILE_SAMPLES,
  inferExecutionProfileFromSamples,
  normalizeExecutionProfile,
} from "./executionProfileModel";

describe("executionProfileModel", () => {
  test("canonical profiles fix repetitions at 10, 30 and 50", () => {
    expect(EXECUTION_PROFILE_SAMPLES).toEqual({
      rapido: 10,
      equilibrado: 30,
      exhaustivo: 50,
    });
  });

  test.each([
    [10, "rapido"],
    [30, "equilibrado"],
    [50, "exhaustivo"],
    [1, "personalizado"],
    [42, "personalizado"],
    [100, "personalizado"],
  ])("maps historical samples %s to %s", (samples, profile) => {
    expect(inferExecutionProfileFromSamples(samples)).toBe(profile);
  });

  test("normalizes persisted ES/EN profile aliases", () => {
    expect(normalizeExecutionProfile("QUICK", undefined)).toBe("rapido");
    expect(normalizeExecutionProfile("Equilibrado", undefined)).toBe(
      "equilibrado"
    );
    expect(normalizeExecutionProfile("CUSTOM", undefined)).toBe(
      "personalizado"
    );
  });

  test("valid samples canonicalize an inconsistent historical profile", () => {
    expect(normalizeExecutionProfile("CUSTOM", 30)).toBe("equilibrado");
    expect(normalizeExecutionProfile("BALANCED", 42)).toBe(
      "personalizado"
    );
  });

  test("falls back to samples for an unknown historical profile", () => {
    expect(normalizeExecutionProfile("legacy", 50)).toBe("exhaustivo");
    expect(normalizeExecutionProfile(null, 37)).toBe("personalizado");
  });
});
