import json
import socket
import tempfile
import unittest
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from Server.tests.plotly_test_support import ensure_plotly_importable

ensure_plotly_importable()

from Server.measurement_node_transport import (
    MeasurementNodeTransportError,
    attach_result_identity,
    build_slave_hello,
    is_not_selected_payload,
    receive_slave_hello,
    validate_payload_assignment,
    validate_result_identity,
)
from Server.webapp.services.execution_queue_service import (
    claim_next_queued_execution,
)
from Server.webapp.services.execution_runner_service import (
    run_single_execution,
)
from Server import execution_dispatcher
from Server.webapp import socketUtils


class BufferSocket:
    def __init__(self, incoming=b"", recv_error=None):
        self.incoming = incoming
        self.recv_error = recv_error
        self.sent = []
        self.closed = False
        self.timeout = None

    def settimeout(self, value):
        self.timeout = value

    def recv(self, size):
        if self.recv_error is not None:
            raise self.recv_error
        if not self.incoming:
            return b""
        chunk = self.incoming[:size]
        self.incoming = self.incoming[size:]
        return chunk

    def sendall(self, payload):
        self.sent.append(payload)

    def close(self):
        self.closed = True

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        self.close()
        return False


class FakeListener:
    def __init__(self, connections):
        self.connections = list(connections)
        self.timeout = None

    def settimeout(self, value):
        self.timeout = value

    def accept(self):
        if not self.connections:
            raise socket.timeout()
        return self.connections.pop(0)


