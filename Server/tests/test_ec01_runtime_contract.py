import os
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

from Server import hardware_snapshot
from Server import slave
from Server.source_contract import SourceContractError
from Server.webapp.socketUtils import build_execution_payload


def v2_payload(language="C", extension=".c", compiler="gcc", flags="-O3"):
    return {
        "payload_version": 2,
        "name": "goldenSIZE",
        "cmd": "-O3",
        "code": "int main(void) { return 0; }\n",
        "input_size": 2999,
        "samples": 10,
        "measurement": {},
        "source_language": language,
        "source_extension": extension,
        "compiler": compiler,
        "compiler_flags": flags,
    }


class MasterPayloadTests(unittest.TestCase):
    def test_master_builds_exact_v2_payload_for_c_and_cpp(self):
        cases = (
            ("C", ".c", "gcc"),
            ("C++", ".cpp", "g++"),
        )
        for language, extension, compiler in cases:
            with self.subTest(language=language):
                payload = build_execution_payload(
                    name="goldenSIZE",
                    code="source",
                    input_size=2999,
                    samples=10,
                    measurement={"points": 10},
                    source_contract_version=2,
                    source_language=language,
                    compiler=compiler,
                    compiler_flags="-O3",
                    technical_extension=extension,
                    metadata_provenance="explicit",
                )

                self.assertEqual(payload["payload_version"], 2)
                self.assertEqual(payload["source_language"], language)
                self.assertEqual(payload["source_extension"], extension)
                self.assertEqual(payload["compiler"], compiler)
                self.assertEqual(payload["compiler_flags"], "-O3")
                self.assertEqual(payload["cmd"], "-O3")

    def test_master_legacy_payload_remains_cpp_v1_and_ignores_cmd_override(self):
        payload = build_execution_payload(
            name="legacySIZE",
            code="source",
            input_size=100,
            samples=10,
            measurement={},
        )

        self.assertEqual(payload["payload_version"], 1)
        self.assertEqual(payload["cmd"], "-O3")
        self.assertNotIn("compiler", payload)
        metadata = slave.validate_source_payload(payload)
        self.assertEqual(metadata.source_language, "C++")
        self.assertEqual(metadata.compiler, "g++")
        self.assertEqual(metadata.technical_extension, ".cpp")

    def test_master_rejects_noncanonical_v2_metadata(self):
        with self.assertRaises(SourceContractError):
            build_execution_payload(
                name="badSIZE",
                code="source",
                input_size=100,
                samples=10,
                source_contract_version=2,
                source_language="C",
                compiler="gcc;touch /tmp/unsafe",
                compiler_flags="-O3",
                technical_extension=".c",
                metadata_provenance="explicit",
            )


