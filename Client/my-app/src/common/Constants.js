const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

export const serverURL = isDev ? "http://127.0.0.1:5000/" : "/";
export const baseURL = serverURL + "sendcode";
export const statusURL = serverURL + "checkstatus/";
export default function getTask(taskState) {
    console.log("taskstate", taskState);
    if (taskState === 'lcs')
        return "LCS";
    if (taskState === 'size') {
        return "SIZE";
    }
    if (taskState.includes('camm')) {
        if (taskState === 'cammr')
            return "CAMMR";
        if (taskState === 'cammso')
            return "CAMMSO";
        if (taskState === 'camms')
            return "CAMMS";
        return "CAMM";
    }
    return "";
}

export const tasks = [

    {
        id: 'lcs',
        title: 'Text input',
        description: `Prueba con entrada de texto, usando un archivo de English50MB. Se realizan 30 incrementos hasta el tamaño del input. En cada incremento se ejecuta el algoritmo la cantidad de veces seleccionada por el usuario.`
    },
    {
        id: 'camm',
        title: 'Numerical input',
        description: `Prueba con entrada numérica, proveniente de un archivo con 150.000 valores. Se realizan 30 incrementos hasta el tamaño del input. Cada uno se repite según el número definido por el usuario.`
    },
    {
        id: 'size',
        title: 'Input size',
        description: `Prueba con entrada numérica única como argumento. Se realizan 30 incrementos del valor de entrada, y cada uno se repite tantas veces como defina el usuario.`
    }
];

export const numericalInputOptions = [
    { value: 'cammr', label: 'Numeros aleatoreos' },
    { value: 'cammso', label: 'Numeros semi-ordenados' },
    { value: 'camms', label: 'Numeros iguales' },
];

