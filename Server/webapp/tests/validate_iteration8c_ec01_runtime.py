#!/usr/bin/env python3
"""Validador estructural/hardwareless focal de E-C01 / Iteración 8C."""

from io import BytesIO
from pathlib import Path
import hashlib
import subprocess
import sys
import tempfile
from unittest.mock import patch
import zipfile


ROOT = Path(__file__).resolve().parents[3]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from werkzeug.datastructures import FileStorage

from Server import slave
from Server.source_contract import (
    SourceContractError,
    enumerate_source_members,
)
from Server.webapp.services.execution_creation_service import (
    _resolve_v2_source_indices,
    derive_submission_language,
    validate_source_specs,
)
from Server.webapp.services.upload_service import store_and_inspect_zip
from Server.webapp.socketUtils import build_execution_payload


checks = []


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def check(label, condition):
    passed = bool(condition)
    checks.append(passed)
    print("{:<92} {}".format(label, "PASS" if passed else "FAIL"))


def unchanged_from_head(path):
    return subprocess.run(
        ["git", "diff", "--quiet", "HEAD", "--", path],
        cwd=ROOT,
    ).returncode == 0


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


with tempfile.TemporaryDirectory() as temp_dir:
    c_upload = store_and_inspect_zip(
        zip_storage([("main.c", b"int main(void){return 0;}\n")]),
        temp_dir,
    )
    cpp_upload = store_and_inspect_zip(
        zip_storage([("main.cpp", b"int main(){return 0;}\n")]),
        temp_dir,
    )
    mixed_upload = store_and_inspect_zip(
        zip_storage(
            [
                ("a.cpp", b"a"),
                ("b.c", b"b"),
                ("c.cpp", b"c"),
                ("d.c", b"d"),
            ]
        ),
        temp_dir,
    )

check("1. Upload público acepta C-only", len(c_upload.sources) == 1)
check("2. Upload público conserva C++-only", len(cpp_upload.sources) == 1)
check(
    "3. Upload público acepta mixed en orden ZIP",
    [item.original_filename for item in mixed_upload.sources]
    == ["a.cpp", "b.c", "c.cpp", "d.c"],
)

with tempfile.TemporaryDirectory() as temp_dir:
    archive_path = Path(temp_dir) / "interleaved.zip"
    with zipfile.ZipFile(str(archive_path), "w") as archive:
        for filename in ("a.cpp", "b.c", "c.cpp", "d.c"):
            archive.writestr(filename, filename)
    archive_sha256 = hashlib.sha256(archive_path.read_bytes()).hexdigest()
    indexed = _resolve_v2_source_indices(
        validate_source_specs(
            [{"original_filename": name} for name in ("a.cpp", "b.c", "c.cpp", "d.c")]
        ),
        str(archive_path),
        archive_sha256,
    )

check(
    "4. source_index interleaved es exactamente 0,1,2,3",
    [item["source_index"] for item in indexed] == [0, 1, 2, 3],
)
check(
    "5. Submission.language deriva C, C++ y C/C++",
    derive_submission_language(validate_source_specs([{"original_filename": "x.c"}]))
    == "C"
    and derive_submission_language(
        validate_source_specs([{"original_filename": "x.cpp"}])
    )
    == "C++"
    and derive_submission_language(indexed) == "C/C++",
)

c_spec, cpp_spec = validate_source_specs(
    [{"original_filename": "x.c"}, {"original_filename": "y.cpp"}]
)
check("6. C deriva compiler gcc", c_spec["compiler"] == "gcc")
check("7. C++ deriva compiler g++", cpp_spec["compiler"] == "g++")
check(
    "8. Flags permanecen cerrados en -O3",
    c_spec["compiler_flags"] == cpp_spec["compiler_flags"] == "-O3",
)

