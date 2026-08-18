"""Acceso seguro a las fuentes históricas conservadas en el ZIP original."""

from dataclasses import dataclass, field
from io import BytesIO
from pathlib import Path, PurePosixPath
import hashlib
import hmac
import os
import re
import stat
from typing import Optional
import zipfile

from werkzeug.utils import secure_filename

from .upload_service import DEFAULT_MAX_ARCHIVE_BYTES, DEFAULT_MAX_CPP_BYTES


SERVER_ROOT = Path(__file__).resolve().parents[2]
TRACE_SCHEMA_VERSION = "1.0"
SHA256_RE = re.compile(r"^[0-9a-fA-F]{64}$")
WINDOWS_DRIVE_RE = re.compile(r"^[A-Za-z]:")


class SourceProvenanceError(Exception):
    """Error público y sanitizado de procedencia histórica."""

    def __init__(self, code, message, status_code):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


class _InvalidArchiveReference(Exception):
    pass


class _InvalidSourceReference(Exception):
    pass


class _ArtifactTooLarge(Exception):
    pass


@dataclass(frozen=True)
class ArchiveSnapshot:
    integrity: str
    available: bool
    expected_sha256: Optional[str] = None
    data: Optional[bytes] = field(default=None, repr=False)


@dataclass(frozen=True)
class SourceArtifact:
    filename: str
    content_bytes: bytes = field(repr=False)
    size_bytes: int
    sha256: str


def _normalized_sha256(value):
    candidate = str(value or "").strip()
    if not SHA256_RE.fullmatch(candidate):
        return None
    return candidate.lower()


def _is_within(path, root):
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _resolve_archive_reference(file_path, server_root, uploads_root):
    raw_reference = str(file_path or "").strip()
    if not raw_reference:
        return None
    if "\x00" in raw_reference:
        raise _InvalidArchiveReference()

    normalized = raw_reference.replace("\\", "/")
    pure_path = PurePosixPath(normalized)
    if ".." in pure_path.parts or WINDOWS_DRIVE_RE.match(normalized):
        raise _InvalidArchiveReference()

    server = Path(server_root).resolve()
    uploads = Path(uploads_root).resolve()
    if not _is_within(uploads, server):
        raise _InvalidArchiveReference()

    unresolved = Path(normalized) if pure_path.is_absolute() else server / normalized
    try:
        resolved = unresolved.resolve(strict=False)
    except (OSError, RuntimeError, ValueError):
        raise _InvalidArchiveReference()

    if not _is_within(resolved, uploads):
        raise _InvalidArchiveReference()

    return resolved


