#!/bin/bash

# === ✅ Parámetros esperados ===
EXECUTABLE=$1        # ./a.out
INPUT_FILE=$2        # Archivo de texto tipo lista de números (uno por línea)
MAX_SIZE=$3          # Cantidad máxima de líneas a leer
SAMPLES=$4           # Repeticiones por cada incremento
CSV_OUTPUT=$5        # Ruta del archivo de salida


# === ❌ Validación de existencia del archivo de entrada ===
if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ El archivo de entrada no existe: $INPUT_FILE"
    exit 1
fi

# === ⚙️ Configuración de iteraciones ===
INCREMENT=30
WARMUP_ROUNDS=3

# === 📊 Métricas útiles soportadas por keira (sin RAPL, sin métricas del SO) ===
METRICS="instructions,LLC-loads,LLC-load-misses,LLC-stores,LLC-store-misses,L1-dcache-loads,L1-dcache-load-misses,L1-dcache-stores,cache-references,cache-misses,branches,branch-misses,cpu-cycles,task-clock,cpu-clock,page-faults,major-faults"
HEADER="Increment,InputSize,Instructions,LLCLoads,LLCLoadMisses,LLCStores,LLCStoreMisses,L1DcacheLoads,L1DcacheLoadMisses,L1DcacheStores,CacheReferences,CacheMisses,Branches,BranchMisses,CpuCycles,TaskClock,CpuClock,PageFaults,MajorFaults,StartTime,EndTime,DurationTime"
echo "$HEADER" > "$CSV_OUTPUT"

# === 🔥 Warmup: ejecución sin medición para estabilizar entorno ===
warmup_size=$((MAX_SIZE / INCREMENT))
warmup_input=$(head -n "$warmup_size" "$INPUT_FILE" | tr '\n' ' ')
for ((i=0; i<WARMUP_ROUNDS; i++)); do
    "$EXECUTABLE" $warmup_input > /dev/null 2>&1
done

# === 🚀 Medición principal ===
for ((i=1; i<=INCREMENT; i++)); do
    current_size=$((MAX_SIZE * i / INCREMENT))
    current_input=$(head -n "$current_size" "$INPUT_FILE" | tr '\n' ' ')

    for ((j=0; j<SAMPLES; j++)); do
        start=$(date +%s%3N)
       # Ejecutar medición con perf y guardar salida
        echo "→ Ejecutando con input size: $current_size"
        # Ejecutar perf con métricas relevantes
        LC_NUMERIC=C /usr/lib/linux-tools/6.8.0-60-generic/perf stat -a --no-big-num -x';' \
            -o perf_output.tmp -e $METRICS "$EXECUTABLE" $current_input > /dev/null 2>&1

        end=$(date +%s%3N)
        elapsed=$((end - start))

        if [ -s perf_output.tmp ]; then
            values=$(cut -d';' -f1 perf_output.tmp | sed '/#/d' | sed '/^$/d' | paste -sd, -)
            echo "$i,$current_size,$values,$elapsed" >> "$CSV_OUTPUT"
        else
            echo "$i"$(yes ",<not-counted>" | head -n 10 | tr -d '\n'),$elapsed >> "$CSV_OUTPUT"
        fi
    done
done

# === 🧹 Limpieza final y correcciones de formato ===
rm -f perf_output.tmp
sed -i 's/<not,counted>/<not-counted>/g' "$CSV_OUTPUT"
sed -i 's/<not,supported>/<not-supported>/g' "$CSV_OUTPUT"
