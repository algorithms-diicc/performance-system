#!/bin/bash

EXECUTABLE=$1
INPUT_FILE=$2
MAX_SIZE=$3
CSV_OUTPUT=$4

# Validación
if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: El archivo de entrada no existe: $INPUT_FILE"
    exit 1
fi

INCREMENT=30
SAMPLES=30
WARMUP_ROUNDS=3

echo "Increment,cpu-clock,task-clock,page-faults,major-faults,context-switches,cpu-migrations,duration_time" > "$CSV_OUTPUT"

# Warmup
for ((i=0; i<WARMUP_ROUNDS; i++)); do
    warmup_size=$((MAX_SIZE / INCREMENT))
    warmup_input=$(head -n "$warmup_size" "$INPUT_FILE" | tr '\n' ' ')
    $EXECUTABLE $warmup_input > /dev/null 2>&1
done

# Mediciones
for ((i=1; i<=INCREMENT; i++)); do
    current_size=$((MAX_SIZE * i / INCREMENT))
    current_input=$(head -n "$current_size" "$INPUT_FILE" | tr '\n' ' ')

    for ((j=0; j<SAMPLES; j++)); do
        sudo /usr/lib/linux-tools/6.8.0-57-generic/perf stat -a -x';' -o perf_output.tmp -e \
            cpu-clock,task-clock,page-faults,major-faults,context-switches,cpu-migrations,duration_time \
            $EXECUTABLE $current_input > /dev/null 2>&1
         echo "Contenido de perf_output.tmp:"
         cat perf_output.tmp
         echo "--- FIN ---"
        if [ -s perf_output.tmp ]; then
            results=$(cut -d';' -f1 perf_output.tmp | sed '/#/d' | sed '/^$/d' | paste -sd, -)
            echo "$i,$results" >> "$CSV_OUTPUT"
        else
            echo "$i,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>" >> "$CSV_OUTPUT"
        fi
    done
done

# Correcciones
sed -i 's/<not,counted>/<not-counted>/g' "$CSV_OUTPUT"
sed -i 's/<not,supported>/<not-supported>/g' "$CSV_OUTPUT"
rm -f perf_output.tmp
