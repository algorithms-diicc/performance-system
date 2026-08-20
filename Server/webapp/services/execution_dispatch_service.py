"""
Iteración 9 — reconstrucción persistente de una execution reclamada.

El ZIP original de la Submission es el artefacto durable de entrada. El
dispatcher puede reconstruir el .cpp técnico de una Execution después de un
reinicio sin depender del antiguo `queuelist` ni de archivos temporales
preexistentes en Server/test.
"""

from pathlib import Path, PurePosixPath
import hashlib
import re
import zipfile


CODENAME_RE = re.compile(r"^[A-Za-z0-9_-]+$")


class ExecutionDispatchError(Exception):
    pass


def _safe_archive_path(submission, base_dir):
    raw_path = str(
        (submission or {}).get("file_path") or ""
    ).strip()
    if not raw_path:
        raise ExecutionDispatchError(
            "Submission sin file_path persistido."
        )

    relative = Path(raw_path)
    if relative.is_absolute() or ".." in relative.parts:
        raise ExecutionDispatchError(
            "Submission file_path fuera del almacenamiento permitido."
        )

    base = Path(base_dir).resolve()
    upload_root = (base / "uploads").resolve()
    archive_path = (base / relative).resolve()

    try:
        archive_path.relative_to(upload_root)
    except ValueError:
        raise ExecutionDispatchError(
            "Submission file_path fuera de Server/uploads."
        )

    if not archive_path.is_file():
        raise ExecutionDispatchError(
            "No existe el ZIP persistido de la Submission."
        )

    return archive_path


def _sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
    return digest.hexdigest()


def _safe_member_name(raw_name):
    normalized = str(raw_name or "").replace("\\", "/")
    member = PurePosixPath(normalized)

    if (
        not normalized
        or "\x00" in normalized
        or member.is_absolute()
        or ".." in member.parts
        or (member.parts and ":" in member.parts[0])
    ):
        raise ExecutionDispatchError(
            "El ZIP persistido contiene una ruta insegura."
        )

    return normalized


def load_execution_source(
    execution,
    submission,
    base_dir,
):
    """
    Lee y verifica el source asociado a una Execution.

    Se valida nuevamente el SHA-256 persistido para detectar sustituciones o
    corrupción del ZIP antes de ejecutar código.
    """
    config = (execution or {}).get("execution_config") or {}
    if not isinstance(config, dict):
        raise ExecutionDispatchError(
            "execution_config no tiene un formato válido."
        )

    expected_name = str(
        config.get("original_filename") or ""
    ).replace("\\", "/").strip()
    if not expected_name:
        raise ExecutionDispatchError(
            "Execution sin original_filename persistido."
        )
    _safe_member_name(expected_name)

    try:
        source_index = int(config.get("source_index"))
    except (TypeError, ValueError):
        raise ExecutionDispatchError(
            "Execution sin source_index válido."
        )
    if source_index < 0:
        raise ExecutionDispatchError(
            "Execution con source_index inválido."
        )

    archive_path = _safe_archive_path(
        submission,
        base_dir,
    )

    expected_hash = str(
        (submission or {}).get("code_hash") or ""
    ).strip().lower()
    if (
        not re.fullmatch(r"[0-9a-f]{64}", expected_hash)
        or _sha256_file(archive_path) != expected_hash
    ):
        raise ExecutionDispatchError(
            "El ZIP persistido no coincide con su SHA-256."
        )

    try:
        with zipfile.ZipFile(str(archive_path), "r") as archive:
            cpp_members = []
            for info in archive.infolist():
                normalized = _safe_member_name(info.filename)
                if info.is_dir():
                    continue
                if normalized.lower().endswith(".cpp"):
                    cpp_members.append((normalized, info))

            if source_index >= len(cpp_members):
                raise ExecutionDispatchError(
                    "source_index no existe en el ZIP persistido."
                )

            normalized_name, info = cpp_members[source_index]
            if normalized_name != expected_name:
                raise ExecutionDispatchError(
                    "El source persistido no coincide con execution_config."
                )

            raw = archive.read(info)

    except zipfile.BadZipFile:
        raise ExecutionDispatchError(
            "El ZIP persistido ya no es un archivo válido."
        )

    try:
        content = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ExecutionDispatchError(
            "El source persistido ya no está codificado en UTF-8."
        )

    if "\x00" in content:
        raise ExecutionDispatchError(
            "El source persistido contiene bytes nulos."
        )

    return {
        "original_filename": expected_name,
        "content": content,
        "archive_path": str(archive_path),
    }


def materialize_execution_source(
    execution,
    submission,
    base_dir,
    test_dir,
):
    source = load_execution_source(
        execution,
        submission,
        base_dir,
    )

    codename = str(
        (execution or {}).get("codename") or ""
    ).strip()
    if not CODENAME_RE.fullmatch(codename):
        raise ExecutionDispatchError(
            "Execution con codename inválido."
        )

    target_root = Path(test_dir).resolve()
    target_root.mkdir(parents=True, exist_ok=True)
    target = (target_root / (codename + ".cpp")).resolve()
    if target.parent != target_root:
        raise ExecutionDispatchError(
            "Ruta técnica de source fuera de Server/test."
        )

    with target.open(
        "w",
        encoding="utf-8",
        newline="\n",
    ) as handle:
        handle.write(source["content"])

    return {
        **source,
        "source_path": str(target),
    }
