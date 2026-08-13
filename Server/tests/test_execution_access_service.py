import unittest

from Server.webapp.services.execution_access_service import (
    ExecutionAccessForbidden,
    ExecutionAccessNotFound,
    assert_execution_owner,
)

class FakeRepository:
    def __init__(self, row):
        self.row = row

    def get_execution_access_row_by_codename(self, codename):
        if self.row is None:
            return None
        result = dict(self.row)
        result.setdefault("codename", codename)
        return result

class ExecutionAccessServiceTests(unittest.TestCase):
    def test_not_found(self):
        with self.assertRaises(ExecutionAccessNotFound):
            assert_execution_owner(
                "missingLCS",
                1,
                repository=FakeRepository(None),
            )

    def test_foreign_owner_is_forbidden(self):
        with self.assertRaises(ExecutionAccessForbidden):
            assert_execution_owner(
                "abcLCS",
                1,
                repository=FakeRepository({
                    "execution_id": 10,
                    "owner_user_id": 99,
                }),
            )

    def test_owner_is_allowed(self):
        row = assert_execution_owner(
            "abcLCS",
            1,
            repository=FakeRepository({
                "execution_id": 10,
                "public_id": "uuid",
                "owner_user_id": 1,
                "execution_state": "COMPLETED",
                "result_available": True,
            }),
        )
        self.assertEqual(row["execution_id"], 10)

    def test_owner_comparison_accepts_numeric_strings(self):
        row = assert_execution_owner(
            "abcLCS",
            "1",
            repository=FakeRepository({
                "execution_id": 10,
                "owner_user_id": 1,
            }),
        )
        self.assertEqual(row["owner_user_id"], 1)

    def test_state_metadata_is_preserved(self):
        row = assert_execution_owner(
            "abcLCS",
            1,
            repository=FakeRepository({
                "execution_id": 10,
                "owner_user_id": 1,
                "execution_state": "FAILED",
                "result_available": False,
            }),
        )
        self.assertEqual(row["execution_state"], "FAILED")
        self.assertFalse(row["result_available"])

if __name__ == "__main__":
    unittest.main()
