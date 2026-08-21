#!/bin/bash

# ============================================================
# PERFORMANCE SYSTEM - CAMM / NUMERIC ARGUMENT INPUT
#
# $1: ejecutable
# $2: archivo de entrada numérica (un valor por línea)
# $3: tamaño máximo de entrada (cantidad de valores)
# $4: muestras por tamaño
# $5: CSV de salida
#
# Contrato CAMM:
# - Los primeros N valores del archivo se entregan al ejecutable
#   como argumentos de línea de comandos.
#
# Compatibilidad:
# - Conserva el HEADER histórico de 25 columnas.
# - Detecta eventos disponibles por hardware/kernel.
# - Mide eventos perf en grupos pequeños para evitar saturar PMU.
# - Reintenta individualmente eventos <not-counted>.
# - Mantiene <not-supported> para eventos realmente no disponibles.
# - PERF_SYSTEM_WIDE=0: mide el proceso (recomendado local/AMD).
# - PERF_SYSTEM_WIDE=1: usa -a (reproducción servidor Intel).
# - INCREMENTS/WARMUP_ROUNDS/PERF_* pueden venir del snapshot
#   persistido de la ejecución a través del Slave.
# ============================================================

set -o pipefail

# CORE-06B-3: DurationTime usa reloj monotónico de alta resolución.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_BIN="${PYTHON_BIN:-$(command -v python3 || true)}"
BENCHMARK_TIMER_HELPER="${BENCHMARK_TIMER_HELPER:-$SCRIPT_DIR/benchmark_timer.py}"

[ -n "$PYTHON_BIN" ] || {
    echo "ERROR: no se encontró python3 para medir DurationTime." >&2
    exit 23
}

[ -f "$BENCHMARK_TIMER_HELPER" ] || {
    echo "ERROR: benchmark_timer.py no encontrado: $BENCHMARK_TIMER_HELPER" >&2
    exit 24
}

if [ "$#" -ne 5 ]; then
    echo "ERROR: se esperaban 5 parámetros." >&2
    echo "Uso: $0 <ejecutable> <input> <max_size> <samples> <csv_output>" >&2
    exit 2
fi

EXECUTABLE="$1"
INPUT_FILE="$2"
MAX_SIZE="$3"
SAMPLES="$4"
CSV_OUTPUT="$5"

[ -f "$EXECUTABLE" ] || { echo "ERROR: ejecutable no encontrado: $EXECUTABLE" >&2; exit 3; }
[ -x "$EXECUTABLE" ] || { echo "ERROR: archivo no ejecutable: $EXECUTABLE" >&2; exit 4; }
[ -f "$INPUT_FILE" ] || { echo "ERROR: archivo de entrada no encontrado: $INPUT_FILE" >&2; exit 5; }

if ! [[ "$MAX_SIZE" =~ ^[0-9]+$ ]] || (( MAX_SIZE <= 0 )); then
    echo "ERROR: MAX_SIZE debe ser un entero mayor que 0." >&2
    exit 6
fi

if ! [[ "$SAMPLES" =~ ^[0-9]+$ ]] || (( SAMPLES <= 0 )); then
    echo "ERROR: SAMPLES debe ser un entero mayor que 0." >&2
    exit 7
fi

AVAILABLE_VALUES=$(awk 'END { print NR }' "$INPUT_FILE")
if ! [[ "$AVAILABLE_VALUES" =~ ^[0-9]+$ ]] || (( AVAILABLE_VALUES <= 0 )); then
    echo "ERROR: el archivo de entrada está vacío." >&2
    exit 8
fi

if (( MAX_SIZE > AVAILABLE_VALUES )); then
    echo "ERROR: MAX_SIZE=$MAX_SIZE excede los $AVAILABLE_VALUES valores disponibles." >&2
    exit 9
fi

PERF_BIN="${PERF_BIN:-$(command -v perf || true)}"
[ -n "$PERF_BIN" ] || { echo "ERROR: no se encontró perf." >&2; exit 10; }

