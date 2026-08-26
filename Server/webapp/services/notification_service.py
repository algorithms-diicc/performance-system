"""Persistencia mínima de eventos para la bandeja interna."""

from ...db_connection import get_connection


NOTIFICATION_EXECUTION_FAILED = "EXECUTION_FAILED"
NOTIFICATION_TEACHER_FEEDBACK = "TEACHER_FEEDBACK"
NOTIFICATION_PROTOCOL_PUBLISHED = "PROTOCOL_PUBLISHED"

_FAILURE_SAVEPOINT = "ps_notify_execution_failed"


def notify_teacher_feedback(
    cur,
    *,
    feedback_id,
    submission_id,
    owner_user_id,
    actor_user_id,
):
    """Crea una notificación idempotente para el propietario del experimento."""
    if int(owner_user_id) == int(actor_user_id):
        return None

    cur.execute(
        """
        INSERT INTO notifications (
            user_id,
            kind,
            event_key,
            submission_id,
            feedback_id,
            actor_user_id,
            is_read,
            created_at
        )
        VALUES (
            %s,
            %s,
            %s,
            %s,
            %s,
            %s,
            FALSE,
            NOW()
        )
        ON CONFLICT (user_id, kind, event_key)
        DO NOTHING
        RETURNING id;
        """,
        (
            owner_user_id,
            NOTIFICATION_TEACHER_FEEDBACK,
            "feedback:{}".format(feedback_id),
            submission_id,
            feedback_id,
            actor_user_id,
        ),
    )
    return cur.fetchone()


def notify_protocol_published(
    cur,
    *,
    protocol_id,
    course_id,
    actor_user_id,
    published_at,
):
    """Notifica a estudiantes activos del curso cada publicación concreta."""
    event_key = "protocol:{}:published:{}".format(
        protocol_id,
        published_at.isoformat()
        if hasattr(published_at, "isoformat")
        else str(published_at),
    )

    cur.execute(
        """
        INSERT INTO notifications (
            user_id,
            kind,
            event_key,
            protocol_id,
            actor_user_id,
            is_read,
            created_at
        )
        SELECT
            cm.user_id,
            %s,
            %s,
            %s,
            %s,
            FALSE,
            NOW()
        FROM course_memberships cm
        JOIN users u
          ON u.id = cm.user_id
        JOIN roles r
          ON r.id = u.role_id
        WHERE cm.course_id = %s
          AND cm.is_active = TRUE
          AND u.is_active = TRUE
          AND LOWER(r.name) = 'student'
        ON CONFLICT (user_id, kind, event_key)
        DO NOTHING;
        """,
        (
            NOTIFICATION_PROTOCOL_PUBLISHED,
            event_key,
            protocol_id,
            actor_user_id,
            course_id,
        ),
    )


def notify_execution_failed(execution, conn=None):
    """
    Notifica al propietario sin volver frágil la transición FAILED.

    Si la transición pertenece a una transacción externa se usa SAVEPOINT,
    de modo que un fallo secundario de notificaciones no aborte la transición.
    """
    owns_connection = conn is None
    db = conn or get_connection()

    try:
        with db.cursor() as cur:
            if not owns_connection:
                cur.execute(
                    "SAVEPOINT {};".format(_FAILURE_SAVEPOINT)
                )

            try:
                cur.execute(
                    """
                    INSERT INTO notifications (
                        user_id,
                        kind,
                        event_key,
                        submission_id,
                        execution_id,
                        is_read,
                        created_at
                    )
                    SELECT
                        s.user_id,
                        %s,
                        %s,
                        e.submission_id,
                        e.id,
                        FALSE,
                        NOW()
                    FROM executions e
                    JOIN submissions s
                      ON s.id = e.submission_id
                    WHERE e.id = %s
                      AND e.submission_id = %s
                    ON CONFLICT (user_id, kind, event_key)
                    DO NOTHING
                    RETURNING id;
                    """,
                    (
                        NOTIFICATION_EXECUTION_FAILED,
                        "execution:{}:failed".format(
                            execution["public_id"]
                        ),
                        execution["id"],
                        execution["submission_id"],
                    ),
                )
                row = cur.fetchone()

            except Exception:
                if not owns_connection:
                    cur.execute(
                        "ROLLBACK TO SAVEPOINT {};".format(
                            _FAILURE_SAVEPOINT
                        )
                    )
                    cur.execute(
                        "RELEASE SAVEPOINT {};".format(
                            _FAILURE_SAVEPOINT
                        )
                    )
                raise

            if not owns_connection:
                cur.execute(
                    "RELEASE SAVEPOINT {};".format(
                        _FAILURE_SAVEPOINT
                    )
                )

        if owns_connection:
            db.commit()

        return row

    except Exception:
        if owns_connection:
            db.rollback()
        raise

    finally:
        if owns_connection:
            db.close()
