import os
import uuid
from datetime import datetime, timedelta

import requests
import jwt
from jwt import PyJWKClient
from flask import request

from dotenv import load_dotenv
from .db_connection import get_connection  # función para abrir conexión a PostgreSQL


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


def build_auth_url():
    """
    Construye la URL a la que redirigimos al usuario para que se loguee con Google.

    Se usa en la ruta /auth/login:
    - Armamos la URL con client_id, redirect_uri, scopes, etc.
    - Hacemos redirect(login_url).
    """
    state = str(uuid.uuid4())  # opcional para proteger contra ataques CSRF
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
    resp = requests.post(TOKEN_URL, data=data)
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
    """
    A partir del id_token (claims), busca o crea el usuario en la BD.

    Reglas de negocio:
    - @inf.udec.cl:
        - Si no existe el usuario -> se crea con rol Student e is_active = TRUE.
        - Si existe y is_active = TRUE -> se permite login.
        - Si existe y is_active = FALSE -> se rechaza (usuario deshabilitado por admin).
    - @udec.cl:
        - NO se crea usuario aquí.
        - Si no existe usuario -> se rechaza login (debe solicitar acceso con el formulario).
        - Si existe pero is_active = FALSE -> se rechaza login (solicitud pendiente o rechazada).
        - Si existe y is_active = TRUE -> se permite login.
    - Otros dominios -> se rechaza.
    """
    email = claims.get("email") or claims.get("preferred_username")
    name = claims.get("name", "Sin nombre")
    subject = claims.get("sub")  # identificador único del usuario en Google

    if not email:
        raise ValueError("El token no contiene un email válido")

    domain = email.split("@")[-1]

    conn = get_connection()
    cur = conn.cursor()

    # Buscar usuario por email
    cur.execute("SELECT * FROM users WHERE email = %s;", (email,))
    user = cur.fetchone()

    if domain == "inf.udec.cl":
        # Caso 1: alumno de INF
        if user is None:
            # Asegurar rol Student
            cur.execute("SELECT id FROM roles WHERE name = %s;", ("Student",))
            role = cur.fetchone()
            if role is None:
                cur.execute(
                    "INSERT INTO roles (name, description) VALUES (%s, %s) RETURNING id;",
                    ("Student", "Rol estudiante por defecto"),
                )
                role = cur.fetchone()

            if role is None:
                conn.close()
                raise RuntimeError("No se pudo obtener/crear el rol 'Student'")

            role_id = role["id"]

            # Crear usuario activo
            cur.execute(
                """
                INSERT INTO users (full_name, email, role_id, is_active, created_at)
                VALUES (%s, %s, %s, TRUE, NOW())
                RETURNING *;
                """,
                (name, email, role_id),
            )
            user = cur.fetchone()
        else:
            # Usuario INF ya existía: si está desactivado, no puede entrar
            if not user.get("is_active"):
                conn.close()
                raise ValueError("Tu cuenta institucional ha sido deshabilitada. Contacta al administrador.")

    elif domain == "udec.cl":
        # Caso 2: usuario de otra carrera / UdeC
        # Aquí NO se crean usuarios. Deben existir previamente tras enviar formulario.
        if user is None:
            conn.close()
            raise ValueError(
                "No existe una cuenta registrada para este correo. "
                "Debes solicitar acceso con el formulario de la página de login."
            )

        if not user.get("is_active"):
            conn.close()
            raise ValueError(
                "Tu cuenta aún no ha sido aprobada por el profesor. "
                "Espera el correo de confirmación para poder ingresar."
            )

        # Si existe y está activa, seguimos y creamos/actualizamos la identidad externa

    else:
        conn.close()
        raise ValueError("Correo no pertenece a un dominio permitido")

    # En este punto user existe y está activo
    user_id = user["id"]

    # 2) Registrar/actualizar identidad externa (Google OAuth)
    cur.execute(
        """
        SELECT * FROM auth_identities
        WHERE provider = %s AND provider_subject = %s;
        """,
        (PROVIDER_NAME, subject),
    )
    identity = cur.fetchone()

    if identity is None:
        cur.execute(
            """
            INSERT INTO auth_identities
            (user_id, provider, provider_subject, email_verified, created_at, last_used_at)
            VALUES (%s, %s, %s, TRUE, NOW(), NOW());
            """,
            (user_id, PROVIDER_NAME, subject),
        )
    else:
        cur.execute(
            """
            UPDATE auth_identities
            SET last_used_at = NOW()
            WHERE id = %s;
            """,
            (identity["id"],),
        )

    # 3) Actualizar last_login
    cur.execute(
        """
        UPDATE users
        SET last_login = NOW()
        WHERE id = %s;
        """,
        (user_id,),
    )

    conn.commit()
    cur.close()
    conn.close()

    return user


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

    # Configurar cookie segura (en producción: secure=True con HTTPS)
    response.set_cookie(
        "session_id",
        session_id,
        httponly=True,
        secure=False,  # TODO: cambiar a True en producción con HTTPS
        samesite="Lax",
        expires=expires_at,
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
    session_id = request.cookies.get("session_id")
    if not session_id:
        return None

    conn = get_connection()
    cur = conn.cursor()

    cur.execute(
        """
        SELECT s.id as session_id, s.expires_at, u.*
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.id = %s AND s.is_active = TRUE;
        """,
        (session_id,),
    )
    row = cur.fetchone()
    cur.close()
    conn.close()

    if not row:
        return None

    # Podrías validar acá que expires_at > NOW() si quieres
    return row
