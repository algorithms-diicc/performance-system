from ..repositories import execution_access_repository

class ExecutionAccessError(Exception):
    pass

class ExecutionAccessNotFound(ExecutionAccessError):
    pass

class ExecutionAccessForbidden(ExecutionAccessError):
    pass

def assert_execution_owner(
    codename,
    current_user_id,
    repository=execution_access_repository,
):
    row = repository.get_execution_access_row_by_codename(codename)
    if row is None:
        raise ExecutionAccessNotFound(
            "La ejecución solicitada no existe."
        )
    if int(row["owner_user_id"]) != int(current_user_id):
        raise ExecutionAccessForbidden(
            "No tienes permiso para acceder a esta ejecución."
        )
    return row


def assert_execution_viewer(
    codename,
    current_user_id,
    current_role_name=None,
    repository=execution_access_repository,
):
    """
    Permite consultar resultados al propietario, Admin o profesor del curso.

    Las ejecuciones sin curso conservan el acceso exclusivo de su propietario,
    salvo para Admin. Un Teacher nunca obtiene acceso por rol solamente.
    """
    row = repository.get_execution_access_row_by_codename(codename)
    if row is None:
        raise ExecutionAccessNotFound(
            "La ejecución solicitada no existe."
        )

    if int(row["owner_user_id"]) == int(current_user_id):
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

    raise ExecutionAccessForbidden(
        "No tienes permiso para acceder a esta ejecución."
    )
