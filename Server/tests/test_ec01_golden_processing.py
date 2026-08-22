import csv
import hashlib
from contextlib import ExitStack
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from Server.tests.plotly_test_support import ensure_plotly_importable

ensure_plotly_importable()

from Server.webapp import dataProcessing
from Server.webapp.services import results_service


ROOT = Path(__file__).resolve().parents[2]
FIXTURE_DIR = ROOT / "Server" / "tests" / "fixtures" / "ec01"

GOLDEN_CPP_BASELINE = {
    "git_commit": "8e4d8f96a2560dada145cf9ec64a7c380bb00ff2",
    "execution_id": 132,
    "source": "size_fixture.cpp",
    "benchmark": "SIZE",
    "profile": "QUICK",
    "input_size": 2999,
    "points": 10,
    "samples_per_point": 10,
    "warmup_rounds": 1,
    "compiler": "g++",
    "compiler_flags": "-O3",
    "terminal": "COMPLETED",
    "measurements": 100,
    "combined_columns": 31,
    "results_schema": "1.3",
    "hardware_snapshot_present": True,
    "previous_campaign": "17/17 PASS",
}

SIZE_SEQUENCE = [
    300,
    600,
    900,
    1200,
    1500,
    1800,
    2100,
    2400,
    2700,
    2999,
]

RAW_HEADER = [
    "Increment",
    "InputSize",
    "Instructions",
    "LLCLoads",
    "LLCLoadMisses",
    "LLCStores",
    "LLCStoreMisses",
    "L1DcacheLoads",
    "L1DcacheLoadMisses",
    "L1DcacheStores",
    "CacheReferences",
    "CacheMisses",
    "Branches",
    "BranchMisses",
    "CpuCycles",
    "TaskClock",
    "CpuClock",
    "PageFaults",
    "MajorFaults",
    "EnergyPkg",
    "EnergyCores",
    "EnergyRAM",
    "StartTime",
    "EndTime",
    "DurationTime",
    "NormalizedInstructions",
    "NormalizedCacheMisses",
]

COMBINED_HEADER = RAW_HEADER[:-2] + [
    "IPC",
    "CacheMissRate",
    "BranchMissRate",
    "BranchMissesPerMI",
    "CacheMissesPerMI",
    "source",
]

FIXTURE_SHA256 = {
    "size_fixture.c": (
        "8c330e9f48472e354fcb0486826695814162a4e0a4e3e26ea9741076b70aceae"
    ),
    "size_fixture.cpp": (
        "f03b118132f93e7c8cf49a7378c15edff4b1c85971cf6978aa143622199099a4"
    ),
}


def write_synthetic_raw(path):
    with Path(path).open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(RAW_HEADER)
        for increment, input_size in enumerate(SIZE_SEQUENCE, start=1):
            for sample in range(10):
                instructions = input_size * 10 + sample + 1
                cycles = instructions * 2
                cache_references = input_size + 100
                cache_misses = increment + sample + 1
                branches = input_size + 50
                branch_misses = increment + sample
                writer.writerow(
                    [
                        increment,
                        input_size,
                        instructions,
                        100 + sample,
                        10 + sample,
                        90 + sample,
                        9 + sample,
                        200 + sample,
                        20 + sample,
                        180 + sample,
                        cache_references,
                        cache_misses,
                        branches,
                        branch_misses,
                        cycles,
                        1.0 + sample / 10.0,
                        1.1 + sample / 10.0,
                        sample,
                        0,
                        0.1,
                        0.05,
                        0.02,
                        1000 + sample,
                        1001 + sample,
                        1.0,
                        instructions,
                        cache_misses,
                    ]
                )


