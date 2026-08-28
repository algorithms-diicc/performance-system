import unittest

from Server.webapp.services.execution_queue_service import (
    claim_next_queued_execution,
)


class FakeConnection:
    def __init__(self):
        self.commits = 0
        self.rollbacks = 0
        self.closed = 0

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed += 1


class FakeQueueRepository:
    def __init__(self, candidate):
        self.candidate = candidate

    def list_queued_executions(
        self,
        limit,
        conn,
        for_update,
        skip_locked,
    ):
        return [self.candidate] if self.candidate is not None else []


class FakeAssignmentRepository:
    def __init__(self, events):
        self.events = events

    def get_submission_for_update(self, submission_id, conn):
        self.events.append("lock_submission")
        return {
            "id": submission_id,
            "assigned_measurement_node_id": None,
            "measurement_node_mode": None,
        }

    def set_submission_assignment(
        self,
        submission_id,
        measurement_node_id,
        measurement_node_mode,
        conn,
    ):
        self.events.append("persist_affinity")
        return {
            "id": submission_id,
            "assigned_measurement_node_id": measurement_node_id,
            "measurement_node_mode": measurement_node_mode,
        }

    def set_execution_provenance(
        self,
        public_id,
        measurement_node_id,
        hardware_profile_id,
        conn,
    ):
        self.events.append("persist_provenance")
        return {
            "public_id": public_id,
            "measurement_node_id": measurement_node_id,
            "hardware_profile_id": hardware_profile_id,
        }


class FakeStateService:
    def __init__(self, events):
        self.events = events

    def mark_running(self, public_id, conn, repository):
        self.events.append("mark_running")
        return {
            "public_id": public_id,
            "execution_state": "RUNNING",
        }


class ExecutionQueueNodeAssignmentTests(unittest.TestCase):
    def _candidate(self):
        return {
            "id": 10,
            "public_id": "uuid-10",
            "submission_id": 77,
            "benchmark": "LCS",
            "input_size": 500,
            "execution_profile": "BALANCED",
        }

    def test_assignment_and_provenance_are_persisted_before_running(self):
        events = []
        assignment_repository = FakeAssignmentRepository(events)

        def selector(execution, submission, conn, repository):
            events.append("select_node")
            return {
                "measurement_node_id": 3,
                "hardware_profile_id": 8,
                "measurement_node_mode": "AUTO",
                "affinity_changed": True,
            }

        claimed = claim_next_queued_execution(
            conn=FakeConnection(),
            repository=FakeQueueRepository(self._candidate()),
            state_service=FakeStateService(events),
            assignment_repository=assignment_repository,
            selector_func=selector,
        )

        self.assertEqual(
            events,
            [
                "lock_submission",
                "select_node",
                "persist_affinity",
                "persist_provenance",
                "mark_running",
            ],
        )
        self.assertEqual(claimed["measurement_node_id"], 3)
        self.assertEqual(claimed["hardware_profile_id"], 8)

    def test_unavailable_head_stays_queued(self):
        events = []
        assignment_repository = FakeAssignmentRepository(events)

        def selector(execution, submission, conn, repository):
            events.append("select_node")
            return None

        result = claim_next_queued_execution(
            conn=FakeConnection(),
            repository=FakeQueueRepository(self._candidate()),
            state_service=FakeStateService(events),
            assignment_repository=assignment_repository,
            selector_func=selector,
        )

        self.assertIsNone(result)
        self.assertEqual(events, ["lock_submission", "select_node"])


if __name__ == "__main__":
    unittest.main()
