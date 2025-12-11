from db_connection import get_connection


def main():
    try:
        conn = get_connection()
        print("✅ Conexión a PostgreSQL OK")

        cur = conn.cursor()

        # 1) Hora actual de la BD
        cur.execute("SELECT NOW();")
        now = cur.fetchone()

        # 2) Ver tablas públicas
        cur.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name;
            """
        )
        tables = cur.fetchall()
        print("Tablas en 'public':")
        for t in tables:
            # Igual: t puede ser dict o tupla
            # Si usas RealDictCursor, t["table_name"] sirve,
            # pero por simplicidad usamos t[0].
            print(" -", t[0])

        cur.close()
        conn.close()
        print("✅ Test finalizado sin errores")

    except Exception as e:
        print("❌ Error al conectar o consultar:", e)


if __name__ == "__main__":
    main()
