# server/webapp/utils/auth_decorators.py

from functools import wraps
from flask import g

from .api_errors import AuthError, ForbiddenError
from ...auth import get_current_user
from ...db_connection import get_connection


def get_user_role_name(user):
    """
    Devuelve el nombre canónico del rol de un usuario autenticado.

    CORE-07F-3:
    - evita depender de IDs numéricos hardcodeados;
    - reutiliza role_name si el objeto de sesión ya lo incluye;
    - si no, resuelve users.role_id -> roles.name.
    """
    if not user:
        return None

    role_name = user.get("role_name")
    if role_name:
        return str(role_name)

    role_id = user.get("role_id")
    if role_id is None:
        return None

    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name FROM roles WHERE id = %s;",
                (role_id,),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return None

    if isinstance(row, dict):
        return row.get("name")

    return row[0]


def login_required(fn):
    """
    Exige un usuario autenticado y lo deja en flask.g.current_user.
    """

    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            raise AuthError(
                "Debes iniciar sesión para acceder a este recurso."
            )

        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def role_required(*allowed_role_names):
    """
    Factory de autorización por nombre de rol.

    Ejemplo:
        @role_required("Teacher", "Admin")
    """
    allowed = {
        str(role_name).strip().casefold()
        for role_name in allowed_role_names
        if str(role_name).strip()
    }

    if not allowed:
        raise ValueError("role_required necesita al menos un rol.")

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = getattr(g, "current_user", None)
            if not user:
                user = get_current_user()

            if not user:
                raise AuthError(
                    "Debes iniciar sesión para acceder a este recurso."
                )

            role_name = get_user_role_name(user)
            if not role_name or role_name.casefold() not in allowed:
                raise ForbiddenError(
                    "No tienes permisos para acceder a esta sección."
                )

            g.current_user = user
            g.current_role_name = role_name
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def admin_required(fn):
    """Exige el rol Admin sin depender de ADMIN_ROLE_ID."""
    return role_required("Admin")(fn)


def teacher_or_admin_required(fn):
    """Permite supervisión académica a Teacher y administración global a Admin."""
    return role_required("Teacher", "Admin")(fn)
