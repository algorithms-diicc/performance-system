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
import "./ProfilePage.css";

const formatRole = (role) => {
  const normalized = String(role ?? "").trim().toLowerCase();

  if (
    normalized === "admin" ||
    normalized === "administrator" ||
    normalized === "administrador"
  ) {
    return "Administrador";
  }

  if (normalized === "student" || normalized === "estudiante") {
    return "Estudiante";
  }

  return role || "Usuario";
};

const formatDateTime = (value) => {
  if (!value) return "Sin registro";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin registro";

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const formatDuration = (milliseconds) => {
  const value = Number(milliseconds);

  if (!Number.isFinite(value) || value < 0) return "Sin datos";
  if (value < 1000) return `${Math.round(value)} ms`;

  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)} s`;

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return `${minutes} min ${remainingSeconds} s`;
};

const formatAcademicPeriod = (course) => {
  const year = String(course?.academicYear ?? "").trim();
  const term = String(course?.academicTerm ?? "").trim();

  if (!year && !term) return "Período no disponible";
  if (year && term) return `${year} · Semestre ${term}`;
  if (year) return year;
  return `Semestre ${term}`;
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

const ProfileCourseCard = ({ course }) => {
  const courseId = String(course?.id ?? "").trim();
  const courseCode = String(course?.code || "").trim() || "Curso";
  const courseName =
    String(course?.name || "").trim() || "Curso sin nombre";
  const teacherName =
    String(course?.teacher?.fullName || "").trim() ||
    "Profesor no disponible";
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
          <span>Período</span>
          <strong>{formatAcademicPeriod(course)}</strong>
        </div>
        <div>
          <span>Profesor</span>
          <strong>{teacherName}</strong>
        </div>
      </div>

      <Link to={analysisPath} className="profile-course-card__action">
        Nuevo análisis en este curso
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </article>
  );
};

const ProfilePage = () => {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [coursesError, setCoursesError] = useState("");

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const body = await requestJson(
        "/api/profile",
        { credentials: "include" },
        { fallback: "No fue posible cargar tu perfil." }
      );

      if (
        !body ||
        typeof body !== "object" ||
        !body.profile ||
        !body.summary
      ) {
        throw new Error("El servidor devolvió un perfil incompleto.");
      }

      setData(body);
    } catch (loadError) {
      console.error("Error cargando /api/profile:", loadError);
      setError(loadError?.message || "No fue posible cargar tu perfil.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadCourses = useCallback(async () => {
    setCoursesLoading(true);
    setCoursesError("");

    try {
      const body = await requestJson(
        "/api/student/courses",
        { credentials: "include" },
        { fallback: "No fue posible cargar tus cursos activos." }
      );

      setCourses(
        Array.isArray(body?.items)
          ? body.items
          : []
      );
    } catch (loadError) {
      console.error("Error cargando /api/student/courses:", loadError);
      setCourses([]);
      setCoursesError(
        loadError?.message || "No fue posible cargar tus cursos activos."
      );
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadCourses();
  }, [loadProfile, loadCourses]);

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
                <strong>Cargando tu perfil</strong>
                <span>Consultando actividad y resumen de ejecuciones.</span>
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
                <span className="profile-eyebrow">Mi perfil</span>
                <h1>No pudimos cargar tu información</h1>
                <p>{error}</p>

                <button
                  type="button"
                  className="profile-button profile-button--primary"
                  onClick={loadProfile}
                >
                  <RefreshCw size={17} />
                  Reintentar
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
              <span className="profile-eyebrow">Cuenta personal</span>
              <h1>Mi perfil</h1>
              <p>
                Revisa tu identidad institucional y un resumen de la actividad
                registrada en Performance System.
              </p>
            </div>

            <Link to="/" className="profile-button profile-button--primary">
              <PlayCircle size={18} />
              Nuevo análisis
            </Link>
          </header>

          <section className="profile-identity-card">
            <div className="profile-avatar">{initials}</div>

            <div className="profile-identity-card__body">
              <div className="profile-identity-card__heading">
                <div>
                  <h2>{profile.full_name || "Usuario"}</h2>

                  <span className="profile-email">
                    <Mail size={16} />
                    {profile.email || "Sin correo registrado"}
                  </span>
                </div>

                <div className="profile-badges">
                  <span className="profile-badge profile-badge--role">
                    <ShieldCheck size={15} />
                    {formatRole(profile.role)}
                  </span>

                  <span
                    className={
                      profile.isActive
                        ? "profile-badge profile-badge--active"
                        : "profile-badge profile-badge--inactive"
                    }
                  >
                    <span className="profile-badge__dot" />
                    {profile.statusLabel ||
                      (profile.isActive ? "Activo" : "Inactivo")}
                  </span>
                </div>
              </div>

              <div className="profile-account-grid">
                <div>
                  <CalendarDays size={18} />
                  <span>Cuenta creada</span>
                  <strong>{formatDateTime(profile.createdAt)}</strong>
                </div>

                <div>
                  <LogIn size={18} />
                  <span>Última sesión</span>
                  <strong>{formatDateTime(profile.lastLogin)}</strong>
                </div>

                <div>
                  <Activity size={18} />
                  <span>Última ejecución</span>
                  <strong>{formatDateTime(summary.lastExecutionAt)}</strong>
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
                <span className="profile-eyebrow">Contexto académico</span>
                <h2 id="profile-courses-title">Mis cursos</h2>
              </div>

              <p>
                Cursos activos en los que puedes asociar nuevos experimentos.
              </p>
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
                  <strong>Cargando tus cursos</strong>
                  <p>Consultando tu contexto académico activo.</p>
                </div>
              </div>
            ) : coursesError ? (
              <div className="profile-courses-state profile-courses-state--error">
                <XCircle size={22} strokeWidth={1.8} aria-hidden="true" />
                <div>
                  <strong>No pudimos cargar tus cursos</strong>
                  <p>{coursesError}</p>
                  <button
                    type="button"
                    className="profile-button profile-button--primary"
                    onClick={loadCourses}
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                    Reintentar cursos
                  </button>
                </div>
              </div>
            ) : courses.length === 0 ? (
              <div className="profile-courses-state">
                <GraduationCap size={24} strokeWidth={1.8} aria-hidden="true" />
                <div>
                  <strong>Actualmente no tienes cursos activos.</strong>
                  <p>
                    Puedes realizar un análisis personal sin asociarlo a un
                    curso.
                  </p>
                  <Link to="/" className="profile-inline-link">
                    Iniciar análisis personal
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="profile-courses-grid">
                {courses.map((course) => (
                  <ProfileCourseCard key={course.id} course={course} />
                ))}
              </div>
            )}
          </section>

          <section className="profile-section">
            <div className="profile-section-heading">
              <div>
                <span className="profile-eyebrow">Actividad</span>
                <h2>Resumen de uso</h2>
              </div>

              <p>
                Las cifras se calculan desde tus submissions y ejecuciones
                persistidas.
              </p>
            </div>

            <div className="profile-metrics-grid">
              <ProfileMetricCard
                icon={UploadCloud}
                label="Submissions"
                value={summary.submissionsCount || 0}
                hint="Envíos registrados"
              />

              <ProfileMetricCard
                icon={Activity}
                label="Ejecuciones"
                value={summary.executionsCount || 0}
                hint="Ejecuciones totales"
              />

              <ProfileMetricCard
                icon={CheckCircle2}
                label="Completadas"
                value={summary.completedExecutions || 0}
                hint="Con procesamiento finalizado"
                tone="success"
              />

              <ProfileMetricCard
                icon={XCircle}
                label="Fallidas"
                value={summary.failedExecutions || 0}
                hint="Con fallo registrado"
                tone="danger"
              />
            </div>
          </section>

          <section className="profile-two-column">
            <article className="profile-panel">
              <div className="profile-panel__title">
                <Gauge size={20} />
                <div>
                  <span className="profile-eyebrow">Ejecuciones</span>
                  <h2>Estado actual</h2>
                </div>
              </div>

              <div className="profile-state-list">
                <div>
                  <span>En curso</span>
                  <strong>{activeExecutions}</strong>
                </div>
                <div>
                  <span>En cola</span>
                  <strong>{summary.queuedExecutions || 0}</strong>
                </div>
                <div>
                  <span>En ejecución</span>
                  <strong>{summary.runningExecutions || 0}</strong>
                </div>
                <div>
                  <span>Procesando</span>
                  <strong>{summary.processingExecutions || 0}</strong>
                </div>
                <div>
                  <span>Canceladas</span>
                  <strong>{summary.cancelledExecutions || 0}</strong>
                </div>
              </div>
            </article>

            <article className="profile-panel">
              <div className="profile-panel__title">
                <Clock3 size={20} />
                <div>
                  <span className="profile-eyebrow">Última actividad</span>
                  <h2>Ejecución más reciente</h2>
                </div>
              </div>

              <div className="profile-last-execution">
                <div>
                  <span>Estado</span>
                  <strong>
                    {summary.lastExecutionStatus || "Sin ejecuciones"}
                  </strong>
                </div>

                <div>
                  <span>Fecha</span>
                  <strong>{formatDateTime(summary.lastExecutionAt)}</strong>
                </div>

                <div>
                  <span>Duración media</span>
                  <strong>{formatDuration(summary.avgDurationMs)}</strong>
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
                    Ver experimento
                    <ArrowRight size={16} />
                  </Link>
                )}

                {canOpenLastResult && (
                  <Link
                    to={`/code/${summary.lastExecutionCodename}`}
                    className="profile-inline-link"
                  >
                    Ver último resultado
                    <ArrowRight size={16} />
                  </Link>
                )}

                <Link to="/history" className="profile-inline-link">
                  Ver historial completo
                  <ArrowRight size={16} />
                </Link>
              </div>

              {!canOpenLastSubmission && !canOpenLastResult && (
                <span className="profile-inline-note">
                  {summary.executionsCount
                    ? "La ejecución más reciente todavía no tiene un resultado final disponible."
                    : "Cuando completes tu primer análisis, aquí aparecerá su estado."}
                </span>
              )}
            </article>
          </section>

          <section className="profile-footnote">
            <UserRound size={19} />
            <div>
              <strong>Datos institucionales</strong>
              <p>
                El nombre, correo y rol mostrados provienen de tu cuenta
                registrada en el sistema. No se editan desde esta pantalla.
              </p>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
