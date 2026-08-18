"""Lectura acotada de executions candidatas para comparación histórica."""

from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection


MAX_RECENT_CANDIDATES = 200


def _visibility_clause(current_role_name):
    role_name = str(current_role_name or "").strip().casefold()
    if role_name == "admin":
        return "", 0
    if role_name == "teacher":
        return (
            "AND (s.user_id = %s OR c.teacher_user_id = %s)",
            2,
        )
    return "AND s.user_id = %s", 1


def list_recent_candidate_executions(
    *,
    current_user_id,
    current_role_name,
    excluded_codenames,
    limit=MAX_RECENT_CANDIDATES,
    conn=None,
):
    """Lista codenames COMPLETED recientes visibles para el actor.

    Se solicita una fila adicional para informar truncamiento sin exponer un
    conteo global. La ruta aplica nuevamente ``assert_execution_viewer`` como
    defensa final antes de serializar cada candidate.
    """
    safe_limit = max(1, min(int(limit), MAX_RECENT_CANDIDATES))
    excluded = [
        str(codename).strip()
        for codename in (excluded_codenames or [])
        if str(codename).strip()
    ]
    visibility_sql, visibility_param_count = _visibility_clause(
        current_role_name
    )
    params = [excluded]
    params.extend([current_user_id] * visibility_param_count)
    params.append(safe_limit + 1)

    owns_connection = conn is None
    db = conn or get_connection()
    try:
        with db.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    e.codename
                FROM executions e
                JOIN submissions s ON s.id = e.submission_id
                LEFT JOIN courses c ON c.id = s.course_id
                WHERE e.execution_state = 'COMPLETED'
                  AND NOT (e.codename = ANY(%s))
                {visibility_sql}
                ORDER BY e.created_at DESC NULLS LAST, e.id DESC
                LIMIT %s;
                """.format(visibility_sql=visibility_sql),
                params,
            )
            rows = [dict(row) for row in cur.fetchall()]
    finally:
        if owns_connection:
            db.close()

    return {
        "items": rows[:safe_limit],
        "truncated": len(rows) > safe_limit,
    }