PERF_SYSTEM_WIDE="${PERF_SYSTEM_WIDE:-0}"
PERF_SINGLE_FALLBACK="${PERF_SINGLE_FALLBACK:-1}"
PERF_SCOPE_ARGS=()

if [ "$PERF_SYSTEM_WIDE" = "1" ]; then
    PERF_SCOPE_ARGS=(-a)
    PERF_SCOPE_DESCRIPTION="system-wide"
else
    PERF_SCOPE_DESCRIPTION="process"
fi

INCREMENTS="${INCREMENTS:-30}"
WARMUP_ROUNDS="${WARMUP_ROUNDS:-3}"

if ! [[ "$INCREMENTS" =~ ^[0-9]+$ ]] || (( INCREMENTS <= 0 )); then
    echo "ERROR: INCREMENTS debe ser mayor que 0." >&2
    exit 11
fi

if ! [[ "$WARMUP_ROUNDS" =~ ^[0-9]+$ ]] || (( WARMUP_ROUNDS < 0 )); then
    echo "ERROR: WARMUP_ROUNDS debe ser >= 0." >&2
    exit 12
fi

if [ "$PERF_SYSTEM_WIDE" != "0" ] && [ "$PERF_SYSTEM_WIDE" != "1" ]; then
    echo "ERROR: PERF_SYSTEM_WIDE debe ser 0 o 1." >&2
    exit 13
fi

if [ "$PERF_SINGLE_FALLBACK" != "0" ] && [ "$PERF_SINGLE_FALLBACK" != "1" ]; then
    echo "ERROR: PERF_SINGLE_FALLBACK debe ser 0 o 1." >&2
    exit 14
fi

if (( MAX_SIZE < INCREMENTS )); then
    INCREMENTS="$MAX_SIZE"
fi

ALL_EVENTS=(
    "instructions"
    "LLC-loads"
    "LLC-load-misses"
    "LLC-stores"
    "LLC-store-misses"
    "L1-dcache-loads"
    "L1-dcache-load-misses"
    "L1-dcache-stores"
    "cache-references"
    "cache-misses"
    "branches"
    "branch-misses"
    "cpu-cycles"
    "task-clock"
    "cpu-clock"
    "page-faults"
    "major-faults"
    "power/energy-pkg/"
    "power/energy-cores/"
    "power/energy-ram/"
)

CPU_EVENTS=(
    "instructions"
    "cpu-cycles"
    "branches"
    "branch-misses"
)

CACHE_EVENTS=(
    "cache-references"
    "cache-misses"
    "L1-dcache-loads"
    "L1-dcache-load-misses"
)

SYSTEM_EVENTS=(
    "task-clock"
    "cpu-clock"
    "page-faults"
    "major-faults"
)

OPTIONAL_EVENTS=(
    "LLC-loads"
    "LLC-load-misses"
    "LLC-stores"
    "LLC-store-misses"
    "L1-dcache-stores"
)

ENERGY_EVENTS=(
    "power/energy-pkg/"
    "power/energy-cores/"
    "power/energy-ram/"
)

HEADER="Increment,InputSize,Instructions,LLCLoads,LLCLoadMisses,LLCStores,LLCStoreMisses,L1DcacheLoads,L1DcacheLoadMisses,L1DcacheStores,CacheReferences,CacheMisses,Branches,BranchMisses,CpuCycles,TaskClock,CpuClock,PageFaults,MajorFaults,EnergyPkg,EnergyCores,EnergyRAM,StartTime,EndTime,DurationTime,NormalizedInstructions,NormalizedCacheMisses"

PERF_OUTPUT=$(mktemp "${TMPDIR:-/tmp}/performance_camm_perf_output.XXXXXX")
PERF_ERROR=$(mktemp "${TMPDIR:-/tmp}/performance_camm_perf_error.XXXXXX")

cleanup() {
    rm -f "$PERF_OUTPUT" "$PERF_ERROR"
}
trap cleanup EXIT INT TERM

CSV_DIR=$(dirname "$CSV_OUTPUT")
mkdir -p "$CSV_DIR"
[ -d "$CSV_DIR" ] || { echo "ERROR: no se pudo crear $CSV_DIR" >&2; exit 15; }