def _read_regular_file(path, root, max_bytes):
    flags = os.O_RDONLY
    flags |= getattr(os, "O_CLOEXEC", 0)
    flags |= getattr(os, "O_NOFOLLOW", 0)
    flags |= getattr(os, "O_NONBLOCK", 0)

    fd = os.open(str(path), flags)
    try:
        metadata = os.fstat(fd)
        if not stat.S_ISREG(metadata.st_mode):
            raise _InvalidArchiveReference()

        # Linux permite comprobar el destino real del descriptor ya abierto.
        # Así el contenido leído queda ligado a la referencia validada y no a
        # una segunda apertura susceptible de sustitución.
        fd_reference = "/proc/self/fd/{}".format(fd)
        try:
            opened_reference = os.readlink(fd_reference)
        except FileNotFoundError:
            # /proc no está disponible en todas las plataformas soportadas.
            opened_reference = None
        except OSError:
            raise _InvalidArchiveReference()

        if opened_reference is not None:
            deleted_suffix = " (deleted)"
            if opened_reference.endswith(deleted_suffix):
                opened_reference = opened_reference[: -len(deleted_suffix)]
            try:
                opened_path = Path(opened_reference).resolve(strict=False)
            except (OSError, RuntimeError, ValueError):
                raise _InvalidArchiveReference()
            if not _is_within(opened_path, Path(root).resolve()):
                raise _InvalidArchiveReference()

        chunks = []
        total = 0
        while True:
            chunk = os.read(fd, 1024 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise _ArtifactTooLarge()
            chunks.append(chunk)

        return b"".join(chunks)
    finally:
        os.close(fd)


def inspect_archive(
    archive_row,
    *,
    server_root=None,
    uploads_root=None,
    max_archive_bytes=DEFAULT_MAX_ARCHIVE_BYTES,
):
    """Verifica referencia, regularidad, tamaño, SHA-256 y estructura ZIP."""
    row = archive_row or {}
    expected_sha256 = _normalized_sha256(row.get("archive_sha256"))
    effective_server_root = Path(server_root or SERVER_ROOT)
    effective_uploads_root = Path(
        uploads_root or (effective_server_root / "uploads")
    )

    try:
        archive_path = _resolve_archive_reference(
            row.get("archive_file_path"),
            effective_server_root,
            effective_uploads_root,
        )
    except _InvalidArchiveReference:
        return ArchiveSnapshot(
            integrity="invalid_reference",
            available=False,
            expected_sha256=expected_sha256,
        )

    if archive_path is None:
        return ArchiveSnapshot(
            integrity="unavailable",
            available=False,
            expected_sha256=expected_sha256,
        )

    if expected_sha256 is None:
        return ArchiveSnapshot(
            integrity="unverified",
            available=False,
        )

    try:
        archive_bytes = _read_regular_file(
            archive_path,
            effective_uploads_root,
            max_archive_bytes,
        )
    except (FileNotFoundError, NotADirectoryError, IsADirectoryError, PermissionError):
        return ArchiveSnapshot(
            integrity="unavailable",
            available=False,
            expected_sha256=expected_sha256,
        )
    except _InvalidArchiveReference:
        return ArchiveSnapshot(
            integrity="invalid_reference",
            available=False,
            expected_sha256=expected_sha256,
        )
    except _ArtifactTooLarge:
        return ArchiveSnapshot(
            integrity="invalid_archive",
            available=False,
            expected_sha256=expected_sha256,
        )
    except OSError:
        return ArchiveSnapshot(
            integrity="unavailable",
            available=False,
            expected_sha256=expected_sha256,
        )

    actual_sha256 = hashlib.sha256(archive_bytes).hexdigest()
    if not hmac.compare_digest(actual_sha256, expected_sha256):
        return ArchiveSnapshot(
            integrity="mismatch",
            available=False,
            expected_sha256=expected_sha256,
        )

    try:
        with zipfile.ZipFile(BytesIO(archive_bytes), "r") as archive:
            archive.infolist()
    except (OSError, RuntimeError, ValueError, zipfile.BadZipFile):
        return ArchiveSnapshot(
            integrity="invalid_archive",
            available=False,
            expected_sha256=expected_sha256,
        )

    return ArchiveSnapshot(
        integrity="verified",
        available=True,
        expected_sha256=expected_sha256,
        data=archive_bytes,
    )


def _raise_for_archive(snapshot):
    errors = {
        "unavailable": (
            "ARCHIVE_UNAVAILABLE",
            "El archivo histórico no está disponible.",
            404,
        ),
        "unverified": (
            "ARCHIVE_UNVERIFIED",
            "El archivo histórico no posee verificación de integridad.",
            409,
        ),
        "mismatch": (
            "ARCHIVE_INTEGRITY_MISMATCH",
            "El archivo histórico no superó la verificación de integridad.",
            409,
        ),
        "invalid_reference": (
            "ARCHIVE_INVALID_REFERENCE",
            "La referencia del archivo histórico no es válida.",
            422,
        ),
        "invalid_archive": (
            "ARCHIVE_INVALID",
            "El archivo histórico no es un ZIP válido y seguro.",
            422,
        ),
    }
    code, message, status_code = errors.get(
        snapshot.integrity,
        (
            "ARCHIVE_UNAVAILABLE",
            "El archivo histórico no está disponible.",
            404,
        ),
    )
    raise SourceProvenanceError(code, message, status_code)


def require_verified_archive(snapshot):
    if not snapshot.available or snapshot.data is None:
        _raise_for_archive(snapshot)
    return snapshot.data


def _normalize_source_reference(raw_filename):
    raw = str(raw_filename or "")
    if not raw or "\x00" in raw:
        raise _InvalidSourceReference()

    normalized = raw.replace("\\", "/")
    path = PurePosixPath(normalized)
    if (
        path.is_absolute()
        or ".." in path.parts
        or WINDOWS_DRIVE_RE.match(normalized)
        or not path.parts
        or not path.name
        or path.suffix.casefold() != ".cpp"
    ):
        raise _InvalidSourceReference()

    return normalized


def _zip_member_is_symlink(info):
    mode = (info.external_attr >> 16) & 0o170000
    return mode == stat.S_IFLNK


def load_source_artifact(
    snapshot,
    raw_filename,
    *,
    max_cpp_bytes=DEFAULT_MAX_CPP_BYTES,
):
    """Extrae exactamente un miembro .cpp desde el snapshot ya verificado."""
    archive_bytes = require_verified_archive(snapshot)
    try:
        source_filename = _normalize_source_reference(raw_filename)
    except _InvalidSourceReference:
        raise SourceProvenanceError(
            "SOURCE_INVALID_REFERENCE",
            "La referencia de la fuente histórica no es válida.",
            422,
        )

    try:
        with zipfile.ZipFile(BytesIO(archive_bytes), "r") as archive:
            matches = [
                info
                for info in archive.infolist()
                if str(info.filename or "").replace("\\", "/")
                == source_filename
            ]
            if len(matches) != 1:
                if not matches:
                    raise SourceProvenanceError(
                        "SOURCE_NOT_FOUND",
                        "La fuente histórica no existe en el archivo verificado.",
                        404,
                    )
                raise SourceProvenanceError(
                    "SOURCE_INVALID",
                    "La fuente histórica no posee una referencia única.",
                    422,
                )

            info = matches[0]
            if (
                info.is_dir()
                or _zip_member_is_symlink(info)
                or bool(info.flag_bits & 0x1)
            ):
                raise SourceProvenanceError(
                    "SOURCE_INVALID",
                    "La fuente histórica no es un miembro regular válido.",
                    422,
                )
            if info.file_size < 0 or info.file_size > max_cpp_bytes:
                raise SourceProvenanceError(
                    "SOURCE_TOO_LARGE",
                    "La fuente histórica supera el tamaño permitido.",
                    413,
                )

            chunks = []
            total = 0
            with archive.open(info, "r") as member:
                while True:
                    chunk = member.read(64 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > max_cpp_bytes:
                        raise SourceProvenanceError(
                            "SOURCE_TOO_LARGE",
                            "La fuente histórica supera el tamaño permitido.",
                            413,
                        )
                    chunks.append(chunk)

            content_bytes = b"".join(chunks)
            if len(content_bytes) != info.file_size:
                raise SourceProvenanceError(
                    "SOURCE_INVALID",
                    "La fuente histórica no pudo validarse.",
                    422,
                )
    except SourceProvenanceError:
        raise
    except (OSError, RuntimeError, ValueError, zipfile.BadZipFile, zipfile.LargeZipFile):
        raise SourceProvenanceError(
            "SOURCE_INVALID",
            "La fuente histórica no pudo leerse de forma segura.",
            422,
        )

    return SourceArtifact(
        filename=source_filename,
        content_bytes=content_bytes,
        size_bytes=len(content_bytes),
        sha256=hashlib.sha256(content_bytes).hexdigest(),
    )


def serialize_source_artifact(artifact):
    try:
        content = artifact.content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        raise SourceProvenanceError(
            "SOURCE_INVALID_ENCODING",
            "La fuente histórica no utiliza codificación UTF-8 válida.",
            422,
        )

    return {
        "source": {
            "filename": artifact.filename,
            "content": content,
            "sizeBytes": artifact.size_bytes,
            "sha256": artifact.sha256,
            "encoding": "utf-8",
        }
    }


def source_download_name(artifact):
    visible_name = PurePosixPath(artifact.filename).name
    safe_name = secure_filename(visible_name)
    if not safe_name or not safe_name.casefold().endswith(".cpp"):
        raise SourceProvenanceError(
            "SOURCE_INVALID_REFERENCE",
            "La fuente histórica no posee un nombre de descarga válido.",
            422,
        )
    return safe_name


def archive_download_name(archive_row):
    submission_id = int(archive_row["submission_id"])
    original = archive_row.get("archive_original_filename")
    if original:
        normalized = str(original).replace("\\", "/")
        if "\x00" not in normalized:
            candidate = secure_filename(PurePosixPath(normalized).name)
            if candidate and candidate.casefold().endswith(".zip"):
                return candidate
    return "submission-{}.zip".format(submission_id)


def _source_index(value):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _public_source_filename(value):
    try:
        return _normalize_source_reference(value)
    except _InvalidSourceReference:
        return None


def _public_archive_original_filename(value):
    if value is None:
        return None
    normalized = str(value).replace("\\", "/")
    if "\x00" in normalized:
        return None
    visible_name = PurePosixPath(normalized).name
    if not visible_name or not visible_name.casefold().endswith(".zip"):
        return None
    return visible_name


def _execution_identity(row):
    return str(row.get("execution_id"))


def build_trace_payload(
    execution_row,
    sibling_rows,
    *,
    can_download_archive,
    server_root=None,
    uploads_root=None,
):
    """Construye el contrato público ZIP -> fuentes -> Executions."""
    archive = inspect_archive(
        execution_row,
        server_root=server_root,
        uploads_root=uploads_root,
    )

    current_identity = _execution_identity(execution_row)
    deduplicated = {}
    for sibling in sibling_rows or []:
        deduplicated.setdefault(_execution_identity(sibling), dict(sibling))
    if current_identity not in deduplicated:
        deduplicated[current_identity] = {
            key: execution_row.get(key)
            for key in (
                "execution_id",
                "public_id",
                "codename",
                "execution_state",
                "source_filename",
                "source_index",
            )
        }

    normalized_rows = []
    for sibling in deduplicated.values():
        normalized_rows.append(
            {
                "_executionId": sibling.get("execution_id"),
                "_identity": _execution_identity(sibling),
                "filename": _public_source_filename(
                    sibling.get("source_filename")
                ),
                "sourceIndex": _source_index(sibling.get("source_index")),
                "executionPublicId": sibling.get("public_id"),
                "codename": sibling.get("codename"),
                "state": sibling.get("execution_state"),
            }
        )

    def source_sort_key(item):
        source_index = item["sourceIndex"]
        execution_id = item["_executionId"]
        try:
            stable_execution_id = (0, int(execution_id))
        except (TypeError, ValueError):
            stable_execution_id = (1, str(execution_id or ""))
        return (
            source_index is None,
            source_index if source_index is not None else 0,
            stable_execution_id,
        )

    normalized_rows.sort(key=source_sort_key)
    source_cache = {}
    sources = []
    current_artifact = None

    for item in normalized_rows:
        filename = item["filename"]
        artifact = None
        if archive.available and filename:
            if filename not in source_cache:
                try:
                    source_cache[filename] = load_source_artifact(
                        archive,
                        filename,
                    )
                except SourceProvenanceError:
                    source_cache[filename] = None
            artifact = source_cache[filename]

        is_current = item["_identity"] == current_identity
        if is_current:
            current_artifact = artifact

        sources.append(
            {
                "filename": filename,
                "sourceIndex": item["sourceIndex"],
                "executionPublicId": item["executionPublicId"],
                "codename": item["codename"],
                "state": item["state"],
                "isCurrent": is_current,
                "available": artifact is not None,
            }
        )

    current_filename = _public_source_filename(
        execution_row.get("source_filename")
    )
    current_source = {
        "filename": current_filename,
        "sourceIndex": _source_index(execution_row.get("source_index")),
        "available": current_artifact is not None,
        "sha256": current_artifact.sha256 if current_artifact else None,
        "sizeBytes": current_artifact.size_bytes if current_artifact else None,
    }

    return {
        "schemaVersion": TRACE_SCHEMA_VERSION,
        "submission": {
            "id": execution_row.get("submission_id"),
            "title": execution_row.get("submission_title"),
            "archive": {
                "originalFilename": _public_archive_original_filename(
                    execution_row.get("archive_original_filename")
                ),
                "sha256": archive.expected_sha256,
                "available": archive.available,
                "integrity": archive.integrity,
            },
        },
        "execution": {
            "publicId": execution_row.get("public_id"),
            "codename": execution_row.get("codename"),
            "source": current_source,
        },
        "sources": sources,
        "permissions": {
            "canViewSource": True,
            "canDownloadSource": True,
            "canDownloadArchive": bool(can_download_archive),
        },
    }
