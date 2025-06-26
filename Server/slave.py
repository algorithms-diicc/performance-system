import socket
import json
import subprocess as sub
import time
#from slave_utils import *
import os
import signal
import sys
from utils.logger import log_admin, log_admin_stage



# === CONFIGURACION DE RUTAS ===
BASE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'webapp')
STATIC_DIR = os.path.join(BASE_DIR, 'static')
TEST_DIR = os.path.join(BASE_DIR, 'test')
STATUS_DIR = os.path.join(BASE_DIR, 'status')
RESULTS_DIR = os.path.join(BASE_DIR, 'results')
DEFAULT_TIMEOUT = 2000  # segundos
# Crea los directorios si no existen
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(TEST_DIR, exist_ok=True)
os.makedirs(STATUS_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

HOST = '152.74.52.200'  # The server's hostname or IP address
PORT = 50000       # The port used by the server

def connect_to_server(host, port):
    """Establece conexión con el servidor principal."""
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    while True:
        try:
            print(f"[🌐 Intentando conectar a {host}:{port}]")
            s.connect((host, port))
            print("✅ Connected to the server")
            return s
        except ConnectionRefusedError:
            print('[🕐 Esperando conexión con el servidor]')
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

def write_code_to_file(name_request, code): 
    """Escribe el código recibido en un archivo .cpp dentro de test/ y registra ruta."""
    name = name_request + ".cpp"
    full_path = os.path.join(TEST_DIR, name)

    try:
        with open(full_path, 'w') as f:
            f.write(code)
        print(f"[✔️ write_code_to_file] Código guardado exitosamente en: {full_path}")
    except Exception as e:
        log_admin_stage("FILE_WRITE_ERROR", f"No se pudo escribir {full_path} — {e}")
        print(f"[❌ write_code_to_file] Error al guardar el archivo {full_path}: {e}")
        return None

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
        ], stdout=sub.PIPE, stderr=sub.PIPE, universal_newlines=True, timeout=DEFAULT_TIMEOUT)

        if exec_process.returncode != 0:
            print(f"[❌ Error en ejecución] {exec_process.stderr}")
            return None

        # Solo tomar la primera línea (el nombre del archivo CSV generado)
        output_lines = exec_process.stdout.strip().splitlines()
        csv_filename = output_lines[0] if output_lines else None
        print(f"[📊 Resultado parcial] {csv_filename}")
        return csv_filename

    except sub.TimeoutExpired:
        print("[⏰ Timeout] La ejecución excedió el límite de tiempo")
        return None

