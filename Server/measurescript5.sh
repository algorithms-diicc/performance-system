#!/bin/bash

EXECUTABLE=$1
MAX_SIZE=$2
CSV_OUTPUT=$3

# Validar ejecutable
if [ ! -x "$EXECUTABLE" ]; then
    echo "Error: ejecutable no encontrado o no ejecutable: $EXECUTABLE"
    exit 1
fi

INCREMENT=30
SAMPLES=30
WARMUP_ROUNDS=3

# Escribir encabezado
echo "Increment,cpu-clock,task-clock,page-faults,major-faults,context-switches,cpu-migrations,duration_time" > "$CSV_OUTPUT"

# Warmup
for ((i=0; i<WARMUP_ROUNDS; i++)); do
    warmup_size=$((MAX_SIZE / INCREMENT))
    $EXECUTABLE $warmup_size > /dev/null 2>&1
done

# Mediciones reales
for ((i=1; i<=INCREMENT; i++)); do
    current_input_size=$((MAX_SIZE * i / INCREMENT))

    for ((j=0; j<SAMPLES; j++)); do
        sudo /usr/lib/linux-tools/6.8.0-57-generic/perf stat -a -x';' -o perf_output.tmp -e \
            cpu-clock,task-clock,page-faults,major-faults,context-switches,cpu-migrations,duration_time \
            $EXECUTABLE $current_input_size > /dev/null 2>&1

        if [ -s perf_output.tmp ]; then
            results=$(cut -d';' -f1 perf_output.tmp | sed '/#/d' | sed '/^$/d' | paste -sd, -)
            echo "$i,$results" >> "$CSV_OUTPUT"
        else
            echo "$i,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>,<not-counted>" >> "$CSV_OUTPUT"
        fi
    done
done

# Limpieza
sed -i 's/<not,counted>/<not-counted>/g' "$CSV_OUTPUT"
sed -i 's/<not,supported>/<not-supported>/g' "$CSV_OUTPUT"
rm -f perf_output.tmp
