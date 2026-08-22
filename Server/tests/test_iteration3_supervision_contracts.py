from contextlib import nullcontext
import unittest
from unittest.mock import patch

from flask import Flask, g

from Server.webapp.routes.admin_users_routes import (
    change_user_role_in_transaction,
    parse_admin_role_target,
)
from Server.webapp.routes.teacher_courses_routes import (
    _course_scope_sql,
    clone_course_in_transaction,
    teacher_courses_bp,
)
from Server.webapp.utils.api_errors import (
    APIError,
    BadRequestError,
    ForbiddenError,
    ValidationError,
)


ADMIN = {
    "id": 2,
    "email": "admin@example.com",
    "role_name": "Admin",
}

TEACHER = {
    "id": 11,
    "email": "teacher@example.com",
    "role_name": "Teacher",
}


class ScriptedCursor:
    def __init__(self, fetchone=None, fetchall=None):
        self.fetchone_responses = list(fetchone or [])
        self.fetchall_responses = list(fetchall or [])
        self.executed = []

    def execute(self, sql, params=None):
        self.executed.append((sql, params))

    def fetchone(self):
        if not self.fetchone_responses:
            raise AssertionError("Unexpected fetchone()")
        return self.fetchone_responses.pop(0)

    def fetchall(self):
        if not self.fetchall_responses:
            raise AssertionError("Unexpected fetchall()")
        return self.fetchall_responses.pop(0)


def target_user(role):
    return {
        "id": 7,
        "full_name": "Ada Lovelace",
        "email": "ada@example.com",
        "role_name": role,
    }


def source_course():
    return {
        "id": 10,
        "code": "INF-101",
        "name": "Algorithms",
        "academic_year": 2026,
        "academic_term": 2,
        "teacher_user_id": TEACHER["id"],
        "is_active": False,
    }


def cloned_course():
    return {
        "id": 99,
        "code": "INF-101",
        "name": "Algorithms",
        "academic_year": 2027,
        "academic_term": 1,
        "teacher_user_id": TEACHER["id"],
        "is_active": True,
        "created_at": None,
        "updated_at": None,
    }


def teacher_row():
    return {
        "id": TEACHER["id"],
        "full_name": "Current Teacher",
        "email": TEACHER["email"],
        "is_active": True,
        "role_name": "Teacher",
    }


class Iteration3RoleContractTests(unittest.TestCase):
    def test_student_to_teacher_uses_named_role_and_audits(self):
        cur = ScriptedCursor(
            fetchone=[
                target_user("Student"),
                {"id": 30},
            ]
        )

        result = change_user_role_in_transaction(
            cur,
            7,
            "Teacher",
            ADMIN,
        )

        self.assertTrue(result["changed"])
        self.assertEqual(result["previousRole"], "Student")
        self.assertEqual(result["role"], "Teacher")
        self.assertTrue(
            any(
                "WHERE name = %s" in sql
                and params == ("Teacher",)
                for sql, params in cur.executed
            )
        )
        self.assertTrue(
            any(
                params
                and "change_user_role" in params
                for _sql, params in cur.executed
            )
        )
        self.assertIn("FOR UPDATE", cur.executed[0][0])

    def test_teacher_to_student_without_courses_succeeds(self):
        cur = ScriptedCursor(
            fetchone=[
                target_user("Teacher"),
                {"assigned_courses": 0},
                {"id": 10},
            ]
        )

        result = change_user_role_in_transaction(
            cur,
            7,
            "Student",
            ADMIN,
        )

        self.assertTrue(result["changed"])
        self.assertEqual(result["role"], "Student")

    def test_teacher_demotion_counts_active_and_historical_courses(self):
        for scenario in ("active", "historical"):
            with self.subTest(scenario=scenario):
                cur = ScriptedCursor(
                    fetchone=[
                        target_user("Teacher"),
                        {"assigned_courses": 1},
                    ]
                )

                with self.assertRaises(APIError) as raised:
                    change_user_role_in_transaction(
                        cur,
                        7,
                        "Student",
                        ADMIN,
                    )

                error = raised.exception
                self.assertEqual(error.status_code, 409)
                self.assertEqual(
                    error.code,
                    "USER_HAS_ASSIGNED_COURSES",
                )
                self.assertEqual(error.extra["assignedCourses"], 1)
                count_sql = cur.executed[1][0].casefold()
                self.assertIn("from courses", count_sql)
                self.assertNotIn("is_active", count_sql)

    def test_target_admin_is_not_a_manageable_role(self):
        with self.assertRaises(ValidationError):
            parse_admin_role_target("Admin")

    def test_admin_role_is_protected(self):
        cur = ScriptedCursor(
            fetchone=[
                target_user("Admin"),
            ]
        )

        with self.assertRaises(ForbiddenError):
            change_user_role_in_transaction(
                cur,
                7,
                "Teacher",
                ADMIN,
            )

        self.assertEqual(len(cur.executed), 1)


