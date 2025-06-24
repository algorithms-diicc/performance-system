import os
from datetime import datetime
import platform

# === 📁 Ruta del log administrativo
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOG_DIR = os.path.join(BASE_DIR, "logs")
LOG_PATH = os.path.join(LOG_DIR, "log_admin.txt")

# Crear carpeta de logs si no existe
os.makedirs(LOG_DIR, exist_ok=True)

# === 📝 Función principal: Logging de ejecución completa
def log_admin(test_type, filename, compile_cmd, exec_cmd, compile_ok, exec_ok, duration, error_msg=None, input_val=None):
    """
    Registra en un log administrativo todos los comandos ejecutados por test completo.
    Incluye los argumentos del script si están disponibles.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    slave = platform.node()

    log_line = f"[{now}] [{test_type}] archivo: {filename} | g++: {'OK' if compile_ok else 'FAIL'} | exec: {'OK' if exec_ok else 'FAIL'} | duración: {duration:.2f}s | slave: {slave}"

    if input_val:
        log_line += f" | input: {input_val}"
    if error_msg:
        log_line += f" | error: {error_msg.strip()}"

    log_line += "\n→ [COMPILE] " + compile_cmd
    log_line += "\n→ [EXECUTE] " + exec_cmd

    # Extra: desglosar argumentos si es posible
    parts = exec_cmd.split()

    if "measurescript4.sh" in exec_cmd or "measurescript3.sh" in exec_cmd:
        if len(parts) >= 7:
            # bash script.sh exec input size samples csv
            log_line += f"\n→ [ARGS] EXEC={parts[2]} | INPUT={parts[3]} | SIZE={parts[4]} | SAMPLES={parts[5]} | CSV={parts[6]}"
    elif "measurescript5.sh" in exec_cmd:
        if len(parts) >= 6:
            # bash script.sh exec size samples csv
            log_line += f"\n→ [ARGS] EXEC={parts[2]} | SIZE={parts[3]} | SAMPLES={parts[4]} | CSV={parts[5]}"
    else:
        log_line += "\n→ [ARGS] [No identificados o script especial]"

    with open(LOG_PATH, "a") as f:
        f.write(log_line + "\n")


# === 🧩 Función adicional: Logging parcial de etapas o eventos intermedios
def log_admin_stage(stage, detail):
    """
    Registra eventos individuales durante el proceso, como errores puntuales,
    tiempos de inicio/fin, comandos parciales o cualquier mensaje relevante.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    slave = platform.node()

    line = f"[{now}] [{stage}] {detail} | slave: {slave}"
    with open(LOG_PATH, "a") as f:
        f.write(line + "\n")
