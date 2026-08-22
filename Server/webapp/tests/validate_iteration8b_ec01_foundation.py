#!/usr/bin/env python3
"""Validador estructural focal de E-C01 / Iteración 8B."""

from io import BytesIO
from pathlib import Path
import subprocess
import sys
import tempfile
import zipfile


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from werkzeug.datastructures import FileStorage

from Server.source_contract import (
    SOURCE_CONTRACT_VERSION,
    SourceContractError,
    enumerate_source_members,
    infer_v2_source_metadata,
    resolve_source_metadata,
)
from Server.webapp.services.execution_creation_service import (
    InvalidExecutionRequest,
    validate_source_specs,
)
from Server.webapp.services.source_provenance_service import (
    SourceArtifact,
    source_download_name,
    source_mime_type,
)
from Server.webapp.services.upload_service import (
    UploadValidationError,
    store_and_inspect_zip,
)


checks = []


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def check(label, condition):
    passed = bool(condition)
    checks.append(passed)
    print("{:<88} {}".format(label, "PASS" if passed else "FAIL"))


def unchanged_from_head(path):
    expected = subprocess.run(
        ["git", "show", "HEAD:{}".format(path)],
        cwd=ROOT,
        check=True,
        capture_output=True,
    ).stdout
    return (ROOT / path).read_bytes() == expected


def zip_storage(entries):
    output = BytesIO()
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, content in entries:
            archive.writestr(name, content)
    output.seek(0)
    return FileStorage(
        stream=output,
        filename="sources.zip",
        content_type="application/zip",
    )


source_contract = read("Server/source_contract.py")
creation = read(
    "Server/webapp/services/execution_creation_service.py"
)
dispatch = read(
    "Server/webapp/services/execution_dispatch_service.py"
)
provenance = read(
    "Server/webapp/services/source_provenance_service.py"
)
trace_repository = read(
    "Server/webapp/repositories/trace_repository.py"
)
trace_routes = read("Server/webapp/routes/trace_routes.py")
reproducibility = read(
    "Server/webapp/services/reproducibility_service.py"
)

c_metadata = infer_v2_source_metadata("nested/SOURCE.C")
cpp_metadata = infer_v2_source_metadata("nested/SOURCE.CPP")
check(
    "Existe source contract cerrado con versión 2",
    SOURCE_CONTRACT_VERSION == 2
    and "SOURCE_CONTRACT_VERSION = 2" in source_contract,
)
check(
    "C/.C deriva gcc, -O3, .c y MIME C",
    c_metadata.source_language == "C"
    and c_metadata.compiler == "gcc"
    and c_metadata.compiler_flags == "-O3"
    and c_metadata.technical_extension == ".c"
    and c_metadata.mime_type == "text/x-csrc",
)
check(
    "C++/.CPP deriva g++, -O3, .cpp y MIME C++",
    cpp_metadata.source_language == "C++"
    and cpp_metadata.compiler == "g++"
    and cpp_metadata.compiler_flags == "-O3"
    and cpp_metadata.technical_extension == ".cpp"
    and cpp_metadata.mime_type == "text/x-c++src",
)

unsupported_rejected = True
for filename in ("x.cc", "x.cxx", "x.h", "x.hpp"):
    try:
        infer_v2_source_metadata(filename)
    except SourceContractError:
        continue
    unsupported_rejected = False
check(".cc/.cxx/.h/.hpp no son Executions", unsupported_rejected)

normalized_spec = validate_source_specs(
    [
        {
            "original_filename": "main.cpp",
            "source_contract_version": 999,
            "source_language": "C",
            "compiler": "unsafe",
            "compiler_flags": "-O0",
        }
    ]
)[0]
check(
    "Nuevas C++ derivan metadata explícita v2",
    normalized_spec["source_contract_version"] == 2
    and normalized_spec["source_language"] == "C++"
    and normalized_spec["compiler"] == "g++"
    and normalized_spec["compiler_flags"] == "-O3",
)
check(
    "Compiler/flags/language de source_specs no controlan persistencia",
    "unsafe" not in normalized_spec.values()
    and "-O0" not in normalized_spec.values()
    and normalized_spec["source_language"] != "C",
)

c_creation = validate_source_specs([{"original_filename": "main.c"}])[0]
check(
    "Foundation v2 permite activar C sin metadata controlada por cliente",
    c_creation["source_language"] == "C"
    and c_creation["compiler"] == "gcc"
    and c_creation["compiler_flags"] == "-O3",
)


class Info:
    def __init__(self, filename):
        self.filename = filename

    def is_dir(self):
        return False


members = [Info("helper.c"), Info("target.cpp"), Info("other.CPP")]
check(
    "Legacy sin versión conserva enumeración cpp-only",
    [item.filename for item in enumerate_source_members(members, None)]
    == ["target.cpp", "other.CPP"],
)
check(
    "Contrato v2 enumera C/C++ en orden combinado",
    [item.filename for item in enumerate_source_members(members, 2)]
    == ["helper.c", "target.cpp", "other.CPP"],
)
check(
    "Dispatcher verifica index + filename y materializa extensión segura",
    "enumerate_source_members(" in dispatch
    and "normalized_name != expected_name" in dispatch
    and 'source["technical_extension"]' in dispatch,
)

