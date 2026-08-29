from flask import (
    Flask,
    request,
    render_template,
    abort,
    url_for,
    redirect,
    make_response,
    jsonify,
)
from flask_cors import CORS

import matplotlib.pyplot as plt
import pandas as pd
import subprocess
import random
import socket
import json
import threading as th
import time
from statistics import mean
import sys
import numpy as np
import os
import shutil
from datetime import datetime

from ..source_contract import (
    CANONICAL_COMPILER_FLAGS,
    METADATA_PROVENANCE_EXPLICIT,
    SourceContractError,
    validate_runtime_source_metadata,
)
from ..measurement_node_transport import (
    MeasurementNodeTransportError,
    build_assignment,
    build_not_selected_payload,
    normalize_node_key,
    receive_slave_hello,
    validate_result_identity,
)


# ============================================================
# CONFIGURACIÓN DE RUTAS
# ============================================================

# Server/
BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)

# Server/status/
STATUS_DIR = os.path.join(BASE_DIR, "status")

# Server/webapp/static/
STATIC_DIR = os.path.join(
    BASE_DIR,
    "webapp",
    "static"
)

os.makedirs(STATUS_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)


# ============================================================
# CONFIGURACIÓN MASTER / SLAVE
# ============================================================

# local  -> ejecución en el mismo computador
# remote -> ejecución contra el master definido por configuración
EXECUTION_MODE = os.getenv(
    "EXECUTION_MODE",
    "local"
).strip().lower()

if EXECUTION_MODE not in {"local", "remote"}:
    raise ValueError(
        "EXECUTION_MODE debe tener el valor 'local' o 'remote'."
    )

DEFAULT_MASTER_HOST = (
    "127.0.0.1"
    if EXECUTION_MODE == "local"
    else None
)

# Puede sobrescribirse también en modo local.
MASTER_HOST = os.getenv(
    "MASTER_HOST",
    DEFAULT_MASTER_HOST
)

if EXECUTION_MODE == "remote" and not MASTER_HOST:
    raise ValueError(
        "MASTER_HOST es obligatorio cuando EXECUTION_MODE=remote."
    )

MASTER_SEND_PORT = int(
    os.getenv("MASTER_SEND_PORT", "50000")
)

MASTER_RESULT_PORT = int(
    os.getenv("MASTER_RESULT_PORT", "60000")
)


# ============================================================
# CÓDIGOS DE ERROR
# ============================================================

ERROR_MESSAGES = {
    100: (
        "❌ Error de compilación del archivo recibido. "
        "Por favor, revise su código fuente."
    ),
    200: (
        "⏰ El algoritmo superó el tiempo límite "
        "de ejecución."
    ),
    300: (
        "📂 El archivo CSV no se generó correctamente."
    ),
    400: (
        "⚠️ Error inesperado durante la ejecución del test."
    ),
}


# ============================================================
# ESTADO GLOBAL
# ============================================================

activeS = 0
activeR = 0


# ============================================================
# ENVÍO DEL PROGRAMA AL SLAVE
# ============================================================

def send_manager(
    s,
    json_string,
    name,
    target_node_key=None,
    max_wait_seconds=60,
):
    """Entrega el payload sólo al MeasurementNode asignado."""

    global activeS

    target_node_key = normalize_node_key(
        target_node_key,
        required=False,
    )
    s.settimeout(1.0)

    start_time = time.time()
    counter = 0

    print(
        f"[📡 MASTER] Esperando slaves en "
        f"{MASTER_HOST}:{MASTER_SEND_PORT}"
    )

    while time.time() - start_time < max_wait_seconds:
        try:
            conn, addr = s.accept()

            print(
                f"[🔗 MASTER] Slave conectado desde "
                f"{addr[0]}:{addr[1]}"
            )

            if target_node_key is not None:
                try:
                    peer_node_key = receive_slave_hello(conn)
                except (
                    MeasurementNodeTransportError,
                    OSError,
                    socket.timeout,
                ) as exc:
                    print(
                        "[⚠️ MASTER] Slave rechazado antes del payload: {}"
                        .format(exc)
                    )
                    try:
                        conn.close()
                    except Exception:
                        pass
                    continue

                if peer_node_key != target_node_key:
                    print(
                        "[⚠️ MASTER] Slave {} no es el target {}."
                        .format(peer_node_key, target_node_key)
                    )
                    try:
                        conn.sendall(build_not_selected_payload())
                    finally:
                        conn.close()
                    continue

                send_program(conn, json_string)
                counter = 1
                break

            thread = th.Thread(
                target=send_program,
                args=(conn, json_string),
                daemon=True,
            )
            thread.start()
            counter += 1

        except socket.timeout:
            if counter > 0:
                break

        except OSError as e:
            print(
                f"[❌ MASTER SEND ERROR] "
                f"Error esperando conexión del slave: {e}"
            )
            break

    if counter == 0:
        print(
            "❌ No measure machines available!",
            file=sys.stderr,
        )

        status_path = os.path.join(
            STATUS_DIR,
            name
        )

        try:
            with open(status_path, "w") as w:
                w.write(
                    "ERROR: no machines available"
                )
        except OSError as e:
            print(
                f"[❌ STATUS ERROR] "
                f"No se pudo escribir {status_path}: {e}"
            )

    activeS = counter


