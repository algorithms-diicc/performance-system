import {
  FRONTEND_PROFILE_TO_POLICY_PROFILE,
  buildMeasurementPolicyMatrix,
  isInputAboveRecommended,
  measurementPolicyInputLimits,
  resolveMeasurementPolicy,
} from "./measurementPolicyModel";

const policy = (
  benchmark,
  executionProfile,
  overrides = {}
) => ({
  benchmark,
  executionProfile,
  minimumInput: benchmark === "CAMM" ? 1000 : 100,
  defaultInput:
    benchmark === "LCS"
      ? 500
      : benchmark === "CAMM"
      ? 5000
      : 2500,
  recommendedMaxInput:
    benchmark === "LCS"
      ? 500
      : benchmark === "CAMM"
      ? 75000
      : 100000,
  hardMaxInput:
    benchmark === "LCS"
      ? 750
      : benchmark === "CAMM"
      ? 100000
      : 100000,
  inputStep: benchmark === "CAMM" ? 1000 : 100,
  operationalTimeoutSeconds: 780,
  ...overrides,
});

const completePayload = () => ({
  environment: {
    mode: "AUTO",
  },
  total: 12,
  items: [
    policy("LCS", "QUICK", {
      recommendedMaxInput: 750,
      hardMaxInput: 1000,
      operationalTimeoutSeconds: 960,
    }),
    policy("LCS", "BALANCED", {
      recommendedMaxInput: 500,
      hardMaxInput: 750,
      operationalTimeoutSeconds: 1680,
    }),
    policy("LCS", "EXHAUSTIVE", {
      recommendedMaxInput: 500,
      hardMaxInput: 500,
      operationalTimeoutSeconds: 1320,
    }),
    policy("LCS", "CUSTOM", {
      recommendedMaxInput: 500,
      hardMaxInput: 500,
      operationalTimeoutSeconds: 2640,
    }),

    policy("CAMM", "QUICK", {
      recommendedMaxInput: 100000,
      hardMaxInput: 130000,
      operationalTimeoutSeconds: 360,
    }),
    policy("CAMM", "BALANCED", {
      recommendedMaxInput: 75000,
      hardMaxInput: 100000,
      operationalTimeoutSeconds: 780,
    }),
    policy("CAMM", "EXHAUSTIVE", {
      recommendedMaxInput: 50000,
      hardMaxInput: 75000,
      operationalTimeoutSeconds: 960,
    }),
    policy("CAMM", "CUSTOM", {
      recommendedMaxInput: 50000,
      hardMaxInput: 50000,
      operationalTimeoutSeconds: 1380,
    }),

    policy("SIZE", "QUICK", {
      operationalTimeoutSeconds: 120,
    }),
    policy("SIZE", "BALANCED", {
      operationalTimeoutSeconds: 240,
    }),
    policy("SIZE", "EXHAUSTIVE", {
      operationalTimeoutSeconds: 420,
    }),
    policy("SIZE", "CUSTOM", {
      operationalTimeoutSeconds: 780,
    }),
  ],
});

describe("measurementPolicyModel", () => {
  test("maps frontend profiles to backend policy profiles", () => {
    expect(
      FRONTEND_PROFILE_TO_POLICY_PROFILE
    ).toEqual({
      rapido: "QUICK",
      equilibrado: "BALANCED",
      exhaustivo: "EXHAUSTIVE",
      personalizado: "CUSTOM",
    });
  });

  test("builds the complete 3 x 4 policy matrix", () => {
    const matrix = buildMeasurementPolicyMatrix(
      completePayload()
    );

    expect(matrix).not.toBeNull();

    expect(
      Object.keys(matrix).sort()
    ).toEqual([
      "camm",
      "lcs",
      "size",
    ]);

    expect(
      Object.keys(matrix.lcs).sort()
    ).toEqual([
      "equilibrado",
      "exhaustivo",
      "personalizado",
      "rapido",
    ]);
  });

  test("resolves LCS QUICK exact calibrated policy", () => {
    const matrix = buildMeasurementPolicyMatrix(
      completePayload()
    );

    expect(
      resolveMeasurementPolicy(
        matrix,
        "lcs",
        "rapido"
      )
    ).toMatchObject({
      benchmark: "LCS",
      executionProfile: "QUICK",
      minimumInput: 100,
      defaultInput: 500,
      recommendedMaxInput: 750,
      hardMaxInput: 1000,
      inputStep: 100,
      operationalTimeoutSeconds: 960,
    });
  });

  test("resolves CAMM BALANCED independently of CAMM variant", () => {
    const matrix = buildMeasurementPolicyMatrix(
      completePayload()
    );

    expect(
      resolveMeasurementPolicy(
        matrix,
        "camm",
        "equilibrado"
      )
    ).toMatchObject({
      benchmark: "CAMM",
      executionProfile: "BALANCED",
      minimumInput: 1000,
      defaultInput: 5000,
      recommendedMaxInput: 75000,
      hardMaxInput: 100000,
      inputStep: 1000,
      operationalTimeoutSeconds: 780,
    });
  });

  test("exposes hard max separately from recommended max", () => {
    const matrix = buildMeasurementPolicyMatrix(
      completePayload()
    );

    const policyItem = resolveMeasurementPolicy(
      matrix,
      "lcs",
      "rapido"
    );

    expect(
      measurementPolicyInputLimits(policyItem)
    ).toEqual({
      min: 100,
      max: 1000,
      step: 100,
      recommendedMax: 750,
      defaultValue: 500,
      operationalTimeoutSeconds: 960,
    });

    expect(
      isInputAboveRecommended(
        policyItem,
        750
      )
    ).toBe(false);

    expect(
      isInputAboveRecommended(
        policyItem,
        1000
      )
    ).toBe(true);
  });

  test("rejects a partial policy response", () => {
    const payload = completePayload();

    payload.items.pop();

    expect(
      buildMeasurementPolicyMatrix(payload)
    ).toBeNull();
  });

  test("rejects duplicate benchmark/profile rows", () => {
    const payload = completePayload();

    payload.items[11] = {
      ...payload.items[0],
    };

    expect(
      buildMeasurementPolicyMatrix(payload)
    ).toBeNull();
  });

  test("rejects invalid ordered limits", () => {
    const payload = completePayload();

    payload.items[0] = {
      ...payload.items[0],
      recommendedMaxInput: 1200,
      hardMaxInput: 1000,
    };

    expect(
      buildMeasurementPolicyMatrix(payload)
    ).toBeNull();
  });

  test("unknown task or profile resolves to null", () => {
    const matrix = buildMeasurementPolicyMatrix(
      completePayload()
    );

    expect(
      resolveMeasurementPolicy(
        matrix,
        "unknown",
        "rapido"
      )
    ).toBeNull();

    expect(
      resolveMeasurementPolicy(
        matrix,
        "lcs",
        "unknown"
      )
    ).toBeNull();
  });
});
