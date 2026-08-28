from datetime import datetime, timedelta
import unittest

from Server.webapp.services.measurement_node_service import (
    AVAILABLE,
    DRAINING,
    OFFLINE,
    MeasurementNodeError,
    MeasurementNodeMissing,
    configured_stale_seconds,
    derive_measurement_node_state,
    list_measurement_node_statuses,
    normalize_node_key,
    record_measurement_node_heartbeat,
    register_measurement_node,
)


NOW = datetime(2026, 8, 28, 8, 0, 0)


def node(**overrides):
    value = {
        "id": 1,
        "node_key": "shenu",
        "display_name": "Shenu",
        "hardware_profile_id": 3,
        "hardware_profile_is_active": True,
        "institutional_priority": 100,
        "is_enabled": True,
        "is_validation_only": False,
        "is_draining": False,
        "last_heartbeat_at": NOW - timedelta(seconds=5),
    }
    value.update(overrides)
    return value


class FakeRepository:
    def __init__(self):
        self.upserts = []
        self.heartbeats = []
        self.rows = []

    def upsert_measurement_node(self, **kwargs):
        self.upserts.append(kwargs)
        return {"id": 1, **kwargs}

    def touch_measurement_node_heartbeat(
        self,
        node_key,
        conn=None,
    ):
        self.heartbeats.append((node_key, conn))
        if node_key == "missing":
            return None
        return {
            "id": 1,
            "node_key": node_key,
            "last_heartbeat_at": NOW,
        }

    def list_measurement_nodes(self, conn=None):
        return list(self.rows)


class MeasurementNodeServiceTests(unittest.TestCase):
    def test_node_key_is_normalized(self):
        self.assertEqual(
            normalize_node_key(" ShEnU_01 "),
            "shenu_01",
        )

    def test_invalid_node_key_is_rejected(self):
        with self.assertRaises(MeasurementNodeError):
            normalize_node_key("Shenu Node")

    def test_registration_preserves_admin_policy(self):
        repo = FakeRepository()

        row = register_measurement_node(
            "SHENU",
            " Shenu principal ",
            3,
            institutional_priority=100,
            is_enabled=True,
            repository=repo,
        )

        self.assertEqual(row["node_key"], "shenu")
        self.assertEqual(
            row["display_name"],
            "Shenu principal",
        )
        self.assertEqual(
            row["institutional_priority"],
            100,
        )
        self.assertTrue(row["is_enabled"])

    def test_missing_heartbeat_target_is_rejected(self):
        with self.assertRaises(MeasurementNodeMissing):
            record_measurement_node_heartbeat(
                "missing",
                repository=FakeRepository(),
            )

    def test_disabled_node_is_offline(self):
        self.assertEqual(
            derive_measurement_node_state(
                node(is_enabled=False),
                now=NOW,
                stale_after_seconds=30,
            ),
            OFFLINE,
        )

    def test_missing_or_stale_heartbeat_is_offline(self):
        self.assertEqual(
            derive_measurement_node_state(
                node(last_heartbeat_at=None),
                now=NOW,
                stale_after_seconds=30,
            ),
            OFFLINE,
        )

        self.assertEqual(
            derive_measurement_node_state(
                node(
                    last_heartbeat_at=(
                        NOW - timedelta(seconds=31)
                    )
                ),
                now=NOW,
                stale_after_seconds=30,
            ),
            OFFLINE,
        )

    def test_live_draining_node_is_draining(self):
        self.assertEqual(
            derive_measurement_node_state(
                node(is_draining=True),
                now=NOW,
                stale_after_seconds=30,
            ),
            DRAINING,
        )

    def test_live_enabled_node_is_available(self):
        self.assertEqual(
            derive_measurement_node_state(
                node(),
                now=NOW,
                stale_after_seconds=30,
            ),
            AVAILABLE,
        )

    def test_inactive_hardware_profile_is_offline(self):
        self.assertEqual(
            derive_measurement_node_state(
                node(
                    hardware_profile_is_active=False
                ),
                now=NOW,
                stale_after_seconds=30,
            ),
            OFFLINE,
        )

    def test_stale_configuration_is_positive_and_configurable(self):
        self.assertEqual(
            configured_stale_seconds(
                {"MEASUREMENT_NODE_STALE_SECONDS": "45"}
            ),
            45,
        )
        self.assertEqual(
            configured_stale_seconds(
                {"MEASUREMENT_NODE_STALE_SECONDS": "0"}
            ),
            30,
        )

    def test_list_projects_operational_state(self):
        repo = FakeRepository()
        repo.rows = [
            node(node_key="shenu"),
            node(
                node_key="ryzen-validation",
                is_validation_only=True,
                is_draining=True,
            ),
        ]

        rows = list_measurement_node_statuses(
            repository=repo,
            now=NOW,
            stale_after_seconds=30,
        )

        self.assertEqual(
            [row["operational_state"] for row in rows],
            [AVAILABLE, DRAINING],
        )


if __name__ == "__main__":
    unittest.main()
