import React, { useEffect, useState } from "react";
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
  MemoryStick,
  PlayCircle,
  ServerCog,
  Settings2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
  Zap,
  ZoomIn,
} from "lucide-react";
import { useLocation } from "react-router-dom";

import "./TutorialPage.css";

import configSummaryShot from "../assets/tutorial/tutorial-config-summary.png";
import profileSettingsShot from "../assets/tutorial/tutorial-profile-settings.png";
import progressDetailsShot from "../assets/tutorial/tutorial-progress-details.png";
import progressOverviewShot from "../assets/tutorial/tutorial-progress-overview.png";
import recentResultShot from "../assets/tutorial/tutorial-recent-result.png";
import resultsOverviewShot from "../assets/tutorial/tutorial-results-overview.png";
import timeChartShot from "../assets/tutorial/tutorial-time-chart.png";
import uploadShot from "../assets/tutorial/tutorial-upload.png";

import { useI18n } from "../i18n";

const FLOW_STEPS = [
  {
    number: "01",
    icon: UploadCloud,
    titleKey: "tutorialPage.flow.step1.title",
    descriptionKey: "tutorialPage.flow.step1.description",
    shots: [
      {
        src: uploadShot,
        altKey: "tutorialPage.flow.step1.shot.alt",
        captionKey: "tutorialPage.flow.step1.shot.caption",
        variant: "upload",
      },
    ],
  },
  {
    number: "02",
    icon: Settings2,
    titleKey: "tutorialPage.flow.step2.title",
    descriptionKey: "tutorialPage.flow.step2.description",
    shots: [
      {
        src: profileSettingsShot,
        altKey: "tutorialPage.flow.step2.profileShot.alt",
        captionKey: "tutorialPage.flow.step2.profileShot.caption",
        variant: "profiles",
      },
      {
        src: configSummaryShot,
        altKey: "tutorialPage.flow.step2.summaryShot.alt",
        captionKey: "tutorialPage.flow.step2.summaryShot.caption",
        variant: "summary",
      },
    ],
  },
  {
    number: "03",
    icon: PlayCircle,
    titleKey: "tutorialPage.flow.step3.title",
    descriptionKey: "tutorialPage.flow.step3.description",
    shots: [
      {
        src: progressOverviewShot,
        altKey: "tutorialPage.flow.step3.overviewShot.alt",
        captionKey: "tutorialPage.flow.step3.overviewShot.caption",
        variant: "portrait",
      },
      {
        src: progressDetailsShot,
        altKey: "tutorialPage.flow.step3.detailsShot.alt",
        captionKey: "tutorialPage.flow.step3.detailsShot.caption",
        variant: "portrait",
      },
    ],
  },
  {
    number: "04",
    icon: BarChart3,
    titleKey: "tutorialPage.flow.step4.title",
    descriptionKey: "tutorialPage.flow.step4.description",
    shots: [
      {
        src: resultsOverviewShot,
        altKey: "tutorialPage.flow.step4.shot.alt",
        captionKey: "tutorialPage.flow.step4.shot.caption",
        variant: "results",
      },
    ],
  },
];

const EXECUTION_STATES = [
  { code: "QUEUED", key: "queued" },
  { code: "RUNNING", key: "running" },
  { code: "PROCESSING", key: "processing" },
  { code: "COMPLETED", key: "completed" },
];

const METRICS = [
  { icon: Clock3, key: "time" },
  { icon: Cpu, key: "cpu" },
  { icon: MemoryStick, key: "memory" },
  { icon: Zap, key: "energy" },
];

const GOOD_PRACTICE_KEYS = [
  "tutorialPage.goodPractices.items.sameConfig",
  "tutorialPage.goodPractices.items.externalProcesses",
  "tutorialPage.goodPractices.items.repetitions",
  "tutorialPage.goodPractices.items.jointInterpretation",
];

const STARTER_EXAMPLES = [
  {
    benchmark: "SIZE",
    titleKey: "tutorialPage.examples.size.title",
    descriptionKey: "tutorialPage.examples.size.description",
    observeKey: "tutorialPage.examples.size.observe",
    files: ["insertion_sort.cpp", "merge_sort.cpp"],
    href: "/tutorial-codigos/size_template.zip",
  },
  {
    benchmark: "LCS",
    titleKey: "tutorialPage.examples.lcs.title",
    descriptionKey: "tutorialPage.examples.lcs.description",
    observeKey: "tutorialPage.examples.lcs.observe",
    files: ["longest_common_subsequence.cpp"],
    href: "/tutorial-codigos/lcs_template.zip",
  },
  {
    benchmark: "CAMM",
    titleKey: "tutorialPage.examples.camm.title",
    descriptionKey: "tutorialPage.examples.camm.description",
    observeKey: "tutorialPage.examples.camm.observe",
    files: ["blocked_matrix_multiplication.cpp"],
    href: "/tutorial-codigos/camm_template.zip",
  },
];