declare -a CURRENT_INPUT
declare -a PREFLIGHT_INPUT

load_current_input() {
    local size="$1"
    mapfile -t CURRENT_INPUT < <(
        head -n "$size" "$INPUT_FILE" | sed 's/\r$//'
    )

    if [ "${#CURRENT_INPUT[@]}" -ne "$size" ]; then
        echo "ERROR: se esperaban $size valores y se cargaron ${#CURRENT_INPUT[@]}." >&2
        return 1
    fi
    return 0
}

PRECHECK_SIZE=$MAX_SIZE
(( PRECHECK_SIZE > 30 )) && PRECHECK_SIZE=30
(( PRECHECK_SIZE < 1 )) && PRECHECK_SIZE=1

mapfile -t PREFLIGHT_INPUT < <(
    head -n "$PRECHECK_SIZE" "$INPUT_FILE" | sed 's/\r$//'
)

if [ "${#PREFLIGHT_INPUT[@]}" -ne "$PRECHECK_SIZE" ]; then
    echo "ERROR: no se pudo preparar input de preflight." >&2
    exit 16
fi

trim() {
    local value="$1"
    value="${value#"${value%%[![:space:]]*}"}"
    value="${value%"${value##*[![:space:]]}"}"
    printf '%s' "$value"
}

normalize_value() {
    local value
    value=$(trim "$1")
    case "$value" in
        "<not counted>"|"<not-counted>") printf '%s' "<not-counted>" ;;
        "<not supported>"|"<not-supported>") printf '%s' "<not-supported>" ;;
        "<permission denied>"|"<permission-denied>") printf '%s' "<permission-denied>" ;;
        "") printf '%s' "<not-counted>" ;;
        *) printf '%s' "$value" ;;
    esac
}

normalize_event_name() {
    local event
    event=$(trim "$1")

    # CORE-06C-2A:
    # perf puede añadir modificadores de privilegio de dos formas:
    #   instructions:u
    #   power/energy-pkg/u
    # Ambos vuelven al nombre canónico solicitado por el script.
    event=$(printf '%s' "$event" | sed -E         -e 's/:[uUkKhHpPG]+$//'         -e 's#/([uUkKhHpPG]+)$#/#')

    [ "$event" = "cycles" ] && event="cpu-cycles"

    printf '%s' "$event"
}

declare -A PERF_VALUES
declare -A EVENT_AVAILABLE
declare -A EVENT_UNAVAILABLE_VALUE
declare -A VALUES
PERF_FAILURE_VALUE=""

