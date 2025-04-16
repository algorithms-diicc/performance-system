#!/bin/bash

# === Parámetros ===
EXECUTABLE=$1         # ./a.out
INPUT_FILE=$2         # Archivo de texto grande, como english.50MB
MAX_SIZE=$3           # Tamaño total que se medirá, dividido en incrementos
CSV_OUTPUT=$4         # Archivo de salida CSV con los resultados

# === Validación del archivo de entrada ===
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: El archivo de entrada no existe: $INPUT_FILE"
    exit 1
fi

# === Configuración de medición ===
INCREMENT=30
SAMPLES=30
WARMUP_ROUNDS=3

# === Encabezados del CSV ===
echo "Increment,cpu-clock,task-clock,page-faults,major-faults,context-switches,cpu-migrations,duration_time" > "$CSV_OUTPUT"

# === Warmup ===
for ((i=0; i<WARMUP_ROUNDS; i++)); do
    warmup_input_size=$((MAX_SIZE / INCREMENT))
    head -c "$warmup_input_size" "$INPUT_FILE" > warmup_input.txt
    $EXECUTABLE warmup_input.txt > /dev/null 2>&1
done
rm -f warmup_input.txt

# === Mediciones reales ===
for ((i=1; i<=INCREMENT; i++)); do
    current_input_size=$((MAX_SIZE * i / INCREMENT))
    temp_input="temp_input.txt"

    # Crear input del tamaño actual
    head -c "$current_input_size" "$INPUT_FILE" > "$temp_input"

    for ((j=0; j<SAMPLES; j++)); do
        sudo /usr/lib/linux-tools/6.8.0-57-generic/perf stat -a -x';' -o perf_output.tmp -e \
            cpu-clock,task-clock,page-faults,major-faults,context-switches,cpu-migrations,duration_time \
            $EXECUTABLE "$temp_input" > /dev/null 2>&1

        if [ -s perf_output.tmp ]; then
            results=$(cut -d';' -f1 perf_output.tmp | sed '/#/d' | sed '/^$/d' | paste -sd, -)
            echo "$i,$results" >> "$CSV_OUTPUT"
        else
            echo "$i,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>" >> "$CSV_OUTPUT"
        fi
    done


    rm -f "$temp_input"
done

# === Correcciones de etiquetas ===
sed -i 's/<not,counted>/<not-counted>/g' "$CSV_OUTPUT"
sed -i 's/<not,supported>/<not-supported>/g' "$CSV_OUTPUT"

# Limpieza final
rm -f perf_output.tmp