class SlaveValidationTests(unittest.TestCase):
    def test_slave_accepts_exact_c_and_cpp_v2(self):
        c_metadata = slave.validate_source_payload(v2_payload())
        cpp_metadata = slave.validate_source_payload(
            v2_payload("C++", ".cpp", "g++")
        )

        self.assertEqual(c_metadata.compiler, "gcc")
        self.assertEqual(c_metadata.technical_extension, ".c")
        self.assertEqual(cpp_metadata.compiler, "g++")
        self.assertEqual(cpp_metadata.technical_extension, ".cpp")

    def test_slave_rejects_mismatches_injection_and_unknown_versions(self):
        invalid_payloads = []
        for field, value in (
            ("compiler", "g++"),
            ("source_extension", ".cpp"),
            ("source_language", "C++"),
            ("compiler_flags", "-O0"),
            ("compiler", "/usr/bin/gcc"),
            ("compiler", "gcc;touch /tmp/unsafe"),
            ("compiler_flags", "-O3 -DUNSAFE=1"),
        ):
            payload = v2_payload()
            payload[field] = value
            invalid_payloads.append(payload)
        invalid_payloads.append({**v2_payload(), "payload_version": 3})
        invalid_payloads.append({**v2_payload(), "payload_version": 2.0})

        for payload in invalid_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(slave.PayloadValidationError):
                    slave.validate_source_payload(payload)

    def test_v2_cmd_is_legacy_only_and_never_changes_compiler_argv(self):
        payload = v2_payload()
        payload["cmd"] = "-O0; touch /tmp/unsafe"
        metadata = slave.validate_source_payload(payload)

        argv = slave.build_compile_argv(
            "/tmp/golden.c",
            "/tmp/golden.out",
            metadata.compiler,
        )
        self.assertEqual(
            argv,
            ["gcc", "-O3", "/tmp/golden.c", "-o", "/tmp/golden.out"],
        )

    def test_materialization_uses_only_validated_canonical_extension(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            with patch.object(slave, "TEST_DIR", temp_dir):
                c_path = slave.write_code_to_file(
                    "goldenSIZE",
                    "int main(void) { return 0; }\n",
                    ".c",
                )
                cpp_path = slave.write_code_to_file(
                    "goldenCppSIZE",
                    "int main() { return 0; }\n",
                    ".cpp",
                )

                self.assertEqual(Path(c_path).suffix, ".c")
                self.assertEqual(Path(cpp_path).suffix, ".cpp")
                with self.assertRaises(ValueError):
                    slave.write_code_to_file("../escape", "source", ".c")
                with self.assertRaises(ValueError):
                    slave.write_code_to_file("safeSIZE", "source", ".cc")


class CompileArgvTests(unittest.TestCase):
    def test_compile_subprocess_uses_exact_shell_free_argv(self):
        cases = (
            ("gcc", ".c"),
            ("g++", ".cpp"),
        )

        for compiler, extension in cases:
            with self.subTest(compiler=compiler):
                with tempfile.TemporaryDirectory() as temp_dir:
                    source = os.path.join(temp_dir, "fixture" + extension)
                    executable = os.path.join(temp_dir, "fixture.out")
                    completed = SimpleNamespace(
                        returncode=1,
                        stdout="",
                        stderr="expected compile failure",
                    )
                    with ExitStack() as stack:
                        stack.enter_context(
                            patch.object(slave, "SERVER_DIR", temp_dir)
                        )
                        stack.enter_context(
                            patch.object(
                            slave,
                            "STATIC_DIR",
                            os.path.join(temp_dir, "static"),
                            )
                        )
                        stack.enter_context(
                            patch.object(
                            slave,
                            "executable_path",
                            return_value=executable,
                            )
                        )
                        stack.enter_context(patch.object(slave, "log_admin"))
                        stack.enter_context(
                            patch.object(slave, "log_admin_stage")
                        )
                        stack.enter_context(
                            patch.object(slave, "cleanup_files")
                        )
                        run_mock = stack.enter_context(
                            patch.object(
                                slave.sub,
                                "run",
                                return_value=completed,
                            )
                        )
                        slave.run_benchmark(
                            test_type="SIZE",
                            source_file=source,
                            input_size=2999,
                            samples=10,
                            measure_script_name="measurescript5.sh",
                            measure_args=[2999, 10],
                            measurement={},
                            compiler=compiler,
                        )

                    args, kwargs = run_mock.call_args
                    self.assertEqual(
                        args[0],
                        [compiler, "-O3", source, "-o", executable],
                    )
                    self.assertIs(kwargs["shell"], False)


class ToolchainSnapshotTests(unittest.TestCase):
    def test_gcc_and_gpp_versions_are_observed_with_shell_disabled(self):
        for compiler in ("gcc", "g++"):
            with self.subTest(compiler=compiler):
                completed = SimpleNamespace(
                    returncode=0,
                    stdout="{} (GNU) 11.4.0\nCopyright".format(compiler),
                    stderr="",
                )
                with patch.object(
                    hardware_snapshot.subprocess,
                    "run",
                    return_value=completed,
                ) as run_mock:
                    observed = hardware_snapshot._compiler_snapshot(compiler)

                self.assertEqual(observed["family"], "GNU")
                self.assertEqual(observed["name"], compiler)
                self.assertEqual(
                    observed["version"],
                    "{} (GNU) 11.4.0".format(compiler),
                )
                self.assertEqual(run_mock.call_args.args[0], [compiler, "--version"])
                self.assertIs(run_mock.call_args.kwargs["shell"], False)

    def test_compiler_probe_failure_is_additive_and_keeps_schema_1_0(self):
        with patch.object(
            hardware_snapshot.subprocess,
            "run",
            side_effect=hardware_snapshot.subprocess.TimeoutExpired(
                cmd=["gcc", "--version"],
                timeout=5,
            ),
        ):
            observed = hardware_snapshot._compiler_snapshot("gcc")

        self.assertEqual(observed["family"], "GNU")
        self.assertEqual(observed["name"], "gcc")
        self.assertIsNone(observed["version"])

        with ExitStack() as stack:
            stack.enter_context(
                patch.object(hardware_snapshot, "_perf_list", return_value="")
            )
            stack.enter_context(
                patch.object(
                    hardware_snapshot,
                    "_perf_version",
                    return_value="perf version TEST",
                )
            )
            stack.enter_context(
                patch.object(
                    hardware_snapshot,
                    "_powercap_domains",
                    return_value={},
                )
            )
            stack.enter_context(
                patch.object(
                    hardware_snapshot,
                    "_compiler_snapshot",
                    return_value=observed,
                )
            )
            snapshot = hardware_snapshot.collect_hardware_snapshot(
                measurement={"perf_scope": "process"},
                compiler="gcc",
            )

        self.assertEqual(snapshot["schema_version"], "1.0")
        self.assertEqual(snapshot["measurement"]["backend"], "perf")
        self.assertEqual(
            set(snapshot["energy"]),
            {"EnergyPkg", "EnergyCores", "EnergyRAM"},
        )
        self.assertIsNone(snapshot["toolchain"]["compiler"]["version"])


if __name__ == "__main__":
    unittest.main()
