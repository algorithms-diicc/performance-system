# server/webapp/utils/api_errors.py
from flask import jsonify
from functools import wraps


class APIError(Exception):
    """
    Error base para la API.

    - message: texto para el cliente.
    - status_code: HTTP status (400, 401, 403, 404, 500, etc.).
    - code: código interno corto, útil para el frontend (ej: 'VALIDATION_ERROR').
    - extra: dict opcional con más detalles.
    """

    def __init__(self, message, status_code=400, code="API_ERROR", extra=None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.extra = extra or {}

    def to_response(self):
        """
        Convierte el error en una respuesta JSON estándar.

        Ejemplo de respuesta:
        {
          "error": {
            "message": "Debe indicar el correo.",
            "code": "VALIDATION_ERROR",
            "field": "email"
          }
        }
        """
        payload = {
            "error": {
                "message": self.message,
                "code": self.code,
                **self.extra,
            }
        }
        return jsonify(payload), self.status_code


class ValidationError(APIError):
    def __init__(self, message, extra=None):
        super().__init__(
            message,
            status_code=400,
            code="VALIDATION_ERROR",
            extra=extra,
        )


class BadRequestError(ValidationError):
    """
    Alias semántico de ValidationError.

    Útil cuando quieres expresar que la solicitud es incorrecta
    (parámetros inválidos, formato incorrecto, etc.).
    """
    pass


class AuthError(APIError):
    def __init__(self, message="No autenticado."):
        super().__init__(
            message,
            status_code=401,
            code="UNAUTHENTICATED",
        )


class ForbiddenError(APIError):
    def __init__(self, message="No autorizado."):
        super().__init__(
            message,
            status_code=403,
            code="FORBIDDEN",
        )


class NotFoundError(APIError):
    def __init__(self, message="Recurso no encontrado."):
        super().__init__(
            message,
            status_code=404,
            code="NOT_FOUND",
        )


def handle_api_errors(fn):
    """
    Decorador genérico para manejar errores de forma consistente en endpoints.

    Uso típico:

        from ..utils.api_errors import handle_api_errors, BadRequestError

        @bp.route("/api/demo", methods=["GET"])
        @handle_api_errors
        def demo():
            if algo_mal:
                raise BadRequestError("Parámetro X es obligatorio.")
            return jsonify({"ok": True})

    - Si se lanza un APIError (o subclase) → se devuelve su JSON con status_code.
    - Si se lanza otra Exception → se loguea y se devuelve 500 genérico.
    """

    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except APIError as e:
            # Errores esperables de negocio / validación
            return e.to_response()
        except Exception as e:
            # Errores inesperados
            print(f"[API ERROR] {fn.__name__}: {type(e).__name__}: {e}")
            payload = {
                "error": {
                    "message": "Error interno del servidor.",
                    "code": "INTERNAL_ERROR",
                }
            }
            return jsonify(payload), 500

    return wrapper