export const METRIC_DESCRIPTIONS = {
    Instructions:
        "Número total de instrucciones ejecutadas por el CPU durante la ejecución del programa.\nRefleja la cantidad de operaciones básicas necesarias para completar la tarea.\nUn menor número de instrucciones, si se mantiene el mismo resultado, puede indicar un código más optimizado y eficiente.\nSin embargo, no siempre menos es mejor: depende de la calidad de la implementación y del tipo de algoritmo.",

    CpuCycles:
        "Cantidad total de ciclos de reloj del CPU utilizados para ejecutar el programa.\nCada ciclo de CPU representa un 'tick' donde el procesador puede ejecutar parte de una instrucción.\nComparar ciclos con instrucciones permite calcular la eficiencia real (IPC).\nMenos ciclos para la misma cantidad de instrucciones indica un uso más eficiente del procesador.",

    TaskClock:
        "Tiempo total de ejecución activo del proceso en milisegundos.\nIndica cuánto tiempo estuvo efectivamente ocupado el CPU ejecutando el proceso, considerando posibles hilos o tareas concurrentes.\nEs una métrica clave para comparar la rapidez entre diferentes implementaciones.",

    CpuClock:
        "Tiempo total de CPU consumido por el programa en milisegundos.\nIncluye el tiempo de todos los núcleos y hilos usados.\nSirve para medir el costo total de procesamiento, especialmente relevante en algoritmos paralelos o con múltiples hilos.",

    Branches:
        "Número total de bifurcaciones o saltos condicionales ejecutados, como if, loops o jumps.\nEl procesador necesita predecir estas bifurcaciones para mantener el flujo eficiente de ejecución.\nMuchos branches pueden hacer el flujo menos predecible, dificultando la optimización.",

    BranchMisses:
        "Cantidad de fallos en la predicción de bifurcaciones.\nCuando el procesador predice incorrectamente, se produce un 'branch misprediction', obligando a descartar instrucciones ya procesadas y reiniciar el flujo correcto.\nEsto penaliza el rendimiento y aumenta la latencia.",

    L1DcacheLoads:
        "Número de lecturas desde la caché L1 de datos (primer nivel).\nL1 (Level 1): caché más cercana al núcleo del CPU, extremadamente rápida pero pequeña (normalmente 32-64 KB).\nAcceder a L1 significa mínima latencia y máximo rendimiento.\nUn alto número de lecturas exitosas en L1 es deseable porque reduce la dependencia de niveles más lentos (L2, L3 y RAM).",

    L1DcacheLoadMisses:
        "Cantidad de fallos al leer en la caché L1 de datos.\nCuando ocurre un fallo en L1, el CPU debe buscar en la caché L2 o L3, o en última instancia en la RAM, lo cual es mucho más lento.\nMinimizar estos fallos es crítico para mantener la eficiencia y evitar cuellos de botella de memoria.\n\nSobre jerarquía de caché:\n- L1: la más rápida y cercana, pequeña.\n- L2: intermedia, más grande, compartida por menos núcleos.\n- L3: última línea de defensa antes de RAM, más grande y más lenta.",

    L1DcacheStores:
        "Número de escrituras en la caché L1 de datos.\nAlmacenar datos en L1 permite que operaciones posteriores (como bucles o acumulaciones) se ejecuten de manera extremadamente rápida.\nUn uso eficiente de la L1 evita presión en los niveles superiores y reduce los tiempos de acceso globales.",

    LLCLoads:
        "Número de lecturas realizadas desde la LLC (Last Level Cache), que en la mayoría de los sistemas modernos corresponde a la caché L3.\nL3 (Level 3): más grande y más lenta que L1 y L2, suele ser compartida por varios núcleos.\nAcceder a la LLC es mucho más rápido que ir a la RAM, pero más lento que L1 o L2.\nAlta actividad en LLC puede indicar acceso frecuente a datos compartidos entre hilos o núcleos.",

    LLCLoadMisses:
        "Cantidad de fallos al intentar leer en la LLC (normalmente L3).\nCuando se produce un fallo aquí, el CPU se ve obligado a buscar datos en la memoria RAM, lo que introduce mucha más latencia.\nReducir estos fallos mejora significativamente el rendimiento general y el consumo energético.",

    LLCStores:
        "Número de escrituras en la LLC (caché L3).\nEste nivel se usa para almacenar datos que podrían necesitar otros núcleos y para preparar escritura en RAM.\nUn uso eficiente ayuda a reducir la congestión en la RAM y facilita el trabajo en paralelo.",

    LLCStoreMisses:
        "Cantidad de fallos al escribir en la LLC.\nCuando ocurre un fallo, se debe escribir directamente en la memoria RAM, lo que es mucho más lento y costoso.\nMinimizar estos fallos implica un mejor diseño de estructuras de datos y un acceso más coherente a la memoria.",

    CacheReferences:
        "Número total de accesos a cualquier nivel de caché (lecturas + escrituras).\nEsta métrica muestra la intensidad del uso de la jerarquía de memoria rápida.\nUn programa bien optimizado tendrá muchas referencias exitosas y pocos fallos, lo que mejora tanto la velocidad como el consumo energético.",

    CacheMisses:
        "Número total de fallos de caché (todos los niveles).\nUn fallo significa que el dato no está disponible en ninguna caché y debe buscarse en la RAM.\nCada fallo implica un gran costo en latencia y energía.\nReducir los fallos de caché es uno de los objetivos clave en optimización de algoritmos.",

    PageFaults:
        "Cantidad de fallos de página.\nSe producen cuando el proceso accede a una página de memoria que no está en la RAM y necesita ser cargada desde disco.\nLos fallos de página son una señal de que el programa está utilizando más memoria de la que puede mantener activa, lo que degrada drásticamente el rendimiento.",

    MajorFaults:
        "Cantidad de fallos de página 'mayores'.\nEstos requieren que el sistema operativo cargue datos desde disco o swap.\nSon extremadamente costosos en tiempo y afectan negativamente el rendimiento general.\nReducir el uso excesivo de memoria y optimizar el acceso ayuda a disminuir estos fallos.",

    EnergyPkg:
        "Energía total consumida por el paquete completo del CPU (Package).\nIncluye todos los núcleos, caches integradas y controladores internos.\nPermite evaluar el impacto energético global del programa y comparar implementaciones en términos de eficiencia energética.",

    EnergyCores:
        "Energía consumida únicamente por los núcleos de ejecución del CPU.\nSirve para entender el costo energético directo de las operaciones de cómputo puras.\nIdeal para comparar si un algoritmo es más 'ligero' en términos de uso de CPU.",

    EnergyRAM:
        "Energía consumida por la memoria RAM durante la ejecución.\nUn alto consumo suele estar asociado a algoritmos que mueven o procesan grandes volúmenes de datos.\nOptimizar el uso de estructuras de datos y reducir accesos innecesarios a memoria ayuda a disminuir este consumo.",

    StartTime:
        "Hora exacta en la que se inició la ejecución del programa.\nPermite rastrear cuándo se realizó la prueba y correlacionar con otros experimentos o estados del sistema.",

    EndTime:
        "Hora exacta en la que finalizó la ejecución.\nCombinada con StartTime, sirve para verificar la duración total de forma precisa y para auditoría experimental.",

    DurationTime:
        "Duración total de la ejecución del programa en milisegundos.\nEs una de las métricas más intuitivas para el usuario, ya que indica el tiempo real que tarda en completarse la tarea.\nSe usa como referencia principal para comparar la rapidez entre algoritmos o configuraciones.",

    IPC:
        "Instructions Per Cycle (IPC), o Instrucciones por Ciclo.\nCalculado como Instructions / CpuCycles.\nMide cuántas instrucciones se ejecutan en promedio por ciclo de CPU.\nUn IPC alto indica un mejor aprovechamiento del procesador y mayor eficiencia.\nEste valor depende del tipo de tarea y de cómo el compilador y el CPU gestionan el flujo de instrucciones.",

    CacheMissRate:
        "Tasa de fallos de caché.\nCalculada como CacheMisses / CacheReferences.\nIndica qué porcentaje de los accesos a la caché no encontró el dato necesario y debió buscarlo en la memoria RAM.\nUna tasa baja refleja un uso eficiente de la jerarquía de caché y un algoritmo bien optimizado en acceso a memoria.",

    BranchMissRate:
        "Tasa de fallos en predicción de bifurcaciones.\nCalculada como BranchMisses / Branches.\nRefleja qué tan bien el procesador logra predecir los saltos en el flujo del programa (if, loops).\nUna tasa baja significa menor penalización y mayor aprovechamiento del pipeline, lo que se traduce en mejor rendimiento."
};


export const METRIC_CATEGORIES = {
    CPU: ["Instructions", "CpuCycles", "TaskClock", "CpuClock", "Branches", "BranchMisses", "IPC"],
    Memoria: ["LLCLoads", "LLCLoadMisses", "LLCStores", "LLCStoreMisses", "L1DcacheLoads", "L1DcacheLoadMisses", "L1DcacheStores", "CacheReferences", "CacheMisses", "CacheMissRate"],
    Sistema: ["PageFaults", "MajorFaults"],
    Tiempo: ["StartTime", "EndTime", "DurationTime"],
    Energía: ["EnergyPkg", "EnergyCores", "EnergyRAM"],
    "Predicción de Flujo": ["BranchMissRate"]
};
