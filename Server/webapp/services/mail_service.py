"""Correo transaccional mínimo y configurable para Performance System."""

import logging
import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr


LOGGER = logging.getLogger(__name__)

EMAIL_STATUS_SENT = "SENT"
EMAIL_STATUS_FAILED = "FAILED"
EMAIL_STATUS_DISABLED = "DISABLED"

DEFAULT_SMTP_PORT = 587
DEFAULT_SMTP_SECURITY = "starttls"
DEFAULT_SMTP_TIMEOUT_SECONDS = 10
DEFAULT_FROM_NAME = "Performance System"
DEFAULT_FRONTEND_LOGIN_URL = "http://localhost:3000/login"

ENABLED_VALUES = frozenset({"1", "true", "yes", "on"})
SUPPORTED_SECURITY_MODES = frozenset({"starttls", "ssl", "none"})


def _result(status):
    return {
        "sent": status == EMAIL_STATUS_SENT,
        "status": status,
    }


def _positive_integer(value, default):
    try:
        parsed = int(str(value).strip())
    except (TypeError, ValueError):
        return default
    return parsed if parsed > 0 else default


def _configuration(environment):
    host = str(environment.get("SMTP_HOST", "")).strip()
    from_email = str(environment.get("SMTP_FROM_EMAIL", "")).strip()
    security = str(
        environment.get("SMTP_SECURITY", DEFAULT_SMTP_SECURITY)
    ).strip().lower()
    username = str(environment.get("SMTP_USERNAME", "")).strip()
    password = str(environment.get("SMTP_PASSWORD", ""))

    if not host or not from_email:
        raise ValueError("SMTP_HOST y SMTP_FROM_EMAIL son obligatorios.")
    if security not in SUPPORTED_SECURITY_MODES:
        raise ValueError("SMTP_SECURITY no es válido.")
    if bool(username) != bool(password):
        raise ValueError(
            "SMTP_USERNAME y SMTP_PASSWORD deben configurarse juntos."
        )
    if security == "none" and username:
        raise ValueError(
            "SMTP_SECURITY=none no permite autenticación."
        )

    return {
        "host": host,
        "port": _positive_integer(
            environment.get("SMTP_PORT"),
            DEFAULT_SMTP_PORT,
        ),
        "security": security,
        "username": username,
        "password": password,
        "from_email": from_email,
        "from_name": str(
            environment.get("SMTP_FROM_NAME", DEFAULT_FROM_NAME)
        ).strip() or DEFAULT_FROM_NAME,
        "timeout_seconds": _positive_integer(
            environment.get("SMTP_TIMEOUT_SECONDS"),
            DEFAULT_SMTP_TIMEOUT_SECONDS,
        ),
        "login_url": str(
            environment.get(
                "FRONTEND_LOGIN_URL",
                DEFAULT_FRONTEND_LOGIN_URL,
            )
        ).strip() or DEFAULT_FRONTEND_LOGIN_URL,
    }


def _approval_message(*, recipient_name, recipient_email, configuration):
    message = EmailMessage()
    message["Subject"] = (
        "Performance System — solicitud de acceso aprobada"
    )
    message["From"] = formataddr(
        (
            configuration["from_name"],
            configuration["from_email"],
        )
    )
    message["To"] = recipient_email

    greeting_name = str(recipient_name or "").strip() or "estudiante"
    message.set_content(
        "\n".join(
            [
                "Hola, {}.".format(greeting_name),
                "",
                "Tu solicitud de acceso a Performance System fue aprobada.",
                "",
                (
                    "Ya puedes ingresar utilizando \"Continuar con Google\" "
                    "con tu correo institucional {}."
                ).format(recipient_email),
                "",
                configuration["login_url"],
            ]
        )
    )
    return message


def _send_message(
    message,
    configuration,
    *,
    smtp_factory,
    smtp_ssl_factory,
):
    security = configuration["security"]
    connection_kwargs = {
        "host": configuration["host"],
        "port": configuration["port"],
        "timeout": configuration["timeout_seconds"],
    }

    if security == "ssl":
        connection = smtp_ssl_factory(
            **connection_kwargs,
            context=ssl.create_default_context(),
        )
    else:
        connection = smtp_factory(**connection_kwargs)

    with connection as smtp:
        if security == "starttls":
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()

        if configuration["username"]:
            smtp.login(
                configuration["username"],
                configuration["password"],
            )

        smtp.send_message(message)


def send_access_approval_email(
    *,
    recipient_name,
    recipient_email,
    environment=None,
    smtp_factory=None,
    smtp_ssl_factory=None,
):
    """Intenta notificar una aprobación sin propagar fallos SMTP."""
    environment = os.environ if environment is None else environment

    enabled = str(
        environment.get("SMTP_ENABLED", "0")
    ).strip().lower() in ENABLED_VALUES
    if not enabled:
        return _result(EMAIL_STATUS_DISABLED)

    smtp_factory = smtp_factory or smtplib.SMTP
    smtp_ssl_factory = smtp_ssl_factory or smtplib.SMTP_SSL

    try:
        configuration = _configuration(environment)
        message = _approval_message(
            recipient_name=recipient_name,
            recipient_email=recipient_email,
            configuration=configuration,
        )
        _send_message(
            message,
            configuration,
            smtp_factory=smtp_factory,
            smtp_ssl_factory=smtp_ssl_factory,
        )
    except Exception as exc:
        LOGGER.warning(
            "No fue posible enviar el correo de aprobación (tipo=%s).",
            type(exc).__name__,
        )
        return _result(EMAIL_STATUS_FAILED)

    return _result(EMAIL_STATUS_SENT)
