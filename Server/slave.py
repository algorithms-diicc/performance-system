import socket
import json

try:
    from .hardware_snapshot import collect_hardware_snapshot
except ImportError:
    from hardware_snapshot import collect_hardware_snapshot
try:
    from .measurement_node_transport import (
        AUTH_CONTEXT_PAYLOAD,
        AUTH_CONTEXT_RESULT,
        MeasurementNodeTransportError,
        attach_result_identity,
        is_not_selected_payload,
        receive_transport_frame,
        respond_to_auth_challenge,
        send_slave_hello,
        validate_payload_assignment,
    )
except ImportError:
    from measurement_node_transport import (
        AUTH_CONTEXT_PAYLOAD,
        AUTH_CONTEXT_RESULT,
        MeasurementNodeTransportError,
        attach_result_identity,
        is_not_selected_payload,
        receive_transport_frame,
        respond_to_auth_challenge,
        send_slave_hello,
        validate_payload_assignment,
    )
try:
    from .source_contract import (
        CANONICAL_COMPILER_FLAGS,
        COMPILER_C,
        COMPILER_CPP,
        SourceContractError,
        infer_legacy_cpp_metadata,
        validate_runtime_source_metadata,
    )
except ImportError:
    from source_contract import (
        CANONICAL_COMPILER_FLAGS,
        COMPILER_C,
        COMPILER_CPP,
        SourceContractError,
        infer_legacy_cpp_metadata,
        validate_runtime_source_metadata,
    )
import subprocess as sub
import time
import os
import signal
import sys
import shlex
import re
import threading
import urllib.parse
import urllib.request

try:
    from .utils.logger import log_admin, log_admin_stage
except ImportError:
    from utils.logger import log_admin, log_admin_stage


# ============================================================
# CONFIGURACIÓN GENERAL
# ============================================================

SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
WEBAPP_DIR = os.path.join(SERVER_DIR, "webapp")

STATIC_DIR = os.path.join(WEBAPP_DIR, "static")
TEST_DIR = os.path.join(SERVER_DIR, "test")
STATUS_DIR = os.path.join(SERVER_DIR, "status")

os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(TEST_DIR, exist_ok=True)
os.makedirs(STATUS_DIR, exist_ok=True)

DEFAULT_TIMEOUT = int(os.getenv("SLAVE_TIMEOUT", "1000"))
COMPILE_TIMEOUT_SECONDS = max(
    1,
    int(os.getenv("COMPILE_TIMEOUT_SECONDS", "30")),
)
REMOTE_SSH_TIMEOUT_SECONDS = max(
    1,
    int(os.getenv("REMOTE_SSH_TIMEOUT_SECONDS", "15")),
)
CODENAME_RE = re.compile(r"^[A-Za-z0-9_-]+$")


# ============================================================
# CONFIGURACIÓN LOCAL / REMOTA
# ============================================================

SLAVE_MODE = os.getenv("SLAVE_MODE", "local").strip().lower()

if SLAVE_MODE not in {"local", "remote"}:
    raise ValueError(
        "SLAVE_MODE debe tener el valor 'local' o 'remote'."
    )

# En local, por defecto el master está en esta misma máquina.
# En remoto, la dirección debe entregarse mediante configuración.
DEFAULT_MASTER_HOST = (
    "127.0.0.1"
    if SLAVE_MODE == "local"
    else None
)

# MASTER_HOST puede sobrescribirse también en modo local.
MASTER_HOST = os.getenv(
    "MASTER_HOST",
    DEFAULT_MASTER_HOST
)

if SLAVE_MODE == "remote" and not MASTER_HOST:
    raise ValueError(
        "MASTER_HOST es obligatorio cuando SLAVE_MODE=remote."
    )

MASTER_SEND_PORT = int(
    os.getenv("MASTER_SEND_PORT", "50000")
)

MASTER_RESULT_PORT = int(
    os.getenv("MASTER_RESULT_PORT", "60000")
)


# Configuración SSH usada solo en modo remoto.
# Usuario, host y ruta pertenecen al entorno de despliegue,
# no al código fuente.
REMOTE_SSH_TARGET = os.getenv("REMOTE_SSH_TARGET")
REMOTE_STATUS_DIR = os.getenv("REMOTE_STATUS_DIR")

if SLAVE_MODE == "remote":
    if not REMOTE_SSH_TARGET:
        raise ValueError(
            "REMOTE_SSH_TARGET es obligatorio cuando SLAVE_MODE=remote."
        )
    if not REMOTE_STATUS_DIR:
        raise ValueError(
            "REMOTE_STATUS_DIR es obligatorio cuando SLAVE_MODE=remote."
        )


QUEUE_POLL_SECONDS = int(
    os.getenv("QUEUE_POLL_SECONDS", "10")
)

QUEUE_RECENT_SECONDS = int(
    os.getenv("QUEUE_RECENT_SECONDS", "300")
)


# ============================================================
# MEASUREMENT NODE HEARTBEAT
# ============================================================

DEFAULT_MEASUREMENT_NODE_HEARTBEAT_SECONDS = 10
DEFAULT_MEASUREMENT_NODE_HEARTBEAT_TIMEOUT_SECONDS = 5

MEASUREMENT_NODE_KEY_RE = re.compile(
    r"^[a-z0-9][a-z0-9_-]{0,63}$"
)

_measurement_node_heartbeat_lock = threading.Lock()
_measurement_node_heartbeat_lease = None


def _positive_integer(value, default):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return default

    return parsed if parsed > 0 else default


