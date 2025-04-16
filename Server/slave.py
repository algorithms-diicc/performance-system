import socket
import json
import subprocess as sub
import time
#from slave_utils import *
import os

# Define rutas absolutas para las carpetas específicas
BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'webapp')
STATIC_DIR = os.path.join(BASE_DIR, 'static')
TEST_DIR = os.path.join(BASE_DIR, 'test')
STATUS_DIR = os.path.join(BASE_DIR, 'status')
RESULTS_DIR = os.path.join(BASE_DIR, 'results')

# Crea los directorios si no existen
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(TEST_DIR, exist_ok=True)
os.makedirs(STATUS_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

HOST = '127.0.0.1'  # The server's hostname or IP address
PORT = 50000       # The port used by the server

def connect_to_server(host, port):
    """Establish connection to a server."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    while True:
        try:
            s.connect((host, port))
            print("Connected to the server")
            return s
        except ConnectionRefusedError:
            print('Waiting for connection')
            time.sleep(5)

def receive_payload(s):
    """Receive and decode payload from the server."""
    payload = b''
    while True:
        try:
            data = s.recv(1024)
            if not data:
                break
            payload += data
        except ConnectionResetError:
            break
    return json.loads(payload.decode())

def write_code_to_file(name_request, code):
    """Write received code to a .cpp file."""
    name = name_request + ".cpp"
    with open(name, 'w') as f:
        f.write(code)
    return name


def compile_and_execute(name):
    """Compile and execute the code."""
    sub.run(["g++", name], universal_newlines=True)
    try:
        aux = sub.run(["bash", "measurescript2.sh", "./a.out"], stdout=sub.PIPE, stderr=sub.PIPE, universal_newlines=True, timeout=3000)
    except sub.TimeoutExpired:
        return ""
    return aux.stdout.strip()

def cae_lcs(name, input_size):
    """Compila y ejecuta el código para tareas LCS."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(base_dir, "input")
    output_dir = os.path.join(STATIC_DIR, name.split('.')[0])  # Elimina la extensión .cpp
    os.makedirs(output_dir, exist_ok=True)

    executable = "./a.out"
    input_file = os.path.join(input_dir, "english.50MB")
    csv_output = os.path.join(output_dir, f"{name.split('.')[0]}Results0.csv")

    # Compilar el código
    compile_result = sub.run(
        ["g++", "-O3", name, "-o", executable],
        stdout=sub.PIPE,
        stderr=sub.PIPE,
        universal_newlines=True  # Cambiado de `text=True` a `universal_newlines=True`
    )
    if compile_result.returncode != 0:
        print(f"Error de compilación: {compile_result.stderr}")
        return None

    # Ejecutar el script
    try:
        exec_result = sub.run(
            ["bash", "measurescript4.sh", executable, input_file, str(input_size), csv_output],
            stdout=sub.PIPE,
            stderr=sub.PIPE,
            universal_newlines=True,  # Cambiado de `text=True` a `universal_newlines=True`
            timeout=300
        )
        if exec_result.returncode != 0:
            print(f"Error al ejecutar el script: {exec_result.stderr}")
            return None

        # Verificar si se generó el archivo esperado
        if not os.path.exists(csv_output):
            print(f"Error: No se generó el archivo de resultados: {csv_output}")
            return None
    except sub.TimeoutExpired:
        print("Error: Timeout al ejecutar el script.")
        return None

    return csv_output




def cae_camm(name, input_size, task):
    """Compila y ejecuta el código para tareas CAMM (Numerical Input)."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(base_dir, "input")
    output_dir = os.path.join(STATIC_DIR, name.split('.')[0])
    os.makedirs(output_dir, exist_ok=True)

    executable = "./a.out"
    csv_output = os.path.join(output_dir, f"{name.split('.')[0]}Results0.csv")

    # Selección del archivo de input numérico
    if task == 'CAMMS':
        input_file = os.path.join(input_dir, "numerical_input_same.txt")
    elif task == 'CAMMSO':
        input_file = os.path.join(input_dir, "numerical_input_semi_sorted.txt")
    else:
        input_file = os.path.join(input_dir, "numerical_input.txt")

    # Compilar el código
    compile_result = sub.run(
        ["g++", "-O3", name, "-o", executable],
        stdout=sub.PIPE,
        stderr=sub.PIPE,
        universal_newlines=True
    )
    if compile_result.returncode != 0:
        print(f"Error de compilación: {compile_result.stderr}")
        return None

    # Ejecutar el script de medición
    try:
        exec_result = sub.run(
            ["bash", "measurescript3.sh", executable, input_file, str(input_size), csv_output],
            stdout=sub.PIPE,
            stderr=sub.PIPE,
            universal_newlines=True,
            timeout=300
        )
        if exec_result.returncode != 0:
            print(f"Error al ejecutar el script: {exec_result.stderr}")
            return None

        if not os.path.exists(csv_output):
            print(f"Error: No se generó el archivo de resultados: {csv_output}")
            return None
    except sub.TimeoutExpired:
        print("Error: Timeout al ejecutar el script.")
        return None

    return csv_output


def cae_size(name, input_size):
    """Compila y ejecuta el código para tareas SIZE (Input Size)."""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(STATIC_DIR, name.split('.')[0])
    os.makedirs(output_dir, exist_ok=True)

    executable = "./a.out"
    csv_output = os.path.join(output_dir, f"{name.split('.')[0]}Results0.csv")

    # Compilar
    compile_result = sub.run(
        ["g++", "-O3", name, "-o", executable],
        stdout=sub.PIPE,
        stderr=sub.PIPE,
        universal_newlines=True
    )
    if compile_result.returncode != 0:
        print(f"Error de compilación: {compile_result.stderr}")
        return None

    # Ejecutar el script de medición
    try:
        exec_result = sub.run(
            ["bash", "measurescript5.sh", executable, str(input_size), csv_output],
            stdout=sub.PIPE,
            stderr=sub.PIPE,
            universal_newlines=True,
            timeout=300
        )
        if exec_result.returncode != 0:
            print(f"Error al ejecutar el script: {exec_result.stderr}")
            return None

        if not os.path.exists(csv_output):
            print(f"Error: No se generó el archivo de resultados: {csv_output}")
            return None
    except sub.TimeoutExpired:
        print("Error: Timeout al ejecutar el script.")
        return None

    return csv_output

    # Guardar el resultado en el directorio de resultados
    #result_file = os.path.join(RESULTS_DIR, "resultsEnergy.csv")
    #with open(result_file, 'w') as f:
    #    f.write(aux.stdout.strip())
    #return result_file

def send_results(host, port, name_request, result_name):
    """Send the results to the server."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s2:
        s2.connect((host, port))
        print("Nombre del archivo de resultados send:", result_name)
        with open(result_name, 'r') as f:
            results = f.read()
        payload = {"name": name_request + "Results", "results": results}
        s2.sendall(json.dumps(payload).encode())


def cleanup_files(*files):
    """Remove specified files."""
    sub.run(["rm"] + list(files), timeout=15)

    

def main():
    while True:
        # Conexión con el servidor y recepción del payload
        with connect_to_server(HOST, PORT) as s:
            payload_dict = receive_payload(s)
        
        print(f"Payload recibido: {json.dumps(payload_dict, indent=2)}")
        
        # Escribe el código recibido en un archivo local
        filename = write_code_to_file(payload_dict["name"], payload_dict["code"])
        input_size = payload_dict.get("input_size", 10000)  # Tamaño de entrada por defecto
        result_name = None

        # Lógica para seleccionar el script correcto
        if "LCS" in payload_dict["name"]:
            print(f"Tarea LCS detectada: {payload_dict['name']}")
            result_name = cae_lcs(filename, input_size)

        elif "SIZE" in payload_dict["name"]:
            print(f"Tarea SIZE detectada: {payload_dict['name']}")
            result_name = cae_size(filename, input_size)

        elif "CAMM" in payload_dict["name"]:
            print(f"Tarea CAMM detectada: {payload_dict['name']}")
            result_name = cae_camm(filename, input_size, payload_dict["name"])

        else:
            print(f"Tarea predeterminada detectada: {payload_dict['name']}")
            result_name = compile_and_execute(filename)

        # Limpieza de archivos generados
        cleanup_files(filename, 'a.out')

        # Envía los resultados si están disponibles
        if result_name:
            send_results(HOST, 60000, payload_dict["name"], result_name)
            cleanup_files(result_name)
            print(f"Resultados enviados para {payload_dict['name']}")
        else:
            print(f"No se generaron resultados para {payload_dict['name']}")

        time.sleep(10)

if __name__ == "__main__":
    main()