def cae_lcs(name, input_size, samples):
    """
    Compila y ejecuta el código para tareas tipo LCS (Text Input).
    Utiliza como entrada el archivo input/english.50MB y genera un .csv con métricas.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(base_dir, "input")
    output_dir = os.path.join(STATIC_DIR, name.split('.')[0])
    os.makedirs(output_dir, exist_ok=True)

    codename = os.path.basename(name).split('.')[0]
    executable = "./a.out"
    input_file = os.path.join(input_dir, "english.50MB")
    csv_output = os.path.join(output_dir, f"{name.split('.')[0]}Results0.csv")


    compile_cmd = f"g++ -O3 {name} -o {executable}"
    exec_cmd = f"bash measurescript4.sh {executable} {input_file} {input_size} {samples} {csv_output}"

    t0 = time.time()
    log_admin_stage("START_COMPILE", f"Compilando {name}")
    print(f"[⚙️ LCS] Compilando {name} ...")

 

    compile_result = sub.run(
        compile_cmd.split(), 
        stdout=sub.PIPE,
        stderr=sub.PIPE,
        universal_newlines=True
    )

    if compile_result.returncode != 0:
        duration = time.time() - t0
        print(f"[❌ Error de compilación] {compile_result.stderr}")
        log_admin_stage("COMPILE_ERROR", compile_result.stderr)
        log_admin("LCS", name, compile_cmd, "N/A", False, False, duration, error_msg=compile_result.stderr, input_val=input_size)
        return {
            "name": codename,
            "error_code": 100
        }



    log_admin_stage("START_EXEC", f"Ejecutando test LCS con input: {input_file}, tamaño: {input_size}, repeticiones: {samples}")
    print(f"[🚀 LCS] Ejecutando script de medición con input {input_file} y {samples} repeticiones por cada incremento")

  
    try:
        exec_result = sub.run(
            exec_cmd.split(), 
            stdout=sub.PIPE,
            stderr=sub.PIPE,
            universal_newlines=True,
            timeout=DEFAULT_TIMEOUT
        )

        if exec_result.returncode != 0:
            print(f"[❌ Error ejecución] {exec_result.stderr}")
            duration = time.time() - t0
            log_admin_stage("EXEC_ERROR", exec_result.stderr)
            log_admin("LCS", name, compile_cmd, exec_cmd, True, False, duration, error_msg=exec_result.stderr, input_val=input_size)
            return {
                "name": codename,
                "error_code": 400  # Error inesperado de ejecución
            }


        if not os.path.exists(csv_output):
            print(f"[❌ Error] No se generó el archivo de resultados: {csv_output}")
            duration = time.time() - t0
            msg = f"No se generó el archivo de resultados: {csv_output}"
            log_admin_stage("CSV_ERROR", msg)
            log_admin("LCS", name, compile_cmd, exec_cmd, True, False, duration, error_msg=msg, input_val=input_size)
            return {
                "name": codename,
                "error_code": 300
            }


        duration = time.time() - t0
        log_admin_stage("EXEC_SUCCESS", f"Resultados guardados en: {csv_output}")
        log_admin("LCS", name, compile_cmd, exec_cmd, True, True, duration, input_val=input_size)
        print(f"[✔️ LCS] Resultados guardados en: {csv_output}")
        log_admin_stage("TEST_DONE", f"Test finalizado para {name}")

    except sub.TimeoutExpired:
        print("[⏰ Timeout] El script LCS excedió el tiempo límite")
        duration = time.time() - t0
        msg = "El script LCS excedió el tiempo límite"
        log_admin_stage("TIMEOUT", msg)
        log_admin("LCS", name, compile_cmd, exec_cmd, True, False, duration, error_msg=msg, input_val=input_size)
        return {
            "name": codename,
            "error_code": 200,  
        }

    except Exception as e:
        duration = time.time() - t0
        log_admin_stage("UNEXPECTED_ERROR", f"Fallo inesperado en cae_lcs: {e}")
        log_admin("LCS", name, compile_cmd, exec_cmd, True, False, duration, error_msg=str(e), input_val=input_size)
        return {
            "name": codename,
            "error_code": 400
        }

    return csv_output



def cae_camm(name, input_size, samples, task):
    """
    Compila y ejecuta el código para tareas tipo CAMM (Numerical Input).
    Utiliza diferentes archivos de entrada según la subvariante (CAMMS, CAMMSO, CAMMR, etc).
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    input_dir = os.path.join(base_dir, "input")
    output_dir = os.path.join(STATIC_DIR, name.split('.')[0])
    os.makedirs(output_dir, exist_ok=True)

    codename = os.path.basename(name).split('.')[0]
    executable = "./a.out"
    csv_output = os.path.join(output_dir, f"{name.split('.')[0]}Results0.csv")

    if task == 'CAMMS':
        input_file = os.path.join(input_dir, "numerical_input_same.txt")
    elif task == 'CAMMSO':
        input_file = os.path.join(input_dir, "numerical_input_semi_sorted.txt")
    else:
        input_file = os.path.join(input_dir, "numerical_input.txt")

    compile_cmd = f"g++ -O3 {name} -o {executable}"
    exec_cmd = f"bash measurescript3.sh {executable} {input_file} {input_size} {samples} {csv_output}"

    t0 = time.time()
    log_admin_stage("START_COMPILE", f"Compilando {name}")

    print(f"[⚙️ CAMM] Compilando {name} ...")
    compile_result = sub.run(
        compile_cmd.split(),
        stdout=sub.PIPE,
        stderr=sub.PIPE,
        universal_newlines=True
    )
    if compile_result.returncode != 0:
        duration = time.time() - t0
        print(f"[❌ Error de compilación] {compile_result.stderr}")
        log_admin_stage("COMPILE_ERROR", compile_result.stderr)
        log_admin("CAMM", name, compile_cmd, "N/A", False, False, duration, error_msg=compile_result.stderr, input_val=input_size)
        return {
            "name": codename,
            "error_code": 100
        }

    log_admin_stage("START_EXEC", f"Ejecutando test CAMM con input: {input_file}, tamaño: {input_size}, repeticiones: {samples}")
    print(f"[🚀 CAMM] Ejecutando script de medición con input {input_file} y {samples} repeticiones por cada incremento")

    try:
        exec_result = sub.run(
            exec_cmd.split(),
            stdout=sub.PIPE,
            stderr=sub.PIPE,
            universal_newlines=True,
            timeout=DEFAULT_TIMEOUT
        )

        if exec_result.returncode != 0:
            print(f"[❌ Error ejecución] {exec_result.stderr}")
            duration = time.time() - t0
            log_admin_stage("EXEC_ERROR", exec_result.stderr)
            log_admin("CAMM", name, compile_cmd, exec_cmd, True, False, duration, error_msg=exec_result.stderr, input_val=input_size)
            return {
                "name": codename,
                "error_code": 400  # Error inesperado de ejecución
            }


        if not os.path.exists(csv_output):
            print(f"[❌ Error] No se generó el archivo de resultados: {csv_output}")
            duration = time.time() - t0
            msg = f"No se generó el archivo de resultados: {csv_output}"
            log_admin_stage("CSV_ERROR", msg)
            log_admin("CAMM", name, compile_cmd, exec_cmd, True, False, duration, error_msg=msg, input_val=input_size)
            return {
                "name": codename,
                "error_code": 300
            }


        print(f"[✔️ CAMM] Resultados guardados en: {csv_output}")
        duration = time.time() - t0
        log_admin_stage("EXEC_SUCCESS", f"Resultados guardados en: {csv_output}")
        log_admin("CAMM", name, compile_cmd, exec_cmd, True, True, duration, input_val=input_size)
        log_admin_stage("TEST_DONE", f"Test finalizado para {name}")

    except sub.TimeoutExpired:
        print("[⏰ Timeout] El script CAMM excedió el tiempo límite")
        duration = time.time() - t0
        msg = "El script CAMM excedió el tiempo límite"
        log_admin_stage("TIMEOUT", msg)
        log_admin("CAMM", name, compile_cmd, exec_cmd, True, False, duration, error_msg=msg, input_val=input_size)
        return {
            "name": codename,
            "error_code": 200,  
        }
    except Exception as e:
        duration = time.time() - t0
        log_admin_stage("UNEXPECTED_ERROR", f"Fallo inesperado en cae_camm: {e}")
        log_admin("CAMM", name, compile_cmd, exec_cmd, True, False, duration, error_msg=str(e), input_val=input_size)
        return {
            "name": codename,
            "error_code": 400
        }

    return csv_output


