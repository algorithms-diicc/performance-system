"""Contrato seguro del CombinedResults.csv canónico de una Execution."""

from dataclasses import dataclass, field
import errno
import hashlib
import os
from pathlib import Path, PurePosixPath
import re
import stat
from typing import Optional


SERVER_ROOT = Path(__file__).resolve().parents[2]
STATIC_ROOT = SERVER_ROOT / "webapp" / "static"
CANONICAL_RESULT_FILENAME = "CombinedResults.csv"
DEFAULT_MAX_RESULT_BYTES = 50 * 1024 * 1024
CODENAME_RE = re.compile(r"^[A-Za-z0-9_-]+$")
WINDOWS_DRIVE_RE = re.compile(r"^[A-Za-z]:")


class ResultArtifactNotReady(Exception):
    """La Execution no declara resultados canónicos disponibles."""


class ResultArtifactInvalidReference(Exception):
    """result_path no identifica el CSV canónico de la Execution."""


class ResultArtifactError(Exception):
    """Error público sanitizado al solicitar bytes del CSV."""

    def __init__(self, code, message, status_code):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class _ResultFileTooLarge(Exception):
    pass


@dataclass(frozen=True)
class ResultArtifact:
    filename: str
    content_bytes: bytes = field(repr=False)
    size_bytes: int
    sha256: str


@dataclass(frozen=True)
class ResultArtifactSnapshot:
    status: str
    available: bool
    artifact: Optional[ResultArtifact] = field(default=None, repr=False)


def _is_within(path, root):
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def assert_canonical_result_reference(
    codename,
    execution_row,
    *,
    static_dir=None,
    server_dir=None,
):
    """Valida estado y correspondencia exacta de result_path."""
    if (
        execution_row.get("execution_state") != "COMPLETED"
        or execution_row.get("result_available") is not True
    ):
        raise ResultArtifactNotReady(
            "La ejecución todavía no posee resultados publicables."
        )

    safe_codename = str(codename or "")
    if not CODENAME_RE.fullmatch(safe_codename):
        raise ResultArtifactInvalidReference(
            "La referencia de resultados no cumple el contrato canónico."
        )

    raw_reference = str(execution_row.get("result_path") or "").strip()
    if not raw_reference or "\x00" in raw_reference:
        raise ResultArtifactInvalidReference(
            "La referencia de resultados no cumple el contrato canónico."
        )

    normalized = raw_reference.replace("\\", "/")
    pure_reference = PurePosixPath(normalized)
    if ".." in pure_reference.parts or WINDOWS_DRIVE_RE.match(normalized):
        raise ResultArtifactInvalidReference(
            "La referencia de resultados no cumple el contrato canónico."
        )

    server_root = Path(server_dir or SERVER_ROOT).resolve()
    static_root = Path(static_dir or STATIC_ROOT).resolve()
    if not _is_within(static_root, server_root):
        raise ResultArtifactInvalidReference(
            "La referencia de resultados no cumple el contrato canónico."
        )

    expected_path = static_root / safe_codename / CANONICAL_RESULT_FILENAME
    try:
        resolved_expected_path = expected_path.resolve(strict=False)
    except (OSError, RuntimeError, ValueError):
        raise ResultArtifactInvalidReference(
            "La referencia de resultados no cumple el contrato canónico."
        )

    # El path esperado tampoco puede convertirse en un alias por symlink.
    if resolved_expected_path != expected_path:
        raise ResultArtifactInvalidReference(
            "La referencia de resultados no cumple el contrato canónico."
        )

    unresolved_reference = (
        Path(normalized)
        if pure_reference.is_absolute()
        else server_root / normalized
    )
    try:
        resolved_reference = unresolved_reference.resolve(strict=False)
    except (OSError, RuntimeError, ValueError):
        raise ResultArtifactInvalidReference(
            "La referencia de resultados no cumple el contrato canónico."
        )

    if resolved_reference != expected_path:
        raise ResultArtifactInvalidReference(
            "La referencia de resultados no cumple el contrato canónico."
        )

    return str(expected_path)


