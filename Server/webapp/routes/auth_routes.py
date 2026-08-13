# server/webapp/routes/auth_routes.py

import os
import re
from urllib.parse import urlencode

from flask import (
    Blueprint,
    redirect,
    request,
    jsonify,
    make_response,
    g,
)

from ...auth import (
    build_auth_url,
    exchange_code_for_token,
    decode_id_token,
    get_or_create_user_from_claims,
    create_session_for_user,
    generate_oauth_state,
    oauth_state_matches,
    session_cookie_secure,
    SESSION_COOKIE_NAME,
    OAUTH_STATE_COOKIE_NAME,
    OAUTH_STATE_MAX_AGE_SECONDS,
)

from ..utils.db_utils import db_cursor
from ..utils.api_errors import ValidationError, handle_api_errors
from ..utils.auth_decorators import login_required

# Blueprint de autenticación
# OJO: SIN url_prefix, así las rutas públicas son exactamente las que declaramos abajo.
auth_bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def _request_object():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValidationError(
            "El cuerpo de la solicitud debe ser un objeto JSON.",
        )
    return data


def _text_field(data, field, max_length, required=False, lower=False):
    value = data.get(field, "")
    if value is None:
        value = ""
    if not isinstance(value, str):
        raise ValidationError(
            "El valor indicado no tiene un formato válido.",
            extra={"field": field},
        )

    value = value.strip()
    if required and not value:
        raise ValidationError(
            "Debe completar este campo.",
            extra={"field": field},
        )
    if len(value) > max_length:
        raise ValidationError(
            "El valor indicado supera el largo permitido.",
            extra={"field": field, "max_length": max_length},
        )
    return value.lower() if lower else value


def _frontend_login_redirect(code, message, email=None):
    """
    Devuelve los errores OAuth al login React en lugar de mostrar texto/HTML
    crudo desde Flask.

    En desarrollo el frontend vive en localhost:3000. En producción, Point 9
    definirá FRONTEND_LOGIN_URL con la URL pública definitiva.
    """
    base_url = os.getenv(
        "FRONTEND_LOGIN_URL",
        "http://localhost:3000/login",
    ).strip()

    params = {
        "auth_status": "error",
        "auth_code": code,
        "auth_message": message,
    }
    if email:
        params["auth_email"] = email

    separator = "&" if "?" in base_url else "?"
    return redirect(
        "{}{}{}".format(
            base_url,
            separator,
            urlencode(params),
        )
    )


def _business_auth_error_code(message):
    normalized = str(message or "").casefold()

    if "dominio permitido" in normalized:
        return "EXTERNAL_DOMAIN"
    if "no existe una cuenta registrada" in normalized:
        return "ACCESS_REQUIRED"
    if "aún no ha sido aprobada" in normalized:
        return "ACCESS_PENDING"
    if "aun no ha sido aprobada" in normalized:
        return "ACCESS_PENDING"
    if "deshabilitada" in normalized:
        return "ACCOUNT_DISABLED"

    return "ACCESS_DENIED"


def _clear_oauth_state(response):
    response.delete_cookie(
        OAUTH_STATE_COOKIE_NAME,
        path="/auth",
        secure=session_cookie_secure(),
        httponly=True,
        samesite="Lax",
    )
    return response


def _oauth_login_redirect(code, message, email=None):
    return _clear_oauth_state(
        _frontend_login_redirect(code, message, email=email)
    )


@auth_bp.route("/auth/login", methods=["GET"])
def auth_login():
    """
    Inicia el flujo de login con Google.

    Ejemplo de uso:
      GET http://localhost:5000/auth/login

    Resultado esperado:
      - Respuesta 302 (redirect) hacia la página de login de Google.
    """
    state = generate_oauth_state()
    response = redirect(build_auth_url(state))
    response.set_cookie(
        OAUTH_STATE_COOKIE_NAME,
        state,
        max_age=OAUTH_STATE_MAX_AGE_SECONDS,
        httponly=True,
        secure=session_cookie_secure(),
        samesite="Lax",
        path="/auth",
    )
    return response


