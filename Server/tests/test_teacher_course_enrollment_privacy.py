import unittest

from Server.webapp.routes.teacher_courses_routes import (
    _is_enrollable_student,
    _privacy_safe_enrollment_rejection,
)


class TeacherCourseEnrollmentPrivacyTests(unittest.TestCase):
    def test_only_active_student_is_enrollable(self):
        self.assertTrue(
            _is_enrollable_student(
                "Student",
                True,
            )
        )
        self.assertFalse(
            _is_enrollable_student(
                "Student",
                False,
            )
        )
        self.assertFalse(
            _is_enrollable_student(
                "Teacher",
                True,
            )
        )
        self.assertFalse(
            _is_enrollable_student(
                "Admin",
                True,
            )
        )

    def test_non_eligible_candidates_share_the_same_safe_rejection(self):
        requested_email = "persona@inf.udec.cl"
        expected = {
            "email": requested_email,
            "reason": "NOT_ELIGIBLE",
        }

        candidates = [
            None,
            {
                "email": "persona@inf.udec.cl",
                "role_name": "Teacher",
                "is_active": True,
            },
            {
                "email": "persona@inf.udec.cl",
                "role_name": "Student",
                "is_active": False,
            },
        ]

        for candidate in candidates:
            with self.subTest(candidate=candidate):
                self.assertEqual(
                    _privacy_safe_enrollment_rejection(
                        requested_email,
                        candidate,
                    ),
                    expected,
                )

    def test_active_student_has_no_rejection(self):
        self.assertIsNone(
            _privacy_safe_enrollment_rejection(
                "alumno@inf.udec.cl",
                {
                    "email": "alumno@inf.udec.cl",
                    "role_name": "Student",
                    "is_active": True,
                },
            )
        )


if __name__ == "__main__":
    unittest.main()
