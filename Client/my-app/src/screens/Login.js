import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { requestJson } from "../common/requestErrorModel";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useI18n } from "../i18n";
import "./Login.css";

const AUTH_MESSAGE_KEYS = {
  INVALID_OAUTH_STATE: "login.auth.invalidOauthState",
  GOOGLE_AUTH_ERROR: "login.auth.googleAuthError",
  MISSING_AUTH_CODE: "login.auth.missingAuthCode",
  MISSING_ID_TOKEN: "login.auth.missingIdToken",
  EXTERNAL_DOMAIN: "login.auth.externalDomain",
  ACCESS_REQUIRED: "login.auth.accessRequired",
  ACCESS_PENDING: "login.auth.accessPending",
  ACCOUNT_DISABLED: "login.auth.accountDisabled",
  ACCESS_DENIED: "login.auth.accessDenied",
  LOGIN_ERROR: "login.auth.generic",
};

const Login = () => {
  const [searchParams] = useSearchParams();
  const { language, t } = useI18n();

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
      searchParams.get("auth_message") || "";
    const email = (searchParams.get("auth_email") || "").trim();

    const informationalCodes = new Set([
      "ACCESS_REQUIRED",
      "ACCESS_PENDING",
    ]);

    setAuthFeedback({
      type: informationalCodes.has(code) ? "info" : "error",
      code,
      message,
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
      errors.fullName = "login.validation.fullNameRequired";
    }

    if (!requestEmail.trim()) {
      errors.requestEmail = "login.validation.emailRequired";
    } else if (!requestEmail.endsWith("@udec.cl")) {
      errors.requestEmail = "login.validation.emailDomain";
    }

    if (!professorEmail.trim()) {
      errors.professorEmail = "login.validation.professorRequired";
    } else if (!professorEmail.includes("@")) {
      errors.professorEmail = "login.validation.professorInvalid";
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
          fallback: t("login.request.error"),
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
        key: "login.request.success",
      });
    } catch (err) {
      const apiError = err?.payload?.error;
      let key = "login.request.error";

      if (apiError?.status === "PENDING") {
        key = "login.request.pending";
      } else if (apiError?.field === "email") {
        key = "login.request.emailRejected";
      } else if (apiError?.field === "professor_email") {
        key = "login.request.professorRejected";
      }

      setRequestFeedback({
        type: apiError?.status === "PENDING" ? "info" : "error",
        key,
        rawText: err?.message || "",
      });
    } finally {
      setRequestSubmitting(false);
    }
  };

  const authFeedbackText = authFeedback
    ? (
        AUTH_MESSAGE_KEYS[authFeedback.code]
          ? t(AUTH_MESSAGE_KEYS[authFeedback.code])
          : (
              language === "es" && authFeedback.message
                ? authFeedback.message
                : t("login.auth.generic")
            )
      )
    : "";

  const requestFeedbackText = requestFeedback
    ? (
        language === "es" && requestFeedback.rawText
          ? requestFeedback.rawText
          : t(requestFeedback.key || "login.request.error")
      )
    : "";

  return (
    <div className="login-page">
      <div className="login-overlay" />
      <LanguageSwitcher variant="login" />

      <div className="login-layout">
        {/* Panel de marca / explicación */}
        <section className="login-side">
          <div className="login-brand">
            <img
              src="/iconSP.png"
              alt={t("login.logoAlt")}
              className="login-logo"
            />
            <h1 className="login-brand-title">Performance System</h1>
            <p className="login-brand-subtitle">
              {t("login.brandSubtitle")}
            </p>
          </div>

          <ul className="login-highlights">
            <li>
              {t("login.highlights.analysisLead")}{" "}
              <strong>{t("login.highlights.benchmarks")}</strong>.
            </li>
            <li>
              {t("login.highlights.metricsLead")}{" "}
              <strong>{t("login.highlights.metrics")}</strong>.
            </li>
            <li>
              {t("login.highlights.integrationLead")}{" "}
              <strong>{t("login.highlights.accounts")}</strong>.
            </li>
          </ul>

          <p className="login-note">
            {t("login.note.standardLead")}{" "}
            <strong>@inf.udec.cl</strong>.{" "}
            {t("login.note.otherLead")}{" "}
            <strong>@udec.cl</strong>{" "}
            {t("login.note.formSuffix")}
          </p>
        </section>

        {/* Panel de login */}
        <section className="login-card">
          <header className="login-header">
            <h2 className="login-title">{t("login.title")}</h2>
            <p className="login-subtitle">
              {t("login.subtitle.lead")}
              <br />
              <strong>@inf.udec.cl</strong>{" "}
              {t("login.subtitle.direct")}{" "}
              <strong>@udec.cl</strong>{" "}
              {t("login.subtitle.approval")}
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
              {authFeedbackText}
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
                  ? t("login.google.redirecting")
                  : t("login.google.continue")}
              </span>
            </button>
            <p className="login-oauth-hint">
              {t("login.google.hintLead")}{" "}
              <strong>@inf.udec.cl</strong>,{" "}
              {t("login.google.hintImmediate")}{" "}
              <strong>@udec.cl</strong>,{" "}
              {t("login.google.hintRequest")}
            </p>
          </div>

          {/* Separador */}
          <div className="login-divider">
            <span className="login-divider-line" />
            <span className="login-divider-label">
              {t("login.accessRequestDivider")}
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
              {requestFeedbackText}
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
                {t("login.fields.fullName")}
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
                placeholder={t("login.fields.fullNamePlaceholder")}
              />
              {requestErrors.fullName && (
                <span className="login-error-text">
                  {t(requestErrors.fullName)}
                </span>
              )}
            </div>

            <div className="login-field login-field--half">
              <label htmlFor="requestEmail" className="login-label">
                {t("login.fields.institutionalEmail")}
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
                  {t(requestErrors.requestEmail)}
                </span>
              )}
            </div>

            {/* Fila 2: Correo profesor | Curso */}
            <div className="login-field login-field--half">
              <label htmlFor="professorEmail" className="login-label">
                {t("login.fields.professorEmail")}
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
                  {t(requestErrors.professorEmail)}
                </span>
              )}
            </div>

            <div className="login-field login-field--half">
              <label htmlFor="courseCode" className="login-label">
                {t("login.fields.course")}{" "}
                <span className="login-label-optional">
                  {t("login.fields.optional")}
                </span>
              </label>
              <input
                id="courseCode"
                type="text"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="login-input"
                placeholder={t("login.fields.coursePlaceholder")}
              />
            </div>

            {/* Fila 3: Comentario ancho completo */}
            <div className="login-field login-field--full">
              <label htmlFor="message" className="login-label">
                {t("login.fields.comment")}{" "}
                <span className="login-label-optional">
                  {t("login.fields.optional")}
                </span>
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="login-input login-input--textarea"
                placeholder={t("login.fields.commentPlaceholder")}
                rows={3}
              />
            </div>

            <div className="login-meta login-field--full">
              <span className="login-meta-text">
                {t("login.request.metaLead")}{" "}
                <strong>'{t("login.google.continue")}'</strong>{" "}
                {t("login.request.metaSuffix")}{" "}
                <strong>@udec.cl</strong>.
              </span>
            </div>

            <div className="login-field login-field--full">
              <button
                type="submit"
                className="login-submit-btn"
                disabled={requestSubmitting}
              >
                {requestSubmitting
                  ? t("login.request.submitting")
                  : t("login.request.submit")}
              </button>
            </div>
          </form>

          <footer className="login-footer">
            <p className="login-footer-text">
              {t("login.footer.lead")}{" "}
              <strong>{t("login.footer.example")}</strong>
            </p>
          </footer>
        </section>
      </div>
    </div>
  );
};

export default Login;
