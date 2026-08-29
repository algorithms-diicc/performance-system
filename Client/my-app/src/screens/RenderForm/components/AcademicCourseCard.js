import React from "react";

import { useI18n } from "../../../i18n";

function formatCourseLabel(course) {
  if (!course) {
    return "";
  }

  return `${course.code} · ${course.academicYear}-${course.academicTerm}`;
}

function AcademicCourseCard({
  courses,
  loading,
  error,
  selectedCourseId,
  selectionRequired,
  personalAllowed,
  onCourseChange,
  onRetry,
}) {
  const { t } = useI18n();

  if (!loading && !error && courses.length === 0) {
    return (
      <section className="rf-panel rf-course-context-panel">
        <div className="rf-course-context-heading">
          <div>
            <span className="rf-course-context-kicker">
              {t("renderForm.course.context")}
            </span>
            <h3>{t("renderForm.course.noCourse")}</h3>
          </div>

          <span className="rf-course-context-badge">
            {t("renderForm.course.personal")}
          </span>
        </div>

        <p className="form-help-text rf-course-context-message">
          {t("renderForm.course.noActiveCourses")}
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="rf-panel rf-course-context-panel">
        <div className="rf-course-context-heading">
          <div>
            <span className="rf-course-context-kicker">
              {t("renderForm.course.context")}
            </span>
            <h3>{t("renderForm.course.course")}</h3>
          </div>

          <span className="rf-course-context-badge">
            {t("renderForm.course.loading")}
          </span>
        </div>

        <p className="form-help-text rf-course-context-message">
          {t("renderForm.course.loadingText")}
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rf-panel rf-course-context-panel rf-course-context-panel--error">
        <div className="rf-course-context-heading">
          <div>
            <span className="rf-course-context-kicker">
              {t("renderForm.course.context")}
            </span>
            <h3>{t("renderForm.course.loadError")}</h3>
          </div>
        </div>

        <p className="form-help-text rf-course-context-message">
          {error}
        </p>

        <button
          type="button"
          className="rf-course-context-retry"
          onClick={onRetry}
        >
          {t("renderForm.course.retry")}
        </button>
      </section>
    );
  }

  // Student + único curso: asociación canónica automática.
  if (courses.length === 1 && !personalAllowed) {
    const course = courses[0];

    return (
      <section className="rf-panel rf-course-context-panel">
        <div className="rf-course-context-heading">
          <div>
            <span className="rf-course-context-kicker">
              {t("renderForm.course.context")}
            </span>
            <h3>{t("renderForm.course.associatedCourse")}</h3>
          </div>

          <span className="rf-course-context-badge rf-course-context-badge--auto">
            {t("renderForm.course.automatic")}
          </span>
        </div>

        <div className="rf-course-context-selected">
          <strong>{formatCourseLabel(course)}</strong>
          <span>{course.name}</span>
          <small>
            {course.teacher?.fullName
              ? t("renderForm.course.professor", {
                  name: course.teacher.fullName,
                })
              : t("renderForm.course.professorUnavailable")}
          </small>
        </div>

        <p className="form-help-text rf-course-context-message">
          {t("renderForm.course.automaticAssociation")}
        </p>
      </section>
    );
  }

  return (
    <section className="rf-panel rf-course-context-panel">
      <div className="rf-course-context-heading">
        <div>
          <span className="rf-course-context-kicker">
            {t("renderForm.course.context")}
          </span>

          <h3>
            {selectionRequired
              ? t("renderForm.course.selectCourse")
              : t("renderForm.course.optionalAssociation")}
          </h3>
        </div>

        <span
          className={
            selectionRequired
              ? "rf-course-context-badge rf-course-context-badge--required"
              : "rf-course-context-badge"
          }
        >
          {selectionRequired
            ? t("renderForm.course.required")
            : t("renderForm.course.optional")}
        </span>
      </div>

      <label
        className="form-label"
        htmlFor="rf-course-context-select"
      >
        {t("renderForm.course.deliveryCourse")}
      </label>

      <select
        id="rf-course-context-select"
        className="form-input rf-course-context-select"
        value={selectedCourseId}
        onChange={(event) => onCourseChange(event.target.value)}
        required={selectionRequired}
      >
        {personalAllowed ? (
          <option value="">
            {t("renderForm.course.personalOption")}
          </option>
        ) : (
          <option value="">
            {t("renderForm.course.selectPlaceholder")}
          </option>
        )}

        {courses.map((course) => (
          <option
            key={course.id}
            value={String(course.id)}
          >
            {formatCourseLabel(course)} · {course.name}
          </option>
        ))}
      </select>

      <p className="form-help-text rf-course-context-message">
        {selectionRequired
          ? t("renderForm.course.multipleCoursesHelp")
          : t("renderForm.course.optionalCoursesHelp")}
      </p>
    </section>
  );
}

export default AcademicCourseCard;
