import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Gauge,
  GraduationCap,
  LogIn,
  Mail,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  UserRound,
  XCircle,
} from "lucide-react";
import { requestJson } from "../common/requestErrorModel";
import { translate, useI18n } from "../i18n";
import {
  formatAcademicPeriod,
  formatDateTime,
  formatDuration,
} from "../i18n/formatters";
import "./ProfilePage.css";

const formatRole = (role, t) => {
  const normalized = String(role ?? "").trim().toLowerCase();

  if (
    normalized === "admin" ||
    normalized === "administrator" ||
    normalized === "administrador"
  ) {
    return t("profile.roles.admin");
  }

  if (
    normalized === "teacher" ||
    normalized === "professor" ||
    normalized === "profesor"
  ) {
    return t("profile.roles.teacher");
  }

  if (
    normalized === "student" ||
    normalized === "estudiante"
  ) {
    return t("profile.roles.student");
  }

  return t("profile.roles.user");
};

const formatExecutionState = (state, t) => {
  const normalized = String(state || "").trim().toUpperCase();
  const keys = {
    QUEUED: "profile.executionStates.queued",
    RUNNING: "profile.executionStates.running",
    PROCESSING: "profile.executionStates.processing",
    COMPLETED: "profile.executionStates.completed",
    FAILED: "profile.executionStates.failed",
    CANCELLED: "profile.executionStates.cancelled",
  };

  if (!normalized) return t("profile.executionStates.none");

  return t(
    keys[normalized] ||
      "profile.executionStates.unavailable"
  );
};

const localizedErrorText = (error, language, t) => {
  if (!error) return "";

  if (language === "es" && error.rawText) {
    return error.rawText;
  }

  return t(error.key);
};

const getInitials = (fullName, email) => {
  const source = String(fullName || "").trim();

  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    return source.slice(0, 2).toUpperCase();
  }

  const localPart = String(email || "").split("@")[0].trim();
  return localPart.slice(0, 2).toUpperCase() || "U";
};

const ProfileMetricCard = ({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}) => (
  <article className={`profile-metric-card profile-metric-card--${tone}`}>
    <div className="profile-metric-card__icon">
      <Icon size={20} strokeWidth={1.9} />
    </div>

    <div>
      <span className="profile-metric-card__label">{label}</span>
      <strong className="profile-metric-card__value">{value}</strong>
      {hint && <span className="profile-metric-card__hint">{hint}</span>}
    </div>
  </article>
);

const ProfileCourseCard = ({ course, locale, t }) => {
  const courseId = String(course?.id ?? "").trim();
  const courseCode =
    String(course?.code || "").trim() ||
    t("profile.courseFallback");
  const courseName =
    String(course?.name || "").trim() ||
    t("profile.unnamedCourse");
  const teacherName =
    String(course?.teacher?.fullName || "").trim() ||
    t("profile.teacherUnavailable");
  const analysisPath = courseId
    ? `/?course=${encodeURIComponent(courseId)}`
    : "/";

  return (
    <article className="profile-course-card">
      <div className="profile-course-card__heading">
        <div className="profile-course-card__icon">
          <GraduationCap size={20} strokeWidth={1.9} aria-hidden="true" />
        </div>

        <div>
          <span className="profile-course-card__code">{courseCode}</span>
          <h3>{courseName}</h3>
        </div>
      </div>

      <div className="profile-course-card__metadata">
        <div>
          <span>{t("profile.period")}</span>
          <strong>
            {formatAcademicPeriod(course, {
              semesterLabel: t("profile.semester"),
              fallback: t("profile.noPeriod"),
            })}
          </strong>
        </div>
        <div>
          <span>{t("profile.professor")}</span>
          <strong>{teacherName}</strong>
        </div>
      </div>

      <Link to={analysisPath} className="profile-course-card__action">
        {t("profile.newAnalysisInCourse")}
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </article>
  );
};

