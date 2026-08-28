import unittest
from unittest.mock import patch

from Server.webapp.services.hardware_profile_service import (
    HardwareProfileError,
    build_hardware_profile_policy,
    normalize_policy_benchmark,
    normalize_policy_execution_profile,
    register_hardware_profile_policy,
    resolve_hardware_profile_policy,
    list_hardware_profile_policies,
)


class HardwareProfilePolicyServiceTests(unittest.TestCase):
    def test_camm_variants_share_policy_family(self):
        for benchmark in (
            "CAMM",
            "CAMMR",
            "CAMMS",
            "CAMMSO",
        ):
            with self.subTest(benchmark=benchmark):
                self.assertEqual(
                    normalize_policy_benchmark(benchmark),
                    "CAMM",
                )

    def test_other_benchmarks_preserve_family(self):
        self.assertEqual(
            normalize_policy_benchmark("LCS"),
            "LCS",
        )
        self.assertEqual(
            normalize_policy_benchmark("SIZE"),
            "SIZE",
        )

    def test_invalid_benchmark_is_rejected(self):
        with self.assertRaises(HardwareProfileError):
            normalize_policy_benchmark("UNKNOWN")

    def test_execution_profile_is_normalized(self):
        self.assertEqual(
            normalize_policy_execution_profile("balanced"),
            "BALANCED",
        )

    def test_invalid_execution_profile_is_rejected(self):
        with self.assertRaises(HardwareProfileError):
            normalize_policy_execution_profile("turbo")

    def test_build_policy_accepts_ordered_limits(self):
        policy = build_hardware_profile_policy(
            7,
            "CAMMS",
            "BALANCED",
            minimum_input=100,
            default_input=200,
            recommended_max_input=300,
            hard_max_input=400,
            input_step=10,
            operational_timeout_seconds=60,
        )

        self.assertEqual(policy["hardware_profile_id"], 7)
        self.assertEqual(policy["benchmark"], "CAMM")
        self.assertEqual(
            policy["execution_profile"],
            "BALANCED",
        )

    def test_build_policy_rejects_inverted_limits(self):
        with self.assertRaises(HardwareProfileError):
            build_hardware_profile_policy(
                7,
                "LCS",
                "QUICK",
                minimum_input=100,
                default_input=300,
                recommended_max_input=200,
                hard_max_input=400,
                input_step=10,
                operational_timeout_seconds=60,
            )

    @patch(
        "Server.webapp.services.hardware_profile_service."
        "hardware_profile_repository."
        "upsert_hardware_profile_policy"
    )
    def test_register_delegates_normalized_contract(
        self,
        upsert,
    ):
        upsert.return_value = {
            "id": 11,
            "benchmark": "CAMM",
            "execution_profile": "QUICK",
        }

        result = register_hardware_profile_policy(
            7,
            "CAMMR",
            "quick",
            minimum_input=100,
            default_input=200,
            recommended_max_input=300,
            hard_max_input=400,
            input_step=10,
            operational_timeout_seconds=60,
        )

        self.assertEqual(result["id"], 11)

        kwargs = upsert.call_args.kwargs

        self.assertEqual(
            kwargs["hardware_profile_id"],
            7,
        )
        self.assertEqual(kwargs["benchmark"], "CAMM")
        self.assertEqual(
            kwargs["execution_profile"],
            "QUICK",
        )
        self.assertEqual(
            kwargs["recommended_max_input"],
            300,
        )



class HardwareProfilePolicyReadTests(unittest.TestCase):
    @patch(
        "Server.webapp.services.hardware_profile_service."
        "hardware_profile_repository."
        "get_active_hardware_profile_policy"
    )
    def test_resolve_policy_normalizes_lookup(
        self,
        get_policy,
    ):
        get_policy.return_value = {
            "id": 41,
            "hardware_profile_id": 3,
            "profile_key": "shenu-intel-i5-9400",
            "benchmark": "CAMM",
            "execution_profile": "BALANCED",
            "minimum_input": 1000,
            "default_input": 5000,
            "recommended_max_input": 75000,
            "hard_max_input": 100000,
            "input_step": 1000,
            "operational_timeout_seconds": 780,
            "is_active": True,
        }

        result = resolve_hardware_profile_policy(
            "shenu-intel-i5-9400",
            "camms",
            "balanced",
        )

        self.assertEqual(result["id"], 41)

        get_policy.assert_called_once_with(
            "shenu-intel-i5-9400",
            "CAMM",
            "BALANCED",
            conn=None,
        )

    @patch(
        "Server.webapp.services.hardware_profile_service."
        "hardware_profile_repository."
        "get_active_hardware_profile_policy",
        return_value=None,
    )
    def test_resolve_policy_requires_active_row(
        self,
        _get_policy,
    ):
        with self.assertRaises(HardwareProfileError):
            resolve_hardware_profile_policy(
                "shenu-intel-i5-9400",
                "LCS",
                "QUICK",
            )

    @patch(
        "Server.webapp.services.hardware_profile_service."
        "hardware_profile_repository."
        "list_active_hardware_profile_policies"
    )
    def test_list_policy_contract(
        self,
        list_policies,
    ):
        list_policies.return_value = [
            {
                "id": 1,
                "profile_key": "shenu-intel-i5-9400",
                "benchmark": "LCS",
                "execution_profile": "QUICK",
            },
            {
                "id": 2,
                "profile_key": "shenu-intel-i5-9400",
                "benchmark": "LCS",
                "execution_profile": "BALANCED",
            },
        ]

        result = list_hardware_profile_policies(
            "shenu-intel-i5-9400"
        )

        self.assertEqual(len(result), 2)

        list_policies.assert_called_once_with(
            "shenu-intel-i5-9400",
            conn=None,
        )

    @patch(
        "Server.webapp.services.hardware_profile_service."
        "hardware_profile_repository."
        "list_active_hardware_profile_policies",
        return_value=[],
    )
    def test_list_policy_contract_rejects_empty_profile(
        self,
        _list_policies,
    ):
        with self.assertRaises(HardwareProfileError):
            list_hardware_profile_policies(
                "shenu-intel-i5-9400"
            )


if __name__ == "__main__":
    unittest.main()
