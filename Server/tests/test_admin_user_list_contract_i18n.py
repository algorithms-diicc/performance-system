import unittest

from Server.webapp.routes.admin_users_routes import (
    parse_admin_user_status_filter,
    serialize_admin_user_list_item,
)
from Server.webapp.utils.api_errors import BadRequestError


class AdminUserListContractI18nTest(unittest.TestCase):
    def test_status_filter_accepts_technical_and_legacy_values(self):
        self.assertIsNone(
            parse_admin_user_status_filter("all")
        )
        self.assertIsNone(
            parse_admin_user_status_filter("")
        )

        self.assertIs(
            parse_admin_user_status_filter("active"),
            True,
        )
        self.assertIs(
            parse_admin_user_status_filter("inactive"),
            False,
        )

        self.assertIs(
            parse_admin_user_status_filter("Activo"),
            True,
        )
        self.assertIs(
            parse_admin_user_status_filter("Inactivo"),
            False,
        )

        with self.assertRaises(BadRequestError):
            parse_admin_user_status_filter("enabled")

    def test_list_item_exposes_technical_activity_contract(self):
        row = {
            "id": 3,
            "full_name": "Ada Lovelace",
            "email": "ada@example.com",
            "role_name": "Student",
            "is_active": True,
            "created_at": None,
            "submissions_count": 2,
            "executions_count": 4,
            "completed_executions": 2,
            "failed_executions": 1,
            "queued_executions": 1,
            "running_executions": 0,
            "processing_executions": 0,
            "cancelled_executions": 0,
            "last_execution_state": "QUEUED",
            "last_execution_public_id": "public-70",
            "last_execution_codename": "exec70LCS",
            "last_execution_at": None,
        }

        item = serialize_admin_user_list_item(row)

        self.assertIs(item["isActive"], True)
        self.assertEqual(item["status"], "Activo")
        self.assertEqual(item["role"], "Student")
        self.assertEqual(
            item["lastExecutionState"],
            "QUEUED",
        )
        self.assertEqual(
            item["lastExecutionStatus"],
            "En cola",
        )
        self.assertEqual(
            item["completedExecutions"],
            2,
        )
        self.assertEqual(
            item["failedExecutions"],
            1,
        )
        self.assertEqual(
            item["passedCount"],
            2,
        )
        self.assertEqual(
            item["failedCount"],
            1,
        )


if __name__ == "__main__":
    unittest.main()
