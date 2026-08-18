from ..repositories import submission_access_repository


class SubmissionAccessError(Exception):
    pass


class SubmissionAccessNotFound(SubmissionAccessError):
    pass


class SubmissionAccessForbidden(SubmissionAccessError):
    pass


def is_submission_owner(access_row, current_user_id):
    return int(access_row["owner_user_id"]) == int(current_user_id)


def assert_submission_viewer(
    submission_id,
    current_user_id,
    current_role_name=None,
    conn=None,
    repository=submission_access_repository,
):
    """
    Permite consultar una Submission al propietario, Admin o profesor del curso.

    Un Teacher no obtiene acceso por rol solamente y no puede consultar una
    Submission sin curso. La vigencia del curso no interviene en la decisión.
    """
    if conn is None:
        row = repository.get_submission_access_row_by_id(submission_id)
    else:
        row = repository.get_submission_access_row_by_id(
            submission_id,
            conn=conn,
        )

    if row is None:
        raise SubmissionAccessNotFound(
            "La Submission solicitada no existe."
        )

    if is_submission_owner(row, current_user_id):
        return row

    role_name = str(current_role_name or "").strip().casefold()
    if role_name == "admin":
        return row

    teacher_user_id = row.get("course_teacher_user_id")
    if (
        role_name == "teacher"
        and teacher_user_id is not None
        and int(teacher_user_id) == int(current_user_id)
    ):
        return row

    raise SubmissionAccessForbidden(
        "No tienes permiso para acceder a esta Submission."
    )
