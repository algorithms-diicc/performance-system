"""Manifest y bundle deterministas de identidad reproducible."""

from dataclasses import dataclass, field
from datetime import date, datetime
from io import BytesIO
import json
from pathlib import Path, PurePosixPath
import re
import stat
from typing import Optional
import zipfile

from ...source_contract import (
    COMPILER_C,
    COMPILER_CPP,
    SOURCE_CONTRACT_VERSION,
    is_supported_source_filename,
)
from .result_artifact_service import (
    ResultArtifact,
    inspect_result_artifact,
)
from .source_provenance_service import (
    SourceArtifact,
    SourceProvenanceError,
    inspect_archive,
    load_source_artifact,
    resolve_source_metadata_for_row,
    source_download_name,
)


MANIFEST_SCHEMA_VERSION = "1.0"
FIXED_ZIP_DATETIME = (1980, 1, 1, 0, 0, 0)
WINDOWS_DRIVE_RE = re.compile(r"^[A-Za-z]:")


class ReproducibilityError(Exception):
    """Error público sanitizado de una exportación compuesta."""

    def __init__(self, code, message, status_code):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class ReproducibilitySnapshot:
    manifest: dict
    manifest_bytes: bytes = field(repr=False)
    source_artifact: Optional[SourceArtifact] = field(default=None, repr=False)
    result_artifact: Optional[ResultArtifact] = field(default=None, repr=False)


def _mapping(value):
    return value if isinstance(value, dict) else {}


def _scalar(value):
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    return None


def _timestamp(value):
    if value is None:
        return None
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, str):
        return value
    return None


def _source_index(value):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return None
    return parsed if parsed >= 0 else None


def _public_source_filename(value):
    raw = str(value or "")
    if not raw or "\x00" in raw:
        return None
    normalized = raw.replace("\\", "/")
    path = PurePosixPath(normalized)
    if (
        path.is_absolute()
        or ".." in path.parts
        or WINDOWS_DRIVE_RE.match(normalized)
        or not path.name
        or not is_supported_source_filename(normalized)
    ):
        return None
    return normalized


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


def _measurement_configuration(execution_config):
    measurement = _mapping(execution_config.get("measurement"))
    return {
        "schemaVersion": _scalar(measurement.get("schema_version")),
        "points": _scalar(measurement.get("points")),
        "samplesPerPoint": _scalar(measurement.get("samples_per_point")),
        "warmupRounds": _scalar(measurement.get("warmup_rounds")),
        "perfScope": _scalar(measurement.get("perf_scope")),
        "singleEventFallback": _scalar(
            measurement.get("single_event_fallback")
        ),
    }


def _observed_toolchain(hardware_snapshot):
    snapshot = _mapping(hardware_snapshot)
    toolchain = _mapping(snapshot.get("toolchain"))
    compiler = _mapping(toolchain.get("compiler"))
    name = compiler.get("name")
    if name not in (COMPILER_C, COMPILER_CPP):
        return None

    family = compiler.get("family")
    if family != "GNU":
        family = None

    version = compiler.get("version")
    if isinstance(version, str):
        version = " ".join(version.split()).strip()
        if (
            not version
            or len(version) > 256
            or "/" in version
            or "\\" in version
        ):
            version = None
    else:
        version = None

    return {
        "compiler": {
            "family": family,
            "name": name,
            "version": version,
        }
    }


def _observed_environment(hardware_snapshot):
    snapshot = _mapping(hardware_snapshot)
    node = _mapping(snapshot.get("node"))
    measurement = _mapping(snapshot.get("measurement"))
    environment = {
        "source": "execution.hardware_snapshot",
        "cpu": {
            "vendor": _scalar(node.get("cpu_vendor")),
            "model": _scalar(node.get("cpu_model")),
            "architecture": _scalar(node.get("architecture")),
            "logicalCpus": _scalar(node.get("logical_cpus")),
        },
        "measurementBackend": {
            "name": _scalar(measurement.get("backend")),
            "version": _scalar(measurement.get("perf_version")),
            "requestedScope": _scalar(
                measurement.get("requested_perf_scope")
            ),
            "perfEventParanoid": _scalar(
                measurement.get("perf_event_paranoid")
            ),
        },
    }
    toolchain = _observed_toolchain(snapshot)
    if toolchain is not None:
        environment["toolchain"] = toolchain
    return environment


def serialize_manifest_bytes(manifest):
    """Serialización UTF-8 estable, sin reloj y con newline final."""
    text = json.dumps(
        manifest,
        ensure_ascii=False,
        sort_keys=True,
        indent=2,
        allow_nan=False,
    )
    return (text + "\n").encode("utf-8")


