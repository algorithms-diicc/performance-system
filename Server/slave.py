import socket
import json
import subprocess as sub
import time
#from slave_utils import *
import os

# === CONFIGURACION DE RUTAS ===
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
    """Establece conexión con el servidor principal."""
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
    """Recibe datos JSON desde el servidor."""
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

def write_code_to_file(name_request, code): ##revisar, no se genera el archivo compilado en la carpeta server, por ende no se compila y falla el script
    """Escribe el código recibido en un archivo .cpp dentro de test/ y registra ruta."""
    name = name_request + ".cpp"
    full_path = os.path.join(TEST_DIR, name)

    try:
        with open(full_path, 'w') as f:
            f.write(code)
        print(f"[✔️ write_code_to_file] Código guardado exitosamente en: {full_path}")
    except Exception as e:
        print(f"[❌ write_code_to_file] Error al guardar el archivo {full_path}: {e}")

    return full_path


def compile_and_execute(name):
    """
    Compila y ejecuta el código fuente con un test simple (tipo none).
    Se usa para pruebas generales sin input externo.
    """
    print(f"[⚙️ Compilación] Iniciando compilación de: {name}")
    compile_process = sub.run(["g++", name], stdout=sub.PIPE, stderr=sub.PIPE, universal_newlines=True)

    if compile_process.returncode != 0:
        print(f"[❌ Error de compilación] {compile_process.stderr}")
        return None

    print(f"[✔️ Compilación exitosa] Ejecutando ./a.out con script measurescript2.sh")
    try:
        exec_process = sub.run([
            "bash", "measurescript2.sh", "./a.out"
        ], stdout=sub.PIPE, stderr=sub.PIPE, universal_newlines=True, timeout=300)

        if exec_process.returncode != 0:
            print(f"[❌ Error en ejecución] {exec_process.stderr}")
            return None

        print(f"[📊 Resultado parcial] {exec_process.stdout[:200]}... (recortado)\n")
        return exec_process.stdout.strip()

    except sub.TimeoutExpired:
        print("[⏰ Timeout] La ejecución excedió el límite de tiempo")
        return None

def cae_lcs(name, input_size):
    """
    Compila y ejecuta el código para tareas tipo LCS (Text Input).
    Utiliza como entrada el archivo input/english.50MB y genera un .csv con métricas.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(base_dir, "input")
    output_dir = os.path.join(STATIC_DIR, name.split('.')[0])
    os.makedirs(output_dir, exist_ok=True)

    executable = "./a.out"
    input_file = os.path.join(input_dir, "english.50MB")
    csv_output = os.path.join(output_dir, f"{name.split('.')[0]}Results0.csv")

    print(f"[⚙️ LCS] Compilando {name} ...")
    compile_result = sub.run(
        ["g++", "-O3", name, "-o", executable],
        stdout=sub.PIPE,
        stderr=sub.PIPE,
        universal_newlines=True
    )
    if compile_result.returncode != 0:
        print(f"[❌ Error de compilación] {compile_result.stderr}")
        return None

    print(f"[🚀 LCS] Ejecutando script de medición con input {input_file}")
    try:
        exec_result = sub.run(
            ["bash", "measurescript4.sh", executable, input_file, str(input_size), csv_output],
            stdout=sub.PIPE,
            stderr=sub.PIPE,
            universal_newlines=True,
            timeout=300
        )
        if exec_result.returncode != 0:
            print(f"[❌ Error ejecución] {exec_result.stderr}")
            return None

        if not os.path.exists(csv_output):
            print(f"[❌ Error] No se generó el archivo de resultados: {csv_output}")
            return None

        print(f"[✔️ LCS] Resultados guardados en: {csv_output}")
    except sub.TimeoutExpired:
        print("[⏰ Timeout] El script LCS excedió el tiempo límite")
        return None

    return csv_output



def cae_camm(name, input_size, task):
    """
    Compila y ejecuta el código para tareas tipo CAMM (Numerical Input).
    Utiliza diferentes archivos de entrada según la subvariante (CAMMS, CAMMSO, CAMMR, etc).
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(base_dir, "input")
    output_dir = os.path.join(STATIC_DIR, name.split('.')[0])
    os.makedirs(output_dir, exist_ok=True)

    executable = "./a.out"
    csv_output = os.path.join(output_dir, f"{name.split('.')[0]}Results0.csv")

    if task == 'CAMMS':
        input_file = os.path.join(input_dir, "numerical_input_same.txt")
    elif task == 'CAMMSO':
        input_file = os.path.join(input_dir, "numerical_input_semi_sorted.txt")
    else:
        input_file = os.path.join(input_dir, "numerical_input.txt")

    print(f"[⚙️ CAMM] Compilando {name} ...")
    compile_result = sub.run(
        ["g++", "-O3", name, "-o", executable],
        stdout=sub.PIPE,
        stderr=sub.PIPE,
        universal_newlines=True
    )
    if compile_result.returncode != 0:
        print(f"[❌ Error de compilación] {compile_result.stderr}")
        return None

    print(f"[🚀 CAMM] Ejecutando script de medición con input {input_file}")
    try:
        exec_result = sub.run(
            ["bash", "measurescript3.sh", executable, input_file, str(input_size), csv_output],
            stdout=sub.PIPE,
            stderr=sub.PIPE,
            universal_newlines=True,
            timeout=300
        )
        if exec_result.returncode != 0:
            print(f"[❌ Error ejecución] {exec_result.stderr}")
            return None

        if not os.path.exists(csv_output):
            print(f"[❌ Error] No se generó el archivo de resultados: {csv_output}")
            return None

        print(f"[✔️ CAMM] Resultados guardados en: {csv_output}")
    except sub.TimeoutExpired:
        print("[⏰ Timeout] El script CAMM excedió el tiempo límite")
        return None

    return csv_output


