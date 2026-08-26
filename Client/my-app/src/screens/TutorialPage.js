import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  Archive,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Cpu,
  Download,
  FileCode2,
  Gauge,
  History,
  Info,
  Layers3,
  PlayCircle,
  Settings2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
  Zap,
  ZoomIn,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import "./TutorialPage.css";

import newAnalysisEn from "../assets/tutorial/tutorial-01-new-analysis-en.png";
import newAnalysisEs from "../assets/tutorial/tutorial-01-new-analysis-es.png";
import mixedExecutionsEn from "../assets/tutorial/tutorial-02-mixed-executions-en.png";
import mixedExecutionsEs from "../assets/tutorial/tutorial-02-mixed-executions-es.png";
import resultsOverviewEn from "../assets/tutorial/tutorial-03-results-overview-en.png";
import resultsOverviewEs from "../assets/tutorial/tutorial-03-results-overview-es.png";
import reproducibilityEn from "../assets/tutorial/tutorial-04-reproducibility-en.png";
import reproducibilityEs from "../assets/tutorial/tutorial-04-reproducibility-es.png";
import historyEn from "../assets/tutorial/tutorial-05-history-en.png";
import historyEs from "../assets/tutorial/tutorial-05-history-es.png";
import comparisonEn from "../assets/tutorial/tutorial-06-comparison-en.png";
import comparisonEs from "../assets/tutorial/tutorial-06-comparison-es.png";
import teacherCourseEn from "../assets/tutorial/tutorial-07-teacher-course-en.png";
import teacherCourseEs from "../assets/tutorial/tutorial-07-teacher-course-es.png";

import { canAccessTeacherArea } from "../common/userAccessModel";
import { useI18n } from "../i18n";

const COPY = "tutorialPage.v9";

const CORE_NAV_ITEMS = [
  { number: "01", id: "crear", labelKey: `${COPY}.navigation.create` },
  { number: "02", id: "resultados", labelKey: `${COPY}.navigation.results` },
  { number: "03", id: "comparar", labelKey: `${COPY}.navigation.compare` },
];

const TEACHER_NAV_ITEM = {
  number: "04",
  id: "supervisar",
  labelKey: `${COPY}.navigation.supervise`,
};

const SCREENSHOTS = {
  newAnalysis: {
    id: "new-analysis",
    es: newAnalysisEs,
    en: newAnalysisEn,
    altKey: `${COPY}.create.newAnalysis.alt`,
    captionKey: `${COPY}.create.newAnalysis.caption`,
  },
  mixedExecutions: {
    id: "mixed-executions",
    es: mixedExecutionsEs,
    en: mixedExecutionsEn,
    altKey: `${COPY}.create.mixedExecutions.alt`,
    captionKey: `${COPY}.create.mixedExecutions.caption`,
  },
  resultsOverview: {
    id: "results-overview",
    es: resultsOverviewEs,
    en: resultsOverviewEn,
    altKey: `${COPY}.results.overview.alt`,
    captionKey: `${COPY}.results.overview.caption`,
  },
  reproducibility: {
    id: "reproducibility",
    es: reproducibilityEs,
    en: reproducibilityEn,
    altKey: `${COPY}.results.reproducibility.alt`,
    captionKey: `${COPY}.results.reproducibility.caption`,
  },
  history: {
    id: "history",
    es: historyEs,
    en: historyEn,
    altKey: `${COPY}.compare.history.alt`,
    captionKey: `${COPY}.compare.history.caption`,
  },
  comparison: {
    id: "comparison",
    es: comparisonEs,
    en: comparisonEn,
    altKey: `${COPY}.compare.comparison.alt`,
    captionKey: `${COPY}.compare.comparison.caption`,
  },
  teacherCourse: {
    id: "teacher-course",
    es: teacherCourseEs,
    en: teacherCourseEn,
    altKey: `${COPY}.teacher.screenshot.alt`,
    captionKey: `${COPY}.teacher.screenshot.caption`,
  },
};

