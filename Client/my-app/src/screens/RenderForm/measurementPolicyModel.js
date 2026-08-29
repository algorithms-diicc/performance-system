export const FRONTEND_PROFILE_TO_POLICY_PROFILE = Object.freeze({
  rapido: "QUICK",
  equilibrado: "BALANCED",
  exhaustivo: "EXHAUSTIVE",
  personalizado: "CUSTOM",
});

export const POLICY_PROFILE_TO_FRONTEND_PROFILE = Object.freeze({
  QUICK: "rapido",
  BALANCED: "equilibrado",
  EXHAUSTIVE: "exhaustivo",
  CUSTOM: "personalizado",
});

const BENCHMARK_TO_TASK = Object.freeze({
  LCS: "lcs",
  CAMM: "camm",
  SIZE: "size",
});

const EXPECTED_TASKS = Object.freeze([
  "lcs",
  "camm",
  "size",
]);

const EXPECTED_PROFILES = Object.freeze([
  "rapido",
  "equilibrado",
  "exhaustivo",
  "personalizado",
]);

const positiveInteger = (value) => {
  const number = Number(value);

  return Number.isInteger(number) && number > 0
    ? number
    : null;
};

const normalizePolicyItem = (item) => {
  if (!item || typeof item !== "object") {
    return null;
  }

  const benchmark = String(item.benchmark || "")
    .trim()
    .toUpperCase();

  const policyProfile = String(item.executionProfile || "")
    .trim()
    .toUpperCase();

  const taskId = BENCHMARK_TO_TASK[benchmark];
  const profileId =
    POLICY_PROFILE_TO_FRONTEND_PROFILE[policyProfile];

  if (!taskId || !profileId) {
    return null;
  }

  const minimumInput = positiveInteger(item.minimumInput);
  const defaultInput = positiveInteger(item.defaultInput);
  const recommendedMaxInput = positiveInteger(
    item.recommendedMaxInput
  );
  const hardMaxInput = positiveInteger(item.hardMaxInput);
  const inputStep = positiveInteger(item.inputStep);
  const operationalTimeoutSeconds = positiveInteger(
    item.operationalTimeoutSeconds
  );

  if (
    minimumInput === null ||
    defaultInput === null ||
    recommendedMaxInput === null ||
    hardMaxInput === null ||
    inputStep === null ||
    operationalTimeoutSeconds === null
  ) {
    return null;
  }

  if (
    minimumInput > defaultInput ||
    defaultInput > recommendedMaxInput ||
    recommendedMaxInput > hardMaxInput
  ) {
    return null;
  }

  return {
    taskId,
    profileId,
    benchmark,
    executionProfile: policyProfile,
    minimumInput,
    defaultInput,
    recommendedMaxInput,
    hardMaxInput,
    inputStep,
    operationalTimeoutSeconds,
  };
};

export const buildMeasurementPolicyMatrix = (payload) => {
  const items = Array.isArray(payload?.items)
    ? payload.items
    : null;

  if (!items) {
    return null;
  }

  const matrix = {};

  for (const rawItem of items) {
    const item = normalizePolicyItem(rawItem);

    if (!item) {
      return null;
    }

    if (!matrix[item.taskId]) {
      matrix[item.taskId] = {};
    }

    if (matrix[item.taskId][item.profileId]) {
      return null;
    }

    matrix[item.taskId][item.profileId] = item;
  }

  const environmentMode = String(
    payload?.environment?.mode || ""
  )
    .trim()
    .toUpperCase();

  // AUTO is backed by the institutional profile and must keep the
  // complete 3 x 4 contract. A PINNED validation profile may
  // intentionally expose only the calibrated combinations available
  // for that physical node (for example Ryzen SIZE/QUICK).
  if (environmentMode === "PINNED") {
    return items.length > 0 ? matrix : null;
  }

  const complete = EXPECTED_TASKS.every((taskId) =>
    EXPECTED_PROFILES.every(
      (profileId) => Boolean(matrix[taskId]?.[profileId])
    )
  );

  if (!complete) {
    return null;
  }

  if (
    items.length !==
    EXPECTED_TASKS.length * EXPECTED_PROFILES.length
  ) {
    return null;
  }

  return matrix;
};

export const resolveMeasurementPolicy = (
  matrix,
  taskId,
  profileId
) => {
  if (!matrix || !taskId || !profileId) {
    return null;
  }

  return matrix?.[taskId]?.[profileId] || null;
};

export const measurementPolicyInputLimits = (policy) => {
  if (!policy) {
    return null;
  }

  return {
    min: policy.minimumInput,
    max: policy.hardMaxInput,
    step: policy.inputStep,
    recommendedMax: policy.recommendedMaxInput,
    defaultValue: policy.defaultInput,
    operationalTimeoutSeconds:
      policy.operationalTimeoutSeconds,
  };
};

export const isInputAboveRecommended = (
  policy,
  inputSize
) => {
  if (!policy) {
    return false;
  }

  const value = Number(inputSize);

  if (!Number.isFinite(value)) {
    return false;
  }

  return value > policy.recommendedMaxInput;
};
