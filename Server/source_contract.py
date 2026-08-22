"""Contrato cerrado de identidad de fuentes C/C++ para E-C01.

Este módulo no depende de Flask ni de la base de datos. 8B dejó disponible el
contrato v2 y 8C lo activa para C/C++ en persistencia, runtime, reconstrucción
y procedencia. Las extensiones se interpretan con ``casefold``;
por decisión de E-C01, ``.C`` representa C y se materializa técnicamente como
``.c`` en lugar de conservar la semántica especial que algunos compiladores
aplican a un nombre POSIX terminado en ``.C``.
"""

from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Mapping, Optional


SOURCE_CONTRACT_VERSION = 2
CANONICAL_COMPILER_FLAGS = "-O3"

LANGUAGE_C = "C"
LANGUAGE_CPP = "C++"
COMPILER_C = "gcc"
COMPILER_CPP = "g++"

METADATA_PROVENANCE_EXPLICIT = "explicit"
METADATA_PROVENANCE_LEGACY_CPP = "inferred_legacy_cpp"


class SourceContractError(ValueError):
    """La identidad persistida no pertenece al contrato cerrado."""


@dataclass(frozen=True)
class SourceMetadata:
    source_contract_version: Optional[int]
    source_language: str
    compiler: str
    compiler_flags: str
    technical_extension: str
    mime_type: str
    metadata_provenance: str

    def execution_config_fields(self):
        """Devuelve exclusivamente las claves persistibles del contrato v2."""
        if self.source_contract_version != SOURCE_CONTRACT_VERSION:
            raise SourceContractError(
                "Legacy source metadata cannot be persisted as contract v2."
            )
        return {
            "source_contract_version": SOURCE_CONTRACT_VERSION,
            "source_language": self.source_language,
            "compiler": self.compiler,
            "compiler_flags": self.compiler_flags,
        }


_IDENTITY_BY_EXTENSION = {
    ".c": {
        "source_language": LANGUAGE_C,
        "compiler": COMPILER_C,
        "technical_extension": ".c",
        "mime_type": "text/x-csrc",
    },
    ".cpp": {
        "source_language": LANGUAGE_CPP,
        "compiler": COMPILER_CPP,
        "technical_extension": ".cpp",
        "mime_type": "text/x-c++src",
    },
}


def source_extension(filename):
    """Retorna la extensión soportada normalizada o ``None``."""
    raw = str(filename or "")
    if not raw or "\x00" in raw:
        return None
    normalized = raw.replace("\\", "/")
    path = PurePosixPath(normalized)
    if not path.name:
        return None
    extension = path.suffix.casefold()
    return extension if extension in _IDENTITY_BY_EXTENSION else None


def is_supported_source_filename(filename):
    return source_extension(filename) is not None


def is_legacy_cpp_filename(filename):
    return source_extension(filename) == ".cpp"


def infer_v2_source_metadata(filename):
    """Deriva la tupla canónica v2 exclusivamente desde el filename."""
    extension = source_extension(filename)
    if extension is None:
        raise SourceContractError("Unsupported C/C++ source extension.")
    identity = _IDENTITY_BY_EXTENSION[extension]
    return SourceMetadata(
        source_contract_version=SOURCE_CONTRACT_VERSION,
        source_language=identity["source_language"],
        compiler=identity["compiler"],
        compiler_flags=CANONICAL_COMPILER_FLAGS,
        technical_extension=identity["technical_extension"],
        mime_type=identity["mime_type"],
        metadata_provenance=METADATA_PROVENANCE_EXPLICIT,
    )


def _parsed_contract_version(value):
    if isinstance(value, bool):
        raise SourceContractError("Invalid source contract version.")
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise SourceContractError("Invalid source contract version.")
    if parsed != SOURCE_CONTRACT_VERSION:
        raise SourceContractError("Unsupported source contract version.")
    return parsed


