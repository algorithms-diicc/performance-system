import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useParams,
} from "react-router-dom";

import InlineState
  from "../components/InlineState";

import {
  useI18n,
} from "../i18n";

import TeacherCourseAnalytics
  from "./TeacherCourseAnalytics";

import TeacherCourseAttention
  from "./TeacherCourseAttention";

import {
  coursePeriod,
  formatDateTime,
  teacherApi,
  teacherRequestErrorMessage,
} from "./teacherApi";

import "./TeacherDashboard.css";


const PAGE_SIZE = 50;


function attentionLabel(
  student,
  t
) {
  if (
    student.attention
      ?.failedMoreThanCompleted
  ) {
    return t(
      "teacherCourseDetail.attention.failures"
    );
  }

  if (
    student.attention
      ?.noExecutions
  ) {
    return t(
      "teacherCourseDetail.attention.noExecutions"
    );
  }

  return t(
    "teacherCourseDetail.attention.none"
  );
}


function enrollmentRejectionLabel(
  reason,
  t
) {
  if (
    reason === "NOT_ELIGIBLE"
  ) {
    return t(
      "teacherCourseDetail.enrollment.notEligible"
    );
  }

  return t(
    "teacherCourseDetail.enrollment.rejectedGeneric"
  );
}


function countKey(
  count,
  base
) {
  return `${base}.${
    count === 1
      ? "one"
      : "other"
  }`;
}


function courseDetailErrorMessage(
  error,
  language,
  t,
  fallbackKey
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

  if (
    language === "es" &&
    businessStatus &&
    typeof error?.message === "string" &&
    error.message.trim()
  ) {
    return error.message.trim();
  }

  const code =
    String(
      error?.code || ""
    )
      .trim()
      .toUpperCase();

  const field =
    String(
      error?.payload?.error?.field
      || error?.payload?.field
      || ""
    ).trim();

  if (
    code === "VALIDATION_ERROR"
  ) {
    const fieldKeys = {
      code:
        "teacherCourseDetail.errors.validationCode",
      name:
        "teacherCourseDetail.errors.validationName",
      academicYear:
        "teacherCourseDetail.errors.validationYear",
      academicTerm:
        "teacherCourseDetail.errors.validationTerm",
      emails:
        "teacherCourseDetail.errors.validationEmails",
    };

    if (fieldKeys[field]) {
      return t(
        fieldKeys[field]
      );
    }
  }

  return teacherRequestErrorMessage(
    error,
    t,
    {
      fallbackKey,
    }
  );
}