def send_program(conn, json_string):
    """
    Envía el payload JSON correspondiente a una ejecución.
    """

    with conn:
        try:
            conn.sendall(
                json_string.encode("utf-8")
            )

            print(
                "[📤 MASTER] Payload enviado al slave."
            )

        except OSError as e:
            print(
                f"[❌ MASTER] "
                f"Error enviando payload: {e}"
            )


# ============================================================
# RECEPCIÓN DE RESULTADOS DESDE EL SLAVE
# ============================================================

def recv_manager(s, name, expected_node_key=None):
    """Espera resultados y acepta sólo la identidad esperada si existe."""

    global activeR

    expected_node_key = normalize_node_key(
        expected_node_key,
        required=False,
    )
    counter = 0
    firsttime = True

    s.settimeout(2000.0)

    print(
        f"[📡 MASTER] Esperando resultados en "
        f"{MASTER_HOST}:{MASTER_RESULT_PORT}"
    )

    while True:
        try:
            conn, addr = s.accept()

            print(
                f"[📥 MASTER] Resultado recibido desde "
                f"{addr[0]}:{addr[1]}"
            )

            if expected_node_key is not None:
                accepted = receive_data(
                    conn,
                    counter,
                    expected_node_key=expected_node_key,
                )
                if accepted:
                    counter += 1
                    break
                continue

            thread = th.Thread(
                target=receive_data,
                args=(conn, counter),
                daemon=True,
            )
            thread.start()
            counter += 1

        except socket.timeout:
            if counter == 0:
                print(
                    "No measure machines available!",
                    file=sys.stderr,
                )

                status_path = os.path.join(
                    STATUS_DIR,
                    name
                )

                try:
                    with open(status_path, "w") as w:
                        w.write(
                            "ERROR: no machines available"
                        )

                except OSError as e:
                    print(
                        f"[❌ STATUS ERROR] "
                        f"No se pudo escribir estado: {e}"
                    )

            break

        except OSError as e:
            print(
                f"[❌ MASTER RECEIVE ERROR] {e}"
            )
            break

        if firsttime:
            firsttime = False
            s.settimeout(5.0)

    activeR = counter


