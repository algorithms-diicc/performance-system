#!/bin/bash

# ============================================================
# PERFORMANCE SYSTEM - LCS / TEXT INPUT
#
# $1: ejecutable
# $2: archivo de entrada
# $3: tamaño máximo de entrada (líneas)
# $4: muestras por tamaño
# $5: CSV de salida
#
# Compatibilidad:
# - Conserva el mismo HEADER histórico.
# - Detecta eventos disponibles por hardware/kernel.
# - Mide eventos perf en grupos pequeños para evitar saturar PMU.
# - Reintenta individualmente eventos <not-counted>.
# - Mantiene <not-supported> para eventos realmente no disponibles.
# - PERF_SYSTEM_WIDE=0: mide el proceso (recomendado local/AMD).
# - PERF_SYSTEM_WIDE=1: usa -a (útil para reproducir servidor Intel).
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

# -----------------------------
# Parámetros y validaciones
# -----------------------------
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

# -----------------------------
# Configuración perf
# -----------------------------
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

if (( MAX_SIZE < INCREMENTS )); then
    INCREMENTS="$MAX_SIZE"
fi

# -----------------------------
# Métricas
# -----------------------------
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

# -----------------------------
# Temporales
# -----------------------------
TEMP_INPUT=$(mktemp "${TMPDIR:-/tmp}/performance_lcs_input.XXXXXX")
PREFLIGHT_INPUT=$(mktemp "${TMPDIR:-/tmp}/performance_lcs_preflight.XXXXXX")
PERF_OUTPUT=$(mktemp "${TMPDIR:-/tmp}/performance_perf_output.XXXXXX")
PERF_ERROR=$(mktemp "${TMPDIR:-/tmp}/performance_perf_error.XXXXXX")

cleanup() {
    rm -f "$TEMP_INPUT" "$PREFLIGHT_INPUT" "$PERF_OUTPUT" "$PERF_ERROR"
}
trap cleanup EXIT INT TERM

CSV_DIR=$(dirname "$CSV_OUTPUT")
mkdir -p "$CSV_DIR"
[ -d "$CSV_DIR" ] || { echo "ERROR: no se pudo crear $CSV_DIR" >&2; exit 13; }

# -----------------------------
# Utilidades de parsing perf
# -----------------------------
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
declare -A VALUES