def measurement_node_heartbeat_configuration(
    environment=None,
):
    """
    Lee la identidad/credencial del nodo.

    Sin ninguna variable configurada, el heartbeat queda deshabilitado
    para conservar compatibilidad con entornos legacy/locales.

    Una configuración parcial falla cerrada.
    """
    source = (
        os.environ
        if environment is None
        else environment
    )

    node_key = str(
        source.get("MEASUREMENT_NODE_KEY") or ""
    ).strip().lower()

    heartbeat_url = str(
        source.get(
            "MEASUREMENT_NODE_HEARTBEAT_URL"
        ) or ""
    ).strip()

    heartbeat_token = str(
        source.get(
            "MEASUREMENT_NODE_HEARTBEAT_TOKEN"
        ) or ""
    ).strip()

    configured_values = (
        node_key,
        heartbeat_url,
        heartbeat_token,
    )

    if not any(configured_values):
        return None

    if not all(configured_values):
        raise ValueError(
            "MEASUREMENT_NODE_KEY, "
            "MEASUREMENT_NODE_HEARTBEAT_URL y "
            "MEASUREMENT_NODE_HEARTBEAT_TOKEN deben "
            "configurarse en conjunto."
        )

    if not MEASUREMENT_NODE_KEY_RE.fullmatch(
        node_key
    ):
        raise ValueError(
            "MEASUREMENT_NODE_KEY tiene un formato inválido."
        )

    parsed_url = urllib.parse.urlparse(
        heartbeat_url
    )

    if (
        parsed_url.scheme not in {"http", "https"}
        or not parsed_url.netloc
    ):
        raise ValueError(
            "MEASUREMENT_NODE_HEARTBEAT_URL "
            "debe ser una URL HTTP(S) absoluta."
        )

    if not re.fullmatch(
        r"[0-9a-f]{64}",
        heartbeat_token,
    ):
        raise ValueError(
            "MEASUREMENT_NODE_HEARTBEAT_TOKEN "
            "debe ser el token HMAC SHA-256 derivado."
        )

    return {
        "node_key": node_key,
        "url": heartbeat_url,
        "token": heartbeat_token,
        "interval_seconds": _positive_integer(
            source.get(
                "MEASUREMENT_NODE_HEARTBEAT_SECONDS"
            ),
            DEFAULT_MEASUREMENT_NODE_HEARTBEAT_SECONDS,
        ),
        "timeout_seconds": _positive_integer(
            source.get(
                "MEASUREMENT_NODE_HEARTBEAT_TIMEOUT_SECONDS"
            ),
            DEFAULT_MEASUREMENT_NODE_HEARTBEAT_TIMEOUT_SECONDS,
        ),
    }