def _read_regular_file(path, static_root, max_bytes):
    flags = os.O_RDONLY
    flags |= getattr(os, "O_CLOEXEC", 0)
    flags |= getattr(os, "O_NOFOLLOW", 0)
    flags |= getattr(os, "O_NONBLOCK", 0)

    try:
        fd = os.open(str(path), flags)
    except OSError as error:
        if error.errno == errno.ELOOP:
            raise ResultArtifactInvalidReference(
                "La referencia de resultados no cumple el contrato canónico."
            )
        raise

    try:
        metadata = os.fstat(fd)
        if not stat.S_ISREG(metadata.st_mode):
            raise ResultArtifactInvalidReference(
                "La referencia de resultados no cumple el contrato canónico."
            )
        if metadata.st_size > max_bytes:
            raise _ResultFileTooLarge()

        fd_reference = "/proc/self/fd/{}".format(fd)
        try:
            opened_reference = os.readlink(fd_reference)
        except FileNotFoundError:
            opened_reference = None
        except OSError:
            raise ResultArtifactInvalidReference(
                "La referencia de resultados no cumple el contrato canónico."
            )

        if opened_reference is not None:
            deleted_suffix = " (deleted)"
            if opened_reference.endswith(deleted_suffix):
                opened_reference = opened_reference[: -len(deleted_suffix)]
            opened_path = Path(opened_reference).resolve(strict=False)
            if opened_path != path or not _is_within(opened_path, static_root):
                raise ResultArtifactInvalidReference(
                    "La referencia de resultados no cumple el contrato canónico."
                )

        chunks = []
        total = 0
        while True:
            chunk = os.read(fd, 1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise _ResultFileTooLarge()
            chunks.append(chunk)

        return b"".join(chunks)
    finally:
        os.close(fd)


def inspect_result_artifact(
    codename,
    execution_row,
    *,
    static_dir=None,
    server_dir=None,
    max_result_bytes=DEFAULT_MAX_RESULT_BYTES,
):
    """Inspecciona el CSV sin convertir su ausencia en fallo del manifest."""
    effective_server_root = Path(server_dir or SERVER_ROOT).resolve()
    effective_static_root = Path(static_dir or STATIC_ROOT).resolve()

    try:
        result_path = Path(
            assert_canonical_result_reference(
                codename,
                execution_row,
                static_dir=effective_static_root,
                server_dir=effective_server_root,
            )
        )
    except ResultArtifactNotReady:
        return ResultArtifactSnapshot(status="not_ready", available=False)
    except ResultArtifactInvalidReference:
        return ResultArtifactSnapshot(
            status="invalid_reference",
            available=False,
        )

    try:
        content_bytes = _read_regular_file(
            result_path,
            effective_static_root,
            max_result_bytes,
        )
    except ResultArtifactInvalidReference:
        return ResultArtifactSnapshot(
            status="invalid_reference",
            available=False,
        )
    except _ResultFileTooLarge:
        return ResultArtifactSnapshot(status="too_large", available=False)
    except (FileNotFoundError, NotADirectoryError, IsADirectoryError, PermissionError):
        return ResultArtifactSnapshot(status="unavailable", available=False)
    except OSError:
        return ResultArtifactSnapshot(status="unavailable", available=False)

    artifact = ResultArtifact(
        filename=CANONICAL_RESULT_FILENAME,
        content_bytes=content_bytes,
        size_bytes=len(content_bytes),
        sha256=hashlib.sha256(content_bytes).hexdigest(),
    )
    return ResultArtifactSnapshot(
        status="available",
        available=True,
        artifact=artifact,
    )


def require_result_artifact(snapshot):
    if snapshot.available and snapshot.artifact is not None:
        return snapshot.artifact

    errors = {
        "not_ready": (
            "MEASUREMENTS_NOT_READY",
            "La ejecución todavía no posee mediciones exportables.",
            409,
        ),
        "invalid_reference": (
            "MEASUREMENTS_INVALID_REFERENCE",
            "La referencia de mediciones no cumple el contrato canónico.",
            422,
        ),
        "too_large": (
            "MEASUREMENTS_TOO_LARGE",
            "El archivo de mediciones supera el tamaño permitido.",
            413,
        ),
        "unavailable": (
            "MEASUREMENTS_UNAVAILABLE",
            "El archivo de mediciones no está disponible.",
            404,
        ),
    }
    code, message, status_code = errors.get(
        snapshot.status,
        (
            "MEASUREMENTS_UNAVAILABLE",
            "El archivo de mediciones no está disponible.",
            404,
        ),
    )
    raise ResultArtifactError(code, message, status_code)
