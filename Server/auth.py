import os
import secrets
import uuid
from datetime import datetime, timedelta

import requests
import jwt
from jwt import PyJWKClient
from flask import request

from dotenv import load_dotenv
from .db_connection import get_connection  # función para abrir conexión a PostgreSQL
from .webapp.services.account_identity_service import (
    account_email_domain,
    normalize_account_email,
)


# =========================
# Cargar variables de entorno (.env)
# =========================

# BASE_DIR apunta a la carpeta raíz del proyecto (.../performance-system)
BASE_DIR = os.path.dirname(os.path.dirname(__file__))

# Ruta absoluta al archivo .env
dotenv_path = os.path.join(BASE_DIR, ".env")

# Carga las variables de .env al entorno (os.environ)
load_dotenv(dotenv_path)


# =========================
# Configuración de Google OAuth desde .env
# =========================

# ID de la app registrada en Google Cloud (client_id)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

# Secreto de cliente generado en Google Cloud
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

# URL de callback registrada en Google (debe coincidir exactamente)
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:5000/auth/callback",
)

# Scopes que se piden a Google (identidad + email + perfil)
GOOGLE_SCOPES = os.getenv("GOOGLE_SCOPES", "openid email profile")
OAUTH_HTTP_TIMEOUT_SECONDS = max(
    1,
    int(os.getenv("OAUTH_HTTP_TIMEOUT_SECONDS", "10")),
)

SESSION_COOKIE_NAME = "session_id"
OAUTH_STATE_COOKIE_NAME = "oauth_state"
OAUTH_STATE_MAX_AGE_SECONDS = max(
    60,
    int(os.getenv("OAUTH_STATE_MAX_AGE_SECONDS", "600")),
)

# Dominios permitidos para los correos (política de negocio tuya)
ALLOWED_DOMAINS = [
    d
    for d in [
        os.getenv("ALLOWED_DOMAIN_INF"),
        os.getenv("ALLOWED_DOMAIN_UDEC"),
    ]
    if d
]

# Nombre del proveedor en la tabla auth_identities
PROVIDER_NAME = "google_oauth"

# URLs de los endpoints de Google OAuth / OpenID Connect
AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"


def _env_flag(name, default=False):
    raw = os.getenv(name)
    if raw is None:
        return bool(default)
    return raw.strip().casefold() in {"1", "true", "yes", "on"}


def session_cookie_secure():
    """HTTPS se habilita en Point 9; esta bandera permite activarlo sin código."""
    return _env_flag("SESSION_COOKIE_SECURE", False)


def generate_oauth_state():
    return secrets.token_urlsafe(32)


def oauth_state_matches(expected, received):
    expected = str(expected or "")
    received = str(received or "")
    return bool(
        expected
        and received
        and secrets.compare_digest(expected, received)
    )


def build_auth_url(state):
    """
    Construye la URL a la que redirigimos al usuario para que se loguee con Google.

    Se usa en la ruta /auth/login:
    - Armamos la URL con client_id, redirect_uri, scopes, etc.
    - Hacemos redirect(login_url).
    """
    if not state:
        raise ValueError("OAuth state es obligatorio.")
    import urllib.parse

    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "response_type": "code",        # Authorization Code Flow → pedimos 'code'
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "scope": GOOGLE_SCOPES,
        "state": state,
        # Parámetros extra recomendados para Google
        "access_type": "offline",              # para obtener refresh_token
        "include_granted_scopes": "true",
        # "prompt": "consent",                  # opcional: forzar consentimiento siempre
    }
    return AUTH_URL + "?" + urllib.parse.urlencode(params)


def exchange_code_for_token(code: str):
    """
    Intercambia el 'code' recibido en /auth/callback por tokens en Google.

    Flujo:
    - Google redirige a /auth/callback?code=...
    - En el backend llamamos a este método con ese 'code'.
    - Google devuelve JSON con id_token, access_token, refresh_token, etc.
    """
    data = {
        "client_id": GOOGLE_CLIENT_ID,
        "client_secret": GOOGLE_CLIENT_SECRET,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": GOOGLE_REDIRECT_URI,
    }
    resp = requests.post(
        TOKEN_URL,
        data=data,
        timeout=OAUTH_HTTP_TIMEOUT_SECONDS,
    )
    resp.raise_for_status()  # lanza excepción si la respuesta es 4xx/5xx
    return resp.json()


