import React from "react";
import {
  BarChart3,
  Fingerprint,
  Gauge,
  Sparkles,
} from "lucide-react";

import { useI18n } from "../../i18n";

const SECTIONS = [
  {
    id: "results-summary",
    key: "summary",
    Icon: Gauge,
  },
  {
    id: "results-interpretation",
    key: "interpretation",
    Icon: Sparkles,
  },
  {
    id: "results-metrics",
    key: "metrics",
    Icon: BarChart3,
  },
  {
    id: "results-reproducibility",
    key: "reproducibility",
    Icon: Fingerprint,
  },
];

function ResultsSectionNav() {
  const { t } = useI18n();

  return (
    <nav
      className="results-section-nav"
      aria-label={t("renderImage.sectionNavigation.aria")}
    >
      <div className="results-section-nav-list">
        {SECTIONS.map(({ id, key, Icon }) => (
          <a
            key={id}
            className="results-section-nav-link"
            href={`#${id}`}
          >
            <Icon size={15} aria-hidden="true" />
            <span>
              {t(`renderImage.sectionNavigation.${key}`)}
            </span>
          </a>
        ))}
      </div>
    </nav>
  );
}

export default ResultsSectionNav;
