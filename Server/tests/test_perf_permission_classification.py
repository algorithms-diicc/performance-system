import subprocess
import unittest
from unittest.mock import patch

import pandas as pd

from Server import hardware_snapshot
from Server.webapp import dataProcessing
from Server.webapp.services import results_service


class PerfPermissionClassificationTests(unittest.TestCase):
    def test_hardware_probe_permission_denied(self):
        completed = subprocess.CompletedProcess(
            args=["perf"],
            returncode=255,
            stdout="",
            stderr=(
                "Error:\nAccess to performance monitoring and observability "
                "operations is limited.\n"
            ),
        )
        with patch.object(hardware_snapshot.subprocess, "run", return_value=completed):
            probe = hardware_snapshot._probe_perf_event("perf", "power/energy-pkg/")
        self.assertEqual(probe["probe_state"], "permission_denied")
        self.assertFalse(probe["measurement_available"])

    def test_hardware_probe_not_supported_remains_distinct(self):
        completed = subprocess.CompletedProcess(
            args=["perf"], returncode=0, stdout="", stderr="<not supported>;;power/energy-pkg/;"
        )
        with patch.object(hardware_snapshot.subprocess, "run", return_value=completed):
            probe = hardware_snapshot._probe_perf_event("perf", "power/energy-pkg/")
        self.assertEqual(probe["probe_state"], "not_supported")

    def test_data_processing_counts_all_states(self):
        counts = dataProcessing._classify_availability_series(
            pd.Series(["123", "<permission-denied>", "<not-supported>", "<not-counted>", ""])
        )
        self.assertEqual(counts["numeric"], 1)
        self.assertEqual(counts["permission_denied"], 1)
        self.assertEqual(counts["unsupported"], 1)
        self.assertEqual(counts["not_counted"], 1)
        self.assertEqual(counts["missing"], 1)

    def test_derived_metric_propagates_permission(self):
        raw = pd.DataFrame({
            "Instructions": ["100", "101"],
            "CpuCycles": ["<permission-denied>", "<permission-denied>"],
        })
        ipc = dataProcessing._collect_derived_availability(raw)["IPC"]
        self.assertEqual(ipc["permission_denied"], 2)
        self.assertEqual(ipc["numeric"], 0)

    def test_results_raw_classifier(self):
        counts = results_service._classify_raw_values(pd.Series(["<permission-denied>"] * 3))
        self.assertEqual(counts["permission_denied"], 3)
        self.assertEqual(counts["unsupported"], 0)

    def test_results_pure_permission_status_and_reason(self):
        status = results_service._derive_metric_status(
            numeric_total=0,
            unsupported_total=0,
            not_counted_total=0,
            permission_denied_total=30,
            missing_total=0,
            groups_total=1,
            groups_with_data=0,
        )
        self.assertEqual(status, "permission_denied")
        self.assertEqual(
            results_service._metric_status_reason(status),
            "measurement_permission_denied",
        )

    def test_numeric_plus_permission_is_partial(self):
        status = results_service._derive_metric_status(
            numeric_total=29,
            unsupported_total=0,
            not_counted_total=0,
            permission_denied_total=1,
            missing_total=0,
            groups_total=1,
            groups_with_data=1,
        )
        self.assertEqual(status, "partial")

    def test_legacy_derived_propagates_permission(self):
        raw = pd.DataFrame({"IPC": ["", ""]})
        availability = {
            "Instructions": {
                "rows_total": 2, "numeric": 2, "unsupported": 0,
                "not_counted": 0, "permission_denied": 0, "missing": 0,
            },
            "CpuCycles": {
                "rows_total": 2, "numeric": 0, "unsupported": 0,
                "not_counted": 0, "permission_denied": 2, "missing": 0,
            },
        }
        extended = results_service._extend_legacy_derived_availability(raw, availability)
        self.assertEqual(extended["IPC"]["permission_denied"], 2)
        self.assertEqual(extended["IPC"]["unsupported"], 0)


if __name__ == "__main__":
    unittest.main()
