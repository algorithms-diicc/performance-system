import re


MAX_ACCOUNT_EMAIL_CHARS = 100
ACCOUNT_EMAIL_RE = re.compile(
    r"^[^\s@]+@[^\s@]+\.[^\s@]+$"
)


def normalize_account_email(value):
    normalized = str(value or "").strip().casefold()

    if (
        not normalized
        or len(normalized) > MAX_ACCOUNT_EMAIL_CHARS
        or not ACCOUNT_EMAIL_RE.fullmatch(normalized)
    ):
        raise ValueError("El correo no tiene un formato válido.")

    local, domain = normalized.rsplit("@", 1)
    if (
        not local
        or not domain
        or not all(domain.split("."))
    ):
        raise ValueError("El correo no tiene un formato válido.")

    return normalized


def account_email_domain(value):
    normalized = normalize_account_email(value)
    return normalized.rsplit("@", 1)[1]
