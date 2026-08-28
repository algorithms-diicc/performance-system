import json
import unittest
from unittest.mock import patch

from Server.webapp.services.hardware_profile_service import (
    HardwareProfileError,
    build_hardware_profile,
    build_profile_capabilities,
    normalize_profile_key,
    register_hardware_profile,
)


class HardwareProfileServiceTests(unittest.TestCase):
    def setUp(self):
        self.snapshot = {
            "schema_version": "1.0",
            "node": {
                "architecture": "x86_64",
                "cpu_vendor": "GenuineIntel",
                "cpu_model": "Intel(R) Core(TM) i5-9400 CPU @ 2.90GHz",
                "logical_cpus": 6,
            },
            "measurement": {
                "backend": "perf",
                "perf_version": "perf version 6.8.12",
                "requested_perf_scope": "process",
                "perf_event_paranoid": "-1",
            },
            "energy": {
                "EnergyPkg": {
                    "event": "power/energy-pkg/",
                    "event_exposed": True,
                    "probe_state": "numeric",
                    "measurement_available": True,
                },
                "EnergyRAM": {
                    "event": "power/energy-ram/",
                    "event_exposed": False,
                    "probe_state": "event_not_exposed",
                    "measurement_available": False,
                },
            },
            "powercap": {
                "domains": {
                    "package-0": {
                        "energy_uj_exposed": True,
                        "energy_uj_readable": True,
                    }
                }
            },
            "toolchain": {
                "compiler": {
                    "family": "GNU",
                    "name": "g++",
                    "version": "g++ (Ubuntu) 13.3.0",
                }
            },
        }

    def test_profile_key_accepts_canonical_identifier(self):
        self.assertEqual(
            normalize_profile_key("shenu-intel-i5-9400"),
            "shenu-intel-i5-9400",
        )

    def test_profile_key_rejects_display_text(self):
        with self.assertRaises(HardwareProfileError):
            normalize_profile_key("Shenu Intel i5 9400")

    def test_build_profile_preserves_detected_identity(self):
        profile = build_hardware_profile(
            "shenu-intel-i5-9400",
            "Shenu Intel i5-9400",
            self.snapshot,
            ram_gb=23,
        )

        self.assertEqual(
            profile["cpu_vendor"],
            "GenuineIntel",
        )
        self.assertEqual(
            profile["cpu_model"],
            "Intel(R) Core(TM) i5-9400 CPU @ 2.90GHz",
        )
        self.assertEqual(profile["architecture"], "x86_64")
        self.assertEqual(profile["logical_cpus"], 6)
        self.assertEqual(profile["ram_gb"], 23)

    def test_capabilities_do_not_include_requested_perf_scope(self):
        capabilities = build_profile_capabilities(self.snapshot)

        self.assertEqual(
            capabilities["measurement"]["backend"],
            "perf",
        )
        self.assertNotIn(
            "requested_perf_scope",
            capabilities["measurement"],
        )

    def test_capabilities_preserve_energy_availability(self):
        capabilities = build_profile_capabilities(self.snapshot)

        self.assertTrue(
            capabilities["energy"]["EnergyPkg"][
                "measurement_available"
            ]
        )
        self.assertFalse(
            capabilities["energy"]["EnergyRAM"][
                "measurement_available"
            ]
        )

    def test_build_profile_requires_node_identity(self):
        broken = {
            "schema_version": "1.0",
            "node": {
                "architecture": "x86_64",
                "logical_cpus": 6,
            },
        }

        with self.assertRaises(HardwareProfileError):
            build_hardware_profile(
                "test-profile",
                "Test profile",
                broken,
            )

    @patch(
        "Server.webapp.services.hardware_profile_service."
        "hardware_profile_repository.upsert_hardware_profile"
    )
    def test_register_delegates_persistable_contract(self, upsert):
        upsert.return_value = {
            "id": 7,
            "profile_key": "shenu-intel-i5-9400",
        }

        result = register_hardware_profile(
            "shenu-intel-i5-9400",
            "Shenu Intel i5-9400",
            self.snapshot,
            ram_gb=23,
            description="Institutional measurement profile.",
        )

        self.assertEqual(result["id"], 7)

        kwargs = upsert.call_args.kwargs

        self.assertEqual(
            kwargs["profile_key"],
            "shenu-intel-i5-9400",
        )
        self.assertEqual(kwargs["logical_cpus"], 6)
        self.assertEqual(kwargs["ram_gb"], 23)

        decoded = json.loads(kwargs["capabilities"])
        self.assertEqual(
            decoded["measurement"]["backend"],
            "perf",
        )


if __name__ == "__main__":
    unittest.main()