class Ec01GoldenProcessingTests(unittest.TestCase):
    def test_cpp_golden_baseline_contract_is_frozen(self):
        self.assertEqual(
            GOLDEN_CPP_BASELINE["git_commit"],
            "8e4d8f96a2560dada145cf9ec64a7c380bb00ff2",
        )
        self.assertEqual(GOLDEN_CPP_BASELINE["execution_id"], 132)
        self.assertEqual(GOLDEN_CPP_BASELINE["source"], "size_fixture.cpp")
        self.assertEqual(GOLDEN_CPP_BASELINE["benchmark"], "SIZE")
        self.assertEqual(GOLDEN_CPP_BASELINE["profile"], "QUICK")
        self.assertEqual(GOLDEN_CPP_BASELINE["input_size"], 2999)
        self.assertEqual(GOLDEN_CPP_BASELINE["compiler"], "g++")
        self.assertEqual(GOLDEN_CPP_BASELINE["compiler_flags"], "-O3")
        self.assertEqual(GOLDEN_CPP_BASELINE["terminal"], "COMPLETED")
        self.assertEqual(GOLDEN_CPP_BASELINE["points"], 10)
        self.assertEqual(GOLDEN_CPP_BASELINE["samples_per_point"], 10)
        self.assertEqual(GOLDEN_CPP_BASELINE["warmup_rounds"], 1)
        self.assertEqual(GOLDEN_CPP_BASELINE["measurements"], 100)
        self.assertEqual(GOLDEN_CPP_BASELINE["combined_columns"], 31)
        self.assertEqual(GOLDEN_CPP_BASELINE["results_schema"], "1.3")
        self.assertIs(GOLDEN_CPP_BASELINE["hardware_snapshot_present"], True)
        self.assertEqual(GOLDEN_CPP_BASELINE["previous_campaign"], "17/17 PASS")
        self.assertEqual(
            SIZE_SEQUENCE,
            [300, 600, 900, 1200, 1500, 1800, 2100, 2400, 2700, 2999],
        )

    def test_golden_fixture_hashes_are_versioned_and_exact(self):
        for filename, expected_hash in FIXTURE_SHA256.items():
            with self.subTest(filename=filename):
                contents = (FIXTURE_DIR / filename).read_bytes()
                self.assertEqual(
                    hashlib.sha256(contents).hexdigest(),
                    expected_hash,
                )

    def test_c_and_cpp_share_identical_processing_and_results_contract(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            static_dir = Path(temp_dir)
            cases = (
                ("goldenCppSIZE", "size_fixture.cpp"),
                ("goldenCSIZE", "size_fixture.c"),
            )
            combined_rows = {}

            with ExitStack() as stack:
                stack.enter_context(
                    patch.object(
                        dataProcessing,
                        "STATIC_DIR",
                        str(static_dir),
                    )
                )
                stack.enter_context(
                    patch.object(dataProcessing, "plot_metric_multi")
                )
                for codename, source_name in cases:
                    raw_path = static_dir / (codename + "Results0.csv")
                    write_synthetic_raw(raw_path)
                    dataProcessing.graph_results(
                        [codename],
                        [source_name],
                        2999,
                    )

                    combined_path = (
                        static_dir / codename / "CombinedResults.csv"
                    )
                    with combined_path.open(
                        "r",
                        encoding="utf-8",
                        newline="",
                    ) as handle:
                        rows = list(csv.DictReader(handle))
                        header = handle.seek(0) or next(csv.reader(handle))

                    self.assertEqual(header, COMBINED_HEADER)
                    self.assertEqual(len(header), 31)
                    self.assertEqual(len(rows), 100)
                    self.assertEqual(
                        sorted({int(row["InputSize"]) for row in rows}),
                        SIZE_SEQUENCE,
                    )
                    for input_size in SIZE_SEQUENCE:
                        self.assertEqual(
                            sum(
                                int(row["InputSize"]) == input_size
                                for row in rows
                            ),
                            10,
                        )
                    combined_rows[codename] = [
                        {
                            key: value
                            for key, value in row.items()
                            if key != "source"
                        }
                        for row in rows
                    ]

            self.assertEqual(
                combined_rows["goldenCppSIZE"],
                combined_rows["goldenCSIZE"],
            )

            results_payload = results_service.build_execution_results(
                str(static_dir),
                "goldenCppSIZE",
            )
            self.assertEqual(results_payload["schema_version"], "1.3")
            self.assertEqual(
                results_payload["processing"]["dispersion"],
                "sample_stddev",
            )

    def test_all_measurescripts_keep_the_same_raw_header(self):
        header_line = 'HEADER="{}"'.format(",".join(RAW_HEADER))
        for filename in (
            "Server/measurescript3.sh",
            "Server/measurescript4.sh",
            "Server/measurescript5.sh",
        ):
            with self.subTest(filename=filename):
                self.assertIn(
                    header_line,
                    (ROOT / filename).read_text(encoding="utf-8"),
                )


if __name__ == "__main__":
    unittest.main()
