import json
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch

from Server.webapp.services import ai_runtime


class AIAtomicCacheTest(unittest.TestCase):
    def test_concurrent_writers_leave_one_complete_payload(self):
        with tempfile.TemporaryDirectory() as directory:
            cache_path = Path(directory) / "analysis.json"
            payloads = [
                {
                    "writer": index,
                    "content": "x" * 8192,
                }
                for index in range(16)
            ]

            with ThreadPoolExecutor(max_workers=8) as executor:
                list(
                    executor.map(
                        lambda payload:
                            ai_runtime.write_ai_cache(
                                str(cache_path),
                                payload,
                            ),
                        payloads,
                    )
                )

            with cache_path.open(
                "r",
                encoding="utf-8",
            ) as handle:
                stored = json.load(handle)

            self.assertIn(stored, payloads)
            self.assertEqual(
                list(
                    Path(directory).glob(
                        ".ai-cache-*.tmp"
                    )
                ),
                [],
            )

    def test_failed_atomic_replace_removes_temporary_file(self):
        with tempfile.TemporaryDirectory() as directory:
            cache_path = Path(directory) / "analysis.json"

            with patch.object(
                ai_runtime.os,
                "replace",
                side_effect=OSError("replace failed"),
            ):
                ai_runtime.write_ai_cache(
                    str(cache_path),
                    {"content": "candidate"},
                )

            self.assertFalse(cache_path.exists())
            self.assertEqual(
                list(
                    Path(directory).glob(
                        ".ai-cache-*.tmp"
                    )
                ),
                [],
            )


if __name__ == "__main__":
    unittest.main()
