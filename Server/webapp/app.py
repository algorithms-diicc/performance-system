from flask import (
    Flask,
    request,
    render_template,
    abort,
    url_for,
    redirect,
    make_response,
    jsonify,
    send_from_directory,
)
from flask_cors import CORS
import matplotlib.pyplot as plt
import pandas as pd
import subprocess
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

from .dataProcessing import *
from .socketUtils import *


from .utils.api_errors import APIError
from ..db_connection import get_connection  


from .routes.auth_routes import auth_bp
from .routes.admin_users_routes import admin_users_bp
from .routes.profile_routes import profile_bp
from .routes.submissions_routes import submissions_bp
from .routes.metrics_routes import metrics_bp
from .routes.admin_access_requests_routes import admin_access_requests_bp
from .routes.admin_audit_log_routes import admin_audit_log_bp



# Directorio base: carpeta Server/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Subdirectorios absolutos
TEST_DIR = os.path.join(BASE_DIR, "test")
STATUS_DIR = os.path.join(BASE_DIR, "status")
INPUT_DIR = os.path.join(BASE_DIR, "input")
STATIC_DIR = os.path.join(BASE_DIR, "webapp", "static")
RESULTS_DIR = os.path.join(BASE_DIR, "results")

# Asegurar que existan
os.makedirs(TEST_DIR, exist_ok=True)
os.makedirs(STATUS_DIR, exist_ok=True)
os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

# Ruta al frontend compilado
FRONTEND_DIR = os.path.join(BASE_DIR, "webapp", "frontend")

# Initialize the Flask app
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")

# 🔐 Clave secreta para sesiones (leyendo de .env si existe)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret")

# Enable Cross-Origin Resource Sharing (CORS)
CORS(app)

# =========================
# Manejadores globales de error
# =========================

@app.errorhandler(APIError)
def handle_api_error(exc: APIError):
    """
    Maneja errores de negocio/validación definidos en api_errors.py.
    """
    return exc.to_response()


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

# Create an empty list to store measurement queue items
queuelist = []
# statusdict = OrderedDict()
# Define routes and their respective functions


