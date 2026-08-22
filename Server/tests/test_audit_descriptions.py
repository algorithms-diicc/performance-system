import unittest

from Server.webapp.utils.audit_descriptions import (
    student_batch_audit_description,
)


class AuditDescriptionTests(unittest.TestCase):
    def test_student_batch_uses_stable_count_labels(self):
        self.assertEqual(
            student_batch_audit_description(
                course_id=7,
                actor="admin@inf.udec.cl",
                added_count=1,
                reactivated_count=0,
                already_active_count=2,
                rejected_count=1,
            ),
            (
                "Curso #7: carga de estudiantes procesada por "
                "admin@inf.udec.cl (agregados: 1; reactivados: 0; "
                "ya activos: 2; rechazados: 1)."
            ),
        )


if __name__ == "__main__":
    unittest.main()