def build_reproducibility_snapshot(
    execution_row,
    *,
    server_root=None,
    uploads_root=None,
    static_dir=None,
):
    """Construye manifest y conserva los bytes ya verificados para exportar."""
    row = execution_row or {}
    execution_config = _mapping(row.get("execution_config"))
    source_metadata = None
    try:
        source_metadata = resolve_source_metadata_for_row(row)
    except SourceProvenanceError:
        pass

    archive = inspect_archive(
        row,
        server_root=server_root,
        uploads_root=uploads_root,
    )
    source_artifact = None
    if archive.available and source_metadata is not None:
        try:
            source_artifact = load_source_artifact(
                archive,
                row.get("source_filename"),
            )
        except SourceProvenanceError:
            source_artifact = None

    effective_static_dir = static_dir
    if effective_static_dir is None and server_root is not None:
        effective_static_dir = Path(server_root) / "webapp" / "static"

    results = inspect_result_artifact(
        row.get("codename"),
        row,
        static_dir=effective_static_dir,
        server_dir=server_root,
    )
    result_artifact = results.artifact if results.available else None

    persisted_source_filename = _public_source_filename(
        row.get("source_filename")
    )
    source_manifest = {
        "filename": persisted_source_filename,
        "sourceIndex": _source_index(row.get("source_index")),
        "available": source_artifact is not None,
        "sha256": source_artifact.sha256 if source_artifact else None,
        "sizeBytes": (
            source_artifact.size_bytes if source_artifact else None
        ),
        "hashProvenance": (
            "verified_archive_member" if source_artifact else None
        ),
    }
    configuration_manifest = {
        "inputSize": row.get("input_size"),
        "samples": row.get("samples"),
        "compilerFlags": _scalar(
            execution_config.get("compiler_flags")
        ),
        "measurement": _measurement_configuration(execution_config),
    }
    if (
        source_metadata is not None
        and source_metadata.source_contract_version
        == SOURCE_CONTRACT_VERSION
    ):
        source_manifest.update(
            {
                "language": source_metadata.source_language,
                "metadataProvenance": (
                    source_metadata.metadata_provenance
                ),
            }
        )
        configuration_manifest["compiler"] = source_metadata.compiler

    manifest = {
        "schemaVersion": MANIFEST_SCHEMA_VERSION,
        "submission": {
            "id": row.get("submission_id"),
            "title": row.get("submission_title"),
            "archive": {
                "originalFilename": _public_archive_original_filename(
                    row.get("archive_original_filename")
                ),
                "sha256": archive.expected_sha256,
                "available": archive.available,
                "integrity": archive.integrity,
            },
        },
        "execution": {
            "publicId": row.get("public_id"),
            "codename": row.get("codename"),
            "state": row.get("execution_state"),
            "benchmark": row.get("benchmark"),
            "profile": row.get("execution_profile"),
            "createdAt": _timestamp(row.get("created_at")),
            "startedAt": _timestamp(row.get("started_at")),
            "finishedAt": _timestamp(row.get("finished_at")),
        },
        "source": source_manifest,
        "configuration": configuration_manifest,
        "environmentObserved": _observed_environment(
            row.get("hardware_snapshot")
        ),
        "artifacts": {
            "measurements": {
                "filename": "CombinedResults.csv",
                "available": result_artifact is not None,
                "sha256": (
                    result_artifact.sha256 if result_artifact else None
                ),
                "sizeBytes": (
                    result_artifact.size_bytes if result_artifact else None
                ),
                "hashProvenance": (
                    "computed_on_export" if result_artifact else None
                ),
            }
        },
    }

    return ReproducibilitySnapshot(
        manifest=manifest,
        manifest_bytes=serialize_manifest_bytes(manifest),
        source_artifact=source_artifact,
        result_artifact=result_artifact,
    )


def _zip_info(filename):
    info = zipfile.ZipInfo(filename, date_time=FIXED_ZIP_DATETIME)
    info.compress_type = zipfile.ZIP_STORED
    info.create_system = 3
    info.external_attr = (stat.S_IFREG | 0o644) << 16
    return info


def build_bundle_bytes(snapshot):
    if snapshot.result_artifact is None:
        raise ReproducibilityError(
            "BUNDLE_MEASUREMENTS_UNAVAILABLE",
            "El bundle requiere mediciones canónicas disponibles.",
            409,
        )
    if snapshot.source_artifact is None:
        raise ReproducibilityError(
            "BUNDLE_SOURCE_UNAVAILABLE",
            "El bundle requiere la fuente histórica verificada.",
            409,
        )

    try:
        safe_source_name = source_download_name(snapshot.source_artifact)
    except SourceProvenanceError:
        raise ReproducibilityError(
            "BUNDLE_SOURCE_UNAVAILABLE",
            "El bundle requiere la fuente histórica verificada.",
            409,
        )

    output = BytesIO()
    with zipfile.ZipFile(
        output,
        mode="w",
        compression=zipfile.ZIP_STORED,
    ) as archive:
        archive.writestr(
            _zip_info("manifest.json"),
            snapshot.manifest_bytes,
        )
        archive.writestr(
            _zip_info("CombinedResults.csv"),
            snapshot.result_artifact.content_bytes,
        )
        archive.writestr(
            _zip_info("source/{}".format(safe_source_name)),
            snapshot.source_artifact.content_bytes,
        )

    return output.getvalue()
