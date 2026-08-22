def student_batch_audit_description(
    *,
    course_id,
    actor,
    added_count,
    reactivated_count,
    already_active_count,
    rejected_count,
):
    return (
        "Curso #{course_id}: carga de estudiantes procesada "
        "por {actor} (agregados: {added}; "
        "reactivados: {reactivated}; ya activos: {already}; "
        "rechazados: {rejected})."
    ).format(
        course_id=course_id,
        actor=actor,
        added=added_count,
        reactivated=reactivated_count,
        already=already_active_count,
        rejected=rejected_count,
    )
