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
  coursePeriod,
  formatDateTime,
  pluralize,
  teacherApi,
} from "./teacherApi";

import "./TeacherDashboard.css";


const currentYear =
  new Date().getFullYear();


function EmptyCourseState({
  activeView,
  onCreate,
}) {
  return (
    <div className="teacher-empty">

      <h3>
        {activeView
          ? "Todavía no hay cursos activos"
          : "No hay cursos históricos"}
      </h3>

      <p>
        {activeView
          ? (
            "Crea una instancia académica para separar "
            + "estudiantes y resultados por semestre."
          )
          : (
            "Los cursos finalizados aparecerán aquí "
            + "sin perder su historial."
          )}
      </p>

      {activeView && (
        <button
          type="button"
          className="btn teacher-primary-button"
          onClick={onCreate}
        >
          Crear curso
        </button>
      )}

    </div>
  );
}


function CourseCard({
  course,
  onOpen,
}) {
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
                ? "Activo"
                : "Finalizado"}
            </span>

          </div>

          <h2>
            {course.name}
          </h2>

          <p>
            {coursePeriod(course)}
            {" · "}
            {course.teacher?.fullName || "Profesor no disponible"}
          </p>

        </div>

        <button
          type="button"
          className="btn teacher-secondary-button"
          onClick={() =>
            onOpen(course.id)
          }
        >
          Abrir
        </button>

      </div>


      <div className="teacher-course-metrics">

        <div>
          <span>Estudiantes</span>
          <strong>
            {course.activeStudents || 0}
          </strong>
        </div>

        <div>
          <span>Envíos</span>
          <strong>
            {course.submissions || 0}
          </strong>
        </div>

        <div>
          <span>Ejecuciones</span>
          <strong>
            {course.executions || 0}
          </strong>
        </div>

      </div>


      <footer className="teacher-course-footer">

        <span>
          {course.totalStudents > course.activeStudents
            ? (
              `${course.totalStudents} estudiantes históricos`
            )
            : (
              pluralize(
                course.totalStudents || 0,
                "estudiante registrado",
                "estudiantes registrados"
              )
            )}
        </span>

        <span>
          Última actividad:{" "}
          {formatDateTime(
            course.lastActivityAt
          )}
        </span>

      </footer>

    </article>
  );
}


export default function TeacherCourses() {
  const navigate =
    useNavigate();

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
            setError(
              err.message ||
              "No fue posible cargar los cursos."
            );
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
        setCreateError(
          err.message ||
          "No fue posible crear el curso."
        );
      } finally {
        setCreating(false);
      }
    };


  return (
    <main className="teacher-page">

      <div className="teacher-page-inner">

        <header className="teacher-page-header">

          <div>

            <p className="teacher-eyebrow">
              Supervisión docente
            </p>

            <h1>
              Cursos
            </h1>

            <span>
              Separa la actividad por semestre y revisa
              únicamente a los estudiantes de cada curso.
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
              ? "Cerrar"
              : "Crear curso"}
          </button>

        </header>


        <section className="teacher-summary-grid">

          <article>
            <span>
              {activeView
                ? "Cursos activos"
                : "Cursos históricos"}
            </span>
            <strong>
              {stats.courses}
            </strong>
          </article>

          <article>
            <span>
              Estudiantes activos
            </span>
            <strong>
              {stats.students}
            </strong>
          </article>

          <article>
            <span>
              Envíos
            </span>
            <strong>
              {stats.submissions}
            </strong>
          </article>

          <article>
            <span>
              Ejecuciones
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
                  Nueva instancia académica
                </h2>

                <p>
                  El mismo código puede existir en años
                  o semestres distintos sin mezclar resultados.
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
                  Código
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
                  placeholder="Ej. INF-221"
                  maxLength={50}
                  required
                />
              </div>


              <div className="teacher-form-span-2">

                <label
                  htmlFor="teacher-course-name"
                >
                  Nombre
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
                  placeholder="Ej. Estructuras de Datos"
                  maxLength={150}
                  required
                />
              </div>


              <div>
                <label
                  htmlFor="teacher-course-year"
                >
                  Año
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
                  Semestre
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
                  <span className="teacher-inline-error">
                    {createError}
                  </span>
                )}

                <button
                  type="submit"
                  className="btn teacher-primary-button"
                  disabled={creating}
                >
                  {creating
                    ? "Creando..."
                    : "Crear curso"}
                </button>

              </div>

            </form>

          </section>

        )}


        <section className="teacher-toolbar">

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
            >
              Activos
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
            >
              Históricos
            </button>

          </div>


          <div className="teacher-search">

            <label
              htmlFor="teacher-course-search"
            >
              Buscar curso
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
              placeholder="Código, nombre o profesor"
            />

          </div>

        </section>


        {loading && items.length === 0 && (
          <InlineState
            type="loading"
            title="Cargando cursos"
            compact
          />
        )}


        {error && (
          <InlineState
            type="error"
            title="No pudimos cargar los cursos"
            description={error}
            actionLabel="Reintentar"
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

            <section className="teacher-course-list">

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