const RECENT_RESULT_SHOT = {
  src: recentResultShot,
  altKey: "tutorialPage.continuity.shot.alt",
  captionKey: "tutorialPage.continuity.shot.caption",
  variant: "recent",
};

const TIME_CHART_SHOT = {
  src: timeChartShot,
  altKey: "tutorialPage.results.example.shot.alt",
  captionKey: "tutorialPage.results.example.shot.caption",
  variant: "chart",
};

const TutorialScreenshot = ({ shot, onOpen }) => {
  const { t } = useI18n();
  const alt = t(shot.altKey);

  return (
    <figure className={`tutorial-shot tutorial-shot--${shot.variant || "default"}`}>
      <button
        type="button"
        className="tutorial-shot__button"
        onClick={() => onOpen(shot)}
        aria-label={t("tutorialPage.screenshot.expandAria", { alt })}
      >
        <span className="tutorial-shot__viewport">
          <img src={shot.src} alt={alt} loading="lazy" />
        </span>
        <span className="tutorial-shot__zoom" aria-hidden="true">
          <ZoomIn size={16} />
          {t("tutorialPage.screenshot.zoom")}
        </span>
      </button>
      {shot.captionKey && <figcaption>{t(shot.captionKey)}</figcaption>}
    </figure>
  );
};

