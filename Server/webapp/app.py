from flask import (
    Flask,
    request,
    g,
    render_template,
    abort,
    url_for,
    redirect,
    make_response,
    jsonify,
    send_from_directory,
)
from flask_cors import CORS
from werkzeug.exceptions import HTTPException
import matplotlib.pyplot as plt
import pandas as pd
import shutil
import random
import socket
import json
import zipfile
import threading as th
import time
from statistics import mean
import sys
import numpy as np
import os
import re
from pathlib import Path, PurePosixPath

from .dataProcessing import *
from .socketUtils import *
from ..source_contract import infer_v2_source_metadata


from .utils.api_errors import (
    APIError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from .utils.auth_decorators import (
    admin_required,
    get_user_role_name,
    login_required,
)
from ..db_connection import get_connection  


from .routes.auth_routes import auth_bp
from .routes.admin_users_routes import admin_users_bp
from .routes.profile_routes import profile_bp
from .routes.submissions_routes import submissions_bp
from .routes.metrics_routes import metrics_bp
from .routes.admin_access_requests_routes import admin_access_requests_bp
from .routes.admin_audit_log_routes import admin_audit_log_bp
from .routes.admin_system_status_routes import admin_system_status_bp
from .routes.results_routes import results_bp
from .routes.execution_status_routes import execution_status_bp
from .routes.teacher_courses_routes import teacher_courses_bp
from .routes.experimental_protocol_routes import experimental_protocols_bp
from .routes.feedback_notifications_routes import feedback_notifications_bp
from .routes.trace_routes import trace_bp
from .routes.export_routes import export_bp
from .routes.comparison_routes import comparisons_bp

from .services.execution_creation_service import (
    InvalidExecutionRequest,
    create_submission_bundle,
)
from .services.execution_state_service import mark_failed
from .services.execution_pipeline_service import (
    execution_result_path,
    read_legacy_outcome,
    result_bundle_exists,
)
from .services.worker_execution_service import (
    get_execution_context,
    mark_processing_failed,
    mark_worker_completed,
    mark_worker_failed,
    mark_worker_started,
    persist_worker_outcome,
)
from .services.execution_runner_service import (
    run_single_execution,
    sync_submission_terminal_status,
)
from .services.upload_service import (
    UploadValidationError,
    remove_stored_upload,
    store_and_inspect_zip,
)
from .services.execution_access_service import (
    ExecutionAccessForbidden,
    ExecutionAccessNotFound,
    assert_execution_viewer,
)
from .repositories.submission_repository import update_submission_status



# Directorio base: carpeta Server/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Subdirectorios absolutos
TEST_DIR = os.path.join(BASE_DIR, "test")
STATUS_DIR = os.path.join(BASE_DIR, "status")
INPUT_DIR = os.path.join(BASE_DIR, "input")
STATIC_DIR = os.path.join(BASE_DIR, "webapp", "static")
RESULTS_DIR = os.path.join(BASE_DIR, "results")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")

# Asegurar que existan
os.makedirs(TEST_DIR, exist_ok=True)
os.makedirs(STATUS_DIR, exist_ok=True)
os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Ruta al frontend compilado
FRONTEND_DIR = os.path.join(BASE_DIR, "webapp", "frontend")

# Initialize the Flask app
# El frontend compilado se sirve explícitamente mediante serve_frontend().
# No se registra la ruta estática automática de Flask porque entraría en
# conflicto con las rutas client-side de React Router (/profile, /login, etc.).
app = Flask(__name__, static_folder=None)

# No se conserva ningún secreto de aplicación dentro del repositorio.
app.secret_key = os.getenv("FLASK_SECRET_KEY")
app.config["MAX_CONTENT_LENGTH"] = max(
    1,
    int(os.getenv("MAX_UPLOAD_REQUEST_BYTES", str(12 * 1024 * 1024))),
)
STATUS_AUTO_CLEANUP_ENABLED = os.getenv(
    "STATUS_AUTO_CLEANUP_ENABLED",
    "0",
).strip().casefold() in {"1", "true", "yes", "on"}
STATUS_RETENTION_LIMIT = max(
    1,
    int(os.getenv("STATUS_RETENTION_LIMIT", "50")),
)

# Enable Cross-Origin Resource Sharing (CORS)
CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://127.0.0.1:3000,http://localhost:3000",
    ).split(",")
    if origin.strip()
]
if "*" in CORS_ALLOWED_ORIGINS:
    raise RuntimeError(
        "CORS_ORIGINS no puede contener '*' cuando se aceptan credenciales."
    )
