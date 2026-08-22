import unittest

from Server.source_contract import (
    CANONICAL_COMPILER_FLAGS,
    METADATA_PROVENANCE_LEGACY_CPP,
    SOURCE_CONTRACT_VERSION,
    SourceContractError,
    enumerate_source_members,
    infer_v2_source_metadata,
    resolve_source_metadata,
    validate_v2_source_metadata,
)


class FakeZipInfo:
    def __init__(self, filename, is_dir=False):
        self.filename = filename
        self._is_dir = is_dir

    def is_dir(self):
        return self._is_dir


class SourceContractTests(unittest.TestCase):
    def test_c_and_uppercase_c_map_to_canonical_c(self):
        for filename in ("source.c", "nested/SOURCE.C"):
            with self.subTest(filename=filename):
                metadata = infer_v2_source_metadata(filename)
                self.assertEqual(
                    metadata.source_contract_version,
                    SOURCE_CONTRACT_VERSION,
                )
                self.assertEqual(metadata.source_language, "C")
                self.assertEqual(metadata.compiler, "gcc")
                self.assertEqual(
                    metadata.compiler_flags,
                    CANONICAL_COMPILER_FLAGS,
                )
                self.assertEqual(metadata.technical_extension, ".c")
                self.assertEqual(metadata.mime_type, "text/x-csrc")

    def test_cpp_and_uppercase_cpp_map_to_canonical_cpp(self):
        for filename in ("source.cpp", "nested/SOURCE.CPP"):
            with self.subTest(filename=filename):
                metadata = infer_v2_source_metadata(filename)
                self.assertEqual(metadata.source_language, "C++")
                self.assertEqual(metadata.compiler, "g++")
                self.assertEqual(metadata.compiler_flags, "-O3")
                self.assertEqual(metadata.technical_extension, ".cpp")
                self.assertEqual(metadata.mime_type, "text/x-c++src")

    def test_unsupported_extensions_are_rejected(self):
        for filename in (
            "source.cc",
            "source.cxx",
            "source.h",
            "source.hpp",
            "source.txt",
        ):
            with self.subTest(filename=filename):
                with self.assertRaises(SourceContractError):
                    infer_v2_source_metadata(filename)

    def test_v2_rejects_language_compiler_flags_and_version_mismatch(self):
        canonical = {
            "source_contract_version": 2,
            "original_filename": "source.cpp",
            "source_language": "C++",
            "compiler": "g++",
            "compiler_flags": "-O3",
        }
        validate_v2_source_metadata(canonical)

        for key, invalid_value in (
            ("source_contract_version", 1),
            ("source_language", "C"),
            ("compiler", "gcc"),
            ("compiler_flags", "-O0"),
        ):
            with self.subTest(key=key):
                invalid = dict(canonical, **{key: invalid_value})
                with self.assertRaises(SourceContractError):
                    validate_v2_source_metadata(invalid)

    def test_legacy_is_cpp_only_and_uses_historical_flag_fallback(self):
        fallback = resolve_source_metadata(
            {"original_filename": "target.cpp"}
        )
        persisted = resolve_source_metadata(
            {
                "original_filename": "target.cpp",
                "compiler_flags": "-O2",
            }
        )
        self.assertIsNone(fallback.source_contract_version)
        self.assertEqual(fallback.source_language, "C++")
        self.assertEqual(fallback.compiler, "g++")
        self.assertEqual(fallback.compiler_flags, "-O3")
        self.assertEqual(
            fallback.metadata_provenance,
            METADATA_PROVENANCE_LEGACY_CPP,
        )
        self.assertEqual(persisted.compiler_flags, "-O2")
        with self.assertRaises(SourceContractError):
            resolve_source_metadata({"original_filename": "helper.c"})

    def test_member_enumeration_preserves_dual_source_index_semantics(self):
        infos = [
            FakeZipInfo("notes.txt"),
            FakeZipInfo("helper.c"),
            FakeZipInfo("target.cpp"),
            FakeZipInfo("nested", is_dir=True),
            FakeZipInfo("other.CPP"),
        ]
        self.assertEqual(
            [item.filename for item in enumerate_source_members(infos, None)],
            ["target.cpp", "other.CPP"],
        )
        self.assertEqual(
            [item.filename for item in enumerate_source_members(infos, 2)],
            ["helper.c", "target.cpp", "other.CPP"],
        )


if __name__ == "__main__":
    unittest.main()
