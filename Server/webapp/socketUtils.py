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

# === 📁 RUTAS ABSOLUTAS SEGURAS ===
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # carpeta Server/
STATUS_DIR = os.path.join(BASE_DIR, "status")
STATIC_DIR = os.path.join(BASE_DIR, "webapp", "static")

# Crear directorios si no existen
os.makedirs(STATUS_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

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
        print(conn)
        payload = b''
        while True:
            data = conn.recv(1024)
            print(data)
            if not data:
                break
            payload += data

        if not payload:
            print("Received empty payload, skipping JSON decoding.")
            return

        payloadDict = json.loads(payload.decode())
        filename = payloadDict["name"] + str(ident) + ".csv"
        result_path = os.path.join(STATIC_DIR, filename)

        with open(result_path, 'w') as f:
            f.write(payloadDict["results"])
        print(f"[{ident}] Resultado guardado en: {result_path}")

def slave_serve(file_dir, name, cmd, input_size):
    port = 50000
    port2 = 60000
    host = '127.0.0.1'
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

            m = {"name": name, "cmd": cmd, "code": code, "input_size": input_size}
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
