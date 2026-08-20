import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import InlineState
  from "../components/InlineState";

import {
  useI18n,
} from "../i18n";

import {
  coursePeriod,
  formatDateTime,
  teacherApi,
  teacherRequestErrorMessage,
} from "./teacherApi";

import "./TeacherDashboard.css";


const currentYear =
  new Date().getFullYear();


function EmptyCourseState({
  activeView,
  onCreate,
}) {
  const { t } = useI18n();

  return (
    <div className="teacher-empty">
      <h3>
        {activeView
          ? t("teacherCourses.empty.activeTitle")
          : t("teacherCourses.empty.historyTitle")}
      </h3>

      <p>
        {activeView
          ? t("teacherCourses.empty.activeDescription")
          : t("teacherCourses.empty.historyDescription")}
      </p>

      {activeView && (
        <button
          type="button"
          className="btn teacher-primary-button"
          onClick={onCreate}
        >
          {t("teacherCourses.actions.create")}
        </button>
      )}
    </div>
  );
}


function CourseCard({
  course,
  onOpen,
}) {
  const {
    locale,
    t,
  } = useI18n();

  const totalStudents =
    course.totalStudents || 0;

  const studentCountLabel =
    course.totalStudents >
      course.activeStudents
      ? t(
          "teacherCourses.card.historicalStudents",
          {
            count:
              totalStudents,
          }
        )
      : t(
          totalStudents === 1
            ? "teacherCourses.card.registeredStudents.one"
            : "teacherCourses.card.registeredStudents.other",
          {
            count:
              totalStudents,
          }
        );

  return (
    <article className="teacher-course-card">
      <div className="teacher-course-card-top">
        <div>
          <div className="teacher-course-code-row">
            <strong>
              {course.code}
            </strong>

            <span
              className={
                course.isActive
                  ? "teacher-status teacher-status--active"
                  : "teacher-status teacher-status--historic"
              }
            >
              {course.isActive
                ? t("teacherCourses.card.active")
                : t("teacherCourses.card.finished")}
            </span>
          </div>

          <h2>
            {course.name}
          </h2>

          <p>
            {coursePeriod(course)}
            {" · "}
            {course.teacher?.fullName ||
              t(
                "teacherCourses.card.teacherUnavailable"
              )}
          </p>
        </div>

        <button
          type="button"
          className="btn teacher-secondary-button"
          onClick={() =>
            onOpen(course.id)
          }
        >
          {t(
            "teacherCourses.actions.open"
          )}
        </button>
      </div>


      <div className="teacher-course-metrics">
        <div>
          <span>
            {t(
              "teacherCourses.metrics.students"
            )}
          </span>
          <strong>
            {course.activeStudents || 0}
          </strong>
        </div>

        <div>
          <span>
            {t(
              "teacherCourses.metrics.submissions"
            )}
          </span>
          <strong>
            {course.submissions || 0}
          </strong>
        </div>

        <div>
          <span>
            {t(
              "teacherCourses.metrics.executions"
            )}
          </span>
          <strong>
            {course.executions || 0}
          </strong>
        </div>
      </div>


      <footer className="teacher-course-footer">
        <span>
          {studentCountLabel}
        </span>

        <span>
          {t(
            "teacherCourses.card.lastActivity",
            {
              value:
                formatDateTime(
                  course.lastActivityAt,
                  locale,
                  t(
                    "teacherCourses.common.unavailable"
                  )
                ),
            }
          )}
        </span>
      </footer>
    </article>
  );
}


