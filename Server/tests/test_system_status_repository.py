import unittest
from datetime import datetime

from Server.webapp.repositories import system_status_repository as repository


class ScriptedCursor:
    def __init__(self, connection):
        self.connection = connection
        self.response = None

    def execute(self, sql, params=None):
        self.connection.executed.append((sql, params))
        response = self.connection.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        self.response = response

    def fetchone(self):
        return self.response

    def fetchall(self):
        return list(self.response)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class ScriptedConnection:
    def __init__(self, responses):
        self.responses = list(responses)
        self.executed = []
        self.closed = 0
        self.commits = 0
        self.rollbacks = 0

    def cursor(self, cursor_factory=None):
        return ScriptedCursor(self)

    def close(self):
        self.closed += 1

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1


def operational_row():
    return {
        "queued": 2,
        "running": 1,
        "processing": 0,
        "oldest_queued_at": datetime(2026, 8, 22, 9, 0),
        "stale_active": 1,
        "latest_completed_at": datetime(2026, 8, 22, 10, 0),
        "latest_failed_at": None,
        "snapshot_schema_version": None,
    }


class SystemStatusRepositoryTests(unittest.TestCase):
    def test_reads_operational_data_and_exact_lock_signals_without_writes(self):
        conn = ScriptedConnection(
            [
                operational_row(),
                [
                    {"name": "dispatcher", "signal": "LOCK_OBSERVED"},
                    {"name": "watchdog", "signal": "LOCK_NOT_OBSERVED"},
                ],
            ]
        )
        cutoff = datetime(2026, 8, 22, 12, 0)

        result = repository.fetch_system_status(
            active_before=cutoff,
            dispatcher_lock_key=74040102,
            watchdog_lock_key=74040101,
            conn=conn,
        )

        self.assertEqual(result["operational"]["queued"], 2)
        self.assertEqual(
            result["lock_signals"],
            {
                "dispatcher": "LOCK_OBSERVED",
                "watchdog": "LOCK_NOT_OBSERVED",
            },
        )
        self.assertEqual(conn.executed[0][1], (cutoff,))
        self.assertEqual(conn.executed[1][1], (74040102, 74040101))
        self.assertEqual(conn.commits, 0)
        self.assertEqual(conn.rollbacks, 0)
        self.assertEqual(conn.closed, 0)

    def test_connection_failure_is_unavailable_and_does_not_leak_cause(self):
        def fail_connection():
            raise RuntimeError("password=private")

        with self.assertRaises(repository.DatabaseUnavailable) as context:
            repository.fetch_system_status(
                active_before=datetime(2026, 8, 22),
                dispatcher_lock_key=1,
                watchdog_lock_key=2,
                connection_factory=fail_connection,
            )

        self.assertIsNone(context.exception.__cause__)
        self.assertNotIn("private", str(context.exception))

    def test_main_query_failure_is_unknown_and_owned_connection_is_closed(self):
        conn = ScriptedConnection([RuntimeError("query text")])

        with self.assertRaises(repository.DiagnosticQueryUnavailable):
            repository.fetch_system_status(
                active_before=datetime(2026, 8, 22),
                dispatcher_lock_key=1,
                watchdog_lock_key=2,
                connection_factory=lambda: conn,
            )

        self.assertEqual(conn.closed, 1)

    def test_lock_query_failure_keeps_main_diagnostic_available(self):
        conn = ScriptedConnection(
            [operational_row(), RuntimeError("pg_locks denied")]
        )

        result = repository.fetch_system_status(
            active_before=datetime(2026, 8, 22),
            dispatcher_lock_key=1,
            watchdog_lock_key=2,
            conn=conn,
        )

        self.assertEqual(result["operational"]["running"], 1)
        self.assertEqual(
            result["lock_signals"],
            {"dispatcher": "UNKNOWN", "watchdog": "UNKNOWN"},
        )

    def test_main_sql_uses_exact_stale_boundary_and_never_marks_queued_stale(self):
        normalized = " ".join(repository.SYSTEM_STATUS_SQL.split())
        stale_fragment = (
            "e.execution_state IN ('RUNNING', 'PROCESSING') "
            "AND COALESCE(e.last_heartbeat_at, e.updated_at) <= %s"
        )

        self.assertIn(stale_fragment, normalized)
        self.assertNotIn("e.execution_state = 'QUEUED' AND COALESCE", normalized)
        self.assertIn("MIN(e.queued_at)", normalized)
        self.assertIn("MAX(e.finished_at)", normalized)

    def test_snapshot_query_selects_only_schema_1_0_scalar_whitelist(self):
        normalized = " ".join(repository.SYSTEM_STATUS_SQL.split())

        self.assertIn("->> 'schema_version' = '1.0'", normalized)
        self.assertIn(
            "ORDER BY COALESCE( e.finished_at, e.updated_at, e.created_at ) "
            "DESC, e.id DESC LIMIT 1",
            normalized,
        )
        self.assertIn("'{energy,EnergyPkg,event_exposed}'", normalized)
        self.assertIn("'{energy,EnergyCores,probe_state}'", normalized)
        self.assertIn("'{energy,EnergyRAM,measurement_available}'", normalized)
        self.assertNotIn("SELECT e.hardware_snapshot,", normalized)
        self.assertNotIn("AS hardware_snapshot", normalized)

    def test_schema_1_0_snapshot_with_additive_toolchain_remains_compatible(self):
        snapshot = {
            "schema_version": "1.0",
            "node": {},
            "measurement": {},
            "energy": {},
            "toolchain": {
                "compiler": {
                    "family": "GNU",
                    "name": "gcc",
                    "version": "gcc test",
                }
            },
        }
        normalized = " ".join(repository.SYSTEM_STATUS_SQL.split())

        self.assertEqual(snapshot["schema_version"], "1.0")
        self.assertNotIn("jsonb_object_keys", normalized)
        self.assertNotIn("'{toolchain", normalized)
        self.assertIn("->> 'schema_version' = '1.0'", normalized)

    def test_lock_sql_matches_database_objsubid_and_signed_bigint_halves(self):
        normalized = " ".join(repository.PROCESS_LOCKS_SQL.split())

        self.assertIn("FROM pg_catalog.pg_locks l", normalized)
        self.assertIn("l.database = ( SELECT d.oid", normalized)
        self.assertIn("d.datname = current_database()", normalized)
        self.assertIn("l.objsubid = 1", normalized)
        self.assertIn("l.granted IS TRUE", normalized)
        self.assertIn("l.mode = 'ExclusiveLock'", normalized)
        self.assertIn("(r.lock_key >> 32) & 4294967295::bigint", normalized)
        self.assertIn("r.lock_key & 4294967295::bigint", normalized)
        self.assertNotIn("pg_try_advisory", normalized)
        self.assertNotIn("pg_advisory_unlock", normalized)


if __name__ == "__main__":
    unittest.main()
