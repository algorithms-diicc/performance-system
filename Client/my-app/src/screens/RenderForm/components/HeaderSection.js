// src/screens/RenderForm/components/HeaderSection.js
import React from "react";

function HeaderSection({ title, subtitle, rightContent }) {
  return (
    <div className="inicio-header">
      <div className="inicio-header-left">
        <h1 className="inicio-title">{title}</h1>
        {subtitle && (
          <p className="inicio-subtitle">
            {subtitle}
          </p>
        )}
      </div>

      {rightContent && (
        <div className="inicio-header-user">
          {rightContent}
        </div>
      )}
    </div>
  );
}

export default HeaderSection;
