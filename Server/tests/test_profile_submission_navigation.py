import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from flask import Flask

from Server.webapp.routes.profile_routes import profile_bp


CURRENT_USER = {
    "id": 3,
    "full_name": "Ada Lovelace",
    "email": "ada@example.com",
    "is_active": True,
}


def aggregate_row():
    return {
        "id": CURRENT_USER["id"],
        "full_name": CURRENT_USER["full_name"],
        "email": CURRENT_USER["email"],
        "is_active": True,
        "created_at": datetime(2026, 1, 2, tzinfo=timezone.utc),
        "last_login": datetime(2026, 8, 17, tzinfo=timezone.utc),
        "role_name": "Student",
        "submissions_count": 4,
        "executions_count": 6,
        "completed_executions": 3,
        "failed_executions": 1,
        "timeout_executions": 1,
        "error_executions": 0,
        "queued_executions": 1,
        "running_executions": 1,
        "processing_executions": 0,
        "cancelled_executions": 0,
        "avg_duration_ms": 9000,
    }


LATEST_STARTED_AT = datetime(
    2026,
    8,
    17,
    12,
    0,
    tzinfo=timezone.utc,
)


def latest_execution(**overrides):
    row = {
        "execution_state": "COMPLETED",
        "public_id": "00000000-0000-0000-0000-000000000010",
        "codename": "exec10LCS",
        "submission_id": 42,
        "duration_ms": 1250,
        "started_at": LATEST_STARTED_AT,
        "finished_at": LATEST_STARTED_AT + timedelta(seconds=9),
        "activity_at": LATEST_STARTED_AT + timedelta(seconds=9),
    }
    row.update(overrides)
    return row


class ScriptedCursor:
    def __init__(self, connection):
        self.connection = connection
        self.response = None

    def execute(self, sql, params=None):
        self.connection.executed.append((sql, params))
        self.response = self.connection.responses.pop(0)

    def fetchone(self):
        return self.response

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class ScriptedConnection:
    def __init__(self, responses):
        self.responses = list(responses)
        self.executed = []
        self.closed = False

    def cursor(self, cursor_factory=None):
        return ScriptedCursor(self)

    def close(self):
        self.closed = True


class ProfileSubmissionNavigationTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(profile_bp)
        self.client = app.test_client()

    def _get_profile(self, last_execution, aggregate=None):
        conn = ScriptedConnection([
            aggregate if aggregate is not None else aggregate_row(),
            last_execution,
        ])
        with patch(
            "Server.webapp.utils.auth_decorators.get_current_user",
            return_value=CURRENT_USER,
        ), patch(
            "Server.webapp.routes.profile_routes.get_connection",
            return_value=conn,
        ):
            response = self.client.get("/api/profile")
        return response, conn

    def test_last_submission_id_is_exposed_without_removing_summary_fields(self):
        response, conn = self._get_profile(latest_execution())

        self.assertEqual(response.status_code, 200)
        summary = response.get_json()["summary"]
        self.assertEqual(summary["lastSubmissionId"], 42)
        self.assertEqual(summary["lastExecutionCodename"], "exec10LCS")
        self.assertEqual(summary["lastExecutionState"], "COMPLETED")
        self.assertEqual(summary["executionsCount"], 6)
        self.assertEqual(summary["submissionsCount"], 4)
        self.assertEqual(summary["avgDurationMs"], 9000.0)
        self.assertEqual(summary["lastExecutionDurationMs"], 1250.0)
        self.assertIn("e.submission_id", conn.executed[1][0])
        self.assertIn("e.duration_ms", conn.executed[1][0])
        self.assertIn("e.started_at", conn.executed[1][0])
        self.assertIn("e.finished_at", conn.executed[1][0])
        self.assertIn("ORDER BY e.id DESC", conn.executed[1][0])
        self.assertNotIn("NOW()", conn.executed[1][0])
        self.assertTrue(conn.closed)

    def test_latest_duration_falls_back_to_finished_minus_started(self):
        response, _conn = self._get_profile(
            latest_execution(
                duration_ms=None,
                finished_at=LATEST_STARTED_AT + timedelta(
                    milliseconds=2750
                ),
            )
        )

        self.assertEqual(response.status_code, 200)
        summary = response.get_json()["summary"]
        self.assertEqual(summary["lastExecutionDurationMs"], 2750.0)
        self.assertEqual(summary["avgDurationMs"], 9000.0)

    def test_active_latest_execution_never_uses_current_time(self):
        response, conn = self._get_profile(
            latest_execution(
                execution_state="RUNNING",
                duration_ms=None,
                finished_at=None,
                activity_at=LATEST_STARTED_AT,
            )
        )

        self.assertEqual(response.status_code, 200)
        summary = response.get_json()["summary"]
        self.assertEqual(summary["lastExecutionState"], "RUNNING")
        self.assertIsNone(summary["lastExecutionDurationMs"])
        self.assertNotIn("NOW()", conn.executed[1][0])

    def test_incomplete_timestamps_do_not_invent_latest_duration(self):
        response, _conn = self._get_profile(
            latest_execution(
                duration_ms=None,
                started_at=None,
            )
        )

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(
            response.get_json()["summary"]["lastExecutionDurationMs"]
        )

    def test_last_submission_id_is_null_when_there_is_no_execution(self):
        empty_aggregate = aggregate_row()
        empty_aggregate.update({
            "submissions_count": 0,
            "executions_count": 0,
            "completed_executions": 0,
            "failed_executions": 0,
            "timeout_executions": 0,
            "error_executions": 0,
            "queued_executions": 0,
            "running_executions": 0,
            "processing_executions": 0,
            "cancelled_executions": 0,
            "avg_duration_ms": None,
        })
        response, _conn = self._get_profile(
            None,
            aggregate=empty_aggregate,
        )

        self.assertEqual(response.status_code, 200)
        summary = response.get_json()["summary"]
        self.assertIsNone(summary["lastSubmissionId"])
        self.assertIsNone(summary["lastExecutionCodename"])
        self.assertIsNone(summary["lastExecutionDurationMs"])
        self.assertEqual(summary["lastExecutionStatus"], "Sin ejecuciones")
        self.assertEqual(summary["completedExecutions"], 0)
        self.assertEqual(summary["executionsCount"], 0)
        self.assertIn("avgDurationMs", summary)


if __name__ == "__main__":
    unittest.main()