def decode_id_token(id_token: str):
    """
    Decodifica y valida el id_token (JWT) usando las claves públicas (JWKS) de Google.

    - Verifica la firma del token.
    - Verifica que la audiencia ('aud') sea tu GOOGLE_CLIENT_ID.
    - Verifica la expiración del token.

    Devuelve un diccionario 'claims' con los datos del usuario (email, name, etc.).
    """
    jwks_client = PyJWKClient(JWKS_URL)
    signing_key = jwks_client.get_signing_key_from_jwt(id_token).key

    decoded = jwt.decode(
        id_token,
        signing_key,
        algorithms=["RS256"],
        audience=GOOGLE_CLIENT_ID,
        options={"verify_exp": True},
    )
    return decoded



def get_or_create_user_from_claims(claims: dict):
    # Google autentica la identidad. PostgreSQL autoriza el acceso.
    raw_email = (
        claims.get("email")
        or claims.get("preferred_username")
    )
    name = str(
        claims.get("name") or "Sin nombre"
    ).strip()[:100] or "Sin nombre"
    subject = str(
        claims.get("sub") or ""
    ).strip()

    try:
        email = normalize_account_email(
            raw_email
        )
    except ValueError:
        raise ValueError(
            "El token no contiene un email válido."
        )

    if not subject:
        raise ValueError(
            "El token no contiene una identidad Google válida."
        )

    domain = account_email_domain(email)

    conn = get_connection()
    cur = conn.cursor()

    try:
        # Compatibilidad con filas históricas: lookup case-insensitive.
        cur.execute(
            """
            SELECT *
            FROM users
            WHERE LOWER(email) = %s
            ORDER BY id
            LIMIT 2;
            """,
            (email,),
        )
        user = cur.fetchone()
        duplicate = cur.fetchone()

        if duplicate is not None:
            raise ValueError(
                "Existe un conflicto de normalización para este correo. "
                "Contacta al administrador."
            )

        if domain == "inf.udec.cl":
            # Acceso INF directo. Si existe una preautorización Teacher,
            # se conserva el rol existente.
            if user is None:
                cur.execute(
                    "SELECT id FROM roles WHERE name = %s;",
                    ("Student",),
                )
                role = cur.fetchone()

                if role is None:
                    cur.execute(
                        """
                        INSERT INTO roles (name, description)
                        VALUES (%s, %s)
                        RETURNING id;
                        """,
                        (
                            "Student",
                            "Rol estudiante por defecto",
                        ),
                    )
                    role = cur.fetchone()

                if role is None:
                    raise RuntimeError(
                        "No se pudo obtener/crear el rol 'Student'."
                    )

                cur.execute(
                    """
                    INSERT INTO users (
                      full_name,
                      email,
                      role_id,
                      is_active,
                      created_at
                    )
                    VALUES (%s, %s, %s, TRUE, NOW())
                    RETURNING *;
                    """,
                    (
                        name,
                        email,
                        role["id"],
                    ),
                )
                user = cur.fetchone()

            elif not user.get("is_active"):
                raise ValueError(
                    "Tu cuenta institucional ha sido deshabilitada. "
                    "Contacta al administrador."
                )

        elif domain == "udec.cl":
            # UdeC exacto: preautorizado o solicitud/aprobación.
            if user is None:
                raise ValueError(
                    "No existe una cuenta registrada para este correo. "
                    "Debes solicitar acceso con el formulario UdeC "
                    "de la página de login."
                )

            if not user.get("is_active"):
                cur.execute(
                    """
                    SELECT id
                    FROM access_requests
                    WHERE user_id = %s
                      AND status = 'PENDING'
                    ORDER BY id DESC
                    LIMIT 1;
                    """,
                    (user["id"],),
                )
                pending = cur.fetchone()

                if pending is not None:
                    raise ValueError(
                        "Tu cuenta aún no ha sido aprobada por el profesor. "
                        "Espera la confirmación para poder ingresar."
                    )

                raise ValueError(
                    "Tu cuenta ha sido deshabilitada. "
                    "Contacta al administrador."
                )

        else:
            # Externo: sólo correo exacto ya preautorizado y activo.
            if user is None:
                raise ValueError(
                    "Esta dirección no está habilitada. "
                    "El acceso externo requiere una invitación previa "
                    "del administrador."
                )

            if not user.get("is_active"):
                raise ValueError(
                    "Tu cuenta ha sido deshabilitada. "
                    "Contacta al administrador."
                )

        user_id = user["id"]

        # Nunca mover silenciosamente un provider_subject entre users.
        cur.execute(
            """
            SELECT *
            FROM auth_identities
            WHERE provider = %s
              AND provider_subject = %s;
            """,
            (PROVIDER_NAME, subject),
        )
        identity = cur.fetchone()

        if identity is not None:
            if int(identity["user_id"]) != int(user_id):
                raise ValueError(
                    "No fue posible vincular esta identidad de Google "
                    "con la cuenta autorizada."
                )

            cur.execute(
                """
                UPDATE auth_identities
                SET last_used_at = NOW()
                WHERE id = %s;
                """,
                (identity["id"],),
            )

        else:
            # Tampoco adjuntar un segundo subject distinto a un user
            # que ya tiene identidad Google vinculada.
            cur.execute(
                """
                SELECT id, provider_subject
                FROM auth_identities
                WHERE provider = %s
                  AND user_id = %s
                ORDER BY id
                LIMIT 1;
                """,
                (PROVIDER_NAME, user_id),
            )
            existing_identity = cur.fetchone()

            if (
                existing_identity is not None
                and str(
                    existing_identity.get(
                        "provider_subject"
                    )
                    or ""
                ) != subject
            ):
                raise ValueError(
                    "No fue posible vincular esta identidad de Google "
                    "con la cuenta autorizada."
                )

            cur.execute(
                """
                INSERT INTO auth_identities (
                  user_id,
                  provider,
                  provider_subject,
                  email_verified,
                  created_at,
                  last_used_at
                )
                VALUES (%s, %s, %s, TRUE, NOW(), NOW());
                """,
                (
                    user_id,
                    PROVIDER_NAME,
                    subject,
                ),
            )

        cur.execute(
            """
            UPDATE users
            SET last_login = NOW()
            WHERE id = %s;
            """,
            (user_id,),
        )

        conn.commit()
        return user

    except Exception:
        conn.rollback()
        raise

    finally:
        cur.close()
        conn.close()

