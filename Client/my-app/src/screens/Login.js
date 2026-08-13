import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { requestJson } from "../common/requestErrorModel";
import "./Login.css";

const Login = () => {
  const [searchParams] = useSearchParams();

  // Estado para el botón de Google
  const [googleLoading, setGoogleLoading] = useState(false);

  // Estado para el formulario de solicitud de acceso (@udec.cl)
  const [fullName, setFullName] = useState("");
  const [requestEmail, setRequestEmail] = useState("");
  const [professorEmail, setProfessorEmail] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [message, setMessage] = useState("");

  const [requestErrors, setRequestErrors] = useState({});
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const [requestFeedback, setRequestFeedback] = useState(null); // { type, text }
  const [authFeedback, setAuthFeedback] = useState(null);

  // =========================================================
  // Feedback devuelto por /auth/callback
  // =========================================================
  useEffect(() => {
    const status = searchParams.get("auth_status");
    if (!status) return;

    const code = searchParams.get("auth_code") || "LOGIN_ERROR";
    const message =
      searchParams.get("auth_message") ||
      "No fue posible completar el inicio de sesión.";
    const email = (searchParams.get("auth_email") || "").trim();

    const informationalCodes = new Set([
      "ACCESS_REQUIRED",
      "ACCESS_PENDING",
    ]);

    setAuthFeedback({
      type: informationalCodes.has(code) ? "info" : "error",
      text: message,
    });

    if (
      email.toLowerCase().endsWith("@udec.cl") &&
      !email.toLowerCase().endsWith("@inf.udec.cl")
    ) {
      setRequestEmail(email);
    }

    // El mensaje permanece en estado React, pero evitamos que F5
    // vuelva a reproducir una alerta OAuth ya atendida.
    window.history.replaceState(
      window.history.state,
      "",
      "/login"
    );
  }, [searchParams]);

  // =========================
  // Handler: Login con Google
  // =========================
  const handleGoogleLogin = () => {
    setGoogleLoading(true);

    const configuredApiOrigin =
      process.env.REACT_APP_API_ORIGIN?.trim();

    const apiOrigin = (
      configuredApiOrigin ||
      (process.env.NODE_ENV === "development"
        ? "http://localhost:5000"
        : "")
    ).replace(/\/$/, "");

    window.location.assign(`${apiOrigin}/auth/login`);
  };

  // ==========================================
  // Validación básica del formulario de acceso
  // ==========================================
  const validateRequestForm = () => {
    const errors = {};

    if (!fullName.trim()) {
      errors.fullName = "El nombre completo es obligatorio.";
    }

    if (!requestEmail.trim()) {
      errors.requestEmail = "El correo institucional es obligatorio.";
    } else if (!requestEmail.endsWith("@udec.cl")) {
      errors.requestEmail =
        "Este formulario es solo para correos institucionales @udec.cl.";
    }

    if (!professorEmail.trim()) {
      errors.professorEmail = "Debe indicar el correo del profesor responsable.";
    } else if (!professorEmail.includes("@")) {
      errors.professorEmail = "El correo del profesor no parece ser válido.";
    }

    setRequestErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // =============================================================
  // Handler: Enviar solicitud de acceso (POST /api/public/access-requests)
  // =============================================================
  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    setRequestFeedback(null);

    if (!validateRequestForm()) return;

    setRequestSubmitting(true);

    try {
      await requestJson(
        "/api/public/access-requests",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            full_name: fullName,
            email: requestEmail,
            professor_email: professorEmail,
            course_code: courseCode,
            message,
          }),
        },
        {
          fallback:
            "Ocurrió un error al enviar la solicitud. Intenta nuevamente.",
        }
      );

      // Éxito: limpiamos campos y mostramos mensaje
      setFullName("");
      setRequestEmail("");
      setProfessorEmail("");
      setCourseCode("");
      setMessage("");
      setRequestErrors({});

      setRequestFeedback({
        type: "success",
        text:
          "Solicitud enviada correctamente. " +
          "Cuando tu cuenta sea aprobada, podrás ingresar usando 'Continuar con Google' con el mismo correo @udec.cl.",
      });
    } catch (err) {
      const apiError = err?.payload?.error;
      setRequestFeedback({
        type: apiError?.status === "PENDING" ? "info" : "error",
        text:
          err?.message ||
          "Ocurrió un error al enviar la solicitud. Intenta nuevamente.",
      });
    } finally {
      setRequestSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-overlay" />

      <div className="login-layout">
        {/* Panel de marca / explicación */}
        <section className="login-side">
          <div className="login-brand">
            <img
              src="/iconSP.png"
              alt="Logo Performance System"
              className="login-logo"
            />
            <h1 className="login-brand-title">Performance System</h1>
            <p className="login-brand-subtitle">
              Plataforma para medir y analizar el rendimiento de código C++
              usando métricas de hardware reales.
            </p>
          </div>

          <ul className="login-highlights">
            <li>
              Análisis de rendimiento para{" "}
              <strong>LCS, CAMM y SIZE</strong>.
            </li>
            <li>
              Métricas avanzadas:{" "}
              <strong>IPC, caché, energía, ciclos</strong>.
            </li>
            <li>
              Integración con cuentas institucionales{" "}
              <strong>@inf.udec.cl y @udec.cl*</strong>.
            </li>
          </ul>

          <p className="login-note">
            El acceso estándar es con tu correo{" "}
            <strong>@inf.udec.cl</strong>. Si perteneces a otra carrera de la
            UdeC, puedes solicitar acceso con tu correo{" "}
            <strong>@udec.cl</strong> usando el formulario de esta página.
          </p>
        </section>

        {/* Panel de login */}
        <section className="login-card">
          <header className="login-header">
            <h2 className="login-title">Acceso institucional</h2>
            <p className="login-subtitle">
              Ingresa con tu cuenta institucional:
              <br />
              <strong>@inf.udec.cl</strong> (acceso directo) o{" "}
              <strong>@udec.cl</strong> (previa aprobación).
            </p>
          </header>

          {authFeedback && (
            <div
              className={`login-alert ${
                authFeedback.type === "info"
                  ? "login-alert--info"
                  : "login-alert--error"
              }`}
              role="status"
            >
              {authFeedback.text}
            </div>
          )}

          {/* Botón de Google */}
          <div className="login-oauth">
            <button
              type="button"
              className="login-google-btn"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
            >
              <span className="login-google-icon">G</span>
              <span>
                {googleLoading
                  ? "Redirigiendo a Google..."
                  : "Continuar con Google"}
              </span>
            </button>
            <p className="login-oauth-hint">
              Se utilizará tu cuenta institucional para autenticarte de forma
              segura. Si tu correo pertenece a <strong>@inf.udec.cl</strong>, el
              acceso es inmediato. Si usas <strong>@udec.cl</strong>, primero
              debes solicitar acceso y esperar la aprobación.
            </p>
          </div>

          {/* Separador */}
          <div className="login-divider">
            <span className="login-divider-line" />
            <span className="login-divider-label">
              Solicitud de acceso (correo @udec.cl)
            </span>
            <span className="login-divider-line" />
          </div>

          {/* Mensaje global del formulario (éxito / error) */}
          {requestFeedback && (
            <div
              className={`login-alert ${
                requestFeedback.type === "success"
                  ? "login-alert--success"
                  : requestFeedback.type === "info"
                    ? "login-alert--info"
                    : "login-alert--error"
              }`}
            >
              {requestFeedback.text}
            </div>
          )}


          {/* Formulario de solicitud de acceso */}
          <form
            onSubmit={handleRequestSubmit}
            className="login-form login-form--grid"
            noValidate
          >
            {/* Fila 1: Nombre completo | Correo UdeC */}
            <div className="login-field login-field--half">
              <label htmlFor="fullName" className="login-label">
                Nombre completo
              </label>
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`login-input ${
                  requestErrors.fullName ? "login-input--error" : ""
                }`}
                placeholder="Nombre Apellido"
              />
              {requestErrors.fullName && (
                <span className="login-error-text">
                  {requestErrors.fullName}
                </span>
              )}
            </div>

            <div className="login-field login-field--half">
              <label htmlFor="requestEmail" className="login-label">
                Correo institucional UdeC
              </label>
              <input
                id="requestEmail"
                type="email"
                value={requestEmail}
                onChange={(e) => setRequestEmail(e.target.value)}
                className={`login-input ${
                  requestErrors.requestEmail ? "login-input--error" : ""
                }`}
                placeholder="nombre.apellido@udec.cl"
              />
              {requestErrors.requestEmail && (
                <span className="login-error-text">
                  {requestErrors.requestEmail}
                </span>
              )}
            </div>

            {/* Fila 2: Correo profesor | Curso */}
            <div className="login-field login-field--half">
              <label htmlFor="professorEmail" className="login-label">
                Correo del profesor responsable
              </label>
              <input
                id="professorEmail"
                type="email"
                value={professorEmail}
                onChange={(e) => setProfessorEmail(e.target.value)}
                className={`login-input ${
                  requestErrors.professorEmail ? "login-input--error" : ""
                }`}
                placeholder="josefuentes@inf.udec.cl"
              />
              {requestErrors.professorEmail && (
                <span className="login-error-text">
                  {requestErrors.professorEmail}
                </span>
              )}
            </div>

            <div className="login-field login-field--half">
              <label htmlFor="courseCode" className="login-label">
                Curso / Asignatura{" "}
                <span className="login-label-optional">opcional</span>
              </label>
              <input
                id="courseCode"
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="login-input"
                placeholder="Ej: INF-253 Estructuras de Datos"
              />
            </div>

            {/* Fila 3: Comentario ancho completo */}
            <div className="login-field login-field--full">
              <label htmlFor="message" className="login-label">
                Comentario{" "}
                <span className="login-label-optional">opcional</span>
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="login-input login-input--textarea"
                placeholder="Explica brevemente por qué necesitas acceso (2–3 líneas)."
                rows={3}
              />
            </div>

            <div className="login-meta login-field--full">
              <span className="login-meta-text">
                Al enviar esta solicitud, un administrador revisará tu caso. Si
                es aprobada, recibirás un correo de confirmación y podrás
                ingresar usando <strong>'Continuar con Google'</strong> con el
                mismo correo <strong>@udec.cl</strong>.
              </span>
            </div>

            <div className="login-field login-field--full">
              <button
                type="submit"
                className="login-submit-btn"
                disabled={requestSubmitting}
              >
                {requestSubmitting
                  ? "Enviando solicitud..."
                  : "Enviar solicitud de acceso"}
              </button>
            </div>
          </form>

          <footer className="login-footer">
            <p className="login-footer-text">
              ¿Problemas para acceder? Contacta al docente responsable del ramo
              o al administrador del laboratorio{" "}
              <strong>(ej: josefuentes@inf.udec.cl)</strong>.
            </p>
          </footer>
        </section>
      </div>
    </div>
  );
};

export default Login;
