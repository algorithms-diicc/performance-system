# server/webapp/utils/db_utils.py
from contextlib import contextmanager
from psycopg2.extras import RealDictCursor

from ...db_connection import get_connection


@contextmanager
def db_cursor(dict_cursor=True):
    """
    Context manager para manejar conexión y cursor de BD de forma segura.

    Uso típico en un endpoint:

        from ..utils.db_utils import db_cursor

        @bp.route("/api/demo", methods=["GET"])
        def demo():
            with db_cursor() as (conn, cur):
                cur.execute("SELECT * FROM users;")
                rows = cur.fetchall()
            return jsonify(rows), 200

    - Abre conexión con get_connection().
    - Crea cursor (RealDictCursor por defecto).
    - Si todo va bien → commit.
    - Si hay excepción → rollback y se re-lanza la excepción.
    - Siempre cierra la conexión.
    """
    conn = get_connection()
    try:
        cursor_factory = RealDictCursor if dict_cursor else None
        with conn.cursor(cursor_factory=cursor_factory) as cur:
            yield conn, cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