class Iteration3CloneContractTests(unittest.TestCase):
    def _clone(self, copy_students, roster_rows=None):
        cur = ScriptedCursor(
            fetchone=[
                None,
                cloned_course(),
            ],
            fetchall=(
                [roster_rows or []]
                if copy_students
                else []
            ),
        )

        result = clone_course_in_transaction(
            cur,
            source_course(),
            teacher_row(),
            2027,
            1,
            copy_students,
            ADMIN,
        )
        return cur, result

    def test_clone_without_roster_creates_active_course_and_audits(self):
        cur, (course, count) = self._clone(False)

        self.assertEqual(count, 0)
        self.assertTrue(course["is_active"])
        self.assertEqual(course["teacher_user_id"], TEACHER["id"])
        sql = "\n".join(item[0] for item in cur.executed)
        self.assertNotIn("INSERT INTO course_memberships", sql)
        self.assertNotIn("submissions", sql.casefold())
        self.assertNotIn("executions", sql.casefold())
        self.assertTrue(
            any(
                params
                and "clone_course" in params
                for _sql, params in cur.executed
            )
        )

    def test_clone_with_roster_copies_only_active_memberships(self):
        cur, (course, count) = self._clone(
            True,
            roster_rows=[{"id": 301}, {"id": 302}],
        )

        self.assertEqual(count, 2)
        self.assertEqual(course["active_students"], 2)
        roster_sql = next(
            sql
            for sql, _params in cur.executed
            if "INSERT INTO course_memberships" in sql
        )
        self.assertIn("cm.is_active = TRUE", roster_sql)
        self.assertNotIn("submissions", roster_sql.casefold())
        self.assertNotIn("executions", roster_sql.casefold())

    def test_duplicate_clone_target_is_rejected_before_insert(self):
        cur = ScriptedCursor(fetchone=[{"id": 88}])

        with self.assertRaises(BadRequestError):
            clone_course_in_transaction(
                cur,
                source_course(),
                teacher_row(),
                2027,
                1,
                False,
                ADMIN,
            )

        self.assertEqual(len(cur.executed), 1)
        self.assertIn("FROM courses", cur.executed[0][0])

    def test_course_scope_distinguishes_teacher_and_admin(self):
        app = Flask(__name__)

        with app.test_request_context("/"):
            g.current_user = TEACHER
            g.current_role_name = "Teacher"
            sql, params = _course_scope_sql("c")
            self.assertEqual(sql, "c.teacher_user_id = %s")
            self.assertEqual(params, [TEACHER["id"]])

        with app.test_request_context("/"):
            g.current_user = ADMIN
            g.current_role_name = "Admin"
            sql, params = _course_scope_sql("c")
            self.assertEqual(sql, "TRUE")
            self.assertEqual(params, [])


class Iteration3TransferRouteTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.config.update(TESTING=True, SECRET_KEY="test-only")
        app.register_blueprint(teacher_courses_bp)
        self.client = app.test_client()

    def test_admin_transfer_sends_target_id_and_distinct_audit_action(self):
        current = {
            **source_course(),
            "created_at": None,
            "updated_at": None,
            "teacher_full_name": "Current Teacher",
            "teacher_email": TEACHER["email"],
        }
        transferred = {
            **cloned_course(),
            "id": current["id"],
            "academic_year": current["academic_year"],
            "academic_term": current["academic_term"],
            "teacher_user_id": 22,
        }
        next_teacher = {
            "id": 22,
            "full_name": "New Teacher",
            "email": "new@example.com",
            "is_active": True,
            "role_name": "Teacher",
        }
        aggregates = {
            "active_students": 0,
            "total_students": 0,
            "submissions_count": 0,
            "executions_count": 0,
            "last_activity_at": None,
        }
        cur = ScriptedCursor(
            fetchone=[
                current,
                next_teacher,
                None,
                transferred,
                {
                    "full_name": next_teacher["full_name"],
                    "email": next_teacher["email"],
                },
                aggregates,
            ]
        )

        with patch(
            "Server.webapp.utils.auth_decorators.get_current_user",
            return_value=ADMIN,
        ), patch(
            "Server.webapp.routes.teacher_courses_routes.db_cursor",
            return_value=nullcontext((None, cur)),
        ):
            response = self.client.patch(
                "/api/teacher/courses/10",
                json={"teacherUserId": 22},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["course"]["teacher"]["id"], 22)
        actions = [
            params[1]
            for _sql, params in cur.executed
            if params
            and len(params) >= 2
            and params[1] in {
                "transfer_course_teacher",
                "update_course",
            }
        ]
        self.assertEqual(actions, ["transfer_course_teacher"])
        self.assertTrue(
            any(
                "teacher_user_id = %s" in sql
                and params
                and 22 in params
                for sql, params in cur.executed
            )
        )

    def test_teacher_cannot_transfer_course(self):
        current = {
            **source_course(),
            "created_at": None,
            "updated_at": None,
            "teacher_full_name": "Current Teacher",
            "teacher_email": TEACHER["email"],
        }
        cur = ScriptedCursor(fetchone=[current])

        with patch(
            "Server.webapp.utils.auth_decorators.get_current_user",
            return_value=TEACHER,
        ), patch(
            "Server.webapp.routes.teacher_courses_routes.db_cursor",
            return_value=nullcontext((None, cur)),
        ):
            response = self.client.patch(
                "/api/teacher/courses/10",
                json={"teacherUserId": 22},
            )

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()["error"]["code"], "FORBIDDEN")


if __name__ == "__main__":
    unittest.main()