const STARTER_EXAMPLES = [
  {
    benchmark: "LCS",
    mode: "c",
    titleKey: `${COPY}.examples.lcs.title`,
    descriptionKey: `${COPY}.examples.lcs.description`,
    observeKey: `${COPY}.examples.lcs.observe`,
    modeKey: `${COPY}.examples.modes.c`,
    files: ["longest_common_subsequence.c"],
    href: "/tutorial-codigos/lcs_template.zip",
    starterHref: "/?starter=lcs",
  },
  {
    benchmark: "CAMM",
    mode: "cpp",
    titleKey: `${COPY}.examples.camm.title`,
    descriptionKey: `${COPY}.examples.camm.description`,
    observeKey: `${COPY}.examples.camm.observe`,
    modeKey: `${COPY}.examples.modes.cpp`,
    files: ["blocked_matrix_multiplication.cpp"],
    href: "/tutorial-codigos/camm_template.zip",
    starterHref: "/?starter=camm",
  },
  {
    benchmark: "SIZE",
    mode: "mixed",
    titleKey: `${COPY}.examples.size.title`,
    descriptionKey: `${COPY}.examples.size.description`,
    observeKey: `${COPY}.examples.size.observe`,
    modeKey: `${COPY}.examples.modes.mixed`,
    files: ["insertion_sort.c", "merge_sort.cpp"],
    href: "/tutorial-codigos/size_template.zip",
    starterHref: "/?starter=size",
  },
];

const RESULT_FLOW = [
  { icon: Settings2, key: "context" },
  { icon: Gauge, key: "indicators" },
  { icon: BarChart3, key: "trends" },
  { icon: CheckCircle2, key: "deterministic" },
  { icon: Sparkles, key: "ai" },
  { icon: ShieldCheck, key: "reproducibility" },
];

const METRIC_FAMILIES = [
  { icon: Clock3, key: "time" },
  { icon: Cpu, key: "instructions" },
  { icon: Activity, key: "cache" },
  { icon: Zap, key: "energy" },
];

const COMPATIBILITY_STATES = [
  { code: "COMPATIBLE", key: "compatible" },
  { code: "LIMITED", key: "limited", featured: true },
  { code: "INCOMPATIBLE", key: "incompatible" },
];

const localizeShot = (shot, language) => ({
  ...shot,
  src: language === "en" ? shot.en : shot.es,
});

const SectionHeading = ({ number, kickerKey, titleKey, descriptionKey }) => {
  const { t } = useI18n();

  return (
    <div className="tutorial-section-heading">
      <div className="tutorial-section-heading__meta">
        <span className="tutorial-section-number">{number}</span>
        <span className="tutorial-section-kicker">{t(kickerKey)}</span>
      </div>
      <h2>{t(titleKey)}</h2>
      <p>{t(descriptionKey)}</p>
    </div>
  );
};

const TutorialScreenshot = ({ shot, onOpen }) => {
  const { t } = useI18n();
  const alt = t(shot.altKey);

  return (
    <figure className="tutorial-shot" data-testid={`tutorial-shot-${shot.id}`}>
      <button
        type="button"
        className="tutorial-shot__button"
        onClick={(event) => onOpen(shot.id, event.currentTarget)}
        aria-label={t(`${COPY}.screenshot.expandAria`, { alt })}
      >
        <img
          src={shot.src}
          alt={alt}
          loading="lazy"
          data-testid={`tutorial-image-${shot.id}`}
        />
        <span className="tutorial-shot__zoom" aria-hidden="true">
          <ZoomIn size={16} />
          {t(`${COPY}.screenshot.zoom`)}
        </span>
      </button>
      <figcaption>{t(shot.captionKey)}</figcaption>
    </figure>
  );
};