legacy_metadata = resolve_source_metadata(
    {"original_filename": "legacy.cpp"}
)
check(
    "Metadata legacy se infiere C++/g++ con provenance explícita",
    legacy_metadata.source_language == "C++"
    and legacy_metadata.compiler == "g++"
    and legacy_metadata.compiler_flags == "-O3"
    and legacy_metadata.metadata_provenance == "inferred_legacy_cpp",
)

c_artifact = SourceArtifact(
    filename="nested/source.c",
    content_bytes=b"int main(void){return 0;}\n",
    size_bytes=26,
    sha256="0" * 64,
)
cpp_artifact = SourceArtifact(
    filename="nested/source.cpp",
    content_bytes=b"int main(){return 0;}\n",
    size_bytes=22,
    sha256="1" * 64,
)
check(
    "Provenance y descarga aceptan nombres C/C++ seguros",
    source_download_name(c_artifact) == "source.c"
    and source_download_name(cpp_artifact) == "source.cpp",
)
check(
    "Descarga selecciona MIME C/C++ correcto",
    source_mime_type(c_artifact) == "text/x-csrc"
    and source_mime_type(cpp_artifact) == "text/x-c++src"
    and "source_mime_type(artifact)" in trace_routes,
)
check(
    "Trace publica metadata explícita/inferida sin configuration completa",
    all(
        token in provenance
        for token in (
            '"language"',
            '"compiler"',
            '"compilerFlags"',
            '"metadataProvenance"',
        )
    )
    and "source_contract_version" in trace_repository,
)
check(
    "Manifest conserva schema 1.0 y metadata solo para v2",
    'MANIFEST_SCHEMA_VERSION = "1.0"' in reproducibility
    and "source_metadata.source_contract_version" in reproducibility
    and 'configuration_manifest["compiler"]' in reproducibility,
)
check(
    "Manifest legacy no recibe campos E-C01 automáticamente",
    "source_manifest.update(" in reproducibility
    and "== SOURCE_CONTRACT_VERSION" in reproducibility,
)

with tempfile.TemporaryDirectory() as temp_dir:
    c_upload = store_and_inspect_zip(
        zip_storage(
            [("main.c", b"int main(void){return 0;}\n")]
        ),
        temp_dir,
    )
check("Activación 8C acepta C-only sobre foundation v2", len(c_upload.sources) == 1)

check(
    "Upload y /sendcode reutilizan inferencia central de source_contract",
    "is_supported_source_filename" in read(
        "Server/webapp/services/upload_service.py"
    )
    and "infer_v2_source_metadata" in read("Server/webapp/app.py"),
)
check(
    "Snapshot mantiene schema 1.0 e Iteración 7 permanece intacta",
    '"schema_version": "1.0"' in read("Server/hardware_snapshot.py")
    and all(
        unchanged_from_head(path)
        for path in (
            "Server/webapp/repositories/system_status_repository.py",
            "Server/webapp/services/system_status_service.py",
            "Server/webapp/routes/admin_system_status_routes.py",
        )
    ),
)
check(
    "Activación runtime no altera perf ni postproceso científico",
    all(
        unchanged_from_head(path)
        for path in (
            "Server/measurescript3.sh",
            "Server/measurescript4.sh",
            "Server/measurescript5.sh",
            "Server/webapp/dataProcessing.py",
        )
    ),
)
check(
    "Schema y migrations permanecen intactos",
    unchanged_from_head("Server/db/schema.sql")
    and all(
        unchanged_from_head(str(path.relative_to(ROOT)))
        for path in (ROOT / "Server/db/migrations").glob("*.sql")
    ),
)
check(
    "README y configuración permanecen intactos",
    unchanged_from_head("README.md")
    and unchanged_from_head(".env.example")
)

production_changes = "\n".join(
    (source_contract, creation, dispatch, provenance, trace_routes, reproducibility)
)
check(
    "8B no introduce variables de entorno ni configuración runtime",
    "os.getenv" not in production_changes
    and "os.environ" not in production_changes,
)

status_lines = subprocess.run(
    ["git", "status", "--porcelain=v1", "-uall"],
    cwd=ROOT,
    check=True,
    capture_output=True,
    text=True,
).stdout.splitlines()
changed_paths = {line[3:] for line in status_lines if len(line) > 3}
forbidden_paths = {
    "Server/db/schema.sql",
    "README.md",
    "Client/my-app/src/screens/TutorialPage.js",
    "Client/my-app/src/screens/ComparisonPage.js",
}
check(
    "Foundation sigue sin tocar schema/README/Tutorial/Comparison",
    changed_paths.isdisjoint(forbidden_paths)
    and not any("Server/db/migrations/" in path for path in changed_paths),
)
check(
    "Tests focales y validador 8B existen",
    all(
        (ROOT / path).is_file()
        for path in (
            "Server/tests/test_source_contract.py",
            "Server/tests/test_execution_creation_service.py",
            "Server/tests/test_execution_dispatch_service.py",
            "Server/tests/test_source_provenance_service.py",
            "Server/tests/test_reproducibility_service.py",
            "Server/webapp/tests/validate_iteration8b_ec01_foundation.py",
        )
    ),
)

passed = sum(checks)
total = len(checks)
print("\nITERACIÓN 8B — E-C01 FOUNDATION")
print("================================")
print("{}/{} checks passed".format(passed, total))
if passed != total:
    print("RESULT: FAIL")
    raise SystemExit(1)
print("RESULT: PASS")
