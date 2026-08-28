import unittest
from datetime import datetime, timedelta

from Server.webapp.services.measurement_node_selector_service import (
    AUTO,
    PINNED,
    configured_allow_validation_only,
    normalize_measurement_node_mode,
    select_measurement_node,
)


class FakeAssignmentRepository:
    def __init__(self, candidates, has_started=False):
        self.candidates = list(candidates)
        self.has_started = has_started
        self.policy_calls = []
        self.started_calls = []

    def list_policy_candidates(self, benchmark, execution_profile, conn):
        self.policy_calls.append((benchmark, execution_profile, conn))
        return list(self.candidates)

    def submission_has_started_execution(self, submission_id, conn):
        self.started_calls.append((submission_id, conn))
        return self.has_started


def candidate(
    node_id,
    *,
    priority=100,
    recommended=1000,
    hard_max=1500,
    minimum=100,
    enabled=True,
    validation_only=False,
    draining=False,
    heartbeat=None,
):
    return {
        "measurement_node_id": node_id,
        "node_key": "node-{}".format(node_id),
        "hardware_profile_id": 100 + node_id,
        "institutional_priority": priority,
        "is_enabled": enabled,
        "is_validation_only": validation_only,
        "is_draining": draining,
        "last_heartbeat_at": heartbeat,
        "hardware_profile_is_active": True,
        "minimum_input": minimum,
        "default_input": minimum,
        "recommended_max_input": recommended,
        "hard_max_input": hard_max,
        "input_step": 100,
        "operational_timeout_seconds": 300,
    }


class MeasurementNodeSelectorServiceTests(unittest.TestCase):
    NOW = datetime(2026, 8, 28, 16, 0, 0)

    def fresh(self, node_id, **kwargs):
        kwargs.setdefault(
            "heartbeat",
            self.NOW - timedelta(seconds=5),
        )
        return candidate(node_id, **kwargs)

    def execution(self, **overrides):
        row = {
            "benchmark": "LCS",
            "execution_profile": "BALANCED",
            "input_size": 500,
        }
        row.update(overrides)
        return row

    def submission(self, **overrides):
        row = {
            "id": 77,
            "assigned_measurement_node_id": None,
            "measurement_node_mode": AUTO,
        }
        row.update(overrides)
        return row

    def select(self, repo, execution=None, submission=None, **kwargs):
        return select_measurement_node(
            execution or self.execution(),
            submission or self.submission(),
            conn=object(),
            repository=repo,
            now=self.NOW,
            stale_after_seconds=30,
            **kwargs,
        )

    def test_null_legacy_mode_normalizes_to_auto(self):
        self.assertEqual(normalize_measurement_node_mode(None), AUTO)

    def test_validation_only_flag_is_server_opt_in(self):
        self.assertFalse(configured_allow_validation_only({}))
        self.assertTrue(
            configured_allow_validation_only(
                {"MEASUREMENT_NODE_ALLOW_VALIDATION_ONLY": "true"}
            )
        )

    def test_recommended_range_precedes_institutional_priority(self):
        repo = FakeAssignmentRepository([
            self.fresh(
                1,
                priority=100,
                recommended=400,
                hard_max=1000,
            ),
            self.fresh(
                2,
                priority=10,
                recommended=800,
                hard_max=1000,
            ),
        ])

        selected = self.select(repo)

        self.assertEqual(selected["measurement_node_id"], 2)
        self.assertTrue(selected["within_recommended"])

    def test_priority_then_id_break_ties_deterministically(self):
        repo = FakeAssignmentRepository([
            self.fresh(3, priority=20),
            self.fresh(2, priority=20),
            self.fresh(1, priority=10),
        ])

        selected = self.select(repo)

        self.assertEqual(selected["measurement_node_id"], 2)

    def test_existing_auto_affinity_wins_over_better_ranked_node(self):
        repo = FakeAssignmentRepository([
            self.fresh(1, priority=1, recommended=400),
            self.fresh(2, priority=100, recommended=1000),
        ])

        selected = self.select(
            repo,
            submission=self.submission(
                assigned_measurement_node_id=1,
            ),
        )

        self.assertEqual(selected["measurement_node_id"], 1)
        self.assertFalse(selected["affinity_changed"])

    def test_auto_can_reassign_unavailable_affinity_before_start(self):
        repo = FakeAssignmentRepository([
            self.fresh(1, enabled=False),
            self.fresh(2),
        ], has_started=False)

        selected = self.select(
            repo,
            submission=self.submission(
                assigned_measurement_node_id=1,
            ),
        )

        self.assertEqual(selected["measurement_node_id"], 2)
        self.assertTrue(selected["affinity_changed"])

    def test_auto_does_not_reassign_after_any_execution_started(self):
        repo = FakeAssignmentRepository([
            self.fresh(1, enabled=False),
            self.fresh(2),
        ], has_started=True)

        selected = self.select(
            repo,
            submission=self.submission(
                assigned_measurement_node_id=1,
            ),
        )

        self.assertIsNone(selected)

    def test_pinned_never_falls_back_to_another_node(self):
        repo = FakeAssignmentRepository([
            self.fresh(1, draining=True),
            self.fresh(2),
        ], has_started=False)

        selected = self.select(
            repo,
            submission=self.submission(
                measurement_node_mode=PINNED,
                assigned_measurement_node_id=1,
            ),
        )

        self.assertIsNone(selected)

    def test_validation_only_is_excluded_from_normal_auto(self):
        repo = FakeAssignmentRepository([
            self.fresh(2, validation_only=True),
        ])

        self.assertIsNone(self.select(repo))

    def test_validation_only_can_be_enabled_for_controlled_campaign(self):
        repo = FakeAssignmentRepository([
            self.fresh(2, validation_only=True),
        ])

        selected = self.select(
            repo,
            allow_validation_only=True,
        )

        self.assertEqual(selected["measurement_node_id"], 2)

    def test_legacy_submission_with_started_history_gets_no_invented_affinity(self):
        repo = FakeAssignmentRepository([
            self.fresh(1),
        ], has_started=True)

        selected = self.select(
            repo,
            submission=self.submission(
                measurement_node_mode=None,
            ),
        )

        self.assertIsNone(selected)

    def test_hard_max_excludes_node(self):
        repo = FakeAssignmentRepository([
            self.fresh(1, hard_max=400, recommended=400),
        ])

        self.assertIsNone(self.select(repo))

    def test_camm_variant_uses_canonical_policy_family(self):
        repo = FakeAssignmentRepository([
            self.fresh(1),
        ])

        self.select(
            repo,
            execution=self.execution(benchmark="CAMMS"),
        )

        self.assertEqual(repo.policy_calls[0][0], "CAMM")
        self.assertEqual(repo.policy_calls[0][1], "BALANCED")


if __name__ == "__main__":
    unittest.main()
