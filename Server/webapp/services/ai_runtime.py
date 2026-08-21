import hashlib
import json
import os


SUPPORTED_LANGUAGES = frozenset({"es", "en"})


class AIProviderError(RuntimeError):
    """El proveedor devolvió una respuesta no utilizable."""


class AIInvalidLanguageError(RuntimeError):
    """El idioma solicitado no pertenece al contrato ES/EN."""


def normalize_ai_language(language):
    normalized = str(language or "es").strip().lower().replace("_", "-")

    aliases = {
        "es": "es",
        "es-cl": "es",
        "en": "en",
        "en-us": "en",
        "en-gb": "en",
    }

    canonical = aliases.get(normalized)

    if canonical not in SUPPORTED_LANGUAGES:
        raise AIInvalidLanguageError(
            "language debe ser 'es' o 'en'."
        )

    return canonical


def build_provider_shaped_response(content):
    """Construye el envelope mínimo compatible con Responses API."""
    return {
        "status": "completed",
        "output": [
            {
                "type": "message",
                "content": [
                    {
                        "type": "output_text",
                        "text": json.dumps(
                            content,
                            ensure_ascii=False,
                        ),
                    }
                ],
            }
        ],
    }


def parse_openai_structured_output(provider_response):
    if not isinstance(provider_response, dict):
        raise AIProviderError(
            "La respuesta del proveedor no es un objeto JSON."
        )

    if provider_response.get("status") == "incomplete":
        raise AIProviderError(
            "La respuesta de IA quedó incompleta."
        )

    output_items = provider_response.get("output") or []

    for item in output_items:
        if item.get("type") != "message":
            continue

        for content in item.get("content") or []:
            if content.get("type") == "refusal":
                raise AIProviderError(
                    "El proveedor rechazó generar la explicación."
                )

            if content.get("type") == "output_text":
                text = content.get("text")

                if not text:
                    continue

                try:
                    parsed = json.loads(text)
                except ValueError as exc:
                    raise AIProviderError(
                        "La salida estructurada no contiene JSON válido."
                    ) from exc

                return parsed

    raise AIProviderError(
        "No se encontró contenido textual estructurado en la respuesta."
    )


def build_ai_context_hash(
    *,
    context,
    prompt_version,
    schema_version,
    model,
    provider,
    transport_mode,
    language,
):
    canonical = json.dumps(
        {
            "prompt_version": prompt_version,
            "schema_version": schema_version,
            "provider": provider,
            "transport_mode": transport_mode,
            "model": model,
            "language": language,
            "context": context,
        },
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")

    return hashlib.sha256(canonical).hexdigest()


def read_valid_ai_cache(
    *,
    cache_path,
    context_hash,
    schema_version,
    prompt_version,
    model,
    provider,
    transport_mode,
    language,
):
    if not os.path.isfile(cache_path):
        return None

    try:
        with open(cache_path, "r", encoding="utf-8") as handle:
            cached = json.load(handle)
    except (OSError, ValueError):
        return None

    expected = {
        "context_hash": context_hash,
        "schema_version": schema_version,
        "prompt_version": prompt_version,
        "model": model,
        "provider": provider,
        "transport_mode": transport_mode,
        "language": language,
    }

    for key, value in expected.items():
        if cached.get(key) != value:
            return None

    return cached


def write_ai_cache(cache_path, payload):
    directory = os.path.dirname(cache_path)

    try:
        os.makedirs(directory, exist_ok=True)
        with open(cache_path, "w", encoding="utf-8") as handle:
            json.dump(
                payload,
                handle,
                ensure_ascii=False,
                indent=2,
            )
    except OSError:
        # La IA sigue siendo utilizable aunque el cache no pueda persistirse.
        pass
