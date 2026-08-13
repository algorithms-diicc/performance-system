#!/usr/bin/env python3
import io
import os
import sys
import tempfile
import zipfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from psycopg2.extras import RealDictCursor
from werkzeug.datastructures import FileStorage

from Server.db_connection import get_connection
from Server.webapp.repositories.submission_repository import (
    update_submission_status,
)
from Server.webapp.services.execution_creation_service import (
    create_submission_bundle,
)
from Server.webapp.services.upload_service import (
    remove_stored_upload,
    store_and_inspect_zip,
)


def report(label, ok, detail=""):
    print("{:<74} {}".format(label, "PASS" if ok else "FAIL"))
    if detail and not ok:
        print("  {}".format(detail))
    return bool(ok)


def make_upload():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("main.cpp", "int main(){return 0;}")
        archive.writestr("nested/other.cpp", "int f(){return 1;}")
    buffer.seek(0)
    return FileStorage(
        stream=buffer,
        filename="core04b2.zip",
        content_type="application/zip",
    )


def count(cur, table):
    cur.execute("SELECT COUNT(*) AS c FROM {};".format(table))
    return cur.fetchone()["c"]


def main():
    print("Iniciando validador CORE-04B-2...")
    checks = []
    conn = get_connection()
    conn.autocommit = False
    upload = None
    temp_dir = tempfile.TemporaryDirectory()
    before_submissions = None
    before_executions = None

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            before_submissions = count(cur, "submissions")
            before_executions = count(cur, "executions")
            cur.execute("SELECT id FROM users ORDER BY id LIMIT 1;")
            user = cur.fetchone()

        if user is None:
            print("No existe ningún usuario para construir el fixture.")
            return 2

        upload = store_and_inspect_zip(make_upload(), temp_dir.name)

        checks.append(report("Stored ZIP exists", os.path.exists(upload.stored_path)))
        checks.append(report(
            "SHA-256 has 64 hexadecimal characters",
            len(upload.sha256) == 64
            and all(c in "0123456789abcdef" for c in upload.sha256),
        ))
        checks.append(report("Two C++ sources are discovered", len(upload.sources) == 2))

        bundle = create_submission_bundle(
            user_id=user["id"],
            title="__CORE04B2_TEMP__",
            archive_path=upload.stored_path,
            archive_sha256=upload.sha256,
            benchmark="LCS",
            input_size=500,
            samples=30,
            source_specs=[
                {"original_filename": source.original_filename}
                for source in upload.sources
            ],
            conn=conn,
        )

        checks.append(report(
            "Submission is created in QUEUED",
            bundle["submission"]["status"] == "QUEUED",
        ))
        checks.append(report(
            "One execution exists per discovered .cpp",
            len(bundle["executions"]) == len(upload.sources),
        ))
        checks.append(report(
            "Execution configs contain persisted archive SHA-256",
            all(
                row["execution_config"]["archive_sha256"] == upload.sha256
                for row in bundle["executions"]
            ),
        ))
        checks.append(report(
            "Execution configs preserve original filenames",
            {
                row["execution_config"]["original_filename"]
                for row in bundle["executions"]
            } == {
                source.original_filename
                for source in upload.sources
            },
        ))

        updated = update_submission_status(
            bundle["submission"]["id"],
            "ERROR",
            conn=conn,
        )
        checks.append(report(
            "Submission status can record enqueue failure",
            updated["status"] == "ERROR",
        ))

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            during_submissions = count(cur, "submissions")
            during_executions = count(cur, "executions")

        checks.append(report(
            "Transaction contains exactly +1 submission",
            during_submissions == before_submissions + 1,
        ))
        checks.append(report(
            "Transaction contains exactly +2 executions",
            during_executions == before_executions + 2,
        ))

    finally:
        conn.rollback()

        if before_submissions is not None and before_executions is not None:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                after_submissions = count(cur, "submissions")
                after_executions = count(cur, "executions")

            checks.append(report(
                "Rollback leaves no submission fixture",
                after_submissions == before_submissions,
            ))
            checks.append(report(
                "Rollback leaves no execution fixtures",
                after_executions == before_executions,
            ))

        if upload is not None:
            remove_stored_upload(upload.stored_path)

        checks.append(report(
            "Temporary ZIP is cleaned",
            upload is None or not os.path.exists(upload.stored_path),
        ))

        temp_dir.cleanup()
        conn.close()

    passed = sum(1 for value in checks if value)
    total = len(checks)

    print("")
    print("RESULTADO CORE-04B-2")
    print("=====================")
    print("{}/{} checks passed".format(passed, total))
    print("RESULT: {}".format("PASS" if passed == total else "FAIL"))

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())