class TargetingTransportTests(unittest.TestCase):
    def test_correct_node_hello_is_accepted(self):
        sock = BufferSocket(build_slave_hello("shenu"))
        self.assertEqual(receive_slave_hello(sock), "shenu")

    def test_unknown_or_malformed_node_is_rejected(self):
        with self.assertRaises(MeasurementNodeTransportError):
            receive_slave_hello(
                BufferSocket(
                    b'{"transport_version":1,"message_type":'
                    b'"measurement_node_hello","node_key":"BAD KEY"}\n'
                )
            )

    def test_disconnect_before_payload_identity_is_rejected(self):
        with self.assertRaises(MeasurementNodeTransportError):
            receive_slave_hello(BufferSocket(b""))

    def test_identity_timeout_is_surfaceable(self):
        with self.assertRaises(socket.timeout):
            receive_slave_hello(
                BufferSocket(recv_error=socket.timeout())
            )

    def test_payload_assignment_rejects_wrong_node(self):
        payload = {
            "measurement_node": {
                "measurement_node_id": 1,
                "hardware_profile_id": 3,
                "node_key": "shenu",
            }
        }
        self.assertEqual(
            validate_payload_assignment(payload, "shenu")["node_key"],
            "shenu",
        )
        with self.assertRaises(MeasurementNodeTransportError):
            validate_payload_assignment(payload, "ryzen-validation")

    def test_targeted_slave_rejects_missing_assignment_but_legacy_accepts_it(self):
        with self.assertRaises(MeasurementNodeTransportError):
            validate_payload_assignment({}, "shenu")
        self.assertIsNone(validate_payload_assignment({}, None))

    def test_result_sender_must_match_expected_node(self):
        payload = attach_result_identity({"results": "csv"}, "shenu")
        self.assertTrue(validate_result_identity(payload, "shenu"))
        self.assertFalse(
            validate_result_identity(payload, "ryzen-validation")
        )
        self.assertFalse(
            validate_result_identity({"results": "csv"}, "shenu")
        )

    def test_only_selected_slave_receives_payload(self):
        wrong = BufferSocket(build_slave_hello("unknown-node"))
        right = BufferSocket(build_slave_hello("shenu"))
        listener = FakeListener([
            (wrong, ("127.0.0.2", 10001)),
            (right, ("127.0.0.3", 10002)),
        ])

        socketUtils.send_manager(
            listener,
            '{"name":"execA"}',
            "execA",
            target_node_key="shenu",
            max_wait_seconds=1,
        )

        self.assertTrue(wrong.closed)
        self.assertEqual(len(wrong.sent), 1)
        self.assertTrue(
            is_not_selected_payload(json.loads(wrong.sent[0].decode()))
        )
        self.assertEqual(right.sent, [b'{"name":"execA"}'])
        self.assertEqual(socketUtils.activeS, 1)

    def test_target_timeout_has_zero_deliveries(self):
        listener = FakeListener([])
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(socketUtils, "STATUS_DIR", tmp):
                socketUtils.send_manager(
                    listener,
                    '{"name":"execA"}',
                    "execA",
                    target_node_key="shenu",
                    max_wait_seconds=0,
                )
        self.assertEqual(socketUtils.activeS, 0)

    def test_slave_serve_does_not_wait_for_result_when_send_has_no_delivery(self):
        class FakeServerSocket:
            def __init__(self):
                self.closed = False

            def setsockopt(self, *args):
                pass

            def bind(self, *args):
                pass

            def listen(self, *args):
                pass

            def close(self):
                self.closed = True

        send_socket = FakeServerSocket()
        result_socket = FakeServerSocket()
        receive_calls = []

        def fake_send_manager(*args, **kwargs):
            socketUtils.activeS = 0

        def fake_recv_manager(*args, **kwargs):
            receive_calls.append((args, kwargs))

        payload = {
            "payload_version": 2,
            "name": "execASIZE",
            "cmd": "-O3",
            "source_language": "C",
            "source_extension": ".c",
            "compiler": "gcc",
            "compiler_flags": "-O3",
        }

        with tempfile.TemporaryDirectory() as tmp:
            source = Path(tmp) / "A.c"
            source.write_text(
                "int main(void){return 0;}\n",
                encoding="utf-8",
            )

            with ExitStack() as stack:
                stack.enter_context(
                    patch.object(
                        socketUtils.socket,
                        "socket",
                        side_effect=[send_socket, result_socket],
                    )
                )
                stack.enter_context(
                    patch.object(
                        socketUtils,
                        "_load_measurement_snapshot",
                        return_value={},
                    )
                )
                stack.enter_context(
                    patch.object(
                        socketUtils,
                        "build_execution_payload",
                        return_value=payload,
                    )
                )
                stack.enter_context(
                    patch.object(
                        socketUtils,
                        "escribir_estado",
                    )
                )
                stack.enter_context(
                    patch.object(
                        socketUtils,
                        "send_manager",
                        side_effect=fake_send_manager,
                    )
                )
                stack.enter_context(
                    patch.object(
                        socketUtils,
                        "recv_manager",
                        side_effect=fake_recv_manager,
                    )
                )

                socketUtils.slave_serve(
                    str(source),
                    "execASIZE",
                    "-O3",
                    1000,
                    10,
                    measurement_node_id=1,
                    hardware_profile_id=3,
                    measurement_node_key="shenu",
                )

        self.assertEqual(receive_calls, [])
        self.assertTrue(send_socket.closed)
        self.assertTrue(result_socket.closed)

    def test_wrong_result_is_rejected_before_result_side_effects(self):
        payload = attach_result_identity(
            {
                "name": "execAResults",
                "results": "InputSize,source\n1,A.cpp\n",
            },
            "ryzen-validation",
        )
        accepted = socketUtils.receive_data(
            BufferSocket(json.dumps(payload).encode("utf-8")),
            0,
            expected_node_key="shenu",
        )
        self.assertFalse(accepted)