CORS(
    app,
    supports_credentials=True,
    origins=CORS_ALLOWED_ORIGINS,
)


@app.after_request
def add_application_security_headers(response):
    """Cabeceras compatibles con React y los iframes Plotly same-origin."""
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    response.headers.setdefault(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
    )
    return response

# =========================
# Manejadores globales de error
# =========================

@app.errorhandler(APIError)
def handle_api_error(exc: APIError):
    """
    Maneja errores de negocio/validación definidos en api_errors.py.
    """
    return exc.to_response()


@app.errorhandler(HTTPException)
def handle_http_error(exc: HTTPException):
    """Evita que Flask entregue páginas HTML para errores HTTP."""
    status = int(exc.code or 500)
    messages = {
        400: "La solicitud no tiene un formato válido.",
        401: "Debes iniciar sesión para acceder a este recurso.",
        403: "No tienes permisos para acceder a este recurso.",
        404: "El recurso solicitado no existe.",
        405: "El método solicitado no está permitido para este recurso.",
        413: "El archivo enviado supera el tamaño permitido.",
    }
    message = messages.get(
        status,
        "Error interno del servidor."
        if status >= 500
        else "No fue posible completar la solicitud.",
    )

    return jsonify(
        {
            "error": {
                "message": message,
                "code": "HTTP_{}".format(status),
            }
        }
    ), status


@app.errorhandler(Exception)
def handle_unexpected_error(exc: Exception):
    """
    Fallback para cualquier error no controlado.

    - Logea el tipo y mensaje en consola.
    - Devuelve 500 con un JSON genérico.
    """
    print("❌ Error no controlado:", type(exc).__name__, str(exc))
    return jsonify(
        {
            "error": {
                "message": "Error interno del servidor.",
                "code": "INTERNAL_ERROR",
            }
        }
    ), 500


# # Blueprints

