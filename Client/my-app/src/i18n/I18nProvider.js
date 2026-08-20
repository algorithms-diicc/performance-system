import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  DEFAULT_LANGUAGE,
  applyDocumentLanguage,
  localeForLanguage,
  normalizeLanguage,
  persistLanguage,
  readStoredLanguage,
  translate,
} from "./i18nCore";

const defaultContext = {
  language: DEFAULT_LANGUAGE,
  locale: localeForLanguage(DEFAULT_LANGUAGE),
  setLanguage: () => {},
  t: (key, params) =>
    translate(DEFAULT_LANGUAGE, key, params),
};

const I18nContext = createContext(defaultContext);

export const I18nProvider = ({
  children,
  initialLanguage,
}) => {
  const [language, setLanguageState] = useState(
    () =>
      normalizeLanguage(
        initialLanguage ?? readStoredLanguage()
      )
  );

  useEffect(() => {
    persistLanguage(language);
    applyDocumentLanguage(language);
  }, [language]);

  const setLanguage = useCallback((nextLanguage) => {
    const normalized =
      normalizeLanguage(nextLanguage);

    persistLanguage(normalized);
    applyDocumentLanguage(normalized);
    setLanguageState(normalized);
  }, []);

  const t = useCallback(
    (key, params) =>
      translate(language, key, params),
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      locale: localeForLanguage(language),
      setLanguage,
      t,
    }),
    [language, setLanguage, t]
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () =>
  useContext(I18nContext);

export default I18nProvider;