@app.route("/hola", methods=["GET"])
def hola():
    t = subprocess.run(
        ["ls", "status"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
    )
    return str(t.stdout)


@app.route("/<code>/mean")
def jsonifyMean(code):
    df = pd.DataFrame()
    dicc = {}
    try:
        df = pd.read_csv("static/" + code + "/" + code + "ResultsFinal.csv")
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
def tmr(code):
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
def check():
    if abs(activeR - activeS) != 0:
        return "Algunos medidores no responden!", 200
    else:
        return "Todo OK!", 200


@app.route("/status/<filename>")
def serve_status_json(filename):
    full_path = os.path.join(STATIC_DIR, filename)  # ANTES era STATUS_DIR
    if not os.path.exists(full_path):
        abort(404)
    with open(full_path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            return jsonify(data)
        except Exception as e:
            print(f"❌ Error al parsear JSON desde {filename}:", e)
            return make_response("Error al leer archivo de estado", 500)



@app.route("/sendcode", methods=["POST"])
def cap_code():
    # 1) Validar que venga la parte "file" en el formulario
    if "file" not in request.files:
        print("bad request, no file")
        return "No file part", 400

    file = request.files["file"]
    task_type = request.form.get("task_type", "")
    input_size = request.form.get("input_size", 10000)
    samples = request.form.get("samples", default="30")
    username = request.form.get("username", "")

    # 2) Validación robusta de archivo
    if file is None or file.filename is None or file.filename.strip() == "":
        # Aquí evitamos que el linter reclame por posible None
        return "No selected file", 400

    filename = file.filename.strip()

    # 3) Debe ser un ZIP (case-insensitive)
    if not filename.lower().endswith(".zip"):
        return "Invalid file type", 400

    print("Zip package received!")
    temp_zip_path = os.path.join(BASE_DIR, "temp_upload.zip")
    file.save(temp_zip_path)

    with zipfile.ZipFile(temp_zip_path, "r") as zip_ref:
        cpp_dirs_onZip = []
        names_onZip = []
        fileNames = []

        for file_info in zip_ref.infolist():
            if file_info.filename.endswith(".cpp"):
                unique_id = str(random.randint(0, 13458345324))
                tag = (
                    task_type
                    if task_type in ["CAMM", "CAMMR", "CAMMS", "CAMMSO", "LCS", "SIZE"]
                    else ""
                )
                name = unique_id + tag
                status_json_path = os.path.join(STATIC_DIR, name + "_status.json")

                # Crear estructura inicial
                data = {
                    "status": "IN QUEUE",
                    "username": username,
                    "task_type": task_type,
                    "input_size": input_size,
                    "samples": samples,
                    "files": [
                        {
                            "codename": name,
                            "original_filename": os.path.basename(file_info.filename),
                        }
                    ],
                }

                with open(status_json_path, "w") as f:
                    json.dump(data, f, indent=4)

                escribir_estado(name, "📦 Archivo añadido a la cola de espera.")
                print("✅ JSON inicial creado:", status_json_path)

                cpp_file_dir = os.path.join(TEST_DIR, name + ".cpp")
                print(cpp_file_dir)
                outputfile = os.path.join(TEST_DIR, name + ".out")
                statusfile = os.path.join(STATUS_DIR, name)

                with open(cpp_file_dir, "w", newline="\n") as f:
                    f.writelines(
                        [line.decode("utf-8") for line in zip_ref.open(file_info)]
                    )

                with open(statusfile, "w", newline="\n") as st:
                    st.write("IN QUEUE")

                cpp_dirs_onZip.append(cpp_file_dir)
                names_onZip.append(name)
                fileNames.append(file_info.filename)

        queuelist.append(
            [
                cpp_dirs_onZip,
                names_onZip,
                "-O3",
                task_type,
                input_size,
                samples,
                fileNames,
            ]
        )

    os.remove(temp_zip_path)

    return jsonify({"cpp_files_queued": names_onZip, "task_type": task_type}), 200


def serve_next_inline():
    """Process and serve the next inline item from the queue, uno a la vez esperando que termine cada archivo."""
    if not queuelist:
        print("Error: queuelist está vacío, no hay elementos para procesar.")
        return

    next_inline = queuelist.pop()

    if not isinstance(next_inline, list) or len(next_inline) < 7:
        print("Error: next_inline no tiene la estructura esperada.")
        return

    cpp_paths, names, opt_cmd, task_type, input_size, samples, file_names = next_inline

    for file_num in range(len(names)):
        codename = names[file_num]
        status_file_path = os.path.join(STATUS_DIR, codename)

        # Verifica si el estado está marcado como IN QUEUE
        with open(status_file_path, "r") as r:
            estado = r.read()
            if estado != "IN QUEUE":
                continue
        os.utime(status_file_path, None)
        # Enviar tarea al slave
        slave_serve(cpp_paths[file_num], codename, opt_cmd, input_size, samples)

        print(f"⏳ Esperando que finalice la ejecución de {codename}...")
        MAX_WAIT = 2000  # segundos
        waited = 0

        while True:
            try:
                with open(status_file_path, "r") as r2:
                    estado_final = r2.read()
                    if estado_final == "DONE" or estado_final.startswith("ERROR"):
                        break
            except Exception:
                pass

            time.sleep(2)
            waited += 2

            if waited >= MAX_WAIT:
                with open(status_file_path, "w") as w:
                    w.write("ERROR: timeout exceeded")
                escribir_estado(
                    codename,
                    "❌ ERROR DETECTADO: La ejecución del test tomó más de 10 minutos. Revisa el algoritmo o reduce el tamaño de entrada.",
                )
                print(f"⏱️ Timeout alcanzado para {codename} (más de 10 minutos)")
                break
        print(f"✅ Finalizado: {codename} → {estado_final}")

    # Si todo salió bien, generar gráficos
    error_count = 0
    for file_num in range(len(names)):
        status_file_path = os.path.join(STATUS_DIR, names[file_num])
        with open(status_file_path, "r+") as r:
            final_status = r.read()
            if final_status.startswith("ERROR"):
                print(f"⚠️ Fallo en test {codename} → {final_status}")
            if final_status == "ERROR: no machines available":
                escribir_estado(
                    names[file_num], "❌ ERROR DETECTADO: No hay máquinas disponibles."
                )
                error_count += 1
            else:
                r.seek(0)
                r.write("DONE")
                r.truncate()

    if error_count == 0:
        for name in names:
            escribir_estado(name, "📊 Generando gráficos...")
        graph_results(names, file_names, input_size)
        for name in names:
            escribir_estado(name, "✅ Resultados listos.")


def get_status_file_count():
    """Return the count of files in the 'status' directory."""
    s = subprocess.run(
        "ls status| wc -l",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        shell=True,
    )
    return int(s.stdout)


def get_oldest_status_file():
    """Return the path of the oldest file in the 'status' directory."""
    s2 = subprocess.run(
        "find status -type f -printf '%T+ %p\n' | sort | head -1",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True,
        shell=True,
    )
    temp = s2.stdout.split()
    return temp[1]


def remove_status_file(file_path):
    """Remove the specified file."""
    print("Removed element " + file_path + "! from status files", file=sys.stderr)
    subprocess.run(["/bin/rm", file_path], timeout=15)


def remove_associated_static_file(file_path):
    """Remove the associated static file for a given status file."""
    temp2 = file_path.split("/")
    subprocess.run(["/bin/rm", "static/" + temp2[1], "-rf"], timeout=15)


def is_queue_empty():
    """Return True if the queue list is empty, otherwise return False."""
    return not queuelist


def queue_manager():
    """Main function to manage the queue. Runs indefinitely."""
    while True:
        if is_queue_empty():
            print("🔁 Cola vacía. Esperando nuevos archivos...")
            if get_status_file_count() >= 50:
                print(
                    "⚠️ Muchas tareas pendientes en estado. Limpiando la más antigua..."
                )
                oldest_file = get_oldest_status_file()
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
    th.Thread(target=queue_manager, daemon=True).start()


# Esto se ejecuta siempre, incluso con Gunicorn
start_background_thread()

# ================================
#   RUTAS PARA ARCHIVOS Y FRONTEND
# ================================
@app.route("/files/<path:filename>")
def serve_static_file(filename):
    return send_from_directory(STATIC_DIR, filename)


@app.route("/files/<codename>")
def list_files_in_dir(codename):
    path = os.path.join(STATIC_DIR, codename)
    if not os.path.isdir(path):
        abort(404)
    return "\n".join(sorted(os.listdir(path))), 200, {"Content-Type": "text/plain"}


# Servir el frontend de React (build)
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    full_path = os.path.join(FRONTEND_DIR, path)
    if path != "" and os.path.exists(full_path):
        return send_from_directory(FRONTEND_DIR, path)
    else:
        return send_from_directory(FRONTEND_DIR, "index.html")



@app.route("/api/health/db", methods=["GET"])
def health_db():
    try:
        conn = get_connection()
        cur = conn.cursor()

        # Alias claro
        cur.execute("SELECT NOW() AS db_time;")
        row = cur.fetchone()

        cur.close()
        conn.close()

        # row puede ser dict (RealDictCursor) o tupla.
        # Cubrimos ambas posibilidades y evitamos KeyError.
        if row is None:
            db_time = None
        elif isinstance(row, dict):
            db_time = str(row.get("db_time"))
        else:
            # Tupla u otro tipo indexable
            db_time = str(row[0])

        return jsonify(
            {
                "ok": True,
                "db_time": db_time,
            }
        ), 200

    except Exception as e:
        print("Error en /api/health/db:", e)
        return jsonify(
            {
                "ok": False,
                "error": str(e),
            }
        ), 500



# Si se ejecuta directamente con python app.py (modo desarrollo)

if __name__ == "__main__":
    app.run(host="0.0.0.0", debug=True)
