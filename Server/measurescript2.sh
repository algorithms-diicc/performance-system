#!/bin/bash
#sleep 30

executable=$1

# Define la ruta del archivo de salida en la carpeta 'results'
outfile=resultsEnergy$(date +"%Y-%m-%d-%H:%M:%S").csv
echo $outfile

cols=("cpu-clock" "task-clock" "page-faults" "major-faults" "context-switches" "cpu-migrations" "duration_time")

numcols=$(echo ${cols[@]})
columns=$(echo ${numcols// /,})

WARMUP_ROUNDS=3
for((i=0; i<WARMUP_ROUNDS; i++))
do
    ./${executable} > /dev/null 2>&1
done

echo $columns >> ${outfile}
SAMPLES=30

for((j=0; j<SAMPLES; j++))
do
    #echo "loop ${j}"
    sudo /usr/lib/linux-tools/6.8.0-57-generic/perf stat -a -x';' -o ${outfile}.tmp -e \
                cpu-clock,task-clock,page-faults,major-faults,context-switches,cpu-migrations,duration_time ./${executable} >> ${outfile} #<- agregar soporte de argumentos
    cut -d';' -f1 ${outfile}.tmp | sed '/#/d' | sed '/^$/d' | paste -s | sed 's/,/./g' | sed 's/\s\+/,/g' >> ${outfile}
done

find ${outfile} -type f -exec sed -i 's/<not,counted>/<not-counted>/g' {} \;
find ${outfile} -type f -exec sed -i 's/<not,supported>/<not-supported>/g' {} \;

rm ${outfile}.tmp
