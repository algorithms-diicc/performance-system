# server/webapp/routes/auth_routes.py

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
)

from ..utils.db_utils import db_cursor
from ..utils.api_errors import ValidationError, handle_api_errors
from ..utils.auth_decorators import login_required

# Blueprint de autenticación
# OJO: SIN url_prefix, así las rutas públicas son exactamente las que declaramos abajo.
auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/auth/login", methods=["GET"])
def auth_login():
    """
    Inicia el flujo de login con Google.

    Ejemplo de uso:
      GET http://localhost:5000/auth/login

    Resultado esperado:
      - Respuesta 302 (redirect) hacia la página de login de Google.
    """
    login_url = build_auth_url()
    print("➡️ Redirigiendo a Google login:", login_url)
    return redirect(login_url)


@auth_bp.route("/auth/callback", methods=["GET"])
def auth_callback():
    """
    Endpoint de callback para Google OAuth.

    Google redirige a esta URL después del login:
      /auth/callback?code=...&state=...

    Flujo:
      1. Lee 'code' de la query.
      2. Llama a exchange_code_for_token(code).
      3. Decodifica id_token con decode_id_token.
      4. Busca o crea usuario en BD con get_or_create_user_from_claims.
      5. Crea sesión y setea cookie 'session_id'.
      6. Redirige al frontend (por ahora '/').

    Ejemplo de prueba rápida:
      - No se prueba directamente con Postman.
      - El frontend llama a /auth/login, Google redirige de vuelta a /auth/callback.
    """
    error = request.args.get("error")
    if error:
        error_description = request.args.get("error_description", "")
        print("❌ Error devuelto por Google:", error, error_description)
        return make_response(
            f"Error en login de Google: {error} - {error_description}", 400
        )

    code = request.args.get("code")
    if not code:
        print("❌ Falta parámetro 'code' en /auth/callback")
        return make_response("Falta parámetro 'code' en callback", 400)

    try:
        # 1) Intercambiar code por tokens
        token_data = exchange_code_for_token(code)
        id_token = token_data.get("id_token")
        if not id_token:
            print("❌ No se recibió id_token desde Google")
            return make_response("No se recibió id_token desde Google", 400)

        # 2) Decodificar id_token
        claims = decode_id_token(id_token)
        print("✅ Claims decodificados:", claims)

        # 3) Obtener o crear usuario en BD (según reglas INF/UDEC)
        user = get_or_create_user_from_claims(claims)
        print("✅ Usuario en BD:", user)

        # 4) Crear sesión y setear cookie
        from flask import redirect as flask_redirect

        resp = flask_redirect("/")  # o la ruta del frontend (ej: "/app")
        resp = create_session_for_user(user["id"], resp)

        print("✅ Sesión creada y cookie seteada")
        return resp

    except ValueError as ve:
        # Errores de negocio (dominios no permitidos, cuenta inactiva, etc.)
        print("⚠️ Error de negocio en /auth/callback:", ve)
        return make_response(str(ve), 403)

    except Exception as e:
        print("❌ Error en /auth/callback:", e)
        return make_response(f"Error en el proceso de login: {str(e)}", 500)


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
    data = request.get_json(silent=True) or {}

    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    professor_email = data.get("professor_email", "").strip()
    course_code = data.get("course_code", "").strip()
    message = data.get("message", "").strip()

    # Validaciones básicas
    if not full_name:
        raise ValidationError(
            "Debe indicar el nombre completo.",
            extra={"field": "full_name"},
        )
    if not email:
        raise ValidationError(
            "Debe indicar el correo.",
            extra={"field": "email"},
        )
    if not professor_email:
        raise ValidationError(
            "Debe indicar el correo del profesor responsable.",
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
    data = request.get_json(silent=True) or {}

    action = data.get("action", "").strip()
    description = data.get("description", "").strip() or None

    if not action:
        raise ValidationError(
            "Debe indicar la acción a registrar.",
            extra={"field": "action"},
        )

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
@handle_api_errors
@login_required
def auth_logout():
    """
    Cierra la sesión actual del usuario.

    Qué hace:
      - Lee la cookie 'session_id'.
      - Marca la sesión como inactiva en la tabla 'sessions' (is_active = FALSE).
      - Elimina la cookie en la respuesta (expira inmediatamente).

    Ejemplo de uso (Postman / frontend):
      POST http://localhost:5000/api/auth/logout
      Headers:
        Cookie: session_id=<valor_actual>

    Respuesta (200) típica:
      {
        "message": "Sesión cerrada correctamente.",
        "code": "LOGOUT_OK"
      }

    Si ya no había cookie o la sesión no existía:
      {
        "message": "No había sesión activa.",
        "code": "NO_ACTIVE_SESSION"
      }
    """
    # 1) Leer el session_id de la cookie
    session_id = request.cookies.get("session_id")

    if not session_id:
        # No hay cookie → para el backend ya está "deslogueado"
        resp = jsonify(
            {
                "message": "No había sesión activa.",
                "code": "NO_ACTIVE_SESSION",
            }
        )
        # Aun así, nos aseguramos de limpiar la cookie por si acaso
        resp.set_cookie("session_id", "", expires=0)
        return resp, 200

    # 2) Marcar la sesión como inactiva en BD
    with db_cursor() as (conn, cur):
        cur.execute(
            """
            UPDATE sessions
            SET is_active = FALSE
            WHERE id = %s;
            """,
            (session_id,),
        )

    # 3) Construir respuesta y limpiar cookie
    resp = jsonify(
        {
            "message": "Sesión cerrada correctamente.",
            "code": "LOGOUT_OK",
        }
    )
    # Expirar cookie en el navegador
    resp.set_cookie("session_id", "", expires=0)

    return resp, 200
