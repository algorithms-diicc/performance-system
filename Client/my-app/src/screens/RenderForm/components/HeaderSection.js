import React from "react";
import { BookOpen, Gauge } from "lucide-react";
import { Link } from "react-router-dom";

function HeaderSection({
  title,
  subtitle,
  rightContent,
}) {
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
            Experimento de rendimiento
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
            ¿Necesitas un ejemplo? Ver ejemplos de código
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