import es from "./locales/es";
import en from "./locales/en";

export const DEFAULT_LANGUAGE = "es";
export const LANGUAGE_STORAGE_KEY = "ps-language";

export const SUPPORTED_LANGUAGES = Object.freeze([
  "es",
  "en",
]);

export const LANGUAGE_LOCALES = Object.freeze({
  es: "es-CL",
  en: "en-US",
});

const CATALOGS = Object.freeze({
  es,
  en,
});

export const normalizeLanguage = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .split("-")[0];

  return SUPPORTED_LANGUAGES.includes(normalized)
    ? normalized
    : DEFAULT_LANGUAGE;
};

export const localeForLanguage = (language) =>
  LANGUAGE_LOCALES[normalizeLanguage(language)];

export const readStoredLanguage = () => {
  if (typeof window === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  try {
    return normalizeLanguage(
      window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    );
  } catch (_) {
    return DEFAULT_LANGUAGE;
  }
};

export const persistLanguage = (language) => {
  const normalized = normalizeLanguage(language);

  if (typeof window === "undefined") {
    return normalized;
  }

  try {
    window.localStorage.setItem(
      LANGUAGE_STORAGE_KEY,
      normalized
    );
  } catch (_) {
    // El idioma sigue funcionando en memoria si storage no está disponible.
  }

  return normalized;
};

export const applyDocumentLanguage = (language) => {
  const normalized = normalizeLanguage(language);

  if (
    typeof document !== "undefined" &&
    document.documentElement
  ) {
    document.documentElement.setAttribute(
      "lang",
      normalized
    );
  }

  return normalized;
};

export const initializeDocumentLanguage = () => {
  const language = readStoredLanguage();
  applyDocumentLanguage(language);
  return language;
};

const nestedValue = (catalog, key) =>
  String(key ?? "")
    .split(".")
    .filter(Boolean)
    .reduce(
      (value, segment) =>
        value && typeof value === "object"
          ? value[segment]
          : undefined,
      catalog
    );

const pluralValue = (value, language, params) => {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    params?.count === undefined ||
    params?.count === null
  ) {
    return value;
  }

  const count = Number(params.count);
  if (!Number.isFinite(count)) {
    return value.other ?? value.one;
  }

  const rule = new Intl.PluralRules(
    localeForLanguage(language)
  ).select(count);

  return (
    value[rule] ??
    value.other ??
    value.one
  );
};

const interpolate = (value, params) =>
  String(value).replace(
    /\{\{\s*([\w.-]+)\s*\}\}/g,
    (match, name) =>
      Object.prototype.hasOwnProperty.call(
        params ?? {},
        name
      )
        ? String(params[name])
        : match
  );

export const translate = (
  language,
  key,
  params = {}
) => {
  const normalized = normalizeLanguage(language);

  let value = nestedValue(
    CATALOGS[normalized],
    key
  );

  if (value === undefined) {
    value = nestedValue(
      CATALOGS[DEFAULT_LANGUAGE],
      key
    );
  }

  value = pluralValue(
    value,
    normalized,
    params
  );

  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return String(key ?? "");
  }

  return interpolate(value, params);
};

const leafKeys = (value, prefix = "") => {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return [prefix];
  }

  return Object.entries(value).flatMap(
    ([key, child]) =>
      leafKeys(
        child,
        prefix ? `${prefix}.${key}` : key
      )
  );
};

export const catalogLeafKeys = (language) =>
  leafKeys(CATALOGS[normalizeLanguage(language)])
    .filter(Boolean)
    .sort();

export const catalogsHaveParity = () => {
  const reference = JSON.stringify(
    catalogLeafKeys(DEFAULT_LANGUAGE)
  );

  return SUPPORTED_LANGUAGES.every(
    (language) =>
      JSON.stringify(
        catalogLeafKeys(language)
      ) === reference
  );
};
