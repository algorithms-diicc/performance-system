from dataclasses import dataclass
from pathlib import Path
import json


@dataclass(frozen=True)
class FailureDescriptor:
    failure_stage: str
    error_code: str
    message: str


@dataclass(frozen=True)
class LegacyOutcome:
    kind: str
    status_text: str
    worker_error_code: object = None
    failure: object = None


WORKER_FAILURES = {
    100: FailureDescriptor(
        "COMPILATION",
        "COMPILE_ERROR",
        "El código no pudo compilarse correctamente.",
    ),
    200: FailureDescriptor(
        "EXECUTION",
        "EXECUTION_TIMEOUT",
        "La ejecución excedió el tiempo límite.",
    ),
    300: FailureDescriptor(
        "MEASUREMENT",
        "RESULT_CSV_MISSING",
        "El worker no produjo el CSV esperado.",
    ),
    400: FailureDescriptor(
        "EXECUTION",
        "EXECUTION_ERROR",
        "La ejecución terminó con un error inesperado.",
    ),
}


def map_worker_error(error_code):
    try:
        normalized = int(error_code)
    except (TypeError, ValueError):
        normalized = None

    return WORKER_FAILURES.get(
        normalized,
        FailureDescriptor(
            "EXECUTION",
            "UNKNOWN_WORKER_ERROR",
            "El worker informó un error no reconocido.",
        ),
    )


def classify_status_text(status_text, worker_error_code=None):
    raw = str(status_text or "").strip()

    if raw == "DONE":
        return LegacyOutcome(
            kind="SUCCESS",
            status_text=raw,
            worker_error_code=worker_error_code,
        )

    if not raw or raw == "IN QUEUE":
        return LegacyOutcome(
            kind="PENDING",
            status_text=raw,
            worker_error_code=worker_error_code,
        )

    if raw.startswith("ERROR"):
        lowered = raw.lower()

        if "no machines available" in lowered:
            failure = FailureDescriptor(
                "INFRASTRUCTURE",
                "NO_MACHINES_AVAILABLE",
                "No había un worker disponible para ejecutar el trabajo.",
            )
        elif "timeout exceeded" in lowered:
            failure = FailureDescriptor(
                "EXECUTION",
                "MASTER_WAIT_TIMEOUT",
                "El coordinador agotó el tiempo máximo de espera.",
            )
        elif worker_error_code is not None:
            failure = map_worker_error(worker_error_code)
        else:
            failure = FailureDescriptor(
                "EXECUTION",
                "LEGACY_EXECUTION_ERROR",
                raw,
            )

        return LegacyOutcome(
            kind="FAILED",
            status_text=raw,
            worker_error_code=worker_error_code,
            failure=failure,
        )

    return LegacyOutcome(
        kind="PENDING",
        status_text=raw,
        worker_error_code=worker_error_code,
    )


def _load_status_json_error_code(codename, static_dir):
    candidates = [
        Path(static_dir) / (codename + "_status.json"),
        Path(static_dir) / (codename + "Results_status.json"),
    ]

    for path in candidates:
        if not path.exists():
            continue

        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError, TypeError):
            continue

        if isinstance(data, dict) and data.get("error_code") is not None:
            return data.get("error_code")

    return None


def read_legacy_outcome(codename, status_dir, static_dir):
    status_path = Path(status_dir) / codename

    try:
        status_text = status_path.read_text(encoding="utf-8").strip()
    except (FileNotFoundError, OSError):
        status_text = ""

    worker_error_code = _load_status_json_error_code(
        codename,
        static_dir,
    )

    return classify_status_text(
        status_text,
        worker_error_code=worker_error_code,
    )


def execution_result_path(codename, static_dir):
    """Ruta canónica del resultado procesado de UNA Execution."""
    normalized = str(codename or "").strip()
    if not normalized:
        raise ValueError("codename no puede estar vacío.")

    return str(
        Path(static_dir)
        / normalized
        / "CombinedResults.csv"
    )


def combined_result_path(names, static_dir):
    """
    Compatibilidad temporal para callers legacy.

    MULTI-01: un resultado canónico pertenece a una única Execution.
    Por ello este helper rechaza bundles con más de un codename.
    """
    if not names:
        raise ValueError("names no puede estar vacío.")
    if len(names) != 1:
        raise ValueError(
            "CombinedResults.csv canónico requiere exactamente una Execution."
        )

    return execution_result_path(names[0], static_dir)


def result_bundle_exists(names, static_dir):
    return Path(
        combined_result_path(names, static_dir)
    ).is_file()