parse_perf_output() {
    local output_file="$1"
    local raw_value raw_event event value
    PERF_VALUES=()

    # perf -x';' usa: value;unit;event;runtime;percentage;...
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

run_perf_events() {
    local -a events=("$@")
    local event_spec status
    PERF_VALUES=()

    [ "${#events[@]}" -gt 0 ] || return 0
    event_spec=$(IFS=, ; echo "${events[*]}")

    : > "$PERF_OUTPUT"
    : > "$PERF_ERROR"

    LC_NUMERIC=C "$PERF_BIN" stat \
        "${PERF_SCOPE_ARGS[@]}" \
        --no-big-num \
        -x';' \
        -o "$PERF_OUTPUT" \
        -e "$event_spec" \
        "$EXECUTABLE" "$TEMP_INPUT" \
        > /dev/null 2> "$PERF_ERROR"

    status=$?
    parse_perf_output "$PERF_OUTPUT"

    if [ "$status" -ne 0 ]; then
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
        # Si un grupo falla, no se pierden todas sus métricas:
        # se reintenta evento por evento.
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
        NORMALIZED_INSTRUCTIONS="<not-supported>"
    fi

    if [ "$misses_available" -ne 1 ]; then
        NORMALIZED_CACHE_MISSES="<not-supported>"
    fi

    if [ "$instr_available" -ne 1 ] || [ "$misses_available" -ne 1 ]; then
        return 0
    fi

    # Misma invocación perf stat -> mismo proceso benchmark.
    # Deliberadamente NO se llama measure_single_event aquí.
    if ! run_perf_events "instructions" "cache-misses"; then
        NORMALIZED_INSTRUCTIONS="<not-counted>"
        NORMALIZED_CACHE_MISSES="<not-counted>"
        return 0
    fi

    instr_value="${PERF_VALUES[instructions]:-<not-counted>}"
    misses_value="${PERF_VALUES[cache-misses]:-<not-counted>}"

    instr_value=$(normalize_value "$instr_value")
    misses_value=$(normalize_value "$misses_value")

    NORMALIZED_INSTRUCTIONS="$instr_value"
    NORMALIZED_CACHE_MISSES="$misses_value"
}


# -----------------------------
# Detección de soporte
# -----------------------------
PRECHECK_SIZE=$MAX_SIZE
(( PRECHECK_SIZE > 30 )) && PRECHECK_SIZE=30
(( PRECHECK_SIZE < 1 )) && PRECHECK_SIZE=1

head -n "$PRECHECK_SIZE" "$INPUT_FILE" > "$PREFLIGHT_INPUT"

check_event_support() {
    local event="$1"
    local status value

    : > "$PERF_OUTPUT"
    : > "$PERF_ERROR"

    LC_NUMERIC=C "$PERF_BIN" stat \
        "${PERF_SCOPE_ARGS[@]}" \
        --no-big-num \
        -x';' \
        -o "$PERF_OUTPUT" \
        -e "$event" \
        "$EXECUTABLE" "$PREFLIGHT_INPUT" \
        > /dev/null 2> "$PERF_ERROR"

    status=$?

    if [ "$status" -ne 0 ]; then
        EVENT_AVAILABLE["$event"]=0
        return 1
    fi

    parse_perf_output "$PERF_OUTPUT"
    value="${PERF_VALUES[$event]:-<not-counted>}"
    value=$(normalize_value "$value")

    # not-counted = evento reconocido pero sin valor en esta
    # ejecución corta; se conserva como disponible y se
    # reintentará durante la medición real.
    if [ "$value" = "<not-supported>" ]; then
        EVENT_AVAILABLE["$event"]=0
        return 1
    fi

    EVENT_AVAILABLE["$event"]=1
    return 0
}

# -----------------------------
# Información y preflight
# -----------------------------
echo "=============================================="
echo " PERFORMANCE SYSTEM - LCS BENCHMARK"
echo "=============================================="
echo "[INFO] perf:        $PERF_BIN"
echo "[INFO] scope:       $PERF_SCOPE_DESCRIPTION"
echo "[INFO] executable:  $EXECUTABLE"
echo "[INFO] input:       $INPUT_FILE"
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

# -----------------------------
# CSV y warmup
# -----------------------------
echo "$HEADER" > "$CSV_OUTPUT"
[ -f "$CSV_OUTPUT" ] || { echo "ERROR: no se pudo crear $CSV_OUTPUT" >&2; exit 15; }

WARMUP_SIZE=$(( (MAX_SIZE + INCREMENTS - 1) / INCREMENTS ))
(( WARMUP_SIZE < 1 )) && WARMUP_SIZE=1

if (( WARMUP_ROUNDS > 0 )); then
    echo "[INFO] Ejecutando $WARMUP_ROUNDS warmups con $WARMUP_SIZE líneas..."
    head -n "$WARMUP_SIZE" "$INPUT_FILE" > "$TEMP_INPUT"

    for ((w=1; w<=WARMUP_ROUNDS; w++)); do
        "$EXECUTABLE" "$TEMP_INPUT" > /dev/null 2>&1
        WARMUP_STATUS=$?

        if [ "$WARMUP_STATUS" -ne 0 ]; then
            echo "ERROR: programa falló durante warmup (código $WARMUP_STATUS)." >&2
            exit 16
        fi
    done
fi

# -----------------------------
# Medición principal
# -----------------------------
echo "[INFO] Comenzando mediciones agrupadas..."

for ((i=1; i<=INCREMENTS; i++)); do
    current_size=$(( (MAX_SIZE * i + INCREMENTS - 1) / INCREMENTS ))
    (( current_size > MAX_SIZE )) && current_size="$MAX_SIZE"

    head -n "$current_size" "$INPUT_FILE" > "$TEMP_INPUT"

    echo "----------------------------------------------"
    echo "[INPUT] incremento $i/$INCREMENTS - $current_size líneas"
    echo "----------------------------------------------"

    for ((j=1; j<=SAMPLES; j++)); do
        echo "[RUN] muestra $j/$SAMPLES"

        VALUES=()

        for event in "${ALL_EVENTS[@]}"; do
            if [ "${EVENT_AVAILABLE[$event]:-0}" -eq 1 ]; then
                VALUES["$event"]="<not-counted>"
            else
                VALUES["$event"]="<not-supported>"
            fi
        done

        # DurationTime representa UNA ejecución del algoritmo,
        # no la suma de las ejecuciones adicionales de perf.
        # CORE-06B-3: perf_counter_ns()/CLOCK_MONOTONIC.
        TIMING_OUTPUT=$(
            "$PYTHON_BIN" "$BENCHMARK_TIMER_HELPER" --                 "$EXECUTABLE" "$TEMP_INPUT"
        )
        TIMER_HELPER_STATUS=$?

        if [ "$TIMER_HELPER_STATUS" -ne 0 ]; then
            echo "ERROR: falló benchmark_timer.py (código $TIMER_HELPER_STATUS)." >&2
            exit 18
        fi

        IFS=$'\t' read -r start end elapsed TIMING_STATUS <<< "$TIMING_OUTPUT"

        if [ -z "$start" ] || [ -z "$end" ] || [ -z "$elapsed" ] || [ -z "$TIMING_STATUS" ]; then
            echo "ERROR: salida inválida de benchmark_timer.py." >&2
            exit 18
        fi

        if [ "$TIMING_STATUS" -ne 0 ]; then
            echo "ERROR: programa devolvió código $TIMING_STATUS durante timing." >&2
            exit 18
        fi

        # Grupos ya probados como compatibles en Ryzen 5.
        # En Intel se detecta soporte de cada evento antes de medir.
        measure_group_into_values "${CPU_EVENTS[@]}"
        measure_group_into_values "${CACHE_EVENTS[@]}"
        measure_group_into_values "${SYSTEM_EVENTS[@]}"

        # CORE-06B-4: pareja dedicada para CacheMissesPerMI.
        measure_normalized_cache_pair

        # Eventos dependientes de arquitectura/PMU.
        for event in "${OPTIONAL_EVENTS[@]}"; do
            if [ "${EVENT_AVAILABLE[$event]:-0}" -eq 1 ]; then
                measure_single_event "$event"
                VALUES["$event"]="$SINGLE_VALUE"
            fi
        done

        # Energía/RAPL, si el hardware/kernel/permisos la ofrecen.
        for event in "${ENERGY_EVENTS[@]}"; do
            if [ "${EVENT_AVAILABLE[$event]:-0}" -eq 1 ]; then
                measure_single_event "$event"
                VALUES["$event"]="$SINGLE_VALUE"
            fi
        done

        # Mismo orden y 25 columnas que el CSV histórico.
        echo "$i,$current_size,${VALUES[instructions]},${VALUES[LLC-loads]},${VALUES[LLC-load-misses]},${VALUES[LLC-stores]},${VALUES[LLC-store-misses]},${VALUES[L1-dcache-loads]},${VALUES[L1-dcache-load-misses]},${VALUES[L1-dcache-stores]},${VALUES[cache-references]},${VALUES[cache-misses]},${VALUES[branches]},${VALUES[branch-misses]},${VALUES[cpu-cycles]},${VALUES[task-clock]},${VALUES[cpu-clock]},${VALUES[page-faults]},${VALUES[major-faults]},${VALUES[power/energy-pkg/]},${VALUES[power/energy-cores/]},${VALUES[power/energy-ram/]},$start,$end,$elapsed,$NORMALIZED_INSTRUCTIONS,$NORMALIZED_CACHE_MISSES" \
            >> "$CSV_OUTPUT"
    done
done

# -----------------------------
# Validación final
# -----------------------------
EXPECTED_ROWS=$(( INCREMENTS * SAMPLES ))
TOTAL_LINES=$(wc -l < "$CSV_OUTPUT")
ACTUAL_ROWS=$(( TOTAL_LINES - 1 ))

echo "=============================================="
echo " BENCHMARK FINALIZADO"
echo "=============================================="
echo "[OK] CSV: $CSV_OUTPUT"
echo "[OK] Filas esperadas: $EXPECTED_ROWS"
echo "[OK] Filas generadas: $ACTUAL_ROWS"
echo "=============================================="

if [ "$ACTUAL_ROWS" -ne "$EXPECTED_ROWS" ]; then
    echo "ERROR: cantidad inesperada de filas." >&2
    exit 17
fi

exit 0