def create_session_for_user(user_id: int, response):
    """
    Crea una sesión en la tabla 'sessions' y configura la cookie 'session_id'
    en la respuesta HTTP.

    Flujo:
    - Después de login exitoso, llamas a esta función con:
        user_id → ID del usuario en tu tabla 'users'
        response → típicamente un redirect("/") al frontend
    - La función:
        - Inserta un registro en 'sessions' con un UUID y fecha de expiración.
        - Añade una cookie 'session_id' a la respuesta.
    """
    conn = get_connection()
    cur = conn.cursor()

    # ID de sesión aleatorio
    session_id = str(uuid.uuid4())
    # Expiración dentro de 7 días (UTC)
    expires_at = datetime.utcnow() + timedelta(days=7)

    cur.execute(
        """
        INSERT INTO sessions (id, user_id, created_at, expires_at, is_active)
        VALUES (%s, %s, NOW(), %s, TRUE);
        """,
        (session_id, user_id, expires_at),
    )

    conn.commit()
    cur.close()
    conn.close()

    # Secure se activa por configuración al desplegar HTTPS en Point 9.
    response.set_cookie(
        SESSION_COOKIE_NAME,
        session_id,
        httponly=True,
        secure=session_cookie_secure(),
        samesite="Lax",
        expires=expires_at,
        path="/",
    )

    return response


def get_current_user():
    """
    Obtiene el usuario autenticado a partir de la cookie 'session_id'.

    Flujo:
    - Lee la cookie 'session_id' del request.
    - Busca la sesión en la tabla 'sessions' y la une con 'users'.
    - Si no existe o está inactiva, devuelve None.
    - Si existe, devuelve la fila combinada (usuario + sesión).
    """
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        return None

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT s.id as session_id, s.expires_at, u.*
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.id = %s
          AND s.is_active = TRUE
          AND s.expires_at > NOW()
          AND u.is_active = TRUE;
        """,
        (session_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return None

    # La consulta ya exige sesión vigente y usuario activo.
    return row