c_payload = build_execution_payload(
    name="cSIZE",
    code="source",
    input_size=2999,
    samples=10,
    source_contract_version=2,
    source_language="C",
    compiler="gcc",
    compiler_flags="-O3",
    technical_extension=".c",
    metadata_provenance="explicit",
)
legacy_payload = build_execution_payload(
    name="legacySIZE",
    code="source",
    input_size=2999,
    samples=10,
)
check(
    "9. Master emite payload v2 C completo",
    c_payload["payload_version"] == 2
    and c_payload["source_extension"] == ".c"
    and c_payload["compiler"] == "gcc",
)
legacy_metadata = slave.validate_source_payload(legacy_payload)
check(
    "10. Payload v1 legacy sigue aceptado como C++",
    legacy_payload["payload_version"] == 1
    and legacy_metadata.source_language == "C++"
    and legacy_metadata.compiler == "g++",
)
check(
    "11. Slave valida la combinación v2 completa",
    slave.validate_source_payload(c_payload).technical_extension == ".c",
)

bad_compiler = dict(c_payload, compiler="gcc;touch /tmp/unsafe")
try:
    slave.validate_source_payload(bad_compiler)
    compiler_injection_rejected = False
except slave.PayloadValidationError:
    compiler_injection_rejected = True
check("12. Compiler injection es rechazada", compiler_injection_rejected)

bad_flags = dict(c_payload, compiler_flags="-O3 -DUNSAFE=1")
try:
    slave.validate_source_payload(bad_flags)
    flag_injection_rejected = False
except slave.PayloadValidationError:
    flag_injection_rejected = True
check("13. Flag injection es rechazada", flag_injection_rejected)

with tempfile.TemporaryDirectory() as temp_dir:
    with patch.object(slave, "TEST_DIR", temp_dir):
        c_path = slave.write_code_to_file("cSIZE", "source", ".c")
        cpp_path = slave.write_code_to_file("cppSIZE", "source", ".cpp")
check("14. C se materializa técnicamente como .c", c_path.endswith(".c"))
check("15. C++ se materializa técnicamente como .cpp", cpp_path.endswith(".cpp"))

slave_source = read("Server/slave.py")
check(
    "16. Compile argv es cerrado y shell-free",
    slave.build_compile_argv("/tmp/a.c", "/tmp/a.out", "gcc")
    == ["gcc", "-O3", "/tmp/a.c", "-o", "/tmp/a.out"]
    and slave.build_compile_argv("/tmp/a.cpp", "/tmp/a.out", "g++")
    == ["g++", "-O3", "/tmp/a.cpp", "-o", "/tmp/a.out"]
    and "shell=False" in slave_source,
)
check(
    "17. C/C++ reutilizan el mismo run_benchmark/measurescript",
    all(
        token in slave_source
        for token in (
            'measure_script_name="measurescript3.sh"',
            'measure_script_name="measurescript4.sh"',
            'measure_script_name="measurescript5.sh"',
        )
    )
    and slave_source.count("def run_benchmark(") == 1,
)
check(
    "18. dataProcessing no tiene bifurcación por lenguaje",
    unchanged_from_head("Server/webapp/dataProcessing.py")
    and ".cpp" not in read("Server/webapp/dataProcessing.py")
    and 'source_language' not in read("Server/webapp/dataProcessing.py"),
)
check(
    "19. Results científico conserva schema 1.3",
    unchanged_from_head("Server/webapp/services/results_service.py")
    and 'SCHEMA_VERSION = "1.3"' in read(
        "Server/webapp/services/results_service.py"
    ),
)

hardware = read("Server/hardware_snapshot.py")
check(
    "20. Hardware snapshot conserva schema 1.0",
    '"schema_version": "1.0"' in hardware,
)
check(
    "21. Toolchain observado es aditivo y usa compiler --version",
    'snapshot["toolchain"]' in hardware
    and '[compiler, "--version"]' in hardware
    and '"family": "GNU"' in hardware,
)
repository = read("Server/webapp/repositories/system_status_repository.py")
check(
    "22. System Status sigue aceptando schema 1.0 con campos extra",
    "->> 'schema_version' = '1.0'" in repository
    and "jsonb_object_keys" not in repository
    and "'{toolchain" not in repository,
)

