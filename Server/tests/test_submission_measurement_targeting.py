import unittest
from unittest.mock import patch

from Server.webapp.services.execution_creation_service import (
    InvalidExecutionRequest,
    create_submission_bundle,
)


class FakeSubmissionRepository:
    def __init__(self):
        self.calls = []

    def create_submission(self, **kwargs):
        self.calls.append(kwargs)
        return {
            "id": 77,
            "status": kwargs["status"],
            "language": kwargs["language"],
            "assigned_measurement_node_id":
                kwargs.get(
                    "assigned_measurement_node_id"
                ),
            "measurement_node_mode":
                kwargs.get(
                    "measurement_node_mode"
                ),
        }


class FakeExecutionRepository:
    def __init__(self):
        self.calls = []

    def create_execution(self, **kwargs):
        self.calls.append(kwargs)
        return {
            "id": 100,
            "public_id":
                "00000000-0000-0000-0000-000000000100",
            "submission_id": kwargs["submission_id"],
            "codename": kwargs["codename"],
            "execution_state": "QUEUED",
            "execution_config":
                kwargs["execution_config"],
        }


def policy(
    profile_key,
    benchmark,
    execution_profile,
    conn=None,
):
    family = (
        "CAMM"
        if benchmark in {
            "CAMM",
            "CAMMR",
            "CAMMS",
            "CAMMSO",
        }
        else benchmark
    )

    return {
        "hardware_profile_id": 1,
        "profile_key": profile_key,
        "benchmark": family,
        "execution_profile": execution_profile,
        "minimum_input": 100,
        "default_input": 500,
        "recommended_max_input": 750,
        "hard_max_input": 1000,
        "input_step": 100,
        "operational_timeout_seconds": 960,
        "is_active": True,
    }


class SubmissionMeasurementTargetingTests(
    unittest.TestCase
):
    SHA = "a" * 64

    def create(
        self,
        *,
        mode=None,
        node_key=None,
        pinned_node_resolver=None,
    ):
        srepo = FakeSubmissionRepository()
        erepo = FakeExecutionRepository()

        bundle = create_submission_bundle(
            user_id=7,
            title="Targeting",
            archive_path="/tmp/no-file.zip",
            archive_sha256=self.SHA,
            benchmark="LCS",
            input_size=500,
            samples=10,
            source_specs=[
                {
                    "original_filename":
                        "main.cpp",
                }
            ],
            user_role_name="Student",
            measurement_node_mode=mode,
            measurement_node_key=node_key,
            conn=object(),
            policy_resolver=policy,
            profile_key_resolver=lambda:
                "shenu-intel-i5-9400",
            pinned_node_resolver=(
                pinned_node_resolver
                or (
                    lambda *_args, **_kwargs:
                    {
                        "measurement_node_id": 9,
                        "hardware_profile_key":
                            "pinned-profile",
                    }
                )
            ),
            submission_repo=srepo,
            execution_repo=erepo,
        )

        return bundle, srepo, erepo

    @patch(
        "Server.webapp.services.execution_creation_service."
        "resolve_submission_course",
        return_value=None,
    )
    def test_default_creation_persists_explicit_auto(
        self,
        _resolve_course,
    ):
        bundle, srepo, erepo = self.create()

        self.assertEqual(
            srepo.calls[0][
                "measurement_node_mode"
            ],
            "AUTO",
        )
        self.assertIsNone(
            srepo.calls[0][
                "assigned_measurement_node_id"
            ]
        )

        measurement = (
            erepo.calls[0][
                "execution_config"
            ]["measurement"]
        )

        self.assertEqual(
            measurement["admission_policy"][
                "hardware_profile_key"
            ],
            "shenu-intel-i5-9400",
        )

        self.assertEqual(
            bundle["submission"][
                "measurement_node_mode"
            ],
            "AUTO",
        )

    @patch(
        "Server.webapp.services.execution_creation_service."
        "resolve_submission_course",
        return_value=None,
    )
    def test_pinned_uses_selected_node_profile_for_policy(
        self,
        _resolve_course,
    ):
        observed = []

        def resolver(
            node_key,
            *,
            current_role_name,
            conn,
        ):
            observed.append(
                (
                    node_key,
                    current_role_name,
                    conn,
                )
            )
            return {
                "measurement_node_id": 9,
                "hardware_profile_key":
                    "pinned-profile",
            }

        _, srepo, erepo = self.create(
            mode="PINNED",
            node_key="shenu",
            pinned_node_resolver=resolver,
        )

        self.assertEqual(
            observed[0][0],
            "shenu",
        )
        self.assertEqual(
            observed[0][1],
            "Student",
        )

        self.assertEqual(
            srepo.calls[0][
                "measurement_node_mode"
            ],
            "PINNED",
        )
        self.assertEqual(
            srepo.calls[0][
                "assigned_measurement_node_id"
            ],
            9,
        )

        measurement = (
            erepo.calls[0][
                "execution_config"
            ]["measurement"]
        )

        self.assertEqual(
            measurement["admission_policy"][
                "hardware_profile_key"
            ],
            "pinned-profile",
        )

    @patch(
        "Server.webapp.services.execution_creation_service."
        "resolve_submission_course",
        return_value=None,
    )
    def test_pinned_requires_node_key(
        self,
        _resolve_course,
    ):
        with self.assertRaises(
            InvalidExecutionRequest
        ):
            self.create(
                mode="PINNED",
                node_key=None,
            )

    @patch(
        "Server.webapp.services.execution_creation_service."
        "resolve_submission_course",
        return_value=None,
    )
    def test_auto_rejects_node_key(
        self,
        _resolve_course,
    ):
        with self.assertRaises(
            InvalidExecutionRequest
        ):
            self.create(
                mode="AUTO",
                node_key="shenu",
            )

    @patch(
        "Server.webapp.services.execution_creation_service."
        "resolve_submission_course",
        return_value=None,
    )
    def test_unknown_mode_is_rejected(
        self,
        _resolve_course,
    ):
        with self.assertRaises(
            InvalidExecutionRequest
        ):
            self.create(
                mode="RANDOM",
            )


if __name__ == "__main__":
    unittest.main()
