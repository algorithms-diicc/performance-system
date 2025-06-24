#!/bin/bash

# === ✅ Parámetros esperados ===
EXECUTABLE=$1        # ./a.out
INPUT_FILE=$2        # Archivo de texto tipo english.50MB
MAX_SIZE=$3          # Cantidad máxima de líneas a leer
SAMPLES=$4           # Repeticiones por cada incremento
CSV_OUTPUT=$5        # Ruta completa del archivo de salida .csv
# === 📄 LOG DE PARÁMETROS RECIBIDOS ===
# echo "[`date`] [ARGS] Ejecutable: $1 | Input: $2 | MAX_SIZE: $3 | SAMPLES: $4 | CSV: $5" >> debug_script.log

# === ❌ Validación básica de archivo de entrada ===
if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ Archivo no encontrado: $INPUT_FILE"
    exit 1
fi

# === ⚙️ Métricas compatibles en keira (sin RAPL) ===
METRICS="instructions,LLC-loads,LLC-load-misses,LLC-stores,LLC-store-misses,L1-dcache-loads,L1-dcache-load-misses,L1-dcache-stores,cache-references,cache-misses,branches,branch-misses,cpu-cycles,task-clock,cpu-clock,page-faults,major-faults"

# === ⚙️ Configuración de iteraciones ===
INCREMENT=30
WARMUP_ROUNDS=3

# === 📊 Cabecera del CSV ===
HEADER="Increment,InputSize,Instructions,LLCLoads,LLCLoadMisses,LLCStores,LLCStoreMisses,L1DcacheLoads,L1DcacheLoadMisses,L1DcacheStores,CacheReferences,CacheMisses,Branches,BranchMisses,CpuCycles,TaskClock,CpuClock,PageFaults,MajorFaults,StartTime,EndTime,DurationTime"
echo "$HEADER" > "$CSV_OUTPUT"

# === 🔁 Warmup: ejecución sin medición para calentar el sistema ===
for ((i=0; i<WARMUP_ROUNDS; i++)); do
    size=$((MAX_SIZE / INCREMENT))
    head -n $size "$INPUT_FILE" > temp_input.txt
    "$EXECUTABLE" "temp_input.txt" > /dev/null 2>&1
done

# === 🚀 Medición principal ===
step_size=$((MAX_SIZE / INCREMENT))
if [[ $step_size -eq 0 ]]; then step_size=1; fi
current_size=$step_size

for ((i=1; i<=INCREMENT; i++)); do
    head -n $current_size "$INPUT_FILE" > temp_input.txt

    for ((j=0; j<SAMPLES; j++)); do
        start=$(date +%s%3N)

        # Ejecutar medición con perf y guardar salida
        echo "→ Ejecutando con input size: $current_size"
        LC_NUMERIC=C /usr/lib/linux-tools/6.8.0-60-generic/perf stat -a --no-big-num -x';' \
            -o perf_output.tmp -e $METRICS "$EXECUTABLE" "temp_input.txt" > /dev/null 2>&1

        end=$(date +%s%3N)
        elapsed=$((end - start))

        if [ -s perf_output.tmp ]; then
            values=$(cut -d';' -f1 perf_output.tmp | sed '/#/d' | sed '/^$/d' | paste -sd, -)
            echo "$i,$current_size,$values,$start,$end,$elapsed" >> "$CSV_OUTPUT"
        else
            echo "$i,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>,$start,$end,$elapsed" >> "$CSV_OUTPUT"
        fi
    done

    current_size=$((current_size + step_size))
    if [[ $current_size -gt $MAX_SIZE ]]; then
        current_size=$MAX_SIZE
    fi
done

# === 🧹 Limpieza final ===
rm -f temp_input.txt perf_output.tmp
sed -i 's/<not,counted>/<not-counted>/g' "$CSV_OUTPUT"
sed -i 's/<not,supported>/<not-supported>/g' "$CSV_OUTPUT"
