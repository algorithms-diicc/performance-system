from flask import Flask, request, render_template, abort, url_for, redirect, make_response, jsonify
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
from dataProcessing import *
from socketUtils import *
import os
from flask import send_from_directory

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

# Enable Cross-Origin Resource Sharing (CORS)
CORS(app)

# Create an empty list to store measurement queue items
queuelist = []
# statusdict = OrderedDict()
# Define routes and their respective functions


@app.route('/hola', methods=['GET'])
def hola():
    t = subprocess.run(['ls', 'status'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True)
    return str(t.stdout)

@app.route('/<code>/mean')
def jsonifyMean(code):
    df = pd.DataFrame()
    dicc = {}
    try:
        df = pd.read_csv('static/'+code+'/'+code+'ResultsFinal.csv')
    except FileNotFoundError:
        abort(404)

    for columni in range(20):
        test = df.iloc[:, columni]
        try:
         tmp = f'{round(mean(test), 3):,}'
         tmp = tmp.replace('.', ':')
         tmp = tmp.replace(',', '.')
         tmp = tmp.replace(':', ',')
        except TypeError:
         tmp = '<No medido>'
        dicc[test.name] = tmp
    return jsonify(dicc), 200


# Route to check the status of a code execution
@app.route('/checkstatus/<code>', methods=['GET'])
def tmr(code):
    try:
        status_path = os.path.join(STATUS_DIR, code)
        with open(status_path, 'r+', newline='\n') as temp:
            data = temp.read()
    except FileNotFoundError:
        abort(404)
    
    response = make_response(data, 200)
    response.headers["content-type"] = "text/plain;charset=UTF-8"
    return response

# Route to check the status of measurement machines
@app.route('/checkmeasurers', methods=['GET'])
def check():
    if abs(activeR - activeS) != 0:
        return 'Algunos medidores no responden!', 200
    else:
        return 'Todo OK!', 200
@app.route('/status/<filename>')
def serve_status_json(filename):
    full_path = os.path.join(STATUS_DIR, filename)
    if not os.path.exists(full_path):
        abort(404)
    with open(full_path, 'r', encoding='utf-8') as f:
        try:
            data = json.load(f)
            return jsonify(data)
        except Exception as e:
            print(f"❌ Error al parsear JSON desde {filename}:", e)
            return make_response("Error al leer archivo de estado", 500)
    
@app.route('/sendcode', methods=['POST'])
def cap_code():
    if 'file' not in request.files:
        print("bad request, no file")
        return 'No file part', 400

    file = request.files['file']
    task_type = request.form.get('task_type', '')
    input_size = request.form.get('input_size', 10000)
    samples = request.form.get("samples", default="30")  

    if file.filename == '':
        return 'No selected file', 400
    if not file.filename.endswith('.zip'):
        return 'Invalid file type', 400

    print("Zip package received!")
    temp_zip_path = os.path.join(BASE_DIR, "temp_upload.zip")
    file.save(temp_zip_path)

    with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
        cpp_dirs_onZip = []
        names_onZip = []
        fileNames = []

        for file_info in zip_ref.infolist():
            if file_info.filename.endswith('.cpp'):
                unique_id = str(random.randint(0, 13458345324))
                print(f"Code {unique_id} found, with task {task_type}")

                tag = task_type if task_type in ["CAMM", "CAMMR", "CAMMS", "CAMMSO", "LCS", "SIZE"] else ""
                name = unique_id + tag

                cpp_file_dir = os.path.join(TEST_DIR, name + ".cpp")
                print(cpp_file_dir)
                outputfile = os.path.join(TEST_DIR, name + ".out")
                statusfile = os.path.join(STATUS_DIR, name + "_status.json")


                with open(cpp_file_dir, "w", newline="\n") as f:
                    f.writelines([line.decode('utf-8') for line in zip_ref.open(file_info)])

                with open(statusfile, "w", newline="\n") as st:
                 st.write(json.dumps({"messages": [{"time": timestamp_actual, "msg": "IN QUEUE"}]}))

                cpp_dirs_onZip.append(cpp_file_dir)
                names_onZip.append(name)
                fileNames.append(file_info.filename)

        queuelist.append([cpp_dirs_onZip, names_onZip, "-O3", task_type, input_size, samples, fileNames])

    os.remove(temp_zip_path)

    return jsonify({'cpp_files_queued': names_onZip, 'task_type': task_type}), 200


# Process and serve the next inline item from the queue
def serve_next_inline():
    """Process and serve the next inline item from the queue."""
    if not queuelist:
        print("Error: queuelist está vacío, no hay elementos para procesar.")
        return

    print("Contenido de queuelist antes de pop:", queuelist)
    next_inline = queuelist.pop()
    print("next_inline: ", next_inline)

    if not isinstance(next_inline, list) or len(next_inline) < 7:
        print("Error: next_inline no tiene la estructura esperada.")
        return

    if not all(isinstance(item, list) for item in [next_inline[1], next_inline[6]]):
        print("Error: Algunos elementos en next_inline no son listas como se esperaba.")
        return

    if not next_inline[1]:  # Verifica si la lista en next_inline[1] está vacía
        print("Error: next_inline[1] está vacío")
        return

    for file_num in range(len(next_inline[1])):
        status_file_path = os.path.join(STATUS_DIR, next_inline[1][file_num])
        with open(status_file_path, 'r') as r:
            asd = r.read()
            if asd == 'IN QUEUE':
                print(next_inline)
                slave_serve(next_inline[0][file_num], next_inline[1][file_num], next_inline[2], next_inline[4], next_inline[5])

    error_count = 0
    for file_num in range(len(next_inline[1])):
        status_file_path = os.path.join(STATUS_DIR, next_inline[1][file_num])
        with open(status_file_path, 'r+') as r:
            asd2 = r.read()
            if asd2 != 'ERROR: no machines available':
                print("prev-graph_results")
                print(next_inline, 'served!')
                r.seek(0)
                r.write('DONE')
                r.truncate()
            else:
                error_count += 1
                print(next_inline, 'failed: No machines available!')

    if error_count == 0:
        graph_results(next_inline[1], next_inline[6], next_inline[4])

# Get the number of files in the 'status' directory
def get_status_file_count():
    """Return the count of files in the 'status' directory."""
    s = subprocess.run(
        "ls status| wc -l",
       stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, shell=True)
    return int(s.stdout)

# Identify the oldest file in the 'status' directory
def get_oldest_status_file():
    """Return the path of the oldest file in the 'status' directory."""
    s2 = subprocess.run(
        "find status -type f -printf '%T+ %p\n' | sort | head -1",
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, shell=True)
    temp = s2.stdout.split()
    return temp[1]

# Remove a specified file
def remove_status_file(file_path):
    """Remove the specified file."""
    print("Removed element " + file_path + "! from status files", file=sys.stderr)
    subprocess.run(["/bin/rm", file_path], timeout=15)

# Remove the associated static file for a given status file
def remove_associated_static_file(file_path):
    """Remove the associated static file for a given status file."""
    temp2 = file_path.split('/')
    subprocess.run(["/bin/rm", "static/" + temp2[1], "-rf"], timeout=15)

def is_queue_empty():
    """Return True if the queue list is empty, otherwise return False."""
    return not queuelist

# The main queue manager function
def queue_manager():
    """Main function to manage the queue. Runs indefinitely."""
    while True:
        # An error may occur whenever mutiple files are uploaded and the first condition happens
        if is_queue_empty():
            print('Waiting...')
            if get_status_file_count() >= 50:
                oldest_file = get_oldest_status_file()
                remove_status_file(oldest_file)
                remove_associated_static_file(oldest_file)
            time.sleep(10)
        else:
            serve_next_inline()
# agregar mensajes de error en lista de status



# ================================
def start_background_thread():
    """Lanza el hilo de gestión de cola al iniciar el servidor."""
    print("🔁 Iniciando hilo de gestión de cola...")
    th.Thread(target=queue_manager, daemon=True).start()

# Esto se ejecuta siempre, incluso con Gunicorn
start_background_thread()

# Ruta raíz sirve el index.html del build de React
# Servir archivos estáticos generados por dataProcessing.py (gráficos .html, csv, etc.)
@app.route("/files/<path:filename>")
def serve_static_file(filename):
    return send_from_directory(STATIC_DIR, filename)

@app.route('/files/<codename>')
def list_files_in_dir(codename):
    path = os.path.join(STATIC_DIR, codename)
    if not os.path.isdir(path):
        abort(404)
    return '\n'.join(sorted(os.listdir(path))), 200, {"Content-Type": "text/plain"}
# Servir el frontend de React (build)
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_frontend(path):
    full_path = os.path.join(FRONTEND_DIR, path)
    if path != "" and os.path.exists(full_path):
        return send_from_directory(FRONTEND_DIR, path)
    else:
        return send_from_directory(FRONTEND_DIR, 'index.html')

# Si se ejecuta directamente con python app.py (modo desarrollo)
if __name__ == '__main__':
    app.run(host='0.0.0.0')

