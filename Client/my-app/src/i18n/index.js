export {
  DEFAULT_LANGUAGE,
  LANGUAGE_LOCALES,
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  applyDocumentLanguage,
  catalogLeafKeys,
  catalogsHaveParity,
  initializeDocumentLanguage,
  localeForLanguage,
  normalizeLanguage,
  persistLanguage,
  readStoredLanguage,
  translate,
} from "./i18nCore";

export {
  I18nProvider,
  useI18n,
} from "./I18nProvider";
