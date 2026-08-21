import json
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


MOCK_MODEL = "local-deterministic-mock-v2"
DEFAULT_OPENAI_URL = "https://api.openai.com/v1/responses"
DEFAULT_TIMEOUT_SECONDS = 30


class AITransportError(RuntimeError):
    pass


class AITransportConfigurationError(AITransportError):
    pass


@dataclass(frozen=True)
class AITransportSelection:
    name: str
    simulated: bool
    requires_api_key: bool
    default_model: str
    send: object


def resolve_ai_transport(
    mode,
    *,
    mock_send=None,
    openai_model,
    openai_url=DEFAULT_OPENAI_URL,
    timeout_seconds=DEFAULT_TIMEOUT_SECONDS,
):
    """
    Selecciona transporte sin conocer el dominio científico.

    El runtime compartido sólo decide entre un callable mock ya inyectado
    por el dominio y el transporte HTTP real. No recibe context, métricas,
    evidencia pedagógica ni lenguaje.
    """
    normalized = str(mode or "mock").strip().lower()

    if normalized == "mock":
        if not callable(mock_send):
            raise AITransportConfigurationError(
                "El modo mock requiere un callable mock_send del dominio."
            )

        return AITransportSelection(
            name="mock",
            simulated=True,
            requires_api_key=False,
            default_model=MOCK_MODEL,
            send=mock_send,
        )

    if normalized == "openai":
        return AITransportSelection(
            name="openai",
            simulated=False,
            requires_api_key=True,
            default_model=openai_model,
            send=lambda request_payload, api_key: openai_http_transport(
                request_payload=request_payload,
                api_key=api_key,
                url=openai_url,
                timeout_seconds=timeout_seconds,
            ),
        )

    raise AITransportConfigurationError(
        "PERFORMANCE_AI_TRANSPORT debe ser 'mock' u 'openai'."
    )


def openai_http_transport(
    request_payload,
    api_key,
    *,
    url=DEFAULT_OPENAI_URL,
    timeout_seconds=DEFAULT_TIMEOUT_SECONDS,
):
    if not api_key:
        raise AITransportError(
            "OPENAI_API_KEY no está configurada."
        )

    body = json.dumps(
        request_payload,
        ensure_ascii=False,
    ).encode("utf-8")

    request = Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": "Bearer {}".format(api_key),
            "Content-Type": "application/json",
        },
    )

    try:
        with urlopen(
            request,
            timeout=timeout_seconds,
        ) as response:
            return json.loads(
                response.read().decode("utf-8")
            )
    except HTTPError as exc:
        try:
            detail = exc.read().decode("utf-8")
        except Exception:
            detail = str(exc)

        raise AITransportError(
            "OpenAI API respondió HTTP {}: {}".format(
                exc.code,
                detail[:500],
            )
        ) from exc
    except URLError as exc:
        raise AITransportError(
            "No fue posible conectar con OpenAI API."
        ) from exc
    except ValueError as exc:
        raise AITransportError(
            "OpenAI API devolvió JSON inválido."
        ) from exc
