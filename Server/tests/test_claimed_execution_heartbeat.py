import unittest

from Server.webapp.services import worker_execution_service as service


class FakeRepository:
    def __init__(self):
        self.row = {
            "public_id": "00000000-0000-0000-0000-000000000001",
            "codename": "abcLCS",
            "execution_state": "RUNNING",
        }
        self.heartbeats = 0

    def get_execution_by_codename(self, codename):
        return dict(self.row)

    def touch_heartbeat(self, public_id):
        self.heartbeats += 1
        return {
            "public_id": public_id,
            "execution_state": self.row["execution_state"],
        }


class ClaimedExecutionHeartbeatTests(unittest.TestCase):
    def tearDown(self):
        for codename in service.active_heartbeat_codenames():
            service.stop_heartbeat_lease(codename)

    def test_claimed_execution_starts_heartbeat_without_state_transition(self):
        repo = FakeRepository()

        execution = service.activate_claimed_execution(
            "abcLCS",
            repo.row["public_id"],
            repository=repo,
        )

        self.assertEqual(
            execution["execution_state"],
            "RUNNING",
        )
        self.assertEqual(repo.heartbeats, 1)
        self.assertIn(
            "abcLCS",
            service.active_heartbeat_codenames(),
        )

    def test_claimed_execution_rejects_non_running_state(self):
        repo = FakeRepository()
        repo.row["execution_state"] = "QUEUED"

        with self.assertRaises(
            service.UnexpectedWorkerOutcome
        ):
            service.activate_claimed_execution(
                "abcLCS",
                repo.row["public_id"],
                repository=repo,
            )

        self.assertEqual(repo.heartbeats, 0)
        self.assertNotIn(
            "abcLCS",
            service.active_heartbeat_codenames(),
        )

    def test_claimed_execution_rejects_public_id_mismatch(self):
        repo = FakeRepository()

        with self.assertRaises(
            service.UnexpectedWorkerOutcome
        ):
            service.activate_claimed_execution(
                "abcLCS",
                "00000000-0000-0000-0000-000000000999",
                repository=repo,
            )

        self.assertEqual(repo.heartbeats, 0)
        self.assertNotIn(
            "abcLCS",
            service.active_heartbeat_codenames(),
        )
