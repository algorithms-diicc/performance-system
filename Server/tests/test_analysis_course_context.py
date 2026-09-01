import unittest

from Server.webapp.services.execution_creation_service import (
    InvalidExecutionRequest,
    get_submission_course_context,
    resolve_submission_course,
)


class ScriptedCursor:
    def __init__(self, rows=None, role_row=None):
        self.rows = list(rows or [])
        self.role_row = role_row
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchall(self):
        return list(self.rows)

    def fetchone(self):
        return self.role_row


class FakeConnection:
    def __init__(self, cursor):
        self.cursor_instance = cursor
        self.closed = False

    def cursor(self, cursor_factory=None):
        return self.cursor_instance

    def close(self):
        self.closed = True


def course(course_id, code="INF-101"):
    return {
        "id": course_id,
        "code": code,
        "name": "Algorithms",
        "academic_year": 2026,
        "academic_term": 2,
        "teacher_user_id": 7,
        "is_active": True,
        "teacher_full_name": "Ada Teacher",
        "teacher_email": "teacher@example.com",
        "membership_created_at": None,
    }


class AnalysisCourseContextTests(unittest.TestCase):
    def test_student_single_course_is_auto_selected(self):
        cursor = ScriptedCursor(rows=[course(11)])
        conn = FakeConnection(cursor)

        context = get_submission_course_context(
            user_id=7,
            role_name="Student",
            conn=conn,
        )

        self.assertEqual(
            context["auto_selected_course_id"],
            11,
        )
        self.assertFalse(context["selection_required"])
        self.assertTrue(context["personal_allowed"])
        self.assertIn(
            "course_memberships",
            cursor.executed[0][0],
        )

    def test_student_multiple_courses_allow_personal_but_legacy_omission_requires_context(self):
        cursor = ScriptedCursor(
            rows=[course(11), course(12, "INF-102")]
        )
        conn = FakeConnection(cursor)

        context = get_submission_course_context(
            user_id=7,
            role_name="Student",
            conn=conn,
        )

        self.assertFalse(context["selection_required"])
        self.assertIsNone(
            context["auto_selected_course_id"]
        )
        self.assertTrue(context["personal_allowed"])

        cursor = ScriptedCursor(
            rows=[course(11), course(12, "INF-102")]
        )
        conn = FakeConnection(cursor)

        with self.assertRaises(InvalidExecutionRequest):
            resolve_submission_course(
                user_id=7,
                role_name="Student",
                conn=conn,
            )

    def test_student_single_course_can_explicitly_choose_personal(self):
        cursor = ScriptedCursor(rows=[course(11)])
        conn = FakeConnection(cursor)

        resolved = resolve_submission_course(
            user_id=7,
            requested_course_mode="PERSONAL",
            role_name="Student",
            conn=conn,
        )

        self.assertIsNone(resolved)

    def test_student_multiple_courses_can_explicitly_choose_personal(self):
        cursor = ScriptedCursor(
            rows=[course(11), course(12, "INF-102")]
        )
        conn = FakeConnection(cursor)

        resolved = resolve_submission_course(
            user_id=7,
            requested_course_mode="PERSONAL",
            role_name="Student",
            conn=conn,
        )

        self.assertIsNone(resolved)

    def test_course_mode_course_requires_explicit_course_id(self):
        cursor = ScriptedCursor(rows=[course(11)])
        conn = FakeConnection(cursor)

        with self.assertRaises(InvalidExecutionRequest):
            resolve_submission_course(
                user_id=7,
                requested_course_mode="COURSE",
                role_name="Student",
                conn=conn,
            )

    def test_teacher_courses_are_optional_and_never_auto_selected(self):
        cursor = ScriptedCursor(rows=[course(21)])
        conn = FakeConnection(cursor)

        context = get_submission_course_context(
            user_id=7,
            role_name="Teacher",
            conn=conn,
        )

        self.assertTrue(context["personal_allowed"])
        self.assertFalse(context["selection_required"])
        self.assertIsNone(
            context["auto_selected_course_id"]
        )

        sql = cursor.executed[0][0]
        self.assertIn("c.teacher_user_id = %s", sql)
        self.assertNotIn("course_memberships", sql)

    def test_teacher_without_explicit_course_remains_personal(self):
        cursor = ScriptedCursor(rows=[course(21)])
        conn = FakeConnection(cursor)

        resolved = resolve_submission_course(
            user_id=7,
            role_name="Teacher",
            conn=conn,
        )

        self.assertIsNone(resolved)

    def test_teacher_can_explicitly_select_owned_active_course(self):
        cursor = ScriptedCursor(rows=[course(21)])
        conn = FakeConnection(cursor)

        resolved = resolve_submission_course(
            user_id=7,
            requested_course_id=21,
            role_name="Teacher",
            conn=conn,
        )

        self.assertEqual(resolved, 21)

    def test_teacher_cannot_select_course_outside_owned_scope(self):
        cursor = ScriptedCursor(rows=[course(21)])
        conn = FakeConnection(cursor)

        with self.assertRaises(InvalidExecutionRequest):
            resolve_submission_course(
                user_id=7,
                requested_course_id=99,
                role_name="Teacher",
                conn=conn,
            )

    def test_admin_uses_same_optional_owned_course_contract(self):
        cursor = ScriptedCursor(
            rows=[course(31), course(32, "INF-202")]
        )
        conn = FakeConnection(cursor)

        context = get_submission_course_context(
            user_id=7,
            role_name="Admin",
            conn=conn,
        )

        self.assertTrue(context["personal_allowed"])
        self.assertFalse(context["selection_required"])
        self.assertIsNone(
            context["auto_selected_course_id"]
        )
        self.assertIn(
            "c.teacher_user_id = %s",
            cursor.executed[0][0],
        )


if __name__ == "__main__":
    unittest.main()