const ProfilePage = () => {
  const { language, locale, t } = useI18n();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const body = await requestJson(
        "/api/profile",
        { credentials: "include" },
        { fallback: translate("es", "profile.errors.load") }
      );

      if (
        !body ||
        typeof body !== "object" ||
        !body.profile ||
        !body.summary
      ) {
        setData(null);
        setError({
          key: "profile.errors.incomplete",
          rawText: "",
        });
        return;
      }

      setData(body);
    } catch (loadError) {
      console.error("Error cargando /api/profile:", loadError);
      setError({
        key: "profile.errors.load",
        rawText: loadError?.message || "",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadCourses = useCallback(async () => {
    setCoursesLoading(true);
    setCoursesError(null);

    try {
      const body = await requestJson(
        "/api/student/courses",
        { credentials: "include" },
        { fallback: translate("es", "profile.errors.courses") }
      );

      setCourses(
        Array.isArray(body?.items)
          ? body.items
          : []
      );
    } catch (loadError) {
      console.error("Error cargando /api/student/courses:", loadError);
      setCourses([]);
      setCoursesError({
        key: "profile.errors.courses",
        rawText: loadError?.message || "",
      });
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadCourses();
  }, [loadProfile, loadCourses]);

  const profileErrorText = localizedErrorText(error, language, t);
  const coursesErrorText = localizedErrorText(coursesError, language, t);

  const profile = data?.profile ?? {};
  const summary = data?.summary ?? {};

  const activeExecutions = useMemo(
    () =>
      Number(summary.queuedExecutions || 0) +
      Number(summary.runningExecutions || 0) +
      Number(summary.processingExecutions || 0),
    [
      summary.queuedExecutions,
      summary.runningExecutions,
      summary.processingExecutions,
    ]
  );

  const initials = getInitials(profile.full_name, profile.email);

  const canOpenLastResult =
    summary.lastExecutionState === "COMPLETED" &&
    Boolean(summary.lastExecutionCodename);
  const canOpenLastSubmission =
    summary.lastSubmissionId !== null &&
    summary.lastSubmissionId !== undefined;

  if (isLoading) {
    return (
      <div className="app-page profile-page">
        <main className="profile-main">
          <div className="profile-container">
            <div className="profile-loading" role="status" aria-live="polite">
              <RefreshCw size={22} className="profile-loading__icon" />
              <div>
                <strong>{t("profile.loadingTitle")}</strong>
                <span>{t("profile.loadingText")}</span>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-page profile-page">
        <main className="profile-main">
          <div className="profile-container">
            <section className="profile-error-card">
              <XCircle size={28} strokeWidth={1.8} />

              <div>
                <span className="profile-eyebrow">{t("profile.eyebrow")}</span>
                <h1>{t("profile.loadErrorTitle")}</h1>
                <p>{profileErrorText}</p>

                <button
                  type="button"
                  className="profile-button profile-button--primary"
                  onClick={loadProfile}
                >
                  <RefreshCw size={17} />
                  {t("profile.retry")}
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-page profile-page">
      <main className="profile-main">
        <div className="profile-container">
          <header className="profile-header">
            <div>
              <span className="profile-eyebrow">{t("profile.accountEyebrow")}</span>
              <h1>{t("profile.title")}</h1>
              <p>{t("profile.description")}</p>
            </div>

            <Link to="/" className="profile-button profile-button--primary">
              <PlayCircle size={18} />
              {t("profile.newAnalysis")}
            </Link>
          </header>

          <section className="profile-identity-card">
            <div className="profile-avatar">{initials}</div>

            <div className="profile-identity-card__body">
              <div className="profile-identity-card__heading">
                <div>
                  <h2>{profile.full_name || t("profile.roles.user")}</h2>

                  <span className="profile-email">
                    <Mail size={16} />
                    {profile.email || t("profile.noEmail")}
                  </span>
                </div>

                <div className="profile-badges">
                  <span className="profile-badge profile-badge--role">
                    <ShieldCheck size={15} />
                    {formatRole(profile.role, t)}
                  </span>

                  <span
                    className={
                      profile.isActive
                        ? "profile-badge profile-badge--active"
                        : "profile-badge profile-badge--inactive"
                    }
                  >
                    <span className="profile-badge__dot" />
                    {profile.isActive
                      ? t("profile.accountStatus.active")
                      : t("profile.accountStatus.inactive")}
                  </span>
                </div>
              </div>

              <div className="profile-account-grid">
                <div>
                  <CalendarDays size={18} />
                  <span>{t("profile.accountCreated")}</span>
                  <strong>{formatDateTime(profile.createdAt, locale, t("profile.noRecord"))}</strong>
                </div>

                <div>
                  <LogIn size={18} />
                  <span>{t("profile.lastSession")}</span>
                  <strong>{formatDateTime(profile.lastLogin, locale, t("profile.noRecord"))}</strong>
                </div>

                <div>
                  <Activity size={18} />
                  <span>{t("profile.lastExecution")}</span>
                  <strong>{formatDateTime(summary.lastExecutionAt, locale, t("profile.noRecord"))}</strong>
                </div>
              </div>
            </div>
          </section>

          <section
            className="profile-section"
            aria-labelledby="profile-courses-title"
          >
            <div className="profile-section-heading">
              <div>
                <span className="profile-eyebrow">{t("profile.academicContext")}</span>
                <h2 id="profile-courses-title">{t("profile.coursesTitle")}</h2>
              </div>

              <p>{t("profile.coursesDescription")}</p>
            </div>

            {coursesLoading ? (
              <div
                className="profile-courses-state"
                role="status"
                aria-live="polite"
              >
                <RefreshCw
                  size={21}
                  className="profile-loading__icon"
                  aria-hidden="true"
                />
                <div>
                  <strong>{t("profile.coursesLoadingTitle")}</strong>
                  <p>{t("profile.coursesLoadingText")}</p>
                </div>
              </div>
            ) : coursesError ? (
              <div className="profile-courses-state profile-courses-state--error">
                <XCircle size={22} strokeWidth={1.8} aria-hidden="true" />
                <div>
                  <strong>{t("profile.coursesLoadErrorTitle")}</strong>
                  <p>{coursesErrorText}</p>
                  <button
                    type="button"
                    className="profile-button profile-button--primary"
                    onClick={loadCourses}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    {t("profile.retryCourses")}
                  </button>
                </div>
              </div>
            ) : courses.length === 0 ? (
              <div className="profile-courses-state">
                <GraduationCap size={24} strokeWidth={1.8} aria-hidden="true" />
                <div>
                  <strong>{t("profile.noCoursesTitle")}</strong>
                  <p>{t("profile.noCoursesText")}</p>
                  <Link to="/" className="profile-inline-link">
                    {t("profile.startPersonalAnalysis")}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="profile-courses-grid">
                {courses.map((course) => (
                  <ProfileCourseCard
                    key={course.id}
                    course={course}
                    locale={locale}
                    t={t}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="profile-section">
            <div className="profile-section-heading">
              <div>
                <span className="profile-eyebrow">{t("profile.activity")}</span>
                <h2>{t("profile.usageSummary")}</h2>
              </div>

              <p>{t("profile.usageDescription")}</p>
            </div>

            <div className="profile-metrics-grid">
              <ProfileMetricCard
                icon={UploadCloud}
                label={t("profile.metrics.submissions")}
                value={summary.submissionsCount || 0}
                hint={t("profile.metrics.submissionsHint")}
              />

              <ProfileMetricCard
                icon={Activity}
                label={t("profile.metrics.executions")}
                value={summary.executionsCount || 0}
                hint={t("profile.metrics.executionsHint")}
              />

              <ProfileMetricCard
                icon={CheckCircle2}
                label={t("profile.metrics.completed")}
                value={summary.completedExecutions || 0}
                hint={t("profile.metrics.completedHint")}
                tone="success"
              />

              <ProfileMetricCard
                icon={XCircle}
                label={t("profile.metrics.failed")}
                value={summary.failedExecutions || 0}
                hint={t("profile.metrics.failedHint")}
                tone="danger"
              />
            </div>
          </section>

          <section className="profile-two-column">
            <article className="profile-panel">
              <div className="profile-panel__title">
                <Gauge size={20} />
                <div>
                  <span className="profile-eyebrow">{t("profile.executionsEyebrow")}</span>
                  <h2>{t("profile.currentState")}</h2>
                </div>
              </div>

              <div className="profile-state-list">
                <div>
                  <span>{t("profile.active")}</span>
                  <strong>{activeExecutions}</strong>
                </div>
                <div>
                  <span>{t("profile.queued")}</span>
                  <strong>{summary.queuedExecutions || 0}</strong>
                </div>
                <div>
                  <span>{t("profile.running")}</span>
                  <strong>{summary.runningExecutions || 0}</strong>
                </div>
                <div>
                  <span>{t("profile.processing")}</span>
                  <strong>{summary.processingExecutions || 0}</strong>
                </div>
                <div>
                  <span>{t("profile.cancelled")}</span>
                  <strong>{summary.cancelledExecutions || 0}</strong>
                </div>
              </div>
            </article>

            <article className="profile-panel">
              <div className="profile-panel__title">
                <Clock3 size={20} />
                <div>
                  <span className="profile-eyebrow">{t("profile.latestActivity")}</span>
                  <h2>{t("profile.latestExecution")}</h2>
                </div>
              </div>

              <div className="profile-last-execution">
                <div>
                  <span>{t("profile.status")}</span>
                  <strong>
                    {formatExecutionState(summary.lastExecutionState, t)}
                  </strong>
                </div>

                <div>
                  <span>{t("profile.date")}</span>
                  <strong>{formatDateTime(summary.lastExecutionAt, locale, t("profile.noRecord"))}</strong>
                </div>

                <div>
                  <span>{t("profile.duration")}</span>
                  <strong>{formatDuration(summary.lastExecutionDurationMs, locale, t("profile.noData"))}</strong>
                </div>
              </div>

              <div className="profile-inline-actions">
                {canOpenLastSubmission && (
                  <Link
                    to={`/submissions/${encodeURIComponent(
                      String(summary.lastSubmissionId)
                    )}`}
                    className="profile-inline-link"
                  >
                    {t("profile.viewExperiment")}
                    <ArrowRight size={16} />
                  </Link>
                )}

                {canOpenLastResult && (
                  <Link
                    to={`/code/${summary.lastExecutionCodename}`}
                    className="profile-inline-link"
                  >
                    {t("profile.viewLastResult")}
                    <ArrowRight size={16} />
                  </Link>
                )}

                <Link to="/history" className="profile-inline-link">
                  {t("profile.viewFullHistory")}
                  <ArrowRight size={16} />
                </Link>
              </div>

              {!canOpenLastSubmission && !canOpenLastResult && (
                <span className="profile-inline-note">
                  {summary.executionsCount
                    ? t("profile.noFinalResult")
                    : t("profile.firstAnalysisState")}
                </span>
              )}
            </article>
          </section>

          <section className="profile-footnote">
            <UserRound size={19} />
            <div>
              <strong>{t("profile.institutionalData")}</strong>
              <p>{t("profile.institutionalDataText")}</p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
