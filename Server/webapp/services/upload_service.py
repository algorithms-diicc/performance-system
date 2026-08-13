"""
CORE-04B-2 — Validación y almacenamiento seguro de uploads ZIP.
"""

from dataclasses import dataclass
from pathlib import Path, PurePosixPath
import hashlib
import os
import stat
import tempfile
import uuid
import zipfile


DEFAULT_MAX_ARCHIVE_BYTES = 10 * 1024 * 1024
DEFAULT_MAX_CPP_BYTES = 2 * 1024 * 1024
DEFAULT_MAX_TOTAL_CPP_BYTES = 10 * 1024 * 1024
DEFAULT_MAX_CPP_FILES = 20
DEFAULT_MAX_ARCHIVE_ENTRIES = 200


class UploadValidationError(Exception):
    """El upload no cumple las restricciones del sistema."""


@dataclass(frozen=True)
class CppSource:
    original_filename: str
    content: str
    size_bytes: int


@dataclass(frozen=True)
class StoredZipUpload:
    original_filename: str
    stored_path: str
    sha256: str
    archive_size_bytes: int
    sources: tuple


def _normalized_member_name(raw_name):
    return str(raw_name or "").replace("\\", "/")


def _validate_member_path(raw_name):
    normalized = _normalized_member_name(raw_name)

    if not normalized or "\x00" in normalized:
        raise UploadValidationError("El ZIP contiene una ruta inválida.")

    path = PurePosixPath(normalized)

    if path.is_absolute() or ".." in path.parts:
        raise UploadValidationError(
            "El ZIP contiene una ruta insegura: {!r}.".format(raw_name)
        )

    if path.parts and ":" in path.parts[0]:
        raise UploadValidationError(
            "El ZIP contiene una ruta absoluta/insegura: {!r}.".format(raw_name)
        )

    return normalized


def _is_symlink(info):
    mode = (info.external_attr >> 16) & 0o170000
    return mode == stat.S_IFLNK


def store_and_inspect_zip(
    file_storage,
    storage_dir,
    *,
    max_archive_bytes=DEFAULT_MAX_ARCHIVE_BYTES,
    max_cpp_bytes=DEFAULT_MAX_CPP_BYTES,
    max_total_cpp_bytes=DEFAULT_MAX_TOTAL_CPP_BYTES,
    max_cpp_files=DEFAULT_MAX_CPP_FILES,
    max_archive_entries=DEFAULT_MAX_ARCHIVE_ENTRIES,
):
    if file_storage is None:
        raise UploadValidationError("No se recibió archivo.")

    original_filename = str(
        getattr(file_storage, "filename", "") or ""
    ).strip()

    if not original_filename:
        raise UploadValidationError("El archivo no tiene nombre.")

    if not original_filename.lower().endswith(".zip"):
        raise UploadValidationError("El archivo debe tener extensión .zip.")

    storage_path = Path(storage_dir)
    storage_path.mkdir(parents=True, exist_ok=True)

    temp_path = None
    final_path = None

    try:
        digest = hashlib.sha256()
        total_bytes = 0

        with tempfile.NamedTemporaryFile(
            mode="wb",
            suffix=".upload",
            prefix="core04b2_",
            dir=str(storage_path),
            delete=False,
        ) as tmp:
            temp_path = Path(tmp.name)

            stream = file_storage.stream
            try:
                stream.seek(0)
            except Exception:
                pass

            while True:
                chunk = stream.read(1024 * 1024)
                if not chunk:
                    break

                total_bytes += len(chunk)
                if total_bytes > max_archive_bytes:
                    raise UploadValidationError(
                        "El ZIP supera el límite de {} bytes.".format(
                            max_archive_bytes
                        )
                    )

                digest.update(chunk)
                tmp.write(chunk)

        if total_bytes == 0:
            raise UploadValidationError("El ZIP está vacío.")

        sources = []
        total_cpp_bytes = 0

        try:
            with zipfile.ZipFile(str(temp_path), "r") as archive:
                infos = archive.infolist()

                if len(infos) > max_archive_entries:
                    raise UploadValidationError(
                        "El ZIP contiene demasiadas entradas (máximo {}).".format(
                            max_archive_entries
                        )
                    )

                for info in infos:
                    normalized_name = _validate_member_path(info.filename)

                    if _is_symlink(info):
                        raise UploadValidationError(
                            "El ZIP contiene un enlace simbólico no permitido: {!r}."
                            .format(info.filename)
                        )

                    if info.flag_bits & 0x1:
                        raise UploadValidationError(
                            "No se permiten entradas ZIP cifradas."
                        )

                    if info.is_dir():
                        continue

                    if not normalized_name.lower().endswith(".cpp"):
                        continue

                    if len(sources) >= max_cpp_files:
                        raise UploadValidationError(
                            "El ZIP contiene más de {} archivos .cpp.".format(
                                max_cpp_files
                            )
                        )

                    if info.file_size > max_cpp_bytes:
                        raise UploadValidationError(
                            "{} supera el límite individual de {} bytes.".format(
                                normalized_name,
                                max_cpp_bytes,
                            )
                        )

                    total_cpp_bytes += info.file_size
                    if total_cpp_bytes > max_total_cpp_bytes:
                        raise UploadValidationError(
                            "Los archivos C++ superan el límite total de {} bytes."
                            .format(max_total_cpp_bytes)
                        )

                    raw = archive.read(info)

                    if len(raw) > max_cpp_bytes:
                        raise UploadValidationError(
                            "{} supera el límite individual permitido.".format(
                                normalized_name
                            )
                        )

                    try:
                        content = raw.decode("utf-8-sig")
                    except UnicodeDecodeError:
                        raise UploadValidationError(
                            "{} no está codificado en UTF-8.".format(
                                normalized_name
                            )
                        )

                    if "\x00" in content:
                        raise UploadValidationError(
                            "{} contiene bytes nulos y no es un archivo C/C++ de texto válido."
                            .format(normalized_name)
                        )

                    sources.append(
                        CppSource(
                            original_filename=normalized_name,
                            content=content,
                            size_bytes=len(raw),
                        )
                    )

        except zipfile.BadZipFile:
            raise UploadValidationError(
                "El archivo recibido no es un ZIP válido."
            )

        if not sources:
            raise UploadValidationError(
                "El ZIP debe contener al menos un archivo .cpp."
            )

        final_name = "{}.zip".format(uuid.uuid4().hex)
        final_path = storage_path / final_name
        os.replace(str(temp_path), str(final_path))
        temp_path = None

        return StoredZipUpload(
            original_filename=original_filename,
            stored_path=str(final_path),
            sha256=digest.hexdigest(),
            archive_size_bytes=total_bytes,
            sources=tuple(sources),
        )

    except Exception:
        for candidate in (temp_path, final_path):
            if candidate:
                try:
                    Path(candidate).unlink()
                except FileNotFoundError:
                    pass
                except Exception:
                    pass
        raise


def remove_stored_upload(stored_path):
    if not stored_path:
        return

    try:
        Path(stored_path).unlink()
    except FileNotFoundError:
        pass