changed = subprocess.run(
    ["git", "status", "--porcelain=v1", "-uall"],
    cwd=ROOT,
    check=True,
    capture_output=True,
    text=True,
).stdout
check(
    "23. Schema y migrations no fueron modificados",
    unchanged_from_head("Server/db/schema.sql")
    and not any(
        "Server/db/migrations/" in line for line in changed.splitlines()
    ),
)

protected_paths = [
    "Client/my-app/src/screens/TutorialPage.js",
    "Client/my-app/src/screens/TutorialPage.css",
]
locale_diff = subprocess.run(
    [
        "git",
        "diff",
        "-U0",
        "HEAD",
        "--",
        "Client/my-app/src/i18n/locales/es.js",
        "Client/my-app/src/i18n/locales/en.js",
    ],
    cwd=ROOT,
    check=True,
    capture_output=True,
    text=True,
).stdout
check(
    "24. Tutorial permanece sin cambios funcionales durante integración 8D",
    all(unchanged_from_head(path) for path in protected_paths)
    and "tutorial" not in locale_diff.casefold(),
)

zip_analysis = read(
    "Client/my-app/src/screens/RenderForm/hooks/useZipAnalysis.js"
)
readiness = read(
    "Client/my-app/src/screens/RenderForm/analysisReadinessModel.js"
)
upload_card = read(
    "Client/my-app/src/screens/RenderForm/components/TestNameAndUploadCard.js"
)
check(
    "25. Nuevo análisis comprende sourceCount/cCount/cppCount/sourceSample",
    all(
        token in zip_analysis + readiness + upload_card
        for token in ("sourceCount", "cCount", "cppCount", "sourceSample")
    ),
)
locales = read("Client/my-app/src/i18n/locales/es.js") + read(
    "Client/my-app/src/i18n/locales/en.js"
)
check(
    "26. Copy mínimo ES/EN declara .c/.cpp y ejecución independiente",
    "Cada archivo .c o .cpp" in locales
    and "Each .c or .cpp file" in locales
    and "al menos un archivo .c o .cpp" in locales
    and "at least one .c or .cpp file" in locales,
)

fixture_hashes = {
    "Server/tests/fixtures/ec01/size_fixture.c": (
        "8c330e9f48472e354fcb0486826695814162a4e0a4e3e26ea9741076b70aceae"
    ),
    "Server/tests/fixtures/ec01/size_fixture.cpp": (
        "f03b118132f93e7c8cf49a7378c15edff4b1c85971cf6978aa143622199099a4"
    ),
}
check(
    "27. Golden fixtures C/C++ existen con SHA-256 congelado",
    all(
        hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
        for path, digest in fixture_hashes.items()
    ),
)


class Info:
    def __init__(self, filename):
        self.filename = filename

    def is_dir(self):
        return False


legacy_members = [Info("a.c"), Info("b.cpp"), Info("c.c"), Info("d.cpp")]
check(
    "28. Legacy source_index permanece cpp-only",
    [item.filename for item in enumerate_source_members(legacy_members, None)]
    == ["b.cpp", "d.cpp"],
)

check(
    "Pipeline científico versionado permanece byte-identical",
    all(
        unchanged_from_head(path)
        for path in (
            "Server/measurescript3.sh",
            "Server/measurescript4.sh",
            "Server/measurescript5.sh",
            "Server/webapp/dataProcessing.py",
            "Server/webapp/services/results_service.py",
        )
    ),
)

passed = sum(checks)
total = len(checks)
print("\nITERACIÓN 8C — E-C01 RUNTIME + GOLDEN")
print("=======================================")
print("{}/{} checks passed".format(passed, total))
if passed != total:
    print("RESULT: FAIL")
    raise SystemExit(1)
print("RESULT: PASS")
