import unittest

from Server.webapp.repositories import measurement_node_assignment_repository


class FakeCursor:
    def __init__(self, rows):
        self.rows = list(rows)
        self.executed = []

    def execute(self, sql, params):
        self.executed.append((sql, params))

    def fetchone(self):
        return self.rows[0] if self.rows else None

    def fetchall(self):
        return list(self.rows)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeConnection:
    def __init__(self, rows):
        self.cursor_instance = FakeCursor(rows)

    def cursor(self, cursor_factory=None):
        return self.cursor_instance


class MeasurementNodeAssignmentRepositoryTests(unittest.TestCase):
    def test_submission_affinity_row_is_locked(self):
        conn = FakeConnection([
            {
                "id": 7,
                "assigned_measurement_node_id": None,
                "measurement_node_mode": "AUTO",
            }
        ])

        row = measurement_node_assignment_repository.get_submission_for_update(
            7,
            conn,
        )

        sql, params = conn.cursor_instance.executed[0]
        self.assertIn("FOR UPDATE", " ".join(sql.split()))
        self.assertEqual(params, (7,))
        self.assertEqual(row["id"], 7)

    def test_started_boundary_uses_started_at(self):
        conn = FakeConnection([{"has_started": True}])

        self.assertTrue(
            measurement_node_assignment_repository.
            submission_has_started_execution(7, conn)
        )

        sql, params = conn.cursor_instance.executed[0]
        normalized = " ".join(sql.split())
        self.assertIn("started_at IS NOT NULL", normalized)
        self.assertEqual(params, (7,))

    def test_candidate_query_joins_active_policy_and_locks_nodes(self):
        conn = FakeConnection([])

        rows = measurement_node_assignment_repository.list_policy_candidates(
            "CAMM",
            "BALANCED",
            conn,
        )

        self.assertEqual(rows, [])
        sql, params = conn.cursor_instance.executed[0]
        normalized = " ".join(sql.split())
        self.assertIn("JOIN hardware_profile_policies p", normalized)
        self.assertIn("hp.is_active = TRUE", normalized)
        self.assertIn("p.is_active = TRUE", normalized)
        self.assertIn("FOR UPDATE OF mn", normalized)
        self.assertEqual(params, ("CAMM", "BALANCED"))

    def test_submission_assignment_updates_mode_and_node_together(self):
        conn = FakeConnection([
            {
                "id": 7,
                "assigned_measurement_node_id": 2,
                "measurement_node_mode": "AUTO",
            }
        ])

        row = measurement_node_assignment_repository.set_submission_assignment(
            7,
            2,
            "AUTO",
            conn,
        )

        sql, params = conn.cursor_instance.executed[0]
        normalized = " ".join(sql.split())
        self.assertIn("assigned_measurement_node_id = %s", normalized)
        self.assertIn("measurement_node_mode = %s", normalized)
        self.assertEqual(params, (2, "AUTO", 7))
        self.assertEqual(row["assigned_measurement_node_id"], 2)

    def test_execution_provenance_only_writes_queued_execution(self):
        conn = FakeConnection([
            {
                "id": 10,
                "public_id": "uuid-10",
                "submission_id": 7,
                "measurement_node_id": 2,
                "hardware_profile_id": 4,
                "execution_state": "QUEUED",
                "state_version": 0,
            }
        ])

        row = measurement_node_assignment_repository.set_execution_provenance(
            "uuid-10",
            2,
            4,
            conn,
        )

        sql, params = conn.cursor_instance.executed[0]
        normalized = " ".join(sql.split())
        self.assertIn("execution_state = 'QUEUED'", normalized)
        self.assertEqual(params, (2, 4, "uuid-10"))
        self.assertEqual(row["hardware_profile_id"], 4)


if __name__ == "__main__":
    unittest.main()
