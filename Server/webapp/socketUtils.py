from flask import Flask, request, render_template, abort, url_for, redirect, make_response, jsonify
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

# === 📁 RUTAS ABSOLUTAS SEGURAS ===
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # carpeta Server/
STATUS_DIR = os.path.join(BASE_DIR, "status")
STATIC_DIR = os.path.join(BASE_DIR, "webapp", "static")

# Crear directorios si no existen
os.makedirs(STATUS_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

# === 🧠 Diccionario de códigos de error
ERROR_MESSAGES = {
    100: "❌ Error de compilación del archivo recibido. Por favor, revise su código fuente.",
    200: "⏰ El algoritmo superó el tiempo límite de ejecución.",
    300: "📂 El archivo CSV no se generó correctamente.",
    400: "⚠️ Error inesperado durante la ejecución del test.",
}

# === 🔁 ESTADO GLOBAL ===
activeS = 0  # medidores activos

# === 🚀 FUNCIONES ===


def send_manager(s, json_string, name):
    global activeS
    firsttime = True
    s.settimeout(20.0)
    counter = 0
    while True:
        try:
            conn, addr = s.accept()
            th.Thread(target=send_program, args=(conn, json_string), daemon=True).start()
            counter += 1
        except socket.timeout:
            if counter == 0:
                print("No measure machines available!", file=sys.stderr)
                status_path = os.path.join(STATUS_DIR, name)
                with open(status_path, 'r+') as w:
                    w.seek(0)
                    w.write('ERROR: no machines available')
                    w.truncate()
            break
        if firsttime:
            firsttime = False
            s.settimeout(5.0)
    activeS = counter

def send_program(conn, json_string):
    with conn:
        conn.sendall(json_string.encode())

def recv_manager(s, name):
    global activeR
    counter = 0
    firsttime = True
    s.settimeout(1000.0)
    while True:
        try:
            conn, addr = s.accept()
            th.Thread(target=receive_data, args=(conn, counter,), daemon=True).start()
            counter += 1
        except socket.timeout:
            if counter == 0:
                print("No measure machines available!", file=sys.stderr)
                status_path = os.path.join(STATUS_DIR, name)
                with open(status_path, 'r+') as w:
                    w.seek(0)
                    w.write('ERROR: no machines available')
                    w.truncate()
            break
        if firsttime:
            firsttime = False
            s.settimeout(5.0)
    activeR = counter

def receive_data(conn, ident):
    with conn:
        #print(conn)
        payload = b''
        while True:
            data = conn.recv(1024)
            #print(data)
            if not data:
                break
            payload += data

        if not payload:
            print("Received empty payload, skipping JSON decoding.")
            return

        try:
            payloadDict = json.loads(payload.decode())
        except Exception as e:
            print(f"❌ Error al decodificar JSON: {e}")
            return
        
        filename = payloadDict.get("name", "unnamed")
        codename = filename.replace("Results", "")
        if "results" in payloadDict:
            # ✅ Es un CSV
            escribir_estado(codename, "✅ Test ejecutado correctamente. Resultados CSV recibidos.")
            escribir_estado(codename, "📊 Generando gráficos...")
            filename_csv = filename + str(ident) + ".csv"
            result_path = os.path.join(STATIC_DIR, filename_csv)
            with open(result_path, 'w') as f:
                f.write(payloadDict["results"])
            print(f"[{ident}] ✅ Resultado CSV guardado en: {result_path}")

        #filename = payloadDict["name"] + str(ident) + ".csv"
        #result_path = os.path.join(STATIC_DIR, filename)
        elif "error_code" in payloadDict:
            # ❗ Es un JSON de error
            code = payloadDict["error_code"]
            translated_msg = ERROR_MESSAGES.get(code, "❓ Error desconocido")

            # Agregar al archivo de estado (frontend lo leerá)
            escribir_estado(filename, translated_msg)

            # Guardar el JSON de error interpretado
            #status_error = {
                #"name": filename,
               # "status": "ERROR",
              #  "error_code": code,
             #   "message": translated_msg
            #}

           # escribir_estado(filename, translated_msg, tipo="ERROR", error_code=code)
            print(f"[{ident}] ⚠️ Error recibido: {translated_msg} | Guardado en {STATIC_DIR}")

def escribir_estado(codename, msg, tipo="INFO", error_code=None):
    """
    Registra un mensaje en el archivo <codename>_status.json dentro de STATIC_DIR.
    Si el tipo es ERROR, se incluye 'status': 'ERROR' y 'error_code'.
    """
    path = os.path.join(STATIC_DIR, f"{codename}_status.json")
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Si el archivo ya existe, lo cargamos
    if os.path.exists(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except Exception:
            data = {}
    else:
        data = {}

    # Asegurar que exista el arreglo de mensajes
    if "messages" not in data:
        data["messages"] = []

    # Agregar el nuevo mensaje
    data["messages"].append({
        "time": timestamp,
        "msg": msg
    })

    # Si es error, se marca como tal
    if tipo == "ERROR":
        data["status"] = "ERROR"
        data["error_code"] = error_code

    # Guardar el archivo actualizado
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

        
def slave_serve(file_dir, name, cmd, input_size, samples):
    port = 50000
    port2 = 60000
    host = '152.74.52.200'
    print(file_dir, name, cmd)

    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s2 = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    while True:
        try:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s2.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            s.bind((host, port))
            s2.bind((host, port2))
            s.listen(5)
            s2.listen(5)

            with open(file_dir, 'r') as f:
                code = f.read()
            task_suffix = ''
            for possible in ['LCS', 'CAMM', 'CAMMR', 'CAMMS', 'CAMMSO', 'SIZE']:
                if name.endswith(possible):
                    task_suffix = possible
                    break
            m = {"name": name, "cmd": cmd, "code": code, "input_size": input_size, "samples": samples}
            escribir_estado(name, "📨 Archivo recibido correctamente.")
            escribir_estado(name, f"🚚 Enviando test al slave con tipo: {task_suffix}, input_size: {input_size}, repeticiones: {samples}.")
            print('m: ', m)
            json_string = json.dumps(m)
            print('json_string: ', json_string)

            sendmng = th.Thread(target=send_manager, args=(s, json_string, name,), daemon=True)
            sendmng.start()

            recvmng = th.Thread(target=recv_manager, args=(s2, name,), daemon=True)
            recvmng.start()

            sendmng.join()
            print("Socket 1 disconnected!")
            recvmng.join()
            print("Socket 2 disconnected!")

            s.close()
            s2.close()
            break
        except OSError:
            time.sleep(1)

def security_check():
    pass

