# server/webapp/utils/auth_decorators.py

from functools import wraps
from flask import g

from .api_errors import AuthError, ForbiddenError
from ...auth import get_current_user


def login_required(fn):
    """
    Decorador para exigir usuario autenticado.

    - Usa get_current_user() para leer la cookie 'session_id' y buscar el usuario.
    - Si no hay sesión o es inválida → AuthError(401).
    - Si hay, guarda el usuario en flask.g.current_user.

    Ejemplo:

    @some_bp.route("/api/profile", methods=["GET"])
    @login_required
    def profile():
        user = g.current_user
        ...
    """

    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = get_current_user()
        if not user:
            raise AuthError("Debes iniciar sesión para acceder a este recurso.")

        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper


def admin_required(fn):
    """
    Decorador para exigir que el usuario tenga rol 'Admin'.

    ⚠ IMPORTANTE:
    - Actualmente se verifica por role_id (numérico).
    - Ajusta ADMIN_ROLE_ID según tu BD (ej: 2 si tu Admin tiene id=2).

    Idealmente en el futuro podemos verificar por nombre de rol ('Admin'),
    pero para esta versión basta con el ID.
    """

    @wraps(fn)
    def wrapper(*args, **kwargs):
        # Reutilizar g.current_user si ya lo puso @login_required
        user = getattr(g, "current_user", None)
        if not user:
            user = get_current_user()

        if not user:
            # No hay sesión
            raise AuthError("Debes iniciar sesión para acceder a este recurso.")

        role_id = user.get("role_id")

        # ⬇️ Ajusta ESTE valor según tu BD
        ADMIN_ROLE_ID = 2  # antes estaba en 1

        if role_id != ADMIN_ROLE_ID:
            raise ForbiddenError("No tienes permisos para acceder a esta sección.")

        # Nos aseguramos de que g.current_user esté seteado
        g.current_user = user
        return fn(*args, **kwargs)

    return wrapper
