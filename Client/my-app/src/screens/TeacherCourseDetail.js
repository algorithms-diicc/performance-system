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

import TeacherCourseAnalytics
  from "./TeacherCourseAnalytics";

import {
  coursePeriod,
  formatDateTime,
  teacherApi,
} from "./teacherApi";

import "./TeacherDashboard.css";


const PAGE_SIZE = 50;


function attentionLabel(
  student
) {
  if (
    student.attention
      ?.failedMoreThanCompleted
  ) {
    return "Más fallos que completadas";
  }

  if (
    student.attention
      ?.noExecutions
  ) {
    return "Sin ejecuciones";
  }

  return "Sin alerta";
}


export default function TeacherCourseDetail() {
  const {
    courseId,
  } = useParams();

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
    message: "",
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

        setError(
          err.message ||
          "No fue posible cargar el curso."
        );
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


  const filteredStudents =
    useMemo(
      () => {
        if (
          attention === "all"
        ) {
          return students;
        }

        if (
          attention === "no-executions"
        ) {
          return students.filter(
            (student) =>
              student.attention
                ?.noExecutions
          );
        }

        return students.filter(
          (student) =>
            student.attention
              ?.failedMoreThanCompleted
        );
      },
      [
        students,
        attention,
      ]
    );


  const totalPages =
    Math.max(
      1,
      Math.ceil(
        totalStudents /
        PAGE_SIZE
      )
    );


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

      const verb =
        target
          ? "reactivar"
          : "finalizar";

      if (
        !window.confirm(
          `¿Confirmas ${verb} el curso ${course.code} ${coursePeriod(course)}?`
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
          err.message ||
          "No fue posible actualizar el curso."
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
          message: "",
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
          let message =
            "No fue posible exportar el resumen del curso.";

          try {
            const body =
              await response.json();
            message =
              body?.error?.message ||
              body?.message ||
              message;
          } catch (_) {
            // La respuesta de error puede no ser JSON.
          }

          throw new Error(message);
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
          document.createElement("a");

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
          message:
            "Resumen CSV descargado correctamente.",
        });
      } catch (err) {
        setExportFeedback({
          kind: "error",
          message:
            err.message ||
            "No fue posible exportar el resumen del curso.",
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
          err.message ||
          "No fue posible guardar el curso."
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
          error:
            err.message ||
            "No fue posible agregar estudiantes.",
        });
      } finally {
        setAdding(false);
      }
    };


  const removeStudent =
    async (student) => {
      if (
        !window.confirm(
          `¿Retirar a ${student.fullName} del curso? Sus resultados no serán eliminados.`
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
          err.message ||
          "No fue posible retirar al estudiante."
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
          err.message ||
          "No fue posible restaurar al estudiante."
        );
      }
    };


  if (
    loadingCourse &&
    !course
  ) {
    return (
      <main className="teacher-page">

        <div className="teacher-page-inner">
          <InlineState
            type="loading"
            title="Cargando curso"
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
            title="No pudimos cargar el curso"
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
            ← Volver a cursos
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
                  ? "Activo"
                  : "Finalizado"}
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
              title="Exporta todos los estudiantes activos del curso"
            >
              {exportingCsv
                ? "Exportando..."
                : "Exportar CSV"}
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
                ? "Cerrar edición"
                : "Editar"}
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
                ? "Finalizar curso"
                : "Reactivar curso"}
            </button>

          </div>

        </header>


        {exportFeedback.message && (
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
            {exportFeedback.message}
          </div>
        )}


        <TeacherCourseAnalytics
          courseId={courseId}
          reloadToken={reloadToken}
        />


        {editing && (

          <section className="teacher-panel">

            <div className="teacher-panel-heading">

              <div>
                <h2>
                  Editar curso
                </h2>

                <p>
                  Cambia los metadatos de esta instancia académica.
                </p>
              </div>

            </div>


            <form
              className="teacher-form-grid"
              onSubmit={saveCourse}
            >

              <div>
                <label>
                  Código
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
                  Nombre
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
                  Año
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
                  Semestre
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
                    ? "Guardando..."
                    : "Guardar cambios"}
                </button>

              </div>

            </form>

          </section>

        )}


        <section className="teacher-panel">

          <div className="teacher-panel-heading">

            <div>
              <h2>
                Estudiantes
              </h2>

              <p>
                Gestiona la lista del curso sin eliminar cuentas
                ni resultados históricos.
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
                  : "Reactiva el curso para agregar estudiantes."
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
                ? "Cerrar"
                : "Agregar estudiantes"}
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
                Correos institucionales
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
                placeholder={
                  "alumno1@udec.cl\n"
                  + "alumno2@udec.cl\n"
                  + "alumno3@udec.cl"
                }
                required
              />

              <div className="teacher-add-help">
                Puedes pegar una lista separada por saltos de línea,
                espacios, comas o punto y coma.
              </div>


              {addFeedback?.error && (
                <div className="teacher-inline-error">
                  {addFeedback.error}
                </div>
              )}


              {addFeedback?.summary && (

                <div className="teacher-import-result">

                  <strong>
                    Resultado de la carga
                  </strong>

                  <span>
                    {addFeedback.summary.added || 0} agregados
                    {" · "}
                    {addFeedback.summary.reactivated || 0} reactivados
                    {" · "}
                    {addFeedback.summary.alreadyActive || 0} ya activos
                    {" · "}
                    {addFeedback.summary.rejected || 0} rechazados
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
                              {item.reason}
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
                    ? "Agregando..."
                    : "Agregar al curso"}
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
              >
                Activos
              </button>

              <button
                type="button"
                className={
                  membership === "inactive"
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setMembership(
                    "inactive"
                  )
                }
              >
                Retirados
              </button>

              <button
                type="button"
                className={
                  membership === "all"
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setMembership(
                    "all"
                  )
                }
              >
                Todos
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
                placeholder="Buscar nombre o correo"
              />

              <select
                className="form-select"
                value={attention}
                onChange={(event) =>
                  setAttention(
                    event.target.value
                  )
                }
              >
                <option value="all">
                  Todas las situaciones
                </option>
                <option value="no-executions">
                  Sin ejecuciones
                </option>
                <option value="failures">
                  Más fallos que completadas
                </option>
              </select>

            </div>

          </div>


          {loadingStudents &&
            students.length === 0 && (
              <InlineState
                type="loading"
                title="Cargando estudiantes"
                compact
              />
            )}


          {!loadingStudents &&
            filteredStudents.length === 0 && (

              <div className="teacher-empty teacher-empty--compact">

                <h3>
                  Sin estudiantes para mostrar
                </h3>

                <p>
                  Ajusta los filtros o agrega estudiantes al curso.
                </p>

              </div>

            )}


          {filteredStudents.length > 0 && (

            <div className="table-responsive">

              <table className="table teacher-student-table align-middle mb-0">

                <thead>
                  <tr>
                    <th>
                      Estudiante
                    </th>
                    <th>
                      Estado
                    </th>
                    <th>
                      Envíos
                    </th>
                    <th>
                      Ejec.
                    </th>
                    <th>
                      OK
                    </th>
                    <th>
                      Fallidas
                    </th>
                    <th>
                      Última actividad
                    </th>
                    <th>
                      Atención
                    </th>
                    <th className="text-end">
                      Acción
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
                              ? "Activo"
                              : "Retirado"}
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
                            student.lastActivityAt
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
                              student
                            )}
                          </span>
                        </td>

                        <td className="text-end">

                          <div className="teacher-row-actions">

                            <Link
                              className="btn btn-sm teacher-row-button teacher-row-button--profile"
                              to={`/teacher/courses/${courseId}/students/${student.userId}`}
                            >
                              Ver ficha
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
                                  Último resultado
                                </Link>
                              )
                              : (
                                <button
                                  type="button"
                                  className="btn btn-sm teacher-row-button teacher-row-button--result"
                                  disabled
                                  title="Este estudiante todavía no tiene resultados completados"
                                >
                                  Último resultado
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
                                  Retirar
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
                                  Restaurar
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
              {totalStudents === 0
                ? "0 estudiantes"
                : (
                  `${totalStudents} estudiantes`
                )}
            </span>

            <div>

              <button
                type="button"
                className="btn btn-sm teacher-row-button"
                disabled={
                  page <= 1 ||
                  loadingStudents
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
                Anterior
              </button>

              <span>
                Página {page} de {totalPages}
              </span>

              <button
                type="button"
                className="btn btn-sm teacher-row-button"
                disabled={
                  page >= totalPages ||
                  loadingStudents
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
                Siguiente
              </button>

            </div>

          </footer>

        </section>

      </div>

    </main>
  );
}
