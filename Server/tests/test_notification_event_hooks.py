import unittest
from unittest.mock import patch

from Server.webapp.services import execution_state_service


FAILED_ROW = {
    "id": 44,
    "public_id": "11111111-1111-1111-1111-111111111111",
    "submission_id": 7,
    "execution_state": "FAILED",
    "state_version": 3,
}


class NotificationEventHookTests(unittest.TestCase):
    def test_failed_transition_emits_owner_notification(self):
        current = {
            "execution_state": "RUNNING",
            "state_version": 2,
        }

        with patch.object(
            execution_state_service.execution_repository,
            "get_execution",
            return_value=current,
        ), patch.object(
            execution_state_service.execution_repository,
            "transition_execution",
            return_value=FAILED_ROW,
        ), patch.object(
            execution_state_service.notification_service,
            "notify_execution_failed",
            return_value={"id": 9},
        ) as notify:
            row = execution_state_service.mark_failed(
                FAILED_ROW["public_id"],
                failure_stage="EXECUTION",
                error_code="RUNTIME_ERROR",
                error_message="boom",
            )

        self.assertEqual(row, FAILED_ROW)
        notify.assert_called_once_with(
            FAILED_ROW,
            conn=None,
        )

    def test_notification_failure_does_not_break_failed_transition(self):
        current = {
            "execution_state": "RUNNING",
            "state_version": 2,
        }

        with patch.object(
            execution_state_service.execution_repository,
            "get_execution",
            return_value=current,
        ), patch.object(
            execution_state_service.execution_repository,
            "transition_execution",
            return_value=FAILED_ROW,
        ), patch.object(
            execution_state_service.notification_service,
            "notify_execution_failed",
            side_effect=RuntimeError("notifications unavailable"),
        ):
            row = execution_state_service.mark_failed(
                FAILED_ROW["public_id"],
                failure_stage="INFRASTRUCTURE",
                error_code="DISPATCHER_ERROR",
                error_message="dispatch failed",
            )

        self.assertEqual(row["execution_state"], "FAILED")

    def test_injected_repository_does_not_emit_notification(self):
        class FakeRepository:
            def get_execution(self, public_id, conn=None):
                return {
                    "execution_state": "RUNNING",
                    "state_version": 0,
                }

            def transition_execution(self, **kwargs):
                return dict(
                    FAILED_ROW,
                    state_version=1,
                )

        with patch.object(
            execution_state_service.notification_service,
            "notify_execution_failed",
        ) as notify:
            row = execution_state_service.mark_failed(
                FAILED_ROW["public_id"],
                failure_stage="EXECUTION",
                error_code="RUNTIME_ERROR",
                repository=FakeRepository(),
            )

        self.assertEqual(row["execution_state"], "FAILED")
        notify.assert_not_called()


if __name__ == "__main__":
    unittest.main()
