import React from "react";
import { Gauge } from "lucide-react";

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