def send_measurement_node_heartbeat(
    configuration=None,
    opener=None,
):
    """
    Envía un heartbeat autenticado a Performance.

    No conoce el secreto maestro: sólo usa el bearer derivado
    específicamente para este node_key.
    """
    config = (
        measurement_node_heartbeat_configuration()
        if configuration is None
        else configuration
    )

    if config is None:
        return False

    body = json.dumps(
        {
            "nodeKey": config["node_key"],
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        config["url"],
        data=body,
        headers={
            "Authorization":
                "Bearer {}".format(config["token"]),
            "Content-Type": "application/json",
        },
        method="POST",
    )

    open_request = (
        urllib.request.urlopen
        if opener is None
        else opener
    )

    with open_request(
        request,
        timeout=config["timeout_seconds"],
    ) as response:
        status = getattr(
            response,
            "status",
            response.getcode(),
        )

        payload = response.read()

    if status < 200 or status >= 300:
        raise RuntimeError(
            "Measurement node heartbeat HTTP {}.".format(
                status
            )
        )

    try:
        decoded = json.loads(
            payload.decode("utf-8")
        )
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise RuntimeError(
            "Measurement node heartbeat devolvió "
            "una respuesta inválida."
        )

    if (
        not isinstance(decoded, dict)
        or decoded.get("nodeKey")
        != config["node_key"]
    ):
        raise RuntimeError(
            "Measurement node heartbeat respondió "
            "para una identidad distinta."
        )

    return True


def _measurement_node_heartbeat_loop(
    stop_event,
    configuration,
    sender=send_measurement_node_heartbeat,
):
    """
    Renueva el liveness inmediatamente y después en cada intervalo.

    Un fallo transitorio de red no termina el slave; simplemente deja
    de renovar el heartbeat y Performance derivará OFFLINE si expira.
    """
    interval = configuration[
        "interval_seconds"
    ]

    while not stop_event.is_set():
        try:
            sender(
                configuration=configuration
            )
        except Exception as exc:
            print(
                "[⚠️ MeasurementNode heartbeat] {}".format(
                    exc
                )
            )

        if stop_event.wait(interval):
            break


def start_measurement_node_heartbeat(
    configuration=None,
    sender=send_measurement_node_heartbeat,
):
    """
    Inicia como máximo un heartbeat de nodo por proceso slave.
    """
    global _measurement_node_heartbeat_lease

    config = (
        measurement_node_heartbeat_configuration()
        if configuration is None
        else configuration
    )

    if config is None:
        return False

    with _measurement_node_heartbeat_lock:
        if (
            _measurement_node_heartbeat_lease
            and _measurement_node_heartbeat_lease[
                "thread"
            ].is_alive()
        ):
            return False

        stop_event = threading.Event()

        thread = threading.Thread(
            target=_measurement_node_heartbeat_loop,
            args=(
                stop_event,
                config,
                sender,
            ),
            name="measurement-node-heartbeat",
            daemon=True,
        )

        _measurement_node_heartbeat_lease = {
            "stop_event": stop_event,
            "thread": thread,
            "node_key": config["node_key"],
        }

        thread.start()

    return True


def stop_measurement_node_heartbeat():
    global _measurement_node_heartbeat_lease

    with _measurement_node_heartbeat_lock:
        lease = _measurement_node_heartbeat_lease
        _measurement_node_heartbeat_lease = None

    if not lease:
        return False

    lease["stop_event"].set()
    return True


# ============================================================
# UTILIDADES
# ============================================================

def command_text(args):
    """
    Convierte una lista de argumentos a una representación
    legible para logs.
    """
    return shlex.join(
        [str(arg) for arg in args]
    )


def executable_path(codename):
    """
    Genera un ejecutable único por tarea.

    Evita usar siempre ./a.out, ya que eso podría producir
    colisiones entre ejecuciones.
    """
    return os.path.join(
        SERVER_DIR,
        f"{codename}.out"
    )


def cleanup_files(*paths):
    """
    Elimina archivos temporales si existen.
    """
    for path in paths:

        if not path:
            continue

        if not os.path.exists(path):
            continue

        try:
            os.remove(path)
            print(
                f"[🧹 Eliminado] {path}"
            )

        except OSError as e:

            log_admin_stage(
                "CLEANUP_ERROR",
                f"No se pudo eliminar {path} — {e}"
            )

            print(
                f"[⚠️ No se pudo eliminar "
                f"{path}: {e}]"
            )


# ============================================================
# COMUNICACIÓN MASTER -> SLAVE
# ============================================================

def connect_to_server(host, port):
    """
    Se conecta al master.

    Si el master aún no está disponible, crea un nuevo socket
    y vuelve a intentarlo después de algunos segundos.
    """

    while True:

        sock = socket.socket(
            socket.AF_INET,
            socket.SOCK_STREAM
        )

        try:

            sock.settimeout(10)

            print(
                f"[🌐 Intentando conectar "
                f"a {host}:{port}]"
            )

            sock.connect(
                (host, port)
            )

            sock.settimeout(None)

            print(
                f"[✅ Conectado al master "
                f"{host}:{port}]"
            )

            return sock

        except OSError as e:

            try:
                sock.close()
            except Exception:
                pass

            print(
                f"[🕐 Master no disponible: {e}. "
                f"Reintentando en 5 segundos...]"
            )

            time.sleep(5)


def receive_payload(sock):
    """
    Recibe completamente el payload JSON enviado por el master.
    """

    payload = b""

    while True:

        try:
            data = sock.recv(4096)

        except ConnectionResetError:
            break

        if not data:
            break

        payload += data

    if not payload:
        raise ValueError(
            "Se recibió un payload vacío desde el master."
        )

    return json.loads(
        payload.decode("utf-8")
    )


class PayloadValidationError(ValueError):
    """El payload no representa una combinación runtime permitida."""


def validate_source_payload(payload):
    """Resuelve v1 legacy o valida estrictamente la tupla v2."""
    if not isinstance(payload, dict):
        raise PayloadValidationError("El payload debe ser un objeto JSON.")

    payload_version = payload.get("payload_version", 1)
    if type(payload_version) is not int or payload_version not in (1, 2):
        raise PayloadValidationError(
            "payload_version debe ser 1 o 2."
        )

    if payload_version == 1:
        v2_fields = (
            "source_language",
            "source_extension",
            "compiler",
            "compiler_flags",
        )
        if any(field in payload for field in v2_fields):
            raise PayloadValidationError(
                "Un payload v1 no puede declarar metadata v2."
            )
        return infer_legacy_cpp_metadata(
            {
                "original_filename": "legacy.cpp",
                "compiler_flags": CANONICAL_COMPILER_FLAGS,
            }
        )

    try:
        return validate_runtime_source_metadata(
            source_contract_version=2,
            source_language=payload.get("source_language"),
            compiler=payload.get("compiler"),
            compiler_flags=payload.get("compiler_flags"),
            technical_extension=payload.get("source_extension"),
        )
    except SourceContractError as exc:
        raise PayloadValidationError(
            "La metadata C/C++ del payload v2 no es válida."
        ) from exc


# ============================================================
# ARCHIVO C/C++
# ============================================================

def write_code_to_file(name_request, code, source_extension=".cpp"):
    """
    Guarda el código recibido en:

        Server/test/<nombre>.c|.cpp
    """

    safe_name = str(name_request or "").strip()
    if not CODENAME_RE.fullmatch(safe_name):
        raise ValueError("El codename del payload no es válido.")
    if source_extension not in (".c", ".cpp"):
        raise ValueError("La extensión técnica no es canónica.")
    if not isinstance(code, str):
        raise ValueError("El código del payload debe ser texto UTF-8.")

    full_path = os.path.join(
        TEST_DIR,
        f"{safe_name}{source_extension}"
    )
    full_path = os.path.realpath(full_path)
    if os.path.dirname(full_path) != os.path.realpath(TEST_DIR):
        raise ValueError("La ruta técnica escapa de Server/test.")

    try:

        with open(
            full_path,
            "w",
            encoding="utf-8"
        ) as file:

            file.write(code)

        print(
            f"[✔️ Código guardado en: "
            f"{full_path}]"
        )

        return full_path

    except (OSError, UnicodeError) as e:

        log_admin_stage(
            "FILE_WRITE_ERROR",
            (
                f"No se pudo escribir "
                f"{full_path} — {e}"
            )
        )

        print(
            f"[❌ Error guardando "
            f"{full_path}: {e}]"
        )

        return None


# ============================================================
# COMPILACIÓN + MEDICIÓN
# ============================================================

def _measurement_positive_int(value, field):
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        raise ValueError(
            f"measurement.{field} debe ser un entero."
        )

    if parsed <= 0:
        raise ValueError(
            f"measurement.{field} debe ser mayor que 0."
        )

    return parsed


def build_measurement_environment(measurement):
    # Si measurement no existe, conserva compatibilidad legacy.
    env = os.environ.copy()

    if not isinstance(measurement, dict) or not measurement:
        return env

    points = _measurement_positive_int(
        measurement.get("points"),
        "points",
    )
    warmups = _measurement_positive_int(
        measurement.get("warmup_rounds"),
        "warmup_rounds",
    )

    perf_scope = str(
        measurement.get("perf_scope") or ""
    ).strip().lower()

    if perf_scope not in {"process", "system-wide"}:
        raise ValueError(
            "measurement.perf_scope debe ser 'process' o 'system-wide'."
        )

    single_fallback = measurement.get(
        "single_event_fallback",
        True,
    )
    if not isinstance(single_fallback, bool):
        raise ValueError(
            "measurement.single_event_fallback debe ser booleano."
        )

    env["INCREMENTS"] = str(points)
    env["WARMUP_ROUNDS"] = str(warmups)
    env["PERF_SYSTEM_WIDE"] = (
        "1" if perf_scope == "system-wide" else "0"
    )
    env["PERF_SINGLE_FALLBACK"] = (
        "1" if single_fallback else "0"
    )

    return env



def resolve_measurement_timeout(measurement):
    """
    Resuelve el timeout operacional efectivo.

    Ejecuciones legacy sin operational_timeout_seconds conservan
    SLAVE_TIMEOUT/DEFAULT_TIMEOUT.
    """
    if not isinstance(measurement, dict) or not measurement:
        return DEFAULT_TIMEOUT

    value = measurement.get("operational_timeout_seconds")

    if value in (None, ""):
        return DEFAULT_TIMEOUT

    return _measurement_positive_int(
        value,
        "operational_timeout_seconds",
    )


def build_compile_argv(source_file, executable, compiler):
    """Construye el único argv de compilación permitido por E-C01."""
    expected_extension = {
        COMPILER_C: ".c",
        COMPILER_CPP: ".cpp",
    }.get(compiler)
    if expected_extension is None:
        raise ValueError("El compilador no pertenece al contrato C/C++.")
    if os.path.splitext(str(source_file))[1] != expected_extension:
        raise ValueError(
            "La extensión técnica no coincide con el compilador."
        )
    return [
        compiler,
        CANONICAL_COMPILER_FLAGS,
        source_file,
        "-o",
        executable,
    ]


def run_benchmark(
    test_type,
    source_file,
    input_size,
    samples,
    measure_script_name,
    measure_args,
    measurement=None,
    compiler=COMPILER_CPP,
):
    """
    Función común para LCS, CAMM y SIZE.

    1. Compila la fuente C/C++ con su toolchain canónico.
    2. Ejecuta el measurescript correspondiente.
    3. Comprueba que se genere un CSV.
    4. Devuelve la ruta del CSV o un código de error.
    """

    codename = os.path.splitext(
        os.path.basename(source_file)
    )[0]

    executable = executable_path(
        codename
    )

    output_dir = os.path.join(
        STATIC_DIR,
        codename
    )

    os.makedirs(
        output_dir,
        exist_ok=True
    )

    csv_output = os.path.join(
        output_dir,
        f"{codename}Results0.csv"
    )

    measure_script = os.path.join(
        SERVER_DIR,
        measure_script_name
    )

    measurement_env = build_measurement_environment(
        measurement
    )

    execution_timeout = resolve_measurement_timeout(
        measurement
    )

    if isinstance(measurement, dict) and measurement:
        print(
            "[🔬 Measurement snapshot] "
            + json.dumps(
                measurement,
                sort_keys=True,
            )
        )


    # --------------------------------------------------------
    # Comando de compilación
    # --------------------------------------------------------

    compile_cmd = build_compile_argv(
        source_file,
        executable,
        compiler,
    )


    # --------------------------------------------------------
    # Comando de medición
    # --------------------------------------------------------

    exec_cmd = [
        "bash",
        measure_script,
        executable,
        *[
            str(argument)
            for argument in measure_args
        ],
        csv_output
    ]


    compile_cmd_text = command_text(
        compile_cmd
    )

    exec_cmd_text = command_text(
        exec_cmd
    )


    t0 = time.time()


    # ========================================================
    # COMPILACIÓN
    # ========================================================

    log_admin_stage(
        "START_COMPILE",
        f"Compilando {source_file}"
    )

    print(
        f"[⚙️ {test_type}] "
        f"Compilando:"
    )

    print(
        compile_cmd_text
    )


    try:
        compile_result = sub.run(
            compile_cmd,
            stdout=sub.PIPE,
            stderr=sub.PIPE,
            text=True,
            cwd=SERVER_DIR,
            timeout=COMPILE_TIMEOUT_SECONDS,
            shell=False,
        )
    except sub.TimeoutExpired:
        duration = time.time() - t0
        error = (
            "La compilación excedió el tiempo límite de "
            f"{COMPILE_TIMEOUT_SECONDS} segundos."
        )
        print(f"[⏰ Timeout de compilación] {error}")
        log_admin_stage("COMPILE_TIMEOUT", error)
        log_admin(
            test_type,
            source_file,
            compile_cmd_text,
            "N/A",
            False,
            False,
            duration,
            error_msg=error,
            input_val=input_size,
        )
        cleanup_files(executable)
        return {
            "name": codename,
            "error_code": 100,
        }


    if compile_result.returncode != 0:

        duration = (
            time.time() - t0
        )

        error = (
            compile_result.stderr.strip()
        )

        print(
            "[❌ Error de compilación]"
        )

        print(error)


        log_admin_stage(
            "COMPILE_ERROR",
            error
        )


        log_admin(
            test_type,
            source_file,
            compile_cmd_text,
            "N/A",
            False,
            False,
            duration,
            error_msg=error,
            input_val=input_size
        )


        return {
            "name": codename,
            "error_code": 100
        }


    # ========================================================
    # EJECUCIÓN
    # ========================================================

    log_admin_stage(
        "START_EXEC",
        (
            f"Ejecutando {test_type}: "
            f"tamaño={input_size}, "
            f"repeticiones={samples}"
        )
    )


    print(
        f"[🚀 {test_type}] "
        f"Ejecutando:"
    )

    print(
        exec_cmd_text
    )


    try:

        exec_result = sub.run(
            exec_cmd,
            stdout=sub.PIPE,
            stderr=sub.PIPE,
            text=True,
            timeout=execution_timeout,
            cwd=SERVER_DIR,
            env=measurement_env,
        )


    except sub.TimeoutExpired:

        duration = (
            time.time() - t0
        )

        msg = (
            f"El test {test_type} "
            f"excedió el límite de "
            f"{execution_timeout} segundos."
        )


        print(
            f"[⏰ Timeout] {msg}"
        )


        log_admin_stage(
            "TIMEOUT",
            msg
        )


        log_admin(
            test_type,
            source_file,
            compile_cmd_text,
            exec_cmd_text,
            True,
            False,
            duration,
            error_msg=msg,
            input_val=input_size
        )


        return {
            "name": codename,
            "error_code": 200
        }


    except Exception as e:

        duration = (
            time.time() - t0
        )

        msg = (
            f"Fallo inesperado "
            f"en {test_type}: {e}"
        )


        print(
            f"[❌ Error inesperado] "
            f"{msg}"
        )


        log_admin_stage(
            "UNEXPECTED_ERROR",
            msg
        )


        log_admin(
            test_type,
            source_file,
            compile_cmd_text,
            exec_cmd_text,
            True,
            False,
            duration,
            error_msg=str(e),
            input_val=input_size
        )


        return {
            "name": codename,
            "error_code": 400
        }


    # ========================================================
    # ERROR DEVUELTO POR EL SCRIPT
    # ========================================================

    if exec_result.returncode != 0:

        duration = (
            time.time() - t0
        )


        error_detail = (
            f"returncode="
            f"{exec_result.returncode}; "
            f"stdout="
            f"{exec_result.stdout.strip()}; "
            f"stderr="
            f"{exec_result.stderr.strip()}"
        )


        print("")
        print(
            f"========== ERROR "
            f"{test_type} =========="
        )

        print(
            f"Return code: "
            f"{exec_result.returncode}"
        )

        print(
            f"Comando: "
            f"{exec_cmd_text}"
        )

        print(
            "STDOUT:"
        )

        print(
            exec_result.stdout
        )

        print(
            "STDERR:"
        )

        print(
            exec_result.stderr
        )

        print(
            "================================="
        )

        print("")


        log_admin_stage(
            "EXEC_ERROR",
            error_detail
        )


        log_admin(
            test_type,
            source_file,
            compile_cmd_text,
            exec_cmd_text,
            True,
            False,
            duration,
            error_msg=error_detail,
            input_val=input_size
        )


        return {
            "name": codename,
            "error_code": 400
        }


    # ========================================================
    # VALIDACIÓN DEL CSV
    # ========================================================

    if (
        not os.path.isfile(csv_output)
        or
        os.path.getsize(csv_output) == 0
    ):

        duration = (
            time.time() - t0
        )

        msg = (
            f"No se generó un CSV válido: "
            f"{csv_output}"
        )


        print(
            f"[❌ CSV] {msg}"
        )


        log_admin_stage(
            "CSV_ERROR",
            msg
        )


        log_admin(
            test_type,
            source_file,
            compile_cmd_text,
            exec_cmd_text,
            True,
            False,
            duration,
            error_msg=msg,
            input_val=input_size
        )


        return {
            "name": codename,
            "error_code": 300
        }


    # ========================================================
    # ÉXITO
    # ========================================================

    duration = (
        time.time() - t0
    )


    log_admin_stage(
        "EXEC_SUCCESS",
        (
            f"Resultados guardados en: "
            f"{csv_output}"
        )
    )


    log_admin(
        test_type,
        source_file,
        compile_cmd_text,
        exec_cmd_text,
        True,
        True,
        duration,
        input_val=input_size
    )


    log_admin_stage(
        "TEST_DONE",
        (
            f"Test finalizado para "
            f"{source_file}"
        )
    )


    print(
        f"[✔️ {test_type}] "
        f"Resultados guardados en: "
        f"{csv_output}"
    )


    return csv_output


# ============================================================
# LCS
# ============================================================

def cae_lcs(
    name,
    input_size,
    samples,
    measurement=None,
    compiler=COMPILER_CPP,
):

    input_file = os.path.join(
        SERVER_DIR,
        "input",
        "english.50MB"
    )


    return run_benchmark(
        test_type="LCS",
        source_file=name,
        input_size=input_size,
        samples=samples,
        measure_script_name="measurescript4.sh",
        measure_args=[
            input_file,
            input_size,
            samples
        ]
        ,
        measurement=measurement,
        compiler=compiler,
    )


# ============================================================
# CAMM
# ============================================================

def cae_camm(
    name,
    input_size,
    samples,
    task,
    measurement=None,
    compiler=COMPILER_CPP,
):

    input_dir = os.path.join(
        SERVER_DIR,
        "input"
    )


    if task.endswith(
        "CAMMSO"
    ):

        input_file = os.path.join(
            input_dir,
            "numerical_input_semi_sorted.txt"
        )


    elif task.endswith(
        "CAMMS"
    ):

        input_file = os.path.join(
            input_dir,
            "numerical_input_same.txt"
        )


    else:

        input_file = os.path.join(
            input_dir,
            "numerical_input.txt"
        )


    return run_benchmark(
        test_type="CAMM",
        source_file=name,
        input_size=input_size,
        samples=samples,
        measure_script_name="measurescript3.sh",
        measure_args=[
            input_file,
            input_size,
            samples
        ]
        ,
        measurement=measurement,
        compiler=compiler,
    )


# ============================================================
# SIZE
# ============================================================

def cae_size(
    name,
    input_size,
    samples,
    measurement=None,
    compiler=COMPILER_CPP,
):

    return run_benchmark(
        test_type="SIZE",
        source_file=name,
        input_size=input_size,
        samples=samples,
        measure_script_name="measurescript5.sh",
        measure_args=[
            input_size,
            samples
        ]
        ,
        measurement=measurement,
        compiler=compiler,
    )


# ============================================================
# ENVÍO DE RESULTADOS
# ============================================================

def send_results(
    host,
    port,
    name_request,
    result_name,
    measurement=None,
    compiler=None,
    measurement_node_key=None,
    measurement_node_token=None,
):

    try:

        with open(
            result_name,
            "r",
            encoding="utf-8"
        ) as file:

            results = file.read()


    except FileNotFoundError:

        log_admin_stage(
            "RESULT_SEND_ERROR",
            (
                f"No se encontró el archivo "
                f"{result_name}"
            )
        )

        print(
            f"[❌ Resultado no encontrado: "
            f"{result_name}]"
        )

        return False


    payload = attach_result_identity(
        {
            "name": (
                name_request
                + "Results"
            ),
            "results": results,
            "hardware_snapshot": collect_hardware_snapshot(
                measurement=measurement,
                compiler=compiler,
            ),
        },
        measurement_node_key,
    )


    try:

        with socket.socket(
            socket.AF_INET,
            socket.SOCK_STREAM
        ) as sock:

            sock.settimeout(15)

            sock.connect(
                (host, port)
            )

            if measurement_node_key is not None:
                if measurement_node_token is None:
                    raise MeasurementNodeTransportError(
                        "targeted result requires measurement node token"
                    )

                challenge = receive_transport_frame(
                    sock
                )

                respond_to_auth_challenge(
                    sock,
                    challenge,
                    measurement_node_key,
                    measurement_node_token,
                    AUTH_CONTEXT_RESULT,
                )

            sock.sendall(
                json.dumps(
                    payload
                ).encode("utf-8")
            )


        print(
            f"[✔️ Resultados enviados "
            f"a {host}:{port}]"
        )

        return True


    except (
        OSError,
        MeasurementNodeTransportError,
    ) as e:

        log_admin_stage(
            "RESULT_SEND_ERROR",
            (
                f"Error enviando resultados "
                f"a {host}:{port} — {e}"
            )
        )

        print(
            f"[❌ Error enviando "
            f"resultados: {e}]"
        )

        return False


def send_json_result(
    host,
    port,
    error_dict,
    measurement=None,
    compiler=None,
    measurement_node_key=None,
    measurement_node_token=None,
):
    error_dict = dict(error_dict)
    error_dict["hardware_snapshot"] = collect_hardware_snapshot(
        measurement=measurement,
        compiler=compiler,
    )
    error_dict = attach_result_identity(
        error_dict,
        measurement_node_key,
    )

    try:

        with socket.socket(
            socket.AF_INET,
            socket.SOCK_STREAM
        ) as sock:

            sock.settimeout(15)

            sock.connect(
                (host, port)
            )

            if measurement_node_key is not None:
                if measurement_node_token is None:
                    raise MeasurementNodeTransportError(
                        "targeted result requires measurement node token"
                    )

                challenge = receive_transport_frame(
                    sock
                )

                respond_to_auth_challenge(
                    sock,
                    challenge,
                    measurement_node_key,
                    measurement_node_token,
                    AUTH_CONTEXT_RESULT,
                )

            sock.sendall(
                json.dumps(
                    error_dict
                ).encode("utf-8")
            )


        print(
            f"[📤 JSON de error enviado] "
            f"{error_dict}"
        )

        return True


    except (
        OSError,
        MeasurementNodeTransportError,
    ) as e:

        log_admin_stage(
            "RESULT_SEND_ERROR",
            (
                f"Error enviando JSON "
                f"a {host}:{port} — {e}"
            )
        )

        print(
            f"[❌ Error enviando "
            f"JSON de error: {e}]"
        )

        return False


# ============================================================
# COLA LOCAL
# ============================================================

def local_queue_has_recent_task():

    now = time.time()


    try:

        files = os.listdir(
            STATUS_DIR
        )


    except OSError as e:

        print(
            f"[⚠️ No se pudo leer "
            f"{STATUS_DIR}: {e}]"
        )

        return None


    for filename in files:

        path = os.path.join(
            STATUS_DIR,
            filename
        )


        if not os.path.isfile(path):
            continue


        try:

            age = (
                now
                - os.path.getmtime(path)
            )


            if age > QUEUE_RECENT_SECONDS:
                continue


            with open(
                path,
                "r",
                encoding="utf-8"
            ) as file:

                content = file.read()


            if "IN QUEUE" in content:

                return filename


        except OSError:
            continue


    return None


# ============================================================
# COLA REMOTA
# ============================================================

def remote_queue_has_recent_task():

    recent_minutes = max(
        1,
        (
            QUEUE_RECENT_SECONDS + 59
        ) // 60
    )


    remote_cmd = (
        f"find "
        f"{shlex.quote(REMOTE_STATUS_DIR)} "
        f"-type f "
        f"-mmin -{recent_minutes} "
        f"-exec grep -l "
        f"'IN QUEUE' {{}} +"
    )


    try:
        result = sub.run(
            [
                "ssh",
                REMOTE_SSH_TARGET,
                remote_cmd
            ],
            stdout=sub.PIPE,
            stderr=sub.PIPE,
            text=True,
            timeout=REMOTE_SSH_TIMEOUT_SECONDS,
        )
    except sub.TimeoutExpired:
        print(
            "[⚠️ SSH] La consulta de la cola remota excedió el tiempo límite."
        )
        return None


    if result.returncode != 0:

        error = (
            result.stderr.strip()
        )

        if error:

            print(
                f"[⚠️ SSH] {error}"
            )

        return None


    output = (
        result.stdout.strip()
    )


    if not output:
        return None


    first_result = (
        output.splitlines()[0]
    )


    return os.path.basename(
        first_result
    )


# ============================================================
# ESPERA DE TAREA
# ============================================================

def wait_until_recent_in_queue():

    print(
        f"[⏳ Esperando IN QUEUE | "
        f"modo={SLAVE_MODE} | "
        f"master="
        f"{MASTER_HOST}:"
        f"{MASTER_SEND_PORT}]"
    )


    while True:

        try:

            if SLAVE_MODE == "local":

                filename = (
                    local_queue_has_recent_task()
                )

            else:

                filename = (
                    remote_queue_has_recent_task()
                )


            if filename:

                print(
                    f"[✔️ Tarea IN QUEUE "
                    f"detectada: {filename}]"
                )

                return filename


            print(
                f"[🔁 Nada nuevo. "
                f"Revisando en "
                f"{QUEUE_POLL_SECONDS} "
                f"segundos...]"
            )


        except Exception as e:

            log_admin_stage(
                "QUEUE_MONITOR_ERROR",
                (
                    f"Error verificando "
                    f"cola — {e}"
                )
            )

            print(
                f"[⚠️ Error verificando "
                f"cola: {e}]"
            )


        time.sleep(
            QUEUE_POLL_SECONDS
        )


# ============================================================
# MAIN
# ============================================================

def main():

    print(
        "========================================"
    )

    print(
        " PERFORMANCE SYSTEM - SLAVE"
    )

    print(
        "========================================"
    )

    print(
        f"[🔧 Modo] "
        f"{SLAVE_MODE}"
    )

    print(
        f"[🔧 Master envío] "
        f"{MASTER_HOST}:"
        f"{MASTER_SEND_PORT}"
    )

    print(
        f"[🔧 Master resultados] "
        f"{MASTER_HOST}:"
        f"{MASTER_RESULT_PORT}"
    )

    print(
        f"[🔧 Timeout] "
        f"{DEFAULT_TIMEOUT} segundos"
    )

    print(
        "========================================"
    )

    heartbeat_config = (
        measurement_node_heartbeat_configuration()
    )

    if heartbeat_config is None:
        print(
            "[🔧 MeasurementNode] heartbeat disabled"
        )
        transport_node_key = None
        transport_node_token = None
    else:
        print(
            "[🔧 MeasurementNode] "
            "{} | heartbeat={}s".format(
                heartbeat_config["node_key"],
                heartbeat_config["interval_seconds"],
            )
        )

        start_measurement_node_heartbeat(
            configuration=heartbeat_config
        )
        transport_node_key = heartbeat_config["node_key"]
        transport_node_token = heartbeat_config["token"]


    while True:

        # Esperar hasta que exista una tarea
        wait_until_recent_in_queue()


        # ----------------------------------------------------
        # RECIBIR PAYLOAD
        # ----------------------------------------------------

        try:

            with connect_to_server(
                MASTER_HOST,
                MASTER_SEND_PORT
            ) as sock:

                if transport_node_key is not None:
                    send_slave_hello(
                        sock,
                        transport_node_key,
                    )

                    prelude = receive_transport_frame(
                        sock
                    )

                    if is_not_selected_payload(
                        prelude
                    ):
                        print(
                            "[↪️ MeasurementNode] ejecución "
                            "asignada a otro nodo."
                        )
                        time.sleep(
                            QUEUE_POLL_SECONDS
                        )
                        continue

                    respond_to_auth_challenge(
                        sock,
                        prelude,
                        transport_node_key,
                        transport_node_token,
                        AUTH_CONTEXT_PAYLOAD,
                    )

                payload_dict = (
                    receive_payload(sock)
                )

                try:
                    validate_payload_assignment(
                        payload_dict,
                        transport_node_key,
                    )
                except MeasurementNodeTransportError as exc:
                    log_admin_stage(
                        "TARGETING_ERROR",
                        str(exc),
                    )
                    print(
                        "[❌ Payload rechazado por targeting: {}]"
                        .format(exc)
                    )
                    time.sleep(QUEUE_POLL_SECONDS)
                    continue


        except json.JSONDecodeError as e:

            log_admin_stage(
                "JSON_ERROR",
                (
                    f"Payload inválido "
                    f"— {e}"
                )
            )

            print(
                f"[❌ Payload JSON "
                f"inválido: {e}]"
            )

            time.sleep(
                QUEUE_POLL_SECONDS
            )

            continue


        except Exception as e:

            log_admin_stage(
                "UNEXPECTED_ERROR",
                (
                    f"Error recibiendo "
                    f"payload — {e}"
                )
            )

            print(
                f"[❌ Error recibiendo "
                f"payload: {e}]"
            )

            time.sleep(
                QUEUE_POLL_SECONDS
            )

            continue


        # ----------------------------------------------------
        # VALIDAR PAYLOAD
        # ----------------------------------------------------

        if (
            "name" not in payload_dict
            or
            "code" not in payload_dict
        ):

            print(
                "[❌ Payload incompleto: "
                "faltan 'name' y/o 'code'.]"
            )

            time.sleep(
                QUEUE_POLL_SECONDS
            )

            continue

        try:
            source_metadata = validate_source_payload(payload_dict)
            if not isinstance(payload_dict.get("code"), str):
                raise PayloadValidationError(
                    "El campo code debe ser texto UTF-8."
                )
        except PayloadValidationError as exc:
            log_admin_stage(
                "PAYLOAD_VALIDATION_ERROR",
                str(exc),
            )
            print(
                "[❌ Payload C/C++ rechazado antes de materializar: "
                f"{exc}]"
            )
            time.sleep(QUEUE_POLL_SECONDS)
            continue


        print(
            "[📦 Payload recibido]"
        )

        print(
            json.dumps(
                {
                    "name":
                        payload_dict.get(
                            "name"
                        ),

                    "payload_version":
                        payload_dict.get(
                            "payload_version",
                            1,
                        ),

                    "cmd":
                        payload_dict.get(
                            "cmd"
                        ),

                    "input_size":
                        payload_dict.get(
                            "input_size"
                        ),

                    "samples":
                        payload_dict.get(
                            "samples"
                        ),

                    "source_language":
                        source_metadata.source_language,

                    "source_extension":
                        source_metadata.technical_extension,

                    "compiler":
                        source_metadata.compiler,

                    "code_size":
                        len(
                            payload_dict.get(
                                "code",
                                ""
                            )
                        )
                },
                indent=2
            )
        )


        # ----------------------------------------------------
        # GUARDAR CÓDIGO
        # ----------------------------------------------------

        try:
            filename = write_code_to_file(
                payload_dict["name"],
                payload_dict["code"],
                source_metadata.technical_extension,
            )
        except (TypeError, ValueError) as exc:
            log_admin_stage(
                "FILE_VALIDATION_ERROR",
                str(exc),
            )
            print(f"[❌ Fuente no materializada: {exc}]")
            time.sleep(QUEUE_POLL_SECONDS)
            continue


        if filename is None:

            time.sleep(
                QUEUE_POLL_SECONDS
            )

            continue


        task_name = str(
            payload_dict["name"]
        )


        input_size = (
            payload_dict.get(
                "input_size",
                10000
            )
        )


        samples = (
            payload_dict.get(
                "samples",
                30
            )
        )

        measurement = payload_dict.get(
            "measurement"
        )


        codename = os.path.splitext(
            os.path.basename(filename)
        )[0]


        executable = executable_path(
            codename
        )


        # ----------------------------------------------------
        # SELECCIONAR TEST
        # ----------------------------------------------------

        if "LCS" in task_name:

            print(
                "[🧩 Test detectado: LCS]"
            )

            result_name = cae_lcs(
                filename,
                input_size,
                samples,
                measurement=measurement,
                compiler=source_metadata.compiler,
            )


        elif "SIZE" in task_name:

            print(
                "[🧩 Test detectado: SIZE]"
            )

            result_name = cae_size(
                filename,
                input_size,
                samples,
                measurement=measurement,
                compiler=source_metadata.compiler,
            )


        elif "CAMM" in task_name:

            print(
                "[🧩 Test detectado: CAMM]"
            )

            result_name = cae_camm(
                filename,
                input_size,
                samples,
                task_name,
                measurement=measurement,
                compiler=source_metadata.compiler,
            )


        else:

            print(
                f"[⚠️ Test no "
                f"identificado: "
                f"{task_name}]"
            )


            log_admin_stage(
                "UNKNOWN_TEST_TYPE",
                (
                    f"Tarea sin tipo "
                    f"identificable: "
                    f"{task_name}"
                )
            )


            cleanup_files(
                filename,
                executable
            )


            time.sleep(
                QUEUE_POLL_SECONDS
            )

            continue


        # ----------------------------------------------------
        # LIMPIAR FUENTE Y EJECUTABLE
        # ----------------------------------------------------

        cleanup_files(
            filename,
            executable
        )


        # ----------------------------------------------------
        # DEVOLVER RESULTADO
        # ----------------------------------------------------

        if (
            isinstance(
                result_name,
                dict
            )
            and
            "error_code"
            in result_name
        ):

            send_json_result(
                MASTER_HOST,
                MASTER_RESULT_PORT,
                result_name,
                measurement=measurement,
                compiler=source_metadata.compiler,
                measurement_node_key=transport_node_key,
                measurement_node_token=transport_node_token,
            )


        elif result_name:

            sent = send_results(
                MASTER_HOST,
                MASTER_RESULT_PORT,
                task_name,
                result_name,
                measurement=measurement,
                compiler=source_metadata.compiler,
                measurement_node_key=transport_node_key,
                measurement_node_token=transport_node_token,
            )


            if sent:

                cleanup_files(
                    result_name
                )

                print(
                    f"[✅ Resultado final "
                    f"enviado para "
                    f"{task_name}]"
                )


        else:

            log_admin_stage(
                "RESULT_NOT_GENERATED",
                (
                    f"No se generaron "
                    f"resultados para "
                    f"{task_name}"
                )
            )

            print(
                f"[❌ No se generaron "
                f"resultados para "
                f"{task_name}]"
            )


        time.sleep(
            QUEUE_POLL_SECONDS
        )


# ============================================================
# CTRL+C
# ============================================================

def handle_sigint(
    signal_num,
    frame
):

    log_admin_stage(
        "INTERRUPT",
        (
            "Ejecución detenida "
            "manualmente con Ctrl+C"
        )
    )

    print(
        "\n[⛔ Slave detenido "
        "por el usuario]"
    )

    sys.exit(0)


signal.signal(
    signal.SIGINT,
    handle_sigint
)


if __name__ == "__main__":
    main()