def receive_data(conn, ident, expected_node_key=None):
    """
    Procesa resultados enviados por un slave.

    Puede recibir:
    - CSV correctamente generado.
    - JSON indicando error de ejecución.
    """

    with conn:
        payload = b""

        while True:
            try:
                data = conn.recv(1024)
            except OSError as e:
                print(
                    f"[❌ RECEIVE ERROR] {e}"
                )
                return False

            if not data:
                break

            payload += data

        if not payload:
            print(
                "Received empty payload, "
                "skipping JSON decoding."
            )
            return False

        try:
            payloadDict = json.loads(
                payload.decode("utf-8")
            )

        except Exception as e:
            print(
                f"❌ Error al decodificar JSON: {e}"
            )
            return False

        if not validate_result_identity(
            payloadDict,
            expected_node_key,
        ):
            print(
                "[⚠️ MASTER] Resultado rechazado: identidad de nodo "
                "no coincide con el target."
            )
            return False

        filename = payloadDict.get(
            "name",
            "unnamed"
        )

        codename = filename.replace(
            "Results",
            ""
        )

        # CORE-06C-3: provenance enviada por el nodo ejecutor.
        hardware_snapshot = payloadDict.get("hardware_snapshot")

        if isinstance(hardware_snapshot, dict) and hardware_snapshot:
            try:
                from .repositories import execution_repository

                execution_repository.store_hardware_snapshot_by_codename(
                    codename,
                    hardware_snapshot,
                )

                print(
                    f"[🧩 MASTER] hardware_snapshot persistido "
                    f"para {codename}"
                )

            except Exception as exc:
                print(
                    f"[WARN MASTER] No fue posible persistir "
                    f"hardware_snapshot para {codename}: {exc}"
                )

        # ----------------------------------------------------
        # RESULTADO CORRECTO
        # ----------------------------------------------------

        if "results" in payloadDict:

            escribir_estado(
                codename,
                (
                    "✅ Test ejecutado correctamente. "
                    "Resultados CSV recibidos."
                ),
            )

            filename_csv = (
                filename
                + str(ident)
                + ".csv"
            )

            result_path = os.path.join(
                STATIC_DIR,
                filename_csv
            )

            try:
                with open(
                    result_path,
                    "w",
                    encoding="utf-8",
                ) as f:

                    f.write(
                        payloadDict["results"]
                    )

            except OSError as e:
                print(
                    f"[❌ CSV WRITE ERROR] {e}"
                )
                return False

            print(
                f"[{ident}] ✅ Resultado CSV "
                f"guardado en: {result_path}"
            )

            status_path = os.path.join(
                STATUS_DIR,
                codename
            )

            try:
                with open(status_path, "w") as w:
                    w.write("DONE")

            except OSError as e:
                print(
                    f"[❌ STATUS ERROR] {e}"
                )

            return True

        # ----------------------------------------------------
        # ERROR DEVUELTO POR EL SLAVE
        # ----------------------------------------------------

        elif "error_code" in payloadDict:

            code = payloadDict["error_code"]

            translated_msg = ERROR_MESSAGES.get(
                code,
                "❓ Error desconocido",
            )

            escribir_estado(
                codename,
                translated_msg,
                tipo="ERROR",
                error_code=code,
            )

            status_path = os.path.join(
                STATUS_DIR,
                codename
            )

            try:
                with open(status_path, "w") as w:
                    w.write(
                        f"ERROR: {translated_msg}"
                    )

            except OSError as e:
                print(
                    f"[❌ STATUS ERROR] {e}"
                )

            print(
                f"[{ident}] ⚠️ Error recibido: "
                f"{translated_msg}"
            )
            return True

        else:
            print(
                "[⚠️ MASTER] Payload recibido sin "
                "'results' ni 'error_code'."
            )
            return False


# ============================================================
# ESTADOS PARA EL FRONTEND
# ============================================================

def escribir_estado(
    codename,
    msg,
    tipo="INFO",
    error_code=None,
):
    """
    Registra mensajes de progreso en:

    Server/webapp/static/<codename>_status.json
    """

    path = os.path.join(
        STATIC_DIR,
        f"{codename}_status.json"
    )

    timestamp = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    if os.path.exists(path):
        try:
            with open(
                path,
                "r",
                encoding="utf-8",
            ) as f:

                data = json.load(f)

        except Exception:
            data = {}

    else:
        data = {}

    if "messages" not in data:
        data["messages"] = []

    data["messages"].append(
        {
            "time": timestamp,
            "msg": msg,
        }
    )

    if tipo == "ERROR":
        data["status"] = "ERROR"
        data["error_code"] = error_code

    try:
        with open(
            path,
            "w",
            encoding="utf-8",
        ) as f:

            json.dump(
                data,
                f,
                indent=2,
                ensure_ascii=False,
            )

    except OSError as e:
        print(
            f"[❌ STATUS JSON ERROR] "
            f"No se pudo escribir {path}: {e}"
        )


# ============================================================
# MASTER DE EJECUCIÓN
# ============================================================

def _load_measurement_snapshot(codename):
    # Obtiene desde PostgreSQL el protocolo experimental persistido.
    # Ejecuciones legacy sin snapshot retornan {}.
    try:
        from .repositories.execution_repository import (
            get_execution_by_codename,
        )

        execution = get_execution_by_codename(codename)
        execution_config = execution.get("execution_config") or {}

        if not isinstance(execution_config, dict):
            return {}

        measurement = execution_config.get("measurement") or {}
        if not isinstance(measurement, dict):
            return {}

        return measurement

    except Exception as exc:
        print(
            "[WARN MASTER] No fue posible cargar measurement snapshot "
            f"para {codename}: {exc}"
        )
        return {}