app.register_blueprint(auth_bp)
app.register_blueprint(admin_users_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(submissions_bp)
app.register_blueprint(metrics_bp)
app.register_blueprint(admin_access_requests_bp)
app.register_blueprint(admin_audit_log_bp)
app.register_blueprint(admin_system_status_bp)
app.register_blueprint(results_bp)
app.register_blueprint(execution_status_bp)
app.register_blueprint(teacher_courses_bp)
app.register_blueprint(experimental_protocols_bp)
app.register_blueprint(feedback_notifications_bp)
app.register_blueprint(trace_bp)
app.register_blueprint(export_bp)
app.register_blueprint(comparisons_bp)

# Cola legacy conservada sólo para compatibilidad/regresión de
# `serve_next_inline()`. El runtime productivo de Iteración 9 usa
# Server/execution_dispatcher.py + PostgreSQL.
queuelist = []
# statusdict = OrderedDict()
# Define routes and their respective functions

CODENAME_RE = re.compile(r"^[A-Za-z0-9_-]+$")
STATUS_FILENAME_RE = re.compile(
    r"^(?P<codename>[A-Za-z0-9_-]+)(?:_status|Results_status)\.json$"
)


def _assert_execution_access(codename):
    codename = str(codename or "")
    if not CODENAME_RE.fullmatch(codename):
        raise NotFoundError("La ejecución solicitada no existe.")

    role_name = get_user_role_name(g.current_user)
    try:
        return assert_execution_viewer(
            codename=codename,
            current_user_id=g.current_user["id"],
            current_role_name=role_name,
        )
    except ExecutionAccessNotFound:
        raise NotFoundError("La ejecución solicitada no existe.")
    except ExecutionAccessForbidden:
        raise ForbiddenError(
            "No tienes permiso para acceder a esta ejecución."
        )


def _codename_from_static_path(filename):
    normalized = str(filename or "").replace("\\", "/")
    path = PurePosixPath(normalized)
    if (
        not normalized
        or path.is_absolute()
        or ".." in path.parts
        or not path.parts
    ):
        raise NotFoundError("El archivo solicitado no existe.")

    codename = path.parts[0]
    _assert_execution_access(codename)
    return codename


@app.route("/hola", methods=["GET"])
@login_required
@admin_required
def hola():
    return jsonify({"ok": True}), 200


@app.route("/<code>/mean")
@login_required
def jsonifyMean(code):
    _assert_execution_access(code)
    df = pd.DataFrame()
    dicc = {}
    try:
        df = pd.read_csv(
            os.path.join(
                STATIC_DIR,
                code,
                code + "ResultsFinal.csv",
            )
        )
    except FileNotFoundError:
        abort(404)

    for columni in range(20):
        test = df.iloc[:, columni]
        try:
            tmp = f"{round(mean(test), 3):,}"
            tmp = tmp.replace(".", ":")
            tmp = tmp.replace(",", ".")
            tmp = tmp.replace(":", ",")
        except TypeError:
            tmp = "<No medido>"
        dicc[test.name] = tmp
    return jsonify(dicc), 200


# Route to check the status of a code execution
@app.route("/checkstatus/<code>", methods=["GET"])
@login_required
def tmr(code):
    _assert_execution_access(code)
    try:
        status_path = os.path.join(STATUS_DIR, code)
        with open(status_path, "r+", newline="\n") as temp:
            data = temp.read()
    except FileNotFoundError:
        abort(404)

    response = make_response(data, 200)
    response.headers["content-type"] = "text/plain;charset=UTF-8"
    return response


# Route to check the status of measurement machines
@app.route("/checkmeasurers", methods=["GET"])
@login_required
@admin_required
def check():
    if abs(activeR - activeS) != 0:
        return "Algunos medidores no responden!", 200
    else:
        return "Todo OK!", 200


@app.route("/status/<filename>")
@login_required
def serve_status_json(filename):
    match = STATUS_FILENAME_RE.fullmatch(str(filename or ""))
    if not match:
        raise NotFoundError("El estado solicitado no existe.")
    _assert_execution_access(match.group("codename"))

    full_path = os.path.join(STATIC_DIR, filename)  # ANTES era STATUS_DIR
    if not os.path.exists(full_path):
        abort(404)
    with open(full_path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            return jsonify(data)
        except Exception as e:
            print(f"❌ Error al parsear JSON desde {filename}:", e)
            return jsonify(
                {
                    "error": {
                        "message": "No fue posible leer el estado solicitado.",
                        "code": "STATUS_READ_ERROR",
                    }
                }
            ), 500



@app.route("/sendcode", methods=["POST"])
@login_required
def cap_code():
    """
    CORE-04B-2.

    PostgreSQL registra Submission + Executions como fuente de verdad
    persistente de la cola. El dispatcher independiente reclamará cada
    Execution en orden FIFO.
    """
    file = request.files.get("file")
    if file is None:
        raise ValidationError(
            "Debe adjuntar un archivo ZIP.",
            extra={"field": "file"},
        )

    task_type = request.form.get("task_type", "")
    input_size = request.form.get("input_size", "10000")
    samples = request.form.get("samples", "30")
    note = request.form.get("note")
    course_id = (
        request.form.get("course_id")
        or request.form.get("courseId")
        or None
    )
    protocol_id = (
        request.form.get("protocol_id")
        or request.form.get("protocolId")
        or None
    )

    title = (request.form.get("title") or "").strip()
    if not title:
        title = "{} - {}".format(
            task_type or "Análisis",
            (file.filename or "upload.zip").strip(),
        )

    stored_upload = None
    bundle = None

    try:
        stored_upload = store_and_inspect_zip(
            file,
            UPLOAD_DIR,
        )

        source_specs = [
            {"original_filename": source.original_filename}
            for source in stored_upload.sources
        ]

        bundle = create_submission_bundle(
            user_id=g.current_user["id"],
            title=title,
            archive_path=os.path.relpath(
                stored_upload.stored_path,
                BASE_DIR,
            ),
            archive_sha256=stored_upload.sha256,
            benchmark=task_type,
            input_size=input_size,
            samples=samples,
            source_specs=source_specs,
            original_filename=stored_upload.original_filename,
            note=note,
            course_id=course_id,
            protocol_id=protocol_id,
        )

    except (UploadValidationError, InvalidExecutionRequest) as exc:
        if stored_upload is not None:
            remove_stored_upload(stored_upload.stored_path)
        raise ValidationError(str(exc))

    except Exception:
        if bundle is None and stored_upload is not None:
            remove_stored_upload(stored_upload.stored_path)
        raise

    names_on_zip = []
    c_names_on_zip = []
    cpp_names_on_zip = []
    created_artifacts = []

    try:
        for source, execution in zip(
            stored_upload.sources,
            bundle["executions"],
        ):
            codename = execution["codename"]
            source_metadata = infer_v2_source_metadata(
                source.original_filename
            )

            status_json_path = os.path.join(
                STATIC_DIR,
                codename + "_status.json",
            )
            source_file_dir = os.path.join(
                TEST_DIR,
                codename + source_metadata.technical_extension,
            )
            status_file_path = os.path.join(
                STATUS_DIR,
                codename,
            )

            status_data = {
                "status": "IN QUEUE",
                "username": (
                    g.current_user.get("email")
                    or g.current_user.get("full_name")
                    or ""
                ),
                "task_type": task_type,
                "input_size": input_size,
                "samples": samples,
                "submission_id": bundle["submission"]["id"],
                "execution_public_id": execution["public_id"],
                "files": [
                    {
                        "codename": codename,
                        "original_filename": source.original_filename,
                        "source_language": (
                            source_metadata.source_language
                        ),
                        "compiler": source_metadata.compiler,
                    }
                ],
            }

            with open(
                status_json_path,
                "w",
                encoding="utf-8",
            ) as handle:
                json.dump(
                    status_data,
                    handle,
                    indent=4,
                    ensure_ascii=False,
                )
            created_artifacts.append(status_json_path)

            with open(
                source_file_dir,
                "w",
                encoding="utf-8",
                newline="\n",
            ) as handle:
                handle.write(source.content)
            created_artifacts.append(source_file_dir)

            with open(
                status_file_path,
                "w",
                encoding="utf-8",
                newline="\n",
            ) as handle:
                handle.write("IN QUEUE")
            created_artifacts.append(status_file_path)

            escribir_estado(
                codename,
                "📦 Archivo añadido a la cola de espera.",
            )

            names_on_zip.append(codename)
            if source_metadata.source_language == "C":
                c_names_on_zip.append(codename)
            else:
                cpp_names_on_zip.append(codename)

    except Exception as exc:
        for execution in bundle["executions"]:
            try:
                mark_failed(
                    execution["public_id"],
                    failure_stage="INFRASTRUCTURE",
                    error_code="QUEUE_ENQUEUE_FAILED",
                    error_message=str(exc),
                )
            except Exception as state_exc:
                print(
                    "❌ No se pudo marcar execution como FAILED:",
                    execution["public_id"],
                    state_exc,
                )

        try:
            update_submission_status(
                bundle["submission"]["id"],
                "ERROR",
            )
        except Exception as submission_exc:
            print(
                "❌ No se pudo actualizar submission a ERROR:",
                submission_exc,
            )

        for artifact_path in created_artifacts:
            try:
                os.remove(artifact_path)
            except FileNotFoundError:
                pass
            except Exception:
                pass

        return jsonify(
            {
                "error": {
                    "code": "QUEUE_ENQUEUE_FAILED",
                    "message": (
                        "El análisis fue registrado, pero no pudo "
                        "incorporarse a la cola de ejecución."
                    ),
                },
                "submissionId": bundle["submission"]["id"],
                "executions": [
                    {
                        "publicId": row["public_id"],
                        "codename": row["codename"],
                        "state": "FAILED",
                    }
                    for row in bundle["executions"]
                ],
            }
        ), 503

    return jsonify(
        {
            "submissionId": bundle["submission"]["id"],
            "status": "QUEUED",
            "taskType": task_type,
            "archiveSha256": stored_upload.sha256,
            "source_files_queued": names_on_zip,
            "c_files_queued": c_names_on_zip,
            "cpp_files_queued": cpp_names_on_zip,
            "executions": [
                {
                    "publicId": execution["public_id"],
                    "codename": execution["codename"],
                    "originalFilename": source.original_filename,
                    "sourceLanguage": infer_v2_source_metadata(
                        source.original_filename
                    ).source_language,
                    "compiler": infer_v2_source_metadata(
                        source.original_filename
                    ).compiler,
                    "state": execution["execution_state"],
                }
                for source, execution in zip(
                    stored_upload.sources,
                    bundle["executions"],
                )
            ],
        }
    ), 202


def serve_next_inline():
    """
    Wrapper legacy de bundle sobre el runner canónico por Execution.

    `queuelist` se conserva únicamente para compatibilidad/regresión legacy.
    Cada elemento se procesa de forma independiente y el estado de Submission
    se sincroniza sólo cuando todas sus executions son terminales.
    """
    if not queuelist:
        print(
            "Error: queuelist está vacío, no hay elementos para procesar."
        )
        return

    next_inline = queuelist.pop()

    if not isinstance(next_inline, list) or len(next_inline) < 7:
        print("Error: next_inline no tiene la estructura esperada.")
        return

    (
        cpp_paths,
        names,
        opt_cmd,
        task_type,
        input_size,
        samples,
        file_names,
    ) = next_inline[:7]

    max_wait = int(
        os.getenv("MASTER_EXECUTION_TIMEOUT_SECONDS", "2000")
    )

    for file_num, codename in enumerate(names):
        status_file_path = os.path.join(STATUS_DIR, codename)

        try:
            with open(
                status_file_path,
                "r",
                encoding="utf-8",
            ) as status_file:
                initial_status = status_file.read().strip()
        except OSError as exc:
            print(
                "❌ No se pudo leer status de {}: {}".format(
                    codename, exc
                )
            )
            continue

        if initial_status != "IN QUEUE":
            print(
                "⚠️ {} no estaba IN QUEUE; estado={!r}. Se omite.".format(
                    codename, initial_status
                )
            )
            continue

        run_single_execution(
            source_path=cpp_paths[file_num],
            codename=codename,
            original_filename=file_names[file_num],
            input_size=input_size,
            samples=samples,
            status_dir=STATUS_DIR,
            static_dir=STATIC_DIR,
            base_dir=BASE_DIR,
            opt_cmd=opt_cmd,
            max_wait_seconds=max_wait,
            slave_serve_func=slave_serve,
            status_writer_func=escribir_estado,
            read_legacy_outcome_func=read_legacy_outcome,
            mark_worker_started_func=mark_worker_started,
            mark_worker_failed_func=mark_worker_failed,
            persist_worker_outcome_func=persist_worker_outcome,
            graph_results_func=graph_results,
            result_bundle_exists_func=result_bundle_exists,
            execution_result_path_func=execution_result_path,
            mark_processing_failed_func=mark_processing_failed,
            mark_worker_completed_func=mark_worker_completed,
        )

    if names:
        try:
            first_execution = get_execution_context(names[0])
            sync_submission_terminal_status(
                first_execution["submission_id"]
            )
        except Exception as exc:
            print(
                "⚠️ No se pudo sincronizar submission.status: {}".format(
                    exc
                )
            )



def get_status_file_count():
    """Return the count of files in the 'status' directory."""
    return sum(
        1
        for item in Path(STATUS_DIR).iterdir()
        if item.is_file()
    )


def get_oldest_status_file():
    """Return the path of the oldest file in the 'status' directory."""
    candidates = [
        item
        for item in Path(STATUS_DIR).iterdir()
        if item.is_file()
    ]
    if not candidates:
        return None
    return str(min(candidates, key=lambda item: item.stat().st_mtime))


def _status_path(file_path):
    path = Path(file_path).resolve()
    status_root = Path(STATUS_DIR).resolve()
    if path.parent != status_root or not CODENAME_RE.fullmatch(path.name):
        raise ValueError("Ruta de estado fuera del directorio permitido.")
    return path


def remove_status_file(file_path):
    """Remove the specified file."""
    path = _status_path(file_path)
    print("Removed element " + str(path) + "! from status files", file=sys.stderr)
    path.unlink(missing_ok=True)


def remove_associated_static_file(file_path):
    """Remove the associated static file for a given status file."""
    codename = _status_path(file_path).name
    target = (Path(STATIC_DIR) / codename).resolve()
    static_root = Path(STATIC_DIR).resolve()
    if target.parent != static_root:
        raise ValueError("Ruta static fuera del directorio permitido.")
    if target.is_dir():
        shutil.rmtree(target)
    elif target.exists():
        target.unlink()


def is_queue_empty():
    """Return True if the queue list is empty, otherwise return False."""
    return not queuelist


def queue_manager():
    """Main function to manage the queue. Runs indefinitely."""
    while True:
        if is_queue_empty():
            print("🔁 Cola vacía. Esperando nuevos archivos...")
            if (
                STATUS_AUTO_CLEANUP_ENABLED
                and get_status_file_count() >= STATUS_RETENTION_LIMIT
            ):
                print(
                    "⚠️ Límite de estados alcanzado. "
                    "Limpiando el más antiguo por configuración explícita..."
                )
                oldest_file = get_oldest_status_file()
                if oldest_file is not None:
                    remove_status_file(oldest_file)
                    remove_associated_static_file(oldest_file)
            time.sleep(10)
        else:
            print("📦 Procesando nueva tanda de archivos desde la cola...")
            serve_next_inline()
            print("✅ Tanda completa procesada. Esperando próxima...")


def start_background_thread():
    """Lanza el hilo de gestión de cola al iniciar el servidor."""
    print("🔁 Iniciando hilo de gestión de cola...")
    if not STATUS_AUTO_CLEANUP_ENABLED:
        print("🛡️ Limpieza automática de estados: desactivada.")
    th.Thread(target=queue_manager, daemon=True).start()


# Iteración 9: el servidor web ya no inicia un dispatcher por worker.
# El proceso operacional se ejecuta mediante Server/execution_dispatcher.py.

# ================================
#   RUTAS PARA ARCHIVOS Y FRONTEND
# ================================
@app.route("/files/<path:filename>")
@login_required
def serve_static_file(filename):
    _codename_from_static_path(filename)
    return send_from_directory(STATIC_DIR, filename)


@app.route("/files/<codename>")
@login_required
def list_files_in_dir(codename):
    _assert_execution_access(codename)
    path = os.path.join(STATIC_DIR, codename)
    if not os.path.isdir(path):
        abort(404)
    return "\n".join(sorted(os.listdir(path))), 200, {"Content-Type": "text/plain"}


# Servir el frontend de React (build)
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path == "api" or path.startswith("api/"):
        abort(404)

    full_path = os.path.join(FRONTEND_DIR, path)
    if path != "" and os.path.exists(full_path):
        return send_from_directory(FRONTEND_DIR, path)
    else:
        return send_from_directory(FRONTEND_DIR, "index.html")



@app.route("/api/health/db", methods=["GET"])
@login_required
@admin_required
def health_db():
    try:
        conn = get_connection()
        cur = conn.cursor()

        # Alias claro
        cur.execute("SELECT NOW() AS db_time;")
        row = cur.fetchone()

        cur.close()
        conn.close()

        return jsonify(
            {
                "ok": True,
            }
        ), 200

    except Exception as e:
        print("Error en /api/health/db:", e)
        return jsonify(
            {
                "ok": False,
                "error": {
                    "message": "La base de datos no está disponible.",
                    "code": "DATABASE_UNAVAILABLE",
                },
            }
        ), 500



# Si se ejecuta directamente con python app.py (modo desarrollo)

if __name__ == "__main__":
    debug_enabled = os.getenv("FLASK_DEBUG", "0").strip().lower() in {
        "1",
        "true",
        "yes",
    }
    app.run(host="0.0.0.0", debug=debug_enabled)
