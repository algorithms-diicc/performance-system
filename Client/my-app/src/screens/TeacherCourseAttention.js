import React, {
  useMemo,
} from "react";
import {
  Link,
} from "react-router-dom";

import InlineState
  from "../components/InlineState";

import {
  formatDateTime,
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


export default function TeacherCourseAttention({
  courseId,
  students,
  loading,
  error,
  onRetry,
  onSelectFilter,
}) {
  const summary =
    useMemo(
      () =>
        buildAcademicAttention(
          students
        ),
      [students]
    );

  if (
    loading &&
    (!students || students.length === 0)
  ) {
    return (
      <section className="teacher-attention-panel">
        <InlineState
          type="loading"
          title="Cargando atención académica"
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
          title="No pudimos cargar la atención académica"
          description={error}
          actionLabel="Reintentar"
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
            Supervisión accionable
          </p>
          <h2 id="teacher-attention-title">
            Atención académica
          </h2>
          <p>
            Señales operativas para encontrar casos que conviene revisar,
            sin calificar ni comparar estudiantes.
          </p>
        </div>

        {loading && (
          <span className="teacher-attention-refreshing">
            Actualizando…
          </span>
        )}
      </div>

      {error && (
        <div
          className="teacher-attention-inline-error"
          role="status"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onRetry}
          >
            Reintentar
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
          aria-label={`${summary.noExecutions.length} estudiantes sin ejecuciones. Ver estudiantes.`}
        >
          <span>Sin ejecuciones</span>
          <strong>
            {summary.noExecutions.length}
          </strong>
          <p>
            Estudiantes activos que todavía no registran ejecuciones.
          </p>
          <small>
            Ver estudiantes →
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
          aria-label={`${summary.failures.length} estudiantes con más fallos que completadas. Ver estudiantes.`}
        >
          <span>Fallos predominantes</span>
          <strong>
            {summary.failures.length}
          </strong>
          <p>
            Estudiantes con más ejecuciones fallidas que completadas.
          </p>
          <small>
            Ver estudiantes →
          </small>
        </button>

        <article className="teacher-attention-recent">
          <div>
            <span>Actividad reciente</span>
            <p>
              Últimos estudiantes con actividad registrada.
            </p>
          </div>

          {summary.recent.length === 0 ? (
            <div className="teacher-attention-recent-empty">
              Aún no hay actividad registrada.
            </div>
          ) : (
            <ul>
              {summary.recent.map(
                (student) => (
                  <li key={student.userId}>
                    <Link
                      className="teacher-attention-student-link"
                      to={`/teacher/courses/${courseId}/students/${student.userId}`}
                    >
                      <strong>
                        {student.fullName}
                      </strong>
                      <small>
                        {formatDateTime(
                          student.lastActivityAt
                        )}
                      </small>
                    </Link>

                    {student.lastResultCodename && (
                      <Link
                        className="teacher-attention-result-link"
                        to={`/code/${student.lastResultCodename}`}
                        aria-label={`Ver último resultado de ${student.fullName}`}
                      >
                        Resultado
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