def validate_v2_source_metadata(config, filename=None):
    """Valida versión, extensión, lenguaje, compilador y flags explícitos."""
    if not isinstance(config, Mapping):
        raise SourceContractError("Source contract configuration must be a mapping.")

    _parsed_contract_version(config.get("source_contract_version"))
    source_filename = (
        filename
        if filename is not None
        else config.get("original_filename")
    )
    expected = infer_v2_source_metadata(source_filename)

    explicit = {
        "source_language": config.get("source_language"),
        "compiler": config.get("compiler"),
        "compiler_flags": config.get("compiler_flags"),
    }
    canonical = {
        "source_language": expected.source_language,
        "compiler": expected.compiler,
        "compiler_flags": expected.compiler_flags,
    }
    if explicit != canonical:
        raise SourceContractError(
            "Source extension, language, compiler and flags must match."
        )
    return expected


def validate_runtime_source_metadata(
    *,
    source_contract_version,
    source_language,
    compiler,
    compiler_flags,
    technical_extension,
):
    """Valida la tupla transportada entre Master y Slave.

    La extensión técnica no proviene de un nombre controlado por el cliente:
    debe ser exactamente la forma canónica ``.c`` o ``.cpp``. El resto de la
    tupla se contrasta con la misma regla cerrada usada al persistir v2.
    """
    if technical_extension not in _IDENTITY_BY_EXTENSION:
        raise SourceContractError(
            "Runtime source extension must be canonical .c or .cpp."
        )

    return validate_v2_source_metadata(
        {
            "source_contract_version": source_contract_version,
            "source_language": source_language,
            "compiler": compiler,
            "compiler_flags": compiler_flags,
        },
        filename="source{}".format(technical_extension),
    )


def infer_legacy_cpp_metadata(config, filename=None):
    """Interpreta el contrato histórico cpp-only sin mutar persistencia."""
    if not isinstance(config, Mapping):
        raise SourceContractError("Legacy source configuration must be a mapping.")
    source_filename = (
        filename
        if filename is not None
        else config.get("original_filename")
    )
    if not is_legacy_cpp_filename(source_filename):
        raise SourceContractError("Legacy source metadata requires a .cpp filename.")

    raw_flags = config.get("compiler_flags")
    compiler_flags = str(raw_flags or CANONICAL_COMPILER_FLAGS).strip()
    if not compiler_flags:
        compiler_flags = CANONICAL_COMPILER_FLAGS

    identity = _IDENTITY_BY_EXTENSION[".cpp"]
    return SourceMetadata(
        source_contract_version=None,
        source_language=LANGUAGE_CPP,
        compiler=COMPILER_CPP,
        compiler_flags=compiler_flags,
        technical_extension=identity["technical_extension"],
        mime_type=identity["mime_type"],
        metadata_provenance=METADATA_PROVENANCE_LEGACY_CPP,
    )


def resolve_source_metadata(config, filename=None):
    """Resuelve explícitamente v2 o el modo legacy por ausencia de versión."""
    if not isinstance(config, Mapping):
        raise SourceContractError("Source configuration must be a mapping.")
    if "source_contract_version" not in config:
        return infer_legacy_cpp_metadata(config, filename=filename)
    return validate_v2_source_metadata(config, filename=filename)


def filename_matches_contract_version(filename, contract_version):
    """Aplica el filtro histórico cpp-only o el filtro combinado v2."""
    if contract_version is None:
        return is_legacy_cpp_filename(filename)
    _parsed_contract_version(contract_version)
    return is_supported_source_filename(filename)


def enumerate_source_members(infos, contract_version):
    """Filtra miembros sin alterar el orden recibido por ``ZipInfo``."""
    members = []
    for info in infos:
        is_dir = getattr(info, "is_dir", None)
        if callable(is_dir) and is_dir():
            continue
        if filename_matches_contract_version(
            getattr(info, "filename", ""),
            contract_version,
        ):
            members.append(info)
    return members


def mime_type_for_filename(filename):
    return infer_v2_source_metadata(filename).mime_type


def technical_extension_for_filename(filename):
    return infer_v2_source_metadata(filename).technical_extension