export default function TeacherCourseDetail() {
  const {
    courseId,
  } = useParams();

  const {
    language,
    locale,
    t,
  } = useI18n();

  const [
    course,
    setCourse,
  ] = useState(null);

  const [
    students,
    setStudents,
  ] = useState([]);

  const [
    totalStudents,
    setTotalStudents,
  ] = useState(0);

  const [
    attentionStudents,
    setAttentionStudents,
  ] = useState([]);

  const [
    loadingAttention,
    setLoadingAttention,
  ] = useState(true);

  const [
    attentionError,
    setAttentionError,
  ] = useState(null);

  const [
    attentionRequestToken,
    setAttentionRequestToken,
  ] = useState(0);

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    membership,
    setMembership,
  ] = useState("active");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    attention,
    setAttention,
  ] = useState("all");

  const [
    loadingCourse,
    setLoadingCourse,
  ] = useState(true);

  const [
    loadingStudents,
    setLoadingStudents,
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
    showAddStudents,
    setShowAddStudents,
  ] = useState(false);

  const [
    emails,
    setEmails,
  ] = useState("");

  const [
    adding,
    setAdding,
  ] = useState(false);

  const [
    addFeedback,
    setAddFeedback,
  ] = useState(null);

  const [
    exportingCsv,
    setExportingCsv,
  ] = useState(false);

  const [
    exportFeedback,
    setExportFeedback,
  ] = useState({
    kind: "",
    error: null,
  });

  const [
    editing,
    setEditing,
  ] = useState(false);

  const [
    savingCourse,
    setSavingCourse,
  ] = useState(false);

  const [
    editForm,
    setEditForm,
  ] = useState({
    code: "",
    name: "",
    academicYear: "",
    academicTerm: 1,
  });


  useEffect(() => {
    setPage(1);
  }, [
    membership,
    search,
    attention,
  ]);


  useEffect(() => {
    const controller =
      new AbortController();

    (async () => {
      try {
        setLoadingCourse(true);
        setError(null);

        const data =
          await teacherApi(
            `/api/teacher/courses/${courseId}`,
            {
              signal:
                controller.signal,
            }
          );

        setCourse(
          data.course || null
        );

        if (data.course) {
          setEditForm({
            code:
              data.course.code || "",
            name:
              data.course.name || "",
            academicYear:
              data.course
                .academicYear || "",
            academicTerm:
              data.course
                .academicTerm || 1,
          });
        }
      } catch (err) {
        if (
          err.name === "AbortError"
        ) {
          return;
        }

        setError(err);
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoadingCourse(false);
        }
      }
    })();

    return () =>
      controller.abort();
  }, [
    courseId,
    reloadToken,
  ]);


  useEffect(() => {
    const controller =
      new AbortController();

    (async () => {
      try {
        setLoadingAttention(true);
        setAttentionError(null);

        const items = [];
        let pageNumber = 1;
        let total = 0;

        do {
          const params =
            new URLSearchParams({
              membership: "active",
              page:
                String(pageNumber),
              page_size: "200",
            });

          const data =
            await teacherApi(
              `/api/teacher/courses/${courseId}/students?${params.toString()}`,
              {
                signal:
                  controller.signal,
              }
            );

          const pageItems =
            Array.isArray(data.items)
              ? data.items
              : [];

          items.push(
            ...pageItems
          );

          total =
            Number(data.total || 0);

          if (
            pageItems.length === 0
          ) {
            break;
          }

          pageNumber += 1;
        } while (
          !controller.signal.aborted
          && items.length < total
        );

        setAttentionStudents(
          items
        );
      } catch (err) {
        if (
          err.name === "AbortError"
        ) {
          return;
        }

        setAttentionError(
          err
        );
      } finally {
        if (
          !controller.signal
            .aborted
        ) {
          setLoadingAttention(false);
        }
      }
    })();

    return () =>
      controller.abort();
  }, [
    courseId,
    reloadToken,
    attentionRequestToken,
  ]);


  useEffect(() => {
    const controller =
      new AbortController();

    const timer =
      window.setTimeout(
        async () => {
          try {
            setLoadingStudents(true);

            const params =
              new URLSearchParams({
                membership,
                page:
                  String(page),
                page_size:
                  String(PAGE_SIZE),
              });

            if (search.trim()) {
              params.set(
                "search",
                search.trim()
              );
            }

            const data =
              await teacherApi(
                `/api/teacher/courses/${courseId}/students?${params.toString()}`,
                {
                  signal:
                    controller.signal,
                }
              );

            setStudents(
              Array.isArray(data.items)
                ? data.items
                : []
            );

            setTotalStudents(
              data.total || 0
            );
          } catch (err) {
            if (
              err.name === "AbortError"
            ) {
              return;
            }

            setStudents([]);
            setTotalStudents(0);
          } finally {
            if (
              !controller.signal
                .aborted
            ) {
              setLoadingStudents(false);
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
    courseId,
    membership,
    page,
    search,
    reloadToken,
  ]);


  const usingAttentionSnapshot =
    attention !== "all" &&
    membership === "active";


  const filteredStudents =
    useMemo(
      () => {
        let source =
          usingAttentionSnapshot
            ? attentionStudents
            : students;

        if (
          usingAttentionSnapshot &&
          search.trim()
        ) {
          const normalizedSearch =
            search
              .trim()
              .toLowerCase();

          source =
            source.filter(
              (student) => {
                const fullName =
                  String(
                    student.fullName || ""
                  ).toLowerCase();
                const email =
                  String(
                    student.email || ""
                  ).toLowerCase();

                return (
                  fullName.includes(
                    normalizedSearch
                  ) ||
                  email.includes(
                    normalizedSearch
                  )
                );
              }
            );
        }

        if (
          attention === "all"
        ) {
          return source;
        }

        if (
          attention === "no-executions"
        ) {
          return source.filter(
            (student) =>
              student.attention
                ?.noExecutions
          );
        }

        return source.filter(
          (student) =>
            student.attention
              ?.failedMoreThanCompleted
        );
      },
      [
        students,
        attentionStudents,
        attention,
        search,
        usingAttentionSnapshot,
      ]
    );


  const visibleStudentTotal =
    usingAttentionSnapshot
      ? filteredStudents.length
      : totalStudents;

  const effectiveLoadingStudents =
    usingAttentionSnapshot
      ? loadingAttention
      : loadingStudents;

  const totalPages =
    usingAttentionSnapshot
      ? 1
      : Math.max(
        1,
        Math.ceil(
          totalStudents /
          PAGE_SIZE
        )
      );


  const showAttentionStudents =
    (filter) => {
      setMembership("active");
      setAttention(filter);
      setSearch("");
      setPage(1);

      window.setTimeout(
        () => {
          document
            .getElementById(
              "teacher-students-panel"
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
        },
        0
      );
    };


  const patchCourse =
    async (payload) => {
      const data =
        await teacherApi(
          `/api/teacher/courses/${courseId}`,
          {
            method: "PATCH",
            body:
              JSON.stringify(
                payload
              ),
          }
        );

      setCourse(
        data.course || null
      );

      setReloadToken(
        (value) =>
          value + 1
      );

      return data.course;
    };


  const toggleCourseActive =
    async () => {
      if (!course) {
        return;
      }

      const target =
        !course.isActive;

      const confirmKey =
        target
          ? "teacherCourseDetail.confirm.reactivateCourse"
          : "teacherCourseDetail.confirm.finishCourse";

      if (
        !window.confirm(
          t(
            confirmKey,
            {
              code:
                course.code,
              period:
                coursePeriod(
                  course
                ),
            }
          )
        )
      ) {
        return;
      }

      try {
        setSavingCourse(true);

        await patchCourse({
          isActive: target,
        });
      } catch (err) {
        window.alert(
          courseDetailErrorMessage(
            err,
            language,
            t,
            "teacherCourseDetail.errors.updateCourse"
          )
        );
      } finally {
        setSavingCourse(false);
      }
    };


  const exportStudentsCsv =
    async () => {
      if (exportingCsv) {
        return;
      }

      try {
        setExportingCsv(true);
        setExportFeedback({
          kind: "",
          error: null,
        });

        const response =
          await fetch(
            `/api/teacher/courses/${courseId}/students/export.csv`,
            {
              credentials:
                "include",
            }
          );

        if (!response.ok) {
          let payload = null;

          try {
            payload =
              await response.json();
          } catch (_) {
            // La respuesta de error puede no ser JSON.
          }

          const exportError =
            new Error(
              payload?.error?.message
              || payload?.message
              || ""
            );

          exportError.status =
            response.status;
          exportError.code =
            payload?.error?.code
            || payload?.code
            || "";
          exportError.payload =
            payload;

          throw exportError;
        }

        const blob =
          await response.blob();
        const disposition =
          response.headers.get(
            "Content-Disposition"
          ) || "";
        const filenameMatch =
          disposition.match(
            /filename="?([^";]+)"?/i
          );
        const filename =
          filenameMatch?.[1] ||
          `${course.code || "curso"}-resumen.csv`;
        const objectUrl =
          window.URL.createObjectURL(
            blob
          );
        const anchor =
          document.createElement(
            "a"
          );

        anchor.href = objectUrl;
        anchor.download = filename;
        document.body.appendChild(
          anchor
        );
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(
          objectUrl
        );

        setExportFeedback({
          kind: "success",
          error: null,
        });
      } catch (err) {
        setExportFeedback({
          kind: "error",
          error: err,
        });
      } finally {
        setExportingCsv(false);
      }
    };


  const saveCourse =
    async (event) => {
      event.preventDefault();

      try {
        setSavingCourse(true);

        await patchCourse({
          code:
            editForm.code.trim(),
          name:
            editForm.name.trim(),
          academicYear:
            Number(
              editForm.academicYear
            ),
          academicTerm:
            Number(
              editForm.academicTerm
            ),
        });

        setEditing(false);
      } catch (err) {
        window.alert(
          courseDetailErrorMessage(
            err,
            language,
            t,
            "teacherCourseDetail.errors.saveCourse"
          )
        );
      } finally {
        setSavingCourse(false);
      }
    };


  const addStudents =
    async (event) => {
      event.preventDefault();

      try {
        setAdding(true);
        setAddFeedback(null);

        const data =
          await teacherApi(
            `/api/teacher/courses/${courseId}/students`,
            {
              method: "POST",
              body:
                JSON.stringify({
                  emails,
                }),
            }
          );

        setAddFeedback(data);
        setEmails("");

        setReloadToken(
          (value) =>
            value + 1
        );
      } catch (err) {
        setAddFeedback({
          error: err,
        });
      } finally {
        setAdding(false);
      }
    };


  const removeStudent =
    async (student) => {
      if (
        !window.confirm(
          t(
            "teacherCourseDetail.confirm.removeStudent",
            {
              name:
                student.fullName,
            }
          )
        )
      ) {
        return;
      }

      try {
        await teacherApi(
          `/api/teacher/courses/${courseId}/students/${student.userId}`,
          {
            method: "DELETE",
          }
        );

        setReloadToken(
          (value) =>
            value + 1
        );
      } catch (err) {
        window.alert(
          courseDetailErrorMessage(
            err,
            language,
            t,
            "teacherCourseDetail.errors.removeStudent"
          )
        );
      }
    };


  const restoreStudent =
    async (student) => {
      try {
        await teacherApi(
          `/api/teacher/courses/${courseId}/students/${student.userId}/restore`,
          {
            method: "POST",
          }
        );

        setReloadToken(
          (value) =>
            value + 1
        );
      } catch (err) {
        window.alert(
          courseDetailErrorMessage(
            err,
            language,
            t,
            "teacherCourseDetail.errors.restoreStudent"
          )
        );
      }
    };


  const loadErrorMessage =
    error
      ? teacherRequestErrorMessage(
          error,
          t,
          {
            fallbackKey:
              "teacherCourseDetail.errors.load",
          }
        )
      : "";

  const exportFeedbackMessage =
    exportFeedback.kind === "success"
      ? t(
          "teacherCourseDetail.export.success"
        )
      : exportFeedback.kind === "error"
        ? teacherRequestErrorMessage(
            exportFeedback.error,
            t,
            {
              fallbackKey:
                "teacherCourseDetail.errors.export",
            }
          )
        : "";

  const addErrorMessage =
    addFeedback?.error
      ? courseDetailErrorMessage(
          addFeedback.error,
          language,
          t,
          "teacherCourseDetail.errors.addStudents"
        )
      : "";


  if (
    loadingCourse &&
    !course
  ) {
    return (
      <main className="teacher-page">

        <div className="teacher-page-inner">
          <InlineState
            type="loading"
            title={t("teacherCourseDetail.loading")}
            compact
          />
        </div>

      </main>
    );
  }


  if (
    error &&
    !course
  ) {
    return (
      <main className="teacher-page">

        <div className="teacher-page-inner">

          <InlineState
            type="error"
            title={t("teacherCourseDetail.errors.loadTitle")}
            description={loadErrorMessage}
            actionLabel={t("teacherCommon.actions.retry")}
            onAction={() =>
              setReloadToken(
                (value) =>
                  value + 1
              )
            }
            compact
          />

        </div>

      </main>
    );
  }


  if (!course) {
    return null;
  }


  return (
    <main className="teacher-page">

      <div className="teacher-page-inner">

        <div className="teacher-back-row">

          <Link
            to="/teacher/courses"
            className="teacher-back-link"
          >
            {t("teacherCourseDetail.actions.back")}
          </Link>

        </div>


        <header className="teacher-course-header">

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
                  ? t("teacherCourseDetail.status.courseActive")
                  : t("teacherCourseDetail.status.courseFinished")}
              </span>

            </div>

            <h1>
              {course.name}
            </h1>

            <p>
              {coursePeriod(course)}
              {" · "}
              {course.teacher?.fullName}
              {" · "}
              {course.teacher?.email}
            </p>

          </div>


          <div className="teacher-header-actions">

            <button
              type="button"
              className="btn teacher-secondary-button"
              disabled={
                exportingCsv
              }
              onClick={
                exportStudentsCsv
              }
              title={t("teacherCourseDetail.export.title")}
            >
              {exportingCsv
                ? t("teacherCourseDetail.actions.exporting")
                : t("teacherCourseDetail.actions.export")}
            </button>

            <button
              type="button"
              className="btn teacher-secondary-button"
              onClick={() =>
                setEditing(
                  (value) =>
                    !value
                )
              }
            >
              {editing
                ? t("teacherCourseDetail.actions.closeEdit")
                : t("teacherCourseDetail.actions.edit")}
            </button>

            <button
              type="button"
              className={
                course.isActive
                  ? "btn teacher-danger-button"
                  : "btn teacher-primary-button"
              }
              disabled={
                savingCourse
              }
              onClick={
                toggleCourseActive
              }
            >
              {course.isActive
                ? t("teacherCourseDetail.actions.finishCourse")
                : t("teacherCourseDetail.actions.reactivateCourse")}
            </button>

          </div>

        </header>


        {exportFeedbackMessage && (
          <div
            className={
              `teacher-export-feedback teacher-export-feedback--${exportFeedback.kind}`
            }
            role={
              exportFeedback.kind === "error"
                ? "alert"
                : "status"
            }
          >
            {exportFeedbackMessage}
          </div>
        )}


        <TeacherCourseAnalytics
          courseId={courseId}
          reloadToken={reloadToken}
        />


        <TeacherCourseAttention
          courseId={courseId}
          students={
            attentionStudents
          }
          loading={
            loadingAttention
          }
          error={attentionError}
          onRetry={() =>
            setAttentionRequestToken(
              (value) => value + 1
            )
          }
          onSelectFilter={
            showAttentionStudents
          }
        />


        {editing && (

          <section className="teacher-panel">

            <div className="teacher-panel-heading">

              <div>
                <h2>
                  {t("teacherCourseDetail.edit.title")}
                </h2>

                <p>
                  {t("teacherCourseDetail.edit.description")}
                </p>
              </div>

            </div>


            <form
              className="teacher-form-grid"
              onSubmit={saveCourse}
            >

              <div>
                <label>
                  {t("teacherCourseDetail.edit.code")}
                </label>
                <input
                  className="form-control"
                  value={
                    editForm.code
                  }
                  onChange={(event) =>
                    setEditForm(
                      (previous) => ({
                        ...previous,
                        code:
                          event.target.value,
                      })
                    )
                  }
                  required
                />
              </div>


              <div className="teacher-form-span-2">
                <label>
                  {t("teacherCourseDetail.edit.name")}
                </label>
                <input
                  className="form-control"
                  value={
                    editForm.name
                  }
                  onChange={(event) =>
                    setEditForm(
                      (previous) => ({
                        ...previous,
                        name:
                          event.target.value,
                      })
                    )
                  }
                  required
                />
              </div>


              <div>
                <label>
                  {t("teacherCourseDetail.edit.year")}
                </label>
                <input
                  className="form-control"
                  type="number"
                  min="2000"
                  max="9999"
                  value={
                    editForm.academicYear
                  }
                  onChange={(event) =>
                    setEditForm(
                      (previous) => ({
                        ...previous,
                        academicYear:
                          event.target.value,
                      })
                    )
                  }
                  required
                />
              </div>


              <div>
                <label>
                  {t("teacherCourseDetail.edit.semester")}
                </label>
                <select
                  className="form-select"
                  value={
                    editForm.academicTerm
                  }
                  onChange={(event) =>
                    setEditForm(
                      (previous) => ({
                        ...previous,
                        academicTerm:
                          event.target.value,
                      })
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

                <button
                  type="submit"
                  className="btn teacher-primary-button"
                  disabled={
                    savingCourse
                  }
                >
                  {savingCourse
                    ? t("teacherCourseDetail.actions.saving")
                    : t("teacherCourseDetail.actions.save")}
                </button>

              </div>

            </form>

          </section>

        )}


        <section
          id="teacher-students-panel"
          className="teacher-panel"
        >

          <div className="teacher-panel-heading">

            <div>
              <h2>
                {t("teacherCourseDetail.students.title")}
              </h2>

              <p>
                {t("teacherCourseDetail.students.description")}
              </p>
            </div>

            <button
              type="button"
              className="btn teacher-primary-button"
              disabled={
                !course.isActive
              }
              title={
                course.isActive
                  ? ""
                  : t("teacherCourseDetail.students.addDisabledTitle")
              }
              onClick={() => {
                setShowAddStudents(
                  (value) =>
                    !value
                );

                setAddFeedback(null);
              }}
            >
              {showAddStudents
                ? t("teacherCourseDetail.actions.close")
                : t("teacherCourseDetail.actions.addStudents")}
            </button>

          </div>


          {showAddStudents && (

            <form
              className="teacher-add-students"
              onSubmit={addStudents}
            >

              <label
                htmlFor="teacher-student-emails"
              >
                {t("teacherCourseDetail.students.emailLabel")}
              </label>

              <textarea
                id="teacher-student-emails"
                className="form-control"
                rows="5"
                value={emails}
                onChange={(event) =>
                  setEmails(
                    event.target.value
                  )
                }
                placeholder={t(
                  "teacherCourseDetail.students.emailPlaceholder"
                )}
                required
              />

              <div className="teacher-add-help">
                {t("teacherCourseDetail.students.help")}
              </div>


              {addFeedback?.error && (
                <div
                  className="teacher-inline-error"
                  role="alert"
                >
                  {addErrorMessage}
                </div>
              )}


              {addFeedback?.summary && (

                <div className="teacher-import-result">

                  <strong>
                    {t("teacherCourseDetail.enrollment.resultTitle")}
                  </strong>

                  <span>
                    {t(
                      countKey(
                        addFeedback.summary.added || 0,
                        "teacherCourseDetail.enrollment.added"
                      ),
                      {
                        count:
                          addFeedback.summary.added || 0,
                      }
                    )}
                    {" · "}
                    {t(
                      countKey(
                        addFeedback.summary.reactivated || 0,
                        "teacherCourseDetail.enrollment.reactivated"
                      ),
                      {
                        count:
                          addFeedback.summary.reactivated || 0,
                      }
                    )}
                    {" · "}
                    {t(
                      countKey(
                        addFeedback.summary.alreadyActive || 0,
                        "teacherCourseDetail.enrollment.alreadyActive"
                      ),
                      {
                        count:
                          addFeedback.summary.alreadyActive || 0,
                      }
                    )}
                    {" · "}
                    {t(
                      countKey(
                        addFeedback.summary.rejected || 0,
                        "teacherCourseDetail.enrollment.rejected"
                      ),
                      {
                        count:
                          addFeedback.summary.rejected || 0,
                      }
                    )}
                  </span>

                  {Array.isArray(
                    addFeedback.rejected
                  ) &&
                    addFeedback.rejected.length > 0 && (

                      <ul>
                        {addFeedback.rejected.map(
                          (item) => (
                            <li
                              key={item.email}
                            >
                              {item.email}
                              {" — "}
                              {enrollmentRejectionLabel(
                                item.reason,
                                t
                              )}
                            </li>
                          )
                        )}
                      </ul>

                    )}

                </div>

              )}


              <div className="teacher-form-actions">

                <button
                  type="submit"
                  className="btn teacher-primary-button"
                  disabled={
                    adding ||
                    !emails.trim()
                  }
                >
                  {adding
                    ? t("teacherCourseDetail.actions.adding")
                    : t("teacherCourseDetail.actions.addToCourse")}
                </button>

              </div>

            </form>

          )}


          <div className="teacher-student-toolbar">

            <div className="teacher-segmented">

              <button
                type="button"
                className={
                  membership === "active"
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setMembership(
                    "active"
                  )
                }
                aria-pressed={
                  membership === "active"
                }
              >
                {t("teacherCourseDetail.students.membership.active")}
              </button>

              <button
                type="button"
                className={
                  membership === "inactive"
                    ? "is-active"
                    : ""
                }
                onClick={() => {
                  setMembership(
                    "inactive"
                  );
                  setAttention(
                    "all"
                  );
                }}
                aria-pressed={
                  membership === "inactive"
                }
              >
                {t("teacherCourseDetail.students.membership.inactive")}
              </button>

              <button
                type="button"
                className={
                  membership === "all"
                    ? "is-active"
                    : ""
                }
                onClick={() => {
                  setMembership(
                    "all"
                  );
                  setAttention(
                    "all"
                  );
                }}
                aria-pressed={
                  membership === "all"
                }
              >
                {t("teacherCourseDetail.students.membership.all")}
              </button>

            </div>


            <div className="teacher-student-filters">

              <input
                className="form-control"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder={t(
                  "teacherCourseDetail.students.searchPlaceholder"
                )}
                aria-label={t(
                  "teacherCourseDetail.students.searchLabel"
                )}
              />

              <select
                className="form-select"
                value={attention}
                aria-label={t(
                  "teacherCourseDetail.students.attentionFilterLabel"
                )}
                onChange={(event) => {
                  const nextAttention =
                    event.target.value;

                  setAttention(
                    nextAttention
                  );

                  if (
                    nextAttention !== "all"
                  ) {
                    setMembership(
                      "active"
                    );
                    setPage(1);
                  }
                }}
              >
                <option value="all">
                  {t("teacherCourseDetail.students.attentionFilter.all")}
                </option>
                <option value="no-executions">
                  {t("teacherCourseDetail.students.attentionFilter.noExecutions")}
                </option>
                <option value="failures">
                  {t("teacherCourseDetail.students.attentionFilter.failures")}
                </option>
              </select>

            </div>

          </div>


          {effectiveLoadingStudents &&
            filteredStudents.length === 0 && (
              <InlineState
                type="loading"
                title={t(
                  "teacherCourseDetail.students.loading"
                )}
                compact
              />
            )}


          {!effectiveLoadingStudents &&
            filteredStudents.length === 0 && (

              <div className="teacher-empty teacher-empty--compact">

                <h3>
                  {t("teacherCourseDetail.students.emptyTitle")}
                </h3>

                <p>
                  {t("teacherCourseDetail.students.emptyDescription")}
                </p>

              </div>

            )}


          {filteredStudents.length > 0 && (

            <div className="table-responsive">

              <table className="table teacher-student-table align-middle mb-0">

                <thead>
                  <tr>
                    <th>
                      {t("teacherCourseDetail.students.table.student")}
                    </th>
                    <th>
                      {t("teacherCourseDetail.students.table.status")}
                    </th>
                    <th>
                      {t("teacherCourseDetail.students.table.submissions")}
                    </th>
                    <th>
                      {t("teacherCourseDetail.students.table.executions")}
                    </th>
                    <th>
                      {t("teacherCourseDetail.students.table.completed")}
                    </th>
                    <th>
                      {t("teacherCourseDetail.students.table.failed")}
                    </th>
                    <th>
                      {t("teacherCourseDetail.students.table.lastActivity")}
                    </th>
                    <th>
                      {t("teacherCourseDetail.students.table.attention")}
                    </th>
                    <th className="text-end">
                      {t("teacherCourseDetail.students.table.action")}
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {filteredStudents.map(
                    (student) => (

                      <tr
                        key={
                          student.membershipId
                        }
                      >

                        <td>
                          <Link
                            className="teacher-student-profile-link"
                            to={`/teacher/courses/${courseId}/students/${student.userId}`}
                          >
                            <strong>
                              {student.fullName}
                            </strong>
                          </Link>
                          <small>
                            {student.email}
                          </small>
                        </td>

                        <td>
                          <span
                            className={
                              student.membershipActive
                                ? "teacher-status teacher-status--active"
                                : "teacher-status teacher-status--historic"
                            }
                          >
                            {student.membershipActive
                              ? t("teacherCourseDetail.status.membershipActive")
                              : t("teacherCourseDetail.status.membershipRemoved")}
                          </span>
                        </td>

                        <td>
                          {student.submissions || 0}
                        </td>

                        <td>
                          {student.executions || 0}
                        </td>

                        <td>
                          {student.completed || 0}
                        </td>

                        <td>
                          {student.failed || 0}
                        </td>

                        <td>
                          {formatDateTime(
                            student.lastActivityAt,
                            locale,
                            t("teacherCourseDetail.common.unavailable")
                          )}
                        </td>

                        <td>
                          <span
                            className={
                              student.attention?.failedMoreThanCompleted
                                ? "teacher-attention teacher-attention--warning"
                                : student.attention?.noExecutions
                                  ? "teacher-attention"
                                  : "teacher-attention teacher-attention--quiet"
                            }
                          >
                            {attentionLabel(
                              student,
                              t
                            )}
                          </span>
                        </td>

                        <td className="text-end">

                          <div className="teacher-row-actions">

                            <Link
                              className="btn btn-sm teacher-row-button teacher-row-button--profile"
                              to={`/teacher/courses/${courseId}/students/${student.userId}`}
                            >
                              {t("teacherCourseDetail.actions.viewProfile")}
                            </Link>

                            {student.lastResultCodename
                              ? (
                                <Link
                                  className="btn btn-sm teacher-row-button teacher-row-button--result"
                                  to={`/code/${student.lastResultCodename}`}
                                  state={{
                                    name:
                                      student.fullName,
                                  }}
                                >
                                  {t("teacherCourseDetail.actions.lastResult")}
                                </Link>
                              )
                              : (
                                <button
                                  type="button"
                                  className="btn btn-sm teacher-row-button teacher-row-button--result"
                                  disabled
                                  title={t(
                                    "teacherCourseDetail.students.noResultTitle"
                                  )}
                                >
                                  {t("teacherCourseDetail.actions.lastResult")}
                                </button>
                              )}

                            {student.membershipActive
                              ? (
                                <button
                                  type="button"
                                  className="btn btn-sm teacher-row-button"
                                  onClick={() =>
                                    removeStudent(
                                      student
                                    )
                                  }
                                >
                                  {t("teacherCourseDetail.actions.remove")}
                                </button>
                              )
                              : (
                                <button
                                  type="button"
                                  className="btn btn-sm teacher-row-button teacher-row-button--restore"
                                  disabled={
                                    !course.isActive
                                  }
                                  onClick={() =>
                                    restoreStudent(
                                      student
                                    )
                                  }
                                >
                                  {t("teacherCourseDetail.actions.restore")}
                                </button>
                              )}

                          </div>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}


          <footer className="teacher-pagination">

            <span>
              {t(
                countKey(
                  visibleStudentTotal,
                  "teacherCourseDetail.students.count"
                ),
                {
                  count:
                    visibleStudentTotal,
                }
              )}
            </span>

            <div>

              <button
                type="button"
                className="btn btn-sm teacher-row-button"
                disabled={
                  usingAttentionSnapshot ||
                  page <= 1 ||
                  effectiveLoadingStudents
                }
                onClick={() =>
                  setPage(
                    (value) =>
                      Math.max(
                        1,
                        value - 1
                      )
                  )
                }
              >
                {t("teacherCourseDetail.actions.previous")}
              </button>

              <span>
                {t(
                  "teacherCourseDetail.students.page",
                  {
                    page:
                      usingAttentionSnapshot
                        ? 1
                        : page,
                    total:
                      totalPages,
                  }
                )}
              </span>

              <button
                type="button"
                className="btn btn-sm teacher-row-button"
                disabled={
                  usingAttentionSnapshot ||
                  page >= totalPages ||
                  effectiveLoadingStudents
                }
                onClick={() =>
                  setPage(
                    (value) =>
                      Math.min(
                        totalPages,
                        value + 1
                      )
                  )
                }
              >
                {t("teacherCourseDetail.actions.next")}
              </button>

            </div>

          </footer>

        </section>

      </div>

    </main>
  );
}
