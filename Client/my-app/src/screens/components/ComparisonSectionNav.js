import React from "react";
import {
  BarChart3,
  Fingerprint,
  Gauge,
  Layers3,
  Sparkles,
} from "lucide-react";

import { useI18n } from "../../i18n";

const SECTIONS = [
  {
    id: "comparison-implementations",
    key: "implementations",
    Icon: Layers3,
  },
  {
    id: "comparison-summary",
    key: "summary",
    Icon: Gauge,
  },
  {
    id: "comparison-interpretation",
    key: "interpretation",
    Icon: Sparkles,
  },
  {
    id: "comparison-ai",
    key: "ai",
    Icon: Sparkles,
  },
  {
    id: "comparison-metrics",
    key: "metrics",
    Icon: BarChart3,
  },
  {
    id: "comparison-audit",
    key: "audit",
    Icon: Fingerprint,
  },
];

function ComparisonSectionNav() {
  const { t } = useI18n();

  return (
    <nav
      className="comparison-page__section-nav"
      aria-label={t(
        "comparisonPage.sectionNavigation.aria"
      )}
    >
      <div className="comparison-page__section-nav-list">
        {SECTIONS.map(({ id, key, Icon }) => (
          <a
            key={id}
            className="comparison-page__section-nav-link"
            href={`#${id}`}
          >
            <Icon size={15} aria-hidden="true" />
            <span>
              {t(
                `comparisonPage.sectionNavigation.${key}`
              )}
            </span>
          </a>
        ))}
      </div>
    </nav>
  );
}

export default ComparisonSectionNav;
