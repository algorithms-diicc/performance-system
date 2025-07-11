#!/bin/bash

# === ✅ Parámetros esperados ===
EXECUTABLE=$1        # ./a.out
MAX_SIZE=$2          # Número máximo a pasar como argumento
SAMPLES=$3           # Repeticiones por cada incremento
CSV_OUTPUT=$4        # Ruta completa del archivo de salida .csv

# === ❌ Validación del ejecutable ===
if [ ! -x "$EXECUTABLE" ]; then
    echo "❌ Ejecutable no encontrado o no tiene permisos: $EXECUTABLE"
    exit 1
fi

# === ⚙️ Configuración de iteraciones ===
INCREMENT=30
WARMUP_ROUNDS=3

# === 📊 Métricas útiles compatibles con keira (sin RAPL) ===
METRICS="instructions,LLC-loads,LLC-load-misses,LLC-stores,LLC-store-misses,L1-dcache-loads,L1-dcache-load-misses,L1-dcache-stores,cache-references,cache-misses,branches,branch-misses,cpu-cycles,task-clock,cpu-clock,page-faults,major-faults,power/energy-pkg/,power/energy-cores/,power/energy-ram/"

# === 🏷️ Encabezado CSV ===
HEADER="Increment,InputSize,Instructions,LLCLoads,LLCLoadMisses,LLCStores,LLCStoreMisses,L1DcacheLoads,L1DcacheLoadMisses,L1DcacheStores,CacheReferences,CacheMisses,Branches,BranchMisses,CpuCycles,TaskClock,CpuClock,PageFaults,MajorFaults,EnergyPkg,EnergyCores,EnergyRAM,StartTime,EndTime,DurationTime"
echo "$HEADER" > "$CSV_OUTPUT"

# === 🔥 Warmup ===
warmup_size=$((MAX_SIZE / INCREMENT))
for ((i=0; i<WARMUP_ROUNDS; i++)); do
    "$EXECUTABLE" $warmup_size > /dev/null 2>&1
done

# === 🚀 Mediciones reales ===
for ((i=1; i<=INCREMENT; i++)); do
    current_size=$((MAX_SIZE * i / INCREMENT))

    for ((j=0; j<SAMPLES; j++)); do
        start=$(date +%s%3N)

        LC_NUMERIC=C /usr/lib/linux-tools/6.8.0-60-generic/perf stat -a --no-big-num -x';' \
            -o perf_output.tmp -e $METRICS "$EXECUTABLE" $current_size > /dev/null 2>&1

        end=$(date +%s%3N)
        elapsed=$((end - start))

        if [ -s perf_output.tmp ]; then
            values=$(cut -d';' -f1 perf_output.tmp | sed '/#/d' | sed '/^$/d' | paste -sd, -)
            echo "$i,$current_size,$values,$start,$end,$elapsed" >> "$CSV_OUTPUT"
        else
            echo "$i,$current_size"$(yes ",<not-counted>" | head -n 17 | tr -d '\n'),$start,$end,$elapsed >> "$CSV_OUTPUT"
        fi
    done
done

# === 🧹 Limpieza final ===
rm -f perf_output.tmp
sed -i 's/<not,counted>/<not-counted>/g' "$CSV_OUTPUT"
sed -i 's/<not,supported>/<not-supported>/g' "$CSV_OUTPUT"
