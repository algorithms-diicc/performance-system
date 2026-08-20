import React from "react";
import { BookOpen, Gauge } from "lucide-react";
import { Link } from "react-router-dom";

import { useI18n } from "../../../i18n";

function HeaderSection({
  title,
  subtitle,
  rightContent,
}) {
  const { t } = useI18n();

  return (
    <header className="inicio-header">
      <div className="inicio-header-main">
        <div
          className="inicio-header-icon"
          aria-hidden="true"
        >
          <Gauge
            size={23}
            strokeWidth={1.9}
          />
        </div>

        <div className="inicio-header-left">
          <span className="inicio-header-eyebrow">
            {t("renderForm.header.eyebrow")}
          </span>

          <h1 className="inicio-title">
            {title}
          </h1>

          {subtitle && (
            <p className="inicio-subtitle">
              {subtitle}
            </p>
          )}

          <Link
            to="/tutorial#ejemplos"
            className="inicio-examples-link"
          >
            <BookOpen size={15} aria-hidden="true" />
            {t("renderForm.header.exampleLink")}
          </Link>
        </div>
      </div>

      {rightContent && (
        <div className="inicio-header-user">
          {rightContent}
        </div>
      )}
    </header>
  );
}

export default HeaderSection;