def cae_size(name, input_size):
    """
    Compila y ejecuta el código para tareas tipo SIZE (Input Size).
    Este test ejecuta el algoritmo pasando como argumento un entero
    y mide el rendimiento utilizando el script measurescript5.sh.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(STATIC_DIR, name.split('.')[0])
    os.makedirs(output_dir, exist_ok=True)

    executable = "./a.out"
    csv_output = os.path.join(output_dir, f"{name.split('.')[0]}Results0.csv")

    print(f"[⚙️ SIZE] Compilando {name} ...")
    compile_result = sub.run(
        ["g++", "-O3", name, "-o", executable],
        stdout=sub.PIPE,
        stderr=sub.PIPE,
        universal_newlines=True
    )
    if compile_result.returncode != 0:
        print(f"[❌ Error de compilación] {compile_result.stderr}")
        return None

    print(f"[🚀 SIZE] Ejecutando script de medición con input size {input_size}")
    try:
        exec_result = sub.run(
            ["bash", "measurescript5.sh", executable, str(input_size), csv_output],
            stdout=sub.PIPE,
            stderr=sub.PIPE,
            universal_newlines=True,
            timeout=300
        )
        if exec_result.returncode != 0:
            print(f"[❌ Error ejecución] {exec_result.stderr}")
            return None

        if not os.path.exists(csv_output):
            print(f"[❌ Error] No se generó el archivo de resultados: {csv_output}")
            return None

        print(f"[✔️ SIZE] Resultados guardados en: {csv_output}")
    except sub.TimeoutExpired:
        print("[⏰ Timeout] El script SIZE excedió el tiempo límite")
        return None

    return csv_output


    # Guardar el resultado en el directorio de resultados
    #result_file = os.path.join(RESULTS_DIR, "resultsEnergy.csv")
    #with open(result_file, 'w') as f:
    #    f.write(aux.stdout.strip())
    #return result_file

def send_results(host, port, name_request, result_name):
    """
    Envía el archivo de resultados generado (.csv) al servidor maestro a través de un socket.
    host: IP del servidor que escucha los resultados (normalmente 127.0.0.1).
    port: puerto 60000 donde el servidor recibe los resultados.
    name_request: nombre base del archivo (sin extensión).
    result_name: ruta completa al archivo .csv con los resultados a enviar.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s2:
            s2.connect((host, port))
            print(f"[📤 Enviando resultados] Archivo: {result_name} => {host}:{port}")
            with open(result_name, 'r') as f:
                results = f.read()

            # Construimos el payload en formato JSON
            payload = {
                "name": name_request + "Results",
                "results": results
            }

            # Enviamos el contenido serializado
            s2.sendall(json.dumps(payload).encode())
            print("[✔️ Resultados enviados correctamente]")

    except Exception as e:
        print(f"[❌ Error al enviar resultados] {e}")


def cleanup_files(*files):
    """
    Elimina archivos especificados después de la ejecución del test.
    Este paso es útil para liberar espacio y evitar acumulación de archivos temporales.

    Parámetros:
    *files -- Lista de archivos a eliminar (ej. .cpp, .out, .csv)
    """
    print(f"[🧹 Cleanup] Eliminando archivos: {', '.join(files)}")
    try:
        sub.run(["rm"] + list(files), timeout=15)
        print("[✔️ Cleanup] Archivos eliminados correctamente")
    except Exception as e:
        print(f"[❌ Cleanup error] No se pudieron eliminar archivos: {e}")


    

# === FUNCION PRINCIPAL DE EJECUCION ===
def main():
    """
    Ciclo principal del Slave.
    - Se conecta al servidor maestro.
    - Recibe el payload con nombre, código, input_size y tipo de tarea.
    - Compila y ejecuta según el tipo de test.
    - Envía los resultados y elimina archivos temporales.
    """
    while True:
        with connect_to_server(HOST, PORT) as s:
            payload_dict = receive_payload(s)

        print(f"[📦 Payload recibido]\n{json.dumps(payload_dict, indent=2)}")

        # Guardar código en archivo local
        filename = write_code_to_file(payload_dict["name"], payload_dict["code"])
        input_size = payload_dict.get("input_size", 10000)  # Valor por defecto: 10000
        result_name = None

        # Determinar tipo de test según nombre del archivo
        if "LCS" in payload_dict["name"]:
            print(f"[🧩 Test detectado: LCS] Ejecutando cae_lcs")
            result_name = cae_lcs(filename, input_size)

        elif "SIZE" in payload_dict["name"]:
            print(f"[🧩 Test detectado: SIZE] Ejecutando cae_size")
            result_name = cae_size(filename, input_size)

        elif "CAMM" in payload_dict["name"]:
            print(f"[🧩 Test detectado: CAMM] Ejecutando cae_camm")
            result_name = cae_camm(filename, input_size, payload_dict["name"])

        else:
            print(f"[🧩 Test detectado: NONE] Ejecutando test por defecto")
            result_name = compile_and_execute(filename)

        # Eliminar archivos temporales: fuente .cpp y ejecutable
        cleanup_files(filename, 'a.out')

        # Si hay resultados, los enviamos y eliminamos
        if result_name:
            send_results(HOST, 60000, payload_dict["name"], result_name)
            cleanup_files(result_name)
            print(f"[✅ Resultado final enviado para {payload_dict['name']}]\n")
        else:
            print(f"[❌ No se generaron resultados para {payload_dict['name']}]\n")

        time.sleep(10)


if __name__ == "__main__":
    main()