class TargetingPropagationTests(unittest.TestCase):
    def test_claim_preserves_node_key(self):
        class Conn:
            def commit(self): pass
            def rollback(self): pass
            def close(self): pass

        class QueueRepo:
            def list_queued_executions(self, **kwargs):
                return [{
                    "public_id": "uuid-1",
                    "submission_id": 77,
                    "benchmark": "LCS",
                    "input_size": 500,
                    "execution_profile": "BALANCED",
                }]

        class AssignmentRepo:
            def get_submission_for_update(self, submission_id, conn):
                return {
                    "id": submission_id,
                    "assigned_measurement_node_id": None,
                    "measurement_node_mode": "AUTO",
                }
            def set_submission_assignment(self, *args, **kwargs): pass
            def set_execution_provenance(self, *args, **kwargs): pass

        class StateService:
            def mark_running(self, public_id, conn, repository):
                return {
                    "public_id": public_id,
                    "execution_state": "RUNNING",
                }

        claimed = claim_next_queued_execution(
            conn=Conn(),
            repository=QueueRepo(),
            state_service=StateService(),
            assignment_repository=AssignmentRepo(),
            selector_func=lambda *args, **kwargs: {
                "measurement_node_id": 1,
                "hardware_profile_id": 3,
                "node_key": "shenu",
                "measurement_node_mode": "AUTO",
                "affinity_changed": False,
            },
        )
        self.assertEqual(claimed["measurement_node_key"], "shenu")

    def test_dispatcher_forwards_target_to_runner(self):
        execution = {
            "public_id": "uuid-1",
            "submission_id": 77,
            "codename": "execA",
            "input_size": 500,
            "samples": 10,
            "measurement_node_id": 1,
            "hardware_profile_id": 3,
            "measurement_node_key": "shenu",
        }
        runner_calls = []

        result = execution_dispatcher.run_dispatch_cycle(
            claim_func=lambda: dict(execution),
            submission_repo=SimpleNamespace(
                get_submission=lambda _sid: {"id": 77}
            ),
            materialize_func=lambda *args: {
                "source_path": "/tmp/a.cpp",
                "original_filename": "a.cpp",
                "source_contract_version": None,
                "source_language": "C++",
                "compiler": "g++",
                "compiler_flags": "-O3",
                "technical_extension": ".cpp",
                "metadata_provenance": "inferred_legacy_cpp",
            },
            runner_func=lambda **kwargs: (
                runner_calls.append(kwargs)
                or {"execution_state": "COMPLETED"}
            ),
            sync_func=lambda _sid: {"updated": True},
        )

        self.assertEqual(result["state"], "COMPLETED")
        self.assertEqual(runner_calls[0]["measurement_node_id"], 1)
        self.assertEqual(runner_calls[0]["hardware_profile_id"], 3)
        self.assertEqual(runner_calls[0]["measurement_node_key"], "shenu")

    def test_runner_forwards_target_and_keeps_legacy_path_optional(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp)
            source = base / "a.cpp"
            source.write_text("int main(){}", encoding="utf-8")
            slave_calls = []

            result = run_single_execution(
                source_path=str(source),
                codename="execA",
                original_filename="a.cpp",
                input_size=500,
                samples=10,
                status_dir=str(base / "status"),
                static_dir=str(base / "static"),
                base_dir=str(base),
                measurement_node_id=1,
                hardware_profile_id=3,
                measurement_node_key="shenu",
                slave_serve_func=lambda *args, **kwargs: slave_calls.append(
                    (args, kwargs)
                ),
                status_writer_func=lambda *args, **kwargs: None,
                read_legacy_outcome_func=lambda *args: SimpleNamespace(
                    kind="FAILED",
                    status_text="ERROR: controlled",
                ),
                mark_worker_started_func=lambda _c: {
                    "execution_state": "RUNNING"
                },
                persist_worker_outcome_func=lambda _c, _o: {
                    "execution_state": "FAILED"
                },
            )

            self.assertEqual(result["execution_state"], "FAILED")
            self.assertEqual(
                slave_calls[0][1]["measurement_node_key"],
                "shenu",
            )
            marker = (base / "status" / "execA").read_text()
            self.assertEqual(marker, "IN QUEUE:shenu")


if __name__ == "__main__":
    unittest.main()
