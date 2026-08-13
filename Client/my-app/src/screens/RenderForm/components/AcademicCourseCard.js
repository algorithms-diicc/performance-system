import React from "react";


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
  onCourseChange,
  onRetry,
}) {
  if (!loading && !error && courses.length === 0) {
    return null;
  }


  if (loading) {
    return (
      <section className="rf-panel rf-course-context-panel">
        <div className="rf-course-context-heading">
          <div>
            <span className="rf-course-context-kicker">
              Contexto académico
            </span>
            <h3>Curso</h3>
          </div>

          <span className="rf-course-context-badge">
            Cargando…
          </span>
        </div>

        <p className="form-help-text rf-course-context-message">
          Consultando tus cursos activos.
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
              Contexto académico
            </span>
            <h3>No pudimos cargar tus cursos</h3>
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
          Reintentar
        </button>
      </section>
    );
  }


  if (courses.length === 1) {
    const course = courses[0];

    return (
      <section className="rf-panel rf-course-context-panel">
        <div className="rf-course-context-heading">
          <div>
            <span className="rf-course-context-kicker">
              Contexto académico
            </span>
            <h3>Curso asociado</h3>
          </div>

          <span className="rf-course-context-badge rf-course-context-badge--auto">
            Automático
          </span>
        </div>

        <div className="rf-course-context-selected">
          <strong>
            {formatCourseLabel(course)}
          </strong>

          <span>
            {course.name}
          </span>

          <small>
            {course.teacher?.fullName
              ? `Profesor: ${course.teacher.fullName}`
              : "Profesor no disponible"}
          </small>
        </div>

        <p className="form-help-text rf-course-context-message">
          Esta entrega quedará asociada automáticamente a tu único curso activo.
        </p>
      </section>
    );
  }


  return (
    <section className="rf-panel rf-course-context-panel">
      <div className="rf-course-context-heading">
        <div>
          <span className="rf-course-context-kicker">
            Contexto académico
          </span>
          <h3>Selecciona el curso</h3>
        </div>

        <span className="rf-course-context-badge rf-course-context-badge--required">
          Obligatorio
        </span>
      </div>

      <label
        className="form-label"
        htmlFor="rf-course-context-select"
      >
        Curso de esta entrega
      </label>

      <select
        id="rf-course-context-select"
        className="form-input rf-course-context-select"
        value={selectedCourseId}
        onChange={(event) =>
          onCourseChange(event.target.value)
        }
        required={selectionRequired}
      >
        <option value="">
          Selecciona un curso…
        </option>

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
        Tienes más de un curso activo. Elegirlo evita mezclar entregas de
        ramos o semestres distintos.
      </p>
    </section>
  );
}


export default AcademicCourseCard;