function createCourseErrorMessage(
  error,
  language,
  t
) {
  if (!error) {
    return "";
  }

  const status =
    Number(error?.status);

  const businessStatus =
    status === 400 ||
    status === 409 ||
    status === 422;

  /*
   * Compatibilidad legacy en español:
   * conserva el detalle backend esperado.
   * En inglés nunca se filtra ese texto.
   */
  if (
    language === "es" &&
    businessStatus &&
    typeof error?.message === "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  const code =
    String(error?.code || "")
      .trim()
      .toUpperCase();

  const field =
    String(
      error?.payload?.error?.field || ""
    ).trim();

  if (
    code === "VALIDATION_ERROR"
  ) {
    const fieldKeys = {
      code:
        "teacherCourses.errors.validationCode",
      name:
        "teacherCourses.errors.validationName",
      academicYear:
        "teacherCourses.errors.validationYear",
      academicTerm:
        "teacherCourses.errors.validationTerm",
    };

    if (fieldKeys[field]) {
      return t(
        fieldKeys[field]
      );
    }

    return t(
      "teacherCourses.errors.createValidation"
    );
  }

  return teacherRequestErrorMessage(
    error,
    t,
    {
      fallbackKey:
        "teacherCourses.errors.create",
    }
  );
}


export default function TeacherCourses() {
  const navigate =
    useNavigate();

  const {
    language,
    t,
  } = useI18n();

  const [
    activeView,
    setActiveView,
  ] = useState(true);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);

  const [
    reloadToken,
    setReloadToken,
  ] = useState(0);

  const [
    showCreate,
    setShowCreate,
  ] = useState(false);

  const [
    creating,
    setCreating,
  ] = useState(false);

  const [
    createError,
    setCreateError,
  ] = useState(null);

  const [
    form,
    setForm,
  ] = useState({
    code: "",
    name: "",
    academicYear: currentYear,
    academicTerm: 2,
  });


  useEffect(() => {
    const controller =
      new AbortController();

    const timer =
      window.setTimeout(
        async () => {
          try {
            setLoading(true);
            setError(null);

            const params =
              new URLSearchParams({
                active:
                  activeView
                    ? "true"
                    : "false",
              });

            if (search.trim()) {
              params.set(
                "search",
                search.trim()
              );
            }

            const data =
              await teacherApi(
                `/api/teacher/courses?${params.toString()}`,
                {
                  signal:
                    controller.signal,
                }
              );

            setItems(
              Array.isArray(data.items)
                ? data.items
                : []
            );
          } catch (err) {
            if (
              err.name === "AbortError"
            ) {
              return;
            }

            setItems([]);
            setError(err);
          } finally {
            if (
              !controller.signal
                .aborted
            ) {
              setLoading(false);
            }
          }
        },
        search.trim()
          ? 250
          : 0
      );

    return () => {
      window.clearTimeout(
        timer
      );

      controller.abort();
    };
  }, [
    activeView,
    search,
    reloadToken,
  ]);


  const stats =
    useMemo(
      () => ({
        courses:
          items.length,
        students:
          items.reduce(
            (total, course) =>
              total +
              (
                course.activeStudents
                || 0
              ),
            0
          ),
        submissions:
          items.reduce(
            (total, course) =>
              total +
              (
                course.submissions
                || 0
              ),
            0
          ),
        executions:
          items.reduce(
            (total, course) =>
              total +
              (
                course.executions
                || 0
              ),
            0
          ),
      }),
      [items]
    );


  const changeForm = (
    field,
    value
  ) => {
    setForm(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );
  };


  const createCourse =
    async (event) => {
      event.preventDefault();

      try {
        setCreating(true);
        setCreateError(null);

        const data =
          await teacherApi(
            "/api/teacher/courses",
            {
              method: "POST",
              body:
                JSON.stringify({
                  code:
                    form.code.trim(),
                  name:
                    form.name.trim(),
                  academicYear:
                    Number(
                      form.academicYear
                    ),
                  academicTerm:
                    Number(
                      form.academicTerm
                    ),
                }),
            }
          );

        const courseId =
          data?.course?.id;

        setShowCreate(false);

        setForm({
          code: "",
          name: "",
          academicYear:
            currentYear,
          academicTerm: 2,
        });

        setReloadToken(
          (value) =>
            value + 1
        );

        if (courseId) {
          navigate(
            `/teacher/courses/${courseId}`
          );
        }
      } catch (err) {
        setCreateError(err);
      } finally {
        setCreating(false);
      }
    };


  const loadErrorMessage =
    error
      ? teacherRequestErrorMessage(
          error,
          t,
          {
            fallbackKey:
              "teacherCourses.errors.load",
          }
        )
      : "";

  const createErrorMessage =
    createCourseErrorMessage(
      createError,
      language,
      t
    );


  return (
    <main className="teacher-page">
      <div className="teacher-page-inner">
        <header className="teacher-page-header">
          <div>
            <p className="teacher-eyebrow">
              {t(
                "teacherCourses.header.eyebrow"
              )}
            </p>

            <h1>
              {t(
                "teacherCourses.header.title"
              )}
            </h1>

            <span>
              {t(
                "teacherCourses.header.description"
              )}
            </span>
          </div>

          <button
            type="button"
            className="btn teacher-primary-button"
            onClick={() => {
              setCreateError(null);
              setShowCreate(
                (value) => !value
              );
            }}
          >
            {showCreate
              ? t(
                  "teacherCourses.actions.close"
                )
              : t(
                  "teacherCourses.actions.create"
                )}
          </button>
        </header>


        <section
          className="teacher-summary-grid"
          aria-label={t(
            "teacherCourses.summary.aria"
          )}
        >
          <article>
            <span>
              {activeView
                ? t(
                    "teacherCourses.summary.activeCourses"
                  )
                : t(
                    "teacherCourses.summary.historicalCourses"
                  )}
            </span>
            <strong>
              {stats.courses}
            </strong>
          </article>

          <article>
            <span>
              {t(
                "teacherCourses.summary.activeStudents"
              )}
            </span>
            <strong>
              {stats.students}
            </strong>
          </article>

          <article>
            <span>
              {t(
                "teacherCourses.metrics.submissions"
              )}
            </span>
            <strong>
              {stats.submissions}
            </strong>
          </article>

          <article>
            <span>
              {t(
                "teacherCourses.metrics.executions"
              )}
            </span>
            <strong>
              {stats.executions}
            </strong>
          </article>
        </section>


        {showCreate && (
          <section className="teacher-panel">
            <div className="teacher-panel-heading">
              <div>
                <h2>
                  {t(
                    "teacherCourses.create.title"
                  )}
                </h2>

                <p>
                  {t(
                    "teacherCourses.create.description"
                  )}
                </p>
              </div>
            </div>

            <form
              className="teacher-form-grid"
              onSubmit={createCourse}
            >
              <div>
                <label
                  htmlFor="teacher-course-code"
                >
                  {t(
                    "teacherCourses.create.code"
                  )}
                </label>

                <input
                  id="teacher-course-code"
                  className="form-control"
                  value={form.code}
                  onChange={(event) =>
                    changeForm(
                      "code",
                      event.target.value
                    )
                  }
                  placeholder={t(
                    "teacherCourses.create.codePlaceholder"
                  )}
                  maxLength={50}
                  required
                />
              </div>

              <div className="teacher-form-span-2">
                <label
                  htmlFor="teacher-course-name"
                >
                  {t(
                    "teacherCourses.create.name"
                  )}
                </label>

                <input
                  id="teacher-course-name"
                  className="form-control"
                  value={form.name}
                  onChange={(event) =>
                    changeForm(
                      "name",
                      event.target.value
                    )
                  }
                  placeholder={t(
                    "teacherCourses.create.namePlaceholder"
                  )}
                  maxLength={150}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="teacher-course-year"
                >
                  {t(
                    "teacherCourses.create.year"
                  )}
                </label>

                <input
                  id="teacher-course-year"
                  className="form-control"
                  type="number"
                  min="2000"
                  max="9999"
                  value={
                    form.academicYear
                  }
                  onChange={(event) =>
                    changeForm(
                      "academicYear",
                      event.target.value
                    )
                  }
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="teacher-course-term"
                >
                  {t(
                    "teacherCourses.create.semester"
                  )}
                </label>

                <select
                  id="teacher-course-term"
                  className="form-select"
                  value={
                    form.academicTerm
                  }
                  onChange={(event) =>
                    changeForm(
                      "academicTerm",
                      event.target.value
                    )
                  }
                >
                  <option value="1">
                    1
                  </option>
                  <option value="2">
                    2
                  </option>
                </select>
              </div>

              <div className="teacher-form-actions">
                {createError && (
                  <span
                    className="teacher-inline-error"
                    role="alert"
                  >
                    {createErrorMessage}
                  </span>
                )}

                <button
                  type="submit"
                  className="btn teacher-primary-button"
                  disabled={creating}
                >
                  {creating
                    ? t(
                        "teacherCourses.actions.creating"
                      )
                    : t(
                        "teacherCourses.actions.create"
                      )}
                </button>
              </div>
            </form>
          </section>
        )}


        <section
          className="teacher-toolbar"
          aria-label={t(
            "teacherCourses.toolbar.aria"
          )}
        >
          <div className="teacher-segmented">
            <button
              type="button"
              className={
                activeView
                  ? "is-active"
                  : ""
              }
              onClick={() =>
                setActiveView(true)
              }
              aria-pressed={
                activeView
              }
            >
              {t(
                "teacherCourses.toolbar.active"
              )}
            </button>

            <button
              type="button"
              className={
                !activeView
                  ? "is-active"
                  : ""
              }
              onClick={() =>
                setActiveView(false)
              }
              aria-pressed={
                !activeView
              }
            >
              {t(
                "teacherCourses.toolbar.historical"
              )}
            </button>
          </div>

          <div className="teacher-search">
            <label
              htmlFor="teacher-course-search"
            >
              {t(
                "teacherCourses.toolbar.searchLabel"
              )}
            </label>

            <input
              id="teacher-course-search"
              className="form-control"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder={t(
                "teacherCourses.toolbar.searchPlaceholder"
              )}
            />
          </div>
        </section>


        {loading &&
          items.length === 0 && (
          <InlineState
            type="loading"
            title={t(
              "teacherCourses.loading"
            )}
            compact
          />
        )}


        {error && (
          <InlineState
            type="error"
            title={t(
              "teacherCourses.errors.loadTitle"
            )}
            description={
              loadErrorMessage
            }
            actionLabel={t(
              "teacherCourses.actions.retry"
            )}
            onAction={() =>
              setReloadToken(
                (value) =>
                  value + 1
              )
            }
            compact
          />
        )}


        {!loading &&
          !error &&
          items.length === 0 && (
            <EmptyCourseState
              activeView={activeView}
              onCreate={() =>
                setShowCreate(true)
              }
            />
          )}


        {!error &&
          items.length > 0 && (
            <section
              className="teacher-course-list"
              aria-label={t(
                "teacherCourses.list.aria"
              )}
            >
              {items.map(
                (course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    onOpen={(id) =>
                      navigate(
                        `/teacher/courses/${id}`
                      )
                    }
                  />
                )
              )}
            </section>
          )}
      </div>
    </main>
  );
}