const TutorialPage = () => {
  const [activeShot, setActiveShot] = useState(null);
  const location = useLocation();
  const { t } = useI18n();

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
      target.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }

    return undefined;
  }, [location.hash]);

  useEffect(() => {
    if (!activeShot) return undefined;

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setActiveShot(null);
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeShot]);

  return (
    <div className="app-page tutorial-page">
      <main className="tutorial-main">
        <div className="tutorial-container">
          <header className="tutorial-hero">
            <div className="tutorial-eyebrow">
              <Sparkles size={16} />
              <span>{t("tutorialPage.hero.eyebrow")}</span>
            </div>

            <h1 className="tutorial-title">{t("tutorialPage.hero.title")}</h1>

            <p className="tutorial-subtitle">{t("tutorialPage.hero.subtitle")}</p>

            <div
              className="tutorial-hero-badges"
              aria-label={t("tutorialPage.hero.featuresAria")}
            >
              <span>
                <FileCode2 size={16} />
                C / C++
              </span>
              <span>
                <ShieldCheck size={16} />
                {t("tutorialPage.hero.badges.controlled")}
              </span>
              <span>
                <Activity size={16} />
                {t("tutorialPage.hero.badges.performance")}
              </span>
              <span>
                <BarChart3 size={16} />
                {t("tutorialPage.hero.badges.visualization")}
              </span>
            </div>
          </header>

          <section className="tutorial-section">
            <div className="tutorial-section-heading">
              <span className="tutorial-section-kicker">
                {t("tutorialPage.flow.kicker")}
              </span>
              <h2>{t("tutorialPage.flow.title")}</h2>
              <p>{t("tutorialPage.flow.description")}</p>

              <div className="tutorial-capture-context" role="note">
                <Info size={16} aria-hidden="true" />
                <span>
                  <strong>{t("tutorialPage.flow.visualReferenceLabel")}</strong>{" "}
                  {t("tutorialPage.flow.visualReferenceText")}
                </span>
              </div>
            </div>

            <div className="tutorial-flow">
              {FLOW_STEPS.map((step, index) => {
                const Icon = step.icon;

                return (
                  <article className="tutorial-flow-card" key={step.number}>
                    <div className="tutorial-flow-card__top">
                      <span className="tutorial-step-number">{step.number}</span>
                      <div className="tutorial-step-icon">
                        <Icon size={22} strokeWidth={1.9} />
                      </div>
                    </div>

                    <h3>{t(step.titleKey)}</h3>
                    <p>{t(step.descriptionKey)}</p>

                    <div
                      className={`tutorial-flow-card__media tutorial-flow-card__media--${step.shots.length} tutorial-flow-card__media--step-${step.number}`}
                    >
                      {step.shots.map((shot) => (
                        <TutorialScreenshot
                          key={shot.src}
                          shot={shot}
                          onOpen={setActiveShot}
                        />
                      ))}
                    </div>

                    {index < FLOW_STEPS.length - 1 && (
                      <ChevronRight
                        className="tutorial-flow-card__arrow"
                        size={20}
                        aria-hidden="true"
                      />
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="tutorial-section tutorial-two-column">
            <article className="tutorial-panel">
              <div className="tutorial-panel-title">
                <Archive size={21} />
                <div>
                  <span className="tutorial-section-kicker">
                    {t("tutorialPage.zip.kicker")}
                  </span>
                  <h2>{t("tutorialPage.zip.title")}</h2>
                </div>
              </div>

              <p>{t("tutorialPage.zip.description")}</p>

              <div
                className="tutorial-file-tree"
                aria-label={t("tutorialPage.zip.exampleAria")}
              >
                <span>mi_algoritmo.zip</span>
                <span className="tutorial-file-tree__child">
                  └── algoritmo.cpp
                </span>
              </div>

              <div className="tutorial-note">
                <Info size={18} />
                <p>{t("tutorialPage.zip.note")}</p>
              </div>
            </article>

            <article className="tutorial-panel">
              <div className="tutorial-panel-title">
                <Settings2 size={21} />
                <div>
                  <span className="tutorial-section-kicker">
                    {t("tutorialPage.configuration.kicker")}
                  </span>
                  <h2>{t("tutorialPage.configuration.title")}</h2>
                </div>
              </div>

              <div className="tutorial-definition-list">
                <div>
                  <strong>Benchmark</strong>
                  <span>{t("tutorialPage.configuration.benchmark")}</span>
                </div>
                <div>
                  <strong>{t("tutorialPage.configuration.inputSizeLabel")}</strong>
                  <span>{t("tutorialPage.configuration.inputSize")}</span>
                </div>
                <div>
                  <strong>{t("tutorialPage.configuration.repetitionsLabel")}</strong>
                  <span>{t("tutorialPage.configuration.repetitions")}</span>
                </div>
                <div>
                  <strong>{t("tutorialPage.configuration.profileLabel")}</strong>
                  <span>{t("tutorialPage.configuration.profile")}</span>
                </div>
              </div>
            </article>
          </section>

          <section
            className="tutorial-section tutorial-examples-section"
            id="ejemplos"
            aria-labelledby="tutorial-examples-title"
          >
            <div className="tutorial-section-heading">
              <span className="tutorial-section-kicker">
                {t("tutorialPage.examples.kicker")}
              </span>
              <h2 id="tutorial-examples-title">{t("tutorialPage.examples.title")}</h2>
              <p>{t("tutorialPage.examples.description")}</p>
            </div>

            <div className="tutorial-example-grid">
              {STARTER_EXAMPLES.map((example) => (
                <article className="tutorial-example-card" key={example.benchmark}>
                  <div className="tutorial-example-card__top">
                    <span className="tutorial-example-benchmark">
                      {example.benchmark}
                    </span>
                    <FileCode2 size={21} aria-hidden="true" />
                  </div>

                  <h3>{t(example.titleKey)}</h3>
                  <p>{t(example.descriptionKey)}</p>

                  <div className="tutorial-example-files">
                    {example.files.map((filename) => (
                      <code key={filename}>{filename}</code>
                    ))}
                  </div>

                  <div className="tutorial-example-observe">
                    <strong>{t("tutorialPage.examples.observeLabel")}</strong>
                    <span>{t(example.observeKey)}</span>
                  </div>

                  <a
                    href={example.href}
                    download
                    className="tutorial-example-download"
                  >
                    <Download size={16} aria-hidden="true" />
                    {t("tutorialPage.examples.download", {
                      benchmark: example.benchmark,
                    })}
                  </a>
                </article>
              ))}
            </div>

            <div className="tutorial-note tutorial-examples-note">
              <Info size={18} aria-hidden="true" />
              <p>{t("tutorialPage.examples.sizeNote")}</p>
            </div>
          </section>

          <section className="tutorial-section">
            <div className="tutorial-section-heading">
              <span className="tutorial-section-kicker">
                {t("tutorialPage.states.kicker")}
              </span>
              <h2>{t("tutorialPage.states.title")}</h2>
              <p>{t("tutorialPage.states.description")}</p>
            </div>

            <div className="tutorial-state-grid">
              {EXECUTION_STATES.map((state) => (
                <article className="tutorial-state-card" key={state.code}>
                  <span className="tutorial-state-dot" aria-hidden="true" />
                  <div>
                    <div className="tutorial-state-card__title">
                      <strong>
                        {t(`tutorialPage.states.items.${state.key}.name`)}
                      </strong>
                      <code>{state.code}</code>
                    </div>
                    <p>
                      {t(`tutorialPage.states.items.${state.key}.description`)}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            <div className="tutorial-failure-note">
              <ServerCog size={20} />
              <div>
                <strong>{t("tutorialPage.states.failure.title")}</strong>
                <p>{t("tutorialPage.states.failure.description")}</p>
              </div>
            </div>
          </section>

          <section className="tutorial-section tutorial-resume-panel">
            <div className="tutorial-resume-panel__copy">
              <div className="tutorial-panel-title">
                <History size={21} />
                <div>
                  <span className="tutorial-section-kicker">
                    {t("tutorialPage.continuity.kicker")}
                  </span>
                  <h2>{t("tutorialPage.continuity.title")}</h2>
                </div>
              </div>

              <p>{t("tutorialPage.continuity.description")}</p>

              <div className="tutorial-note">
                <Info size={18} />
                <p>
                  <strong>{t("tutorialPage.continuity.lastResultLabel")}</strong>{" "}
                  {t("tutorialPage.continuity.lastResultDescription")}
                </p>
              </div>
            </div>

            <TutorialScreenshot
              shot={RECENT_RESULT_SHOT}
              onOpen={setActiveShot}
            />
          </section>

          <section className="tutorial-section">
            <div className="tutorial-section-heading">
              <span className="tutorial-section-kicker">
                {t("tutorialPage.results.kicker")}
              </span>
              <h2>{t("tutorialPage.results.title")}</h2>
              <p>{t("tutorialPage.results.description")}</p>
            </div>

            <div className="tutorial-metric-grid">
              {METRICS.map((metric) => {
                const Icon = metric.icon;

                return (
                  <article className="tutorial-metric-card" key={metric.key}>
                    <div className="tutorial-metric-card__icon">
                      <Icon size={22} strokeWidth={1.8} />
                    </div>
                    <h3>
                      {t(`tutorialPage.results.metrics.${metric.key}.title`)}
                    </h3>
                    <p>
                      {t(`tutorialPage.results.metrics.${metric.key}.text`)}
                    </p>
                  </article>
                );
              })}
            </div>

            <div className="tutorial-result-example">
              <div className="tutorial-result-example__copy">
                <span className="tutorial-section-kicker">
                  {t("tutorialPage.results.example.kicker")}
                </span>
                <h3>{t("tutorialPage.results.example.title")}</h3>
                <p>{t("tutorialPage.results.example.description")}</p>
                <ul>
                  <li>{t("tutorialPage.results.example.points.unit")}</li>
                  <li>{t("tutorialPage.results.example.points.trend")}</li>
                  <li>{t("tutorialPage.results.example.points.compare")}</li>
                </ul>
              </div>

              <TutorialScreenshot
                shot={TIME_CHART_SHOT}
                onOpen={setActiveShot}
              />
            </div>
          </section>

          <section className="tutorial-section tutorial-two-column">
            <article className="tutorial-panel">
              <div className="tutorial-panel-title">
                <Gauge size={21} />
                <div>
                  <span className="tutorial-section-kicker">
                    {t("tutorialPage.interpretation.kicker")}
                  </span>
                  <h2>{t("tutorialPage.interpretation.title")}</h2>
                </div>
              </div>

              <p>{t("tutorialPage.interpretation.description")}</p>

              <div className="tutorial-analysis-preview">
                <div>
                  <Activity size={18} />
                  <span>{t("tutorialPage.interpretation.preview.trend")}</span>
                </div>
                <div>
                  <Layers3 size={18} />
                  <span>{t("tutorialPage.interpretation.preview.metrics")}</span>
                </div>
                <div>
                  <Code2 size={18} />
                  <span>
                    {t("tutorialPage.interpretation.preview.implementation")}
                  </span>
                </div>
              </div>
            </article>

            <article className="tutorial-panel">
              <div className="tutorial-panel-title">
                <CheckCircle2 size={21} />
                <div>
                  <span className="tutorial-section-kicker">
                    {t("tutorialPage.goodPractices.kicker")}
                  </span>
                  <h2>{t("tutorialPage.goodPractices.title")}</h2>
                </div>
              </div>

              <ul className="tutorial-check-list">
                {GOOD_PRACTICE_KEYS.map((practiceKey) => (
                  <li key={practiceKey}>
                    <CheckCircle2 size={17} />
                    <span>{t(practiceKey)}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="tutorial-section">
            <article className="tutorial-final-card">
              <div className="tutorial-final-card__icon">
                <BarChart3 size={24} />
              </div>
              <div>
                <span className="tutorial-section-kicker">
                  {t("tutorialPage.final.kicker")}
                </span>
                <h2>{t("tutorialPage.final.title")}</h2>
                <p>{t("tutorialPage.final.description")}</p>
              </div>
            </article>
          </section>
        </div>
      </main>

      {activeShot && (
        <div
          className="tutorial-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={t("tutorialPage.lightbox.aria")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setActiveShot(null);
          }}
        >
          <div className="tutorial-lightbox__dialog">
            <button
              type="button"
              className="tutorial-lightbox__close"
              onClick={() => setActiveShot(null)}
              aria-label={t("tutorialPage.lightbox.closeAria")}
            >
              <X size={20} />
            </button>

            <div
              className={`tutorial-lightbox__viewport tutorial-lightbox__viewport--${activeShot.variant || "default"}`}
            >
              <img src={activeShot.src} alt={t(activeShot.altKey)} />
            </div>

            {activeShot.captionKey && <p>{t(activeShot.captionKey)}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default TutorialPage;