def build_execution_payload(
    *,
    name,
    code,
    input_size,
    samples,
    measurement=None,
    source_contract_version=None,
    source_language=None,
    compiler=None,
    compiler_flags=None,
    technical_extension=None,
    metadata_provenance=None,
    measurement_node_id=None,
    hardware_profile_id=None,
    measurement_node_key=None,
):
    """Construye payload legacy/v2 y assignment targeted opcional."""
    payload = {
        "payload_version": 1,
        "name": name,
        "cmd": CANONICAL_COMPILER_FLAGS,
        "code": code,
        "input_size": input_size,
        "samples": samples,
        "measurement": (
            measurement if isinstance(measurement, dict) else {}
        ),
    }

    if measurement_node_key is not None:
        payload["measurement_node"] = build_assignment(
            measurement_node_id,
            hardware_profile_id,
            measurement_node_key,
        )

    if source_contract_version is None:
        return payload

    if metadata_provenance != METADATA_PROVENANCE_EXPLICIT:
        raise SourceContractError(
            "Runtime v2 metadata must have explicit provenance."
        )

    metadata = validate_runtime_source_metadata(
        source_contract_version=source_contract_version,
        source_language=source_language,
        compiler=compiler,
        compiler_flags=compiler_flags,
        technical_extension=technical_extension,
    )
    payload.update(
        {
            "payload_version": 2,
            "cmd": metadata.compiler_flags,
            "source_language": metadata.source_language,
            "source_extension": metadata.technical_extension,
            "compiler": metadata.compiler,
            "compiler_flags": metadata.compiler_flags,
        }
    )
    return payload