parse_perf_output() {
    local output_file="$1"
    local raw_value raw_event event value
    PERF_VALUES=()

    while IFS=';' read -r raw_value _ raw_event _rest; do
        raw_value=$(trim "$raw_value")
        raw_event=$(trim "$raw_event")
        [ -z "$raw_value" ] && continue
        [ -z "$raw_event" ] && continue
        [[ "$raw_value" == \#* ]] && continue

        event=$(normalize_event_name "$raw_event")
        value=$(normalize_value "$raw_value")
        PERF_VALUES["$event"]="$value"
    done < "$output_file"
}

perf_error_is_permission_denied() {
    [ -s "$PERF_ERROR" ] || return 1
    LC_ALL=C grep -Eiq \
        'access to performance monitoring and observability operations is limited|no permission to enable|permission denied|operation not permitted' \
        "$PERF_ERROR"
}

run_perf_events() {
    local -a events=("$@")
    local event_spec status
    PERF_VALUES=()
    PERF_FAILURE_VALUE=""
    [ "${#events[@]}" -gt 0 ] || return 0
    event_spec=$(IFS=, ; echo "${events[*]}")

    : > "$PERF_OUTPUT"
    : > "$PERF_ERROR"

    LC_NUMERIC=C "$PERF_BIN" stat         "${PERF_SCOPE_ARGS[@]}"         --no-big-num         -x';'         -o "$PERF_OUTPUT"         -e "$event_spec"         "$EXECUTABLE" "${CURRENT_INPUT[@]}"         > /dev/null 2> "$PERF_ERROR"

    status=$?
    parse_perf_output "$PERF_OUTPUT"

    if [ "$status" -ne 0 ]; then
        if perf_error_is_permission_denied; then
            PERF_FAILURE_VALUE="<permission-denied>"
        fi
        echo "[WARN] perf devolvió código $status para: $event_spec" >&2
        [ ! -s "$PERF_ERROR" ] || cat "$PERF_ERROR" >&2
        return "$status"
    fi
    return 0
}

SINGLE_VALUE="<not-counted>"

measure_single_event() {
    local event="$1"
    SINGLE_VALUE="<not-counted>"

    if run_perf_events "$event"; then
        SINGLE_VALUE="${PERF_VALUES[$event]:-<not-counted>}"
        SINGLE_VALUE=$(normalize_value "$SINGLE_VALUE")
    else
        SINGLE_VALUE="${PERF_FAILURE_VALUE:-<not-counted>}"
    fi
}

measure_group_into_values() {
    local -a requested=("$@")
    local -a active=()
    local event value

    for event in "${requested[@]}"; do
        if [ "${EVENT_AVAILABLE[$event]:-0}" -eq 1 ]; then
            active+=("$event")
        fi
    done

    [ "${#active[@]}" -gt 0 ] || return 0

    if run_perf_events "${active[@]}"; then
        for event in "${active[@]}"; do
            value="${PERF_VALUES[$event]:-<not-counted>}"
            value=$(normalize_value "$value")

            if [ "$value" = "<not-counted>" ] && [ "$PERF_SINGLE_FALLBACK" = "1" ]; then
                measure_single_event "$event"
                value="$SINGLE_VALUE"
            fi

            VALUES["$event"]="$value"
        done
    else
        for event in "${active[@]}"; do
            measure_single_event "$event"
            VALUES["$event"]="$SINGLE_VALUE"
        done
    fi
}

# CORE-06B-4:
# CacheMissesPerMI debe usar instructions y cache-misses de UNA MISMA
# ejecución física. Esta pareja NO usa fallback individual.
NORMALIZED_INSTRUCTIONS="<not-counted>"
NORMALIZED_CACHE_MISSES="<not-counted>"

measure_normalized_cache_pair() {
    local instr_available="${EVENT_AVAILABLE[instructions]:-0}"
    local misses_available="${EVENT_AVAILABLE[cache-misses]:-0}"
    local instr_value="<not-counted>"
    local misses_value="<not-counted>"

    NORMALIZED_INSTRUCTIONS="<not-counted>"
    NORMALIZED_CACHE_MISSES="<not-counted>"

    if [ "$instr_available" -ne 1 ]; then
        NORMALIZED_INSTRUCTIONS="${EVENT_UNAVAILABLE_VALUE[instructions]:-<not-supported>}"
    fi

    if [ "$misses_available" -ne 1 ]; then
        NORMALIZED_CACHE_MISSES="${EVENT_UNAVAILABLE_VALUE[cache-misses]:-<not-supported>}"
    fi

    if [ "$instr_available" -ne 1 ] || [ "$misses_available" -ne 1 ]; then
        return 0
    fi

    # Misma invocación perf stat -> mismo proceso benchmark.
    # Deliberadamente NO se llama measure_single_event aquí.
    if ! run_perf_events "instructions" "cache-misses"; then
        NORMALIZED_INSTRUCTIONS="${PERF_FAILURE_VALUE:-<not-counted>}"
        NORMALIZED_CACHE_MISSES="${PERF_FAILURE_VALUE:-<not-counted>}"
        return 0
    fi

    instr_value="${PERF_VALUES[instructions]:-<not-counted>}"
    misses_value="${PERF_VALUES[cache-misses]:-<not-counted>}"

    instr_value=$(normalize_value "$instr_value")
    misses_value=$(normalize_value "$misses_value")

    NORMALIZED_INSTRUCTIONS="$instr_value"
    NORMALIZED_CACHE_MISSES="$misses_value"
}


check_event_support() {
    local event="$1"
    local status value

    : > "$PERF_OUTPUT"
    : > "$PERF_ERROR"

    LC_NUMERIC=C "$PERF_BIN" stat         "${PERF_SCOPE_ARGS[@]}"         --no-big-num         -x';'         -o "$PERF_OUTPUT"         -e "$event"         "$EXECUTABLE" "${PREFLIGHT_INPUT[@]}"         > /dev/null 2> "$PERF_ERROR"

    status=$?

    if [ "$status" -ne 0 ]; then
        EVENT_AVAILABLE["$event"]=0
        if perf_error_is_permission_denied; then
            EVENT_UNAVAILABLE_VALUE["$event"]="<permission-denied>"
        else
            EVENT_UNAVAILABLE_VALUE["$event"]="<not-supported>"
        fi
        return 1
    fi

    parse_perf_output "$PERF_OUTPUT"
    value="${PERF_VALUES[$event]:-<not-counted>}"
    value=$(normalize_value "$value")

    if [ "$value" = "<not-supported>" ]; then
        EVENT_AVAILABLE["$event"]=0
        EVENT_UNAVAILABLE_VALUE["$event"]="<not-supported>"
        return 1
    fi

    EVENT_AVAILABLE["$event"]=1
    unset \'EVENT_UNAVAILABLE_VALUE[$event]\'
    return 0
}

echo "=============================================="
echo " PERFORMANCE SYSTEM - CAMM BENCHMARK"
echo "=============================================="
echo "[INFO] perf:        $PERF_BIN"
echo "[INFO] scope:       $PERF_SCOPE_DESCRIPTION"
echo "[INFO] executable:  $EXECUTABLE"
echo "[INFO] input:       $INPUT_FILE"
echo "[INFO] values file: $AVAILABLE_VALUES"
echo "[INFO] max size:    $MAX_SIZE"
echo "[INFO] samples:     $SAMPLES"
echo "[INFO] increments:  $INCREMENTS"
echo "[INFO] warmups:     $WARMUP_ROUNDS"
echo "[INFO] csv:         $CSV_OUTPUT"
echo "=============================================="
echo "[INFO] Verificando métricas disponibles..."

for event in "${ALL_EVENTS[@]}"; do
    if check_event_support "$event"; then
        echo "  [OK] $event"
    else
        echo "  [NO DISPONIBLE] $event"
    fi
done

echo "$HEADER" > "$CSV_OUTPUT"
[ -f "$CSV_OUTPUT" ] || { echo "ERROR: no se pudo crear $CSV_OUTPUT" >&2; exit 17; }

WARMUP_SIZE=$(( (MAX_SIZE + INCREMENTS - 1) / INCREMENTS ))
(( WARMUP_SIZE < 1 )) && WARMUP_SIZE=1

if (( WARMUP_ROUNDS > 0 )); then
    echo "[INFO] Ejecutando $WARMUP_ROUNDS warmups con $WARMUP_SIZE valores..."
    load_current_input "$WARMUP_SIZE" || exit 18

    for ((w=1; w<=WARMUP_ROUNDS; w++)); do
        "$EXECUTABLE" "${CURRENT_INPUT[@]}" > /dev/null 2>&1
        WARMUP_STATUS=$?
        if [ "$WARMUP_STATUS" -ne 0 ]; then
            echo "ERROR: programa falló durante warmup (código $WARMUP_STATUS)." >&2
            exit 19
        fi
    done
fi

echo "[INFO] Comenzando mediciones agrupadas..."

for ((i=1; i<=INCREMENTS; i++)); do
    current_size=$(( (MAX_SIZE * i + INCREMENTS - 1) / INCREMENTS ))
    (( current_size > MAX_SIZE )) && current_size="$MAX_SIZE"

    load_current_input "$current_size" || exit 20

    echo "----------------------------------------------"
    echo "[INPUT] incremento $i/$INCREMENTS - $current_size valores"
    echo "----------------------------------------------"

    for ((j=1; j<=SAMPLES; j++)); do
        echo "[RUN] muestra $j/$SAMPLES"
        VALUES=()

        for event in "${ALL_EVENTS[@]}"; do
            if [ "${EVENT_AVAILABLE[$event]:-0}" -eq 1 ]; then
                VALUES["$event"]="<not-counted>"
            else
                VALUES["$event"]="${EVENT_UNAVAILABLE_VALUE[$event]:-<not-supported>}"
            fi
        done

        TIMING_OUTPUT=$(
            "$PYTHON_BIN" "$BENCHMARK_TIMER_HELPER" --                 "$EXECUTABLE" "${CURRENT_INPUT[@]}"
        )
        TIMER_HELPER_STATUS=$?

        if [ "$TIMER_HELPER_STATUS" -ne 0 ]; then
            echo "ERROR: falló benchmark_timer.py (código $TIMER_HELPER_STATUS)." >&2
            exit 21
        fi

        IFS=$'\t' read -r start end elapsed TIMING_STATUS <<< "$TIMING_OUTPUT"

        if [ -z "$start" ] || [ -z "$end" ] || [ -z "$elapsed" ] || [ -z "$TIMING_STATUS" ]; then
            echo "ERROR: salida inválida de benchmark_timer.py." >&2
            exit 21
        fi

        if [ "$TIMING_STATUS" -ne 0 ]; then
            echo "ERROR: programa devolvió código $TIMING_STATUS durante timing." >&2
            exit 21
        fi

        measure_group_into_values "${CPU_EVENTS[@]}"
        measure_group_into_values "${CACHE_EVENTS[@]}"
        measure_group_into_values "${SYSTEM_EVENTS[@]}"

        # CORE-06B-4: pareja dedicada para CacheMissesPerMI.
        measure_normalized_cache_pair

        for event in "${OPTIONAL_EVENTS[@]}"; do
            if [ "${EVENT_AVAILABLE[$event]:-0}" -eq 1 ]; then
                measure_single_event "$event"
                VALUES["$event"]="$SINGLE_VALUE"
            fi
        done

        for event in "${ENERGY_EVENTS[@]}"; do
            if [ "${EVENT_AVAILABLE[$event]:-0}" -eq 1 ]; then
                measure_single_event "$event"
                VALUES["$event"]="$SINGLE_VALUE"
            fi
        done

        echo "$i,$current_size,${VALUES[instructions]},${VALUES[LLC-loads]},${VALUES[LLC-load-misses]},${VALUES[LLC-stores]},${VALUES[LLC-store-misses]},${VALUES[L1-dcache-loads]},${VALUES[L1-dcache-load-misses]},${VALUES[L1-dcache-stores]},${VALUES[cache-references]},${VALUES[cache-misses]},${VALUES[branches]},${VALUES[branch-misses]},${VALUES[cpu-cycles]},${VALUES[task-clock]},${VALUES[cpu-clock]},${VALUES[page-faults]},${VALUES[major-faults]},${VALUES[power/energy-pkg/]},${VALUES[power/energy-cores/]},${VALUES[power/energy-ram/]},$start,$end,$elapsed,$NORMALIZED_INSTRUCTIONS,$NORMALIZED_CACHE_MISSES"             >> "$CSV_OUTPUT"
    done
done

EXPECTED_ROWS=$(( INCREMENTS * SAMPLES ))
TOTAL_LINES=$(wc -l < "$CSV_OUTPUT")
ACTUAL_ROWS=$(( TOTAL_LINES - 1 ))

echo "=============================================="
echo " CAMM BENCHMARK FINALIZADO"
echo "=============================================="
echo "[OK] CSV: $CSV_OUTPUT"
echo "[OK] Filas esperadas: $EXPECTED_ROWS"
echo "[OK] Filas generadas: $ACTUAL_ROWS"
echo "=============================================="

if [ "$ACTUAL_ROWS" -ne "$EXPECTED_ROWS" ]; then
    echo "ERROR: cantidad inesperada de filas." >&2
    exit 22
fi

exit 0
