import React from "react";

import { useI18n } from "../i18n";

import "./LanguageSwitcher.css";

const OPTIONS = [
  {
    code: "es",
    shortLabel: "ES",
    nameKey: "language.spanish",
  },
  {
    code: "en",
    shortLabel: "EN",
    nameKey: "language.english",
  },
];

const LanguageSwitcher = ({
  variant = "navbar",
}) => {
  const {
    language,
    setLanguage,
    t,
  } = useI18n();

  return (
    <div
      className={[
        "language-switcher",
        `language-switcher--${variant}`,
      ].join(" ")}
      role="group"
      aria-label={t("language.selectorLabel")}
    >
      {OPTIONS.map((option) => {
        const active =
          language === option.code;
        const languageName =
          t(option.nameKey);

        return (
          <button
            key={option.code}
            type="button"
            className={[
              "language-switcher__option",
              active ? "is-active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-pressed={active}
            aria-label={t(
              "language.switchTo",
              { language: languageName }
            )}
            title={languageName}
            onClick={() =>
              setLanguage(option.code)
            }
          >
            {option.shortLabel}
          </button>
        );
      })}
    </div>
  );
};

export default LanguageSwitcher;