def slave_serve(
    file_dir,
    name,
    cmd,
    input_size,
    samples,
    *,
    source_contract_version=None,
    source_language=None,
    compiler=None,
    compiler_flags=None,
    technical_extension=None,
    metadata_provenance=None,
    measurement_node_id=None,
    hardware_profile_id=None,
    measurement_node_key=None,
):
    """
    Crea los sockets utilizados para comunicarse
    con el slave.

    50000:
        entrega código y parámetros al slave.

    60000:
        recibe resultados desde el slave.
    """

    host = MASTER_HOST
    port = MASTER_SEND_PORT
    port2 = MASTER_RESULT_PORT

    # CORE-06A-5B: PostgreSQL es la fuente de verdad del protocolo
    # experimental para ejecuciones nuevas.
    measurement = _load_measurement_snapshot(name)

    print("")
    print("========================================")
    print(" PERFORMANCE SYSTEM - MASTER EXECUTION")
    print("========================================")
    print(
        f"[🔧 MASTER] execution mode: "
        f"{EXECUTION_MODE}"
    )
    print(
        f"[🔧 MASTER] host: {host}"
    )
    print(
        f"[🔧 MASTER] send port: {port}"
    )
    print(
        f"[🔧 MASTER] result port: {port2}"
    )
    print(
        f"[📄 MASTER] archivo: {file_dir}"
    )
    print(
        f"[🧪 MASTER] nombre tarea: {name}"
    )
    print("========================================")
    print("")

    # --------------------------------------------------------
    # Abrir sockets
    # --------------------------------------------------------

    while True:

        s = None
        s2 = None

        try:

            s = socket.socket(
                socket.AF_INET,
                socket.SOCK_STREAM,
            )

            s2 = socket.socket(
                socket.AF_INET,
                socket.SOCK_STREAM,
            )

            s.setsockopt(
                socket.SOL_SOCKET,
                socket.SO_REUSEADDR,
                1,
            )

            s2.setsockopt(
                socket.SOL_SOCKET,
                socket.SO_REUSEADDR,
                1,
            )

            s.bind(
                (host, port)
            )

            s2.bind(
                (host, port2)
            )

            s.listen(5)
            s2.listen(5)

            print(
                f"[✅ MASTER] Socket abierto: "
                f"{host}:{port}"
            )

            print(
                f"[✅ MASTER] Socket abierto: "
                f"{host}:{port2}"
            )

            break

        except OSError as e:

            print(
                f"[❌ SOCKET ERROR] "
                f"No fue posible abrir "
                f"{host}:{port}/{port2}"
            )

            print(
                f"[❌ SOCKET ERROR] {e}"
            )

            if s is not None:
                try:
                    s.close()
                except Exception:
                    pass

            if s2 is not None:
                try:
                    s2.close()
                except Exception:
                    pass

            print(
                "[🔁 MASTER] Reintentando "
                "en 2 segundos..."
            )

            time.sleep(2)

    try:

        # ----------------------------------------------------
        # Leer código fuente
        # ----------------------------------------------------

        try:
            with open(
                file_dir,
                "r",
                encoding="utf-8",
            ) as f:

                code = f.read()

        except OSError as e:

            print(
                f"[❌ FILE ERROR] "
                f"No se pudo leer {file_dir}: {e}"
            )

            return

        # ----------------------------------------------------
        # Detectar tipo de prueba
        # ----------------------------------------------------

        task_suffix = ""

        possible_tasks = [
            "CAMMSO",
            "CAMMS",
            "CAMMR",
            "CAMM",
            "LCS",
            "SIZE",
        ]

        for possible in possible_tasks:
            if name.endswith(possible):
                task_suffix = possible
                break

        if not task_suffix:
            print(
                f"[⚠️ MASTER] "
                f"No se pudo determinar "
                f"el tipo de tarea: {name}"
            )

        # ----------------------------------------------------
        # Construir payload
        # ----------------------------------------------------

        payload = build_execution_payload(
            name=name,
            code=code,
            input_size=input_size,
            samples=samples,
            measurement=measurement,
            source_contract_version=source_contract_version,
            source_language=source_language,
            compiler=compiler,
            compiler_flags=compiler_flags,
            technical_extension=technical_extension,
            metadata_provenance=metadata_provenance,
            measurement_node_id=measurement_node_id,
            hardware_profile_id=hardware_profile_id,
            measurement_node_key=measurement_node_key,
        )

        escribir_estado(
            name,
            "📨 Archivo recibido correctamente.",
        )

        escribir_estado(
            name,
            (
                f"🚚 Enviando test al slave "
                f"con tipo: {task_suffix}, "
                f"input_size: {input_size}, "
                f"repeticiones: {samples}."
            ),
        )

        print(
            "[📦 MASTER] Payload preparado:"
        )

        print(
            json.dumps(
                {
                    "payload_version": payload["payload_version"],
                    "name": name,
                    "cmd": payload["cmd"],
                    "input_size": input_size,
                    "samples": samples,
                    "measurement": measurement,
                    "source_language": payload.get("source_language"),
                    "source_extension": payload.get("source_extension"),
                    "compiler": payload.get("compiler"),
                    "compiler_flags": payload.get("compiler_flags"),
                    "code_size": len(code),
                },
                indent=2,
            )
        )

        json_string = json.dumps(
            payload
        )

        # ----------------------------------------------------
        # Thread que entrega el programa
        # ----------------------------------------------------

        sendmng = th.Thread(
            target=send_manager,
            args=(
                s,
                json_string,
                name,
                measurement_node_key,
            ),
            daemon=True,
        )

        sendmng.start()
        sendmng.join()

        print(
            "[🔌 MASTER] "
            "Canal de envío finalizado."
        )

        # No puede existir un resultado válido si el payload no fue
        # entregado a ningún slave. Evitar arrancar recv_manager en ese
        # caso también evita bloquear el dispatcher durante el timeout
        # largo del socket de resultados.
        if activeS == 0:
            return

        # ----------------------------------------------------
        # Thread que espera el resultado
        # ----------------------------------------------------

        recvmng = th.Thread(
            target=recv_manager,
            args=(
                s2,
                name,
                measurement_node_key,
            ),
            daemon=True,
        )

        recvmng.start()
        recvmng.join()

        print(
            "[🔌 MASTER] "
            "Canal de recepción finalizado."
        )

    finally:

        try:
            s.close()
        except Exception:
            pass

        try:
            s2.close()
        except Exception:
            pass

        print(
            "[🔒 MASTER] Sockets cerrados."
        )


# ============================================================
# SEGURIDAD
# ============================================================

def security_check():
    """
    Pendiente:
    validaciones adicionales de seguridad
    para código recibido.
    """
    pass
