import React, {
  useMemo,
} from "react";
import {
  Link,
} from "react-router-dom";

import InlineState
  from "../components/InlineState";

import {
  useI18n,
} from "../i18n";

import {
  formatDateTime,
  teacherRequestErrorMessage,
} from "./teacherApi";


const RECENT_STUDENTS_LIMIT = 4;


function activityTimestamp(value) {
  const parsed =
    Date.parse(value || "");

  return Number.isFinite(parsed)
    ? parsed
    : Number.NEGATIVE_INFINITY;
}


export function buildAcademicAttention(
  students
) {
  const items =
    Array.isArray(students)
      ? students
      : [];

  const noExecutions =
    items.filter(
      (student) =>
        student.attention
          ?.noExecutions
    );

  const failures =
    items.filter(
      (student) =>
        student.attention
          ?.failedMoreThanCompleted
    );

  const recent =
    items
      .filter(
        (student) =>
          activityTimestamp(
            student.lastActivityAt
          ) >
          Number.NEGATIVE_INFINITY
      )
      .slice()
      .sort(
        (left, right) =>
          activityTimestamp(
            right.lastActivityAt
          ) -
          activityTimestamp(
            left.lastActivityAt
          )
      )
      .slice(
        0,
        RECENT_STUDENTS_LIMIT
      );

  return {
    noExecutions,
    failures,
    recent,
  };
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


export default function TeacherCourseAttention({
  courseId,
  students,
  loading,
  error,
  onRetry,
  onSelectFilter,
}) {
  const {
    locale,
    t,
  } = useI18n();

  const summary =
    useMemo(
      () =>
        buildAcademicAttention(
          students
        ),
      [students]
    );

  const resolvedError =
    error
      ? (
          typeof error === "string"
            ? error
            : teacherRequestErrorMessage(
                error,
                t,
                {
                  fallbackKey:
                    "teacherCourseAttention.errors.load",
                }
              )
        )
      : "";

  if (
    loading &&
    (!students || students.length === 0)
  ) {
    return (
      <section className="teacher-attention-panel">
        <InlineState
          type="loading"
          title={t(
            "teacherCourseAttention.loading"
          )}
          compact
        />
      </section>
    );
  }

  if (
    error &&
    (!students || students.length === 0)
  ) {
    return (
      <section className="teacher-attention-panel">
        <InlineState
          type="error"
          title={t(
            "teacherCourseAttention.errors.title"
          )}
          description={resolvedError}
          actionLabel={t(
            "teacherCommon.actions.retry"
          )}
          onAction={onRetry}
          compact
        />
      </section>
    );
  }

  return (
    <section
      className="teacher-attention-panel"
      aria-labelledby="teacher-attention-title"
    >
      <div className="teacher-attention-heading">
        <div>
          <p className="teacher-eyebrow">
            {t(
              "teacherCourseAttention.header.eyebrow"
            )}
          </p>
          <h2 id="teacher-attention-title">
            {t(
              "teacherCourseAttention.header.title"
            )}
          </h2>
          <p>
            {t(
              "teacherCourseAttention.header.description"
            )}
          </p>
        </div>

        {loading && (
          <span className="teacher-attention-refreshing">
            {t(
              "teacherCourseAttention.refreshing"
            )}
          </span>
        )}
      </div>

      {error && (
        <div
          className="teacher-attention-inline-error"
          role="status"
        >
          <span>
            {resolvedError}
          </span>
          <button
            type="button"
            onClick={onRetry}
          >
            {t(
              "teacherCommon.actions.retry"
            )}
          </button>
        </div>
      )}

      <div className="teacher-attention-grid">
        <button
          type="button"
          className="teacher-attention-card"
          onClick={() =>
            onSelectFilter(
              "no-executions"
            )
          }
          aria-label={t(
            countKey(
              summary.noExecutions
                .length,
              "teacherCourseAttention.cards.noExecutions.aria"
            ),
            {
              count:
                summary.noExecutions
                  .length,
            }
          )}
        >
          <span>
            {t(
              "teacherCourseAttention.cards.noExecutions.title"
            )}
          </span>
          <strong>
            {summary.noExecutions.length}
          </strong>
          <p>
            {t(
              "teacherCourseAttention.cards.noExecutions.description"
            )}
          </p>
          <small>
            {t(
              "teacherCourseAttention.actions.viewStudents"
            )}
            {" →"}
          </small>
        </button>

        <button
          type="button"
          className="teacher-attention-card teacher-attention-card--warning"
          onClick={() =>
            onSelectFilter(
              "failures"
            )
          }
          aria-label={t(
            countKey(
              summary.failures.length,
              "teacherCourseAttention.cards.failures.aria"
            ),
            {
              count:
                summary.failures.length,
            }
          )}
        >
          <span>
            {t(
              "teacherCourseAttention.cards.failures.title"
            )}
          </span>
          <strong>
            {summary.failures.length}
          </strong>
          <p>
            {t(
              "teacherCourseAttention.cards.failures.description"
            )}
          </p>
          <small>
            {t(
              "teacherCourseAttention.actions.viewStudents"
            )}
            {" →"}
          </small>
        </button>

        <article className="teacher-attention-recent">
          <div>
            <span>
              {t(
                "teacherCourseAttention.recent.title"
              )}
            </span>
            <p>
              {t(
                "teacherCourseAttention.recent.description"
              )}
            </p>
          </div>

          {summary.recent.length === 0 ? (
            <div className="teacher-attention-recent-empty">
              {t(
                "teacherCourseAttention.recent.empty"
              )}
            </div>
          ) : (
            <ul>
              {summary.recent.map(
                (student) => (
                  <li
                    key={
                      student.userId
                    }
                  >
                    <Link
                      className="teacher-attention-student-link"
                      to={`/teacher/courses/${courseId}/students/${student.userId}`}
                    >
                      <strong>
                        {student.fullName}
                      </strong>
                      <small>
                        {formatDateTime(
                          student.lastActivityAt,
                          locale,
                          t(
                            "teacherCourseAttention.common.unavailable"
                          )
                        )}
                      </small>
                    </Link>

                    {student.lastResultCodename && (
                      <Link
                        className="teacher-attention-result-link"
                        to={`/code/${student.lastResultCodename}`}
                        aria-label={t(
                          "teacherCourseAttention.actions.lastResultAria",
                          {
                            name:
                              student.fullName,
                          }
                        )}
                      >
                        {t(
                          "teacherCourseAttention.actions.result"
                        )}
                      </Link>
                    )}
                  </li>
                )
              )}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