const ObservationList = ({ pointKeys }) => {
  const { t } = useI18n();

  return (
    <aside className="tutorial-observation">
      <div className="tutorial-observation__title">
        <Info size={18} aria-hidden="true" />
        <h3>{t(`${COPY}.observation.title`)}</h3>
      </div>
      <ul>
        {pointKeys.map((pointKey) => (
          <li key={pointKey}>
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{t(pointKey)}</span>
          </li>
        ))}
      </ul>
    </aside>
  );
};

const MediaStory = ({ shot, pointKeys, reverse = false, onOpen }) => (
  <div className={`tutorial-media-story${reverse ? " tutorial-media-story--reverse" : ""}`}>
    <TutorialScreenshot shot={shot} onOpen={onOpen} />
    <ObservationList pointKeys={pointKeys} />
  </div>
);

const TutorialPage = ({ currentUser = null }) => {
  const [activeShotId, setActiveShotId] = useState(null);
  const closeButtonRef = useRef(null);
  const lastTriggerRef = useRef(null);
  const location = useLocation();
  const { language, t } = useI18n();

  const showTeacherSection = canAccessTeacherArea(currentUser);
  const navItems = showTeacherSection
    ? [...CORE_NAV_ITEMS, TEACHER_NAV_ITEM]
    : CORE_NAV_ITEMS;
  const shot = (name) => localizeShot(SCREENSHOTS[name], language);
  const activeShotDefinition = activeShotId
    ? Object.values(SCREENSHOTS).find(({ id }) => id === activeShotId)
    : null;
  const activeShot = activeShotDefinition
    ? localizeShot(activeShotDefinition, language)
    : null;

  useEffect(() => {
    if (!location.hash) return undefined;

    let targetId = "";
    try {
      targetId = decodeURIComponent(location.hash.slice(1));
    } catch (_error) {
      return undefined;
    }

    const target = document.getElementById(targetId);
    if (target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    return undefined;
  }, [location.hash]);

  useEffect(() => {
    if (!activeShotId) return undefined;

    closeButtonRef.current?.focus();

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setActiveShotId(null);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeShotId]);

  const openShot = (shotId, trigger) => {
    lastTriggerRef.current = trigger;
    setActiveShotId(shotId);
  };

  const closeShot = () => {
    setActiveShotId(null);
    lastTriggerRef.current?.focus();
  };

  return (
    <div className="app-page tutorial-page">
      <main className="tutorial-main">
        <div className="tutorial-container">
          <header className="tutorial-hero">
            <div className="tutorial-eyebrow">
              <Sparkles size={16} aria-hidden="true" />
              <span>{t(`${COPY}.hero.eyebrow`)}</span>
            </div>
            <h1>{t(`${COPY}.hero.title`)}</h1>
            <p>{t(`${COPY}.hero.subtitle`)}</p>

            <div className="tutorial-hero-badges" aria-label={t(`${COPY}.hero.featuresAria`)}>
              <span><FileCode2 size={16} aria-hidden="true" />C / .c</span>
              <span><Code2 size={16} aria-hidden="true" />C++ / .cpp</span>
              <span><ShieldCheck size={16} aria-hidden="true" />{t(`${COPY}.hero.badges.controlled`)}</span>
              <span><Activity size={16} aria-hidden="true" />{t(`${COPY}.hero.badges.reproducible`)}</span>
            </div>
          </header>

          <nav className="tutorial-step-nav" aria-label={t(`${COPY}.navigation.aria`)} data-testid="tutorial-primary-navigation">
            {navItems.map((item) => (
              <a href={`#${item.id}`} key={item.id}>
                <span>{item.number}</span>
                {t(item.labelKey)}
              </a>
            ))}
          </nav>

          <section className="tutorial-section" id="crear">
            <SectionHeading number="01" kickerKey={`${COPY}.create.kicker`} titleKey={`${COPY}.create.title`} descriptionKey={`${COPY}.create.description`} />

            <div className="tutorial-contract-diagram" role="img" aria-label={t(`${COPY}.create.contract.aria`)}>
              <div className="tutorial-contract-diagram__root">
                <Archive size={23} aria-hidden="true" />
                <strong>{t(`${COPY}.create.contract.experiment`)}</strong>
                <span>{t(`${COPY}.create.contract.container`)}</span>
              </div>
              <div className="tutorial-contract-diagram__branches">
                <div className="tutorial-contract-branch">
                  <div><code>algoritmo.c</code><span>C · gcc</span></div>
                  <ChevronRight aria-hidden="true" />
                  <div><PlayCircle size={17} aria-hidden="true" /><strong>{t(`${COPY}.create.contract.execution`)}</strong></div>
                  <ChevronRight aria-hidden="true" />
                  <div><BarChart3 size={17} aria-hidden="true" /><strong>{t(`${COPY}.create.contract.result`)}</strong></div>
                </div>
                <div className="tutorial-contract-branch">
                  <div><code>algoritmo.cpp</code><span>C++ · g++</span></div>
                  <ChevronRight aria-hidden="true" />
                  <div><PlayCircle size={17} aria-hidden="true" /><strong>{t(`${COPY}.create.contract.execution`)}</strong></div>
                  <ChevronRight aria-hidden="true" />
                  <div><BarChart3 size={17} aria-hidden="true" /><strong>{t(`${COPY}.create.contract.result`)}</strong></div>
                </div>
              </div>
            </div>

            <div className="tutorial-concept-grid">
              <article><Layers3 size={21} aria-hidden="true" /><h3>{t(`${COPY}.create.independent.title`)}</h3><p>{t(`${COPY}.create.independent.text`)}</p></article>
              <article><Settings2 size={21} aria-hidden="true" /><h3>{t(`${COPY}.create.shared.title`)}</h3><p>{t(`${COPY}.create.shared.text`)}</p></article>
              <article><Archive size={21} aria-hidden="true" /><h3>{t(`${COPY}.create.mixed.title`)}</h3><p>{t(`${COPY}.create.mixed.text`)}</p></article>
            </div>

            <div className="tutorial-callout" role="note">
              <Info size={19} aria-hidden="true" />
              <div><strong>{t(`${COPY}.create.noLinking.title`)}</strong><p>{t(`${COPY}.create.noLinking.text`)}</p></div>
            </div>

            <MediaStory shot={shot("newAnalysis")} pointKeys={[`${COPY}.create.newAnalysis.points.summary`, `${COPY}.create.newAnalysis.points.sources`, `${COPY}.create.newAnalysis.points.ready`]} onOpen={openShot} />
            <MediaStory shot={shot("mixedExecutions")} reverse pointKeys={[`${COPY}.create.mixedExecutions.points.c`, `${COPY}.create.mixedExecutions.points.cpp`, `${COPY}.create.mixedExecutions.points.independent`, `${COPY}.create.mixedExecutions.points.actions`]} onOpen={openShot} />
          </section>

          <section className="tutorial-section tutorial-examples" id="ejemplos" aria-labelledby="tutorial-examples-title">
            <div className="tutorial-section-heading">
              <div className="tutorial-section-heading__meta"><Download size={18} aria-hidden="true" /><span className="tutorial-section-kicker">{t(`${COPY}.examples.kicker`)}</span></div>
              <h2 id="tutorial-examples-title">{t(`${COPY}.examples.title`)}</h2>
              <p>{t(`${COPY}.examples.description`)}</p>
            </div>

            <div className="tutorial-example-grid">
              {STARTER_EXAMPLES.map((example) => (
                <article className="tutorial-example-card" key={example.benchmark}>
                  <div className="tutorial-example-card__top"><span className="tutorial-example-benchmark">{example.benchmark}</span><span className={`tutorial-example-mode tutorial-example-mode--${example.mode}`}>{t(example.modeKey)}</span></div>
                  <h3>{t(example.titleKey)}</h3>
                  <p>{t(example.descriptionKey)}</p>
                  <div className="tutorial-example-files">{example.files.map((filename) => <code key={filename}>{filename}</code>)}</div>
                  <div className="tutorial-example-observe"><strong>{t(`${COPY}.examples.observeLabel`)}</strong><span>{t(example.observeKey)}</span></div>
                  <div className="tutorial-example-actions">
                    <a href={example.href} download className="tutorial-example-download">
                      <Download size={16} aria-hidden="true" />
                      {t(`${COPY}.examples.download`, { benchmark: example.benchmark })}
                    </a>
                    <a
                      href={example.starterHref}
                      className="tutorial-example-download tutorial-example-prepare"
                      aria-label={`${t(`${COPY}.examples.prepare`)} ${example.benchmark}`}
                    >
                      <PlayCircle size={16} aria-hidden="true" />
                      {t(`${COPY}.examples.prepare`)}
                    </a>
                  </div>
                </article>
              ))}
            </div>

            <div className="tutorial-callout" role="note"><Info size={19} aria-hidden="true" /><p>{t(`${COPY}.examples.contractNote`)}</p></div>
          </section>

          <section className="tutorial-section" id="resultados">
            <SectionHeading number="02" kickerKey={`${COPY}.results.kicker`} titleKey={`${COPY}.results.title`} descriptionKey={`${COPY}.results.description`} />

            <div className="tutorial-evidence-principle"><Gauge size={24} aria-hidden="true" /><div><h3>{t(`${COPY}.results.evidence.title`)}</h3><p>{t(`${COPY}.results.evidence.text`)}</p></div></div>

            <ol className="tutorial-result-flow" aria-label={t(`${COPY}.results.flow.aria`)}>
              {RESULT_FLOW.map(({ icon: Icon, key }, index) => (
                <li key={key}><span className="tutorial-result-flow__number">{String(index + 1).padStart(2, "0")}</span><Icon size={19} aria-hidden="true" /><span>{t(`${COPY}.results.flow.${key}`)}</span></li>
              ))}
            </ol>

            <div className="tutorial-subheading"><h3>{t(`${COPY}.results.metrics.title`)}</h3><p>{t(`${COPY}.results.metrics.description`)}</p></div>
            <div className="tutorial-metric-grid">
              {METRIC_FAMILIES.map(({ icon: Icon, key }) => (
                <article className="tutorial-metric-card" key={key}><Icon size={22} aria-hidden="true" /><h4>{t(`${COPY}.results.metrics.${key}.title`)}</h4><p>{t(`${COPY}.results.metrics.${key}.text`)}</p></article>
              ))}
            </div>

            <MediaStory shot={shot("resultsOverview")} pointKeys={[`${COPY}.results.overview.points.context`, `${COPY}.results.overview.points.configuration`, `${COPY}.results.overview.points.kpis`, `${COPY}.results.overview.points.interpretation`]} onOpen={openShot} />
            <MediaStory shot={shot("reproducibility")} reverse pointKeys={[`${COPY}.results.reproducibility.points.source`, `${COPY}.results.reproducibility.points.declared`, `${COPY}.results.reproducibility.points.hardware`, `${COPY}.results.reproducibility.points.observed`]} onOpen={openShot} />

            <div className="tutorial-provenance-grid">
              <article><span>{t(`${COPY}.results.provenance.declared.label`)}</span><h3>{t(`${COPY}.results.provenance.declared.title`)}</h3><p>{t(`${COPY}.results.provenance.declared.text`)}</p><code>C · gcc · -O3</code></article>
              <article><span>{t(`${COPY}.results.provenance.observed.label`)}</span><h3>{t(`${COPY}.results.provenance.observed.title`)}</h3><p>{t(`${COPY}.results.provenance.observed.text`)}</p><code>perf · gcc 9.4.0</code></article>
            </div>
          </section>

          <section className="tutorial-section" id="comparar">
            <SectionHeading number="03" kickerKey={`${COPY}.compare.kicker`} titleKey={`${COPY}.compare.title`} descriptionKey={`${COPY}.compare.description`} />

            <MediaStory shot={shot("history")} pointKeys={[`${COPY}.compare.history.points.experiments`, `${COPY}.compare.history.points.sources`, `${COPY}.compare.history.points.actions`]} onOpen={openShot} />

            <div className="tutorial-subheading"><h3>{t(`${COPY}.compare.compatibility.title`)}</h3><p>{t(`${COPY}.compare.compatibility.description`)}</p></div>
            <div className="tutorial-compatibility-grid">
              {COMPATIBILITY_STATES.map((state) => (
                <article key={state.code} className={`tutorial-compatibility-card${state.featured ? " tutorial-compatibility-card--featured" : ""}`}>
                  <code>{state.code}</code>
                  <h4>{t(`${COPY}.compare.compatibility.${state.key}.title`)}</h4>
                  <p>{t(`${COPY}.compare.compatibility.${state.key}.text`)}</p>
                  {state.featured && <div className="tutorial-toolchain-example"><span>C / gcc</span><ChevronRight size={17} aria-hidden="true" /><span>C++ / g++</span></div>}
                </article>
              ))}
            </div>

            <div className="tutorial-callout tutorial-callout--emphasis" role="note"><Activity size={20} aria-hidden="true" /><div><strong>{t(`${COPY}.compare.evidence.title`)}</strong><p>{t(`${COPY}.compare.evidence.text`)}</p></div></div>

            <MediaStory shot={shot("comparison")} reverse pointKeys={[`${COPY}.compare.comparison.points.toolchains`, `${COPY}.compare.comparison.points.coverage`, `${COPY}.compare.comparison.points.visible`, `${COPY}.compare.comparison.points.energy`]} onOpen={openShot} />
          </section>

          {showTeacherSection && (
            <section className="tutorial-section tutorial-teacher-section" id="supervisar" data-testid="tutorial-teacher-section">
              <SectionHeading number="04" kickerKey={`${COPY}.teacher.kicker`} titleKey={`${COPY}.teacher.title`} descriptionKey={`${COPY}.teacher.description`} />
              <MediaStory shot={shot("teacherCourse")} pointKeys={[`${COPY}.teacher.points.attention`, `${COPY}.teacher.points.noExecutions`, `${COPY}.teacher.points.failures`, `${COPY}.teacher.points.activity`, `${COPY}.teacher.points.students`]} onOpen={openShot} />
              <div className="tutorial-teacher-actions">
                <div><ShieldCheck size={22} aria-hidden="true" /><p>{t(`${COPY}.teacher.guardrail`)}</p></div>
                <Link to="/teacher/courses" className="tutorial-primary-link">{t(`${COPY}.teacher.cta`)}<ChevronRight size={17} aria-hidden="true" /></Link>
              </div>
            </section>
          )}

          <section className="tutorial-section tutorial-final-card">
            <div><span className="tutorial-section-kicker">{t(`${COPY}.final.kicker`)}</span><h2>{t(`${COPY}.final.title`)}</h2><p>{t(`${COPY}.final.description`)}</p></div>
            <div className="tutorial-final-card__actions">
              <Link to="/" className="tutorial-primary-link"><UploadCloud size={17} aria-hidden="true" />{t(`${COPY}.final.newAnalysis`)}</Link>
              <Link to="/history" className="tutorial-secondary-link"><History size={17} aria-hidden="true" />{t(`${COPY}.final.history`)}</Link>
            </div>
          </section>
        </div>
      </main>

      {activeShot && (
        <div className="tutorial-lightbox" role="dialog" aria-modal="true" aria-label={t(`${COPY}.lightbox.aria`)} onMouseDown={(event) => { if (event.target === event.currentTarget) closeShot(); }}>
          <div className="tutorial-lightbox__dialog">
            <button ref={closeButtonRef} type="button" className="tutorial-lightbox__close" onClick={closeShot} aria-label={t(`${COPY}.lightbox.closeAria`)}><X size={20} aria-hidden="true" /></button>
            <img src={activeShot.src} alt={t(activeShot.altKey)} />
            <p>{t(activeShot.captionKey)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorialPage;