@auth_bp.route("/auth/callback", methods=["GET"])
def auth_callback():
    """
    Callback OAuth de Google.

    CORE-08B-1:
    - los errores esperables vuelven al login React con feedback visible;
    - no se muestran excepciones internas ni texto crudo al usuario;
    - el login exitoso conserva el flujo existente.
    """
    received_state = request.args.get("state")
    expected_state = request.cookies.get(OAUTH_STATE_COOKIE_NAME)
    if not oauth_state_matches(expected_state, received_state):
        return _oauth_login_redirect(
            "INVALID_OAUTH_STATE",
            "La solicitud de inicio de sesión expiró o no es válida. Intenta nuevamente.",
        )

    error = request.args.get("error")
    if error:
        return _oauth_login_redirect(
            "GOOGLE_AUTH_ERROR",
            "No fue posible completar el inicio de sesión con Google.",
        )

    code = request.args.get("code")
    if not code:
        return _oauth_login_redirect(
            "MISSING_AUTH_CODE",
            "Google no entregó la información necesaria para iniciar sesión.",
        )

    claims = {}

    try:
        token_data = exchange_code_for_token(code)
        id_token = token_data.get("id_token")

        if not id_token:
            return _oauth_login_redirect(
                "MISSING_ID_TOKEN",
                "No fue posible validar tu identidad con Google.",
            )

        claims = decode_id_token(id_token)

        user = get_or_create_user_from_claims(claims)

        from flask import redirect as flask_redirect

        resp = flask_redirect("/")
        resp = create_session_for_user(user["id"], resp)
        return _clear_oauth_state(resp)

    except ValueError as exc:
        message = str(exc)
        return _oauth_login_redirect(
            _business_auth_error_code(message),
            message,
            email=claims.get("email"),
        )

    except Exception as exc:
        print(
            "[AUTH CALLBACK ERROR]",
            type(exc).__name__,
            str(exc),
        )
        return _oauth_login_redirect(
            "LOGIN_ERROR",
            (
                "No fue posible completar el inicio de sesión. "
                "Intenta nuevamente."
            ),
            email=claims.get("email"),
        )


@auth_bp.route("/api/auth/me", methods=["GET"])
@handle_api_errors
@login_required
def auth_me():
    """
    Devuelve información del usuario autenticado.

    - Usa el decorador @login_required → si no hay sesión válida, se lanza AuthError
      y @handle_api_errors lo convierte en un JSON 401.

    Ejemplo:
      GET http://localhost:5000/api/auth/me

    Respuesta (200) si está logueado:
      {
        "authenticated": true,
        "id": 1,
        "full_name": "Usuario Estudiante 1",
        "email": "student1@inf.udec.cl",
        "role_id": 2
      }

    Respuesta (401) si NO está logueado:
      {
        "error": {
          "message": "Debes iniciar sesión para acceder a este recurso.",
          "code": "UNAUTHENTICATED"
        }
      }
    """
    user = g.current_user  # seteado por @login_required

    return jsonify(
        {
            "authenticated": True,
            "id": user["id"],
            "full_name": user.get("full_name"),
            "email": user.get("email"),
            "role_id": user.get("role_id"),
        }
    ), 200