def cae_size(name, input_size, samples):
    """
    Compila y ejecuta el código para tareas tipo SIZE (Input Size).
    Este test ejecuta el algoritmo pasando como argumento un entero
    y mide el rendimiento utilizando el script measurescript5.sh.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(STATIC_DIR, name.split('.')[0])
    os.makedirs(output_dir, exist_ok=True)

    codename = os.path.basename(name).split('.')[0]
    executable = "./a.out"
    csv_output = os.path.join(output_dir, f"{name.split('.')[0]}Results0.csv")

    compile_cmd = f"g++ -O3 {name} -o {executable}"
    exec_cmd = f"bash measurescript5.sh {executable} {input_size} {samples} {csv_output}"

    t0 = time.time()
    log_admin_stage("START_COMPILE", f"Compilando {name}")

    print(f"[⚙️ SIZE] Compilando {name} ...")
    compile_result = sub.run(
        compile_cmd.split(),
        stdout=sub.PIPE,
        stderr=sub.PIPE,
        universal_newlines=True
    )
    compile_ok = compile_result.returncode == 0

    if not compile_ok:
        duration = time.time() - t0
        print(f"[❌ Error de compilación] {compile_result.stderr}")
        log_admin_stage("COMPILE_ERROR", compile_result.stderr)
        log_admin("SIZE", name, compile_cmd, "N/A", False, False, duration, error_msg=compile_result.stderr, input_val=input_size)
        return {
            "name": codename,
            "error_code": 100
        }

    log_admin_stage("START_EXEC", f"Ejecutando test SIZE con tamaño: {input_size}, repeticiones: {samples}")
    print(f"[🚀 SIZE] Ejecutando script de medición con input size {input_size} y {samples} repeticiones por cada incremento")

    try:
        exec_result = sub.run(
            exec_cmd.split(),
            stdout=sub.PIPE,
            stderr=sub.PIPE,
            universal_newlines=True,
            timeout=DEFAULT_TIMEOUT
        )

        exec_ok = exec_result.returncode == 0
        if not exec_ok:
            print(f"[❌ Error ejecución] {exec_result.stderr}")
            duration = time.time() - t0
            log_admin_stage("EXEC_ERROR", exec_result.stderr)
            log_admin("SIZE", name, compile_cmd, exec_cmd, True, False, duration, error_msg=exec_result.stderr, input_val=input_size)
            return {
                "name": codename,
                "error_code": 400  # Error inesperado de ejecución
            }
        if not os.path.exists(csv_output):
            print(f"[❌ Error] No se generó el archivo de resultados: {csv_output}")
            duration = time.time() - t0
            msg = f"No se generó el archivo de resultados: {csv_output}"
            log_admin_stage("CSV_ERROR", msg)
            log_admin("SIZE", name, compile_cmd, exec_cmd, True, False, duration, error_msg=msg, input_val=input_size)
            return {
                "name": codename,
                "error_code": 300
            }

        duration = time.time() - t0
        log_admin_stage("EXEC_SUCCESS", f"Resultados guardados en: {csv_output}")
        log_admin("SIZE", name, compile_cmd, exec_cmd, True, True, duration, input_val=input_size)
        print(f"[✔️ SIZE] Resultados guardados en: {csv_output}")
        log_admin_stage("TEST_DONE", f"Test finalizado para {name}")

    except sub.TimeoutExpired:
        print("[⏰ Timeout] El script SIZE excedió el tiempo límite")
        duration = time.time() - t0
        msg = "El script SIZE excedió el tiempo límite"
        log_admin_stage("TIMEOUT", msg)
        log_admin("SIZE", name, compile_cmd, exec_cmd, True, False, duration, error_msg=msg, input_val=input_size)
        return {
            "name": codename,
            "error_code": 200,  
        }

    except Exception as e:
        duration = time.time() - t0
        log_admin_stage("UNEXPECTED_ERROR", f"Fallo inesperado en cae_size: {e}")
        log_admin("SIZE", name, compile_cmd, exec_cmd, True, False, duration, error_msg=str(e), input_val=input_size)
        return {
            "name": codename,
            "error_code": 400
        }

    return csv_output

def send_results(host, port2, name_request, result_name):
    """
    Envía el archivo de resultados generado (.csv) al servidor maestro a través de un socket.
    host: IP del servidor que escucha los resultados (normalmente 127.0.0.1).
    port: puerto 60000 donde el servidor recibe los resultados.
    name_request: nombre base del archivo (sin extensión).
    result_name: ruta completa al archivo .csv con los resultados a enviar.
    """
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s2:
            s2.connect((host, port2))
            print(f"[📤 Enviando resultados] Archivo: {result_name} => {host}:{port2}")
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

    except FileNotFoundError:
        log_admin_stage("RESULT_SEND_ERROR", f"No se encontró el archivo de resultados: {result_name}")
        print(f"[❌ Error al enviar resultados] Archivo no encontrado: {result_name}")
    except Exception as e:
        log_admin_stage("RESULT_SEND_ERROR", f"Error al enviar resultados a {host}:{port2} — {e}")
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
        log_admin_stage("CLEANUP_ERROR", f"No se pudieron eliminar archivos: {', '.join(files)} — {e}")
        print(f"[❌ Cleanup error] No se pudieron eliminar archivos: {e}")

def wait_until_recent_in_queue():
    """
    Espera hasta detectar al menos un archivo en el servidor con:
    - Contenido igual a 'IN QUEUE'
    - Modificado en los últimos 5 minutos

    Esto evita conectar cuando hay archivos viejos o tareas ya procesadas.
    """
    print("[⏳ Esperando tareas recientes con estado IN QUEUE...]")
    while True:
        try:
            cmd = [
                "ssh", "jose@performance.inf.udec.cl",
                "find /home/jose/performance-system/Server/status -type f -mmin -5 -exec grep -l 'IN QUEUE' {} +"
            ]
            result = sub.run(cmd, stdout=sub.PIPE, stderr=sub.PIPE)
            output = result.stdout.decode().strip()

            if output:
                print("[✔️ Tarea IN QUEUE reciente detectada. Conectando al servidor...]")
                break
            else:
                print("[🔁 Nada nuevo. Revisando de nuevo en 10 segundos...]")
        except Exception as e:
            log_admin_stage("QUEUE_MONITOR_ERROR", f"Error verificando IN QUEUE recientes: {e}")
            print(f"[⚠️ Error verificando IN QUEUE recientes]: {e}")
        time.sleep(10)

def enviar_json_error(codename, code, message):
    error_payload = {
        "name": codename,
        "error": True,
        "error_code": code,
        "message": message
    }    
def send_json_result(host, port, error_dict):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.connect((host, port))
            s.sendall(json.dumps(error_dict).encode())
            print(f"[❌ JSON error enviado] {error_dict}")
    except Exception as e:
        print(f"[❌ ERROR al enviar JSON de error] {e}")

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
        payload_dict = None
        filename = None
        result_name = None
        task_type = None
        wait_until_recent_in_queue()

        with connect_to_server(HOST, PORT) as s:
            try:
                payload_dict = receive_payload(s)
            except json.JSONDecodeError as e:
                log_admin_stage("JSON_ERROR", f"Payload inválido recibido desde {HOST}:{PORT} — {e}")
                print(f"[❌ ERROR] Payload JSON inválido recibido: {e}")
                continue
            except Exception as e:
                log_admin_stage("UNEXPECTED_ERROR", f"Error inesperado al recibir payload: {e}")
                print(f"[❌ ERROR inesperado] {e}")
                continue

        print(f"[📦 Payload recibido]\n{json.dumps(payload_dict, indent=2)}")
        print(f"[🔧 Configuración] Timeout por defecto: {DEFAULT_TIMEOUT} segundos")

        # Guardar código en archivo local
        filename = write_code_to_file(payload_dict["name"], payload_dict["code"])
        if filename is None:
            log_admin_stage("FATAL_WRITE_ERROR", f"No se pudo guardar el archivo para {payload_dict['name']}")
            print(f"[❌ ABORTADO] No se pudo guardar el archivo, se omite test.")
            continue

        print(f"DEBUG filename: '{filename}'")

        input_size = payload_dict.get("input_size", 10000)  # Valor por defecto: 10000
        samples = payload_dict.get("samples", "30")
        result_name = None
        task_type = "UNKNOWN"

        # Determinar tipo de test según nombre del archivo (uno solo se ejecuta)
        if "LCS" in payload_dict["name"]:
            print(f"[🧩 Test detectado: LCS] Ejecutando cae_lcs")
            task_type = "LCS"
            result_name = cae_lcs(filename, input_size, samples)

        elif "SIZE" in payload_dict["name"]:
            print(f"[🧩 Test detectado: SIZE] Ejecutando cae_size")
            task_type = "SIZE"
            result_name = cae_size(filename, input_size, samples)

        elif "CAMM" in payload_dict["name"]:
            print(f"[🧩 Test detectado: CAMM] Ejecutando cae_camm")
            task_type = "CAMM"
            result_name = cae_camm(filename, input_size, samples, payload_dict["name"])

        else:
            print(f"[⚠️ Test no identificado en nombre: {payload_dict['name']}] Se omite ejecución.")
            log_admin_stage("UNKNOWN_TEST_TYPE", f"Archivo recibido sin tipo identificable: {payload_dict['name']}")
            continue

        # Eliminar archivos temporales: fuente .cpp y ejecutable
        filename = filename.replace(" ", "")
        cleanup_files(filename, 'a.out')


        if isinstance(result_name, dict) and "error_code" in result_name:
            send_json_result(HOST, 60000, result_name)  # nueva función simple
        elif result_name:
            send_results(HOST, 60000, payload_dict["name"], result_name)
            cleanup_files(result_name)
            print(f"[✅ Resultado final enviado para {payload_dict['name']}]\n")
        else:
            log_admin_stage("RESULT_NOT_GENERATED", f"No se generaron resultados para {payload_dict['name']}")
            print(f"[❌ No se generaron resultados para {payload_dict['name']}]\n")

        time.sleep(10)



def handle_sigint(signal_num, frame):
    log_admin_stage("INTERRUPT", "Ejecución detenida manualmente con Ctrl+C")
    print("\n[⛔ Interrumpido por el usuario]")
    sys.exit(0)

signal.signal(signal.SIGINT, handle_sigint)


if __name__ == "__main__":
    main()

