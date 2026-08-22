export const EXECUTION_PROFILE_SAMPLES = Object.freeze({
  rapido: 10,
  equilibrado: 30,
  exhaustivo: 50,
});

const PROFILE_ALIASES = Object.freeze({
  quick: "rapido",
  rapido: "rapido",
  balanced: "equilibrado",
  equilibrado: "equilibrado",
  exhaustive: "exhaustivo",
  exhaustivo: "exhaustivo",
  custom: "personalizado",
  personalizado: "personalizado",
});

export function inferExecutionProfileFromSamples(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return "personalizado";
  }

  const match = Object.entries(EXECUTION_PROFILE_SAMPLES).find(
    ([, profileSamples]) => profileSamples === numeric
  );

  return match?.[0] || "personalizado";
}

export function normalizeExecutionProfile(profile, samples) {
  const numericSamples = Number(samples);

  if (
    Number.isFinite(numericSamples) &&
    numericSamples >= 1 &&
    numericSamples <= 100
  ) {
    return inferExecutionProfileFromSamples(numericSamples);
  }

  const normalized = String(profile || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    PROFILE_ALIASES[normalized] ||
    "personalizado"
  );
}