@auth_bp.route("/api/public/access-requests", methods=["POST"])
@handle_api_errors
def public_create_access_request():
    """
    Endpoint PÚBLICO (sin autenticación) para crear una solicitud de acceso.

    Reglas actuales:
      - Sólo acepta correos @udec.cl (NO @inf.udec.cl).
      - Si es @inf.udec.cl → debe entrar con Google, no por este formulario.
      - Si ya existe un usuario activo con ese correo → no permite nueva solicitud.
      - Si ya existe una solicitud PENDING → no permite duplicar.

    Ejemplo de request:
      POST http://localhost:5000/api/public/access-requests
      Content-Type: application/json

      {
        "full_name": "Juan Pérez",
        "email": "juan.perez@udec.cl",
        "professor_email": "profesor@inf.udec.cl",
        "course_code": "INF-123",
        "message": "Quiero usar Performance System en mi curso."
      }

    Respuesta exitosa (201):
      {
        "id": 10,
        "status": "PENDING",
        "user_id": 42,
        "professor_email": "profesor@inf.udec.cl",
        "course_code": "INF-123",
        "message": "Quiero usar Performance System en mi curso.",
        "created_at": "2025-11-19T22:10:00.123456"
      }

    Respuestas 400 típicas (ValidationError):
      {
        "error": {
          "message": "Debe indicar el correo.",
          "code": "VALIDATION_ERROR",
          "field": "email"
        }
      }
    """
    data = _request_object()

    full_name = _text_field(data, "full_name", 200, required=True)
    email = _text_field(
        data,
        "email",
        320,
        required=True,
        lower=True,
    )
    professor_email = _text_field(
        data,
        "professor_email",
        320,
        required=True,
        lower=True,
    )
    course_code = _text_field(data, "course_code", 80)
    message = _text_field(data, "message", 2000)

    # Validaciones básicas
    if not EMAIL_RE.fullmatch(email):
        raise ValidationError(
            "Debe indicar un correo institucional válido.",
            extra={"field": "email"},
        )
    if not EMAIL_RE.fullmatch(professor_email):
        raise ValidationError(
            "Debe indicar un correo válido para el profesor responsable.",
            extra={"field": "professor_email"},
        )

    domain = email.split("@")[-1]

    # Reglas de negocio de dominios
    if domain == "inf.udec.cl":
        raise ValidationError(
            (
                "Si tienes correo @inf.udec.cl puedes ingresar directamente usando "
                "'Continuar con Google', no necesitas solicitar acceso."
            ),
            extra={"field": "email"},
        )

    if domain != "udec.cl":
        raise ValidationError(
            "Este formulario es sólo para correos institucionales @udec.cl.",
            extra={"field": "email"},
        )

    # Uso del helper de BD con RealDictCursor y manejo de commit/rollback
    with db_cursor() as (conn, cur):
        # 1) Buscar usuario por email
        cur.execute("SELECT * FROM users WHERE email = %s;", (email,))
        user = cur.fetchone()

        # 2) Asegurar rol 'Student' (por defecto)
        cur.execute("SELECT id FROM roles WHERE name = %s;", ("Student",))
        role = cur.fetchone()
        if role is None:
            cur.execute(
                """
                INSERT INTO roles (name, description)
                VALUES (%s, %s)
                RETURNING id;
                """,
                ("Student", "Rol estudiante por defecto"),
            )
            role = cur.fetchone()

        role_id = role["id"]

        # 3) Crear usuario inactivo si no existe
        if user is None:
            cur.execute(
                """
                INSERT INTO users (full_name, email, role_id, is_active, created_at)
                VALUES (%s, %s, %s, FALSE, NOW())
                RETURNING *;
                """,
                (full_name, email, role_id),
            )
            user = cur.fetchone()
        else:
            # Si el usuario ya está activo, no tiene sentido solicitar acceso
            if user.get("is_active"):
                raise ValidationError(
                    (
                        "Este correo ya tiene acceso activo al sistema. "
                        "Puedes ingresar usando 'Continuar con Google'."
                    ),
                    extra={"field": "email"},
                )

        user_id = user["id"]

        # 4) Verificar si ya existe una solicitud pendiente
        cur.execute(
            """
            SELECT id, status
            FROM access_requests
            WHERE user_id = %s AND status = 'PENDING';
            """,
            (user_id,),
        )
        existing = cur.fetchone()
        if existing:
            raise ValidationError(
                "Ya existe una solicitud pendiente para este correo.",
                extra={
                    "request_id": existing["id"],
                    "status": existing["status"],
                },
            )

        # 5) Crear la solicitud
        cur.execute(
            """
            INSERT INTO access_requests
            (user_id, status, requested_role_id, professor_email, course_code, message, created_at)
            VALUES (%s, 'PENDING', %s, %s, %s, %s, NOW())
            RETURNING *;
            """,
            (user_id, role_id, professor_email, course_code, message),
        )
        new_request = cur.fetchone()

        # db_cursor hace commit automáticamente si no hay excepción

        return jsonify(
            {
                "id": new_request["id"],
                "status": new_request["status"],
                "user_id": user_id,
                "professor_email": new_request.get("professor_email"),
                "course_code": new_request.get("course_code"),
                "message": new_request.get("message"),
                "created_at": (
                    new_request["created_at"].isoformat()
                    if new_request.get("created_at")
                    else None
                ),
            }
        ), 201


