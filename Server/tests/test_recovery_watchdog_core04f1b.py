import unittest
from types import SimpleNamespace

from Server import recovery_watchdog as watchdog


class FakeCursor:
    def __init__(self, rows):
        self.rows = list(rows)
        self.executed = []

    def execute(self, sql, params):
        self.executed.append((sql, params))

    def fetchone(self):
        return self.rows.pop(0)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeConnection:
    def __init__(self, rows):
        self.cursor_obj = FakeCursor(rows)

    def cursor(self):
        return self.cursor_obj


class RecoveryWatchdogTests(unittest.TestCase):
    def test_acquire_lock_true(self):
        conn = FakeConnection([{"acquired": True}])
        self.assertTrue(watchdog.acquire_singleton_lock(conn))

    def test_acquire_lock_false(self):
        conn = FakeConnection([{"acquired": False}])
        self.assertFalse(watchdog.acquire_singleton_lock(conn))

    def test_release_lock(self):
        conn = FakeConnection([{"released": True}])
        self.assertTrue(watchdog.release_singleton_lock(conn))

    def test_cycle_defaults_to_requested_dry_run(self):
        calls = []

        def fake_recovery(**kwargs):
            calls.append(kwargs)
            return {"dry_run": kwargs["dry_run"]}

        result = watchdog.run_recovery_cycle(
            apply_changes=False,
            active_stale_seconds=90,
            recovery_func=fake_recovery,
        )
        self.assertTrue(result["dry_run"])
        self.assertTrue(calls[0]["dry_run"])
        self.assertNotIn("queued_stale_seconds", calls[0])

    def test_cycle_apply_sets_dry_run_false(self):
        def fake_recovery(**kwargs):
            return kwargs

        result = watchdog.run_recovery_cycle(
            apply_changes=True,
            active_stale_seconds=90,
            recovery_func=fake_recovery,
        )
        self.assertFalse(result["dry_run"])

    def test_invalid_interval_rejected(self):
        args = SimpleNamespace(
            interval=0,
            active_seconds=90,
        )
        with self.assertRaises(ValueError):
            watchdog.validate_args(args)


if __name__ == "__main__":
    unittest.main()
