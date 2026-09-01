import unittest
from datetime import datetime, timedelta

from Server.webapp.services.measurement_node_selector_service import (
    MeasurementNodeSelectionError,
    is_new_measurement_target_available,
    list_pinnable_measurement_nodes,
    resolve_pinned_measurement_node,
)


class FakeNodeRepository:
    def __init__(self, rows):
        self.rows = [dict(row) for row in rows]

    def list_measurement_nodes(self, conn=None):
        return [dict(row) for row in self.rows]

    def get_measurement_node_by_key(
        self,
        node_key,
        conn=None,
    ):
        for row in self.rows:
            if row["node_key"] == node_key:
                return dict(row)
        return None


NOW = datetime(2026, 8, 29, 3, 0, 0)


def node(
    node_id,
    node_key,
    *,
    validation_only=False,
    enabled=True,
    draining=False,
    heartbeat_age=5,
):
    return {
        "id": node_id,
        "node_key": node_key,
        "display_name": node_key.upper(),
        "hardware_profile_id": 100 + node_id,
        "institutional_priority": 100,
        "is_enabled": enabled,
        "is_validation_only": validation_only,
        "is_draining": draining,
        "last_heartbeat_at": (
            NOW - timedelta(
                seconds=heartbeat_age
            )
        ),
        "hardware_profile_key":
            f"profile-{node_id}",
        "hardware_profile_name":
            f"Profile {node_id}",
        "hardware_profile_is_active": True,
    }


class MeasurementNodePublicSelectionTests(
    unittest.TestCase
):
    def test_normal_user_sees_only_available_non_validation_nodes(self):
        repo = FakeNodeRepository(
            [
                node(1, "shenu"),
                node(
                    2,
                    "ryzen-validation",
                    validation_only=True,
                ),
                node(
                    3,
                    "offline",
                    heartbeat_age=120,
                ),
                node(
                    4,
                    "draining",
                    draining=True,
                ),
            ]
        )

        items = list_pinnable_measurement_nodes(
            "Student",
            repository=repo,
            now=NOW,
            stale_after_seconds=30,
            environment={},
        )

        self.assertEqual(
            [item["node_key"] for item in items],
            ["shenu"],
        )

        self.assertNotIn(
            "measurement_node_id",
            items[0],
        )
        self.assertNotIn(
            "institutional_priority",
            items[0],
        )
        self.assertNotIn(
            "last_heartbeat_at",
            items[0],
        )

    def test_admin_controlled_campaign_can_see_validation_node(self):
        repo = FakeNodeRepository(
            [
                node(
                    2,
                    "ryzen-validation",
                    validation_only=True,
                ),
            ]
        )

        items = list_pinnable_measurement_nodes(
            "Admin",
            repository=repo,
            now=NOW,
            stale_after_seconds=30,
            environment={
                "MEASUREMENT_NODE_ALLOW_VALIDATION_ONLY":
                    "true",
            },
        )

        self.assertEqual(len(items), 1)
        self.assertEqual(
            items[0]["node_key"],
            "ryzen-validation",
        )
        self.assertTrue(
            items[0]["is_validation_only"]
        )

    def test_student_cannot_resolve_validation_only_node(self):
        repo = FakeNodeRepository(
            [
                node(
                    2,
                    "ryzen-validation",
                    validation_only=True,
                ),
            ]
        )

        with self.assertRaises(
            MeasurementNodeSelectionError
        ):
            resolve_pinned_measurement_node(
                "ryzen-validation",
                current_role_name="Student",
                repository=repo,
                now=NOW,
                stale_after_seconds=30,
                environment={
                    "MEASUREMENT_NODE_ALLOW_VALIDATION_ONLY":
                        "true",
                },
            )

    def test_admin_can_resolve_controlled_validation_target(self):
        repo = FakeNodeRepository(
            [
                node(
                    2,
                    "ryzen-validation",
                    validation_only=True,
                ),
            ]
        )

        target = resolve_pinned_measurement_node(
            "ryzen-validation",
            current_role_name="Admin",
            repository=repo,
            now=NOW,
            stale_after_seconds=30,
            environment={
                "MEASUREMENT_NODE_ALLOW_VALIDATION_ONLY":
                    "true",
            },
        )

        self.assertEqual(
            target["measurement_node_id"],
            2,
        )
        self.assertEqual(
            target["hardware_profile_key"],
            "profile-2",
        )

    def test_auto_admission_requires_at_least_one_live_public_node(self):
        live_repo = FakeNodeRepository(
            [node(1, "shenu")]
        )
        offline_repo = FakeNodeRepository(
            [
                node(
                    1,
                    "shenu",
                    heartbeat_age=120,
                )
            ]
        )

        self.assertTrue(
            is_new_measurement_target_available(
                "Student",
                "AUTO",
                repository=live_repo,
                now=NOW,
                stale_after_seconds=30,
                environment={},
            )
        )
        self.assertFalse(
            is_new_measurement_target_available(
                "Student",
                "AUTO",
                repository=offline_repo,
                now=NOW,
                stale_after_seconds=30,
                environment={},
            )
        )

    def test_pinned_admission_requires_the_requested_live_node(self):
        repo = FakeNodeRepository(
            [
                node(1, "shenu"),
                node(
                    2,
                    "offline",
                    heartbeat_age=120,
                ),
            ]
        )

        self.assertTrue(
            is_new_measurement_target_available(
                "Student",
                "PINNED",
                "shenu",
                repository=repo,
                now=NOW,
                stale_after_seconds=30,
                environment={},
            )
        )
        self.assertFalse(
            is_new_measurement_target_available(
                "Student",
                "PINNED",
                "offline",
                repository=repo,
                now=NOW,
                stale_after_seconds=30,
                environment={},
            )
        )

    def test_offline_target_is_rejected(self):
        repo = FakeNodeRepository(
            [
                node(
                    1,
                    "shenu",
                    heartbeat_age=120,
                ),
            ]
        )

        with self.assertRaises(
            MeasurementNodeSelectionError
        ):
            resolve_pinned_measurement_node(
                "shenu",
                current_role_name="Student",
                repository=repo,
                now=NOW,
                stale_after_seconds=30,
                environment={},
            )


if __name__ == "__main__":
    unittest.main()