@auth_bp.route("/api/audit-log", methods=["POST"])
@handle_api_errors
@login_required
def create_audit_log_entry():
    """
    Crea un registro en la tabla audit_log asociado al usuario actual.

    Uso típico:
      - El frontend registra acciones importantes:
        - ver perfil
        - crear submission
        - re-ejecutar medición
        - etc.

    Ejemplo de request:
      POST http://localhost:5000/api/audit-log
      Content-Type: application/json
      Cookie: session_id=...

      {
        "action": "view_profile",
        "description": "El usuario abrió la pantalla 'Mi Perfil'."
      }

    Respuesta (201):
      {
        "id": 123,
        "user_id": 42,
        "action": "view_profile",
        "description": "El usuario abrió la pantalla 'Mi Perfil'.",
        "created_at": "2025-11-19T22:40:00.123456"
      }

    Errores 400 (ValidationError):
      {
        "error": {
          "message": "Debe indicar la acción a registrar.",
          "code": "VALIDATION_ERROR",
          "field": "action"
        }
      }
    """
    user = g.current_user
    data = _request_object()

    action = _text_field(data, "action", 100, required=True)
    description = _text_field(data, "description", 2000) or None

    with db_cursor() as (conn, cur):
        cur.execute(
            """
            INSERT INTO audit_log (user_id, action, description, created_at)
            VALUES (%s, %s, %s, NOW())
            RETURNING *;
            """,
            (user["id"], action, description),
        )
        row = cur.fetchone()

        return jsonify(
            {
                "id": row["id"],
                "user_id": row.get("user_id"),
                "action": row.get("action"),
                "description": row.get("description"),
                "created_at": (
                    row["created_at"].isoformat()
                    if row.get("created_at")
                    else None
                ),
            }
        ), 201


@auth_bp.route("/api/auth/logout", methods=["POST"])
@auth_bp.route("/auth/logout", methods=["POST"])
@handle_api_errors
def auth_logout():
    """
    Cierra la sesión de forma idempotente.

    CORE-08B-1:
    - mantiene /api/auth/logout como endpoint canónico;
    - conserva /auth/logout como alias de compatibilidad;
    - invalida la sesión en PostgreSQL cuando existe;
    - elimina siempre la cookie, incluso si la sesión ya expiró/no existe.
    """
    session_id = request.cookies.get(SESSION_COOKIE_NAME)

    if session_id:
        with db_cursor() as (conn, cur):
            cur.execute(
                """
                UPDATE sessions
                SET is_active = FALSE
                WHERE id = %s;
                """,
                (session_id,),
            )

    resp = jsonify(
        {
            "message": "Sesión cerrada correctamente.",
            "code": "LOGOUT_OK",
        }
    )
    resp.delete_cookie(
        SESSION_COOKIE_NAME,
        path="/",
        secure=session_cookie_secure(),
        httponly=True,
        samesite="Lax",
    )
    return resp, 200
